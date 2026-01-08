# 🔧 Solución para Error de Eventarc Service Agent

## Error que estás viendo:
```
Permission denied while using the Eventarc Service Agent. 
If you recently started to use Eventarc, it may take a few minutes before 
all necessary permissions are propagated to the Service Agent. Otherwise, 
verify that it has Eventarc Service Agent role.
```

## ✅ Solución Paso a Paso

### Paso 1: Obtener el Número de Proyecto

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto **finanzas-familia-4e140**
3. Ve a **Project Settings** (⚙️) → **General**
4. Busca el **Project Number** (es un número largo, ejemplo: `123456789012`)

### Paso 2: Otorgar Permisos en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. **IMPORTANTE**: Asegúrate de seleccionar el proyecto correcto: **finanzas-familia-4e140**
3. Ve a **IAM & Admin** → **IAM** (en el menú lateral izquierdo)
4. Haz clic en **"Grant Access"** o **"+ Grant Access"** (botón en la parte superior)
5. En **"New principals"**, ingresa:
   ```
   service-{TU_PROJECT_NUMBER}@gcp-sa-eventarc.iam.gserviceaccount.com
   ```
   Reemplaza `{TU_PROJECT_NUMBER}` con el número que obtuviste en el Paso 1.
   
   Ejemplo: Si tu Project Number es `123456789012`, sería:
   ```
   service-123456789012@gcp-sa-eventarc.iam.gserviceaccount.com
   ```
6. En **"Select a role"**, busca y selecciona: **Eventarc Service Agent**
7. Haz clic en **"Save"**
8. Espera 2-3 minutos para que se propaguen los permisos

### Paso 3: Habilitar APIs Necesarias

1. En Google Cloud Console, ve a **APIs & Services** → **Library**
2. Busca y habilita estas APIs (si no están habilitadas):
   - **Eventarc API** - Busca "Eventarc" y haz clic en "Enable"
   - **Cloud Functions API** - Busca "Cloud Functions" y haz clic en "Enable"
   - **Cloud Run API** - Busca "Cloud Run" y haz clic en "Enable"
3. Espera unos minutos para que se activen

### Paso 4: Verificar que el Service Account Existe

1. En Google Cloud Console, ve a **IAM & Admin** → **Service Accounts**
2. Busca una cuenta que contenga "eventarc" en el nombre
3. Si NO existe, puede que necesites crear la extensión primero (pero esto causará el error)
4. Alternativamente, puedes intentar crear el service account manualmente:
   - Ve a **IAM & Admin** → **Service Accounts**
   - Haz clic en **"+ Create Service Account"**
   - Nombre: `Eventarc Service Agent`
   - ID: `eventarc-service-agent`
   - Haz clic en **"Create and Continue"**
   - Asigna el rol: **Eventarc Service Agent**
   - Haz clic en **"Done"**

### Paso 5: Intentar Instalar la Extensión Nuevamente

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Extensions**
4. Intenta instalar la extensión **Trigger Email** nuevamente
5. Si sigue fallando, espera 5-10 minutos más y vuelve a intentar

## 🔄 Alternativa Rápida: Usar Resend (Sin Extensión)

Si después de seguir estos pasos el problema persiste, puedes usar **Resend** directamente sin necesidad de la extensión de Firebase. Es más simple y no requiere permisos especiales.

### Ventajas de Resend:
- ✅ No requiere configuración compleja de permisos
- ✅ Gratis hasta 3,000 emails/mes
- ✅ API simple y directa
- ✅ Funciona inmediatamente

### Pasos para usar Resend:

1. **Crear cuenta en Resend:**
   - Ve a [https://resend.com](https://resend.com)
   - Crea una cuenta gratuita
   - Verifica tu email

2. **Obtener API Key:**
   - En el dashboard de Resend, ve a **API Keys**
   - Crea una nueva API Key
   - Cópiala (solo se muestra una vez)

3. **Instalar el paquete:**
   ```bash
   npm install resend
   ```

4. **Agregar variable de entorno:**
   - Agrega a tu `.env.local`:
   ```
   RESEND_API_KEY=tu_api_key_aqui
   ```

5. **Modificar el código:**
   - Necesitarás modificar `src/hooks/useWorkspace.tsx` para usar Resend en lugar de escribir en Firestore
   - Esto requiere crear una API route en Next.js o llamar directamente a Resend desde el cliente

**¿Quieres que te ayude a implementar Resend?** Puedo modificar el código para que funcione sin la extensión de Firebase.

## 📞 Si Nada Funciona

Si después de seguir todos estos pasos el problema persiste:

1. **Verifica que estás en el proyecto correcto** en Google Cloud Console
2. **Espera 10-15 minutos** después de otorgar permisos (a veces tarda)
3. **Intenta desinstalar y reinstalar** la extensión completamente
4. **Contacta al soporte de Firebase** con el error específico
5. **Considera usar Resend** como alternativa (más rápido y simple)

## 🔗 Enlaces Útiles

- [Google Cloud Console - IAM](https://console.cloud.google.com/iam-admin/iam)
- [Firebase Console](https://console.firebase.google.com/)
- [Documentación de Eventarc](https://cloud.google.com/eventarc/docs)
- [Resend - Alternativa Simple](https://resend.com)
