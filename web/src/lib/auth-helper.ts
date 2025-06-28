import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function getSession(request?: NextRequest) {
  return await getServerSession(authOptions);
}

export async function requireAuth(request?: NextRequest) {
  const session = await getSession(request);

  if (!session) {
    throw new Error("Authentication required");
  }

  return session;
}