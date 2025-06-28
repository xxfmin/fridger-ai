'use client';

import React from 'react';
import Navbar from '@/components/navbar';   
import { AuroraBackground } from '@/components/aurora-background';

export default function SignInPage() {
  return (
    <AuroraBackground>
      <Navbar />

      <div className="flex items-center justify-center min-h-screen text-white">
        <div className=" backdrop-blur-lg p-8 rounded-lg shadow-lg w-full max-w-sm">
          <h2 className="text-3xl font-bold mb-6 text-center">Sign Up</h2>
          <form>
            <div className="mb-5">
              <label className="block mb-1 font-medium">Email or Username</label>
              <input
                type="text"
                className="w-full px-6 py-2 border border-white rounded-md bg-transparent text-white placeholder-white focus:outline-none focus:ring-2 focus:ring-white text-left"
                placeholder="you@example.com"
              />
            </div>
            <div className="mb-6">
              <label className="block mb-1 font-medium">Password</label>
              <input
                type="password"
                className="w-full px-6 py-2 border border-white rounded-md bg-transparent text-left text-white placeholder-white focus:outline-none focus:ring-2 focus:ring-white "
                
              />
            </div>
            <button
              type="submit"
              className="w-full bg-inherit border border-white text-white py-2 rounded-md hover:bg-white/20 transition"
            >
              Sign Up
            </button>
          </form>
        </div>
      </div>
    </AuroraBackground>
  );
}
