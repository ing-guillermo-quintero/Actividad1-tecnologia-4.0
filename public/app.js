// Configuración de Supabase
const supabaseUrl = 'https://uduyarryvxxxuayeuwdq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdXlhcnJ5dnh4eHVheWV1d2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNDUyODIsImV4cCI6MjEwNDkyMTI4Mn0.g-QHqAi4D0KLI8NPGBpD78MXAgMh34V-JVbUQ_jHTJQ';

// SOLUCIÓN: Usamos "clienteSupabase" para evitar chocar con la librería global "supabase"
const clienteSupabase = supabase.createClient(supabaseUrl, supabaseKey);

// Elementos del DOM
const loginPanel = document.getElementById('login-panel');
const dashboardPanel = document.getElementById('dashboard-panel');
const alertasContainer = document.getElementById('alertas-container');
const errorMsg = document.getElementById('error-msg');

async function iniciarSesion() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    errorMsg.textContent = "Autenticando...";

    const { data, error } = await clienteSupabase.auth.signInWithPassword({ email, password });

    if (error) {
        errorMsg.textContent = "Error: " + error.message;
    } else {
        errorMsg.textContent = "";
        loginPanel.classList.add('hidden');
        dashboardPanel.classList.remove('hidden');
        iniciarMonitoreo();
    }
}

async function cerrarSesion() {
    await clienteSupabase.auth.signOut();
    loginPanel.classList.remove('hidden');
    dashboardPanel.classList.add('hidden');
    alertasContainer.innerHTML = '';
    clienteSupabase.removeAllChannels(); // Detener escucha al salir
}
// Variable global para almacenar el canal activo
let canalMonitoreo = null;

function iniciarMonitoreo() {
    // 1. Si ya existe un canal previo (por recargas rápidas), lo eliminamos
    if (canalMonitoreo) {
        clienteSupabase.removeChannel(canalMonitoreo);
    }

    // 2. Creamos un canal con un identificador único y nos suscribimos
    canalMonitoreo = clienteSupabase.channel('panel-supervisor')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lecturas_maquina' }, payload => {
            mostrarLectura(payload.new);
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log("✅ Conexión en tiempo real establecida exitosamente.");
            }
        });
}

function mostrarLectura(dato) {
    const div = document.createElement('div');
    div.className = `card ${dato.estado.toLowerCase()}`;
    
    let emoji = dato.estado === 'Falla' ? '🔥' : (dato.estado === 'Alerta' ? '⚠️' : '✅');
    let html = `
        <div class="card-title">${emoji} Máquina: ${dato.codigo_maquina} - Estado: ${dato.estado}</div>
        <div>Temperatura: <strong>${dato.temperatura}°C</strong> | Vibración: <strong>${dato.nivel_vibracion} mm/s</strong></div>
        <div style="font-size: 0.8em; color: gray;">Hora: ${new Date(dato.fecha_registro).toLocaleTimeString()}</div>
    `;

    if (dato.evidencia_url) {
        html += `<a href="${dato.evidencia_url}" target="_blank" class="evidencia">📸 Ver Evidencia Fotográfica</a>`;
    }

    div.innerHTML = html;
    // Insertar al principio para ver lo más reciente arriba
    alertasContainer.prepend(div);
}