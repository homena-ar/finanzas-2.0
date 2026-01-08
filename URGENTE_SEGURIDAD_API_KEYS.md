# 🚨 URGENTE: API Keys Expuestas en GitHub

## ⚠️ PROBLEMA CRÍTICO DE SEGURIDAD

Tus API Keys han sido expuestas públicamente en GitHub. Esto es **MUY GRAVE** y necesita acción inmediata.

### API Keys Expuestas:
1. **Resend API Key**: `re_MPomMwKd_KRMwou5Nzetj35oRWGtdG5rX`
2. **Google Cloud API Key**: `AlzaSyD6h56r_qY5pTQSIKupTrQfcJ_c6IEc2yY`

## 🔥 ACCIONES INMEDIATAS REQUERIDAS

### Paso 1: Revocar Resend API Key (AHORA)

1. Ve a [Resend Dashboard → API Keys](https://resend.com/api-keys)
2. Busca la API Key que empieza con `re_MPomMwKd_...`
3. Haz clic en los tres puntos (⋯) o en "Delete"
4. Confirma la eliminación
5. Crea una nueva API Key:
   - Haz clic en "Create API Key"
   - Nombre: `FinControl` (o el que prefieras)
   - Permisos: Full Access
   - **Copia la nueva API Key inmediatamente**
6. Actualiza tu `.env.local` con la nueva key:
   ```env
   RESEND_API_KEY=re_NUEVA_API_KEY_AQUI
   ```

### Paso 2: Revocar Google Cloud API Key (AHORA)

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona el proyecto: **finanzas-familia-4e140**
3. Ve a **APIs & Services** → **Credentials**
4. Busca la API Key: `AlzaSyD6h56r_qY5pTQSIKupTrQfcJ_c6IEc2yY`
5. Haz clic en ella para editarla
6. Haz clic en **"Regenerate key"** o **"Delete"**
7. Si regeneras, **copia la nueva API Key**
8. Actualiza tu `.env.local` con la nueva key:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=NUEVA_API_KEY_AQUI
   ```

### Paso 3: Eliminar el Archivo Expuesto de GitHub

1. Ve a tu repositorio: `https://github.com/homena-ar/finanzas-2.0`
2. Busca el archivo `.env.local` en el historial
3. **NO** simplemente lo elimines del repositorio actual (ya está en el historial)
4. Necesitas hacer una de estas opciones:

#### Opción A: Usar BFG Repo-Cleaner (Recomendado)
```bash
# Instalar BFG
# Descargar desde: https://rtyley.github.io/bfg-repo-cleaner/

# Clonar el repo como mirror
git clone --mirror https://github.com/homena-ar/finanzas-2.0.git

# Eliminar el archivo del historial
bfg --delete-files .env.local finanzas-2.0.git

# Limpiar y hacer push
cd finanzas-2.0.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

#### Opción B: Contactar a GitHub Support
- Ve a [GitHub Support](https://support.github.com/)
- Explica que necesitas eliminar un archivo con credenciales del historial
- GitHub puede ayudarte a limpiar el historial

#### Opción C: Crear Nuevo Repositorio (Más Simple)
1. Crea un nuevo repositorio privado
2. Copia tu código (sin `.env.local`)
3. Actualiza las referencias remotas
4. **IMPORTANTE**: Asegúrate de que `.env.local` esté en `.gitignore`

### Paso 4: Verificar .gitignore

Asegúrate de que tu `.gitignore` incluya:
```
.env
.env.local
.env.*
!.env.example
```

### Paso 5: Verificar que .env.local NO esté en Git

```bash
# Verificar si .env.local está siendo rastreado
git ls-files | grep .env.local

# Si aparece, eliminarlo del tracking (NO del disco)
git rm --cached .env.local
git commit -m "Remove .env.local from tracking"
git push
```

## 🔒 Prevención Futura

### 1. Nunca subas archivos .env a Git
- Siempre verifica antes de hacer commit
- Usa `git status` para ver qué archivos se van a subir

### 2. Usa Variables de Entorno en Producción
- En Vercel/Netlify: Configura las variables en el dashboard
- Nunca hardcodees API keys en el código

### 3. Usa Secretos de GitHub (si usas GitHub Actions)
- Ve a Settings → Secrets
- Agrega las API keys como secretos

### 4. Revisa Regularmente
- Usa herramientas como GitGuardian (ya te están alertando)
- Revisa los logs de tus servicios para actividad sospechosa

## 📊 Monitoreo Post-Exposición

### Resend:
1. Ve a [Resend Dashboard → Logs](https://resend.com/emails)
2. Revisa si hay actividad sospechosa
3. Revisa el uso de la API Key

### Google Cloud:
1. Ve a [Google Cloud Console → APIs & Services → Dashboard](https://console.cloud.google.com/apis/dashboard)
2. Revisa el uso de la API Key
3. Revisa la facturación por actividad inusual

## ⏰ Timeline Crítico

- **AHORA**: Revoca las API keys expuestas
- **HOY**: Crea nuevas API keys y actualiza `.env.local`
- **ESTA SEMANA**: Limpia el historial de Git o crea nuevo repo
- **CONTINUO**: Monitorea actividad sospechosa

## 🆘 Si Detectas Actividad Sospechosa

1. **Revoca inmediatamente** todas las API keys relacionadas
2. **Revisa la facturación** de tus servicios
3. **Cambia todas las contraseñas** relacionadas
4. **Contacta al soporte** de los servicios afectados

## 📝 Checklist de Seguridad

- [ ] Resend API Key revocada
- [ ] Nueva Resend API Key creada
- [ ] Google Cloud API Key revocada/regenerada
- [ ] `.env.local` actualizado con nuevas keys
- [ ] `.env.local` eliminado del historial de Git
- [ ] `.gitignore` verificado
- [ ] Repositorio verificado (sin archivos sensibles)
- [ ] Logs revisados para actividad sospechosa
- [ ] Facturación revisada

## 🔗 Enlaces Útiles

- [Resend API Keys](https://resend.com/api-keys)
- [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials)
- [GitHub Support](https://support.github.com/)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)

---

**⚠️ IMPORTANTE**: No ignores esto. Las API keys expuestas pueden resultar en:
- Uso no autorizado de tus servicios
- Costos inesperados
- Compromiso de datos de usuarios
- Violación de términos de servicio

**Actúa AHORA.**
