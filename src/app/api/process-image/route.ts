import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageBase64, type, mimeType } = body // type: 'gasto' | 'ingreso' | 'resumen'

    console.log('📄 [API] Procesando archivo - type:', type, 'mimeType:', mimeType)

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'No se proporcionó archivo' },
        { status: 400 }
      )
    }

    // Determinar si es PDF o imagen
    const isPDF = mimeType === 'application/pdf' || imageBase64.includes('data:application/pdf')
    const isImage = imageBase64.includes('data:image/') || (!isPDF && mimeType?.startsWith('image/'))
    
    console.log('📄 [API] Tipo detectado - isPDF:', isPDF, 'isImage:', isImage)

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY
    if (!apiKey) {
      console.error('❌ [API] GOOGLE_GEMINI_API_KEY no está configurada')
      return NextResponse.json(
        { error: 'Configuración de IA no disponible. Por favor, configura GOOGLE_GEMINI_API_KEY en las variables de entorno.' },
        { status: 500 }
      )
    }

    // Inicializar Gemini
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // Determinar el prompt según el tipo
    let prompt = ''
    const documentType = isPDF ? 'documento PDF' : 'imagen'
    
    // Detectar si es un resumen con múltiples transacciones (PDF de resumen bancario/tarjeta)
    const isResumenMultiple = (type === 'resumen' || (type === 'ingreso' && isPDF)) || (type === 'gasto' && isPDF)
    
    if (type === 'gasto' || type === 'comprobante') {
      if (isResumenMultiple) {
        // Para resúmenes de tarjeta o resúmenes con múltiples consumos
        prompt = `Eres un experto en análisis de documentos financieros bancarios argentinos. Tu tarea es analizar este ${documentType} que es un resumen de tarjeta de crédito o resumen bancario y extraer información de forma precisa y profesional.

═══════════════════════════════════════════════════════════════════
⚠️ REGLA CRÍTICA SOBRE FORMATO DE NÚMEROS EN ARGENTINA ⚠️
═══════════════════════════════════════════════════════════════════

En Argentina el formato numérico es:
- PUNTO (.) = separador de MILES (miles, millones)
- COMA (,) = separador de DECIMALES (centavos)

ANÁLISIS PASO A PASO:
1. Identifica el último carácter decimal (generalmente una coma seguida de 2 dígitos)
2. Todo lo que está ANTES de la última coma son los enteros (pueden tener puntos de miles)
3. Los 2 dígitos DESPUÉS de la coma son los centavos

EJEMPLOS DE CONVERSIÓN (LEE CON CUIDADO):
- "15.179,99" = quince mil ciento setenta y nueve pesos con 99 centavos → 15179.99
- "1.517.999" = un millón quinientos diecisiete mil novecientos noventa y nueve pesos → 1517999.00
- "6.647,26" = seis mil seiscientos cuarenta y siete pesos con 26 centavos → 6647.26
- "664.726" = seiscientos sesenta y cuatro mil setecientos veintiséis pesos → 664726.00
- "3.600,00" = tres mil seiscientos pesos → 3600.00
- "13.662,00" = trece mil seiscientos sesenta y dos pesos → 13662.00
- "1.398,18" = mil trescientos noventa y ocho pesos con 18 centavos → 1398.18
- "139.818" = ciento treinta y nueve mil ochocientos dieciocho pesos → 139818.00
- "40.487,43" = cuarenta mil cuatrocientos ochenta y siete pesos con 43 centavos → 40487.43

REGLAS PARA DETECTAR DECIMALES:
- Si el número termina en ",XX" donde XX son 2 dígitos → la coma es decimal
- Si no hay coma al final → el número es entero (sin decimales)
- Si hay puntos internos sin coma al final → son puntos de miles, NO decimales

═══════════════════════════════════════════════════════════════════
📋 INFORMACIÓN A EXTRAER
═══════════════════════════════════════════════════════════════════

1. INFORMACIÓN DE LA TARJETA (busca en encabezados, logos, números):
   - banco: nombre del banco emisor (ej: "BBVA", "Banco Nación", "Galicia")
   - tipo_tarjeta: tipo si es visible (ej: "Visa", "Mastercard", "Amex", o "CreditCard")
   - ultimos_digitos: últimos 4-6 dígitos de la tarjeta si están visibles
   - nombre_titular: nombre del titular si está visible

2. CONSUMOS DEL PERÍODO ACTUAL (CRÍTICO - NO PUEDES PERDERTE NINGUNO):
   - ⚠️⚠️⚠️ REGLA ABSOLUTA Y OBLIGATORIA: DEBES EXTRAER TODOS Y CADA UNO DE LOS CONSUMOS VISIBLES en la imagen/documento
   - ⚠️⚠️⚠️ Si la imagen está recortada o es solo una parte del resumen, extrae TODOS los consumos que puedas ver en esa parte
   - ⚠️⚠️⚠️ NO puedes omitir, olvidar o saltarte NINGÚN consumo visible, sin importar el nombre del comercio
   - ⚠️⚠️⚠️ PASO A PASO OBLIGATORIO - SIGUE ESTOS PASOS EN ORDEN:
     1. Busca la sección "DETALLE DEL CONSUMO", "Consumos", "Detalle de Consumos", "Movimientos", "Transacciones" o cualquier tabla con columnas como FECHA, REFERENCIA, CUOTA, COMPROBANTE, PESOS, DÓLARES
     2. Identifica CADA FILA de esa tabla que sea visible (excluyendo encabezados y totales)
     3. CUENTA cuántas filas de consumos hay - si ves 11 filas, debes extraer 11 transacciones
     4. Para CADA FILA visible, extrae TODOS los datos: descripción (columna REFERENCIA), monto (columna PESOS o DÓLARES), fecha (columna FECHA), cuotas (columna CUOTA), moneda (según si está en PESOS o DÓLARES)
     5. ⚠️⚠️⚠️ CRÍTICO: NO te detengas después de encontrar el primer consumo - continúa revisando TODAS las filas hasta el final de la tabla visible
     6. Si ves múltiples secciones con consumos (ej: una tabla arriba y otra abajo), extrae de TODAS
     7. Si hay múltiples tarjetas en el mismo resumen (ej: "TARJETA 7498" y "TARJETA 9970"), extrae consumos de TODAS las tarjetas visibles
   - ⚠️⚠️⚠️ EJEMPLOS ESPECÍFICOS DE LO QUE DEBES EXTRAER SI LO VES (NO TE SALTES NINGUNO):
     * "K DLO*PEDIDOSYA PLUS" o "PEDIDOSYA PLUS" o "DLO*PEDIDOSYA" → EXTRAER
     * "* BILLABONG" o "BILLABONG" → EXTRAER (y revisar columna CUOTA para ver si tiene "04/06" u otro formato)
     * "* FARMACITY" o "FARMACITY SAN MARTIN Y PU" → EXTRAER (y revisar columna CUOTA)
     * "K AMAZON MKTPL*BI9168ZS2" o "AMAZON MKTPL" o "AMAZON" → EXTRAER
     * "K MERPAGO*PROSHOP" o "MERPAGO*PROSHOP" o "MERPAGO*FARMACIAHUDSO" o "MERPAGO*ECOMODICO" o "MERPAGO*BDESCUENTOS" o "MERPAGO*MERCADOLIBRE" o "MERPAGO*LAPANALERA" → EXTRAER TODOS
     * "* EDENOR SA" o "EDENOR" → EXTRAER
     * "Spotify" → EXTRAER
     * "TELECENTRO SA" o "TELECENTRO" → EXTRAER
     * CUALQUIER otra fila en la tabla de consumos que tenga fecha, referencia y monto → EXTRAER
   - ⚠️⚠️⚠️ Si ves una tabla con columnas (FECHA, REFERENCIA, CUOTA, COMPROBANTE, PESOS, DÓLARES):
     * DEBES contar cuántas filas de datos hay (excluyendo encabezados)
     * DEBES extraer UNA transacción por CADA fila de datos
     * Si ves 7 filas de consumos, debes extraer 7 transacciones
     * Si ves 10 filas de consumos, debes extraer 10 transacciones
   - ⚠️⚠️⚠️ VERIFICACIÓN FINAL OBLIGATORIA antes de responder:
     * ¿Cuántas filas de consumos contaste en la tabla visible?
     * ¿Extraje una transacción por cada fila?
     * ¿Revisé TODAS las secciones visibles del documento?
   - Si la imagen muestra solo una parte del resumen, extrae TODOS los consumos de esa parte visible
   - Si hay múltiples páginas visibles, revisa TODAS las páginas visibles
   - Si hay múltiples tarjetas visibles en el mismo resumen, extrae los consumos de TODAS las tarjetas visibles
   - SOLO extrae CONSUMOS individuales del período actual que sean VISIBLES
   - NO incluyas pagos de meses anteriores (ej: "SU PAGO EN PESOS")
   - NO incluyas saldos anteriores o intereses como transacciones
   - IMPORTANTE: DETECTA EL MES DEL RESUMEN basándote en la fecha de vencimiento:
     * Si el vencimiento es en enero → el resumen es de DICIEMBRE (mes anterior)
     * Si el vencimiento es en febrero → el resumen es de ENERO (mes anterior)
     * Si el vencimiento es en marzo → el resumen es de FEBRERO (mes anterior)
     * Y así sucesivamente...
   - TODOS los consumos deben tener la MISMA FECHA: el primer día del mes del resumen (ej: si es diciembre 2025, usar "2025-12-01")
   - NO uses la fecha individual de cada consumo, usa siempre el mes del resumen detectado
   - DETECCIÓN DE CUOTAS (⚠️⚠️⚠️ CRÍTICO - OBLIGATORIO EN CADA CONSUMO):
     * ⚠️⚠️⚠️ REGLA ABSOLUTA: DEBES buscar y detectar cuotas en CADA consumo. NO puedes omitir esto bajo ninguna circunstancia.
     
     * ⚠️⚠️⚠️ PRIORIDAD ABSOLUTA #1: BUSCA PRIMERO Y SIEMPRE EN LA COLUMNA "CUOTA" DEL RESUMEN
       - CASI TODOS los resúmenes bancarios argentinos (Galicia, BBVA, Santander, etc.) tienen una columna llamada "CUOTA" o "CUOTAS"
       - Esta columna está en la TABLA DE CONSUMOS, generalmente entre las columnas "REFERENCIA" y "COMPROBANTE" o después de "FECHA"
       - La columna muestra el formato "X/Y" donde:
         * X = cuota actual que se está facturando en este resumen (1, 2, 3, 4, etc.)
         * Y = TOTAL de cuotas del consumo (3, 6, 12, 18, 24, etc.)
       - ⚠️⚠️⚠️ IMPORTANTE: Debes extraer AMBOS valores:
         * "cuotas" = Y (el número DESPUÉS de la barra) = total de cuotas
         * "cuota_actual" = X (el número ANTES de la barra) = cuota que se está facturando ahora
       - Ejemplos OBLIGATORIOS (usa estos como referencia exacta):
         * Columna CUOTA muestra "01/03" → cuotas: 3, cuota_actual: 1
         * Columna CUOTA muestra "04/06" → cuotas: 6, cuota_actual: 4
         * Columna CUOTA muestra "02/12" → cuotas: 12, cuota_actual: 2
         * Columna CUOTA muestra "01/18" → cuotas: 18, cuota_actual: 1
         * Columna CUOTA muestra "03/24" → cuotas: 24, cuota_actual: 3
       - ⚠️ SI VES CUALQUIER VALOR EN LA COLUMNA "CUOTA" QUE NO SEA VACÍO, "-", "N/A" o "0", ENTONCES EL CONSUMO ESTÁ EN CUOTAS
       - ⚠️ SI LA COLUMNA CUOTA EXISTE EN LA TABLA Y TIENE UN VALOR PARA UN CONSUMO, DEBES EXTRAERLO OBLIGATORIAMENTE
       - ⚠️ NO IGNORES ESTA COLUMNA - ES LA FORMA MÁS COMÚN Y CONFIABLE DE DETECTAR CUOTAS EN ARGENTINA
       - ⚠️ Si un consumo tiene "01/03" en la columna CUOTA, significa que es la primera cuota de un total de 3 cuotas
       - ⚠️ Si un consumo tiene "04/06" en la columna CUOTA, significa que es la cuarta cuota de un total de 6 cuotas (ya se pagaron las cuotas 1, 2 y 3)
       - ⚠️ El formato "X/Y" es ESTÁNDAR en todos los resúmenes bancarios argentinos
     
     * Busca en TODAS estas ubicaciones para cada consumo:
       - Columna "CUOTA" en la tabla de consumos (formato "X/Y")
       - Descripción del comercio/establecimiento
       - Nombre del comercio
       - Detalles adicionales del consumo
       - Notas o comentarios asociados
       - Cualquier texto relacionado con el consumo
       - Encabezados de columnas que puedan indicar cuotas
     
     * PATRONES A BUSCAR (busca TODOS estos patrones):
       - "X/Y" en columna CUOTA (ej: "01/03" → 3 cuotas, "04/06" → 6 cuotas, "02/12" → 12 cuotas)
       - "X CUOTAS" donde X es un número (ej: "3 CUOTAS", "6 CUOTAS", "12 CUOTAS", "18 CUOTAS", "24 CUOTAS")
       - "CUOTA X/Y" donde Y es el total de cuotas (ej: "CUOTA 1/6" → 6 cuotas, "CUOTA 2/12" → 12 cuotas, "CUOTA 3/18" → 18 cuotas)
       - "CUOTA X DE Y" (ej: "CUOTA 1 DE 6" → 6 cuotas, "CUOTA 2 DE 12" → 12 cuotas)
       - "X CUOTAS SIN INTERÉS" o "X CUOTAS S/I" (ej: "3 CUOTAS SIN INTERÉS" → 3 cuotas)
       - "EN X CUOTAS" (ej: "EN 6 CUOTAS" → 6 cuotas)
       - "X VECES" seguido de contexto de pago (ej: "6 VECES" en contexto de tarjeta → 6 cuotas)
       - Números seguidos de "CUOTAS" en cualquier formato (ej: "6CUOTAS", "6-CUOTAS", "6_CUOTAS")
       - Variaciones con espacios: "6 CUOTAS", "6  CUOTAS", "6   CUOTAS"
     
     * NÚMEROS COMUNES DE CUOTAS EN ARGENTINA:
       - 3, 6, 12, 18, 24 cuotas son los más comunes
       - También pueden ser: 2, 4, 9, 10, 15, 20, 30, 36, 48 cuotas
       - Cualquier número entero positivo es válido
     
     * CÓMO EXTRAER EL NÚMERO DE CUOTAS (SIGUE ESTE ORDEN EXACTO):
       - PASO 1 (OBLIGATORIO): Busca PRIMERO en la columna "CUOTA" de la tabla de consumos
         * Si la columna existe y tiene un valor "X/Y" (donde X e Y son números):
           → USA SIEMPRE Y (el número DESPUÉS de la barra) como el total de cuotas
           → Ejemplo: "01/03" → cuotas: 3
           → Ejemplo: "04/06" → cuotas: 6
           → Ejemplo: "02/12" → cuotas: 12
         * Si la columna existe pero está vacía o tiene "-" o "N/A" → cuotas: null o 1
         * ⚠️ IMPORTANTE: El primer número (X) es la cuota actual, el segundo (Y) es el total
       - PASO 2: Si no hay columna CUOTA o está vacía, busca en la descripción:
         * "CUOTA X/Y" → usa Y (el número después de la barra)
         * "X CUOTAS" → usa X (el número antes de "CUOTAS")
         * "CUOTA X DE Y" → usa Y (el número después de "DE")
       - PASO 3: Si encuentras múltiples indicadores, usa el número MÁS ALTO encontrado
       - ⚠️ REGLA DE ORO: Si ves "X/Y" en cualquier parte (columna CUOTA o descripción), SIEMPRE usa Y como total de cuotas
     
    * ⚠️⚠️⚠️ CRÍTICO SOBRE EL MONTO EN RESÚMENES BANCARIOS ARGENTINOS:
      - En los resúmenes bancarios argentinos, cuando un consumo está en cuotas, el monto mostrado en la tabla de consumos es generalmente el MONTO DE UNA CUOTA INDIVIDUAL, NO el total
      - 🚫 NUNCA MULTIPLIQUES NI DIVIDAS EL MONTO 🚫
      - TU TRABAJO: Extraer el número EXACTO que aparece en el documento
      - EL SISTEMA se encargará de todos los cálculos después
      - Ejemplos de lo que DEBES hacer:
        * Ves: "FARMACITY 01/03 30.000" → Devuelves: monto: 30000 (tal cual)
        * Ves: "BILLABONG 04/06 14.999,83" → Devuelves: monto: 14999.83 (tal cual)
        * Ves: "MERCADOLIBRE 3 CUOTAS 15.000" → Devuelves: monto: 15000 (tal cual)
      - NO hagas cálculos mentales, NO multipliques, NO dividas - solo EXTRAE el número
     
     * VALORES POR DEFECTO:
       - Si NO encuentras NINGÚN indicador de cuotas en ninguna parte del consumo → cuotas: null o 1
       - Si el consumo es un pago único, factura única, o transferencia → cuotas: null o 1
       - Si hay dudas, es mejor poner null o 1 que un número incorrecto
     
     * EJEMPLOS PRÁCTICOS (usa estos como referencia):
       - Columna CUOTA muestra "01/03" → cuotas: 3
       - Columna CUOTA muestra "04/06" → cuotas: 6
       - "MERCADOLIBRE 3 CUOTAS SIN INTERÉS" → cuotas: 3
       - "FALABELLA CUOTA 1/6" → cuotas: 6
       - "COTO CUOTA 2/12" → cuotas: 12
       - "DISCO CUOTA 1 DE 18" → cuotas: 18
       - "JUMBO EN 6 CUOTAS" → cuotas: 6
       - "GARBARINO 12 CUOTAS S/I" → cuotas: 12
       - "PAGO AFIP" → cuotas: null o 1 (no hay indicador de cuotas)
       - "TRANSFERENCIA BANCARIA" → cuotas: null o 1 (pago único)
       - "FACTURA SERVICIOS" → cuotas: null o 1 (pago único)
     
     * ⚠️ RECUERDA: La detección de cuotas es CRÍTICA. Si un consumo está en cuotas y no lo detectas, el usuario tendrá que agregarlo manualmente. Busca EXHAUSTIVAMENTE en todo el texto relacionado con cada consumo, ESPECIALMENTE en la columna CUOTA si existe.

3. IMPUESTOS, COMISIONES Y CARGOS (importante - separar de consumos):
   - Extrae impuestos, comisiones y cargos del período actual
   - Busca secciones como "Impuestos, cargos e intereses", "Comisiones", "Cargos" o similar
   - Ejemplos: "IMPUESTO DE SELLOS", "COMISION CTA PGOLD", "DB IVA", "Intereses", etc.
   - Estos NO van en "transacciones" sino en "impuestos"

3. TOTALES Y SALDOS:
   - Extrae el TOTAL GENERAL del resumen (debe incluir consumos + impuestos + comisiones)
   - Busca secciones como "Total a pagar", "Total general", "Total del resumen" o similar
   - IMPORTANTE: DETECTA SALDOS A FAVOR:
     * Busca secciones como "Saldo a favor", "A favor", "Crédito a favor", "Saldo positivo", etc.
     * Si hay saldo a favor en ARS o USD, debe restarse del total a pagar
     * Ejemplo: Si el total es 263.47 USD pero hay 6.15 USD a favor, el total real a pagar es 257.32 USD
   - El total debe ser el TOTAL REAL A PAGAR después de descontar saldos a favor
   - Si hay múltiples totales, usa el TOTAL FINAL que incluye todo y considera saldos a favor
   - Extrae información del período de cierre/vencimiento
   
4. TIPO DE DOCUMENTO (IMPORTANTE PARA EL NOMBRE):
   - DETECTA si es un RESUMEN DE TARJETA/CRÉDITO (tiene múltiples consumos, períodos, vencimientos)
   - DETECTA si es un COMPROBANTE ÚNICO (pago AFIP, factura única, recibo, etc.)
   - Si es un resumen de tarjeta: el nombre puede ser "Total del resumen" o similar
   - Si es un comprobante único (pago AFIP, factura, recibo): extrae el nombre específico del documento
     * Ejemplos: "Pago AFIP", "Factura de luz", "Recibo de sueldo", "Pago de servicios", etc.
     * NO uses "Total del resumen" para comprobantes únicos, usa el tipo de documento detectado

═══════════════════════════════════════════════════════════════════
📤 FORMATO DE RESPUESTA JSON
═══════════════════════════════════════════════════════════════════

{
  "tarjeta": {
    "banco": "nombre del banco o null si no se encuentra",
    "tipo_tarjeta": "Visa/Mastercard/Amex/CreditCard u otro, o null",
    "ultimos_digitos": "últimos dígitos visibles o null",
    "nombre_titular": "nombre del titular si está visible o null"
  },
  "transacciones": [
    {
      "descripcion": "descripción exacta del consumo (ej: nombre del comercio, descripción del consumo)",
      "monto": número decimal usando PUNTO (.) como separador decimal, SIN puntos de miles (⚠️⚠️⚠️ CRÍTICO - LEE ESTO CUIDADOSAMENTE: 
        - REGLA ABSOLUTA: SIEMPRE devuelve el monto TAL CUAL aparece en el resumen, SIN MULTIPLICAR POR NADA
        - El monto mostrado en el resumen es el valor de UNA CUOTA INDIVIDUAL cuando hay cuotas
        - NUNCA multipliques el monto por el número de cuotas - el sistema lo hará automáticamente
        - Ejemplos:
          * Si ves "BILLABONG 01/03 14.999,83" → devuelve monto: 14999.83 (SIN multiplicar)
          * Si ves "BILLABONG 04/06 14.999,83" → devuelve monto: 14999.83 (SIN multiplicar)
          * Si ves "FARMACITY 04/06 89.998,98" → devuelve monto: 89998.98 (SIN multiplicar)
          * Si ves "MERCADOLIBRE 3 CUOTAS 30.000" → devuelve monto: 30000 (SIN multiplicar)
        - El sistema multiplicará automáticamente según las cuotas detectadas
        - Si NO hay cuotas (cuotas: null o 1), el monto es el monto total del consumo
        - Ejemplos de valores: 15179.99, 6647.26, 3600.00, 14999.83),
      "moneda": "ARS" o "USD" según corresponda,
      "fecha": "YYYY-MM-01" (SIEMPRE el primer día del mes del resumen detectado. Si el vencimiento es en enero, el resumen es de diciembre, entonces usar "YYYY-12-01". Si el vencimiento es en febrero, usar "YYYY-01-01", etc. Formato ISO),
      "categoria": "categoría sugerida según la descripción (ej: Transporte, Telefonía/Internet, Supermercado, etc.)",
      "comercio": "nombre del comercio o establecimiento si está disponible o null",
      "cuotas": número entero o null (⚠️⚠️⚠️ CRÍTICO Y OBLIGATORIO: 
        - PRIMERO: Busca en la columna "CUOTA" de la tabla. Si existe y tiene formato "X/Y":
          * X = cuota actual que se está facturando (1, 2, 3, 4, etc.)
          * Y = TOTAL de cuotas del consumo (3, 6, 12, 18, 24, etc.)
          * IMPORTANTE: Devuelve Y (el número DESPUÉS de la barra) como el total de cuotas
          * Ejemplos: "01/03" → cuotas: 3, "04/06" → cuotas: 6, "02/12" → cuotas: 12
        - Si la columna CUOTA no existe o está vacía, busca en la descripción del consumo.
        - Si detectas cuotas, SIEMPRE devuelve el número TOTAL de cuotas (Y), no la cuota actual (X).
        - Si NO encuentras ningún indicador de cuotas en ninguna parte, usa null o 1.
        - ⚠️ NO PUEDES OMITIR ESTE CAMPO - es fundamental para el funcionamiento del sistema),
      "cuota_actual": número entero o null (⚠️⚠️⚠️ CRÍTICO Y OBLIGATORIO cuando hay formato "X/Y" en CUOTA:
        - Si encuentras formato "X/Y" en la columna CUOTA, DEBES devolver X (la cuota actual)
        - Este campo es ESENCIAL para calcular correctamente las cuotas restantes
        - Ejemplos OBLIGATORIOS:
          * "01/03" → cuota_actual: 1, cuotas: 3
          * "04/06" → cuota_actual: 4, cuotas: 6
          * "02/12" → cuota_actual: 2, cuotas: 12
        - Si NO hay formato "X/Y", usa null
        - NO confundas X con Y, son números DIFERENTES)
    }
  ],
  "impuestos": [
    {
      "descripcion": "descripción exacta del impuesto, comisión o cargo (ej: 'IMPUESTO DE SELLOS', 'COMISION CTA PGOLD', 'DB IVA 21%')",
      "monto": número decimal usando PUNTO (.) como separador decimal, SIN puntos de miles (ej: 1000.65, 35454.55, 7445.46),
      "moneda": "ARS" o "USD" según corresponda,
      "fecha": "YYYY-MM-DD" (fecha del impuesto/comisión si está visible, o fecha de cierre del resumen, formato ISO)"
    }
  ],
  "total": {
    "monto": número decimal (TOTAL REAL A PAGAR después de descontar saldos a favor. Si hay saldo a favor, debe restarse del total. Formato estándar con punto decimal, SIN puntos de miles),
    "moneda": "ARS" o "USD",
    "periodo": "fecha de cierre o período del resumen (ej: '2025-11-20' o 'Noviembre 2025')",
    "mes_resumen": "YYYY-MM" (mes del resumen detectado basándose en el vencimiento. Si vence en enero, es 'YYYY-12'. Si vence en febrero, es 'YYYY-01', etc.)",
    "saldo_a_favor_ars": número decimal o null (si hay saldo a favor en ARS, indicar el monto. Si no hay, null),
    "saldo_a_favor_usd": número decimal o null (si hay saldo a favor en USD, indicar el monto. Si no hay, null),
    "tipo_documento": "resumen_tarjeta" o "comprobante_unico" (detecta si es un resumen con múltiples consumos o un comprobante único como pago AFIP, factura, etc.),
    "nombre_sugerido": "string" (nombre sugerido para el gasto. Si es resumen_tarjeta: "Total del resumen - [periodo]". Si es comprobante_unico: el tipo de documento detectado, ej: "Pago AFIP", "Factura de luz", etc.)
  }
}

═══════════════════════════════════════════════════════════════════
✅ EJEMPLOS DE CONVERSIÓN CORRECTA
═══════════════════════════════════════════════════════════════════

Entrada en documento: "15.179,99" → Salida en JSON: 15179.99
Entrada en documento: "6.647,26" → Salida en JSON: 6647.26
Entrada en documento: "3.600,00" → Salida en JSON: 3600.00
Entrada en documento: "13.662,00" → Salida en JSON: 13662.00
Entrada en documento: "1.398,18" → Salida en JSON: 1398.18
Entrada en documento: "40.487,43" → Salida en JSON: 40487.43

═══════════════════════════════════════════════════════════════════
🎯 IMPORTANTE
═══════════════════════════════════════════════════════════════════

- Lee cada número CAREFULMENTE, identificando dónde están los decimales
- Si el número tiene coma al final con 2 dígitos → es decimal
- Convierte TODOS los montos a formato estándar (punto decimal, sin puntos de miles)
- Solo incluye CONSUMOS del período actual, NO pagos ni ajustes anteriores
- Las fechas deben estar en formato YYYY-MM-DD

⚠️⚠️⚠️ VERIFICACIÓN FINAL OBLIGATORIA ANTES DE RESPONDER:
1. ⚠️⚠️⚠️ ¿Cuántas filas de consumos contaste en la tabla visible? ¿Extraje una transacción por cada fila?
2. ⚠️⚠️⚠️ ¿Extraíste TODOS los consumos VISIBLES? Revisa que no te hayas perdido ninguno (incluyendo BILLABONG, FARMACITY, PEDIDOSYA, AMAZON, MERPAGO, EDENOR, etc.)
3. ⚠️⚠️⚠️ Si la imagen está recortada, ¿extraje TODOS los consumos de la parte visible, no solo el primero?
4. ¿Revisaste TODAS las secciones visibles del documento (tablas arriba, tablas abajo, etc.)?
5. ¿Revisaste TODAS las páginas visibles del documento?
6. ¿Revisaste TODAS las tarjetas visibles si hay múltiples en el mismo resumen?
7. ⚠️⚠️⚠️ ¿Revisaste la columna "CUOTA" para CADA consumo y extrajiste el número TOTAL de cuotas (el número después de la barra) Y la cuota actual (el número antes de la barra)?
   - Si viste "01/03" → ¿pusiste cuotas: 3, cuota_actual: 1?
   - Si viste "04/06" → ¿pusiste cuotas: 6, cuota_actual: 4?
   - Si viste "02/12" → ¿pusiste cuotas: 12, cuota_actual: 2?
   - Si la columna CUOTA estaba vacía o tenía "-" → ¿pusiste cuotas: null o 1?
8. ¿Incluiste comercios poco comunes o desconocidos (como BILLABONG, FARMACITY, PEDIDOSYA, AMAZON MKTPL, MERPAGO, EDENOR, etc.)?

⚠️ REGLA FINAL: Si un consumo tiene un valor en la columna CUOTA (formato "X/Y"), DEBES incluir el campo "cuotas" con el valor Y (el número después de la barra). NO puedes omitir este campo.

Analiza el documento paso a paso, revisa EXHAUSTIVAMENTE, especialmente la columna CUOTA, y responde SOLO con el JSON, sin texto adicional.`
      } else {
        // Para comprobantes individuales (tickets, facturas)
        prompt = `Analiza este ${documentType} de un comprobante de compra, ticket o factura y extrae la siguiente información en formato JSON:

{
  "descripcion": "descripción del producto o servicio comprado",
  "monto": número (solo el número, sin símbolos),
  "moneda": "ARS" o "USD",
  "fecha": "YYYY-MM-DD" (fecha de la compra, si no está visible usa la fecha actual),
  "categoria": "categoría sugerida (ej: Comida, Transporte, Hogar, etc.)",
  "comercio": "nombre del comercio o establecimiento"
}

Si no puedes identificar algún campo, usa null. Asegúrate de que el monto sea solo el número sin símbolos de moneda ni puntos de miles. La fecha debe estar en formato YYYY-MM-DD.`
      }
    } else if (type === 'ingreso' || type === 'resumen') {
      if (isResumenMultiple) {
        // Para resúmenes bancarios con múltiples ingresos
        prompt = `Analiza este ${documentType} que es un resumen bancario, extracto o resumen con múltiples transacciones de ingresos.

IMPORTANTE CRÍTICO SOBRE FORMATO DE NÚMEROS:
- En Argentina se usa COMA (,) para decimales y PUNTO (.) para miles
- Ejemplo: "15.179,99" significa quince mil ciento setenta y nueve pesos con 99 centavos = 15179.99 (no 1517999)
- Ejemplo: "1.500,50" significa mil quinientos pesos con 50 centavos = 1500.50 (no 150050)
- Convierte TODOS los montos a formato numérico estándar usando punto (.) para decimales y SIN puntos de miles

IMPORTANTE SOBRE FILTRADO Y LIMPIEZA DE DATOS:
- NO incluyas transferencias o depósitos de meses anteriores
- SOLO extrae ingresos del período actual del resumen
- Busca la sección de ingresos o transacciones del período vigente
- ⚠️ IGNORA palabras irrelevantes en la descripción como: "TRANSFERENCIA", "CASH", "PROVEEDOR", "DEPÓSITO", "ABONO", "CRÉDITO", etc.
- ⚠️ EN INGRESOS LO IMPORTANTE ES QUIÉN PAGÓ, NO EL MÉTODO DE PAGO
- ⚠️ Si ves "TRANSFERENCIA DE JUAN PÉREZ", usa solo "JUAN PÉREZ" como descripción
- ⚠️ Si ves "DEPÓSITO CASH - EMPRESA XYZ", usa "EMPRESA XYZ" como descripción
- ⚠️ Si ves "ABONO PROVEEDOR ABC", usa "PROVEEDOR ABC" o mejor aún, extrae el nombre real si está visible
- FOCUS en extraer: nombre de la persona/empresa que pagó, concepto del ingreso (ej: "Salario", "Venta", "Alquiler"), NO el método de pago

Responde en formato JSON con un array "transacciones" que contenga cada ingreso individual encontrado:

{
  "transacciones": [
    {
      "descripcion": "descripción limpia del ingreso sin métodos de pago (ej: Salario, Juan Pérez, Empresa XYZ, Venta de Producto, etc.)",
      "monto": número decimal usando punto (.) como separador decimal, sin puntos de miles (ej: 15179.99, 1500.50),
      "moneda": "ARS" o "USD",
      "fecha": "YYYY-MM-DD" (fecha del ingreso individual del período actual),
      "categoria": "categoría sugerida en ESPAÑOL según la descripción (ej: Salario, Trabajo Freelance, Inversiones, Alquiler, Venta, Reembolso, Intereses Bancarios, Transferencia Personal, etc.) - IMPORTANTE: SIEMPRE en español, NUNCA en inglés",
      "origen": "origen del ingreso (banco, empresa, persona, etc.) - nombre de la entidad/persona que pagó"
    }
  ],
  "total": {
    "monto": número decimal (total de ingresos del período si está visible, formato estándar con punto decimal),
    "moneda": "ARS" o "USD",
    "periodo": "fecha de cierre o período del resumen",
    "mes_resumen": "YYYY-MM" (mes del resumen detectado)
  }
}

EJEMPLOS DE CONVERSIÓN CORRECTA:
- "15.179,99" → 15179.99
- "1.500,50" → 1500.50
- "50.000,00" → 50000.00

EJEMPLOS DE LIMPIEZA DE DESCRIPCIONES:
- "TRANSFERENCIA DE JUAN PÉREZ" → "Juan Pérez"
- "DEPÓSITO CASH - EMPRESA XYZ" → "Empresa XYZ"
- "ABONO PROVEEDOR ABC SRL" → "Proveedor ABC SRL"
- "CRÉDITO SALARIO MES ENERO" → "Salario"
- "TRANSFERENCIA BANCARIA CLIENTE 123" → "Cliente 123"

Si encuentras múltiples ingresos del período actual, inclúyelos todos en el array. NO incluyas ingresos de períodos anteriores. Las fechas deben estar en formato YYYY-MM-DD.`
      } else {
        // Para comprobantes individuales de ingreso
        prompt = `Analiza este ${documentType} de un comprobante de ingreso individual y extrae la siguiente información en formato JSON:

⚠️ IMPORTANTE SOBRE DESCRIPCIONES:
- IGNORA palabras irrelevantes como: "TRANSFERENCIA", "CASH", "PROVEEDOR", "DEPÓSITO", "ABONO", "CRÉDITO"
- EN INGRESOS LO IMPORTANTE ES QUIÉN PAGÓ, NO EL MÉTODO DE PAGO
- Si ves "TRANSFERENCIA DE JUAN PÉREZ", usa solo "Juan Pérez"
- Si ves "DEPÓSITO CASH - EMPRESA XYZ", usa "Empresa XYZ"
- Extrae: nombre de la persona/empresa que pagó, concepto del ingreso

{
  "descripcion": "descripción limpia del ingreso sin métodos de pago (ej: Salario, Juan Pérez, Empresa XYZ, etc.)",
  "monto": número (solo el número, sin símbolos),
  "moneda": "ARS" o "USD",
  "fecha": "YYYY-MM-DD" (fecha del ingreso, si no está visible usa la fecha actual),
  "categoria": "categoría sugerida en ESPAÑOL (ej: Salario, Trabajo Freelance, Inversiones, Alquiler, Venta, Reembolso, Intereses Bancarios, Transferencia Personal, etc.) - IMPORTANTE: SIEMPRE en español, NUNCA en inglés",
  "origen": "origen del ingreso (banco, empresa, persona, etc.) - nombre de la entidad/persona que pagó"
}

Si no puedes identificar algún campo, usa null. Asegúrate de que el monto sea solo el número sin símbolos de moneda ni puntos de miles. La fecha debe estar en formato YYYY-MM-DD.`
      }
    } else {
      prompt = `Analiza esta imagen financiera y extrae información relevante en formato JSON. Identifica si es un gasto o ingreso y extrae:
- descripcion
- monto (número sin símbolos)
- moneda (ARS o USD)
- fecha (YYYY-MM-DD)
- categoria sugerida

Responde solo con el JSON, sin texto adicional.`
    }

    // Convertir base64 a formato que Gemini entienda
    let fileData: string
    let detectedMimeType: string

    if (isPDF) {
      // Para PDFs - extraer solo el base64 sin el prefijo data URL
      fileData = imageBase64.replace(/^data:application\/pdf;base64,/, '').replace(/^data:application\/pdf,/, '')
      detectedMimeType = 'application/pdf'
      
      // Calcular tamaño aproximado del archivo (base64 es ~33% más grande que el original)
      const approxFileSizeMB = (fileData.length * 3) / 4 / 1024 / 1024
      console.log('📄 [API] PDF detectado - tamaño base64:', fileData.length, 'chars (~', approxFileSizeMB.toFixed(2), 'MB)')
      
      // Validar que el base64 sea válido
      if (!fileData || fileData.length === 0) {
        throw new Error('El PDF está vacío o no se pudo extraer el contenido base64')
      }
      
      // Gemini tiene un límite de ~20MB para archivos
      if (approxFileSizeMB > 20) {
        throw new Error(`El PDF es demasiado grande (${approxFileSizeMB.toFixed(2)} MB). El límite es 20 MB. Intenta comprimir el PDF o dividirlo en páginas.`)
      }
      
      if (approxFileSizeMB > 10) {
        console.warn('⚠️ [API] PDF grande detectado - puede tardar más en procesarse')
      }
    } else {
      // Para imágenes
      const imageMatch = imageBase64.match(/data:image\/(\w+);base64,/)
      fileData = imageBase64.replace(/^data:image\/\w+;base64,/, '')
      detectedMimeType = imageMatch ? `image/${imageMatch[1]}` : 'image/jpeg'
      console.log('🖼️ [API] Imagen detectada - mimeType:', detectedMimeType)
    }

    // Usar el mimeType proporcionado o el detectado
    const finalMimeType = mimeType || detectedMimeType
    console.log('📄 [API] MimeType final:', finalMimeType)

    const filePart = {
      inlineData: {
        data: fileData,
        mimeType: finalMimeType
      }
    }

    console.log('📄 [API] Enviando a Gemini...')
    // Llamar a Gemini
    const result = await model.generateContent([prompt, filePart])
    const response = await result.response
    const text = response.text()
    console.log('📄 [API] Respuesta de Gemini recibida - longitud:', text.length)

    // Intentar extraer JSON de la respuesta
    let extractedData
    try {
      // Limpiar la respuesta: eliminar markdown code blocks si existen
      let cleanedText = text.trim()
      
      // Eliminar markdown code blocks (```json ... ``` o ``` ... ```)
      cleanedText = cleanedText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      
      // Buscar el JSON más grande en la respuesta (puede haber texto antes o después)
      // Estrategia: Buscar el primer { y encontrar el } correspondiente balanceado
      const firstBrace = cleanedText.indexOf('{')
      if (firstBrace !== -1) {
        let braceCount = 0
        let lastBrace = -1
        for (let i = firstBrace; i < cleanedText.length; i++) {
          if (cleanedText[i] === '{') braceCount++
          if (cleanedText[i] === '}') {
            braceCount--
            if (braceCount === 0) {
              lastBrace = i
              break
            }
          }
        }
        if (lastBrace !== -1) {
          const jsonCandidate = cleanedText.substring(firstBrace, lastBrace + 1)
          try {
            extractedData = JSON.parse(jsonCandidate)
            console.log('✅ [API] JSON extraído exitosamente usando balanceo de llaves')
          } catch (e) {
            console.log('⚠️ [API] Balanceo de llaves falló, intentando regex...')
            // Fallback: usar regex
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              extractedData = JSON.parse(jsonMatch[0])
              console.log('✅ [API] JSON extraído exitosamente usando regex')
            } else {
              throw new Error('No se encontró JSON válido en la respuesta')
            }
          }
        } else {
          throw new Error('No se encontró JSON balanceado en la respuesta')
        }
      } else {
        // Si no hay {, intentar parsear directamente
        extractedData = JSON.parse(cleanedText)
        console.log('✅ [API] JSON parseado directamente')
      }
    } catch (parseError: any) {
      console.error('❌ [API] Error parsing Gemini response:', parseError)
      console.error('❌ [API] Response text (primeros 1000 chars):', text.substring(0, 1000))
      console.error('❌ [API] Response text (últimos 500 chars):', text.substring(Math.max(0, text.length - 500)))
      return NextResponse.json(
        { 
          error: 'No se pudo extraer información estructurada del documento',
          details: parseError.message || 'Error al parsear la respuesta de la IA'
        },
        { status: 500 }
      )
    }

    // Si la respuesta contiene un array de transacciones (resumen múltiple)
    if (extractedData.transacciones && Array.isArray(extractedData.transacciones)) {
      console.log('📄 [API] Resumen múltiple detectado - transacciones:', extractedData.transacciones.length)
      
      // Función mejorada para convertir montos argentinos
      const parseMontoArgentino = (monto: any): number | null => {
        if (!monto) return null
        
        const montoStr = String(monto).trim()
        
        // Si ya es un número válido, devolverlo
        if (typeof monto === 'number' && !isNaN(monto)) {
          return monto
        }
        
        // Remover símbolos de moneda y espacios
        let cleaned = montoStr.replace(/[^\d,.-]/g, '').trim()
        
        // Detectar si tiene coma decimal (formato argentino: 15.179,99)
        if (cleaned.includes(',')) {
          // Separar por coma
          const parts = cleaned.split(',')
          if (parts.length === 2) {
            // La coma es decimal, quitar puntos de miles y usar punto decimal
            const enteros = parts[0].replace(/\./g, '')
            const decimales = parts[1].padEnd(2, '0').substring(0, 2) // Asegurar 2 decimales
            return parseFloat(`${enteros}.${decimales}`)
          }
        }
        
        // Si no tiene coma pero tiene puntos, pueden ser miles (formato: 1517999 o 1.517.999)
        if (cleaned.includes('.')) {
          // Contar puntos - si hay muchos, probablemente son miles
          const puntos = (cleaned.match(/\./g) || []).length
          if (puntos > 0) {
            // Quitar puntos y tratar como número entero
            cleaned = cleaned.replace(/\./g, '')
          }
        }
        
        const result = parseFloat(cleaned)
        return isNaN(result) ? null : result
      }
      
      // Procesar cada transacción individual
      const cleanedTransactions = extractedData.transacciones.map((trans: any, index: number) => {
        const cleaned: any = {}
        
        if (trans.descripcion) {
          cleaned.descripcion = String(trans.descripcion).trim()
        }
        
        if (trans.monto) {
          cleaned.monto = parseMontoArgentino(trans.monto)
        }
        
        if (trans.moneda) {
          const moneda = String(trans.moneda).toUpperCase()
          cleaned.moneda = (moneda === 'USD' || moneda === 'ARS') ? moneda : 'ARS'
        } else {
          cleaned.moneda = 'ARS'
        }
        
        // NOTA: El monto viene tal cual del resumen (valor de UNA cuota si hay cuotas)
        // El frontend se encargará de multiplicarlo según las cuotas restantes
        
        if (trans.fecha) {
          const fechaStr = String(trans.fecha)
          if (fechaStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            cleaned.fecha = fechaStr
          } else {
            try {
              const fecha = new Date(fechaStr)
              if (!isNaN(fecha.getTime())) {
                cleaned.fecha = fecha.toISOString().split('T')[0]
              } else {
                cleaned.fecha = new Date().toISOString().split('T')[0]
              }
            } catch {
              cleaned.fecha = new Date().toISOString().split('T')[0]
            }
          }
        } else {
          cleaned.fecha = new Date().toISOString().split('T')[0]
        }
        
        if (trans.categoria) {
          cleaned.categoria = String(trans.categoria).trim()
        }
        
        if (trans.comercio) {
          cleaned.comercio = String(trans.comercio).trim()
        }
        
        if (trans.origen) {
          cleaned.origen = String(trans.origen).trim()
        }
        
        // Procesar cuotas - CRÍTICO: extraer correctamente del formato "X/Y" o número
        let cuotaActual = null
        let totalCuotas = null
        
        if (trans.cuotas !== null && trans.cuotas !== undefined) {
          const cuotasStr = String(trans.cuotas).trim()
          
          // Si viene en formato "X/Y" (ej: "01/03", "04/06"), extraer ambos números
          if (cuotasStr.includes('/')) {
            const parts = cuotasStr.split('/')
            if (parts.length === 2) {
              const cuotaAct = parseInt(parts[0].trim())
              const total = parseInt(parts[1].trim())
              if (!isNaN(total) && total > 0) {
                totalCuotas = total
                if (!isNaN(cuotaAct) && cuotaAct > 0) {
                  cuotaActual = cuotaAct
                }
                console.log(`📄 [API] Cuotas detectadas en formato X/Y: "${cuotasStr}" → cuota actual: ${cuotaActual}, total: ${totalCuotas}`)
              } else {
                totalCuotas = null
              }
            } else {
              totalCuotas = null
            }
          } else {
            // Si viene como número directo (total de cuotas)
            const cuotasNum = parseInt(cuotasStr)
            if (!isNaN(cuotasNum) && cuotasNum > 0) {
              totalCuotas = cuotasNum
              console.log(`📄 [API] Cuotas detectadas como número: ${cuotasNum}`)
            } else {
              totalCuotas = null
            }
          }
        }
        
        // Si hay cuota_actual en la respuesta, usarla (PRIORIDAD)
        if (trans.cuota_actual !== null && trans.cuota_actual !== undefined) {
          const cuotaAct = parseInt(String(trans.cuota_actual))
          if (!isNaN(cuotaAct) && cuotaAct > 0) {
            cuotaActual = cuotaAct
            console.log(`📄 [API] ✅ cuota_actual encontrada en respuesta: ${cuotaAct}`)
          }
        }
        
        cleaned.cuotas = totalCuotas
        cleaned.cuota_actual = cuotaActual
        
        // LOG DETALLADO PARA DEBUGGING
        if (totalCuotas && totalCuotas > 1) {
          console.log(`📄 [API] ⚠️ TRANSACCIÓN CON CUOTAS:`)
          console.log(`   - Descripción: "${cleaned.descripcion}"`)
          console.log(`   - Monto (unitario): ${cleaned.monto}`)
          console.log(`   - Total de cuotas: ${cleaned.cuotas}`)
          console.log(`   - Cuota actual: ${cleaned.cuota_actual || 'NO DETECTADA'}`)
          console.log(`   - Datos originales de IA - cuotas: "${trans.cuotas}", cuota_actual: "${trans.cuota_actual}"`)
          if (!cuotaActual) {
            console.log(`   - ⚠️ WARNING: cuota_actual NO fue detectada por la IA!`)
          }
        } else {
          console.log(`📄 [API] Transacción sin cuotas - descripción: "${cleaned.descripcion}", monto: ${cleaned.monto}`)
        }
        
        return cleaned
      }).filter((t: any) => t.descripcion && t.monto) // Filtrar transacciones válidas
      
      // Procesar impuestos si existen
      let cleanedImpuestos: any[] = []
      if (extractedData.impuestos && Array.isArray(extractedData.impuestos)) {
        cleanedImpuestos = extractedData.impuestos.map((imp: any) => {
          const cleaned: any = {}
          
          if (imp.descripcion) {
            cleaned.descripcion = String(imp.descripcion).trim()
          }
          
          if (imp.monto) {
            cleaned.monto = parseMontoArgentino(imp.monto)
          }
          
          if (imp.moneda) {
            const moneda = String(imp.moneda).toUpperCase()
            cleaned.moneda = (moneda === 'USD' || moneda === 'ARS') ? moneda : 'ARS'
          } else {
            cleaned.moneda = 'ARS'
          }
          
          if (imp.fecha) {
            const fechaStr = String(imp.fecha)
            if (fechaStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              cleaned.fecha = fechaStr
            } else {
              try {
                const fecha = new Date(fechaStr)
                if (!isNaN(fecha.getTime())) {
                  cleaned.fecha = fecha.toISOString().split('T')[0]
                } else {
                  cleaned.fecha = new Date().toISOString().split('T')[0]
                }
              } catch {
                cleaned.fecha = new Date().toISOString().split('T')[0]
              }
            }
          } else {
            cleaned.fecha = new Date().toISOString().split('T')[0]
          }
          
          return cleaned
        }).filter((imp: any) => imp.descripcion && imp.monto) // Filtrar impuestos válidos
      }
      
      // Procesar total si existe
      const cleanedTotal: any = {}
      if (extractedData.total) {
        if (extractedData.total.monto) {
          cleanedTotal.monto = parseMontoArgentino(extractedData.total.monto)
        }
        if (extractedData.total.moneda) {
          const moneda = String(extractedData.total.moneda).toUpperCase()
          cleanedTotal.moneda = (moneda === 'USD' || moneda === 'ARS') ? moneda : 'ARS'
        }
        if (extractedData.total.periodo) {
          cleanedTotal.periodo = String(extractedData.total.periodo).trim()
        }
      }
      
      // Procesar información de tarjeta si existe
      const cleanedTarjeta: any = {}
      if (extractedData.tarjeta) {
        if (extractedData.tarjeta.banco) {
          cleanedTarjeta.banco = String(extractedData.tarjeta.banco).trim()
        }
        if (extractedData.tarjeta.tipo_tarjeta) {
          cleanedTarjeta.tipo_tarjeta = String(extractedData.tarjeta.tipo_tarjeta).trim()
        }
        if (extractedData.tarjeta.ultimos_digitos) {
          cleanedTarjeta.ultimos_digitos = String(extractedData.tarjeta.ultimos_digitos).trim()
        }
        if (extractedData.tarjeta.nombre_titular) {
          cleanedTarjeta.nombre_titular = String(extractedData.tarjeta.nombre_titular).trim()
        }
      }
      
      return NextResponse.json({
        success: true,
        data: {
          transacciones: cleanedTransactions,
          impuestos: cleanedImpuestos.length > 0 ? cleanedImpuestos : null,
          total: Object.keys(cleanedTotal).length > 0 ? cleanedTotal : null,
          tarjeta: Object.keys(cleanedTarjeta).length > 0 ? cleanedTarjeta : null,
          esResumen: true
        },
        rawResponse: text
      })
    }

    // Formato antiguo: transacción única (mantener compatibilidad)
    const cleanedData: any = {}
    
    if (extractedData.descripcion) {
      cleanedData.descripcion = String(extractedData.descripcion).trim()
    }
    
    if (extractedData.monto) {
      // Limpiar el monto: quitar símbolos, puntos de miles, comas decimales
      const montoStr = String(extractedData.monto)
        .replace(/[^\d,.-]/g, '') // Quitar todo excepto números, comas, puntos y guiones
        .replace(/\./g, '') // Quitar puntos (miles)
        .replace(',', '.') // Convertir coma decimal a punto
      cleanedData.monto = parseFloat(montoStr) || null
    }
    
    if (extractedData.moneda) {
      const moneda = String(extractedData.moneda).toUpperCase()
      cleanedData.moneda = (moneda === 'USD' || moneda === 'ARS') ? moneda : 'ARS'
    } else {
      cleanedData.moneda = 'ARS'
    }
    
    if (extractedData.fecha) {
      // Validar formato de fecha
      const fechaStr = String(extractedData.fecha)
      if (fechaStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        cleanedData.fecha = fechaStr
      } else {
        // Intentar convertir fecha
        try {
          const fecha = new Date(fechaStr)
          if (!isNaN(fecha.getTime())) {
            cleanedData.fecha = fecha.toISOString().split('T')[0]
          } else {
            cleanedData.fecha = new Date().toISOString().split('T')[0]
          }
        } catch {
          cleanedData.fecha = new Date().toISOString().split('T')[0]
        }
      }
    } else {
      cleanedData.fecha = new Date().toISOString().split('T')[0]
    }
    
    if (extractedData.categoria) {
      cleanedData.categoria = String(extractedData.categoria).trim()
    }
    
    if (extractedData.comercio) {
      cleanedData.comercio = String(extractedData.comercio).trim()
    }
    
    if (extractedData.origen) {
      cleanedData.origen = String(extractedData.origen).trim()
    }

    return NextResponse.json({
      success: true,
      data: cleanedData,
      rawResponse: text
    })

  } catch (error: any) {
    console.error('❌ [API] Error procesando archivo:', error)
    console.error('❌ [API] Error stack:', error.stack)
    console.error('❌ [API] Error name:', error.name)
    console.error('❌ [API] Error message:', error.message)
    
    // Detectar errores específicos de Gemini
    let errorMessage = 'Error al procesar el archivo'
    let errorDetails = error.message || 'Error desconocido'
    
    if (error.message?.includes('API key')) {
      errorMessage = 'Error de autenticación con Google Gemini'
      errorDetails = 'Verifica que la API Key de Google Gemini esté configurada correctamente'
    } else if (error.message?.includes('quota') || error.message?.includes('limit')) {
      errorMessage = 'Límite de cuota excedido'
      errorDetails = 'Has alcanzado el límite de uso de la API de Google Gemini. Verifica tu cuota en Google Cloud Console.'
    } else if (error.message?.includes('size') || error.message?.includes('large')) {
      errorMessage = 'Archivo demasiado grande'
      errorDetails = 'El archivo es demasiado grande para procesar. Intenta con un archivo más pequeño o comprime el PDF.'
    } else if (error.message?.includes('PDF') || error.message?.includes('pdf')) {
      errorMessage = 'Error procesando PDF'
      errorDetails = error.message
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        errorType: error.name || 'UnknownError'
      },
      { status: 500 }
    )
  }
}
