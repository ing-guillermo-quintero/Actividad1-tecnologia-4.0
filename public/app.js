// ==========================================================================
// 1. CONFIGURACIÓN Y CLIENTE SUPABASE
// ==========================================================================
const SUPABASE_URL = "https://uduyarryvxxxuayeuwdq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdXlhcnJ5dnh4eHVheWV1d2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNDUyODIsImV4cCI6MjEwNDkyMTI4Mn0.g-QHqAi4D0KLI8NPGBpD78MXAgMh34V-JVbUQ_jHTJQ";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let filtroActual = "recientes";
let canalMonitoreo = null;

// ==========================================================================
// 2. INICIALIZACIÓN DE AUTENTICACIÓN
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  // Listener del formulario manual
  const readingForm = document.getElementById("readingForm");
  if (readingForm) readingForm.addEventListener("submit", registrarLectura);

  // Verificar sesión activa inicial
  const { data: { session } } = await supabaseClient.auth.getSession();
  actualizarUIAuth(session);

  // Escuchar cambios de sesión (Login/Logout)
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    actualizarUIAuth(session);
  });
});

// ==========================================================================
// 3. CONTROL DE PANELES (LOGIN / DASHBOARD)
// ==========================================================================
function actualizarUIAuth(session) {
  const loginPanel = document.getElementById("login-panel");
  const dashboardPanel = document.getElementById("dashboard-panel");
  const authSection = document.getElementById("authSection");
  const statusElem = document.getElementById("connectionStatus");

  if (!session) {
    // ESTADO: NO AUTENTICADO
    currentUser = null;
    loginPanel.classList.remove("hidden");
    dashboardPanel.classList.add("hidden");
    authSection.innerHTML = "";
    statusElem.innerText = "● Esperando autenticación...";
    statusElem.style.color = "var(--text-muted)";
    
    // Limpiar canales si cerró sesión
    if (canalMonitoreo) supabaseClient.removeChannel(canalMonitoreo);
    
  } else {
    // ESTADO: AUTENTICADO
    currentUser = session.user;
    loginPanel.classList.add("hidden");
    dashboardPanel.classList.remove("hidden");

    // Determinar rol por metadata o correo
    const userRole = currentUser.user_metadata?.rol || 
                     (currentUser.email.includes("supervisor") ? "supervisor" : "operador");

    authSection.innerHTML = `
      <div style="display: flex; align-items: center; gap: 1rem; font-size: 0.85rem; color: #fff;">
        <span><strong>${currentUser.email}</strong> [<span style="color: var(--color-orange); text-transform: uppercase;">${userRole}</span>]</span>
        <button onclick="ejecutarLogout()" class="btn btn-secondary" style="padding: 0.3rem 0.75rem; font-size: 0.75rem;">Cerrar Sesión</button>
      </div>
    `;

    // Solo cargar datos y sockets cuando la sesión está validada
    cargarLecturas(filtroActual);
    conectarRealtime();
  }
}

async function ejecutarLogin(e) {
  e.preventDefault();
  const btn = document.getElementById("btnLogin");
  const feedback = document.getElementById("loginFeedback");
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  btn.disabled = true;
  feedback.classList.add("hidden");
  btn.innerText = "Autenticando...";

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  
  if (error) {
    feedback.className = "form-feedback error";
    feedback.innerText = "Error: " + error.message;
    feedback.classList.remove("hidden");
    btn.disabled = false;
    btn.innerText = "Ingresar al SCADA";
  }
  // Si es exitoso, el evento onAuthStateChange actualizará la UI automáticamente
}

async function ejecutarLogout() {
  await supabaseClient.auth.signOut();
}

// ==========================================================================
// 4. CONSULTAS Y TABLAS
// ==========================================================================
window.aplicarFiltro = function(tipo) {
  filtroActual = tipo;
  cargarLecturas(tipo);
};

async function cargarLecturas(filtro = "recientes") {
  let query = supabaseClient.from("lecturas_maquina").select("*");

  switch (filtro) {
    case "temp80":
      query = query.gt("temperatura", 80.0).order("temperatura", { ascending: false });
      break;
    case "alerta":
      query = query.ilike("estado", "%alerta%").order("fecha_registro", { ascending: false });
      break;
    case "recientes":
    case "todas":
    default:
      query = query.order("fecha_registro", { ascending: false });
      break;
  }

  const { data, error } = await query;
  const tbody = document.getElementById("lecturasTableBody");

  if (error) {
    console.error("Error al obtener lecturas:", error);
    tbody.innerHTML = `<tr><td colspan="6" style="padding: 1rem; text-align: center; color: #fca5a5;">Error de permisos (RLS) o conexión.</td></tr>`;
    return;
  }

  renderTabla(data);
  if (data && data.length > 0) {
    actualizarConsolaKPI(data[0]);
  }
}

function renderTabla(lecturas) {
  const tbody = document.getElementById("lecturasTableBody");
  tbody.innerHTML = "";

  if (!lecturas || lecturas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No hay lecturas registradas.</td></tr>`;
    return;
  }

  lecturas.forEach((l) => {
    const fecha = new Date(l.fecha_registro).toLocaleString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const isAlerta = l.estado.toLowerCase().includes("alerta") || l.estado.toLowerCase().includes("falla");
    const colorEstado = isAlerta ? "#ef4444" : "#10b981";
    const colorTemp = Number(l.temperatura) > 80 ? "#ef4444" : "inherit";

    const linkFoto = l.evidencia_url 
      ? `<a href="${l.evidencia_url}" target="_blank" style="color: var(--color-cyan); text-decoration: underline;">Ver Foto</a>`
      : `<span style="color: var(--text-muted);">-</span>`;

    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid rgba(255, 255, 255, 0.05)";
    tr.innerHTML = `
      <td style="padding: 0.6rem; font-weight: 600; color: #fff;">${l.codigo_maquina}</td>
      <td style="padding: 0.6rem; color: ${colorTemp}; font-weight: ${Number(l.temperatura) > 80 ? '700' : '400'};">${Number(l.temperatura).toFixed(2)}</td>
      <td style="padding: 0.6rem;">${Number(l.nivel_vibracion).toFixed(2)}</td>
      <td style="padding: 0.6rem; color: ${colorEstado}; font-weight: 600; text-transform: uppercase;">${l.estado}</td>
      <td style="padding: 0.6rem;">${linkFoto}</td>
      <td style="padding: 0.6rem; color: var(--text-muted); font-size: 0.75rem;">${fecha}</td>
    `;
    tbody.appendChild(tr);
  });
}

function actualizarConsolaKPI(ultima) {
  document.getElementById("kpiMaquina").innerText = ultima.codigo_maquina;
  document.getElementById("kpiTemp").innerText = `${Number(ultima.temperatura).toFixed(1)} °C`;
  document.getElementById("kpiVib").innerText = `${Number(ultima.nivel_vibracion).toFixed(2)} mm/s`;
  document.getElementById("kpiEstado").innerText = ultima.estado.toUpperCase();
  document.getElementById("kpiFecha").innerText = new Date(ultima.fecha_registro).toLocaleTimeString();

  const tempVal = Number(ultima.temperatura);
  const esCritico = tempVal > 80 || ultima.estado.toLowerCase().includes("alerta") || ultima.estado.toLowerCase().includes("falla");

  const alertBanner = document.getElementById("alertBanner");
  const alertText = document.getElementById("alertText");

  if (esCritico) {
    alertBanner.classList.remove("hidden");
    alertText.innerText = `¡ANOMALÍA EN ${ultima.codigo_maquina}! Temperatura: ${tempVal}°C | Estado: ${ultima.estado.toUpperCase()}`;
  } else {
    alertBanner.classList.add("hidden");
  }
}

// ==========================================================================
// 5. REGISTRO DE TELEMETRÍA (OPERADOR)
// ==========================================================================
async function registrarLectura(e) {
  e.preventDefault();
  const btn = document.getElementById("btnSubmitReading");
  const feedback = document.getElementById("formStatus");

  btn.disabled = true;
  feedback.classList.add("hidden");

  try {
    let evidenciaUrl = null;
    const fileInput = document.getElementById("evidenciaFile");

    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${document.getElementById("codigo_maquina").value}.${fileExt}`;

      const { data: uploadData, error: uploadErr } = await supabaseClient.storage
        .from("evidencias")
        .upload(fileName, file);

      if (!uploadErr && uploadData) {
        const { data: publicUrlData } = supabaseClient.storage
          .from("evidencias")
          .getPublicUrl(fileName);
        evidenciaUrl = publicUrlData.publicUrl;
      }
    }

    const payload = {
      codigo_maquina: document.getElementById("codigo_maquina").value,
      temperatura: parseFloat(document.getElementById("temperatura").value),
      nivel_vibracion: parseFloat(document.getElementById("nivel_vibracion").value),
      estado: document.getElementById("estado").value
    };

    if (evidenciaUrl) payload.evidencia_url = evidenciaUrl;

    const { error: insertError } = await supabaseClient.from("lecturas_maquina").insert([payload]);
    if (insertError) throw insertError;

    feedback.className = "form-feedback success";
    feedback.innerText = "✓ Lectura registrada exitosamente.";
    feedback.classList.remove("hidden");

    document.getElementById("temperatura").value = "";
    document.getElementById("nivel_vibracion").value = "";
    document.getElementById("evidenciaFile").value = "";

  } catch (err) {
    feedback.className = "form-feedback error";
    feedback.innerText = `Error: ${err.message}`;
    feedback.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
}

// ==========================================================================
// 6. MONITOREO EN TIEMPO REAL (WEBSOCKETS)
// ==========================================================================
function conectarRealtime() {
  const statusElem = document.getElementById("connectionStatus");

  if (canalMonitoreo) supabaseClient.removeChannel(canalMonitoreo);

  canalMonitoreo = supabaseClient
    .channel("panel-supervisor")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "lecturas_maquina" },
      () => {
        cargarLecturas(filtroActual);
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        statusElem.innerText = "● Realtime Conectado";
        statusElem.style.color = "var(--color-green)";
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        statusElem.innerText = "○ Realtime Desconectado";
        statusElem.style.color = "var(--text-muted)";
      }
    });
}