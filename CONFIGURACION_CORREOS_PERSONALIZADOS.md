# 📧 Configuración de Correos Personalizados de Verificación

## ✅ Cambios Implementados

Se han implementado correos de verificación personalizados y estéticos que reemplazan los correos automáticos de Firebase. Ahora los usuarios recibirán:

1. **Correo de Bienvenida**: Diseño profesional con información sobre FinControl
2. **Correo de Verificación Personalizado**: Diseño moderno con link de verificación que usa tu dominio personalizado (no firebaseapp.com)

## 🔧 Configuración Requerida

### 1. Obtener Firebase Service Account Key

Para generar los links de verificación personalizados, necesitas configurar Firebase Admin SDK:

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Configuración del proyecto** (ícono de engranaje) → **Cuentas de servicio**
4. Haz clic en **Generar nueva clave privada**
5. Se descargará un archivo JSON con las credenciales del service account
6. **IMPORTANTE**: Este archivo contiene información sensible, nunca lo subas a Git

### 2. Configurar Variable de Entorno

Necesitas agregar la variable `FIREBASE_SERVICE_ACCOUNT_KEY` con el contenido completo del archivo JSON como string.

#### Opción A: En Railway (Producción)

1. Ve a tu proyecto en Railway
2. Ve a **Variables** → **New Variable**
3. Agrega:
   - **Name**: `FIREBASE_SERVICE_ACCOUNT_KEY`
   - **Value**: Pega el contenido completo del archivo JSON (debe ser un JSON válido en una sola línea o como string)

**Ejemplo del formato:**
```json
{"type":"service_account","project_id":"tu-proyecto","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

#### Opción B: En Desarrollo Local (.env.local)

Crea o edita el archivo `.env.local` en la raíz del proyecto:

```env
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"tu-proyecto",...}'
```

**Nota**: Asegúrate de escapar las comillas correctamente si es necesario.

### 3. Verificar Variables de Entorno Existentes

Asegúrate de tener estas variables configuradas:

```env
# Firebase (ya deberías tenerlas)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase Admin SDK (NUEVA - requerida para correos personalizados)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Resend (para enviar correos)
RESEND_API_KEY=...
RESEND_FROM_EMAIL=noreply@fin.nexuno.com.ar

# URL de la aplicación
NEXT_PUBLIC_APP_URL=https://fin.nexuno.com.ar
```

## 🎨 Características de los Correos Personalizados

### Correo de Verificación

- ✅ Diseño moderno y profesional
- ✅ Link de verificación con tu dominio personalizado
- ✅ Información clara sobre por qué verificar el email
- ✅ Instrucciones paso a paso
- ✅ Advertencia de seguridad si no solicitaste la verificación
- ✅ Branding de FinControl consistente

### Correo de Bienvenida

- ✅ Mensaje de bienvenida personalizado
- ✅ Información sobre las funcionalidades de FinControl
- ✅ Link directo al dashboard
- ✅ Diseño consistente con el resto de la aplicación

## 🔄 Flujo de Verificación

1. Usuario se registra → Se crea la cuenta en Firebase
2. Se genera un link de verificación personalizado usando Firebase Admin SDK
3. Se envía correo de verificación personalizado usando Resend
4. Se envía correo de bienvenida personalizado usando Resend
5. Usuario hace clic en el link de verificación → Firebase verifica el email
6. Usuario puede acceder al dashboard

## ⚠️ Fallback Automático

Si por alguna razón falla la generación del link personalizado o el envío del correo personalizado, el sistema automáticamente usa el correo de Firebase como respaldo. Esto asegura que los usuarios siempre reciban el correo de verificación.

## 🐛 Solución de Problemas

### Error: "Firebase Admin SDK no está configurado"

**Causa**: La variable `FIREBASE_SERVICE_ACCOUNT_KEY` no está configurada o es inválida.

**Solución**:
1. Verifica que la variable esté configurada en Railway
2. Asegúrate de que el JSON sea válido
3. Verifica que no haya caracteres especiales mal escapados

### Los correos siguen siendo de Firebase

**Causa**: Puede ser que el fallback se esté activando.

**Solución**:
1. Revisa los logs en Railway para ver si hay errores
2. Verifica que `RESEND_API_KEY` esté configurado correctamente
3. Verifica que `RESEND_FROM_EMAIL` use un dominio verificado en Resend

### Error: "Usuario no encontrado" al generar link

**Causa**: El usuario no existe en Firebase o el email es incorrecto.

**Solución**:
1. Verifica que el usuario se haya creado correctamente
2. Verifica que el email sea el correcto
3. Revisa los logs para más detalles

## 📝 Notas Importantes

- Los correos personalizados usan Resend, que tiene un límite gratuito de 3,000 emails/mes
- El link de verificación expira después de 24 horas (configuración de Firebase)
- Los usuarios pueden solicitar reenvío del correo de verificación las veces que necesiten
- El sistema tiene fallback automático a correos de Firebase si algo falla

## ✅ Checklist de Configuración

- [ ] Firebase Service Account Key descargado
- [ ] Variable `FIREBASE_SERVICE_ACCOUNT_KEY` configurada en Railway
- [ ] Variable `RESEND_API_KEY` configurada
- [ ] Variable `RESEND_FROM_EMAIL` configurada con dominio verificado
- [ ] Variable `NEXT_PUBLIC_APP_URL` configurada
- [ ] Probar registro de nuevo usuario
- [ ] Verificar que lleguen ambos correos (bienvenida y verificación)
- [ ] Verificar que el link de verificación funcione correctamente
