const url = process.env.CHECK_NOTIFICATIONS_URL || process.env.NEXT_PUBLIC_APP_URL + '/api/check-and-send-notifications';
const secret = process.env.CRON_SECRET_KEY || process.env.CRON_SECRET;

async function main() {
  console.log('🔔 [Cron] Iniciando verificación de notificaciones...');
  console.log('🔔 [Cron] URL:', url);
  console.log('🔔 [Cron] Secret configurada:', secret ? 'Sí' : 'No');

  if (!url) {
    throw new Error("Falta CHECK_NOTIFICATIONS_URL o NEXT_PUBLIC_APP_URL");
  }
  if (!secret) {
    throw new Error("Falta CRON_SECRET_KEY o CRON_SECRET");
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { 
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
    });

    const text = await res.text();
    console.log("✅ [Cron] Status:", res.status);
    console.log("✅ [Cron] Response:", text);

    if (!res.ok) {
      console.error("❌ [Cron] Error en la respuesta:", text);
      process.exit(1);
    }

    // Intentar parsear JSON si es posible
    try {
      const json = JSON.parse(text);
      console.log("✅ [Cron] Notificaciones procesadas:", json.processed || 0);
      if (json.results) {
        const success = json.results.filter(r => r.success).length;
        const failed = json.results.filter(r => !r.success).length;
        console.log(`✅ [Cron] Exitosas: ${success}, Fallidas: ${failed}`);
      }
    } catch (e) {
      // No es JSON, está bien
    }

    console.log('✅ [Cron] Proceso completado exitosamente');
  } catch (error) {
    console.error('❌ [Cron] Error en la petición:', error.message);
    throw error;
  }
}

main()
  .then(() => {
    console.log('✅ [Cron] Finalizado correctamente');
    process.exit(0);
  })
  .catch((e) => {
    console.error('❌ [Cron] Error fatal:', e);
    process.exit(1);
  });
