'use client';

import React, { useState } from 'react';
import Navbar from '@/components/navbar';
import { AuroraBackground } from '@/components/aurora-background';
import axios from 'axios';
import { useRouter } from 'next/navigation';

export default function SignInPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await axios.post('/api/users/login', { username, password });
      router.push(`/profile/${username}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login Failed.');
      console.error(err);
    }
  };

  return (
    <AuroraBackground>
      <Navbar />

      <div className="flex items-center justify-center min-h-screen text-white">
        <div className="backdrop-blur-lg p-8 rounded-lg shadow-lg w-full max-w-sm">
          <h2 className="text-3xl font-bold mb-6 text-center">Sign In</h2>
          <form onSubmit={handleSignIn}>
            <div className="mb-5">
              <label className="block mb-1 font-medium">Email or Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-6 py-2 border border-white rounded-md bg-transparent text-white placeholder-white focus:outline-none focus:ring-2 focus:ring-white text-left"
                placeholder="you@example.com"
              />
            </div>
            <div className="mb-6">
              <label className="block mb-1 font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-6 py-2 border border-white rounded-md bg-transparent text-white placeholder-white focus:outline-none focus:ring-2 focus:ring-white text-left"
                placeholder="password"
              />
            </div>
            {error && <p className="text-red-500 mb-4">{error}</p>}
            <button
              type="submit"
              className="w-full bg-inherit border border-white text-white py-2 rounded-md hover:bg-white/20 transition"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </AuroraBackground>
  );
}
