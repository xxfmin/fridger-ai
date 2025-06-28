// src/app/api/users/login/route.ts
import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import User from '@/models/user'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const { username, password } = await req.json()

  if (!username || !password) {
    return NextResponse.json(
      { message: 'All fields must be filled' },
      { status: 400 }
    )
  }

  await connectDB()

  const user = await User.findOne({ username })
  if (!user) {
    return NextResponse.json(
      { message: 'Invalid username' },
      { status: 400 }
    )
  }

  const passMatch = await bcrypt.compare(password, user.password)
  if (!passMatch) {
    return NextResponse.json(
      { message: 'Invalid password' },
      { status: 400 }
    )
  }

  return NextResponse.json(
    { message: 'Successfully logged in', user: { username: user.username } },
    { status: 200 }
  )
}
