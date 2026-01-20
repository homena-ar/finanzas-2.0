# 🚀 Setup de Notificaciones Push - Guía Rápida

Seguí estos pasos **en orden** para activar las notificaciones push en FinControl.

---

## 📋 Paso 1: Instalar dependencia

```bash
npm install web-push
```

---

## 🔑 Paso 2: Generar claves VAPID

```bash
npx web-push generate-vapid-keys
```

**Output esperado**:
```
=======================================

Public Key:
BNxxx...xxx

Private Key:
yyy...yyy

=======================================
```

**Copiá ambas claves**, las vas a necesitar en el siguiente paso.

---

## ⚙️ Paso 3: Configurar variables de entorno

### En desarrollo (`.env.local`)

Creá o editá el archivo `.env.local` y agregá:

```bash
# Claves VAPID (del paso anterior)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BNxxx...xxx
VAPID_PRIVATE_KEY=yyy...yyy
VAPID_SUBJECT=mailto:tu-email@ejemplo.com
```

### En producción (Railway)

1. Entrá a **Railway → Tu proyecto → Variables**
2. Agregá estas 3 variables:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = `BNxxx...xxx`
   - `VAPID_PRIVATE_KEY` = `yyy...yyy`
   - `VAPID_SUBJECT` = `mailto:noreply@fin.nexuno.com.ar`

**Importante**: 
- La clave **pública** lleva el prefijo `NEXT_PUBLIC_` (se usa en el navegador)
- La clave **privada** **NO** lleva prefijo (solo en el servidor)

---

## 🔥 Paso 4: Desplegar reglas de Firestore

Las reglas de Firestore ya están actualizadas en el archivo `firestore.rules`, solo falta desplegarlas:

```bash
firebase deploy --only firestore:rules
```

**Output esperado**:
```
✔  firestore: released rules firestore.rules to cloud.firestore
```

---

## 🔄 Paso 5: Reiniciar la app

### En desarrollo
```bash
npm run dev
```

### En producción (Railway)

Railway detecta los cambios automáticamente y redeploya. O forzá un redeploy:

1. Railway → Deploy → Redeploy

---

## ✅ Paso 6: Probar

1. **Abrí la app** (o instalá la PWA)
2. **Esperá 5 segundos** → aparece el aviso "¿Activar notificaciones?"
3. **Hacé clic en "Activar"** → el navegador pide permiso
4. **Aceptá el permiso** → listo ✅

### Verificar que funciona

1. Creá una **tarjeta** en Cuentas con:
   - Cierre o vencimiento = **dentro de 2 días**
   - Activá "Recordar cierre" o "Recordar vencimiento"

2. Ejecutá el cron manualmente (o esperá a que se ejecute solo):
   ```bash
   curl -X GET https://fin.nexuno.com.ar/api/check-and-send-notifications \
     -H "Authorization: Bearer TU_CRON_SECRET"
   ```

3. **Deberías recibir**:
   - ✅ Correo
   - ✅ Notificación en la campanita
   - ✅ **Notificación push nativa** (incluso con la app cerrada)

---

## 🎯 Resumen de archivos

| Archivo | Qué hace |
|---------|----------|
| `public/sw.js` | Service Worker que recibe las notificaciones push |
| `src/components/PushNotificationPermission.tsx` | Muestra el aviso para pedir permiso |
| `src/app/api/send-push-notification/route.ts` | Envía notificaciones push |
| `src/app/api/check-and-send-notifications/route.ts` | Cron que envía correo + campanita + push |
| `firestore.rules` | Permisos para la colección `notification_tokens` |

---

## 🐛 Troubleshooting

### "VAPID keys no configuradas"

- Verificá que las variables estén en Railway/`.env.local`
- Verificá que `NEXT_PUBLIC_VAPID_PUBLIC_KEY` tenga el prefijo `NEXT_PUBLIC_`
- Reiniciá la app

### "El permiso no aparece"

- Esperá 5 segundos después de cargar
- Si ya rechazaste antes: Navegador → Configuración → Permisos → Notificaciones → Borrar `fin.nexuno.com.ar`

### "Las notificaciones no llegan"

1. Verificá que aceptaste el permiso (Configuración del navegador)
2. Verificá que el Service Worker esté activo (F12 → Application → Service Workers)
3. Revisá los logs del cron (debe decir "Push notification enviada")

---

## 📖 Documentación completa

Ver `NOTIFICACIONES_PUSH.md` para más detalles, compatibilidad por plataforma, estructura de tokens, etc.
