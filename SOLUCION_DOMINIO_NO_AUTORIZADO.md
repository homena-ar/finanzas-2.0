# 🔧 Solución: Error "Domain not allowlisted by project"

## ❌ Problema

Al intentar generar el link de verificación personalizado, aparece el error:
```
Domain not allowlisted by project
```

Esto significa que el dominio que estamos usando en la URL de acción no está autorizado en Firebase.

## ✅ Solución 1: Agregar Dominio a Firebase (Recomendado)

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Authentication** → **Settings** → **Authorized domains**
4. Haz clic en **Add domain**
5. Agrega: `fin.nexuno.com.ar`
6. Haz clic en **Add**

**Importante**: Puede tomar unos minutos para que el cambio se aplique.

## ✅ Solución 2: Usar Configuración por Defecto de Firebase (Actual)

Ya actualicé el código para que **NO** use una URL personalizada si el dominio no está autorizado. Ahora:
- Si el dominio está autorizado: usa tu dominio personalizado
- Si el dominio NO está autorizado: Firebase usa su configuración por defecto (funciona igual)

**Ventaja**: El link seguirá funcionando, pero el dominio será `firebaseapp.com` hasta que agregues el dominio a Firebase.

## 🔍 Verificar si el Dominio Está Autorizado

Para verificar qué dominios están autorizados:

1. Ve a Firebase Console → Authentication → Settings → Authorized domains
2. Deberías ver una lista como:
   - `localhost` (desarrollo)
   - `fin.nexuno.com.ar` (si lo agregaste)
   - Otros dominios

## 📝 Nota sobre Recuperación de Contraseña

El correo de recuperación de contraseña sigue usando Firebase porque no lo hemos personalizado aún. Esto es normal y funciona correctamente.

## 🐛 Error de "Demasiados Intentos"

Si ves el error "Demasiados intentos" o "too-many-requests":

1. **Espera 5-10 minutos** antes de intentar nuevamente
2. Firebase tiene límites para prevenir spam
3. El código ya previene múltiples clics rápidos

## ✅ Checklist

- [ ] Dominio `fin.nexuno.com.ar` agregado a Authorized domains en Firebase
- [ ] Esperado 5-10 minutos después de agregar el dominio
- [ ] Probar generar un nuevo link de verificación
- [ ] Verificar que el error "Domain not allowlisted" ya no aparece
