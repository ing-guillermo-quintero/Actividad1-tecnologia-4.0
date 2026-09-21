// ==========================================================================
// 1. CONFIGURACIÓN Y CLIENTE SUPABASE
// ==========================================================================
const SUPABASE_URL = "https://uduyarryvxxxuayeuwdq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdXlhcnJ5dnh4eHVheWV1d2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNDUyODIsImV4cCI6MjEwNDkyMTI4Mn0.g-QHqAi4D0KLI8NPGBpD78MXAgMh34V-JVbUQ_jHTJQ";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: window.sessionStorage } // Persistencia segura en sesión
});

let currentUser = null;
let filtroActual = "recientes";
let canalMonitoreo = null;

// ==========================================================================
// 2. INICIALIZACIÓN DE AUTENTICACIÓN
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  const readingForm = document.getElementById("readingForm");
  if (readingForm) readingForm.addEventListener("submit", registrarLectura);

  const { data: { session } } = await supabaseClient.auth.getSession();
  actualizarUIAuth(session);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    actualizarUIAuth(session);
  });
});

// ==========================================================================
// 3. CONTROL DE PANELES (LOGIN / DASHBOARD)
// ==========================================================================
window.cambiarPestana = function(tabId, btnElement) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btnElement.classList.add('active');
};

function actualizarUIAuth(session) {
  const loginPanel = document.getElementById("login-panel");
  const dashboardPanel = document.getElementById("dashboard-panel");
  const authSection = document.getElementById("authSection");
  const statusElem = document.getElementById("connectionStatus");
  const btnLogin = document.getElementById("btnLogin");

  if (!session) {
    currentUser = null;
    loginPanel.classList.remove("hidden");
    dashboardPanel.classList.add("hidden");
    authSection.innerHTML = "";
    statusElem.innerText = "● Esperando autenticación...";
    statusElem.style.color = "var(--text-muted)";
    
    // SOLUCIÓN AL BUG: Restaurar el botón de login al cerrar sesión
    if (btnLogin) {
      btnLogin.disabled = false;
      btnLogin.innerText = "Ingresar a Empresa GG";
    }

    if (canalMonitoreo) supabaseClient.removeChannel(canalMonitoreo);
  } else {
    currentUser = session.user;
    loginPanel.classList.add("hidden");
    dashboardPanel.classList.remove("hidden");

    const userRole = currentUser.user_metadata?.rol || 
                     (currentUser.email.includes("supervisor") ? "supervisor" : "operador");

    const tabRegistroBtn = document.getElementById("tab-registro-btn");
    if (userRole === "supervisor") {
      tabRegistroBtn.style.display = "none";
    } else {
      tabRegistroBtn.style.display = "block";
    }
    
    cambiarPestana('tab-vivo', document.querySelector('.tab-btn')); 

    authSection.innerHTML = `
      <div style="display: flex; align-items: center; gap: 1rem; font-size: 0.85rem; color: #fff;">
        <span><strong>${currentUser.email}</strong> [<span style="color: var(--color-orange); text-transform: uppercase;">${userRole}</span>]</span>
        <button id="btnLogout" class="btn btn-secondary" style="padding: 0.3rem 0.75rem; font-size: 0.75rem;">Cerrar Sesión</button>
      </div>
    `;
    
    // Listener seguro para CSP
    document.getElementById("btnLogout").addEventListener("click", ejecutarLogout);

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
    btn.innerText = "Ingresar Empresa GG";
  }
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

  await renderTabla(data);
  if (data && data.length > 0) {
    actualizarConsolaKPI(data);
  }
}

async function renderTabla(lecturas) {
  const tbody = document.getElementById("lecturasTableBody");
  tbody.replaceChildren();

  if (!lecturas || lecturas.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.style.cssText = "padding:1.5rem;text-align:center;color:var(--text-muted)";
    td.textContent = "No hay lecturas registradas.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const paths = lecturas.map(l => l.evidencia_path).filter(Boolean);
  const urls = {};
  if (paths.length) {
    const { data } = await supabaseClient.storage.from("evidencias").createSignedUrls(paths, 300);
    (data || []).forEach(d => { if (d.signedUrl) urls[d.path] = d.signedUrl; });
  }

  const celda = (texto, estilo = "") => {
    const td = document.createElement("td");
    td.style.cssText = "padding:0.6rem;" + estilo;
    td.textContent = texto;
    return td;
  };

  for (const l of lecturas) {
    const estadoLower = String(l.estado).toLowerCase();
    const esAlerta = estadoLower.includes("alerta") || estadoLower.includes("falla");
    const temp = Number(l.temperatura);

    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid rgba(255, 255, 255, 0.05)";
    tr.appendChild(celda(l.codigo_maquina, "font-weight: 600; color: #fff;"));
    tr.appendChild(celda(temp.toFixed(2), `color: ${temp > 80 ? '#ef4444' : 'inherit'}; font-weight: ${temp > 80 ? '700' : '400'};`));
    tr.appendChild(celda(Number(l.nivel_vibracion).toFixed(2)));
    tr.appendChild(celda(l.estado, `color: ${esAlerta ? '#ef4444' : '#10b981'}; font-weight: 600; text-transform: uppercase;`));

    const tdFoto = celda("");
    const url = urls[l.evidencia_path];
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.textContent = "Ver Foto";
      a.target = "_blank";
      a.style.cssText = "color: var(--color-cyan); text-decoration: underline;";
      tdFoto.appendChild(a);
    } else {
      tdFoto.textContent = "-";
      tdFoto.style.color = "var(--text-muted)";
    }
    tr.appendChild(tdFoto);
    
    const fechaFormateada = new Date(l.fecha_registro).toLocaleString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    tr.appendChild(celda(fechaFormateada, "color: var(--text-muted); font-size: 0.75rem;"));
    
    tbody.appendChild(tr);
  }
}

function actualizarConsolaKPI(lecturasTotales) {
  if (!lecturasTotales || lecturasTotales.length === 0) return;

  const ultimasLecturas = {
    'MOT-A1': null,
    'MOT-B2': null,
    'MOT-C3': null
  };

  for (let l of lecturasTotales) {
    if (ultimasLecturas[l.codigo_maquina] === null) {
      ultimasLecturas[l.codigo_maquina] = l;
    }
  }

  let hayAlertaGlobal = false;
  let mensajeAlerta = "";

  Object.keys(ultimasLecturas).forEach(maquina => {
    const data = ultimasLecturas[maquina];
    if (data) {
      document.getElementById(`temp-${maquina}`).innerText = `${Number(data.temperatura).toFixed(1)} °C`;
      document.getElementById(`vib-${maquina}`).innerText = `Vibración: ${Number(data.nivel_vibracion).toFixed(2)} mm/s`;
      
      const estadoElem = document.getElementById(`estado-${maquina}`);
      estadoElem.innerText = data.estado.toUpperCase();

      const tempVal = Number(data.temperatura);
      const esCritico = tempVal > 80 || data.estado.toLowerCase().includes("alerta") || data.estado.toLowerCase().includes("falla");
      
      if (esCritico) {
        estadoElem.style.color = "#ef4444";
        document.getElementById(`temp-${maquina}`).style.color = "#ef4444";
        hayAlertaGlobal = true;
        mensajeAlerta += `[${maquina}: ${data.estado}] `;
      } else {
        estadoElem.style.color = "#10b981";
        document.getElementById(`temp-${maquina}`).style.color = "var(--text-color)";
      }
    }
  });

  const alertBanner = document.getElementById("alertBanner");
  const alertText = document.getElementById("alertText");

  if (hayAlertaGlobal) {
    alertBanner.classList.remove("hidden");
    alertText.innerText = `¡ANOMALÍA DETECTADA! ${mensajeAlerta}`;
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
    let evidenciaPath = null;
    const fileInput = document.getElementById("evidenciaFile");

    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${document.getElementById("codigo_maquina").value}.${fileExt}`;
      
      // Ajuste de seguridad: subir en carpeta del usuario
      evidenciaPath = `${currentUser.id}/${fileName}`;

      const { data: uploadData, error: uploadErr } = await supabaseClient.storage
        .from("evidencias")
        .upload(evidenciaPath, file);

      if (uploadErr) throw uploadErr;
    }

    const payload = {
      codigo_maquina: document.getElementById("codigo_maquina").value,
      temperatura: parseFloat(document.getElementById("temperatura").value),
      nivel_vibracion: parseFloat(document.getElementById("nivel_vibracion").value),
      estado: document.getElementById("estado").value
    };

    if (evidenciaPath) payload.evidencia_path = evidenciaPath;

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