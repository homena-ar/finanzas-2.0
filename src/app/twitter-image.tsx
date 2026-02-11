import { ImageResponse } from 'next/og'
 
export const runtime = 'edge'
export const size = { width: 1200, height: 600 }
export const contentType = 'image/png'
 
export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 36,
            alignItems: 'center',
            padding: '0 80px',
            width: '100%',
          }}
        >
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: 52,
              background: 'rgba(255,255,255,0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ display: 'flex', gap: 22, alignItems: 'flex-end', position: 'relative' }}>
              <div
                style={{
                  width: 40,
                  height: 86,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.95)',
                }}
              />
              <div
                style={{
                  width: 40,
                  height: 132,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.98)',
                }}
              />
              <div
                style={{
                  width: 40,
                  height: 176,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,1)',
                }}
              />
              {/* Line connecting the bars */}
              <svg
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                }}
              >
                <path
                  d="M 2 84 L 31 44 L 60 10 L 102 -4"
                  stroke="white"
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                  opacity="0.9"
                />
                <circle cx="102" cy="-4" r="5" fill="white" opacity="0.9" />
              </svg>
            </div>
          </div>
 
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 74,
                fontWeight: 800,
                color: 'white',
                lineHeight: 1,
                letterSpacing: -1,
              }}
            >
              FinControl
            </div>
            <div
              style={{
                marginTop: 16,
                fontSize: 30,
                color: 'rgba(255,255,255,0.9)',
                fontWeight: 600,
              }}
            >
              Controlá tus finanzas personales
            </div>
          </div>
        </div>
      </div>
    ),
    size
  )
}
