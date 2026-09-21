// ==========================================================================
// 1. CONFIGURACIÓN Y CLIENTE SUPABASE
// ==========================================================================
const SUPABASE_URL = "https://uduyarryvxxxuayeuwdq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdXlhcnJ5dnh4eHVheWV1d2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNDUyODIsImV4cCI6MjEwNDkyMTI4Mn0.g-QHqAi4D0KLI8NPGBpD78MXAgMh34V-JVbUQ_jHTJQ";

// Corrección SEC-05: Forzar el uso de sessionStorage
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: window.sessionStorage }
});

let currentUser = null;
let filtroActual = "recientes";
let canalMonitoreo = null;

// ==========================================================================
// 2. INICIALIZACIÓN DE AUTENTICACIÓN Y EVENTOS (SEC-14)
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  
  // Asignar evento al formulario de Login (SEC-14)
  const loginForm = document.getElementById("mainLoginForm");
  if (loginForm) loginForm.addEventListener("submit", ejecutarLogin);

  // Asignar evento al formulario manual (SEC-14)
  const readingForm = document.getElementById("readingForm");
  if (readingForm) readingForm.addEventListener("submit", registrarLectura);

  // Asignar evento a los botones de pestañas (SEC-14)
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => cambiarPestana(btn.dataset.tab, btn));
  });

  // Asignar evento a los botones de filtros (SEC-14)
  document.querySelectorAll("[data-filtro]").forEach(btn => {
    btn.addEventListener("click", () => aplicarFiltro(btn.dataset.filtro));
  });

  // Verificar sesión activa inicial
  const { data: { session } } = await supabaseClient.auth.getSession();
  actualizarUIAuth(session);

  // Escuchar cambios de sesión (Login/Logout)
  supabaseClient.auth.onAuthStateChange((event, session) => {
    // SEC-05: Evitar reinicios innecesarios en la UI al renovar token
    if (event === "TOKEN_REFRESHED") return; 
    actualizarUIAuth(session);
  });
});

// ==========================================================================
// 3. CONTROL DE PANELES (LOGIN / DASHBOARD)
// ==========================================================================
function cambiarPestana(tabId, btnElement) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btnElement.classList.add('active');
}

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
    
    // Restaurar el botón de login al cerrar sesión
    if (btnLogin) {
      btnLogin.disabled = false;
      btnLogin.innerText = "Ingresar a Empresa GG";
    }

    if (canalMonitoreo) supabaseClient.removeChannel(canalMonitoreo);

    // SEC-05: Limpiar el DOM al cerrar sesión para evitar datos residuales
    document.getElementById("lecturasTableBody").replaceChildren();
    ["MOT-A1", "MOT-B2", "MOT-C3"].forEach(m => {
      const tempEl = document.getElementById(`temp-${m}`);
      const vibEl = document.getElementById(`vib-${m}`);
      const estEl = document.getElementById(`estado-${m}`);
      if(tempEl) tempEl.textContent = "-- °C";
      if(vibEl) vibEl.textContent = "Vibración: -- mm/s";
      if(estEl) estEl.textContent = "--";
    });
    document.getElementById("alertBanner").classList.add("hidden");

  } else {
    currentUser = session.user;
    loginPanel.classList.add("hidden");
    dashboardPanel.classList.remove("hidden");

    // NOTA (SEC-03): Para entorno de producción, este rol debería leerse de la BD (tabla perfiles), 
    // no de user_metadata. Se mantiene temporalmente así según avance de remediación.
    const userRole = currentUser.user_metadata?.rol || 
                     (currentUser.email.includes("supervisor") ? "supervisor" : "operador");

    const tabRegistroBtn = document.getElementById("tab-registro-btn");
    if (userRole === "supervisor") {
      tabRegistroBtn.style.display = "none";
    } else {
      tabRegistroBtn.style.display = "block";
    }
    
    cambiarPestana('tab-vivo', document.querySelector('.tab-btn[data-tab="tab-vivo"]')); 

    // SEC-01: Evitar el uso de innerHTML para construir la cabecera (prevención XSS)
    authSection.replaceChildren();
    
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;align-items:center;gap:1rem;font-size:0.85rem;color:#fff;";
    
    const info = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = currentUser.email; // Renderiza como texto seguro
    
    const rol = document.createElement("span");
    rol.style.cssText = "color:var(--color-orange);text-transform:uppercase;";
    rol.textContent = ` [${userRole}]`; // Renderiza como texto seguro
    
    info.append(strong, rol);
    
    const btnLogout = document.createElement("button");
    btnLogout.id = "btnLogout";
    btnLogout.className = "btn btn-secondary";
    btnLogout.style.cssText = "padding:0.3rem 0.75rem;font-size:0.75rem;";
    btnLogout.textContent = "Cerrar Sesión";
    btnLogout.addEventListener("click", ejecutarLogout); // SEC-14 dinámico
    
    wrap.append(info, btnLogout);
    authSection.appendChild(wrap);

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
    btn.innerText = "Ingresar a Empresa GG";
  }
}

async function ejecutarLogout() {
  await supabaseClient.auth.signOut();
}

// ==========================================================================
// 4. CONSULTAS Y TABLAS
// ==========================================================================
function aplicarFiltro(tipo) {
  filtroActual = tipo;
  cargarLecturas(tipo);
}

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
    actualizarConsolaKPI(data);
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

    // SEC-01: Añadido rel="noopener noreferrer" para seguridad al abrir enlaces externos
    const linkFoto = l.evidencia_url 
      ? `<a href="${l.evidencia_url}" target="_blank" rel="noopener noreferrer" style="color: var(--color-cyan); text-decoration: underline;">Ver Foto</a>`
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
    // SEC-09: Validación en frontend antes del envío
    const temperatura = parseFloat(document.getElementById("temperatura").value);
    const nivel_vibracion = parseFloat(document.getElementById("nivel_vibracion").value);
    
    if (!Number.isFinite(temperatura) || !Number.isFinite(nivel_vibracion)) {
      throw new Error("Temperatura y vibración deben ser números válidos.");
    }

    let evidenciaUrl = null;
    const fileInput = document.getElementById("evidenciaFile");

    // SEC-08: Validación estricta de archivos
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
      const ext = EXT[file.type];
      
      // Bloquear formatos peligrosos (ej. .svg o .html disfrazados)
      if (!ext) throw new Error("Formato no permitido (solo JPG, PNG o WebP).");
      
      // Limitar a 5MB el peso del archivo en cliente
      if (file.size > 5 * 1024 * 1024) throw new Error("La imagen supera los 5 MB.");

      // Generar nombre seguro e irrepetible sin depender de inputs de usuario
      const fileName = `${currentUser.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabaseClient.storage
        .from("evidencias")
        .upload(fileName, file, { contentType: file.type, upsert: false });

      if (uploadErr) throw uploadErr;
      
      const { data: publicUrlData } = supabaseClient.storage
        .from("evidencias")
        .getPublicUrl(fileName);
        
      evidenciaUrl = publicUrlData.publicUrl;
    }

    const payload = {
      codigo_maquina: document.getElementById("codigo_maquina").value,
      temperatura: temperatura,
      nivel_vibracion: nivel_vibracion,
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