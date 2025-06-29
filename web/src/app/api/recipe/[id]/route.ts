import { authOptions } from "@/lib/auth";
import { recipeService } from "@/services/recipe-service";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: {
    id: string;
  };
}

// get a specific recipe
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // authenticate
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const recipe = await recipeService.getRecipeById(
      session.user.id,
      params.id
    );

    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    return NextResponse.json({ recipe }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching recipe:", error);
    return NextResponse.json(
      { error: "Failed to fetch recipe" },
      { status: 500 }
    );
  }
}

// delete a specific recipe
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // authenticate
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    await recipeService.deleteRecipe(session.user.id, params.id);

    return NextResponse.json(
      { message: "Recipe deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting recipe:", error);

    if (error.message === "Recipe not found") {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to delete recipe" },
      { status: 500 }
    );
  }
}