# 📧 Guía Completa para Configurar Resend

## ¿Qué es Resend?

Resend es un servicio de envío de correos electrónicos moderno y simple. Es perfecto para aplicaciones porque:
- ✅ **Gratis hasta 3,000 emails/mes**
- ✅ **API simple y directa**
- ✅ **No requiere configuración compleja de permisos**
- ✅ **Funciona inmediatamente**
- ✅ **Mejor deliverability que Gmail**

## 🚀 Paso 1: Crear Cuenta en Resend

1. Ve a [https://resend.com](https://resend.com)
2. Haz clic en **"Sign Up"** o **"Get Started"**
3. Crea una cuenta con tu email
4. Verifica tu email (revisa tu bandeja de entrada)

## 🔑 Paso 2: Obtener API Key

1. Una vez que inicies sesión, ve al **Dashboard**
2. En el menú lateral, busca **"API Keys"** o ve directamente a: [https://resend.com/api-keys](https://resend.com/api-keys)
3. Haz clic en **"Create API Key"**
4. Configura:
   - **Name**: `FinControl` (o el nombre que prefieras)
   - **Permission**: Selecciona **"Full Access"** (o solo "Sending access" si prefieres más restricción)
5. Haz clic en **"Add"**
6. **IMPORTANTE**: Copia la API Key inmediatamente. Se muestra solo una vez y tiene este formato:
   ```
   re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

## ⚙️ Paso 3: Configurar en tu Proyecto

### Opción A: Archivo `.env.local` (Desarrollo Local)

1. Abre el archivo `.env.local` en la raíz de tu proyecto
2. Si no existe, créalo
3. Agrega esta línea:
   ```env
   RESEND_API_KEY=re_tu_api_key_aqui
   ```
4. Reemplaza `re_tu_api_key_aqui` con la API Key que copiaste

**Ejemplo:**
```env
RESEND_API_KEY=re_AbCdEfGhIjKlMnOpQrStUvWxYz123456789
```

### Opción B: Variables de Entorno en Producción

Si estás usando **Vercel**, **Netlify**, u otro servicio de hosting:

1. Ve a la configuración de tu proyecto
2. Busca la sección **"Environment Variables"** o **"Variables de Entorno"**
3. Agrega una nueva variable:
   - **Name**: `RESEND_API_KEY`
   - **Value**: `re_tu_api_key_aqui`
4. Guarda los cambios
5. **Reinicia el servidor** si es necesario

## 📧 Paso 4: Verificar Dominio (Opcional pero Recomendado)

Por defecto, Resend te permite enviar correos desde `onboarding@resend.dev`, pero es mejor usar tu propio dominio.

### Para usar tu propio dominio:

1. En Resend Dashboard, ve a **"Domains"**
2. Haz clic en **"Add Domain"**
3. Ingresa tu dominio (ej: `fincontrol.com`)
4. Resend te dará registros DNS para agregar:
   - **SPF Record**
   - **DKIM Record**
   - **DMARC Record** (opcional)
5. Agrega estos registros en tu proveedor de DNS (donde compraste el dominio)
6. Espera a que se verifique (puede tardar unos minutos)

**Nota**: Si no tienes dominio propio, puedes usar `onboarding@resend.dev` para pruebas.

## ✅ Paso 5: Probar que Funciona

1. **Reinicia tu servidor de desarrollo** si está corriendo:
   ```bash
   # Detén el servidor (Ctrl+C) y vuelve a iniciarlo
   npm run dev
   ```

2. **Envía una invitación de prueba:**
   - Ve a tu app
   - Intenta invitar a un usuario (puede ser tu propio email)
   - Abre la consola del navegador (F12) y busca mensajes que empiecen con `📧` o `✅`

3. **Revisa tu email:**
   - El correo debería llegar en unos segundos
   - Revisa también la carpeta de spam la primera vez

4. **Revisa los logs de Resend:**
   - Ve a Resend Dashboard → **"Logs"**
   - Deberías ver el correo enviado con su estado (delivered, bounced, etc.)

## 🐛 Solución de Problemas

### Error: "RESEND_API_KEY no está configurada"

**Causa**: La variable de entorno no está configurada correctamente.

**Solución**:
1. Verifica que el archivo `.env.local` existe y tiene `RESEND_API_KEY=...`
2. Reinicia el servidor de desarrollo
3. Verifica que no hay espacios extra en la API Key
4. En producción, verifica que la variable de entorno esté configurada correctamente

### Error: "Invalid API key"

**Causa**: La API Key es incorrecta o fue revocada.

**Solución**:
1. Ve a Resend Dashboard → API Keys
2. Verifica que la API Key existe y está activa
3. Si es necesario, crea una nueva API Key
4. Actualiza la variable de entorno con la nueva key

### Los correos no llegan

**Causa**: Puede ser varios problemas.

**Solución**:
1. Revisa los logs en Resend Dashboard → Logs
2. Verifica que el email de destino sea válido
3. Revisa la carpeta de spam
4. Si usas dominio propio, verifica que los registros DNS estén correctos

### Error en la consola del navegador

**Causa**: Problema con la API route o la configuración.

**Solución**:
1. Abre la consola del navegador (F12)
2. Ve a la pestaña "Network"
3. Busca la petición a `/api/send-invitation`
4. Haz clic y revisa la respuesta para ver el error específico

## 📊 Monitoreo y Estadísticas

Resend te permite ver:
- **Logs de envíos**: Ve a Dashboard → Logs
- **Estadísticas**: Ve a Dashboard → Analytics
- **Límites**: Ve a Dashboard → Settings

## 💰 Planes y Límites

- **Plan Gratuito**: 3,000 emails/mes
- **Plan Pro**: Desde $20/mes para más emails

Para la mayoría de aplicaciones, el plan gratuito es suficiente.

## 🔒 Seguridad

- **Nunca** compartas tu API Key públicamente
- **Nunca** subas `.env.local` a Git (debería estar en `.gitignore`)
- Si tu API Key se compromete, revócala inmediatamente en Resend Dashboard

## 📝 Checklist Final

- [ ] Cuenta creada en Resend
- [ ] API Key obtenida y copiada
- [ ] Variable `RESEND_API_KEY` agregada a `.env.local`
- [ ] Servidor reiniciado
- [ ] Invitación de prueba enviada
- [ ] Correo recibido correctamente
- [ ] Logs verificados en Resend Dashboard

## 🎉 ¡Listo!

Una vez completados estos pasos, tu aplicación debería estar enviando correos correctamente usando Resend. Es mucho más simple que configurar la extensión de Firebase y funciona inmediatamente.

## 🔗 Enlaces Útiles

- [Resend Dashboard](https://resend.com/dashboard)
- [Documentación de Resend](https://resend.com/docs)
- [API Keys](https://resend.com/api-keys)
- [Logs](https://resend.com/emails)

## 📞 Si Necesitas Ayuda

1. Revisa los logs en Resend Dashboard
2. Revisa la consola del navegador para errores
3. Verifica que la API Key esté correctamente configurada
4. Consulta la [documentación oficial de Resend](https://resend.com/docs)
