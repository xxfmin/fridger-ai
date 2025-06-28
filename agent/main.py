import os
from pathlib import Path
import base64
import asyncio
import io
import re
import json

import uvicorn
from dataclasses import dataclass
from pydantic import BaseModel
import logfire
from httpx import AsyncClient
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.gemini import GeminiModel
from pydantic_ai.exceptions import UserError
from dotenv import load_dotenv
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# For direct Gemini vision
import google.generativeai as genai
from PIL import Image

# Import models
from models.RecipeSearchParams import ExtractedIngredients, RecipeSearchParams
from models.RecipeDetails import RecipeDetails

load_dotenv()
logfire.configure()

# FastAPI instance
app = FastAPI()

origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@dataclass
class Deps:
    client: AsyncClient
    spoonacular_api_key: str | None
    image_base64: str | None = None  # Add this field for image storage
    last_recipes: List[Dict] = None  # store recipes found during conversation
    last_extracted_ingredients: Optional[ExtractedIngredients] = None  # store ingredients found from image 
    last_formatted_params: Optional[RecipeSearchParams] = None  # store formatted recipe search parameters
    all_recipe_details: Optional[List[RecipeDetails]] = None  # store details for all recipes from search

# ================================================== AGENTS ================================================== 

model = GeminiModel(model_name="gemini-2.0-flash")

# Agent that converts extracted ingredients to recipe search params
ingredient_formatter_agent = Agent(
    model=model,
    result_type=RecipeSearchParams,
    system_prompt="""Convert the list of extracted ingredients into recipe search parameters.
    
    RULES:
    1. Focus on main cooking ingredients (meats, vegetables, dairy, grains)
    2. Include condiments only if they're commonly used in recipes (e.g., soy sauce, honey)
    3. Exclude beverages unless they're cooking ingredients (e.g., wine, coconut milk)
    4. Format as comma-separated string
    5. Use common recipe-friendly names (e.g., "bell pepper" not "red bell pepper")
    6. Limit to 10-15 most versatile ingredients to get better recipe matches
    
    Return in the format required by the Spoonacular API."""
)

# Main agent with tools for recipe management
main_agent = Agent(
    model=model,
    deps_type=Deps,
    result_type=str,
    system_prompt="""You are a helpful cooking assistant that helps users find recipes based on ingredients in their fridge.
    
    You have access to these tools:
    1. analyze_fridge_contents - Use this to analyze fridge images and extract ingredients
    2. format_ingredients_for_recipes - Format extracted ingredients for recipe search
    3. search_recipes_by_ingredients - Search for recipes based on ingredients
    4. get_all_recipe_details - Get detailed information for recipes
    5. search_recipes_with_details - Search and get details in one step
    
    When the user provides an image or mentions analyzing a fridge, ALWAYS use the analyze_fridge_contents tool first.
    The user's last extracted ingredients and found recipes are stored in your context.
    
    Be friendly, helpful, and provide useful cooking suggestions!"""
)

# ================================================== TOOLS ================================================== 

@main_agent.tool
async def analyze_fridge_contents(
    ctx: RunContext[Deps], 
    image_base64: Optional[str] = None
) -> str:
    """
    Analyze a fridge image to extract ALL visible ingredients using Gemini directly.
    
    Args:
        image_base64: Base64 encoded image of the fridge interior (optional - will use from context if not provided)
        
    Returns:
        A summary of all ingredients found in the fridge
    """
    with logfire.span("analyze_fridge_contents") as span:
        try:
            # Use provided image or get from context
            if not image_base64 and ctx.deps.image_base64:
                image_base64 = ctx.deps.image_base64
                logfire.info("Using image from context")
            
            if not image_base64:
                error_msg = "No image provided. Please upload a fridge image."
                span.set_attribute("status", "no_image")
                return error_msg
            
            # Try to decode base64
            try:
                # If it's a data URL, extract the base64 part
                if ',' in image_base64 and image_base64.startswith('data:'):
                    image_base64 = image_base64.split(',')[1]
                
                # Clean whitespace
                image_base64 = image_base64.strip()
                
                # Add padding if needed
                missing_padding = len(image_base64) % 4
                if missing_padding:
                    image_base64 += '=' * (4 - missing_padding)
                
                # Decode
                image_bytes = base64.b64decode(image_base64)
                image = Image.open(io.BytesIO(image_bytes))
                
                logfire.info(f"Successfully decoded image: {image.format} {image.width}x{image.height}")
                
            except Exception as e:
                # If direct decode fails, try using the original from context
                if ctx.deps.image_base64 and ctx.deps.image_base64 != image_base64:
                    logfire.info("Trying with original image from context")
                    image_base64 = ctx.deps.image_base64
                    if ',' in image_base64 and image_base64.startswith('data:'):
                        image_base64 = image_base64.split(',')[1]
                    image_base64 = image_base64.strip()
                    missing_padding = len(image_base64) % 4
                    if missing_padding:
                        image_base64 += '=' * (4 - missing_padding)
                    image_bytes = base64.b64decode(image_base64)
                    image = Image.open(io.BytesIO(image_bytes))
                else:
                    raise e
            
            # Configure Gemini
            genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
            
            if not os.getenv("GEMINI_API_KEY"):
                raise ValueError("GEMINI_API_KEY not found in environment variables")
            
            model = genai.GenerativeModel('gemini-2.5-flash')
            
            # Create detailed prompt for Gemini
            prompt = """Analyze this refrigerator image and list EVERY SINGLE visible item.

IMPORTANT: Just list the items, one per line. No headers, no sections, no explanations.
Don't say "Top shelf" or "Middle shelf" - just list the actual food items.

Be SPECIFIC with names:
- Include brand names when visible (e.g., "Heinz ketchup" not just "ketchup")
- Be specific about types (e.g., "whole milk" not just "milk")
- Name specific fruits/vegetables (e.g., "red bell pepper" not just "pepper")

List EVERYTHING you can see:
- Every condiment
- Every dairy product
- Every fruit (individually)
- Every vegetable (individually)
- Every beverage
- Every jar, container, package
- Every other food item

Format: Just the item name, one per line. Nothing else."""
            
            # Generate content with Gemini
            response = model.generate_content([prompt, image])
            
            # Parse the response into a list of ingredients
            ingredients_text = response.text.strip()
            ingredients_list = [item.strip() for item in ingredients_text.split('\n') if item.strip()]
            
            # Log raw response for debugging
            logfire.info(f"Raw response contained {len(ingredients_list)} lines")
            
            # Remove any numbering, bullets, headers, and filter out non-ingredient lines
            cleaned_ingredients = []
            filtered_count = 0
            
            for item in ingredients_list:
                # Skip lines that are headers or formatting
                if any(skip_word in item.lower() for skip_word in [
                    'shelf', 'compartment', 'drawer', 'left to right', 
                    'here\'s', 'list of', 'organized by', 'please note',
                    'assuming', ':**', 'various fruits...', '...', 'i can see'
                ]):
                    filtered_count += 1
                    continue
                
                # Remove common prefixes like "1.", "•", "-", etc.
                cleaned_item = re.sub(r'^[\d\-\•\*\.\s]+', '', item)
                
                # Remove any trailing asterisks or formatting
                cleaned_item = cleaned_item.rstrip('*:')
                
                # Skip empty items or very short items (likely formatting artifacts)
                if cleaned_item and len(cleaned_item) > 2 and any(c.isalpha() for c in cleaned_item):
                    cleaned_ingredients.append(cleaned_item)
                else:
                    filtered_count += 1
            
            logfire.info(f"Filtered out {filtered_count} non-ingredient lines, kept {len(cleaned_ingredients)} ingredients")
            
            # Create ExtractedIngredients object
            extracted_ingredients = ExtractedIngredients(ingredients=cleaned_ingredients)
            
            # Store in context
            ctx.deps.last_extracted_ingredients = extracted_ingredients
            
            # Log all found ingredients
            span.set_attribute("total_ingredients_count", len(cleaned_ingredients))
            span.set_attribute("all_ingredients", cleaned_ingredients)
            span.set_attribute("analysis_status", "success")
            
            logfire.info(f"Successfully extracted {len(cleaned_ingredients)} ingredients")
            
            # Return a summary
            if len(cleaned_ingredients) == 0:
                return "I couldn't identify any ingredients in the image. Please make sure the image clearly shows the contents of your fridge."
            elif len(cleaned_ingredients) <= 10:
                return f"Found {len(cleaned_ingredients)} items in your fridge: {', '.join(cleaned_ingredients)}"
            else:
                return f"Found {len(cleaned_ingredients)} items in your fridge: {', '.join(cleaned_ingredients[:10])}... and {len(cleaned_ingredients) - 10} more items"
            
        except Exception as e:
            span.set_attribute("analysis_status", "error")
            span.set_attribute("error_message", str(e))
            span.set_attribute("error_type", type(e).__name__)
            span.record_exception(e)
            
            error_msg = f"Error analyzing fridge contents: {str(e)}"
            logfire.error(error_msg, exc_info=True)
            
            # Return a user-friendly error message
            if "GEMINI_API_KEY" in str(e):
                return "API configuration error. Please check that the Gemini API key is properly configured."
            elif "quota" in str(e).lower():
                return "API quota exceeded. Please try again later."
            else:
                return f"Failed to analyze the image: {str(e)}"

@main_agent.tool
async def format_ingredients_for_recipes(
    ctx: RunContext[Deps]
) -> str:
    """
    Format the extracted fridge ingredients into recipe search parameters.
    This tool takes the last extracted ingredients and formats them for recipe searching.
    
    Returns:
        A formatted string of ingredients suitable for recipe search
    """
    with logfire.span("format_ingredients_for_recipes") as span:
        try:
            # Check if we have extracted ingredients
            if not ctx.deps.last_extracted_ingredients or not ctx.deps.last_extracted_ingredients.ingredients:
                error_msg = "No ingredients found. Please analyze a fridge image first."
                span.set_attribute("status", "no_ingredients")
                logfire.warning(error_msg)
                return error_msg
            
            # Get the extracted ingredients
            extracted = ctx.deps.last_extracted_ingredients
            ingredients_count = len(extracted.ingredients)
            span.set_attribute("input_ingredient_count", ingredients_count)
            
            logfire.info(f"Formatting {ingredients_count} ingredients for recipe search")
            
            # Use the ingredient formatter agent to convert to recipe search params
            # Create a proper string representation of the ingredients
            ingredients_str = ", ".join(extracted.ingredients)
            
            try:
                formatted_params = await ingredient_formatter_agent.run(
                    f"Convert these ingredients for recipe search: {ingredients_str}"
                )
                
                # Check if formatting was successful
                if formatted_params.data and formatted_params.data.ingredients:
                    span.set_attribute("formatted_ingredients", formatted_params.data.ingredients)
                    formatted_count = len(formatted_params.data.ingredients.split(','))
                    span.set_attribute("formatted_count", formatted_count)
                    span.set_attribute("status", "success")
                    
                    # Store the formatted params for future use
                    ctx.deps.last_formatted_params = formatted_params.data
                    
                    ingredient_list = formatted_params.data.ingredients
                    logfire.info(f"Successfully formatted {formatted_count} ingredients: {ingredient_list}")
                    
                    return f"Formatted {formatted_count} key ingredients for recipe search: {ingredient_list}"
                else:
                    span.set_attribute("status", "formatting_failed")
                    error_msg = "Failed to format ingredients. The formatter returned empty results."
                    logfire.error(error_msg)
                    return error_msg
                    
            except Exception as format_error:
                span.set_attribute("status", "formatter_error")
                span.set_attribute("formatter_error", str(format_error))
                logfire.error(f"Formatter agent error: {str(format_error)}")
                
                # Fallback: do basic formatting ourselves
                # Select the most common cooking ingredients
                cooking_ingredients = []
                for ing in extracted.ingredients:
                    # Skip beverages and non-cooking items
                    ing_lower = ing.lower()
                    if not any(skip in ing_lower for skip in ['water', 'ice', 'soda', 'beer', 'wine bottle']):
                        # Clean up the ingredient name
                        clean_ing = re.sub(r'\b(fresh|organic|whole|sliced|chopped)\b', '', ing, flags=re.IGNORECASE)
                        clean_ing = clean_ing.strip()
                        if clean_ing:
                            cooking_ingredients.append(clean_ing)
                
                # Take top 15 ingredients
                selected_ingredients = cooking_ingredients[:15]
                if selected_ingredients:
                    formatted_str = ",".join(selected_ingredients)
                    
                    # Create a RecipeSearchParams object manually
                    from models.RecipeSearchParams import RecipeSearchParams
                    ctx.deps.last_formatted_params = RecipeSearchParams(ingredients=formatted_str)
                    
                    span.set_attribute("status", "fallback_success")
                    span.set_attribute("fallback_ingredients", formatted_str)
                    
                    return f"Formatted {len(selected_ingredients)} ingredients using fallback method: {formatted_str}"
                else:
                    return "Could not format ingredients for recipe search. Please try with different ingredients."
                
        except Exception as e:
            span.set_attribute("status", "error")
            span.set_attribute("error_message", str(e))
            span.record_exception(e)
            
            error_msg = f"Error formatting ingredients: {str(e)}"
            logfire.error(error_msg, exc_info=True)
            return error_msg

@main_agent.tool
async def search_recipes_by_ingredients(
    ctx: RunContext[Deps],
    number: Optional[int] = 20,
    ranking: Optional[int] = 2
) -> str:
    """
    Search for recipes using the formatted ingredients via Spoonacular API.
    Uses the last formatted ingredients from the context.
    
    Args:
        number: Maximum number of recipes to return (default 20)
        ranking: 1 to maximize used ingredients, 2 to minimize missing ingredients (default 2)
        
    Returns:
        A summary of recipes found with their titles and used/missed ingredients
    """
    with logfire.span("search_recipes_by_ingredients") as span:
        try:
            # Check if we have formatted ingredients
            if not ctx.deps.last_formatted_params:
                error_msg = "No formatted ingredients found. Please format ingredients first."
                span.set_attribute("status", "no_ingredients")
                logfire.warning(error_msg)
                return error_msg
            
            # Check API key
            if not ctx.deps.spoonacular_api_key:
                error_msg = "Spoonacular API key not found. Please set SPOONACULAR_API_KEY in .env"
                span.set_attribute("status", "no_api_key")
                logfire.error(error_msg)
                return error_msg
            
            # Get the formatted ingredients
            ingredients = ctx.deps.last_formatted_params.ingredients
            span.set_attribute("ingredients", ingredients)
            span.set_attribute("number_requested", number)
            span.set_attribute("ranking", ranking)
            
            logfire.info(f"Searching recipes with ingredients: {ingredients}")
            
            # Prepare API request
            base_url = "https://api.spoonacular.com/recipes/findByIngredients"
            params = {
                "ingredients": ingredients,
                "number": number,
                "ignorePantry": True,  # Always ignore pantry items
                "ranking": ranking,
                "apiKey": ctx.deps.spoonacular_api_key
            }
            
            # Make API request
            response = await ctx.deps.client.get(base_url, params=params)
            response.raise_for_status()
            
            recipes = response.json()
            span.set_attribute("recipes_found", len(recipes))
            
            # Store recipes in context
            ctx.deps.last_recipes = recipes
            
            # Log recipe details
            if recipes:
                logfire.info(f"Found {len(recipes)} recipes")
                
                # Create a summary of recipes
                summary_lines = [f"Found {len(recipes)} recipes using your ingredients:\n"]
                
                for i, recipe in enumerate(recipes[:10], 1):  # Show first 10
                    recipe_id = recipe.get('id')
                    title = recipe.get('title', 'Unknown')
                    used_count = recipe.get('usedIngredientCount', 0)
                    missed_count = recipe.get('missedIngredientCount', 0)
                    
                    # Log individual recipe
                    span.set_attribute(f"recipe_{i}_id", recipe_id)
                    span.set_attribute(f"recipe_{i}_title", title)
                    span.set_attribute(f"recipe_{i}_used_ingredients", used_count)
                    span.set_attribute(f"recipe_{i}_missed_ingredients", missed_count)
                    
                    # Get ingredient details
                    used_ingredients = [ing['name'] for ing in recipe.get('usedIngredients', [])]
                    missed_ingredients = [ing['name'] for ing in recipe.get('missedIngredients', [])]
                    
                    summary_lines.append(f"\n{i}. {title}")
                    summary_lines.append(f"   - Uses {used_count} of your ingredients: {', '.join(used_ingredients)}")
                    if missed_count > 0:
                        summary_lines.append(f"   - Missing {missed_count} ingredients: {', '.join(missed_ingredients[:3])}{'...' if missed_count > 3 else ''}")
                
                if len(recipes) > 10:
                    summary_lines.append(f"\n... and {len(recipes) - 10} more recipes")
                
                span.set_attribute("status", "success")
                return ''.join(summary_lines)
            else:
                span.set_attribute("status", "no_recipes_found")
                return "No recipes found with those ingredients. Try using fewer or different ingredients."
            
        except Exception as e:
            span.set_attribute("status", "error")
            span.set_attribute("error_message", str(e))
            span.record_exception(e)
            
            error_msg = f"Error searching recipes: {str(e)}"
            logfire.error(error_msg)
            
            # Check for specific API errors
            if "402" in str(e):
                return "API quota exceeded. Please check your Spoonacular plan."
            elif "401" in str(e):
                return "Invalid API key. Please check your SPOONACULAR_API_KEY."
            
            raise UserError(error_msg)

@main_agent.tool
async def get_all_recipe_details(
    ctx: RunContext[Deps],
    max_recipes: Optional[int] = None
) -> str:
    """
    Get detailed information for all recipes from the last search results.
    
    Args:
        max_recipes: Maximum number of recipes to get details for (default: all)
        
    Returns:
        A comprehensive summary of all recipes with their details
    """
    with logfire.span("get_all_recipe_details") as span:
        try:
            # Check if we have recipes
            if not ctx.deps.last_recipes:
                error_msg = "No recipes found. Please search for recipes first."
                span.set_attribute("status", "no_recipes")
                logfire.warning(error_msg)
                return error_msg
            
            # Check API key
            if not ctx.deps.spoonacular_api_key:
                error_msg = "Spoonacular API key not found. Please set SPOONACULAR_API_KEY in .env"
                span.set_attribute("status", "no_api_key")
                logfire.error(error_msg)
                return error_msg
            
            # Determine how many recipes to fetch
            recipes_to_fetch = ctx.deps.last_recipes
            if max_recipes and max_recipes < len(recipes_to_fetch):
                recipes_to_fetch = recipes_to_fetch[:max_recipes]
            
            span.set_attribute("total_recipes", len(ctx.deps.last_recipes))
            span.set_attribute("fetching_details_for", len(recipes_to_fetch))
            
            logfire.info(f"Fetching details for {len(recipes_to_fetch)} recipes...")
            
            # Store all recipe details
            all_recipe_details = []
            failed_recipes = []
            
            # Fetch details for each recipe
            for idx, recipe in enumerate(recipes_to_fetch):
                recipe_id = recipe.get('id')
                recipe_title = recipe.get('title', 'Unknown')
                
                with logfire.span(f"fetch_recipe_{idx+1}") as recipe_span:
                    recipe_span.set_attribute("recipe_id", recipe_id)
                    recipe_span.set_attribute("recipe_title", recipe_title)
                    
                    try:
                        # Make API request
                        base_url = f"https://api.spoonacular.com/recipes/{recipe_id}/information"
                        params = {
                            "includeNutrition": True,
                            "apiKey": ctx.deps.spoonacular_api_key
                        }
                        
                        response = await ctx.deps.client.get(base_url, params=params)
                        response.raise_for_status()
                        
                        recipe_data = response.json()
                        
                        # Log the raw API response structure
                        logfire.info(f"Raw API response for recipe {recipe_id}", 
                                   has_extendedIngredients='extendedIngredients' in recipe_data,
                                   has_ingredients='ingredients' in recipe_data,
                                   has_instructions='analyzedInstructions' in recipe_data,
                                   extendedIngredient_count=len(recipe_data.get('extendedIngredients', [])),
                                   instruction_count=len(recipe_data.get('analyzedInstructions', [])))
                        
                        # Map extendedIngredients to ingredients if needed
                        if 'extendedIngredients' in recipe_data and 'ingredients' not in recipe_data:
                            recipe_data['ingredients'] = recipe_data['extendedIngredients']
                            logfire.info(f"Mapped extendedIngredients to ingredients for recipe {recipe_id}")
                        
                        # Parse into RecipeDetails model
                        recipe_details = RecipeDetails(**recipe_data)
                        
                        # Verify parsing worked
                        logfire.info(f"Parsed recipe {recipe_id}", 
                                   title=recipe_details.title,
                                   ingredient_count=len(recipe_details.ingredients),
                                   instruction_count=len(recipe_details.analyzedInstructions),
                                   has_nutrition=recipe_details.nutrition is not None,
                                   first_ingredient=recipe_details.ingredients[0].name if recipe_details.ingredients else "None")
                        
                        all_recipe_details.append(recipe_details)
                        
                    except Exception as e:
                        recipe_span.set_attribute("status", "error")
                        recipe_span.set_attribute("error", str(e))
                        failed_recipes.append({"id": recipe_id, "title": recipe_title, "error": str(e)})
                        logfire.error(f"✗ Failed to get details for recipe {idx+1}: {recipe_title} - {str(e)}")
                        continue
            
            # Store all details in context
            ctx.deps.all_recipe_details = all_recipe_details
            
            # Log summary statistics
            span.set_attribute("successful_fetches", len(all_recipe_details))
            span.set_attribute("failed_fetches", len(failed_recipes))
            
            if failed_recipes:
                span.set_attribute("failed_recipes", failed_recipes)
            
            # Create comprehensive summary
            summary_lines = [f"📚 Retrieved details for {len(all_recipe_details)} recipes:\n"]
            summary_lines.append("=" * 80 + "\n")
            
            # Sort recipes by used ingredients (best matches first)
            # Fix: Use .get('id') instead of .id since ctx.deps.last_recipes contains dictionaries
            original_order = {r.get('id'): r.get('usedIngredientCount', 0) for r in ctx.deps.last_recipes}
            all_recipe_details.sort(key=lambda r: original_order.get(r.id, 0), reverse=True)
            
            # Create detailed summaries
            all_recipes_data = []
            
            for idx, recipe in enumerate(all_recipe_details, 1):
                # Store structured data
                recipe_data = {
                    "index": idx,
                    "id": recipe.id,
                    "title": recipe.title,
                    "ready_in_minutes": recipe.readyInMinutes,
                    "calories": recipe.nutrition.calories if recipe.nutrition else None,
                    "protein": recipe.nutrition.protein if recipe.nutrition else None,
                    "carbs": recipe.nutrition.carbohydrates if recipe.nutrition else None,
                    "fat": recipe.nutrition.fat if recipe.nutrition else None,
                    "ingredient_count": len(recipe.ingredients),
                    "instruction_steps": len(recipe.analyzedInstructions),
                    "ingredients": [{"name": ing.name, "amount": ing.amount, "unit": ing.unit} 
                                  for ing in recipe.ingredients],
                    "analyzedInstructions": [{"number": step.number, "step": step.step, "minutes": step.length} 
                                   for step in recipe.analyzedInstructions]
                }
                all_recipes_data.append(recipe_data)
                
                # Create readable summary
                summary_lines.append(f"\n{idx}. {recipe.title}")
                summary_lines.append(f"   {'─' * 60}")
                summary_lines.append(f"   ⏱️  Ready in: {recipe.readyInMinutes} minutes")
                
                # Nutrition (with safety checks)
                if recipe.nutrition:
                    summary_lines.append(f"   📊 Nutrition: {recipe.nutrition.calories or 'N/A'} cal | ")
                    summary_lines.append(f"{recipe.nutrition.protein or 'N/A'}g protein | ")
                    summary_lines.append(f"{recipe.nutrition.carbohydrates or 'N/A'}g carbs | ")
                    summary_lines.append(f"{recipe.nutrition.fat or 'N/A'}g fat")
                else:
                    summary_lines.append("   📊 Nutrition: Information not available")
                
                # Ingredients preview
                summary_lines.append(f"   🥘 {len(recipe.ingredients)} ingredients")
                for ing in recipe.ingredients[:3]:  # Show first 3
                    if ing.amount and ing.unit:
                        summary_lines.append(f"      • {ing.amount} {ing.unit} {ing.name}")
                    else:
                        summary_lines.append(f"      • {ing.name}")
                if len(recipe.ingredients) > 3:
                    summary_lines.append(f"      ... and {len(recipe.ingredients) - 3} more")
                
                # Instructions preview
                if recipe.analyzedInstructions:
                    summary_lines.append(f"   📝 {len(recipe.analyzedInstructions)} steps")
                    if recipe.analyzedInstructions:
                        first_step = recipe.analyzedInstructions[0]
                        preview = first_step.step[:80] + "..." if len(first_step.step) > 80 else first_step.step
                        summary_lines.append(f"      First step: {preview}")
                
                summary_lines.append("")  # Empty line between recipes
            
            # Store all structured data
            span.set_attribute("all_recipes_details", all_recipes_data)
            
            # Summary statistics
            summary_lines.append("\n" + "=" * 80)
            summary_lines.append(f"\n📊 SUMMARY STATISTICS:")
            summary_lines.append(f"   • Total recipes detailed: {len(all_recipe_details)}")
            
            if all_recipe_details:
                avg_time = sum(r.readyInMinutes for r in all_recipe_details) / len(all_recipe_details)
                # Calculate average calories only for recipes that have nutrition info
                recipes_with_calories = [r for r in all_recipe_details if r.nutrition and r.nutrition.calories]
                if recipes_with_calories:
                    avg_calories = sum(r.nutrition.calories for r in recipes_with_calories) / len(recipes_with_calories)
                else:
                    avg_calories = 0
                avg_ingredients = sum(len(r.ingredients) for r in all_recipe_details) / len(all_recipe_details)
                
                summary_lines.append(f"   • Average cooking time: {avg_time:.0f} minutes")
                if avg_calories > 0:
                    summary_lines.append(f"   • Average calories: {avg_calories:.0f}")
                summary_lines.append(f"   • Average ingredients needed: {avg_ingredients:.0f}")
                
                # Find quickest and healthiest options
                quickest = min(all_recipe_details, key=lambda r: r.readyInMinutes)
                summary_lines.append(f"\n   🏃 Quickest option: {quickest.title} ({quickest.readyInMinutes} min)")
                
                if recipes_with_calories:
                    lowest_cal = min(recipes_with_calories, key=lambda r: r.nutrition.calories)
                    summary_lines.append(f"   🥗 Lowest calorie: {lowest_cal.title} ({lowest_cal.nutrition.calories} cal)")
            
            if failed_recipes:
                summary_lines.append(f"\n   ⚠️  Failed to get details for {len(failed_recipes)} recipes")
            
            span.set_attribute("status", "success")
            logfire.info(f"Successfully retrieved details for {len(all_recipe_details)} recipes")
            
            return ''.join(summary_lines)
            
        except Exception as e:
            span.set_attribute("status", "error")
            span.set_attribute("error_message", str(e))
            span.record_exception(e)
            
            error_msg = f"Error getting recipe details: {str(e)}"
            logfire.error(error_msg, exc_info=True)
            return error_msg

@main_agent.tool
async def search_recipes_with_details(
    ctx: RunContext[Deps],
    number: Optional[int] = 10,
    ranking: Optional[int] = 2,
    fetch_details: bool = True
) -> str:
    """
    Search for recipes using the formatted ingredients and automatically fetch detailed information for all results.
    
    Args:
        number: Maximum number of recipes to return (default 10)
        ranking: 1 to maximize used ingredients, 2 to minimize missing ingredients (default 2)
        fetch_details: Whether to automatically fetch detailed info for all recipes (default True)
        
    Returns:
        A comprehensive summary of all recipes found with their complete details
    """
    with logfire.span("search_recipes_with_details") as span:
        try:
            # First, do the regular recipe search
            logfire.info("Step 1: Searching for recipes...")
            search_result = await search_recipes_by_ingredients(ctx, number=number, ranking=ranking)
            
            # If no recipes found or fetch_details is False, return the basic search result
            if not ctx.deps.last_recipes or not fetch_details:
                return search_result
            
            # Now fetch details for all recipes
            logfire.info(f"\nStep 2: Fetching detailed information for {len(ctx.deps.last_recipes)} recipes...")
            
            # Get all recipe details
            all_recipe_details = []
            failed_fetches = []
            
            for idx, recipe in enumerate(ctx.deps.last_recipes):
                recipe_id = recipe.get('id')
                recipe_title = recipe.get('title', 'Unknown')
                
                try:
                    # Make API request for details
                    base_url = f"https://api.spoonacular.com/recipes/{recipe_id}/information"
                    params = {
                        "includeNutrition": True,
                        "apiKey": ctx.deps.spoonacular_api_key
                    }
                    
                    response = await ctx.deps.client.get(base_url, params=params)
                    response.raise_for_status()
                    
                    recipe_data = response.json()
                    recipe_details = RecipeDetails(**recipe_data)
                    
                    # Preserve the original search info
                    recipe_details_dict = recipe_details.model_dump()
                    recipe_details_dict['usedIngredientCount'] = recipe.get('usedIngredientCount', 0)
                    recipe_details_dict['missedIngredientCount'] = recipe.get('missedIngredientCount', 0)
                    recipe_details_dict['usedIngredients'] = recipe.get('usedIngredients', [])
                    recipe_details_dict['missedIngredients'] = recipe.get('missedIngredients', [])
                    
                    all_recipe_details.append((recipe_details, recipe_details_dict))
                    
                    logfire.info(f"✓ Retrieved details for recipe {idx+1}/{len(ctx.deps.last_recipes)}: {recipe_title}")
                    
                except Exception as e:
                    failed_fetches.append({"title": recipe_title, "error": str(e)})
                    logfire.error(f"✗ Failed to get details for: {recipe_title}")
                    continue
            
            # Store all details in context
            ctx.deps.all_recipe_details = [details[0] for details in all_recipe_details]
            
            # Create comprehensive output
            summary_lines = [f"\n🍳 FOUND {len(ctx.deps.last_recipes)} RECIPES WITH COMPLETE DETAILS:\n"]
            summary_lines.append("=" * 80 + "\n")
            
            # Display each recipe with full details
            for idx, (recipe_details, full_data) in enumerate(all_recipe_details, 1):
                # Header with match info
                summary_lines.append(f"\n{idx}. {recipe_details.title}")
                summary_lines.append(f"   {'─' * 70}")
                summary_lines.append(f"   ✅ Uses {full_data['usedIngredientCount']} of your ingredients: ")
                used_names = [ing['name'] for ing in full_data['usedIngredients']]
                summary_lines.append(f"{', '.join(used_names)}")
                
                if full_data['missedIngredientCount'] > 0:
                    summary_lines.append(f"   ❌ Missing {full_data['missedIngredientCount']} ingredients: ")
                    missed_names = [ing['name'] for ing in full_data['missedIngredients'][:5]]
                    summary_lines.append(f"{', '.join(missed_names)}{'...' if full_data['missedIngredientCount'] > 5 else ''}")
                
                # Time and nutrition
                summary_lines.append(f"\n   ⏱️  Ready in: {recipe_details.readyInMinutes} minutes")
                if recipe_details.preparationMinutes:
                    summary_lines.append(f" (Prep: {recipe_details.preparationMinutes}min")
                    if recipe_details.cookingMinutes:
                        summary_lines.append(f", Cook: {recipe_details.cookingMinutes}min)")
                    else:
                        summary_lines.append(")")
                
                # Nutrition info (with safety checks)
                if recipe_details.nutrition:
                    summary_lines.append(f"\n   📊 Nutrition per serving:")
                    summary_lines.append(f"      • Calories: {recipe_details.nutrition.calories or 'N/A'}")
                    summary_lines.append(f"      • Protein: {recipe_details.nutrition.protein or 'N/A'}g")
                    summary_lines.append(f"      • Carbs: {recipe_details.nutrition.carbohydrates or 'N/A'}g")
                    summary_lines.append(f"      • Fat: {recipe_details.nutrition.fat or 'N/A'}g")
                else:
                    summary_lines.append(f"\n   📊 Nutrition: Information not available")
                
                # All ingredients
                summary_lines.append(f"\n   🥘 All Ingredients ({len(recipe_details.ingredients)}):")
                for ing in recipe_details.ingredients:
                    if ing.amount and ing.unit:
                        summary_lines.append(f"      • {ing.amount} {ing.unit} {ing.name}")
                    else:
                        summary_lines.append(f"      • {ing.name}")
                
                # Instructions
                if recipe_details.analyzedInstructions:
                    summary_lines.append(f"\n   📝 Instructions ({len(recipe_details.analyzedInstructions)} steps):")
                    for step in recipe_details.analyzedInstructions:
                        summary_lines.append(f"      {step.number}. {step.step}")
                        if step.length > 0:
                            summary_lines.append(f"         ⏱️  Takes about {step.length} minutes")
                
                # Recipe URL if available
                if recipe_details.image:
                    summary_lines.append(f"\n   🖼️  Image: {recipe_details.image}")
                
                summary_lines.append("\n" + "─" * 80)
            
            # Summary statistics
            if all_recipe_details:
                summary_lines.append(f"\n\n📊 SUMMARY:")
                summary_lines.append(f"   • Successfully retrieved details for {len(all_recipe_details)}/{len(ctx.deps.last_recipes)} recipes")
                
                recipes_list = [d[0] for d in all_recipe_details]
                avg_time = sum(r.readyInMinutes for r in recipes_list) / len(recipes_list)
                
                # Calculate average calories only for recipes with nutrition info
                recipes_with_calories = [r for r in recipes_list if r.nutrition and r.nutrition.calories]
                if recipes_with_calories:
                    avg_calories = sum(r.nutrition.calories for r in recipes_with_calories) / len(recipes_with_calories)
                    summary_lines.append(f"   • Average cooking time: {avg_time:.0f} minutes")
                    summary_lines.append(f"   • Average calories: {avg_calories:.0f}")
                else:
                    summary_lines.append(f"   • Average cooking time: {avg_time:.0f} minutes")
                
                # Find best options
                quickest = min(recipes_list, key=lambda r: r.readyInMinutes)
                summary_lines.append(f"\n   🏃 Quickest recipe: {quickest.title} ({quickest.readyInMinutes} min)")
                
                if recipes_with_calories:
                    lowest_cal = min(recipes_with_calories, key=lambda r: r.nutrition.calories)
                    summary_lines.append(f"   🥗 Lowest calorie: {lowest_cal.title} ({lowest_cal.nutrition.calories} cal)")
                    
                    recipes_with_protein = [r for r in recipes_list if r.nutrition and r.nutrition.protein]
                    if recipes_with_protein:
                        highest_protein = max(recipes_with_protein, key=lambda r: r.nutrition.protein)
                        summary_lines.append(f"   💪 Highest protein: {highest_protein.title} ({highest_protein.nutrition.protein}g)")
            
            if failed_fetches:
                summary_lines.append(f"\n   ⚠️  Failed to get details for {len(failed_fetches)} recipes")
            
            # Log structured data
            span.set_attribute("total_recipes_found", len(ctx.deps.last_recipes))
            span.set_attribute("details_fetched", len(all_recipe_details))
            span.set_attribute("failed_fetches", len(failed_fetches))
            span.set_attribute("status", "success")
            
            return ''.join(summary_lines)
            
        except Exception as e:
            span.set_attribute("status", "error")
            span.set_attribute("error_message", str(e))
            span.record_exception(e)
            
            error_msg = f"Error in search with details: {str(e)}"
            logfire.error(error_msg, exc_info=True)
            return error_msg

# ================================================== API ================================================== 

class ChatMessage(BaseModel):
    """Input model for chat requests"""
    image_base64: Optional[str] = None
    message: Optional[str] = None

@app.post("/chat")
async def chat_with_assistant(body: ChatMessage):
    """
    Stream processing updates to the frontend in real-time
    
    Flow:
    - If image provided: Extract ingredients → Format → Search recipes → Get details
    - If no image: Respond to user message directly
    
    Returns: StreamingResponse with JSON lines
    """
    async def generate():
        try:
            async with AsyncClient() as client:
                deps = Deps(
                    client=client,
                    spoonacular_api_key=os.getenv("SPOONACULAR_API_KEY"),
                    image_base64=body.image_base64  # Store image in deps
                )
                
                # Check if image is provided
                if body.image_base64:
                    # Log that we're starting the process
                    logfire.info("Starting recipe assistant workflow with image")
                    
                    # Track completion state for each step
                    step_states = {
                        "Extract Ingredients": {"completed": False, "data": None},
                        "Format Ingredients": {"completed": False, "data": None},
                        "Search Recipes": {"completed": False, "data": None},
                        "Get Recipe Details": {"completed": False, "data": None}
                    }
                    
                    try:
                        # Step 1: Extract ingredients
                        yield json.dumps({
                            "type": "step_update",
                            "step": {
                                "step_name": "Extract Ingredients",
                                "status": "in_progress",
                                "message": "Analyzing fridge contents..."
                            }
                        }) + "\n"
                        
                        # Run extraction
                        extraction_result = await main_agent.run(
                            "Use the analyze_fridge_contents tool to analyze the fridge image and extract all visible ingredients. The image is already in the context, so call the tool without any parameters.",
                            deps=deps
                        )
                        
                        # Check if ingredients were extracted
                        if deps.last_extracted_ingredients and deps.last_extracted_ingredients.ingredients:
                            ingredients = deps.last_extracted_ingredients.ingredients
                            step_states["Extract Ingredients"]["completed"] = True
                            step_states["Extract Ingredients"]["data"] = ingredients
                            
                            yield json.dumps({
                                "type": "step_complete",
                                "step": {
                                    "step_name": "Extract Ingredients",
                                    "status": "completed",
                                    "message": f"Found {len(ingredients)} ingredients"
                                },
                                "data": {
                                    "ingredients": ingredients
                                }
                            }) + "\n"
                            
                            # Step 2: Format ingredients
                            yield json.dumps({
                                "type": "step_update",
                                "step": {
                                    "step_name": "Format Ingredients",
                                    "status": "in_progress",
                                    "message": "Formatting ingredients for recipe search..."
                                }
                            }) + "\n"
                            
                            # Run formatting
                            format_result = await main_agent.run(
                                "Format the extracted ingredients for recipe search using format_ingredients_for_recipes tool.",
                                deps=deps
                            )
                            
                            if deps.last_formatted_params and deps.last_formatted_params.ingredients:
                                formatted = deps.last_formatted_params.ingredients
                                step_states["Format Ingredients"]["completed"] = True
                                step_states["Format Ingredients"]["data"] = formatted
                                
                                yield json.dumps({
                                    "type": "step_complete",
                                    "step": {
                                        "step_name": "Format Ingredients",
                                        "status": "completed",
                                        "message": "Ingredients formatted successfully"
                                    },
                                    "data": {
                                        "formatted": formatted
                                    }
                                }) + "\n"
                                
                                # Step 3: Search recipes
                                yield json.dumps({
                                    "type": "step_update",
                                    "step": {
                                        "step_name": "Search Recipes",
                                        "status": "in_progress",
                                        "message": "Searching for recipes..."
                                    }
                                }) + "\n"
                                
                                # Search for recipes with user preferences if provided
                                search_prompt = "Search for recipes using search_recipes_by_ingredients tool with number=15."
                                if body.message and any(word in body.message.lower() for word in ['healthy', 'quick', 'easy', 'vegetarian', 'vegan']):
                                    search_prompt += f" User preference: {body.message}"
                                
                                search_result = await main_agent.run(search_prompt, deps=deps)
                                
                                if deps.last_recipes:
                                    recipes_count = len(deps.last_recipes)
                                    step_states["Search Recipes"]["completed"] = True
                                    step_states["Search Recipes"]["data"] = recipes_count
                                    
                                    yield json.dumps({
                                        "type": "step_complete",
                                        "step": {
                                            "step_name": "Search Recipes",
                                            "status": "completed",
                                            "message": f"Found {recipes_count} recipes"
                                        },
                                        "data": {
                                            "recipe_count": recipes_count,
                                            "recipe_previews": [
                                                {
                                                    "id": r['id'],
                                                    "title": r['title'],
                                                    "usedIngredientCount": r.get('usedIngredientCount', 0),
                                                    "missedIngredientCount": r.get('missedIngredientCount', 0)
                                                } for r in deps.last_recipes[:5]  # Preview first 5
                                            ]
                                        }
                                    }) + "\n"
                                    
                                    # Step 4: Get details
                                    yield json.dumps({
                                        "type": "step_update",
                                        "step": {
                                            "step_name": "Get Recipe Details",
                                            "status": "in_progress",
                                            "message": f"Fetching detailed information for {recipes_count} recipes..."
                                        }
                                    }) + "\n"
                                    
                                    # Get recipe details
                                    details_result = await main_agent.run(
                                        "Get detailed information for all recipes using get_all_recipe_details tool.",
                                        deps=deps
                                    )
                                    
                                    # Process and send final results
                                    recipes_data = []
                                    if deps.all_recipe_details:
                                        details_count = len(deps.all_recipe_details)
                                        step_states["Get Recipe Details"]["completed"] = True
                                        step_states["Get Recipe Details"]["data"] = details_count
                                        
                                        yield json.dumps({
                                            "type": "step_complete",
                                            "step": {
                                                "step_name": "Get Recipe Details",
                                                "status": "completed",
                                                "message": f"Retrieved details for {details_count} recipes"
                                            },
                                            "data": {
                                                "details_count": details_count
                                            }
                                        }) + "\n"
                                        
                                        for recipe in deps.all_recipe_details:
                                            # Create recipe dict following RecipeDetails model structure
                                            recipe_dict = {
                                                "id": recipe.id,
                                                "title": recipe.title,
                                                "readyInMinutes": recipe.readyInMinutes,
                                                "image": recipe.image,
                                                "summary": recipe.summary,
                                                "preparationMinutes": recipe.preparationMinutes,
                                                "cookingMinutes": recipe.cookingMinutes,
                                                "nutrition": {
                                                    "calories": recipe.nutrition.calories if recipe.nutrition else None,
                                                    "protein": recipe.nutrition.protein if recipe.nutrition else None,
                                                    "carbohydrates": recipe.nutrition.carbohydrates if recipe.nutrition else None,
                                                    "fat": recipe.nutrition.fat if recipe.nutrition else None
                                                } if recipe.nutrition else None,
                                                "ingredients": [
                                                    {
                                                        "name": ing.name,
                                                        "amount": ing.amount,
                                                        "unit": ing.unit
                                                    } for ing in recipe.ingredients
                                                ],
                                                "analyzedInstructions": [
                                                    {
                                                        "number": step.number,
                                                        "step": step.step,
                                                        "length": step.length
                                                    } for step in recipe.analyzedInstructions
                                                ]
                                            }
                                            
                                            # Add match information from original search results
                                            for original_recipe in deps.last_recipes:
                                                if original_recipe['id'] == recipe.id:
                                                    recipe_dict['usedIngredientCount'] = original_recipe.get('usedIngredientCount', 0)
                                                    recipe_dict['missedIngredientCount'] = original_recipe.get('missedIngredientCount', 0)
                                                    recipe_dict['usedIngredients'] = [ing['name'] for ing in original_recipe.get('usedIngredients', [])]
                                                    recipe_dict['missedIngredients'] = [ing['name'] for ing in original_recipe.get('missedIngredients', [])]
                                                    break
                                            
                                            recipes_data.append(recipe_dict)
                                    
                                    # Send final complete message with all data
                                    final_message = "I found some great recipes based on what's in your fridge!"
                                    if len(recipes_data) > 0:
                                        final_message = f"I found {len(recipes_data)} delicious recipes you can make with your ingredients! Swipe through the recipes below to find something you'd like to cook."
                                    
                                    yield json.dumps({
                                        "type": "complete",
                                        "message": final_message,
                                        "summary": {
                                            "total_ingredients": len(ingredients),
                                            "total_recipes": len(recipes_data),
                                            "recipes": recipes_data
                                        },
                                        "step_summary": step_states  # Include step completion summary
                                    }) + "\n"
                                    
                                else:
                                    # No recipes found
                                    yield json.dumps({
                                        "type": "error",
                                        "step": {
                                            "step_name": "Search Recipes",
                                            "status": "error",
                                            "message": "No recipes found with the available ingredients"
                                        },
                                        "step_summary": step_states
                                    }) + "\n"
                            else:
                                # Format failed
                                yield json.dumps({
                                    "type": "error",
                                    "step": {
                                        "step_name": "Format Ingredients",
                                        "status": "error",
                                        "message": "Failed to format ingredients for recipe search"
                                    },
                                    "step_summary": step_states
                                }) + "\n"
                        else:
                            # No ingredients extracted
                            yield json.dumps({
                                "type": "error",
                                "step": {
                                    "step_name": "Extract Ingredients",
                                    "status": "error",
                                    "message": "No ingredients could be extracted from the image. Please ensure the image shows the contents of a fridge clearly."
                                },
                                "step_summary": step_states
                            }) + "\n"
                            
                    except Exception as e:
                        logfire.error(f"Error in processing pipeline: {str(e)}", exc_info=True)
                        
                        # Determine which step failed based on the context
                        failed_step = "Processing"
                        for step_name, state in step_states.items():
                            if not state["completed"]:
                                failed_step = step_name
                                break
                        
                        yield json.dumps({
                            "type": "error",
                            "step": {
                                "step_name": failed_step,
                                "status": "error",
                                "message": f"Error during {failed_step.lower()}: {str(e)}"
                            },
                            "error": str(e),
                            "message": f"I encountered an error while processing your request: {str(e)}",
                            "step_summary": step_states
                        }) + "\n"
                
                else:
                    # No image provided - just respond to the message
                    if body.message:
                        # Run the agent with just the message
                        result = await main_agent.run(body.message, deps=deps)
                        
                        # Send response
                        yield json.dumps({
                            "type": "message",
                            "message": result.data if result and result.data else "I can help you find recipes! Please upload a photo of your fridge to get started."
                        }) + "\n"
                        
                    else:
                        # No image and no message
                        yield json.dumps({
                            "type": "message",
                            "message": "👋 Welcome! I can help you find recipes based on what's in your fridge. Upload a photo of your fridge or ask me any cooking questions!"
                        }) + "\n"
                        
        except Exception as e:
            logfire.error(f"Chat endpoint error: {str(e)}", exc_info=True)
            yield json.dumps({
                "type": "error",
                "error": str(e),
                "message": f"An unexpected error occurred: {str(e)}. Please try again."
            }) + "\n"
    
    return StreamingResponse(generate(), media_type="application/x-ndjson")

if __name__ == '__main__':
    uvicorn.run("main:app", reload=True, host="localhost", port=8000)