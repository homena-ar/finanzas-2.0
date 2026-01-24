# 🔧 Solución: Sesión se pierde al cerrar PWA en iOS

## ❌ Problema

Cuando la PWA se cierra completamente en iOS y se vuelve a abrir, la sesión se pierde y el usuario tiene que iniciar sesión nuevamente.

## 🔍 Causas Conocidas

1. **iOS Safari y IndexedDB**: iOS Safari tiene problemas conocidos con la persistencia de IndexedDB, que es lo que Firebase Auth usa por defecto para almacenar sesiones.
2. **Limpieza de almacenamiento**: iOS puede limpiar el almacenamiento cuando la app se cierra completamente, especialmente si el dispositivo tiene poca memoria.
3. **Firebase Auth y setPersistence()**: Llamar a `setPersistence()` repetidamente puede borrar sesiones existentes.

## ✅ Soluciones Implementadas

### 1. Eliminación de setPersistence() repetitivo
- Se eliminó la llamada a `setPersistence()` en la inicialización porque:
  - `browserLocalPersistence` es el valor por defecto
  - Llamarlo repetidamente puede borrar sesiones en otras pestañas
  - Puede causar problemas en iOS

### 2. Sistema de Respaldo en localStorage
- Se implementó un sistema que guarda información de la sesión en `localStorage` como respaldo
- Esto ayuda cuando IndexedDB falla en iOS
- El respaldo se actualiza cada vez que hay un cambio en el estado de autenticación

### 3. Restauración al volver a abrir la app
- Se agregó un listener que detecta cuando la app vuelve a estar visible
- Intenta restaurar la sesión desde `auth.currentUser` primero
- Si eso falla, verifica si hay un respaldo en localStorage

## 🔧 Qué Verificar en Firebase Console

### 1. Verificar Dominios Autorizados

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Authentication** → **Settings** → **Authorized domains**
4. Asegúrate de que estos dominios estén en la lista:
   - `fin.nexuno.com.ar` (tu dominio de producción)
   - `localhost` (para desarrollo)
   - Cualquier otro dominio que uses

**Si falta tu dominio:**
- Haz clic en **"Add domain"**
- Agrega tu dominio
- Espera 5-10 minutos para que los cambios se apliquen

### 2. Verificar Configuración de Authentication

1. En **Authentication** → **Settings** → **General**
2. Verifica que:
   - **Email/Password** esté habilitado como método de autenticación
   - **Email link (passwordless sign-in)** esté configurado si lo usas

### 3. Verificar Configuración del Proyecto

1. Ve a **Configuración del proyecto** (ícono de engranaje)
2. En la pestaña **General**, verifica:
   - **Project ID**: Debe coincidir con `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - **Web API Key**: Debe coincidir con `NEXT_PUBLIC_FIREBASE_API_KEY`

### 4. Verificar Variables de Entorno

Asegúrate de que todas estas variables estén configuradas correctamente:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_dominio
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id
```

## 🧪 Cómo Probar

1. **Desinstalar la PWA actual** (si está instalada):
   - En iOS: Mantén presionado el ícono → "Eliminar app"

2. **Reinstalar la PWA**:
   - Abre Safari
   - Ve a tu sitio web
   - Toca "Compartir" → "Agregar a pantalla de inicio"

3. **Iniciar sesión**:
   - Inicia sesión normalmente
   - Verifica que funcione

4. **Cerrar completamente la app**:
   - Desliza hacia arriba desde la barra de tareas
   - Desliza la app hacia arriba para cerrarla completamente

5. **Reabrir la app**:
   - Toca el ícono de la app en la pantalla de inicio
   - La sesión debería mantenerse

## ⚠️ Limitaciones Conocidas

### iOS Safari y IndexedDB

iOS Safari tiene problemas conocidos con IndexedDB:
- Puede limpiar IndexedDB cuando la app se cierra completamente
- Esto es un comportamiento del sistema operativo, no algo que podamos controlar completamente
- El sistema de respaldo ayuda, pero no es una solución perfecta

### Soluciones Alternativas

Si el problema persiste, considera:

1. **Usar "Recordar contraseña" del navegador**: Aunque no es ideal, ayuda a que el usuario no tenga que escribir todo de nuevo.

2. **Implementar "Recordar sesión"**: Agregar una opción para que el usuario elija si quiere que la sesión persista.

3. **Usar tokens de larga duración**: Configurar Firebase para usar tokens de sesión más largos (requiere configuración adicional).

## 📊 Monitoreo

Para verificar si el problema persiste:

1. Abre la consola del navegador (Safari → Desarrollo → [Tu dispositivo])
2. Busca mensajes que empiecen con `🔐 [Firebase useAuth]`
3. Si ves "Restaurando sesión desde auth.currentUser" o "Respaldo de sesión encontrado", el sistema está funcionando

## 🐛 Debugging

Si el problema persiste:

1. **Verificar localStorage**:
   ```javascript
   // En la consola del navegador
   localStorage.getItem('fincontrol:auth_session_backup')
   ```

2. **Verificar IndexedDB**:
   - Abre Safari DevTools
   - Ve a "Storage" → "IndexedDB"
   - Busca bases de datos que empiecen con "firebase"

3. **Verificar auth.currentUser**:
   ```javascript
   // En la consola del navegador (después de iniciar sesión)
   import { auth } from '@/lib/firebase'
   console.log(auth.currentUser)
   ```

## 📝 Notas Importantes

- El sistema de respaldo guarda información básica de la sesión, pero **no puede restaurar la sesión automáticamente** porque Firebase Auth no permite restaurar sesiones desde tokens almacenados por razones de seguridad.
- El respaldo es principalmente para diagnóstico y para saber que había una sesión activa.
- La mejor solución es que Firebase Auth mantenga la sesión en IndexedDB, pero en iOS esto puede fallar.

## 🔗 Referencias

- [Firebase Auth Persistence](https://firebase.google.com/docs/reference/js/auth.persistence)
- [iOS Safari IndexedDB Issues](https://stackoverflow.com/questions/50795409/is-indexeddb-on-safari-guaranteed-to-be-persistent)
- [Firebase Auth Multi-Tab Issues](https://github.com/firebase/firebase-js-sdk/issues/9319)
