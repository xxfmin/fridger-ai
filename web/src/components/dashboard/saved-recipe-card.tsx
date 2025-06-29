"use client";
import React, { useEffect, useRef, useState } from "react";
import { IconX, IconCalendar } from "@tabler/icons-react";
import { Clock, Users, Flame, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { ImageProps } from "next/image";

// hook for outside click detection
export const useOutsideClick = <T extends HTMLElement = HTMLElement>(
  ref: React.RefObject<T | null>,
  callback: () => void
) => {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      callback();
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);

    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, callback]);
};

interface SavedRecipeCardProps {
  recipe: SavedRecipe;
  onDelete?: (recipeId: string) => void;
}

export function SavedRecipeCard({ recipe, onDelete }: SavedRecipeCardProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
      }
    }

    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useOutsideClick(containerRef, () => handleClose());

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(recipe._id);
    } catch (error) {
      console.error("Error deleting recipe:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 h-screen overflow-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 h-full w-full bg-black/80 backdrop-blur-lg"
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              ref={containerRef}
              layoutId={`saved-card-${recipe._id}`}
              className="relative z-[60] mx-auto my-10 h-fit max-w-5xl rounded-3xl bg-white p-4 font-sans md:p-10 dark:bg-neutral-900"
            >
              <button
                className="sticky top-4 right-0 ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-black dark:bg-white cursor-pointer z-10"
                onClick={handleClose}
              >
                <IconX className="h-6 w-6 text-neutral-100 dark:text-neutral-900" />
              </button>
              <motion.p
                layoutId={`saved-title-${recipe._id}`}
                className="mt-4 text-2xl font-semibold text-neutral-700 md:text-5xl dark:text-white"
              >
                {recipe.title}
              </motion.p>
              <div className="py-10">
                <SavedRecipeContent recipe={recipe} onDelete={onDelete} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.div
        layoutId={`saved-card-${recipe._id}`}
        onClick={handleOpen}
        className="relative z-10 flex h-[400px] w-[300px] cursor-pointer flex-col overflow-hidden border rounded-2xl bg-white shadow-lg transition-all hover:shadow-xl md:h-[420px] md:w-[340px] dark:bg-neutral-900"
      >
        {/* image */}
        <div className="relative h-[180px] w-full overflow-hidden bg-gray-100 md:h-[200px]">
          <BlurImage
            src={recipe.image || "/api/placeholder/400/600"}
            alt={recipe.title}
            fill
            className="object-cover transition-transform duration-300 hover:scale-105"
          />

          {/* delete button overlay */}
          <div className="absolute top-3 right-3">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm transition-colors hover:bg-red-50 dark:bg-black/90 dark:hover:bg-red-900/20"
            >
              {isDeleting ? (
                <div className="animate-spin h-4 w-4 border-2 border-gray-600 border-t-transparent rounded-full" />
              ) : (
                <Trash2 className="h-4 w-4 text-gray-600 hover:text-red-500 dark:text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* content container */}
        <div className="flex flex-1 flex-col justify-between p-5">
          <div className="space-y-3">
            <motion.h3
              layoutId={`saved-title-${recipe._id}`}
              className="text-lg font-semibold text-gray-800 line-clamp-2 md:text-xl dark:text-white"
            >
              {recipe.title}
            </motion.h3>

            {/* recipe stats */}
            <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{recipe.readyInMinutes} min</span>
              </div>

              {recipe.nutrition?.calories && (
                <div className="flex items-center gap-1">
                  <Flame className="h-4 w-4" />
                  <span>{Math.round(recipe.nutrition.calories)} cal</span>
                </div>
              )}
            </div>

            {/* summary */}
            {recipe.summary && (
              <p className="text-sm text-gray-600 line-clamp-2 dark:text-gray-400">
                {recipe.summary.replace(/<[^>]*>/g, "")}
              </p>
            )}
          </div>

          {/* saved date */}
          <div className="flex items-center gap-2 pt-3 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-700">
            <IconCalendar className="h-3 w-3" />
            <span>Saved {formatDate(recipe.createdAt)}</span>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// content component for the modal
function SavedRecipeContent({
  recipe,
  onDelete,
}: {
  recipe: SavedRecipe;
  onDelete?: (recipeId: string) => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(recipe._id);
    } catch (error) {
      console.error("Error deleting recipe:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
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

      {/* save info */}
      <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
        <h3 className="mb-2 text-sm font-semibold text-blue-900 dark:text-blue-100">
          Recipe Saved
        </h3>
        <div className="text-sm text-blue-800 dark:text-blue-200">
          <p>Saved on {formatDate(recipe.createdAt)}</p>
        </div>
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
              __html: recipe.summary.replace(/<[^>]*>/g, ""),
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
                <span className="text-sm">
                  {ingredient.amount > 0 && (
                    <span className="font-medium">
                      {ingredient.amount} {ingredient.unit}
                    </span>
                  )}{" "}
                  {ingredient.name}
                </span>
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

      {/* Action button */}
      <div className="pt-4">
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className={cn(
            "w-full rounded-lg px-4 py-3 font-medium transition-colors cursor-pointer flex items-center justify-center gap-2",
            "bg-red-600 text-white hover:bg-red-700",
            isDeleting && "opacity-50 cursor-not-allowed"
          )}
        >
          {isDeleting ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              Removing...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4" />
              Remove from Saved
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export const BlurImage = ({
  height,
  width,
  src,
  className,
  alt,
  fill,
  blurDataURL,
  ...rest
}: ImageProps) => {
  const [isLoading, setLoading] = useState(true);

  return (
    <img
      className={cn(
        "h-full w-full transition duration-300",
        isLoading ? "blur-sm" : "blur-0",
        className
      )}
      onLoad={() => setLoading(false)}
      src={src as string}
      width={
        fill
          ? undefined
          : typeof width === "number"
          ? width
          : parseInt(width as string)
      }
      height={
        fill
          ? undefined
          : typeof height === "number"
          ? height
          : parseInt(height as string)
      }
      loading="lazy"
      decoding="async"
      alt={alt ? alt : "Background of a beautiful view"}
      style={
        fill
          ? {
              position: "absolute" as const,
              height: "100%",
              width: "100%",
              inset: 0,
              objectFit: "cover" as const,
            }
          : undefined
      }
    />
  );
};
