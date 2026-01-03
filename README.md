# Finanzas Familia - Next.js + Supabase

Sistema de control financiero familiar con autenticación, múltiples usuarios, y sincronización en la nube.

## 🚀 Características

- ✅ Autenticación con email/password
- ✅ Cada usuario tiene sus propios datos
- ✅ Dashboard con resumen mensual
- ✅ Gestión de gastos y cuotas
- ✅ Impuestos por tarjeta
- ✅ Múltiples tarjetas de crédito
- ✅ Proyección de gastos futuros
- ✅ Sistema de ahorros (ARS/USD)
- ✅ Metas con progreso visual
- ✅ Cotización dólar BNA en tiempo real
- ✅ Presupuesto mensual con alertas
- ✅ Tags personalizados
- ✅ Exportación a Excel
- ✅ Diseño responsive

## 📦 Instalación Local

```bash
# Clonar o descomprimir el proyecto
cd finanzas-familia

# Instalar dependencias
npm install

# Configurar variables de entorno
# Crear archivo .env.local con:
NEXT_PUBLIC_SUPABASE_URL=tu_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_key

# Ejecutar en desarrollo
npm run dev
```

## 🌐 Deploy en Hostinger

### Opción 1: Build y subir (Recomendado)

1. **En tu computadora local:**
```bash
npm install
npm run build
```

2. **Subir a Hostinger:**
   - Conectate por FTP o File Manager
   - Subí toda la carpeta `.next`, `public`, `package.json`, `next.config.js`
   - También el archivo `.env.local` (renombralo a `.env`)

3. **En Hostinger:**
   - Configurá Node.js (versión 18+)
   - Ejecutá: `npm install --production`
   - Configurá el comando de inicio: `npm start`
   - Puerto: el que te asigne Hostinger

### Opción 2: Con Git (más fácil para updates)

1. Subí el proyecto a GitHub/GitLab
2. En Hostinger, conectá el repositorio
3. Configurá las variables de entorno en el panel
4. Deploy automático

### Opción 3: Vercel (Lo más fácil)

1. Subí a GitHub
2. Importá en [vercel.com](https://vercel.com)
3. Agregá las variables de entorno
4. Deploy automático

## ⚙️ Variables de Entorno

```env
NEXT_PUBLIC_SUPABASE_URL=https://yzhmctutglxnamzgwyrp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

## 📱 Estructura del Proyecto

```
src/
├── app/
│   ├── page.tsx              # Login
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Estilos globales
│   └── dashboard/
│       ├── layout.tsx        # Dashboard layout con sidebar
│       ├── page.tsx          # Resumen
│       ├── gastos/page.tsx   # Gestión de gastos
│       ├── tarjetas/page.tsx # Tarjetas de crédito
│       ├── proyeccion/page.tsx # Proyecciones
│       ├── ahorros/page.tsx  # Ahorros y metas
│       └── config/page.tsx   # Configuración
├── components/               # Componentes reutilizables
├── hooks/
│   ├── useAuth.tsx          # Contexto de autenticación
│   └── useData.tsx          # Hook de datos con Supabase
├── lib/
│   ├── supabase.ts          # Cliente Supabase
│   └── utils.ts             # Funciones utilitarias
└── types/
    └── index.ts             # TypeScript types
```

## 🔐 Base de Datos (Supabase)

Las tablas ya están creadas con el SQL que ejecutaste:
- `profiles` - Datos del usuario
- `tarjetas` - Tarjetas de crédito
- `gastos` - Gastos/consumos
- `impuestos` - Impuestos y cargos
- `categorias` - Categorías de gastos
- `tags` - Tags personalizados
- `metas` - Metas de ahorro
- `movimientos_ahorro` - Historial de ahorros

## 🛠️ Comandos

```bash
npm run dev      # Desarrollo
npm run build    # Build producción
npm start        # Iniciar producción
npm run lint     # Linter
```

## 📝 Notas

- La primera vez que un usuario se registra, se crean automáticamente las categorías y tags por defecto
- El dólar se obtiene de la API de dolarapi.com
- Los datos están protegidos por Row Level Security (RLS) en Supabase
- Cada usuario solo puede ver sus propios datos

## 🤝 Soporte

Cualquier duda, revisá la documentación de:
- [Next.js](https://nextjs.org/docs)
- [Supabase](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
