require('dotenv').config();
const { supabaseClient } = require('./supabaseClient');

// SEC-12: Saneamiento de salida de consola
const limpiar = (s) => String(s ?? "").replace(/[\u0000-\u001f\u007f-\u009f]/g, "");

function iniciarSupervision() {
  console.log("Iniciando Consola de Supervisión (Empresa GG)...");

  supabaseClient
    .channel('panel-supervisor')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'lecturas_maquina' },
      (payload) => {
        const dato = payload.new;
        
        // SEC-12: Se usa limpiar() y se lee evidencia_path en lugar de evidencia_url
        console.log(`[NUEVA LECTURA] Máquina: ${limpiar(dato.codigo_maquina)} | Temp: ${dato.temperatura}°C | Estado: ${limpiar(dato.estado)} | Evidencia: ${limpiar(dato.evidencia_path) || "sin foto"}`);
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log("Conectado exitosamente al canal de telemetría.");
      }
    });
}

iniciarSupervision();