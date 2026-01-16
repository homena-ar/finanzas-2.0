# 🚨 Solución: Deploy Atascado en Railway - "Waiting for build to start..."

## Problema
El deploy lleva más de 25 minutos en estado "Initializing" y no comienza el build en Railway.

## Soluciones Rápidas

### 1. Cancelar y Reiniciar el Deploy (PRIMERA OPCIÓN)

1. Ve a tu dashboard de [Railway](https://railway.app)
2. Selecciona tu proyecto **finanzas-2.0**
3. Ve a la pestaña **"Deployments"** o **"Deploys"**
4. Encuentra el deploy que está atascado
5. Haz clic en los **tres puntos (⋯)** o en el botón de **"Cancel"** o **"Stop"**
6. Espera a que se cancele completamente
7. Haz un nuevo push a tu repositorio o haz clic en **"Redeploy"** o **"Deploy"**

### 2. Verificar Variables de Entorno en Railway

Asegúrate de que todas estas variables estén configuradas en Railway:

1. Ve a tu proyecto en Railway
2. Haz clic en tu servicio (service)
3. Ve a la pestaña **"Variables"** o **"Environment Variables"**
4. Verifica que tengas estas variables configuradas:

#### Variables Requeridas:

```env
# Firebase (si usas Firebase)
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_dominio
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id

# Supabase (si usas Supabase)
NEXT_PUBLIC_SUPABASE_URL=tu_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_key

# Resend (para correos)
RESEND_API_KEY=tu_resend_key
RESEND_FROM_EMAIL=noreply@fin.nexuno.com.ar

# Google Gemini (opcional, para IA)
GOOGLE_GEMINI_API_KEY=tu_gemini_key
```

**IMPORTANTE**: 
- En Railway, todas las variables se aplican al entorno de producción
- Las variables que empiezan con `NEXT_PUBLIC_` son accesibles desde el cliente (navegador)
- Las variables sin `NEXT_PUBLIC_` solo están disponibles en el servidor

### 3. Verificar el Build Localmente

Antes de hacer deploy, prueba que el build funcione localmente:

```bash
# Instalar dependencias
npm install

# Hacer build
npm run build

# Si hay errores, corrígelos antes de hacer deploy
```

### 4. Verificar el Log del Deploy

1. En Railway, ve a tu servicio
2. Haz clic en la pestaña **"Deployments"** o **"Logs"**
3. Selecciona el deploy atascado
4. Revisa los **"Build Logs"** o **"Deploy Logs"**
5. Busca errores específicos como:
   - `Error: Missing environment variable`
   - `Error: Build failed`
   - `Error: npm install failed`
   - `Error: Cannot find module`

### 5. Verificar Configuración del Servicio en Railway

Asegúrate de que:
- El **Service Type** esté configurado como **"Web Service"** (no "Worker" o "Cron")
- El **Root Directory** esté vacío (o configurado correctamente si tu proyecto está en una subcarpeta)
- El **Build Command** sea `npm run build` (Railway debería detectarlo automáticamente para Next.js)
- El **Start Command** sea `npm start` (Railway debería detectarlo automáticamente)
- El **Port** esté configurado correctamente (Railway usa la variable `PORT` automáticamente)

### 6. Verificar que Railway Detecte Next.js Correctamente

Railway debería detectar automáticamente Next.js, pero si no:

1. Ve a **Settings** → **Service Settings**
2. Verifica que el **Nixpacks Build Plan** esté detectando Node.js y Next.js
3. Si no, puedes forzar el build plan agregando un archivo `nixpacks.toml` en la raíz:

```toml
[phases.setup]
nixPkgs = ["nodejs-18_x"]

[phases.install]
cmds = ["npm install"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm start"
```

### 7. Verificar Límites de Cuota

Si estás en el plan gratuito de Railway:
- Verifica que no hayas excedido los $5 de crédito mensual
- Revisa si hay algún problema con tu tarjeta de crédito
- Ve a **Settings** → **Billing** para verificar tu uso

### 8. Limpiar y Reintentar

1. En Railway, ve a **Settings** → **Service Settings**
2. Busca la opción **"Clear Build Cache"** o **"Rebuild"**
3. Haz clic en **"Redeploy"** o **"Deploy"**
4. Si no hay opción, elimina el servicio y créalo de nuevo (esto NO elimina tus variables de entorno si están en el proyecto)

### 9. Solución de Último Recurso: Recrear el Servicio

Si nada funciona:

1. **NO elimines el proyecto completo**
2. Crea un nuevo servicio en el mismo proyecto de Railway
3. Conecta el mismo repositorio
4. Railway copiará automáticamente las variables de entorno del proyecto
5. Haz el deploy

## Checklist de Verificación

Antes de hacer un nuevo deploy, verifica:

- [ ] El build funciona localmente (`npm run build`)
- [ ] Todas las variables de entorno están configuradas en Railway
- [ ] No hay errores de TypeScript (`npm run lint`)
- [ ] El archivo `package.json` tiene los scripts correctos (`build` y `start`)
- [ ] El repositorio está conectado correctamente en Railway
- [ ] No hay archivos grandes en el repositorio que puedan causar problemas
- [ ] El servicio está configurado como "Web Service" (no Worker)
- [ ] Railway detecta correctamente Next.js (debería aparecer en los logs)

## Comandos Útiles

```bash
# Verificar que no haya errores de TypeScript
npm run lint

# Verificar que el build funcione
npm run build

# Verificar dependencias
npm install

# Limpiar cache de Next.js
rm -rf .next
npm run build
```

## Problemas Comunes en Railway

### Problema: "Build timeout" o "Build taking too long"
- **Solución**: Railway tiene un límite de tiempo para builds. Si tu build tarda más de 20 minutos, considera optimizar:
  - Reducir el tamaño de `node_modules`
  - Usar `.npmrc` para optimizar instalación
  - Verificar que no haya dependencias innecesarias

### Problema: "Port already in use"
- **Solución**: Railway asigna automáticamente el puerto. Asegúrate de que tu `server.js` o `next.config.js` use `process.env.PORT`:

```javascript
// server.js o en tu código
const port = process.env.PORT || 3000
```

### Problema: "Missing environment variables"
- **Solución**: Verifica que todas las variables estén en Railway:
  1. Ve a **Variables** en tu servicio
  2. Verifica que todas las variables necesarias estén presentes
  3. Asegúrate de que no haya espacios extra o caracteres especiales

## Contacto con Soporte

Si el problema persiste después de intentar todas las soluciones:

1. Ve a [Railway Support](https://railway.app/help) o [Discord de Railway](https://discord.gg/railway)
2. Proporciona:
   - URL del proyecto en Railway
   - Screenshot del estado del deploy
   - Logs del build (copia completa de los logs)
   - Descripción del problema
   - Variables de entorno que estás usando (sin los valores, solo los nombres)
