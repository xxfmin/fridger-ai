'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

import Navbar from '@/components/navbar';
import { AuroraBackground } from '@/components/aurora-background';

export default function SignInPage() {
  const router = useRouter();

  const [username,   setUsername]   = useState('');
  const [password,   setPassword]   = useState('');
  const [error,      setError]      = useState<string | null>(null);
  const [isLoading,  setIsLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('Both fields are required');
      return;
    }

    setIsLoading(true);
    const result = await signIn('credentials', {
      redirect: false,
      username: username.trim(),
      password,
    });

    setIsLoading(false);

    if (result?.error) {
      setError('Invalid username or password');
    } else {
      // On success, redirect wherever you like:
      router.push('/dashboard');
    }
  };

  return (
    <AuroraBackground>
      <Navbar />

      <div className="flex items-center justify-center min-h-screen text-white">
        <div className="backdrop-blur-lg p-8 rounded-lg shadow-lg w-full max-w-sm">
          <h2 className="text-3xl font-bold mb-6 text-center">Sign In</h2>

          {error && <p className="text-red-500 mb-4">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block mb-1 font-medium">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-2 border rounded bg-white text-black focus:outline-none"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-2 border rounded bg-white text-black focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-2 font-semibold rounded ${
                isLoading
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-700 text-white'
              }`}
            >
              {isLoading ? 'Signing In…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </AuroraBackground>
  );
}
