# 🚂 Guía de Deploy en Railway

## Configuración Rápida

### 1. Conectar Repositorio

1. Ve a [Railway](https://railway.app)
2. Haz clic en **"New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Conecta tu repositorio `finanzas-2.0`
5. Railway detectará automáticamente que es un proyecto Next.js

### 2. Configurar Variables de Entorno

1. En tu servicio, ve a la pestaña **"Variables"**
2. Agrega todas estas variables:

```env
# Firebase (obligatorias)
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_dominio
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id

# Supabase (si las usas)
NEXT_PUBLIC_SUPABASE_URL=tu_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_key

# Resend (para correos)
RESEND_API_KEY=tu_resend_key
RESEND_FROM_EMAIL=noreply@fin.nexuno.com.ar

# Google Gemini (opcional, para IA)
GOOGLE_GEMINI_API_KEY=tu_gemini_key

# Base URL (opcional)
NEXT_PUBLIC_BASE_URL=https://fin.nexuno.com.ar

# Node Environment
NODE_ENV=production
```

### 3. Configurar Dominio (Opcional)

1. Ve a **Settings** → **Networking**
2. Haz clic en **"Generate Domain"** o **"Custom Domain"**
3. Si usas dominio personalizado, configura los DNS según las instrucciones

### 4. Verificar Configuración del Servicio

Asegúrate de que:
- **Service Type**: Web Service
- **Build Command**: `npm run build` (detectado automáticamente)
- **Start Command**: `npm start` o `node server.js` (detectado automáticamente)
- **Port**: Railway asigna automáticamente (usa `process.env.PORT`)

## Solución de Problemas

### Deploy Atascado

Si el deploy se queda en "Initializing" o "Building":

1. **Cancelar el deploy actual**
   - Ve a **Deployments**
   - Haz clic en **"Cancel"** o **"Stop"**

2. **Verificar variables de entorno**
   - Todas las variables deben estar configuradas
   - No debe haber espacios extra en los valores

3. **Verificar logs**
   - Ve a **Logs** en tu servicio
   - Busca errores específicos

4. **Limpiar y reintentar**
   - Haz clic en **"Redeploy"** o haz un nuevo push

### Build Falla

Si el build falla:

1. **Probar localmente primero**:
   ```bash
   npm install
   npm run build
   ```

2. **Verificar errores en los logs**:
   - Errores de TypeScript
   - Dependencias faltantes
   - Variables de entorno faltantes

3. **Verificar que todas las dependencias estén en `package.json`**

### Aplicación No Inicia

Si la aplicación se construye pero no inicia:

1. **Verificar que `server.js` use `0.0.0.0`** (no `localhost`)
2. **Verificar que use `process.env.PORT`**
3. **Revisar los logs de inicio** para errores

### Variables de Entorno No Funcionan

1. **Verificar que las variables con `NEXT_PUBLIC_` estén configuradas**
2. **Hacer un nuevo deploy** después de agregar variables
3. **Verificar que no haya espacios extra** en los valores

## Comandos Útiles

```bash
# Probar build localmente
npm install
npm run build

# Probar servidor localmente
npm start

# Verificar que no haya errores
npm run lint
```

## Monitoreo

- **Logs**: Ve a la pestaña **"Logs"** en tu servicio
- **Métricas**: Ve a **"Metrics"** para ver CPU, memoria, etc.
- **Deployments**: Ve a **"Deployments"** para ver el historial

## Costos

Railway ofrece:
- **$5 de crédito gratuito** por mes en el plan Hobby
- Pago por uso después del crédito
- Next.js generalmente usa muy poco recurso

## Soporte

- [Railway Docs](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
- [Railway Support](https://railway.app/help)
