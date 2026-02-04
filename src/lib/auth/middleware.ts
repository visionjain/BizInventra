// Authentication middleware for API routes
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractToken, JWTPayload } from './utils';

export interface AuthenticatedRequest extends NextRequest {
  user?: JWTPayload;
}

export async function authenticate(
  request: NextRequest
): Promise<{ success: true; user: JWTPayload } | { success: false; error: string }> {
  const authHeader = request.headers.get('authorization');
  const token = extractToken(authHeader || '');

  if (!token) {
    return { success: false, error: 'No authentication token provided' };
  }

  const payload = verifyToken(token);

  if (!payload) {
    return { success: false, error: 'Invalid or expired token' };
  }

  return { success: true, user: payload };
}

export function requireAuth(handler: Function) {
  return async (request: NextRequest) => {
    const authResult = await authenticate(request);

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    // Add user to request
    (request as AuthenticatedRequest).user = authResult.user;

    return handler(request);
  };
}
