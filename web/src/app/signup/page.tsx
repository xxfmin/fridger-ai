"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/navbar";
import { AuroraBackground } from "@/components/aurora-background";
import axios from "axios";

export default function SignUpPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("Username and password are required.");
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await axios.post("/api/auth/signup", {
        username: username.trim(),
        password,
      });
      // Optionally display a toast or success banner here:
      // console.log('Signed up:', data.message);
      router.push("/signin"); // send them to the sign-in page
    } catch (err: any) {
      console.error("Signup error", err);
      setError(
        err.response?.data?.message || "Failed to sign up. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuroraBackground>
      <Navbar />

      <div className="flex items-center justify-center min-h-screen text-white">
        <div className="backdrop-blur-lg p-8 rounded-lg shadow-lg w-full max-w-sm">
          <h2 className="text-3xl font-bold mb-6 text-center">Sign Up</h2>

          {error && <p className="text-red-500 mb-4">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block mb-1 font-medium">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                className="w-full px-6 py-2 border border-white rounded-md bg-transparent text-white placeholder-white focus:outline-none focus:ring-2 focus:ring-white"
                placeholder="Enter username"
                autoComplete="username"
                autoFocus
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full px-6 py-2 border border-white rounded-md bg-transparent text-white placeholder-white focus:outline-none focus:ring-2 focus:ring-white"
                placeholder="Enter password"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-2 font-semibold rounded-md transition ${
                isLoading
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-700 text-white"
              }`}
            >
              {isLoading ? "Signing Up…" : "Sign Up"}
            </button>
          </form>
        </div>
      </div>
    </AuroraBackground>
  );
}
