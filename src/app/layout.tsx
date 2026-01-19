import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/hooks/useAuth'
import { WorkspaceProvider } from '@/hooks/useWorkspace'
import { DataProvider } from '@/hooks/useData'

// URL base de la aplicación (cambiar según el entorno)
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://fin.nexuno.com.ar'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#6366f1',
}

export const metadata: Metadata = {
  title: {
    default: 'FinControl - Controlá tus Finanzas',
    template: '%s | FinControl',
  },
  description: 'Plataforma profesional para el control y seguimiento de tus finanzas personales y familiares. Gestioná gastos, ingresos, ahorros, proyecciones y patrimonio en un solo lugar.',
  keywords: ['finanzas', 'control financiero', 'gastos', 'ingresos', 'ahorro', 'patrimonio', 'presupuesto', 'argentina', 'pesos', 'dólares'],
  authors: [{ name: 'FinControl', url: baseUrl }],
  creator: 'FinControl',
  publisher: 'FinControl',
  metadataBase: new URL(baseUrl),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: baseUrl,
    title: 'FinControl - Controlá tus Finanzas',
    description: 'Plataforma profesional para el control y seguimiento de tus finanzas personales y familiares. Gestioná gastos, ingresos, ahorros y proyecciones.',
    siteName: 'FinControl',
    images: [
      // PNG dinámico (mejor compatibilidad WhatsApp/Facebook)
      { url: '/og-image.png', width: 1200, height: 630 },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FinControl - Controlá tus Finanzas',
    description: 'Plataforma profesional para el control y seguimiento de tus finanzas personales y familiares.',
    images: ['/twitter-image.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FinControl',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
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
      </head>
      <body className="font-sans">
        <AuthProvider>
          <WorkspaceProvider>
            <DataProvider>
              {children}
            </DataProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
