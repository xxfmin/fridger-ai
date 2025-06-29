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
      const response = await fetch(`/api/recipes/${recipeId}`, {
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
    <div className="flex flex-col h-full">
      {/* header */}
      <div className="flex-none border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Recipes</h1>
            <p className="text-sm text-muted-foreground">
              Your saved recipe collection ({filteredRecipes.length} recipes)
            </p>
          </div>

          {/* search */}
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search your recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* content */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredRecipes.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              {recipes.length === 0 ? (
                <>
                  <p className="text-lg text-gray-600 mb-2">
                    No saved recipes yet
                  </p>
                  <p className="text-sm text-gray-500">
                    Start chatting with the Recipe Agent to discover and save
                    recipes!
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg text-gray-600 mb-2">No recipes found</p>
                  <p className="text-sm text-gray-500">
                    Try adjusting your search terms
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
  );
}
