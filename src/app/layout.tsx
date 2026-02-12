import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/hooks/useAuth'
import { WorkspaceProvider } from '@/hooks/useWorkspace'
import { DataProvider } from '@/hooks/useData'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { InstallPWA } from '@/components/InstallPWA'
import { PushNotificationPermission } from '@/components/PushNotificationPermission'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// URL base de la aplicación (cambiar según el entorno)
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://fin.nexuno.com.ar'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#0d9488',
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
      // Absolute URL required for WhatsApp/Facebook/Telegram crawlers.
      // The path /og-image.png is rewritten to the dynamic /opengraph-image endpoint.
      {
        url: `${baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'FinControl - Plataforma de Control Financiero',
      },
    ],
  },
  // Only include fb:app_id when actually configured, otherwise Facebook
  // Sharing Debugger complains about the empty required property.
  ...(process.env.NEXT_PUBLIC_FACEBOOK_APP_ID
    ? { other: { 'fb:app_id': process.env.NEXT_PUBLIC_FACEBOOK_APP_ID } }
    : {}),
  twitter: {
    card: 'summary_large_image',
    title: 'FinControl - Controlá tus Finanzas',
    description: 'Plataforma profesional para el control y seguimiento de tus finanzas personales y familiares.',
    images: [`${baseUrl}/og-image.png`],
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="font-sans antialiased">
        <ServiceWorkerRegistration />
        <ErrorBoundary>
          <AuthProvider>
            <InstallPWA />
            <WorkspaceProvider>
              <DataProvider>
                <PushNotificationPermission />
                {children}
              </DataProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
