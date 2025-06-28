import React, { JSX, useContext, useState } from "react";
import { Card, CarouselContext } from "./carousel";
import { Clock, Users, Flame, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecipeCardProps {
  recipe: RecipeResponse;
  index: number;
}

export function RecipeCard({ recipe, index }: RecipeCardProps): JSX.Element {
  // format the recipe data for the carousel card component
  const cardData = {
    src: recipe.image || "/api/placeholder/400/600", // fallback image
    title: recipe.title,
    category: `${recipe.readyInMinutes} mins`,
    content: <RecipeCardContent recipe={recipe} />,
    recipeId: recipe.id,
    recipeData: recipe,
  };

  return <Card card={cardData} index={index} layout={true} />;
}

// helper function to format ingredient display
function formatIngredient(ingredient: Ingredient): string {
  const { name, amount, unit } = ingredient;

  if (amount > 0) {
    if (unit && unit.trim() !== "") {
      return `${amount} ${unit} ${name}`;
    } else {
      // handle cases where unit is empty or missing
      return `${amount} ${name}`;
    }
  } else {
    // handle cases where amount is 0 or missing
    return name;
  }
}

// content shown when card is expanded
function RecipeCardContent({
  recipe,
}: {
  recipe: RecipeResponse;
}): JSX.Element {
  const { savedRecipes, setSavedRecipes } = useContext(CarouselContext);
  const [isLoading, setIsLoading] = useState(false);

  const isSaved = savedRecipes.has(recipe.id);

  const handleSave = async () => {
    if (isSaved) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(recipe),
      });

      if (response.ok) {
        setSavedRecipes(recipe.id);
        console.log("Recipe saved successfully!");
      }
    } catch (error) {
      console.error("Error saving recipe: ", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* image */}
      {recipe.image && (
        <div className="relative h-64 w-full overflow-hidden rounded-xl">
          <img
            src={recipe.image}
            alt={recipe.title}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* stats */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span className="text-sm">{recipe.readyInMinutes} minutes total</span>
        </div>
        {recipe.preparationMinutes && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-500" />
            <span className="text-sm">
              {recipe.preparationMinutes} min prep
            </span>
          </div>
        )}
        {recipe.cookingMinutes && (
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-gray-500" />
            <span className="text-sm">{recipe.cookingMinutes} min cook</span>
          </div>
        )}
      </div>

      {/* nutrition */}
      {recipe.nutrition && (
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-neutral-800">
          <h3 className="mb-3 text-sm font-semibold">Nutrition per serving</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {recipe.nutrition.calories && (
              <div>
                <p className="text-2xl font-bold">
                  {Math.round(recipe.nutrition.calories)}
                </p>
                <p className="text-xs text-gray-500">Calories</p>
              </div>
            )}
            {recipe.nutrition.protein && (
              <div>
                <p className="text-2xl font-bold">
                  {Math.round(recipe.nutrition.protein)}g
                </p>
                <p className="text-xs text-gray-500">Protein</p>
              </div>
            )}
            {recipe.nutrition.carbohydrates && (
              <div>
                <p className="text-2xl font-bold">
                  {Math.round(recipe.nutrition.carbohydrates)}g
                </p>
                <p className="text-xs text-gray-500">Carbs</p>
              </div>
            )}
            {recipe.nutrition.fat && (
              <div>
                <p className="text-2xl font-bold">
                  {Math.round(recipe.nutrition.fat)}g
                </p>
                <p className="text-xs text-gray-500">Fat</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* summary */}
      {recipe.summary && (
        <div>
          <h3 className="mb-2 text-lg font-semibold">About this recipe</h3>
          <div
            className="prose prose-sm max-w-none text-gray-600 dark:text-gray-300"
            dangerouslySetInnerHTML={{
              __html: recipe.summary.replace(/<[^>]*>/g, ""), // Strip HTML tags
            }}
          />
        </div>
      )}

      {/* ingredients */}
      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold">Ingredients</h3>
          <ul className="space-y-2">
            {recipe.ingredients.map((ingredient, idx) => (
              <li key={idx} className="flex items-start">
                <span className="mr-2 text-gray-400">•</span>
                <span className="text-sm">{formatIngredient(ingredient)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* instructions */}
      {recipe.analyzedInstructions &&
        recipe.analyzedInstructions.length > 0 && (
          <div>
            <h3 className="mb-3 text-lg font-semibold">Instructions</h3>
            <ol className="space-y-3">
              {recipe.analyzedInstructions.map((step, idx) => (
                <li key={idx} className="flex">
                  <span className="mr-3 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                    {step.number}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm">{step.step}</p>
                    {step.length > 0 && (
                      <p className="mt-1 text-xs text-gray-500">
                        ~{step.length} minutes
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

      {/* save recipe button */}
      <div className="pt-4">
        <button
          onClick={handleSave}
          disabled={isSaved || isLoading}
          className={cn(
            "w-full rounded-lg px-4 py-3 font-medium transition-colors cursor-pointer flex items-center justify-center gap-2",
            isSaved
              ? "bg-green-600 text-white cursor-default"
              : "bg-primary text-white hover:bg-primary/90",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              Saving Recipe...
            </>
          ) : isSaved ? (
            <>
              <Check className="h-4 w-4" />
              Recipe Saved!
            </>
          ) : (
            "Save to My Recipes"
          )}
        </button>
      </div>
    </div>
  );
}
