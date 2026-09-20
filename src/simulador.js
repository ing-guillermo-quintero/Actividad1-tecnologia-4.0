const supabase = require('./supabaseClient');

const generarValor = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(2));

// Nombres exactos que coinciden con las tarjetas del dashboard
const maquinas = ['MOT-A1', 'MOT-B2', 'MOT-C3'];

const iniciarSimulacion = async () => {
    const temperatura = generarValor(70, 90);
    const nivel_vibracion = generarValor(2.0, 12.5);
    
    // Seleccionar una máquina al azar en cada ciclo
    const codigoSeleccionado = maquinas[Math.floor(Math.random() * maquinas.length)];
    
    let estado = 'Operativo';
    let evidencia_url = null;

    if (temperatura >= 85 || nivel_vibracion >= 11.2) {
        estado = 'Falla';
        evidencia_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Warning.svg/512px-Warning.svg.png';
    } else if (temperatura >= 80 || nivel_vibracion >= 7.1) {
        estado = 'Alerta';
        evidencia_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Warning.svg/512px-Warning.svg.png';
    }

    const payload = {
        codigo_maquina: codigoSeleccionado,
        temperatura: temperatura,
        nivel_vibracion: nivel_vibracion,
        estado: estado,
        evidencia_url: evidencia_url
    };

    const { error } = await supabase.from('lecturas_maquina').insert([payload]);

    if (error) {
        console.error('❌ Error al insertar:', error.message);
    } else {
        console.log(`📡 [${new Date().toLocaleTimeString()}] Máquina: ${payload.codigo_maquina} | Temp: ${payload.temperatura}°C | Vib: ${payload.nivel_vibracion} mm/s | Estado: ${payload.estado}`);
    }
};

const iniciarAplicacion = async () => {
    console.log("🔐 Autenticando perfil Operador...");
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email: process.env.OPERADOR_EMAIL, // Asegúrate de tener estas variables en tu archivo .env
        password: process.env.OPERADOR_PASSWORD,
    });

    if (error) {
        console.error("❌ Error de autenticación:", error.message);
        return;
    }

    console.log("✅ Sesión de Operador iniciada. Arrancando motores virtuales...");
    setInterval(iniciarSimulacion, 5000);
};

iniciarAplicacion();