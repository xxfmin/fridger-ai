'use client';

import React from 'react';
import Navbar from '@/components/navbar';   
import Link from 'next/link';
import HeroSection from '@/components/landing';


export default function SignInPage() {
  return (
    <>
    <Navbar />
    <div className="flex items-center justify-center min-h-screen bg-white text-white">
      <div className="bg-white text-black p-8 rounded-lg shadow-lg w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-6 text-center">Sign In</h2>
        <form>
          <div className="mb-4">
            <label className="block mb-1 font-medium">Email or Username</label>
            <input
              type="text"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#0096FF]"
              placeholder="you@example.com"
            />
          </div>
          <div className="mb-6">
            <label className="block mb-1 font-medium">Password</label>
            <input
              type="password"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#0096FF]"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-[#0096FF] text-white py-2 rounded-md hover:opacity-90 transition"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
    </>
  );
}
