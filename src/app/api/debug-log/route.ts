import { NextRequest, NextResponse } from 'next/server'

// POST /api/debug-log — Receives client-side logs and writes them to server console.
// This makes client-side auth debugging visible in Railway logs.
export async function POST(request: NextRequest) {
  try {
    const { logs } = await request.json()
    if (Array.isArray(logs)) {
      for (const log of logs) {
        const level = log.level || 'info'
        const msg = `📱 [CLIENT ${log.platform || 'unknown'}] ${log.message}`
        if (level === 'error') {
          console.error(msg)
        } else if (level === 'warn') {
          console.warn(msg)
        } else {
          console.log(msg)
        }
      }
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
