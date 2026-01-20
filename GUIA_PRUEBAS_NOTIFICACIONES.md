# 🔔 Guía para probar notificaciones - FinControl

Esta guía explica cómo probar las **notificaciones por correo** y las **notificaciones en la campanita** (centro de notificaciones in-app).

---

## 1. Probar notificaciones por correo

Las notificaciones por correo se envían para **cierre de tarjetas** y **vencimiento de pago** (2 días antes del evento). Podés probar los correos sin esperar al cron.

### Opción A: Desde Configuración (recomendado)

1. Entrá a **Dashboard → Configuración**
2. En la sección **🔔 Probar notificaciones**
3. Elegí el **tipo**: "Cierre de tarjeta" o "Vencimiento de pago"
4. Ingresá tu **email** (o el que quieras usar para la prueba)
5. Tocá **Enviar correo de prueba**
6. Revisá la bandeja de entrada (y spam). El asunto tendrá el prefijo `[PRUEBA]`

### Opción B: Con curl

```bash
# Cierre de tarjeta
curl -X POST https://fin.nexuno.com.ar/api/send-test-notification \
  -H "Content-Type: application/json" \
  -d '{"tipo": "cierre", "email": "tu-email@ejemplo.com"}'

# Vencimiento de pago
curl -X POST https://fin.nexuno.com.ar/api/send-test-notification \
  -H "Content-Type: application/json" \
  -d '{"tipo": "vencimiento", "email": "tu-email@ejemplo.com"}'
```

### Opción C: Desde la consola del navegador

Con la app abierta (cualquier página), abrí la consola (F12) y ejecutá:

```javascript
// Cierre
fetch('/api/send-test-notification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tipo: 'cierre', email: 'tu-email@ejemplo.com' })
}).then(r => r.json()).then(console.log)

// Vencimiento
fetch('/api/send-test-notification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tipo: 'vencimiento', email: 'tu-email@ejemplo.com' })
}).then(r => r.json()).then(console.log)
```

---

## 2. Probar la campanita (notificaciones in-app)

La campanita 🔔 en la barra superior muestra notificaciones de **cierre**, **vencimiento**, **presupuesto** y **sistema**. Podés crear una notificación de prueba para verificar que todo funcione.

### Opción A: Desde Configuración (recomendado)

1. Entrá a **Dashboard → Configuración**
2. En la sección **🔔 Probar notificaciones**
3. Tocá **Crear notificación de prueba (campanita)**
4. Abrí la campanita en la barra superior: deberías ver una notificación **"[Prueba] Notificación de prueba"**

**Nota:** Si tenés un workspace seleccionado, la notificación se crea para ese workspace. Si estás en **Espacio Personal**, se crea para tu cuenta. En ambos casos aparecerá en la campanita.

### Opción B: Flujo real (cron + tarjetas)

Para probar el flujo completo:

1. Creá una **tarjeta** en Cuentas con:
   - Día de cierre y/o vencimiento = **dentro de 2 días** (ej.: si hoy es 13, poné 15)
   - Activa **Recordar cierre** y/o **Recordar vencimiento**
2. Configurá un **cron** que llame a `/api/check-and-send-notifications` con el header `Authorization: Bearer CRON_SECRET` (ver `NOTIFICACIONES_INSTRUCCIONES.md`).
3. El día correspondiente, el cron creará la notificación en Firestore **y** enviará el correo. La campanita se actualiza en tiempo real.

---

## 3. Resumen rápido

| Qué probar     | Dónde                         | Acción                                                                 |
|----------------|-------------------------------|------------------------------------------------------------------------|
| Correo cierre  | Config → Probar notificaciones | Tipo "Cierre" + email + Enviar correo de prueba                        |
| Correo venc.   | Config → Probar notificaciones | Tipo "Vencimiento" + email + Enviar correo de prueba                   |
| Campanita      | Config → Probar notificaciones | Crear notificación de prueba (campanita) → abrir 🔔 en la barra        |

---

## 4. Requisitos para que funcione

- **Correo:** `RESEND_API_KEY` y `RESEND_FROM_EMAIL` configurados.
- **Campanita:** Firestore con la colección `notificaciones` y reglas que permitan `create` con `user_id == auth.uid` (o `workspace_id` si aplica).
- **Cron (flujo real):** `CRON_SECRET`, `FIREBASE_SERVICE_ACCOUNT_KEY`, `NEXT_PUBLIC_APP_URL` y el cron apuntando a `/api/check-and-send-notifications`.

Más detalles en `NOTIFICACIONES_INSTRUCCIONES.md`.
