# 📱 Notificaciones Push - FinControl PWA

## ✅ ¿Qué son las notificaciones push?

Las notificaciones push son alertas que aparecen en el dispositivo del usuario **incluso cuando la app no está abierta**. Son nativas del sistema operativo (Android, iOS, Windows, macOS).

### Diferencias con las otras notificaciones

| Tipo | Dónde aparece | Cuándo funciona |
|------|--------------|-----------------|
| **Correo** | Bandeja de email | Siempre (requiere internet) |
| **Campanita** | Dentro de la app | Solo cuando estás usando la app |
| **Push** | Sistema operativo | **Incluso con la app cerrada** |

---

## 🔧 Configuración (Solo una vez)

### 1. Generar claves VAPID

Las claves VAPID son necesarias para enviar notificaciones push. Generálas con este comando:

```bash
npx web-push generate-vapid-keys
```

Te va a dar algo como:

```
Public Key: BNxxx...xxx
Private Key: yyy...yyy
```

### 2. Agregar variables de entorno

Agregá estas variables en **Railway → Variables** (o `.env.local` en desarrollo):

```bash
# Claves VAPID (del paso anterior)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BNxxx...xxx
VAPID_PRIVATE_KEY=yyy...yyy
VAPID_SUBJECT=mailto:tu-email@ejemplo.com
```

**Importante**: 
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` tiene el prefijo `NEXT_PUBLIC_` (se usa en el navegador)
- `VAPID_PRIVATE_KEY` **NO** tiene el prefijo (solo en el servidor)

### 3. Instalar dependencia web-push

```bash
npm install web-push
```

### 4. Desplegar las reglas de Firestore

```bash
firebase deploy --only firestore:rules
```

### 5. Reiniciar la app

En Railway o localmente, para que tome las nuevas variables.

---

## 📲 Cómo funciona (para el usuario)

### Flujo de activación

1. El usuario **instala la PWA** (o navega con un navegador compatible)
2. Después de 5 segundos, aparece un **aviso en la esquina inferior izquierda**:
   - "¿Activar notificaciones?"
   - Botón **"Activar"** o cerrar (X)
3. Si hace clic en **"Activar"**:
   - El navegador muestra el permiso nativo del sistema
   - Si acepta, el token se guarda en Firestore
4. Ahora puede recibir notificaciones push

### Cuándo se envían

El **cron** (`/api/check-and-send-notifications`), **2 días antes** del cierre o vencimiento:

1. ✅ Envía el **correo**
2. ✅ Crea la notificación en la **campanita**
3. ✅ **NUEVO**: Envía la **notificación push** al dispositivo

---

## 🌐 Compatibilidad por plataforma

| Plataforma | Funciona | Requisitos |
|------------|----------|------------|
| **Android (Chrome)** | ✅ Sí | PWA instalada o navegador abierto |
| **Android (Edge/Brave)** | ✅ Sí | PWA instalada o navegador abierto |
| **Windows (Chrome/Edge)** | ✅ Sí | PWA instalada o navegador abierto |
| **macOS (Chrome/Edge)** | ✅ Sí | PWA instalada o navegador abierto |
| **iOS (Safari 16.4+)** | ✅ Sí | **Requiere agregar a pantalla de inicio** |
| **iOS (Chrome/Firefox)** | ❌ No | iOS no permite push en navegadores de terceros |

**Nota iOS**: En iPhone/iPad, el usuario **debe** agregar la app a la pantalla de inicio desde Safari (Compartir → Agregar a pantalla de inicio). Safari 16.4+ (iOS 16.4+) soporta push.

---

## 🧪 Probar notificaciones push

### Opción 1: Desde Configuración (Recomendado)

1. Instalá la PWA (o abrí la app)
2. Aceptá el permiso de notificaciones cuando aparezca
3. Creá una tarjeta con cierre/vencimiento en **2 días**
4. Esperá a que el cron se ejecute (o llamalo manualmente)

### Opción 2: Probar manualmente el endpoint

Desde la consola del navegador (F12):

```javascript
fetch('/api/send-push-notification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'TU_USER_ID', // Obtenerlo desde el perfil
    title: '🔔 Prueba de notificación',
    body: 'Esto es una notificación push de prueba',
    url: '/dashboard',
    tag: 'test-notification'
  })
}).then(r => r.json()).then(console.log)
```

O con curl:

```bash
curl -X POST https://fin.nexuno.com.ar/api/send-push-notification \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "TU_USER_ID",
    "title": "🔔 Prueba",
    "body": "Notificación de prueba",
    "url": "/dashboard"
  }'
```

---

## 📊 Tokens en Firestore

Los tokens se guardan en la colección `notification_tokens`:

```typescript
{
  id: string // Hash del endpoint
  user_id: string // Usuario dueño del token
  workspace_id?: string // Si se suscribió desde un workspace
  subscription: {
    endpoint: string // URL única del dispositivo
    keys: {
      p256dh: string
      auth: string
    }
  }
  user_agent: string // Navegador/SO
  created_at: string
  updated_at: string
}
```

**Importante**: 
- Cada dispositivo/navegador tiene su propio token
- Si el usuario usa múltiples dispositivos, habrá múltiples tokens
- Los tokens expirados se eliminan automáticamente (error 410)

---

## 🔐 Seguridad y privacidad

- Los tokens **solo** pueden ser creados por el usuario autenticado
- Los tokens **solo** pueden ser leídos por su dueño
- El **cron** puede enviar push usando Admin SDK (sin autenticación)
- Los tokens inválidos se eliminan automáticamente

---

## 🐛 Troubleshooting

### Las notificaciones no llegan

1. **Verificá que el usuario aceptó el permiso**:
   - Navegador → Configuración → Permisos → Notificaciones
   - Debe estar en "Permitir" para `fin.nexuno.com.ar`

2. **Verificá que las variables VAPID estén configuradas**:
   ```bash
   echo $NEXT_PUBLIC_VAPID_PUBLIC_KEY
   echo $VAPID_PRIVATE_KEY
   ```

3. **Verificá que el Service Worker esté activo**:
   - F12 → Application → Service Workers
   - Debe aparecer `sw.js` con estado "activated"

4. **Verificá que hay tokens en Firestore**:
   - Firebase Console → Firestore → `notification_tokens`
   - Debe haber al menos 1 documento con el `user_id` del usuario

5. **Revisá los logs del cron**:
   - Debe mostrar: `✅ [Cron] Push notification enviada: X/Y`

### El permiso no aparece

- Esperá 5 segundos después de cargar la página
- Si ya rechazaste el permiso antes:
  - Navegador → Configuración → Permisos → Notificaciones
  - Borrá `fin.nexuno.com.ar` y recargá la página

### iOS no funciona

- Verificá que estés en **Safari 16.4+** (iOS 16.4+)
- La app **debe** estar agregada a la pantalla de inicio
- Chrome/Firefox en iOS **no** soportan push

---

## 📝 Archivos modificados/creados

1. `public/sw.js` - Service Worker actualizado para push
2. `src/components/PushNotificationPermission.tsx` - Componente para pedir permiso
3. `src/app/api/send-push-notification/route.ts` - Endpoint para enviar push
4. `src/app/api/check-and-send-notifications/route.ts` - Actualizado para enviar push
5. `firestore.rules` - Reglas para `notification_tokens`
6. `src/app/layout.tsx` - Incluye el componente de permisos

---

## 🎯 Resumen

✅ **Correo**: Siempre se envía (si está configurado)  
✅ **Campanita**: Siempre se crea (visible al abrir la app)  
✅ **Push**: Se envía si el usuario aceptó el permiso (llega incluso con app cerrada)

Todas funcionan en paralelo, sin afectarse entre sí.
