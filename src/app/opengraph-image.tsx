import { ImageResponse } from 'next/og'
 
export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
 
export default function OpenGraphImage() {
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
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 90% 20%, rgba(255,255,255,0.10) 0, rgba(255,255,255,0) 45%), radial-gradient(circle at 10% 90%, rgba(255,255,255,0.08) 0, rgba(255,255,255,0) 45%)',
          }}
        />
 
        <div
          style={{
            display: 'flex',
            gap: 48,
            alignItems: 'center',
            padding: '0 80px',
            width: '100%',
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: 300,
              height: 300,
              borderRadius: 60,
              background: 'rgba(255,255,255,0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end' }}>
              <div
                style={{
                  width: 50,
                  height: 110,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.95)',
                }}
              />
              <div
                style={{
                  width: 50,
                  height: 170,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.98)',
                }}
              />
              <div
                style={{
                  width: 50,
                  height: 230,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,1)',
                }}
              />
            </div>
          </div>
 
          {/* Text */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 84,
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
                marginTop: 18,
                fontSize: 34,
                color: 'rgba(255,255,255,0.92)',
                fontWeight: 600,
              }}
            >
              Controlá tus finanzas personales
            </div>
            <div
              style={{
                marginTop: 14,
                fontSize: 24,
                color: 'rgba(255,255,255,0.75)',
                fontWeight: 500,
              }}
            >
              Gastos · Ingresos · Ahorros · Proyecciones
            </div>
            <div
              style={{
                marginTop: 60,
                fontSize: 20,
                color: 'rgba(255,255,255,0.55)',
              }}
            >
              fin.nexuno.com.ar
            </div>
          </div>
        </div>
      </div>
    ),
    size
  )
}
