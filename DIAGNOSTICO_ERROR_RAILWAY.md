# 🔍 Diagnóstico: Aplicación No Responde en Railway

## Problema
El build se completa exitosamente, pero la aplicación muestra "Application failed to respond" al acceder a la web.

## Pasos de Diagnóstico

### 1. Revisar Logs de Runtime (NO Build)

**IMPORTANTE**: Los logs de build muestran que se construyó correctamente, pero necesitas ver los **logs de runtime** (cuando la app intenta iniciar):

1. En Railway, ve a tu servicio
2. Haz clic en la pestaña **"Logs"** (no "Deployments")
3. Busca mensajes como:
   - `> Ready on http://...`
   - `Error: Cannot find module`
   - `Error: Missing environment variable`
   - `Error: EADDRINUSE` (puerto en uso)
   - Cualquier stack trace o error

### 2. Verificar Variables de Entorno

Asegúrate de que TODAS estas variables estén configuradas en Railway:

**Variables OBLIGATORIAS:**
```env
# Firebase (todas son necesarias)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Node Environment
NODE_ENV=production
```

**Variables OPCIONALES (pero recomendadas):**
```env
# Resend (si usas correos)
RESEND_API_KEY=...
RESEND_FROM_EMAIL=noreply@fin.nexuno.com.ar

# Google Gemini (si usas IA)
GOOGLE_GEMINI_API_KEY=...

# Base URL
NEXT_PUBLIC_BASE_URL=https://fin.nexuno.com.ar
```

### 3. Verificar Configuración del Servicio

En Railway, ve a **Settings** → **Service Settings** y verifica:

- ✅ **Service Type**: "Web Service" (no Worker)
- ✅ **Start Command**: `npm start` (debería detectarse automáticamente)
- ✅ **Port**: Debe estar vacío o usar `$PORT` (Railway lo asigna automáticamente)

### 4. Errores Comunes y Soluciones

#### Error: "Cannot find module"
**Solución**: 
- Verifica que todas las dependencias estén en `package.json`
- Asegúrate de que `npm ci` se ejecutó correctamente en el build

#### Error: "Missing environment variable"
**Solución**:
- Agrega la variable faltante en Railway → Variables
- Haz un nuevo deploy después de agregar variables

#### Error: "EADDRINUSE" o "Port already in use"
**Solución**:
- Railway asigna el puerto automáticamente
- Asegúrate de que tu código use `process.env.PORT`
- `next start` lo hace automáticamente

#### Error: "Application failed to respond"
**Posibles causas**:
1. La aplicación no está escuchando en el puerto correcto
2. La aplicación crashea al iniciar
3. Variables de entorno faltantes causan error en el código

### 5. Probar Localmente

Antes de hacer deploy, prueba que funcione localmente:

```bash
# Instalar dependencias
npm install

# Hacer build
npm run build

# Iniciar en modo producción
NODE_ENV=production npm start
```

Si funciona localmente pero no en Railway, el problema es de configuración de Railway.

### 6. Verificar que Next.js Esté Configurado Correctamente

Asegúrate de que `next.config.js` no tenga problemas:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = nextConfig
```

### 7. Solución Rápida: Usar `next start` Directamente

He actualizado el código para usar `next start` directamente en lugar de `server.js`. Esto es más confiable en Railway.

**Cambios realizados:**
- ✅ `package.json`: `"start": "next start"` (en lugar de `node server.js`)
- ✅ `nixpacks.toml`: Configuración explícita para Railway
- ✅ `railway.json`: Simplificado

### 8. Hacer un Nuevo Deploy

Después de verificar todo:

1. Haz commit de los cambios:
   ```bash
   git add .
   git commit -m "Fix Railway deployment - use next start"
   git push
   ```

2. Railway detectará el push y hará un nuevo deploy automáticamente

3. Monitorea los logs en tiempo real:
   - Ve a **Logs** en Railway
   - Deberías ver: `> Ready on http://0.0.0.0:PORT`

### 9. Si Sigue Fallando

Si después de todo esto sigue fallando:

1. **Copia los logs completos** (tanto build como runtime)
2. **Verifica todas las variables de entorno** (screenshot de la pestaña Variables)
3. **Revisa si hay errores en el código** que solo aparecen en producción

## Checklist Final

Antes de hacer un nuevo deploy, verifica:

- [ ] Todas las variables de entorno están configuradas
- [ ] `NODE_ENV=production` está configurado
- [ ] El build funciona localmente (`npm run build`)
- [ ] El start funciona localmente (`npm start`)
- [ ] No hay errores de TypeScript (`npm run lint`)
- [ ] Los cambios están commiteados y pusheados
