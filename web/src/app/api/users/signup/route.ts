import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import user from '@/models/user';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  await connectDB();

  // 1) check for duplicates
  if (await user.findOne({ username })) {
    return NextResponse.json({ error: 'Username taken' }, { status: 400 });
  }

  // 2) hash & save
  const hash = await bcrypt.hash(password, 10);
  await new user({ username, password: hash }).save();

  // 3) respond
  return NextResponse.json({ message: 'User created' }, { status: 201 });
}
