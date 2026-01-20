# 📱 Configuración PWA (Progressive Web App)

## ✅ Lo que ya está configurado

1. **Manifest.json** - Ya existe en `/public/manifest.json`
2. **Service Worker** - Creado en `/public/sw.js`
3. **Registro del SW** - Componente creado en `/src/components/ServiceWorkerRegistration.tsx`
4. **Meta tags** - Configurados en `/src/app/layout.tsx`

## 🔧 Pasos para completar la PWA

### 1. Generar los iconos PNG necesarios

Los iconos necesarios son:
- `icon-192.png` (192x192px) - Para PWA
- `icon-512.png` (512x512px) - Para PWA
- `apple-touch-icon.png` (180x180px) - Para iOS

**Opción A: Usar el script (si tienes sharp instalado)**
```bash
npm install sharp
node scripts/generate-images.js
```

**Opción B: Generar manualmente**
1. Usa el SVG en `/public/favicon.svg` como base
2. Convierte a PNG en los tamaños mencionados usando:
   - [CloudConvert](https://cloudconvert.com/svg-to-png)
   - [SVG to PNG](https://www.svgtopng.com/)
   - O cualquier editor de imágenes

3. Guarda los archivos en `/public/`:
   - `icon-192.png`
   - `icon-512.png`
   - `apple-touch-icon.png`

### 2. Verificar que el Service Worker funcione

1. Abre la aplicación en el navegador
2. Abre las DevTools (F12)
3. Ve a la pestaña "Application" (Chrome) o "Storage" (Firefox)
4. En "Service Workers" deberías ver el SW registrado
5. Verifica que el estado sea "activated"

### 3. Probar la instalación como PWA

**En Chrome/Edge:**
- Abre la app en el navegador
- Busca el ícono de "Instalar" en la barra de direcciones
- O ve a Menú > "Instalar FinControl"

**En iOS (Safari):**
- Abre la app en Safari
- Toca el botón "Compartir"
- Selecciona "Agregar a pantalla de inicio"

**En Android (Chrome):**
- Abre la app en Chrome
- Aparecerá un banner "Agregar a pantalla de inicio"
- O ve a Menú > "Agregar a pantalla de inicio"

## 🎯 Características PWA implementadas

✅ **Instalable** - Los usuarios pueden instalar la app en su dispositivo
✅ **Offline básico** - Cache de páginas principales
✅ **Iconos** - Soporte para diferentes tamaños de iconos
✅ **Pantalla completa** - Modo standalone sin barra del navegador
✅ **Tema** - Color de tema configurado (#6366f1)

## 📝 Notas importantes

1. **HTTPS requerido**: Las PWAs solo funcionan en HTTPS (o localhost en desarrollo)
2. **Service Worker**: Se registra automáticamente al cargar la app
3. **Cache**: Usa estrategia "Network First" - intenta red primero, luego cache
4. **Actualizaciones**: El SW verifica actualizaciones cada hora

## 🐛 Solución de problemas

**El SW no se registra:**
- Verifica que estés en HTTPS o localhost
- Revisa la consola del navegador para errores
- Asegúrate de que `/public/sw.js` existe

**Los iconos no aparecen:**
- Verifica que los archivos PNG existan en `/public/`
- Revisa que las rutas en `manifest.json` sean correctas
- Limpia el cache del navegador

**La app no es instalable:**
- Verifica que el manifest.json sea válido
- Asegúrate de tener los iconos requeridos
- Revisa que el SW esté activo

## 🔗 Recursos útiles

- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web.dev PWA](https://web.dev/progressive-web-apps/)
- [Manifest Validator](https://manifest-validator.appspot.com/)
