import { NextRequest, NextResponse } from "next/server";
import { userService } from "@/services/user-service";
import { encode } from "next-auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // authenticate user
    try {
      const user = await userService.authenticateUser(username, password);

      // create nextauth JWT
      const token = await encode({
        token: {
          id: user._id.toString(),
          username: user.username,
          name: user.username,
          email: user.username,
          sub: user._id.toString(),
        },
        secret: process.env.NEXTAUTH_SECRET!,
        maxAge: 24 * 60 * 60, // 24 hours
      });

      // create response
      const response = NextResponse.json(
        {
          message: "Login successful",
          user: {
            id: user._id.toString(),
            username: user.username,
            name: user.username,
            email: user.username,
          },
        },
        { status: 200 }
      );

      // set nextauth session cookie
      const cookieName =
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token";

      response.cookies.set(cookieName, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60, // 24 hours
        path: "/",
      });

      return response;
    } catch (authError: any) {
      if (authError.message === "Invalid credentials") {
        return NextResponse.json(
          { error: "Invalid username or password" },
          { status: 401 }
        );
      }
      throw authError;
    }
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}