interface NutritionInfo {
  calories?: number;
  fat?: number;
  carbohydrates?: number;
  protein?: number;
}

interface Ingredient {
  name: string;
  amount: number;
  unit: string;
}

interface InstructionStep {
  number: number;
  step: string;
  length: number; // in minutes
}

interface RecipeResponse {
  id: number;
  title: string;
  image: string;
  readyInMinutes: number;
  preparationMinutes?: number;
  cookingMinutes?: number;
  nutrition: NutritionInfo;
  ingredients: Ingredient[];
  summary: string;
  analyzedInstructions: InstructionStep[];
}

interface SavedRecipe {
  _id: string;
  spoonacularId: number;
  title: string;
  image: string;
  readyInMinutes: number;
  preparationMinutes?: number;
  cookingMinutes?: number;
  nutrition: {
    calories?: number;
    fat?: number;
    carbohydrates?: number;
    protein?: number;
  };
  ingredients: Array<{
    name: string;
    amount: number;
    unit: string;
  }>;
  summary: string;
  analyzedInstructions: Array<{
    number: number;
    step: string;
    length: number;
  }>;
  createdAt: string;
  updatedAt: string;
}