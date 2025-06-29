import { connectDB } from "@/lib/db";
import Recipe from "@/models/recipe";

export class RecipeService {
  async saveRecipe(userId: string, recipeData: RecipeResponse) {
    await connectDB();

    // check if recipe already saved by this user
    const existingRecipe = await Recipe.findOne({
      userId,
      spoonacularId: recipeData.id,
    });

    if (existingRecipe) {
      throw new Error("Recipe already saved");
    }

    // create new saved recipe
    const savedRecipe = new Recipe({
      userId,
      spoonacularId: recipeData.id,
      title: recipeData.title,
      image: recipeData.image,
      readyInMinutes: recipeData.readyInMinutes,
      preparationMinutes: recipeData.preparationMinutes,
      cookingMinutes: recipeData.cookingMinutes,
      nutrition: recipeData.nutrition,
      ingredients: recipeData.ingredients,
      summary: recipeData.summary,
      analyzedInstructions: recipeData.analyzedInstructions,
    });

    return await savedRecipe.save();
  }

  async getUserRecipes(userId: string) {
    await connectDB();
    return await Recipe.find({ userId }).sort({ createdAt: -1 });
  }

  async deleteRecipe(userId: string, recipeId: string) {
    await connectDB();

    const result = await Recipe.deleteOne({ _id: recipeId, userId });
    if (result.deletedCount === 0) {
      throw new Error("Recipe not found");
    }

    return true;
  }

  async searchUserRecipes(userId: string, query: string) {
    await connectDB();

    return await Recipe.find({
      userId,
      $or: [
        { title: { $regex: query, $options: "i" } },
        { summary: { $regex: query, $options: "i" } },
        { "ingredients.name": { $regex: query, $options: "i" } },
      ],
    }).sort({ createdAt: -1 });
  }

  async getRecipeById(userId: string, recipeId: string) {
    await connectDB();
    return await Recipe.findOne({ _id: recipeId, userId });
  }
}

export const recipeService = new RecipeService();