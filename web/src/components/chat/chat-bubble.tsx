"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RecipeCard } from "./recipe-card";
import { Carousel } from "./carousel";
import {
  Check,
  Clock,
  AlertCircle,
  ShoppingCart,
  Filter,
  Search,
  Book,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Define the steps in order
const RECIPE_STEPS = [
  "Extract Ingredients",
  "Format Ingredients",
  "Search Recipes",
  "Get Recipe Details",
] as const;

type StepName = (typeof RECIPE_STEPS)[number];

interface StepStatus {
  status: "pending" | "in_progress" | "completed" | "error";
  message?: string;
}

interface StepData {
  extractedIngredients?: string[];
  formattedIngredients?: string[];
  recipeCount?: number;
  detailsCount?: number;
}

interface ChatBubbleProps {
  role: "user" | "assistant";
  message?: string;
  imagePreview?: string;
  streamingData?: any;
  isLoading?: boolean;
}

export function ChatBubble({
  role,
  message,
  imagePreview,
  streamingData,
  isLoading,
}: ChatBubbleProps) {
  // Track step data for display
  const [stepData, setStepData] = useState<StepData>({});
  const [stepStatuses, setStepStatuses] = useState<
    Record<StepName, StepStatus>
  >({
    "Extract Ingredients": { status: "pending" },
    "Format Ingredients": { status: "pending" },
    "Search Recipes": { status: "pending" },
    "Get Recipe Details": { status: "pending" },
  });
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [hasStartedProcessing, setHasStartedProcessing] = useState(false);
  const [isProcessingComplete, setIsProcessingComplete] = useState(false);
  const [finalMessage, setFinalMessage] = useState<string>("");
  const [finalRecipes, setFinalRecipes] = useState<any[]>([]);

  // Update step data when streaming data changes
  useEffect(() => {
    if (!streamingData) return;

    // Debug logging
    console.log("Received streaming data:", {
      type: streamingData.type,
      step: streamingData.step,
      data: streamingData.data,
      summary: streamingData.summary,
      timestamp: new Date().toISOString(),
    });

    // Handle different message types
    switch (streamingData.type) {
      case "step_update":
      case "step_complete": {
        if (!streamingData.step) return;

        const currentStep = streamingData.step;
        const stepName = currentStep.step_name as StepName;

        if (!RECIPE_STEPS.includes(stepName)) {
          console.warn(`Unknown step name: ${stepName}`);
          return;
        }

        // Mark that we've started processing
        if (!hasStartedProcessing) {
          setHasStartedProcessing(true);
        }

        // Update step status
        setStepStatuses((prev) => ({
          ...prev,
          [stepName]: {
            status: currentStep.status,
            message: currentStep.message,
          },
        }));

        // Update step data for completed steps
        if (streamingData.type === "step_complete" && streamingData.data) {
          switch (stepName) {
            case "Extract Ingredients":
              if (streamingData.data.ingredients) {
                setStepData((prev) => ({
                  ...prev,
                  extractedIngredients: streamingData.data.ingredients,
                }));
                setOpenItems((prev) => [...new Set([...prev, "extract"])]);
              }
              break;

            case "Format Ingredients":
              if (streamingData.data.formatted) {
                const formatted = streamingData.data.formatted
                  .split(",")
                  .map((s: string) => s.trim());
                setStepData((prev) => ({
                  ...prev,
                  formattedIngredients: formatted,
                }));
                setOpenItems((prev) => [...new Set([...prev, "format"])]);
              }
              break;

            case "Search Recipes":
              if (streamingData.data.recipe_count !== undefined) {
                setStepData((prev) => ({
                  ...prev,
                  recipeCount: streamingData.data.recipe_count,
                }));
                setOpenItems((prev) => [...new Set([...prev, "search"])]);
              }
              break;

            case "Get Recipe Details":
              if (streamingData.data.details_count !== undefined) {
                setStepData((prev) => ({
                  ...prev,
                  detailsCount: streamingData.data.details_count,
                }));
                setOpenItems((prev) => [...new Set([...prev, "details"])]);
              }
              break;
          }
        }
        break;
      }

      case "complete": {
        console.log("Processing complete message");

        // Mark processing as complete
        setIsProcessingComplete(true);

        // Set final message
        if (streamingData.message) {
          setFinalMessage(streamingData.message);
        }

        // Set recipes
        if (streamingData.summary?.recipes) {
          setFinalRecipes(streamingData.summary.recipes);
          console.log(
            `Setting ${streamingData.summary.recipes.length} recipes`
          );
        }

        // Ensure all completed steps show as completed using step_summary if available
        if (streamingData.step_summary) {
          Object.entries(streamingData.step_summary).forEach(
            ([stepName, state]: [string, any]) => {
              if (
                state.completed &&
                RECIPE_STEPS.includes(stepName as StepName)
              ) {
                setStepStatuses((prev) => ({
                  ...prev,
                  [stepName as StepName]: {
                    status: "completed",
                    message:
                      prev[stepName as StepName]?.message ||
                      `${stepName} completed`,
                  },
                }));

                // Also ensure we have the step data
                if (state.data) {
                  switch (stepName) {
                    case "Extract Ingredients":
                      if (Array.isArray(state.data)) {
                        setStepData((prev) => ({
                          ...prev,
                          extractedIngredients: state.data,
                        }));
                      }
                      break;
                    case "Format Ingredients":
                      if (typeof state.data === "string") {
                        setStepData((prev) => ({
                          ...prev,
                          formattedIngredients: state.data
                            .split(",")
                            .map((s: string) => s.trim()),
                        }));
                      }
                      break;
                    case "Search Recipes":
                      if (typeof state.data === "number") {
                        setStepData((prev) => ({
                          ...prev,
                          recipeCount: state.data,
                        }));
                      }
                      break;
                    case "Get Recipe Details":
                      if (typeof state.data === "number") {
                        setStepData((prev) => ({
                          ...prev,
                          detailsCount: state.data,
                        }));
                      }
                      break;
                  }
                }
              }
            }
          );
        }

        // Open first 3 accordions
        setOpenItems(["extract", "format", "search"]);
        break;
      }

      case "error": {
        console.error("Received error:", streamingData);

        if (streamingData.step) {
          const stepName = streamingData.step.step_name as StepName;
          if (RECIPE_STEPS.includes(stepName)) {
            setStepStatuses((prev) => ({
              ...prev,
              [stepName]: {
                status: "error",
                message: streamingData.step.message || "An error occurred",
              },
            }));
          }

          // Mark that we've started processing if we haven't already
          if (!hasStartedProcessing) {
            setHasStartedProcessing(true);
          }
        }

        // If we have step summary from error, update states accordingly
        if (streamingData.step_summary) {
          Object.entries(streamingData.step_summary).forEach(
            ([stepName, state]: [string, any]) => {
              if (RECIPE_STEPS.includes(stepName as StepName)) {
                const typedStepName = stepName as StepName;
                if (state.completed) {
                  setStepStatuses((prev) => ({
                    ...prev,
                    [typedStepName]: {
                      status: "completed",
                      message:
                        prev[typedStepName]?.message || `${stepName} completed`,
                    },
                  }));
                }
              }
            }
          );
        }
        break;
      }

      case "message": {
        // Simple message response - no processing involved
        break;
      }
    }
  }, [streamingData, hasStartedProcessing]);

  // Helper to get step icon
  const getStepIcon = (stepName: string, isActive: boolean = false) => {
    const className = `w-4 h-4 ${isActive ? "text-blue-600" : ""}`;
    switch (stepName) {
      case "Extract Ingredients":
        return <ShoppingCart className={className} />;
      case "Format Ingredients":
        return <Filter className={className} />;
      case "Search Recipes":
        return <Search className={className} />;
      case "Get Recipe Details":
        return <Book className={className} />;
      default:
        return <Clock className={className} />;
    }
  };

  // Helper to get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <Check className="w-4 h-4 text-green-600" />;
      case "in_progress":
        return <Clock className="w-4 h-4 text-blue-600 animate-pulse" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  // Format message with bold text support
  const formatMessage = (text: string) => {
    return text.split("\n").map((line, idx) => {
      const formattedLine = line.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
      );
      return (
        <p
          key={idx}
          className="mb-2 last:mb-0"
          dangerouslySetInnerHTML={{ __html: formattedLine }}
        />
      );
    });
  };

  // Check if we should show the accordion (any step has started or processing is complete)
  const shouldShowAccordion = hasStartedProcessing || isProcessingComplete;

  // Helper to determine if a step should be shown
  const shouldShowStep = (stepName: StepName): boolean => {
    if (!hasStartedProcessing && !isProcessingComplete) return false;

    // Don't show "Get Recipe Details" step in the final display
    if (stepName === "Get Recipe Details" && isProcessingComplete) return false;

    // If processing is complete, show the first 3 steps
    if (isProcessingComplete) {
      return [
        "Extract Ingredients",
        "Format Ingredients",
        "Search Recipes",
      ].includes(stepName);
    }

    // Otherwise, show all steps up to and including the current active step
    const stepIndex = RECIPE_STEPS.indexOf(stepName);
    const currentStepIndex = RECIPE_STEPS.findIndex(
      (step) => stepStatuses[step]?.status === "in_progress"
    );
    const lastCompletedIndex = RECIPE_STEPS.reduce((maxIndex, step, index) => {
      return stepStatuses[step]?.status === "completed" ? index : maxIndex;
    }, -1);

    const maxIndex = Math.max(currentStepIndex, lastCompletedIndex);
    return (
      stepIndex <= maxIndex || stepStatuses[stepName]?.status !== "pending"
    );
  };

  // Create carousel for final recipes
  const recipeCards = finalRecipes.map((recipe, index) => (
    <RecipeCard key={recipe.id} recipe={recipe} index={index} />
  ));

  return (
    <div>
      <Card className={`mb-2 ${role === "user" ? "bg-gray-200/75" : ""}`}>
        <CardHeader>
          <CardTitle className="text-small font-semibold">
            {role === "user" ? "You" : "Recipe Assistant"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Loading state */}
          {isLoading && !streamingData && (
            <div className="flex gap-1">
              <span className="animate-bounce">●</span>
              <span className="animate-bounce delay-100">●</span>
              <span className="animate-bounce delay-200">●</span>
            </div>
          )}

          {/* User message */}
          {role === "user" && message && (
            <div className="prose prose-sm max-w-none">
              {formatMessage(message)}
            </div>
          )}

          {/* User image */}
          {role === "user" && imagePreview && (
            <div className="mt-2">
              <img
                src={imagePreview}
                alt="Uploaded fridge"
                className="rounded-lg max-h-48 object-cover"
              />
            </div>
          )}

          {/* Assistant response */}
          {role === "assistant" && streamingData && (
            <>
              {/* Simple message (no processing) */}
              {streamingData.type === "message" && (
                <div className="prose prose-sm max-w-none">
                  {formatMessage(streamingData.message || "")}
                </div>
              )}

              {/* Error without processing */}
              {streamingData.type === "error" && !hasStartedProcessing && (
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div className="prose prose-sm max-w-none">
                    <p className="text-red-600">
                      {streamingData.message ||
                        streamingData.error ||
                        "An error occurred"}
                    </p>
                  </div>
                </div>
              )}

              {/* Step progress accordion - show during processing and after completion */}
              {shouldShowAccordion && (
                <Accordion
                  type="multiple"
                  value={openItems}
                  onValueChange={setOpenItems}
                  className="w-full"
                >
                  {/* Extract Ingredients Step */}
                  {shouldShowStep("Extract Ingredients") && (
                    <AccordionItem value="extract" className="border-b">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 w-full">
                          <div className="flex items-center gap-2">
                            {getStepIcon("Extract Ingredients")}
                            <span className="font-medium">
                              Extract Ingredients
                            </span>
                          </div>
                          <div className="flex items-center gap-2 ml-auto mr-2">
                            <span className="text-sm text-gray-600">
                              {(() => {
                                const status =
                                  stepStatuses["Extract Ingredients"]?.status;
                                if (status === "in_progress") {
                                  return (
                                    stepStatuses["Extract Ingredients"]
                                      ?.message ||
                                    "Analyzing fridge contents..."
                                  );
                                } else if (status === "completed") {
                                  if (stepData.extractedIngredients) {
                                    return `${stepData.extractedIngredients.length} ingredients found`;
                                  } else {
                                    return (
                                      stepStatuses["Extract Ingredients"]
                                        ?.message || "Completed"
                                    );
                                  }
                                } else if (status === "error") {
                                  return "Error extracting ingredients";
                                } else {
                                  return "Pending";
                                }
                              })()}
                            </span>
                            {getStatusIcon(
                              stepStatuses["Extract Ingredients"]?.status ||
                                "pending"
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        {stepData.extractedIngredients ? (
                          <div className="flex flex-wrap gap-1.5 pt-2">
                            {stepData.extractedIngredients.map(
                              (ingredient, idx) => (
                                <Badge
                                  key={idx}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {ingredient}
                                </Badge>
                              )
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600 pt-2">
                            {stepStatuses["Extract Ingredients"]?.status ===
                            "in_progress"
                              ? "Analyzing your fridge image..."
                              : stepStatuses["Extract Ingredients"]?.status ===
                                "completed"
                              ? "Ingredients extracted successfully"
                              : stepStatuses["Extract Ingredients"]?.status ===
                                "error"
                              ? stepStatuses["Extract Ingredients"]?.message ||
                                "Failed to extract ingredients"
                              : "Waiting to start..."}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Format Ingredients Step */}
                  {shouldShowStep("Format Ingredients") && (
                    <AccordionItem value="format" className="border-b">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 w-full">
                          <div className="flex items-center gap-2">
                            {getStepIcon("Format Ingredients")}
                            <span className="font-medium">
                              Format Ingredients
                            </span>
                          </div>
                          <div className="flex items-center gap-2 ml-auto mr-2">
                            <span className="text-sm text-gray-600">
                              {(() => {
                                const status =
                                  stepStatuses["Format Ingredients"]?.status;
                                if (status === "in_progress") {
                                  return (
                                    stepStatuses["Format Ingredients"]
                                      ?.message ||
                                    "Formatting ingredients for recipe search..."
                                  );
                                } else if (status === "completed") {
                                  if (
                                    stepData.formattedIngredients &&
                                    stepData.extractedIngredients
                                  ) {
                                    return `Used ${stepData.formattedIngredients.length} of ${stepData.extractedIngredients.length} ingredients`;
                                  } else {
                                    return (
                                      stepStatuses["Format Ingredients"]
                                        ?.message || "Completed"
                                    );
                                  }
                                } else if (status === "error") {
                                  return "Error formatting ingredients";
                                } else {
                                  return "Pending";
                                }
                              })()}
                            </span>
                            {getStatusIcon(
                              stepStatuses["Format Ingredients"]?.status ||
                                "pending"
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        {stepData.formattedIngredients ? (
                          <div className="flex flex-wrap gap-1.5 pt-2">
                            {stepData.formattedIngredients.map(
                              (ingredient, idx) => (
                                <Badge
                                  key={idx}
                                  variant="default"
                                  className="text-xs"
                                >
                                  {ingredient}
                                </Badge>
                              )
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600 pt-2">
                            {stepStatuses["Format Ingredients"]?.status ===
                            "in_progress"
                              ? "Selecting key cooking ingredients..."
                              : stepStatuses["Format Ingredients"]?.status ===
                                "completed"
                              ? "Ingredients formatted successfully"
                              : stepStatuses["Format Ingredients"]?.status ===
                                "error"
                              ? stepStatuses["Format Ingredients"]?.message ||
                                "Failed to format ingredients"
                              : "Waiting for ingredient extraction..."}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Search Recipes Step */}
                  {shouldShowStep("Search Recipes") && (
                    <AccordionItem value="search" className="border-b-0">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 w-full">
                          <div className="flex items-center gap-2">
                            {getStepIcon("Search Recipes")}
                            <span className="font-medium">Search Recipes</span>
                          </div>
                          <div className="flex items-center gap-2 ml-auto mr-2">
                            <span className="text-sm text-gray-600">
                              {(() => {
                                const status =
                                  stepStatuses["Search Recipes"]?.status;
                                if (status === "in_progress") {
                                  return (
                                    stepStatuses["Search Recipes"]?.message ||
                                    "Searching for recipes..."
                                  );
                                } else if (status === "completed") {
                                  if (stepData.recipeCount !== undefined) {
                                    return `Found ${stepData.recipeCount} recipes`;
                                  } else {
                                    return (
                                      stepStatuses["Search Recipes"]?.message ||
                                      "Completed"
                                    );
                                  }
                                } else if (status === "error") {
                                  return "Error searching recipes";
                                } else {
                                  return "Pending";
                                }
                              })()}
                            </span>
                            {getStatusIcon(
                              stepStatuses["Search Recipes"]?.status ||
                                "pending"
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="text-sm text-gray-600 pt-2">
                          {(() => {
                            const status =
                              stepStatuses["Search Recipes"]?.status;
                            if (status === "in_progress") {
                              return "Searching for recipes that match your ingredients...";
                            } else if (status === "completed") {
                              return stepData.recipeCount !== undefined
                                ? `Successfully found ${stepData.recipeCount} recipes matching your ingredients.`
                                : stepStatuses["Search Recipes"]?.message ||
                                    "Recipe search completed successfully.";
                            } else if (status === "error") {
                              return (
                                stepStatuses["Search Recipes"]?.message ||
                                "Failed to search for recipes."
                              );
                            } else {
                              return "Waiting for formatted ingredients...";
                            }
                          })()}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Get Recipe Details Step - only show during processing, not in final state */}
                  {shouldShowStep("Get Recipe Details") &&
                    !isProcessingComplete && (
                      <AccordionItem value="details" className="border-b-0">
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3 w-full">
                            <div className="flex items-center gap-2">
                              {getStepIcon("Get Recipe Details")}
                              <span className="font-medium">
                                Get Recipe Details
                              </span>
                            </div>
                            <div className="flex items-center gap-2 ml-auto mr-2">
                              <span className="text-sm text-gray-600">
                                {(() => {
                                  const status =
                                    stepStatuses["Get Recipe Details"]?.status;
                                  if (status === "in_progress") {
                                    return (
                                      stepStatuses["Get Recipe Details"]
                                        ?.message ||
                                      "Fetching detailed information..."
                                    );
                                  } else if (status === "completed") {
                                    if (stepData.detailsCount !== undefined) {
                                      return `Retrieved details for ${stepData.detailsCount} recipes`;
                                    } else {
                                      return (
                                        stepStatuses["Get Recipe Details"]
                                          ?.message || "Completed"
                                      );
                                    }
                                  } else if (status === "error") {
                                    return "Error getting details";
                                  } else {
                                    return "Pending";
                                  }
                                })()}
                              </span>
                              {getStatusIcon(
                                stepStatuses["Get Recipe Details"]?.status ||
                                  "pending"
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="text-sm text-gray-600 pt-2">
                            {(() => {
                              const status =
                                stepStatuses["Get Recipe Details"]?.status;
                              if (status === "in_progress") {
                                return "Fetching nutritional information, ingredients, and cooking instructions...";
                              } else if (status === "completed") {
                                return stepData.detailsCount !== undefined
                                  ? `Successfully retrieved complete details for ${stepData.detailsCount} recipes.`
                                  : stepStatuses["Get Recipe Details"]
                                      ?.message ||
                                      "Details retrieved successfully.";
                              } else if (status === "error") {
                                return (
                                  stepStatuses["Get Recipe Details"]?.message ||
                                  "Failed to get recipe details."
                                );
                              } else {
                                return "Waiting for recipe search results...";
                              }
                            })()}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}
                </Accordion>
              )}

              {/* Final message when complete */}
              {isProcessingComplete && finalMessage && (
                <div className="mt-6">
                  <div className="prose prose-sm max-w-none">
                    {formatMessage(finalMessage)}
                  </div>
                </div>
              )}

              {/* Recipe carousel - show after complete */}
              {isProcessingComplete && recipeCards.length > 0 && (
                <div className="mt-4">
                  <Carousel items={recipeCards} />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
