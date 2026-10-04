// src/simulador.js
require('dotenv').config();
const { supabaseClient } = require('./supabaseClient');

const TOTAL_MAQUINAS = 100;
const maquinas = Array.from({ length: TOTAL_MAQUINAS }, (_, i) => {
  const num = String(i + 1).padStart(2, '0');
  return `MAQ-${num}`;
});

async function autenticarSimulador() {
  const email = process.env.OPERADOR_EMAIL;
  const password = process.env.OPERADOR_PASSWORD;

  if (!email || !password) {
    throw new Error("Faltan OPERADOR_EMAIL y/o OPERADOR_PASSWORD en el archivo .env");
  }

  console.log(`Autenticando simulador como [${email}]...`);
  
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw new Error(`Fallo de autenticación: ${error.message}`);
  }

  console.log(`✓ Simulador autenticado exitosamente como Operador (UID: ${data.user.id})`);
}

async function generarLoteTelemetria() {
  const inicioT = Date.now();
  
  // Generar lote de datos para las 100 máquinas
  const lote = maquinas.map(codigo => {
    const temperatura = parseFloat((Math.random() * (95 - 40) + 40).toFixed(2));
    const nivel_vibracion = parseFloat((Math.random() * (15 - 1) + 1).toFixed(2));
    const consumo_energia_kwh = parseFloat((Math.random() * (12 - 2) + 2).toFixed(2));
    const piezas_producidas = Math.floor(Math.random() * 8) + 1; // 1 a 8 piezas cada ciclo
    
    let estado = 'Operativo';
    let alarma = 'Ninguna';
    let tiempo_parada_min = 0;
    let tiempo_operacion_min = 0.08; // ~5 segundos expresados en minutos

    if (temperatura >= 86 || nivel_vibracion >= 11.5) {
      estado = 'Falla';
      alarma = temperatura >= 86 ? 'Sobrecalentamiento Severo' : 'Vibración Excesiva';
      tiempo_parada_min = 0.08;
      tiempo_operacion_min = 0;
    } else if (temperatura >= 80 || nivel_vibracion >= 7.5) {
      estado = 'Alerta';
      alarma = 'Operación cerca del umbral';
    }

    return {
      codigo_maquina: codigo,
      temperatura,
      nivel_vibracion,
      estado,
      piezas_producidas,
      tiempo_operacion_min,
      tiempo_parada_min,
      consumo_energia_kwh,
      alarma
    };
  });

  // Envío en una única transacción HTTP POST autenticada
  const { error } = await supabaseClient
    .from('lecturas_maquina')
    .insert(lote);

  const duracion = Date.now() - inicioT;

  if (error) {
    console.error(`[ERROR LOTE] Fallo al insertar telemetría:`, error.message);
  } else {
    console.log(`[LOTE OK] ${TOTAL_MAQUINAS} máquinas transmitidas en ${duracion}ms | Tasa: ${(TOTAL_MAQUINAS / (duracion / 1000)).toFixed(0)} reg/s`);
  }
}

async function iniciar() {
  try {
    await autenticarSimulador();
    console.log(`Iniciando ciclo de telemetría continua para ${TOTAL_MAQUINAS} máquinas (cada 5s)...`);
    
    // Primer envío inmediato
    await generarLoteTelemetria();
    
    // Envío periódico
    setInterval(generarLoteTelemetria, 5000);
  } catch (err) {
    console.error(`[ERROR CRÍTICO]`, err.message);
    process.exit(1);
  }
}

iniciar();