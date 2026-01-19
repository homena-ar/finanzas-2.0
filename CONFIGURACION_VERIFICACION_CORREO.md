# 📧 Configuración de Verificación de Correo y Recuperación de Contraseña

## ✅ Funcionalidades Implementadas

1. **Verificación de correo al registrarse**: Se envía automáticamente cuando un usuario se registra
2. **Verificación al iniciar sesión**: Si el correo no está verificado, se muestra un mensaje
3. **Recuperación de contraseña**: Los usuarios pueden recuperar su contraseña desde la página de login
4. **Banner de verificación**: Se muestra en el dashboard cuando el correo no está verificado
5. **Reenvío de correo de verificación**: Los usuarios pueden solicitar que se reenvíe el correo

## 🔧 Configuración en Firebase Console

### 1. Verificar Dominio Autorizado

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Authentication** → **Settings** → **Authorized domains**
4. Asegúrate de que estos dominios estén en la lista:
   - `fin.nexuno.com.ar` (tu dominio de producción)
   - `localhost` (para desarrollo)
   - Cualquier otro dominio que uses

### 2. Configurar Action URL (URLs de Acción)

Las Action URLs son las URLs a las que Firebase redirige después de que el usuario hace clic en los enlaces de verificación o recuperación de contraseña.

1. En **Authentication** → **Settings** → **Action URL**
2. Configura las siguientes URLs:

#### Para Verificación de Email:
```
https://fin.nexuno.com.ar/dashboard/config?emailVerified=true
```

#### Para Recuperación de Contraseña:
```
https://fin.nexuno.com.ar/?resetPassword=true
```

**Nota**: Si prefieres manejar estas acciones de forma diferente, puedes crear páginas específicas o usar query parameters para mostrar mensajes de éxito.

### 3. Personalizar Templates de Email (Opcional)

Firebase permite personalizar los templates de email que se envían:

1. Ve a **Authentication** → **Templates**
2. Puedes personalizar:
   - **Email address verification**: Template para verificación de email
   - **Password reset**: Template para recuperación de contraseña

#### Recomendaciones para los Templates:

**Email de Verificación:**
- Incluye el logo de FinControl si es posible
- Mensaje claro: "Verificá tu correo para proteger tu cuenta"
- Botón destacado con el enlace de verificación
- Instrucciones sobre qué hacer si no solicitaste la verificación

**Email de Recuperación de Contraseña:**
- Mensaje claro: "Restablecé tu contraseña"
- Botón destacado con el enlace de restablecimiento
- Advertencia de seguridad si no solicitaste el cambio
- Tiempo de expiración del enlace (24 horas por defecto)

### 4. Configurar Email del Remitente

1. En **Authentication** → **Settings** → **Users**
2. Verifica que el email del remitente esté configurado correctamente
3. Por defecto Firebase usa: `noreply@[tu-proyecto].firebaseapp.com`

**Nota**: Si quieres usar un dominio personalizado, necesitas:
- Verificar el dominio en Firebase (ya lo hiciste)
- Configurar SPF y DKIM records en tu DNS
- Esto permite que los correos se envíen desde `noreply@fin.nexuno.com.ar`

## 🧪 Probar las Funcionalidades

### Probar Verificación de Correo:

1. **Registro nuevo**:
   - Registrá un nuevo usuario
   - Deberías recibir un correo de verificación automáticamente
   - Hacé clic en el enlace del correo
   - Deberías ser redirigido a tu aplicación

2. **Inicio de sesión sin verificar**:
   - Iniciá sesión con un usuario que no haya verificado su correo
   - Deberías ver un mensaje pidiendo verificar el correo
   - Podés solicitar reenvío del correo

3. **Banner en Dashboard**:
   - Si tu correo no está verificado, deberías ver un banner amarillo en el dashboard
   - Podés hacer clic en "Reenviar correo de verificación"
   - Podés cerrar el banner con "Recordar más tarde"

### Probar Recuperación de Contraseña:

1. En la página de login, hacé clic en "¿Olvidaste tu contraseña?"
2. Ingresá tu email
3. Deberías recibir un correo con el enlace de recuperación
4. Hacé clic en el enlace
5. Deberías ser redirigido a una página donde podés ingresar tu nueva contraseña

## 🔍 Verificar que Todo Funciona

### Checklist:

- [ ] Dominio `fin.nexuno.com.ar` está en la lista de dominios autorizados
- [ ] Action URLs están configuradas correctamente
- [ ] Los correos de verificación llegan correctamente
- [ ] Los correos de recuperación de contraseña llegan correctamente
- [ ] Los enlaces de verificación redirigen correctamente
- [ ] Los enlaces de recuperación redirigen correctamente
- [ ] El banner de verificación aparece en el dashboard cuando corresponde
- [ ] El reenvío de correo de verificación funciona

## ⚠️ Problemas Comunes y Soluciones

### Los correos no llegan:

1. **Revisá la carpeta de spam**: Los correos de Firebase a veces van a spam
2. **Verificá el dominio**: Asegurate de que el dominio esté verificado en Firebase
3. **Revisá los logs**: En Firebase Console → Authentication → Users, podés ver el estado de los correos enviados
4. **Límites de Firebase**: Firebase tiene límites en la cantidad de correos que se pueden enviar por día

### Los enlaces no funcionan:

1. **Verificá las Action URLs**: Asegurate de que las URLs estén correctamente configuradas
2. **Verificá el dominio**: El dominio debe estar en la lista de dominios autorizados
3. **Revisá la consola del navegador**: Puede haber errores de JavaScript que impidan la redirección

### El banner no aparece:

1. **Verificá que el correo no esté verificado**: El banner solo aparece si `user.emailVerified === false`
2. **Revisá la consola**: Puede haber errores en el código
3. **Limpiá el localStorage**: A veces el estado se guarda en el navegador

## 📝 Notas Adicionales

- Los correos de Firebase tienen un tiempo de expiración de 24 horas por defecto
- Los usuarios pueden solicitar reenvío del correo de verificación las veces que necesiten
- La recuperación de contraseña también tiene un tiempo de expiración de 24 horas
- Si un usuario cambia su email, Firebase automáticamente requiere verificación del nuevo email

## 🚀 Próximos Pasos

Una vez que hayas verificado todo:

1. Probá el flujo completo de registro → verificación → login
2. Probá el flujo de recuperación de contraseña
3. Verificá que los correos lleguen correctamente (revisá también spam)
4. Personalizá los templates de email si lo deseas
5. Considerá agregar analytics para rastrear cuántos usuarios verifican su correo
