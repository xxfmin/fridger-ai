from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
import logfire  # Add this import at the top of your file if not already there

class NutritionInfo(BaseModel):
    calories: Optional[float] = None
    fat: Optional[float] = None
    carbohydrates: Optional[float] = None
    protein: Optional[float] = None

class Ingredient(BaseModel):
    name: str = ""
    amount: float = 0
    unit: str = ""

class InstructionStep(BaseModel):
    number: int = 0
    step: str = ""
    length: int = 0  # in minutes

# structure return recipes
class RecipeDetails(BaseModel):
    id: int
    title: str
    image: str = ""
    readyInMinutes: int = 0
    preparationMinutes: Optional[int] = None
    cookingMinutes: Optional[int] = None
    nutrition: Optional[NutritionInfo] = None
    ingredients: List[Ingredient] = Field(default_factory=list)
    summary: str = ""
    analyzedInstructions: List[InstructionStep] = Field(default_factory=list)
    
    # Add field mapping for extendedIngredients -> ingredients
    class Config:
        populate_by_name = True
        alias_generator = None
        
    @field_validator('ingredients', mode='before')
    def extract_ingredients(cls, v, info):
        # Check if we have extendedIngredients in the data
        data = info.data if hasattr(info, 'data') else {}
        
        # Use extendedIngredients if available and ingredients is not provided
        if not v and 'extendedIngredients' in data:
            v = data['extendedIngredients']
            logfire.info("Using extendedIngredients instead of ingredients")
        
        if v is None:
            return []
        
        # Log raw ingredients data
        logfire.info(f"Raw ingredients data (type: {type(v)})", 
                    count=len(v) if isinstance(v, list) else 0,
                    sample=v[:2] if isinstance(v, list) and len(v) > 0 else v)
        
        if isinstance(v, list):
            result = []
            for idx, ingredient in enumerate(v):
                if isinstance(ingredient, dict):
                    # Extract ingredient details - handle both extended and simple formats
                    name = (
                        ingredient.get('name') or 
                        ingredient.get('originalName') or 
                        ingredient.get('original') or 
                        ingredient.get('originalString') or
                        ingredient.get('nameClean') or
                        ''
                    )
                    
                    # Handle amount - could be direct or in measures
                    amount = ingredient.get('amount', 0)
                    unit = ingredient.get('unit', '')
                    
                    # Check for measures format (common in detailed responses)
                    if 'measures' in ingredient and isinstance(ingredient['measures'], dict):
                        # Prefer metric, fallback to us
                        measure_data = (
                            ingredient['measures'].get('metric') or 
                            ingredient['measures'].get('us') or 
                            {}
                        )
                        if isinstance(measure_data, dict):
                            amount = measure_data.get('amount', amount)
                            unit = measure_data.get('unitShort', measure_data.get('unitLong', unit))
                    
                    # Some endpoints use 'original' as the full string
                    if not name and 'original' in ingredient:
                        name = ingredient['original']
                    
                    if name:  # Only add if we have a name
                        result.append(Ingredient(
                            name=name,
                            amount=float(amount) if amount else 0,
                            unit=unit
                        ))
                        
                        if idx < 3:  # Log first 3 ingredients for debugging
                            logfire.info(f"Parsed ingredient {idx}", 
                                       name=name, amount=amount, unit=unit)
            
            logfire.info(f"Total ingredients parsed: {len(result)}")
            return result
        
        return []

    @field_validator('nutrition', mode='before')
    def extract_nutrients(cls, v):
        if v is None:
            return None
        
        # Log the raw nutrition data
        logfire.info("Raw nutrition data", nutrition_data=str(v)[:200])
        
        if isinstance(v, dict):
            # Direct nutrition values (some endpoints return this format)
            if all(key in v for key in ['calories', 'protein', 'fat', 'carbs']):
                return NutritionInfo(
                    calories=v.get('calories'),
                    protein=v.get('protein'),
                    fat=v.get('fat'),
                    carbohydrates=v.get('carbs')
                )
            
            # Nutrients array format (most common)
            if 'nutrients' in v:
                result = {}
                for nutrient in v.get('nutrients', []):
                    name = nutrient.get('name', '').lower()
                    amount = nutrient.get('amount', 0)
                    
                    if 'calorie' in name:
                        result['calories'] = amount
                    elif name == 'fat' or name == 'total fat':
                        result['fat'] = amount
                    elif 'carbohydrate' in name:
                        result['carbohydrates'] = amount
                    elif name == 'protein':
                        result['protein'] = amount
                
                logfire.info("Extracted nutrition", result=result)
                return NutritionInfo(**result)
            
            # Try direct mapping
            return NutritionInfo(
                calories=v.get('calories'),
                protein=v.get('protein'),
                fat=v.get('fat'),
                carbohydrates=v.get('carbohydrates') or v.get('carbs')
            )
        
        return None
    
    @field_validator('analyzedInstructions', mode='before')
    def extract_instructions(cls, v):
        if v is None:
            return []
        
        # Log raw instructions data
        logfire.info(f"Raw instructions data (type: {type(v)})", 
                    count=len(v) if isinstance(v, list) else 0)
        
        if isinstance(v, list):
            all_steps = []
            
            # Handle both flat steps array and nested format
            for item in v:
                if isinstance(item, dict):
                    # Standard format with name and steps
                    if 'steps' in item:
                        steps = item.get('steps', [])
                        instruction_name = item.get('name', '')
                        
                        logfire.info(f"Processing instruction set: {instruction_name}", 
                                   step_count=len(steps))
                        
                        for step in steps:
                            if isinstance(step, dict):
                                step_text = step.get('step', '')
                                step_number = step.get('number', len(all_steps) + 1)
                                
                                # Handle length/duration
                                length = 0
                                if 'length' in step:
                                    if isinstance(step['length'], dict):
                                        length = step['length'].get('number', 0)
                                    elif isinstance(step['length'], (int, float)):
                                        length = step['length']
                                
                                if step_text:  # Only add if we have actual step text
                                    all_steps.append(InstructionStep(
                                        number=step_number,
                                        step=step_text,
                                        length=int(length)
                                    ))
                    
                    # Direct step format (some endpoints return this)
                    elif 'step' in item:
                        all_steps.append(InstructionStep(
                            number=item.get('number', len(all_steps) + 1),
                            step=item.get('step', ''),
                            length=0
                        ))
            
            logfire.info(f"Total instruction steps parsed: {len(all_steps)}")
            
            # Log first 2 steps for debugging
            for i, step in enumerate(all_steps[:2]):
                logfire.info(f"Step {i+1}", number=step.number, 
                           text=step.step[:100] + "..." if len(step.step) > 100 else step.step)
            
            return all_steps
        
        return []
    
    # Override model construction to handle extendedIngredients
    @classmethod
    def model_validate(cls, obj: Any) -> 'RecipeDetails':
        if isinstance(obj, dict):
            # If extendedIngredients exists but ingredients doesn't, copy it
            if 'extendedIngredients' in obj and 'ingredients' not in obj:
                obj['ingredients'] = obj['extendedIngredients']
        return super().model_validate(obj)