import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'

// Initialize Firebase Admin SDK (singleton)
function initializeAdmin(): boolean {
  if (admin.apps.length > 0) return true
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    if (!serviceAccount) {
      console.error('❌ [Session API] FIREBASE_SERVICE_ACCOUNT_KEY not configured')
      return false
    }
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount))
    })
    return true
  } catch (error: any) {
    console.error('❌ [Session API] Admin init error:', error.message)
    return false
  }
}

// POST /api/session — Create a session cookie from a Firebase ID token.
// Called after the user signs in successfully on the client.
// The cookie persists across iOS PWA app kills (more reliable than localStorage).
export async function POST(request: NextRequest) {
  try {
    if (!initializeAdmin()) {
      return NextResponse.json({ error: 'Server config error' }, { status: 500 })
    }

    const { idToken } = await request.json()
    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })
    }

    // Verify the ID token first
    const decodedToken = await admin.auth().verifyIdToken(idToken)
    console.log(`✅ [Session API] Creating session cookie for uid=${decodedToken.uid}`)

    // Create a session cookie that lasts 14 days
    const expiresIn = 14 * 24 * 60 * 60 * 1000 // 14 days in ms
    const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn })

    const response = NextResponse.json({ status: 'ok', uid: decodedToken.uid })

    // Set HTTP-only cookie — iOS PWA preserves these across app kills
    response.cookies.set('__session', sessionCookie, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 14 * 24 * 60 * 60, // 14 days in seconds
    })

    return response
  } catch (error: any) {
    console.error('❌ [Session API] POST error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 401 })
  }
}

// GET /api/session — Verify the session cookie and return a custom token
// for re-authentication when Firebase client-side persistence fails.
// Called on app startup when onAuthStateChanged fires null but cookie exists.
export async function GET(request: NextRequest) {
  try {
    if (!initializeAdmin()) {
      return NextResponse.json({ error: 'Server config error' }, { status: 500 })
    }

    const sessionCookie = request.cookies.get('__session')?.value
    if (!sessionCookie) {
      console.log('ℹ️ [Session API] GET: no session cookie found')
      return NextResponse.json({ error: 'No session cookie' }, { status: 401 })
    }

    // Verify the session cookie
    const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie, true)
    console.log(`✅ [Session API] Valid session cookie for uid=${decodedClaims.uid}`)

    // Create a custom token so the client can re-authenticate
    const customToken = await admin.auth().createCustomToken(decodedClaims.uid)

    return NextResponse.json({
      status: 'ok',
      uid: decodedClaims.uid,
      customToken,
    })
  } catch (error: any) {
    console.error('❌ [Session API] GET error (cookie invalid/expired):', error.message)

    // Clear the invalid cookie
    const response = NextResponse.json({ error: 'Session expired' }, { status: 401 })
    response.cookies.set('__session', '', { maxAge: 0, path: '/' })
    return response
  }
}

// DELETE /api/session — Clear the session cookie on sign-out.
export async function DELETE() {
  const response = NextResponse.json({ status: 'ok' })
  response.cookies.set('__session', '', { maxAge: 0, path: '/' })
  console.log('🗑️ [Session API] Session cookie cleared')
  return response
}
