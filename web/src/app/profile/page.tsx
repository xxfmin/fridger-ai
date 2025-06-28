// src/app/profile/[username]/page.tsx
'use client';

import Link from 'next/link';

import React from 'react';
import Navbar from '@/components/navbar';
import { AuroraBackground } from '@/components/aurora-background';

interface ProfilePageProps {
  params: {
    username: string;
  };
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const { username } = params;

  return (
    <AuroraBackground>
      <Navbar />

      <div className="flex items-center justify-center min-h-screen px-4">
        <div
          className="
            bg-white/20
            backdrop-blur-lg
            p-8
            shadow-xl
            w-full
            max-w-5xl
            h-[80vh]
            rounded-lg
            overflow-auto
            text-white
          "
        >
          <h1 className="text-4xl font-bold mb-8 text-center">{username}</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div>
              <h2 className="font-semibold text-lg">Full Name</h2>
              <p className="mt-1">John Doe</p>
            </div>
            <div>
              <h2 className="font-semibold text-lg">Email</h2>
              <p className="mt-1">123@123.com</p>
            </div>
            <div>
              <h2 className="font-semibold text-lg">Member Since</h2>
              <p className="mt-1">January 1, 2023</p>
            </div>
            <div>
              <h2 className="font-semibold text-lg">Favorite Cuisine</h2>
              <p className="mt-1">Italian</p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/"
              className="
                inline-block
                bg-inherit
                border border-white
                text-white
                px-8 py-3
                rounded-md
                hover:bg-white/30
                transition
              "
            >
              Logout
            </Link>
          </div>
        </div>
      </div>
    </AuroraBackground>
  );
}
