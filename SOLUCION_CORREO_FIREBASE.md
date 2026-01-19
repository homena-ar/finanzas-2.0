# 🔧 Solución: Sigue Llegando el Correo Viejo de Firebase

## ✅ Configuración Correcta

La variable `FIREBASE_SERVICE_ACCOUNT_KEY` debe estar configurada **SOLO en Railway** (producción). **NO** es necesario en `.env.local` para desarrollo local (a menos que quieras probarlo localmente).

## 🔍 Pasos para Verificar y Corregir

### 1. Verificar Variable en Railway

1. Ve a tu proyecto en [Railway](https://railway.app)
2. Ve a **Variables**
3. Busca `FIREBASE_SERVICE_ACCOUNT_KEY`
4. Verifica que:
   - ✅ La variable existe
   - ✅ El valor es un JSON válido (debe empezar con `{"type":"service_account"...`)
   - ✅ No tiene comillas extra al inicio o final
   - ✅ Los `\n` en el `private_key` están escapados correctamente

### 2. Formato Correcto del JSON

El valor debe ser un JSON válido en una sola línea, algo así:

```json
{"type":"service_account","project_id":"finanzas-familia-4e140","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}
```

**IMPORTANTE**: 
- No debe tener comillas simples al inicio/final
- No debe tener saltos de línea (debe ser todo en una línea)
- Los `\n` dentro del `private_key` deben estar escapados

### 3. Reiniciar el Servicio en Railway

**MUY IMPORTANTE**: Después de agregar o modificar la variable:

1. Ve a tu servicio en Railway
2. Haz clic en los **tres puntos (⋯)** → **Restart**
3. O simplemente haz un nuevo deploy (push a GitHub)

Las variables de entorno solo se cargan cuando el servicio inicia, así que necesita reiniciarse.

### 4. Verificar los Logs

Después de reiniciar, verifica los logs en Railway:

1. Ve a **Logs** en Railway
2. Busca mensajes como:
   - ✅ `✅ [API] Firebase Admin SDK inicializado correctamente` → **¡Todo bien!**
   - ❌ `❌ [API] FIREBASE_SERVICE_ACCOUNT_KEY no está configurado` → La variable no existe
   - ❌ `❌ [API] Error parseando FIREBASE_SERVICE_ACCOUNT_KEY` → El JSON no es válido

### 5. Probar el Registro

1. Registra un nuevo usuario
2. Revisa los logs en Railway para ver qué pasa:
   - Si ves `✅ [Firebase useAuth] Correo de verificación personalizado enviado exitosamente` → **¡Funciona!**
   - Si ves `❌ [Firebase useAuth] Error...` → Revisa el error específico en los logs

### 6. Verificar Correos Recibidos

Después de registrar un usuario, deberías recibir:
- ✅ **1 correo de bienvenida** (de FinControl)
- ✅ **1 correo de verificación personalizado** (de FinControl)
- ❌ **NO deberías recibir** el correo automático de Firebase

Si sigues recibiendo el correo de Firebase, significa que:
- El endpoint `/api/generate-verification-link` está fallando
- El endpoint `/api/send-verification-email` está fallando
- Se está activando el fallback automático

## 🐛 Errores Comunes

### Error: "Firebase Admin SDK no está configurado"

**Causa**: La variable no existe o no se está leyendo.

**Solución**:
1. Verifica que la variable esté en Railway (no en `.env.local`)
2. Reinicia el servicio en Railway
3. Verifica los logs para ver el error exacto

### Error: "Error parseando FIREBASE_SERVICE_ACCOUNT_KEY"

**Causa**: El JSON no es válido o tiene formato incorrecto.

**Solución**:
1. Copia el contenido del archivo JSON completo
2. Pégalo directamente en Railway sin modificaciones
3. Asegúrate de que sea un JSON válido (puedes validarlo en https://jsonlint.com)

### El correo personalizado no llega pero el de Firebase sí

**Causa**: Los endpoints están fallando y se activa el fallback.

**Solución**:
1. Revisa los logs en Railway para ver el error específico
2. Verifica que `RESEND_API_KEY` esté configurado
3. Verifica que `RESEND_FROM_EMAIL` use un dominio verificado en Resend

## 📋 Checklist Rápido

- [ ] Variable `FIREBASE_SERVICE_ACCOUNT_KEY` agregada en Railway
- [ ] El valor es un JSON válido (empieza con `{"type":"service_account"...`)
- [ ] Servicio reiniciado en Railway después de agregar la variable
- [ ] Logs muestran: `✅ [API] Firebase Admin SDK inicializado correctamente`
- [ ] Al registrar un usuario, los logs muestran: `✅ Correo de verificación personalizado enviado exitosamente`
- [ ] Llegan 2 correos (bienvenida + verificación personalizado)
- [ ] NO llega el correo automático de Firebase

## 🔄 Si Todo Falla

Si después de seguir estos pasos sigue llegando el correo de Firebase:

1. **Revisa los logs completos** en Railway para ver el error exacto
2. **Copia el error completo** y compártelo
3. Verifica que todos los endpoints estén funcionando:
   - `/api/generate-verification-link`
   - `/api/send-verification-email`
   - `/api/send-welcome-email`

## 💡 Nota Importante

Firebase **NO** envía correos automáticamente cuando creas un usuario. Los correos se envían solo cuando llamas explícitamente a `sendEmailVerification()`. Si estás recibiendo el correo de Firebase, significa que el código está usando el fallback automático porque algo está fallando en el proceso de correo personalizado.
