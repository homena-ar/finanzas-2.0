# 🔔 Sistema de Notificaciones - FinControl

## Características Implementadas

### ✅ Notificaciones por Correo
- **Cierre de tarjetas**: Se envía un correo 2 días antes del cierre
- **Vencimiento de pago**: Se envía un correo 2 días antes del vencimiento
- Solo se envían si el usuario tiene habilitada la opción en la configuración de la tarjeta

### ✅ Centro de Notificaciones
- **Componente tipo Facebook**: Campana de notificaciones en la parte superior derecha
- Muestra todas las notificaciones (correo + alertas del sistema)
- Contador de notificaciones no leídas
- Marcar como leída / Marcar todas como leídas
- Enlaces directos a las secciones relevantes

### ✅ Notificaciones Automáticas
- Las alertas del resumen ahora se convierten en notificaciones
- Se generan automáticamente cuando:
  - Una tarjeta cierra hoy o mañana
  - Un pago vence hoy, mañana o venció ayer
  - El presupuesto está cerca del límite o excedido

## 📧 Cómo Enviar Correos de Prueba

### Opción 1: Usando la API directamente

Puedes hacer una petición POST a la API de prueba:

```bash
curl -X POST https://fin.nexuno.com.ar/api/send-test-notification \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "cierre",
    "email": "tu-email@ejemplo.com"
  }'
```

O para vencimiento:

```bash
curl -X POST https://fin.nexuno.com.ar/api/send-test-notification \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "vencimiento",
    "email": "tu-email@ejemplo.com"
  }'
```

### Opción 2: Desde el navegador (DevTools)

Abre la consola del navegador (F12) y ejecuta:

```javascript
fetch('/api/send-test-notification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tipo: 'cierre', // o 'vencimiento'
    email: 'tu-email@ejemplo.com'
  })
})
.then(r => r.json())
.then(console.log)
```

## ⏰ Configurar Cron Job para Notificaciones Automáticas

El sistema incluye un endpoint que verifica y envía notificaciones automáticamente. Debes configurar un cron job que lo llame diariamente.

### Usando Railway Cron Jobs

Si estás usando Railway, puedes agregar un cron job en `railway.json`:

```json
{
  "cron": {
    "check-notifications": {
      "schedule": "0 9 * * *",
      "command": "curl -X GET https://tu-dominio.com/api/check-and-send-notifications -H 'Authorization: Bearer TU_SECRET_KEY'"
    }
  }
}
```

### Usando un servicio externo (cron-job.org, EasyCron, etc.)

1. Crea una cuenta en un servicio de cron jobs
2. Configura una tarea diaria que llame a:
   ```
   GET https://fin.nexuno.com.ar/api/check-and-send-notifications
   Authorization: Bearer TU_SECRET_KEY
   ```
3. Establece la hora (recomendado: 9:00 AM hora local)

### Variable de Entorno

Asegúrate de tener configurada la variable de entorno:

```env
CRON_SECRET=tu-secret-key-super-segura
```

## 🔧 Configuración de Tarjetas

Para que una tarjeta envíe notificaciones:

1. Ve a **Cuentas** en el dashboard
2. Edita la tarjeta
3. En la sección **🔔 Notificaciones por correo**:
   - ✅ Marca "Recordar cierre" para recibir correos 2 días antes del cierre
   - ✅ Marca "Recordar vencimiento" para recibir correos 2 días antes del vencimiento

## 📱 Uso del Centro de Notificaciones

1. **Ver notificaciones**: Haz clic en la campana 🔔 en la parte superior derecha
2. **Marcar como leída**: Haz clic en el ícono ✓ de cada notificación
3. **Marcar todas como leídas**: Usa el botón en el header del dropdown
4. **Ir a la sección**: Haz clic en "Ver más →" de cualquier notificación

## 🗄️ Estructura de Datos

Las notificaciones se guardan en Firestore en la colección `notificaciones` con la siguiente estructura:

```typescript
{
  user_id: string
  tipo: 'cierre' | 'vencimiento' | 'presupuesto' | 'sistema'
  titulo: string
  mensaje: string
  icono: string
  leida: boolean
  tarjeta_id?: string
  fecha_evento?: Timestamp
  link?: string
  workspace_id?: string (si está en un workspace)
  created_at: Timestamp
}
```

## 🔐 Seguridad

- El endpoint de cron job requiere autenticación con `CRON_SECRET`
- Las notificaciones solo se crean para el usuario correspondiente
- Los correos se envían solo a usuarios que tienen habilitadas las notificaciones

## 🐛 Troubleshooting

### Los correos no se envían
1. Verifica que `RESEND_API_KEY` esté configurada
2. Verifica que `RESEND_FROM_EMAIL` esté configurada
3. Revisa los logs del servidor

### Las notificaciones no aparecen
1. Verifica que el usuario esté autenticado
2. Revisa la consola del navegador para errores
3. Verifica que la colección `notificaciones` exista en Firestore

### El cron job no funciona
1. Verifica que `CRON_SECRET` esté configurada
2. Verifica que la URL del endpoint sea correcta
3. Revisa los logs del servicio de cron

## 📝 Notas

- Las notificaciones se envían **2 días antes** del evento
- Las notificaciones del sistema (alertas) se generan automáticamente al cargar el dashboard
- Los correos de prueba tienen el prefijo `[PRUEBA]` en el asunto
