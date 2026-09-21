// ==========================================================================
// 1. CONFIGURACIÓN Y CLIENTE SUPABASE
// ==========================================================================
const SUPABASE_URL = "https://uduyarryvxxxuayeuwdq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdXlhcnJ5dnh4eHVheWV1d2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNDUyODIsImV4cCI6MjEwNDkyMTI4Mn0.g-QHqAi4D0KLI8NPGBpD78MXAgMh34V-JVbUQ_jHTJQ";

// SEC-05: Uso forzado de sessionStorage
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: window.sessionStorage }
});

let currentUser = null;
let filtroActual = "recientes";
let canalMonitoreo = null;

// ==========================================================================
// 2. INICIALIZACIÓN DE AUTENTICACIÓN Y EVENTOS
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  // SEC-14: Asignación dinámica de eventos (sin inline handlers en HTML)
  const loginForm = document.getElementById("mainLoginForm");
  if (loginForm) loginForm.addEventListener("submit", ejecutarLogin);

  const readingForm = document.getElementById("readingForm");
  if (readingForm) readingForm.addEventListener("submit", registrarLectura);

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => cambiarPestana(btn.dataset.tab, btn));
  });

  document.querySelectorAll("[data-filtro]").forEach(btn => {
    btn.addEventListener("click", () => aplicarFiltro(btn.dataset.filtro));
  });

  const { data: { session } } = await supabaseClient.auth.getSession();
  actualizarUIAuth(session);

  supabaseClient.auth.onAuthStateChange((event, session) => {
    // SEC-05: Evitar recargas innecesarias de UI
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

// SEC-03: Función segura para consultar rol en BD (RLS-backed)
async function obtenerRol() {
  const { data, error } = await supabaseClient.from("perfiles").select("rol").maybeSingle();
  return error || !data ? null : data.rol;
}

async function actualizarUIAuth(session) {
  const loginPanel = document.getElementById("login-panel");
  const dashboardPanel = document.getElementById("dashboard-panel");
  const authSection = document.getElementById("authSection");
  const statusElem = document.getElementById("connectionStatus");
  const btnLogin = document.getElementById("btnLogin");

  if (!session) {
    currentUser = null;
    loginPanel.classList.remove("hidden");
    dashboardPanel.classList.add("hidden");
    authSection.replaceChildren(); // SEC-01: Evitar innerHTML=""
    statusElem.innerText = "● Esperando autenticación...";
    statusElem.style.color = "var(--text-muted)";
    
    if (btnLogin) {
      btnLogin.disabled = false;
      btnLogin.innerText = "Ingresar a Empresa GG";
    }

    if (canalMonitoreo) supabaseClient.removeChannel(canalMonitoreo);

    // SEC-05: Limpiar el DOM al salir
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
    
    // SEC-03: Obtener rol validado de la tabla perfiles
    const userRole = await obtenerRol();
    if (!userRole) {
      await ejecutarLogout();
      return;
    }

    loginPanel.classList.add("hidden");
    dashboardPanel.classList.remove("hidden");

    const tabRegistroBtn = document.getElementById("tab-registro-btn");
    if (userRole === "supervisor") {
      tabRegistroBtn.style.display = "none";
    } else {
      tabRegistroBtn.style.display = "block";
    }
    
    cambiarPestana('tab-vivo', document.querySelector('.tab-btn[data-tab="tab-vivo"]')); 

    // SEC-01: Construcción segura del DOM (sin innerHTML)
    authSection.replaceChildren();
    
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;align-items:center;gap:1rem;font-size:0.85rem;color:#fff;";
    
    const info = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = currentUser.email; 
    
    const rol = document.createElement("span");
    rol.style.cssText = "color:var(--color-orange);text-transform:uppercase;";
    rol.textContent = ` [${userRole}]`; 
    
    info.append(strong, rol);
    
    const btnLogout = document.createElement("button");
    btnLogout.id = "btnLogout";
    btnLogout.className = "btn btn-secondary";
    btnLogout.style.cssText = "padding:0.3rem 0.75rem;font-size:0.75rem;";
    btnLogout.textContent = "Cerrar Sesión";
    btnLogout.addEventListener("click", ejecutarLogout); 
    
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
    tbody.replaceChildren();
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.style.cssText = "padding:1rem;text-align:center;color:#fca5a5;";
    td.textContent = "Error de permisos (RLS) o conexión.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  // Ahora renderTabla es asíncrona porque solicita URLs firmadas
  await renderTabla(data); 

  if (data && data.length > 0) {
    actualizarConsolaKPI(data);
  }
}

// SEC-01 y SEC-04: Renderizado seguro (textContent) y URLs firmadas
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

  // Generar URLs firmadas en lote (bucket privado)
  const paths = lecturas.map(l => l.evidencia_path).filter(Boolean);
  const urls = {};
  if (paths.length) {
    const { data } = await supabaseClient.storage.from("evidencias").createSignedUrls(paths, 300);
    (data || []).forEach(d => { if (d.signedUrl) urls[d.path] = d.signedUrl; });
  }

  const celda = (texto, estilo = "") => {
    const td = document.createElement("td");
    td.style.cssText = "padding:0.6rem;" + estilo;
    td.textContent = texto; // Protege contra XSS (nunca interpreta HTML)
    return td;
  };

  for (const l of lecturas) {
    const estadoLower = String(l.estado).toLowerCase();
    const esAlerta = estadoLower.includes("alerta") || estadoLower.includes("falla");
    const temp = Number(l.temperatura);

    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
    
    tr.appendChild(celda(l.codigo_maquina, "font-weight:600;color:#fff;"));
    tr.appendChild(celda(temp.toFixed(2), `color:${temp > 80 ? "#ef4444" : "inherit"};font-weight:${temp > 80 ? 700 : 400};`));
    tr.appendChild(celda(Number(l.nivel_vibracion).toFixed(2)));
    tr.appendChild(celda(l.estado, `color:${esAlerta ? "#ef4444" : "#10b981"};font-weight:600;text-transform:uppercase;`));

    const tdFoto = celda("");
    const url = urls[l.evidencia_path];
    if (url && new URL(url).protocol === "https:") {
      const a = document.createElement("a");
      a.href = url;
      a.textContent = "Ver Foto";
      a.target = "_blank";
      a.rel = "noopener noreferrer"; // Buena práctica de seguridad en _blank
      a.style.cssText = "color:var(--color-cyan);text-decoration:underline;";
      tdFoto.appendChild(a);
    } else {
      tdFoto.textContent = "-";
    }
    tr.appendChild(tdFoto);

    tr.appendChild(celda(
      new Date(l.fecha_registro).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      "color:var(--text-muted);font-size:0.75rem;"
    ));
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
    // SEC-09: Validación en frontend antes del envío
    const temperatura = parseFloat(document.getElementById("temperatura").value);
    const nivel_vibracion = parseFloat(document.getElementById("nivel_vibracion").value);
    
    if (!Number.isFinite(temperatura) || !Number.isFinite(nivel_vibracion)) {
      throw new Error("Temperatura y vibración deben ser números válidos.");
    }

    let evidenciaPath = null;
    const fileInput = document.getElementById("evidenciaFile");

    // SEC-04 y SEC-08: Validación estricta y guardado de ruta (no URL pública)
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
      const ext = EXT[file.type];
      
      if (!ext) throw new Error("Formato no permitido (solo JPG, PNG o WebP).");
      if (file.size > 5 * 1024 * 1024) throw new Error("La imagen supera los 5 MB.");

      const fileName = `${currentUser.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabaseClient.storage
        .from("evidencias")
        .upload(fileName, file, { contentType: file.type, upsert: false });

      if (uploadErr) throw uploadErr;
      
      evidenciaPath = fileName; 
    }

    const payload = {
      codigo_maquina: document.getElementById("codigo_maquina").value,
      temperatura: temperatura,
      nivel_vibracion: nivel_vibracion,
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