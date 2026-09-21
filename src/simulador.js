require('dotenv').config();
const { supabaseClient } = require('./supabaseClient');

const maquinas = ['MOT-A1', 'MOT-B2', 'MOT-C3', 'MOT-SIM-01'];

async function generarLectura() {
  const codigoSeleccionado = maquinas[Math.floor(Math.random() * maquinas.length)];
  const temperatura = parseFloat((Math.random() * (95 - 40) + 40).toFixed(2));
  const nivel_vibracion = parseFloat((Math.random() * (15 - 1) + 1).toFixed(2));
  
  // SEC-12: Lógica de estados y remoción de evidencia_url
  let estado = 'Operativo';
  if (temperatura >= 85 || nivel_vibracion >= 11.2) estado = 'Falla';
  else if (temperatura >= 80 || nivel_vibracion >= 7.1) estado = 'Alerta';

  const payload = { 
    codigo_maquina: codigoSeleccionado, 
    temperatura, 
    nivel_vibracion, 
    estado 
  };

  const { data, error } = await supabaseClient
    .from('lecturas_maquina')
    .insert([payload]);

  if (error) {
    console.error(`[Error] al enviar lectura de ${codigoSeleccionado}:`, error.message);
  } else {
    console.log(`[OK] Lectura enviada -> ${codigoSeleccionado} | Temp: ${temperatura}°C | Vib: ${nivel_vibracion}mm/s | Estado: ${estado}`);
  }
}

console.log("Iniciando Simulador IoT (Empresa GG)...");
setInterval(generarLectura, 5000);