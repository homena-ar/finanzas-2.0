# 🤖 Configuración de IA para Lectura Automática de Resúmenes

Esta aplicación utiliza **Google Gemini Vision API** para leer automáticamente información de resúmenes bancarios, comprobantes y tickets de compra.

## 🚀 Características

- ✅ Lectura automática de resúmenes bancarios
- ✅ Extracción de datos de comprobantes y tickets
- ✅ **Soporte para imágenes (JPG, PNG, WEBP) y PDFs**
- ✅ Soporte para ingresos y gastos
- ✅ Vista previa con confirmación antes de guardar
- ✅ Edición de datos extraídos antes de confirmar

## 📋 Requisitos

1. Una cuenta de Google Cloud Platform
2. API Key de Google Gemini

## 🔑 Paso 1: Obtener API Key de Google Gemini

### Opción A: Desde Google AI Studio (Recomendado - Más fácil)

1. Ve a [Google AI Studio](https://aistudio.google.com/)
2. Inicia sesión con tu cuenta de Google
3. Haz clic en **"Get API Key"** o ve a [API Keys](https://aistudio.google.com/app/apikey)
4. Haz clic en **"Create API Key"**
5. Selecciona o crea un proyecto de Google Cloud
6. **Copia la API Key** que se genera (tiene formato: `AIza...`)

### Opción B: Desde Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Ve a **"APIs & Services"** → **"Library"**
4. Busca **"Generative Language API"** o **"Gemini API"**
5. Haz clic en **"Enable"**
6. Ve a **"APIs & Services"** → **"Credentials"**
7. Haz clic en **"Create Credentials"** → **"API Key"**
8. **Copia la API Key** generada

## ⚙️ Paso 2: Configurar en el Proyecto

### Desarrollo Local

1. Abre el archivo `.env.local` en la raíz del proyecto
2. Si no existe, créalo
3. Agrega la siguiente línea:

```env
GOOGLE_GEMINI_API_KEY=tu_api_key_aqui
```

**Ejemplo:**
```env
GOOGLE_GEMINI_API_KEY=AIzaSyD6h56r_qY5pTQSIKupTrQfcJ_c6IEc2yY
```

### Producción (Vercel, Netlify, etc.)

1. Ve a la configuración de tu proyecto en tu plataforma de hosting
2. Busca la sección **"Environment Variables"** o **"Variables de Entorno"**
3. Agrega una nueva variable:
   - **Name**: `GOOGLE_GEMINI_API_KEY`
   - **Value**: Tu API Key de Google Gemini
4. Guarda los cambios
5. **Reinicia el deployment** si es necesario

## 🎯 Paso 3: Usar la Funcionalidad

### En la Página de Ingresos

1. Haz clic en **"Nuevo Ingreso"**
2. En el modal, verás un botón **"📸 Leer con IA desde imagen"**
3. Haz clic en **"Subir"** y selecciona una imagen o PDF de:
   - Resumen bancario (PDF o imagen)
   - Extracto de cuenta (PDF o imagen)
   - Comprobante de depósito (PDF o imagen)
   - Transferencia recibida (PDF o imagen)
4. La IA procesará la imagen y extraerá:
   - Descripción
   - Monto
   - Moneda (ARS/USD)
   - Fecha
   - Categoría sugerida
   - Origen
5. Revisa y edita los datos si es necesario
6. Haz clic en **"✓ Usar estos datos"**
7. Completa los campos faltantes (categoría, tags, etc.)
8. Guarda el ingreso

### En la Página de Gastos

1. Haz clic en **"Agregar Gasto"**
2. En el modal, verás un botón **"📸 Leer con IA desde imagen"**
3. Haz clic en **"Subir"** y selecciona una imagen o PDF de:
   - Ticket de compra (imagen o PDF)
   - Factura (PDF o imagen)
   - Comprobante de pago (PDF o imagen)
   - Resumen de tarjeta (PDF o imagen)
4. La IA procesará la imagen y extraerá:
   - Descripción
   - Monto
   - Moneda (ARS/USD)
   - Fecha
   - Categoría sugerida
   - Comercio
5. Revisa y edita los datos si es necesario
6. Haz clic en **"✓ Usar estos datos"**
7. Completa los campos faltantes (tarjeta, cuotas, tags, etc.)
8. Guarda el gasto

## 💡 Consejos para Mejores Resultados

1. **Calidad de archivo**: 
   - Para imágenes: Usa imágenes claras y bien iluminadas
   - Para PDFs: Asegúrate de que el PDF sea de texto (no escaneado como imagen) cuando sea posible
2. **Orientación**: Asegúrate de que el texto esté derecho
3. **Enfoque**: Las imágenes deben estar enfocadas y legibles
4. **Formato**: Se aceptan:
   - **Imágenes**: JPG, PNG, WEBP
   - **Documentos**: PDF
5. **Tamaño**: Archivos muy grandes pueden tardar más en procesarse
6. **PDFs**: Los PDFs son especialmente útiles para resúmenes bancarios que vienen en formato digital

## 🔒 Seguridad

- ⚠️ **NUNCA** subas tu API Key a GitHub o repositorios públicos
- ✅ Usa variables de entorno para almacenar la API Key
- ✅ Verifica que `.env.local` esté en `.gitignore`
- ✅ Limita el uso de la API Key si es posible (cuotas, restricciones de IP)

## 🐛 Solución de Problemas

### Error: "Configuración de IA no disponible"

**Causa**: La variable de entorno `GOOGLE_GEMINI_API_KEY` no está configurada.

**Solución**:
1. Verifica que el archivo `.env.local` existe
2. Verifica que la variable está escrita correctamente
3. Reinicia el servidor de desarrollo (`npm run dev`)

### Error: "Error al procesar la imagen"

**Causa**: Problema con la API de Google Gemini o imagen inválida.

**Solución**:
1. Verifica que tu API Key es válida
2. Verifica que tienes créditos/quota disponible en Google Cloud
3. Intenta con otra imagen
4. Verifica que la imagen es válida (JPG, PNG, WEBP)

### La IA no extrae correctamente los datos

**Causa**: La imagen puede ser de baja calidad o el formato no es estándar.

**Solución**:
1. Usa una imagen más clara
2. Asegúrate de que el texto es legible
3. Intenta recortar la imagen para mostrar solo la parte relevante
4. Puedes editar manualmente los datos extraídos antes de confirmar

## 📊 Costos

Google Gemini ofrece un **tier gratuito generoso**:
- **60 solicitudes por minuto** (gratis)
- **1,500 solicitudes por día** (gratis)
- Después del tier gratuito, el costo es muy bajo

Para más información sobre precios, visita: [Google Gemini Pricing](https://ai.google.dev/pricing)

## 🔗 Enlaces Útiles

- [Google AI Studio](https://aistudio.google.com/)
- [Google Gemini Documentation](https://ai.google.dev/docs)
- [Google Cloud Console](https://console.cloud.google.com/)
- [API Keys Management](https://aistudio.google.com/app/apikey)

---

**¡Listo!** Ya puedes usar la funcionalidad de lectura automática con IA. 🎉
