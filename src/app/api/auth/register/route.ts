export const dynamic = 'force-static';

import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB, findOne, insertOne } from '@/lib/db/mongodb';
import { hashPassword, generateToken } from '@/lib/auth/utils';
// export const dynamic = 'force-static'; // Commented for static export
export async function POST(request: NextRequest) {
  try {
    const { name, email, phoneNumber, companyName, password } = await request.json();

    // Validation
    if (!name || !email || !phoneNumber || !companyName || !password) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    await connectToMongoDB();

    // Check if user already exists
    const existingUser = await findOne('users', {
      $or: [
        { email },
        { phoneNumber },
      ],
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email or phone number already registered' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const now = new Date();
    const newUser = {
      name,
      email,
      phoneNumber,
      companyName,
      passwordHash,
      createdAt: now,
      updatedAt: now,
      lastSyncAt: null,
    };

    const userId = await insertOne('users', newUser);

    // Generate JWT token
    const token = generateToken({
      userId,
      email,
    });

    // Return user data (without password)
    const userData = {
      id: userId,
      name,
      email,
      phoneNumber,
      companyName,
      createdAt: now,
      updatedAt: now,
    };

    return NextResponse.json({
      success: true,
      token,
      user: userData,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}
