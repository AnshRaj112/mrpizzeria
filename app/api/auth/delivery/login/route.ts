import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { verifyPassword, generateToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contactNumber, password } = body;

    // Validation
    if (!contactNumber || !password) {
      return NextResponse.json(
        { error: 'Contact number and password are required' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('mrpizzeria');

    // Find user
    const user = await db.collection('users').findOne({
      contactNumber: contactNumber,
      role: 'delivery',
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid contact number or password' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await verifyPassword(user.password, password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid contact number or password' },
        { status: 401 }
      );
    }

    // Generate token
    const token = generateToken({
      userId: user._id.toString(),
      contactNumber: user.contactNumber,
      role: 'delivery',
    });

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        userId: user._id.toString(),
        contactNumber: user.contactNumber,
        role: 'delivery',
      },
    });

    // Set auth cookie
    setAuthCookie(response, token);

    return response;
  } catch (error: any) {
    console.error('Error in delivery login:', error);
    return NextResponse.json(
      { error: 'Failed to login' },
      { status: 500 }
    );
  }
}

