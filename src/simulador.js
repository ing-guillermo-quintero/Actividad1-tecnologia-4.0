const supabase = require('./supabaseClient');

const generarValor = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(2));

const iniciarSimulacion = async () => {
    const temperatura = generarValor(70, 90);
    const nivel_vibracion = generarValor(2.0, 12.5);
    
    let estado = 'Operativo';
    let evidencia_url = null;

    if (temperatura >= 85 || nivel_vibracion >= 11.2) {
        estado = 'Falla';
        evidencia_url = 'https://empresagg.com/evidencias/falla_critica_simulada.jpg';
    } else if (temperatura >= 80 || nivel_vibracion >= 7.1) {
        estado = 'Alerta';
        evidencia_url = 'https://empresagg.com/evidencias/alerta_preventiva_simulada.jpg';
    }

    const payload = {
        codigo_maquina: 'MOT-SIM-01',
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
        email: process.env.OPERADOR_EMAIL,
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