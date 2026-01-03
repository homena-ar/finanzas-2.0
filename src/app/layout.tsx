import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/hooks/useAuth'
import { DataProvider } from '@/hooks/useData'

const inter = Inter({ subsets: ['latin'] })

// URL base de la aplicación (cambiar según el entorno)
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.nexuno.com.ar'

export const metadata: Metadata = {
  title: 'FinControl - Controlá tus Finanzas',
  description: 'Plataforma profesional para el control y seguimiento de tus finanzas personales y familiares. Gestioná gastos, proyecciones, ahorros y patrimonio en un solo lugar.',
  themeColor: '#6366f1',
  keywords: ['finanzas', 'control financiero', 'gastos', 'ahorro', 'patrimonio', 'presupuesto'],
  authors: [{ name: 'FinControl' }],
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
  metadataBase: new URL(baseUrl),
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: '/',
    title: 'FinControl - Controlá tus Finanzas',
    description: 'Plataforma profesional para el control y seguimiento de tus finanzas personales y familiares.',
    siteName: 'FinControl',
    images: [
      {
        url: '/og-image.png',
        secureUrl: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'FinControl - Plataforma de Control Financiero',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FinControl - Controlá tus Finanzas',
    description: 'Plataforma profesional para el control y seguimiento de tus finanzas personales y familiares.',
    images: ['/og-image.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FinControl',
  },
  formatDetection: {
    telephone: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <DataProvider>
            {children}
          </DataProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
