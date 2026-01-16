# 🔧 Solución: Dominio de Resend para Enviar Correos

## ⚠️ Problema Actual

Resend está mostrando este error:
```
Testing domain restriction: The resend.dev domain is for testing and can only send to your own email address. 
To send to other recipients, verify a domain and update the from address to use it.
```

**Esto significa**: El dominio `onboarding@resend.dev` es solo para pruebas y solo puedes enviar correos a **tu propio email**. Para enviar a otros usuarios, necesitas verificar un dominio propio.

## ✅ Soluciones Disponibles

### Opción 1: Verificar tu Propio Dominio en Resend (Recomendado)

Esta es la mejor solución a largo plazo:

1. **Ve a Resend Dashboard** → [Domains](https://resend.com/domains)
2. **Haz clic en "Add Domain"**
3. **Ingresa tu dominio** (ej: `fincontrol.com` o un subdominio como `mail.fincontrol.com`)
4. **Resend te dará registros DNS** para agregar:
   - **SPF Record**
   - **DKIM Record** 
   - **DMARC Record** (opcional)
5. **Agrega estos registros** en tu proveedor de DNS (donde compraste el dominio)
6. **Espera la verificación** (puede tardar unos minutos a horas)
7. **Una vez verificado**, actualiza el código para usar tu dominio

**Ventajas**:
- ✅ Puedes enviar a cualquier email
- ✅ Mejor deliverability
- ✅ Más profesional
- ✅ Sin límites de destinatarios

**Desventajas**:
- ⏱️ Requiere tener un dominio propio
- ⏱️ Requiere configurar DNS

### Opción 2: Usar SendGrid (Alternativa Rápida)

Si no tienes dominio propio, puedes usar SendGrid que es más flexible:

1. **Crea cuenta en SendGrid**: [https://sendgrid.com](https://sendgrid.com)
2. **Verifica tu email** (no requiere dominio propio inicialmente)
3. **Crea una API Key**
4. **Modifica el código** para usar SendGrid en lugar de Resend

**Ventajas**:
- ✅ Funciona inmediatamente sin dominio propio
- ✅ Puedes enviar a cualquier email
- ✅ Gratis hasta 100 emails/día

### Opción 3: Usar Gmail con App Password (Temporal)

Para pruebas rápidas mientras verificas un dominio:

1. **Crea App Password en Gmail**: https://myaccount.google.com/apppasswords
2. **Usa Nodemailer** con SMTP de Gmail
3. **Configura en el código**

**Ventajas**:
- ✅ Funciona inmediatamente
- ✅ Sin configuración de dominio

**Desventajas**:
- ⚠️ Límites de Gmail (500 emails/día)
- ⚠️ Puede ir a spam más fácilmente

### Opción 4: Solución Temporal - Solo Invitaciones en la App

Mientras verificas un dominio, puedes:

1. **La invitación se crea en Firestore** (esto ya funciona)
2. **El usuario puede ver la invitación** en la página de Configuración
3. **El correo no se envía**, pero el usuario puede aceptar desde la app

**Ventajas**:
- ✅ Funciona inmediatamente
- ✅ No requiere configuración adicional

**Desventajas**:
- ⚠️ El usuario debe entrar a la app para ver la invitación
- ⚠️ No recibe notificación por email

## 🚀 Implementación Rápida: Verificar Dominio en Resend

### Paso 1: Tener un Dominio

Si no tienes dominio:
- Compra uno en: Namecheap, GoDaddy, Google Domains, etc.
- O usa un subdominio de un dominio que ya tengas

### Paso 2: Agregar Dominio en Resend

1. Ve a [Resend Dashboard → Domains](https://resend.com/domains)
2. Haz clic en **"Add Domain"**
3. Ingresa tu dominio (ej: `mail.tudominio.com`)
4. Copia los registros DNS que te da Resend

### Paso 3: Configurar DNS

1. Ve a tu proveedor de DNS (donde compraste el dominio)
2. Agrega los registros que Resend te dio:
   - **Tipo**: TXT
   - **Nombre**: `@` o el subdominio
   - **Valor**: El valor que Resend te dio
3. Guarda los cambios
4. Espera a que se propague (puede tardar hasta 24 horas, pero usualmente es más rápido)

### Paso 4: Actualizar el Código

Una vez verificado, actualiza el código para usar tu dominio:

```typescript
// En src/app/api/send-invitation/route.ts
const emailFrom = 'FinControl <noreply@tudominio.com>'
```

## 📝 Código Actualizado

El código ya está preparado para manejar este error. Cuando Resend rechaza el envío por restricción de dominio:

1. ✅ La invitación **se crea correctamente** en Firestore
2. ✅ El usuario puede ver la invitación en la app
3. ⚠️ El correo no se envía, pero se muestra un mensaje claro

## 🔍 Verificar Estado Actual

Para ver si tu dominio está verificado:

1. Ve a [Resend Dashboard → Domains](https://resend.com/domains)
2. Busca tu dominio en la lista
3. Si dice "Verified" ✅, puedes usarlo
4. Si dice "Pending" ⏳, espera a que se verifique

## 💡 Recomendación

**Para producción**: Verifica un dominio propio en Resend (Opción 1)
**Para desarrollo/pruebas**: Usa la Opción 4 (solo invitaciones en app) mientras verificas el dominio

## 🔗 Enlaces Útiles

- [Resend Domains](https://resend.com/domains)
- [Resend Domain Verification Guide](https://resend.com/docs/dashboard/domains/introduction)
- [SendGrid Alternative](https://sendgrid.com)
