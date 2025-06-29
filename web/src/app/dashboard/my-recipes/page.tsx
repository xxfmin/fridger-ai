"use client";
import { useState, useEffect } from "react";
import { SavedRecipeCard } from "@/components/dashboard/saved-recipe-card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function MyRecipesPage() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // load recipes on component mount
  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      const response = await fetch("/api/recipe", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        // Extract recipes from the response object
        if (data.recipes && Array.isArray(data.recipes)) {
          setRecipes(data.recipes);
        } else {
          console.error("API response does not contain recipes array:", data);
          setRecipes([]);
        }
      } else {
        console.error("Failed to load recipes:", response.status);
        setRecipes([]);
      }
    } catch (error) {
      console.error("Error loading recipes:", error);
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    try {
      const response = await fetch(`/api/recipe/${recipeId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        // remove the recipe from local state
        setRecipes((prev) => prev.filter((recipe) => recipe._id !== recipeId));
        console.log("Recipe deleted successfully!");
      } else {
        console.error("Failed to delete recipe:", response.status);
        throw new Error("Failed to delete recipe");
      }
    } catch (error) {
      console.error("Error deleting recipe:", error);
      throw error;
    }
  };

  // filter recipes based on search query
  const filteredRecipes = Array.isArray(recipes)
    ? recipes.filter(
        (recipe) =>
          recipe.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          recipe.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          recipe.ingredients?.some((ingredient) =>
            ingredient.name?.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : [];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your recipes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-neutral-950">
      {/* header */}
      <div className="flex-none border-b bg-white dark:bg-neutral-900 px-6 py-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              My Recipes
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your saved recipe collection ({filteredRecipes.length}{" "}
              {filteredRecipes.length === 1 ? "recipe" : "recipes"})
            </p>
          </div>

          {/* search */}
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search your recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700"
            />
          </div>
        </div>
      </div>

      {/* content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 sm:p-8 lg:p-10">
          {filteredRecipes.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center max-w-md mx-auto">
                {recipes.length === 0 ? (
                  <>
                    <div className="mb-4">
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      </svg>
                    </div>
                    <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No saved recipes yet
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Start chatting with the Recipe Agent to discover and save
                      delicious recipes!
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mb-4">
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No recipes found
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Try adjusting your search terms or browse all recipes
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-8 justify-center sm:justify-start">
              {filteredRecipes.map((recipe) => (
                <SavedRecipeCard
                  key={recipe._id}
                  recipe={recipe}
                  onDelete={handleDeleteRecipe}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
