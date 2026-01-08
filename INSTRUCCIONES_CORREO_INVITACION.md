# 🔧 Instrucciones para Solucionar el Problema de Correos de Invitación

## Problema
Los correos de invitación no están llegando a los destinatarios.

## ✅ Cambios Realizados en el Código

1. **Formato del documento de correo mejorado** (`src/hooks/useWorkspace.tsx`):
   - Cambiado `to: email` a `to: [email]` (array requerido por la extensión)
   - Agregado campo `from` con el email del remitente
   - Mejorado el manejo de errores con try-catch específico
   - Agregado logging para debugging

2. **Reglas de seguridad actualizadas** (`firestore.rules`):
   - Las reglas permiten crear documentos de correo para usuarios autenticados
   - La extensión Trigger Email usa service accounts y no está sujeta a estas reglas

## 🔍 Verificaciones Necesarias en Firebase Console

### 1. Verificar que la Extensión Trigger Email esté Instalada

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Extensions** en el menú lateral
4. Busca **"Trigger Email"** o **"Send emails via SMTP"**
5. Si NO está instalada:
   - Haz clic en **"Browse all extensions"** o **"Add extension"**
   - Busca **"Trigger Email"** (extensión oficial de Firebase)
   - Instálala siguiendo las instrucciones

### 2. Configurar la Extensión Trigger Email

Si la extensión está instalada, verifica su configuración:

1. En **Extensions**, haz clic en la extensión **Trigger Email**
2. Verifica la configuración:
   - **SMTP Connection URI**: Debe estar configurado con tu proveedor de correo (Gmail, SendGrid, Mailgun, etc.)
   - **Default FROM address**: Debe tener un email válido
   - **Default REPLY-TO address**: Opcional pero recomendado

### 3. Configurar un Proveedor de Correo

La extensión necesita un servicio SMTP para enviar correos. Opciones comunes:

#### Opción A: Gmail (Para desarrollo/testing)
```
smtps://tu-email@gmail.com:tu-app-password@smtp.gmail.com:465
```
- Necesitas crear una "App Password" en tu cuenta de Google
- Ve a: https://myaccount.google.com/apppasswords

#### Opción B: SendGrid (Recomendado para producción)
1. Crea cuenta en [SendGrid](https://sendgrid.com/)
2. Crea una API Key
3. Usa el formato SMTP de SendGrid:
```
smtps://apikey:TU_API_KEY@smtp.sendgrid.net:465
```

#### Opción C: Mailgun
1. Crea cuenta en [Mailgun](https://www.mailgun.com/)
2. Obtén las credenciales SMTP
3. Configura en la extensión

### 4. Verificar los Logs de la Extensión

1. En Firebase Console, ve a **Functions** (si la extensión creó funciones)
2. O ve a **Firestore** → **mail** collection
3. Verifica que los documentos se estén creando correctamente
4. Revisa los logs de la extensión para ver errores

### 5. Verificar en Firestore

1. Ve a **Firestore Database** en Firebase Console
2. Busca la colección `mail`
3. Verifica que se estén creando documentos cuando envías una invitación
4. Revisa el contenido de los documentos:
   - Debe tener `to` como array
   - Debe tener `message` con `subject`, `html`, `text`
   - Debe tener `from` (opcional pero recomendado)

### 6. Verificar Reglas de Seguridad

1. Ve a **Firestore Database** → **Rules**
2. Verifica que las reglas para la colección `mail` permitan crear documentos:
```javascript
match /mail/{mailId} {
  allow create: if request.auth != null;
  allow read, update, delete: if request.auth != null;
}
```

## 🐛 Debugging

### Verificar en la Consola del Navegador

1. Abre las herramientas de desarrollador (F12)
2. Ve a la pestaña **Console**
3. Intenta enviar una invitación
4. Busca mensajes que empiecen con:
   - `📧 [useWorkspace] Enviando email de invitación a:`
   - `✅ [useWorkspace] Documento de correo creado con ID:`
   - `❌ [useWorkspace] Error al crear documento de correo:`

### Verificar en Firebase Console

1. Ve a **Firestore Database** → **mail**
2. Verifica que los documentos se creen cuando envías una invitación
3. Si los documentos se crean pero no se envían correos:
   - El problema está en la configuración de la extensión
   - Revisa los logs de la extensión
   - Verifica las credenciales SMTP

## 📝 Checklist de Verificación

- [ ] Extensión Trigger Email instalada en Firebase
- [ ] Extensión configurada con SMTP válido
- [ ] Documentos se crean en la colección `mail` cuando envías invitación
- [ ] Logs de la extensión no muestran errores
- [ ] Reglas de seguridad permiten crear documentos en `mail`
- [ ] El formato del documento incluye `to` como array
- [ ] El formato del documento incluye `from`
- [ ] El formato del documento incluye `message.subject`, `message.html`, `message.text`

## 🚨 Problemas Comunes

### Los documentos se crean pero no llegan correos
- **Causa**: Configuración SMTP incorrecta o inválida
- **Solución**: Verifica las credenciales SMTP en la configuración de la extensión

### Error al crear documento en `mail`
- **Causa**: Reglas de seguridad bloqueando la creación
- **Solución**: Verifica que `allow create: if request.auth != null;` esté en las reglas

### La extensión no está instalada
- **Causa**: No se instaló la extensión Trigger Email
- **Solución**: Instala la extensión desde Firebase Console → Extensions

### ❌ ERROR: "Permission denied while using the Eventarc Service Agent"
Este es el error que estás experimentando. Soluciones:

#### Solución 1: Otorgar Permisos Manualmente (Recomendado)

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto: **finanzas-familia-4e140**
3. Ve a **IAM & Admin** → **IAM**
4. Busca la cuenta de servicio: `service-{PROJECT_NUMBER}@gcp-sa-eventarc.iam.gserviceaccount.com`
   - O busca por "Eventarc Service Agent"
5. Si NO existe, haz clic en **"Grant Access"** o **"Add Principal"**
6. Agrega el email: `service-{PROJECT_NUMBER}@gcp-sa-eventarc.iam.gserviceaccount.com`
7. Asigna el rol: **Eventarc Service Agent**
8. Guarda los cambios
9. Espera 2-3 minutos para que se propaguen los permisos
10. Intenta instalar la extensión nuevamente

#### Solución 2: Habilitar APIs Necesarias

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto
3. Ve a **APIs & Services** → **Library**
4. Busca y habilita estas APIs:
   - **Eventarc API**
   - **Cloud Functions API**
   - **Cloud Run API**
5. Espera unos minutos
6. Intenta instalar la extensión nuevamente

#### Solución 3: Usar Firebase CLI (Alternativa)

Si el problema persiste, puedes intentar instalar la extensión usando Firebase CLI:

```bash
# Instalar Firebase CLI si no lo tienes
npm install -g firebase-tools

# Iniciar sesión
firebase login

# Instalar la extensión desde la línea de comandos
firebase ext:install firestore-send-email --project=finanzas-familia-4e140
```

#### Solución 4: Usar una Alternativa sin Extensión

Si ninguna de las soluciones anteriores funciona, puedes usar un servicio de correo directo (ver sección "Alternativa sin Extensión" más abajo).

### Correos van a spam
- **Causa**: Configuración SPF/DKIM no configurada
- **Solución**: Configura registros DNS para tu dominio (si usas dominio personalizado)

## 📞 Próximos Pasos

1. Verifica que la extensión esté instalada
2. Configura un proveedor SMTP válido
3. Prueba enviar una invitación
4. Revisa los logs si sigue sin funcionar
5. Si el problema persiste, revisa la documentación oficial de Firebase Trigger Email

## 🔄 Alternativa sin Extensión Firebase

Si no puedes instalar la extensión Trigger Email debido a problemas de permisos, puedes usar un servicio de correo directo. Aquí hay opciones:

### Opción A: Usar Resend (Recomendado - Más fácil)

1. Crea cuenta en [Resend](https://resend.com/) (gratis hasta 3,000 emails/mes)
2. Obtén tu API Key
3. Instala el paquete: `npm install resend`
4. Modifica `src/hooks/useWorkspace.tsx` para usar Resend directamente

### Opción B: Usar SendGrid directamente

1. Crea cuenta en [SendGrid](https://sendgrid.com/)
2. Obtén tu API Key
3. Instala: `npm install @sendgrid/mail`
4. Modifica el código para enviar correos directamente

### Opción C: Usar Nodemailer con SMTP

1. Instala: `npm install nodemailer`
2. Configura con Gmail, Mailgun, o cualquier SMTP
3. Crea una API route en Next.js para enviar correos

**Nota**: Si eliges esta opción, necesitarás modificar el código para llamar a una API route en lugar de escribir en Firestore.

## 🔗 Enlaces Útiles

- [Firebase Trigger Email Extension](https://firebase.google.com/products/extensions/firestore-send-email)
- [Documentación de la Extensión](https://github.com/firebase/extensions/tree/master/firestore-send-email)
- [Configurar App Password de Gmail](https://support.google.com/accounts/answer/185833)
- [Solucionar Eventarc Service Agent](https://cloud.google.com/eventarc/docs/troubleshooting)
- [Resend - Servicio de Email Simple](https://resend.com/)
