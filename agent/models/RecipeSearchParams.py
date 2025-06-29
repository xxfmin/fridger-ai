from pydantic import BaseModel, Field
from typing import List, Optional

# structure for recipe search parameters

# model for structured ingredient extraction from image
class ExtractedIngredients(BaseModel):
    ingredients: List[str] = Field(
        description="Comma-separated list of EVERY SINGLE item name found in the fridge (e.g., 'ketchup,milk,chicken')"
    )

# model for recipe search parameters
class RecipeSearchParams(BaseModel):
    ingredients: str = Field(
        ...,
        description="A comma-separated list of ingredients that the recipes should contain"
    )
    number: Optional[int] = Field(
        default=20,
        description="The maximal number of recipes to return (default = 5)"
    )
    ignorePantry: Optional[bool] = Field(
        default=True,
        description="Whether to ignore pantry ingredients such as water, salt, flour etc."
    )
    ranking: Optional[int] = Field(
        default=2,
        description="Whether to maximize used ingredients (1) or minimize missing ingredients (2) first"
    )