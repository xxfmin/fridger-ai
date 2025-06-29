interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  message?: string;
  imagePreview?: string;
  streamingData?: any;
  isLoading?: boolean;
}

// Track completed steps data
interface StepData {
  extractedIngredients?: string[];
  formattedIngredients?: string[];
  recipeCount?: number;
  detailsCount?: number; // Added this field
}

interface ChatBubbleProps {
  role: "user" | "assistant";

  // For user messages
  message?: string;
  imagePreview?: string; // base64 or URL for showing uploaded image

  // For assistant messages (streaming updates)
  streamingData?: {
    type: "step_update" | "step_complete" | "complete" | "message" | "error";

    // Step information
    step?: {
      step_name: string;
      status: "in_progress" | "completed" | "error";
      message: string;
    };

    // Step data
    data?: {
      ingredients?: string[];
      formatted?: string;
      recipe_count?: number;
      recipe_previews?: Array<{
        id: number;
        title: string;
        usedIngredientCount: number;
        missedIngredientCount: number;
      }>;
      details_count?: number;
    };

    // Final summary
    summary?: {
      total_ingredients: number;
      total_recipes: number;
      recipes: RecipeResponse[];
    };

    // Error or simple message
    error?: string;
    message?: string;
  };

  isLoading?: boolean;
}
