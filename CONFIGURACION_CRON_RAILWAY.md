# ⏰ Configuración de Cron Job en Railway

## Variables de Entorno Requeridas

Asegúrate de tener estas variables configuradas en Railway:

### Variables Obligatorias

1. **`CRON_SECRET`** o **`CRON_SECRET_KEY`**
   - Clave secreta para autenticar las llamadas al cron job
   - Debe ser una cadena aleatoria y segura
   - Ejemplo: `cron_secret_abc123xyz789`

2. **`CHECK_NOTIFICATIONS_URL`** (opcional)
   - URL completa del endpoint de notificaciones
   - Si no se configura, se usa `NEXT_PUBLIC_APP_URL + '/api/check-and-send-notifications'`
   - Ejemplo: `https://fin.nexuno.com.ar/api/check-and-send-notifications`

3. **`NEXT_PUBLIC_APP_URL`**
   - URL base de tu aplicación
   - Ejemplo: `https://fin.nexuno.com.ar`

### Variables para Envío de Correos

4. **`RESEND_API_KEY`**
   - API Key de Resend para enviar correos
   - Obtener de: https://resend.com/api-keys

5. **`RESEND_FROM_EMAIL`** (opcional)
   - Email desde el cual se envían los correos
   - Por defecto: `noreply@fin.nexuno.com.ar`

## Configuración en Railway

### Opción 1: Usando railway.json (Recomendado)

El archivo `railway.json` ya está configurado con:

```json
{
  "cron": {
    "check-notifications": {
      "schedule": "0 9 * * *",
      "command": "node cron/check-notifications.js"
    }
  }
}
```

Esto ejecutará el cron job todos los días a las 9:00 AM UTC.

### Opción 2: Configuración Manual en Railway Dashboard

1. Ve a tu proyecto en Railway
2. Ve a la sección **Cron Jobs**
3. Crea un nuevo cron job con:
   - **Nombre**: `check-notifications`
   - **Schedule**: `0 9 * * *` (9:00 AM UTC diariamente)
   - **Command**: `node cron/check-notifications.js`

### Ajustar la Hora del Cron Job

El formato es `minuto hora día mes día-semana` (cron estándar):

- `0 9 * * *` - Todos los días a las 9:00 AM UTC
- `0 12 * * *` - Todos los días a las 12:00 PM UTC
- `0 9 * * 1-5` - Lunes a Viernes a las 9:00 AM UTC

Para hora local de Argentina (UTC-3):
- `0 12 * * *` en UTC = 9:00 AM hora Argentina

## Verificación

### Probar el Cron Job Manualmente

Puedes probar el cron job manualmente ejecutando:

```bash
node cron/check-notifications.js
```

O haciendo una petición directa al endpoint:

```bash
curl -X GET https://fin.nexuno.com.ar/api/check-and-send-notifications \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

### Ver Logs en Railway

1. Ve a tu proyecto en Railway
2. Ve a la sección **Deployments**
3. Selecciona el deployment más reciente
4. Ve a la pestaña **Logs**
5. Busca los logs del cron job con el prefijo `🔔 [Cron]`

## Troubleshooting

### El cron job no se ejecuta

1. Verifica que las variables de entorno estén configuradas
2. Verifica que el archivo `cron/check-notifications.js` exista
3. Verifica que Node.js esté disponible en el entorno
4. Revisa los logs en Railway

### Error: "No autorizado"

1. Verifica que `CRON_SECRET` o `CRON_SECRET_KEY` esté configurada
2. Verifica que el valor sea el mismo en Railway y en el código
3. Verifica que el header `Authorization: Bearer ...` esté presente

### Error: "Perfil no encontrado"

1. Verifica que los usuarios tengan perfiles creados en Firestore
2. Verifica que el `user_id` en las tarjetas coincida con el `id` en los perfiles
3. Revisa los logs para ver qué `user_id` está causando el problema

### Los correos no se envían

1. Verifica que `RESEND_API_KEY` esté configurada
2. Verifica que `RESEND_FROM_EMAIL` esté configurada y verificada en Resend
3. Revisa los logs del endpoint `/api/send-notification-email`

## Estructura de Archivos

```
finanzas-2.0/
├── cron/
│   └── check-notifications.js    # Script del cron job
├── src/
│   └── app/
│       └── api/
│           └── check-and-send-notifications/
│               └── route.ts       # Endpoint del cron job
└── railway.json                   # Configuración de Railway
```

## Notas Importantes

- El cron job se ejecuta en el servidor, no en el cliente
- Las notificaciones se envían **2 días antes** del evento
- Solo se envían notificaciones para tarjetas con `notificar_cierre` o `notificar_vencimiento` habilitado
- Las notificaciones también se crean en Firestore para aparecer en el centro de notificaciones
