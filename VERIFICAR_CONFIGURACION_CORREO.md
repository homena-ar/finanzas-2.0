# 📧 Verificar Configuración del Correo

## ✅ La Extensión ya está Instalada

Bien, la extensión Trigger Email ya está instalada sin errores. Ahora necesitas configurarla para que envíe correos.

## 🔧 Pasos para Configurar el Envío de Correos

### Paso 1: Configurar SMTP en la Extensión

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto **finanzas-familia-4e140**
3. Ve a **Extensions** en el menú lateral
4. Haz clic en la extensión **Trigger Email** (o "Send emails via SMTP")
5. Haz clic en **"Configuration"** o **"Config"**
6. Busca el campo **"SMTP Connection URI"**

### Paso 2: Elegir un Proveedor de Correo

Tienes varias opciones. Te recomiendo empezar con **Gmail** para pruebas:

#### Opción A: Gmail (Más fácil para empezar)

1. **Crear App Password en Google:**
   - Ve a: https://myaccount.google.com/apppasswords
   - Si no ves la opción, primero habilita la verificación en 2 pasos
   - Selecciona "Correo" y "Otro (nombre personalizado)"
   - Escribe "FinControl" y haz clic en "Generar"
   - **Copia la contraseña** (16 caracteres sin espacios)

2. **Configurar en Firebase:**
   - En el campo **"SMTP Connection URI"**, ingresa:
   ```
   smtps://tu-email@gmail.com:TU_APP_PASSWORD@smtp.gmail.com:465
   ```
   - Reemplaza:
     - `tu-email@gmail.com` con tu email de Gmail
     - `TU_APP_PASSWORD` con la contraseña de 16 caracteres que copiaste
   
   Ejemplo:
   ```
   smtps://matias@gmail.com:abcd efgh ijkl mnop@smtp.gmail.com:465
   ```
   **IMPORTANTE**: Si la contraseña tiene espacios, quítalos o reemplázalos con `%20`

3. **Configurar "Default FROM address":**
   - Ingresa tu email de Gmail: `tu-email@gmail.com`

4. **Guardar** la configuración

#### Opción B: SendGrid (Recomendado para producción)

1. **Crear cuenta en SendGrid:**
   - Ve a [https://sendgrid.com](https://sendgrid.com)
   - Crea una cuenta gratuita (hasta 100 emails/día gratis)
   - Verifica tu email

2. **Crear API Key:**
   - En el dashboard, ve a **Settings** → **API Keys**
   - Haz clic en **"Create API Key"**
   - Nombre: "FinControl"
   - Permisos: **"Full Access"** o al menos **"Mail Send"**
   - **Copia la API Key** (solo se muestra una vez)

3. **Configurar en Firebase:**
   - En **"SMTP Connection URI"**:
   ```
   smtps://apikey:TU_API_KEY@smtp.sendgrid.net:465
   ```
   - Reemplaza `TU_API_KEY` con la API Key que copiaste
   
   - En **"Default FROM address"**: Tu email verificado en SendGrid

4. **Guardar** la configuración

### Paso 3: Verificar que Funciona

1. **Enviar una invitación de prueba:**
   - Ve a tu app
   - Intenta invitar a un usuario (puede ser tu propio email de prueba)
   - Revisa la consola del navegador (F12) para ver si hay errores

2. **Verificar en Firestore:**
   - Ve a Firebase Console → **Firestore Database**
   - Busca la colección `mail`
   - Deberías ver documentos creados cuando envías invitaciones
   - Si los documentos se crean pero no llegan correos, el problema está en la configuración SMTP

3. **Revisar logs de la extensión:**
   - En Firebase Console, ve a **Functions**
   - Busca funciones relacionadas con "email" o "mail"
   - Revisa los logs para ver errores

## 🐛 Problemas Comunes

### Los documentos se crean en `mail` pero no llegan correos

**Causa**: Configuración SMTP incorrecta

**Solución**:
1. Verifica que el formato del SMTP Connection URI sea correcto
2. Verifica que las credenciales sean válidas
3. Para Gmail, asegúrate de usar App Password, no tu contraseña normal
4. Revisa los logs de la extensión en Functions

### Error: "Invalid login"

**Causa**: Credenciales incorrectas

**Solución**:
- Para Gmail: Verifica que estés usando App Password, no tu contraseña
- Para SendGrid: Verifica que la API Key sea correcta y tenga permisos

### Error: "Connection timeout"

**Causa**: Puerto o servidor SMTP incorrecto

**Solución**:
- Para Gmail: Usa puerto `465` con `smtps://`
- Para SendGrid: Usa `smtp.sendgrid.net:465`

## 📝 Checklist de Verificación

- [ ] Extensión Trigger Email instalada
- [ ] SMTP Connection URI configurado correctamente
- [ ] Default FROM address configurado
- [ ] Documentos se crean en la colección `mail` cuando envías invitación
- [ ] Los correos llegan al destinatario
- [ ] Revisaste los logs de la extensión si hay problemas

## 🔍 Cómo Verificar que los Correos se Están Enviando

1. **Revisa Firestore:**
   - Ve a `mail` collection
   - Los documentos deberían tener un campo `delivery` o `status` que cambia cuando se envía

2. **Revisa los logs:**
   - Firebase Console → Functions → Logs
   - Busca errores relacionados con email

3. **Prueba con tu propio email:**
   - Invítate a ti mismo
   - Revisa tu bandeja de entrada y spam

## 💡 Consejos

- **Para desarrollo**: Usa Gmail con App Password (más fácil)
- **Para producción**: Usa SendGrid o Mailgun (más confiable)
- **Revisa spam**: Los correos pueden ir a spam la primera vez
- **Espera unos minutos**: A veces hay un pequeño delay

## 📞 Si Sigue Sin Funcionar

1. Verifica que el formato del SMTP URI sea exactamente como se muestra arriba
2. Revisa los logs de Functions en Firebase Console
3. Prueba con otro proveedor (SendGrid si usas Gmail, o viceversa)
4. Verifica que el email de destino sea válido
