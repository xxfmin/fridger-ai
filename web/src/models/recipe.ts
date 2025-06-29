import mongoose, { Schema, Document, Types, Model } from "mongoose";

const MacroSchema = new Schema(
    {
        calories: { type: Number },
        fat: { type: Number},
        carbs: { type: Number },
        protein: { type: Number },
    },
    { _id: false }
);

const IngredientSchema = new Schema(
    {
        name: { type: String, required: true},
        amount: { type: Number, required: true },
        unit: { type: String, default: ""},
    },
    { _id: false }
);

const InstructionsSchema = new Schema(
    {
        number: { type: Number, required: true },
        step: { type: String, required: true },
        length: { type: Number, default: 0 },
    },
    { _id: false }
);


export interface IRecipe extends Document {
    userId: Types.ObjectId;
    spoonacularId: number;
    title: string;
    image: string;
    readyInMinutes: number;
    preparationMinutes?: number;
    cookingMinutes?: number;
    nutrition: {
        calories?: number;
        fat?: number;
        carbs?: number;
        protein?: number;
    };
    ingredients: {
        name: string;
        amount: number;
        unit: string;
    }[];
    summary: string;
    analyzedInstructions: {
        number: number;
        step: string;
        length: number;
    }[];
}

const RecipeSchema = new Schema<IRecipe>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        spoonacularId: {
            type: Number,
            required: true,
            index: true,
        },
        title: { type: String, required: true },
        image: { type: String, default: "" },
        readyInMinutes: {type: Number, required: true },
        preparationMinutes: { type: Number },
        nutrition: { type: MacroSchema, default: {} },
        ingredients: [IngredientSchema],
        summary: { type: String, default: "" },
        analyzedInstructions: [InstructionsSchema],
    },
    { timestamps: true }
);

const Recipe: Model<IRecipe> =
    mongoose.models.Recipe || mongoose.model<IRecipe>("Recipe", RecipeSchema);

export default Recipe;