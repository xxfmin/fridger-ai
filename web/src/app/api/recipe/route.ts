import { authOptions } from "@/lib/auth";
import { recipeService } from "@/services/recipe-service";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// get user's saved recipes
export async function GET(request: NextRequest) {
  try {
    // authenticate
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // get search params
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    let recipes;
    if (search) {
      recipes = await recipeService.searchUserRecipes(session.user.id, search);
    } else {
      recipes = await recipeService.getUserRecipes(session.user.id);
    }

    return NextResponse.json({ recipes }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching recipes: ", error);
    return NextResponse.json(
      { error: "Failed to fetch recipes" },
      { status: 500 }
    );
  }
}

// save a recipe
export async function POST(request: NextRequest) {
  try {
    // authenticate
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const recipeData = await request.json();

    // validate required fields
    if (!recipeData.id || !recipeData.title) {
      return NextResponse.json(
        { error: "Recipe ID and title are required" },
        { status: 400 }
      );
    }

    const savedRecipe = await recipeService.saveRecipe(
      session.user.id,
      recipeData
    );

    return NextResponse.json(
      {
        message: "Recipe saved successfully",
        recipe: savedRecipe,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.message === "Recipe already saved") {
      return NextResponse.json(
        { error: "Recipe already saved" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to save recipe" },
      { status: 500 }
    );
  }
}
