import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB, findOne } from '@/lib/db/mongodb';
import { verifyPassword, generateToken } from '@/lib/auth/utils';

// export const dynamic = 'force-dynamic'; // Commented for static export

export async function POST(request: NextRequest) {
  try {
    const { emailOrPhone, password } = await request.json();

    if (!emailOrPhone || !password) {
      return NextResponse.json(
        { success: false, error: 'Email/Phone and password are required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    await connectToMongoDB();

    // Find user by email or phone
    const user = await findOne('users', {
      $or: [
        { email: emailOrPhone },
        { phoneNumber: emailOrPhone },
      ],
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
    });

    // Return user data (without password)
    const userData = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      companyName: user.companyName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return NextResponse.json({
      success: true,
      token,
      user: userData,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}
