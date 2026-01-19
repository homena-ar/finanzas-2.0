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
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
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
            <div style={{ display: 'flex', gap: 22, alignItems: 'flex-end' }}>
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
