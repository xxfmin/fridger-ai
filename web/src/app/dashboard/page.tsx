"use client";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ChatBubble } from "@/components/chat/chat-bubble";
import { ImagePlus, Send, X } from "lucide-react";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        alert("Image too large. Please use an image under 10MB");
        return;
      }

      setSelectedImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.onerror = (error) => {
        console.error("Error reading file:", error);
        alert("Error reading file. Please try another image.");
      };
      reader.readAsDataURL(file);
    }
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove data:image/jpeg;base64, prefix
        const base64 = base64String.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => {
        reject(error);
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputMessage.trim() && !selectedImage) return;

    const userMessageId = Date.now().toString();
    const assistantMessageId = (Date.now() + 1).toString();

    // Add user message
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      message: inputMessage,
      imagePreview: imagePreview || undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsStreaming(true);

    // Add initial assistant message
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      isLoading: true,
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      // Prepare request body
      const body: any = {};
      if (inputMessage) body.message = inputMessage;
      if (selectedImage) {
        console.log("Converting image to base64...");
        body.image_base64 = await fileToBase64(selectedImage);
        console.log("Base64 length:", body.image_base64.length);
      }

      console.log("Sending request to backend...");
      console.log("Request body keys:", Object.keys(body));

      // Make streaming request
      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Response error text:", errorText);
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Process complete lines
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              try {
                console.log("Received update:", line);
                const update = JSON.parse(line);

                // Update assistant message with streaming data
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, streamingData: update, isLoading: false }
                      : msg
                  )
                );
              } catch (e) {
                console.error("Error parsing streaming response:", e);
                console.error("Failed to parse line:", line);
              }
            }
          }
        }

        // Process any remaining data in buffer
        if (buffer.trim()) {
          try {
            const update = JSON.parse(buffer);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, streamingData: update, isLoading: false }
                  : msg
              )
            );
          } catch (e) {
            console.error("Error parsing final buffer:", e);
          }
        }
      }
    } catch (error) {
      console.error("Error in handleSubmit:", error);

      // Get more detailed error info
      let errorMessage = "An error occurred";
      let errorDetails = "";

      if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = error.stack || "";
      }

      console.error("Error details:", {
        message: errorMessage,
        stack: errorDetails,
        type: error?.constructor?.name,
      });

      // Update assistant message with detailed error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                streamingData: {
                  type: "error",
                  error: errorMessage,
                  message: `Error: ${errorMessage}. Check console for details.`,
                },
                isLoading: false,
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
      setSelectedImage(null);
      setImagePreview("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Remove selected image
  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="container mx-auto max-w-4xl h-screen flex flex-col p-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Recipe Assistant</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Upload a photo of your fridge or ask me anything about cooking!
        </p>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.length === 0 && (
          <Card className="p-8 text-center text-gray-500">
            <p className="mb-2">
              👋 Welcome! I can help you find recipes based on what's in your
              fridge.
            </p>
            <p>
              Upload a photo of your fridge or ask me any cooking questions!
            </p>
          </Card>
        )}

        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            role={msg.role}
            message={msg.message}
            imagePreview={msg.imagePreview}
            streamingData={msg.streamingData}
            isLoading={msg.isLoading}
          />
        ))}

        <div ref={chatEndRef} />
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        {/* Image preview */}
        {imagePreview && (
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="Selected"
              className="h-20 rounded-lg border"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input row */}
        <div className="flex gap-2">
          <Input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
          >
            <ImagePlus className="w-5 h-5" />
          </Button>

          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type a message or upload a fridge photo..."
            disabled={isStreaming}
            className="flex-1"
          />

          <Button
            type="submit"
            disabled={isStreaming || (!inputMessage.trim() && !selectedImage)}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
