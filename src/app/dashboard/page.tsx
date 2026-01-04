'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()

  // Redirigir automáticamente a la pestaña de Gastos
  useEffect(() => {
    router.push('/dashboard/gastos')
  }, [router])

  // Mostrar un spinner mientras se redirige
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  )
}
