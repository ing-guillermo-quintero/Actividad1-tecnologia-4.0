const supabase = require('./supabaseClient');

const iniciarSupervisor = async () => {
    console.log("🔐 Autenticando perfil Supervisor...");
    
    const { error } = await supabase.auth.signInWithPassword({
        email: process.env.SUPERVISOR_EMAIL,
        password: process.env.SUPERVISOR_PASSWORD,
    });

    if (error) {
        console.error("❌ Error de autenticación:", error.message);
        return;
    }

    console.log("✅ Sesión de Supervisor iniciada.");
    console.log("📡 Centro de monitoreo (Empresa GG) escuchando en tiempo real...\n");
    console.log("---------------------------------------------------------");

    // Suscripción a eventos de INSERCIÓN en la tabla lecturas_maquina
    supabase
        .channel('monitoreo-motores')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'lecturas_maquina' },
            (payload) => {
                const dato = payload.new;
                
                // Lógica para visualizar y resaltar Alertas/Fallas
                if (dato.estado === 'Falla') {
                    console.log(`\x1b[41m\x1b[37m[🔥 PELIGRO: ${dato.estado.toUpperCase()}]\x1b[0m Máquina: ${dato.codigo_maquina}`);
                    console.log(`   └─ Temperatura: ${dato.temperatura}°C | Vibración: ${dato.nivel_vibracion} mm/s`);
                    console.log(`   └─ Acción: APAGADO DE EMERGENCIA. Ver evidencia: ${dato.evidencia_url}\n`);
                } else if (dato.estado === 'Alerta') {
                    console.log(`\x1b[33m[⚠️ ADVERTENCIA: ${dato.estado.toUpperCase()}]\x1b[0m Máquina: ${dato.codigo_maquina}`);
                    console.log(`   └─ Temperatura: ${dato.temperatura}°C | Vibración: ${dato.nivel_vibracion} mm/s`);
                    console.log(`   └─ Acción: Programar revisión. Ver evidencia: ${dato.evidencia_url}\n`);
                } else {
                    // Estado Operativo (Normal)
                    console.log(`\x1b[32m[✅ NORMAL]\x1b[0m Máquina: ${dato.codigo_maquina} (Temp: ${dato.temperatura}°C, Vib: ${dato.nivel_vibracion} mm/s)`);
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log("Conectado exitosamente al canal de telemetría.");
            }
        });
};

iniciarSupervisor();