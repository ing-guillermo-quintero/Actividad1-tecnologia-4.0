// ==========================================================================
// 1. CONFIGURACIÓN Y CLIENTE SUPABASE
// ==========================================================================
const SUPABASE_URL = "https://uduyarryvxxxuayeuwdq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdXlhcnJ5dnh4eHVheWV1d2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNDUyODIsImV4cCI6MjEwNDkyMTI4Mn0.g-QHqAi4D0KLI8NPGBpD78MXAgMh34V-JVbUQ_jHTJQ";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let filtroActual = "recientes";

// ==========================================================================
// 2. INICIALIZACIÓN
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  await inicializarAutenticacion();
  await cargarLecturas(filtroActual);
  conectarRealtime();

  const readingForm = document.getElementById("readingForm");
  if (readingForm) {
    readingForm.addEventListener("submit", registrarLectura);
  }
});

// ==========================================================================
// 3. PASO 2: AUTENTICACIÓN Y ROLES (OPERADOR / SUPERVISOR)
// ==========================================================================
async function inicializarAutenticacion() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  actualizarUIAuth(session);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    actualizarUIAuth(session);
  });
}

function actualizarUIAuth(session) {
  const authSection = document.getElementById("authSection");
  const btnSubmit = document.getElementById("btnSubmitReading");

  if (!session) {
    currentUser = null;
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerText = "Inicie sesión para registrar telemetría";
    }

    authSection.innerHTML = `
      <form id="inlineLoginForm" style="display: flex; gap: 0.5rem; align-items: center;" onsubmit="ejecutarLogin(event)">
        <input type="email" id="loginEmail" placeholder="correo@empresa.com" required 
               style="background: #060b13; border: 1px solid var(--border-color); color: #fff; padding: 0.35rem 0.6rem; border-radius: 4px; font-size: 0.8rem;" />
        <input type="password" id="loginPassword" placeholder="Contraseña" required 
               style="background: #060b13; border: 1px solid var(--border-color); color: #fff; padding: 0.35rem 0.6rem; border-radius: 4px; font-size: 0.8rem;" />
        <button type="submit" class="btn btn-nav" style="font-size: 0.8rem; padding: 0.35rem 0.8rem;">Entrar</button>
      </form>
    `;
  } else {
    currentUser = session.user;
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerText = "Radicar Lectura en Supabase";
    }

    // Determinar rol por metadata o correo
    const userRole = currentUser.user_metadata?.rol || 
                     (currentUser.email.includes("supervisor") ? "supervisor" : "operador");

    authSection.innerHTML = `
      <div style="display: flex; align-items: center; gap: 1rem; font-size: 0.85rem;">
        <span><strong>${currentUser.email}</strong> [<span style="color: var(--color-orange); text-transform: uppercase;">${userRole}</span>]</span>
        <button onclick="ejecutarLogout()" class="btn btn-secondary" style="padding: 0.3rem 0.75rem; font-size: 0.75rem;">Cerrar Sesión</button>
      </div>
    `;
  }
}

async function ejecutarLogin(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    alert("Error de autenticación: " + error.message);
  }
}

async function ejecutarLogout() {
  await supabaseClient.auth.signOut();
  cargarLecturas(filtroActual);
}

// ==========================================================================
// 4. PASO 1: CONSULTAS SOLICITADAS SOBRE lecturas_maquina
// ==========================================================================
window.aplicarFiltro = function(tipo) {
  filtroActual = tipo;
  cargarLecturas(tipo);
};

async function cargarLecturas(filtro = "recientes") {
  let query = supabaseClient.from("lecturas_maquina").select("*");

  switch (filtro) {
    case "temp80":
      // Consulta b: máquinas con temperatura superior a 80 °C
      query = query.gt("temperatura", 80.0).order("temperatura", { ascending: false });
      break;
    case "alerta":
      // Consulta c: registros cuyo estado sea 'Alerta' (o 'alerta')
      query = query.ilike("estado", "%alerta%").order("fecha_registro", { ascending: false });
      break;
    case "recientes":
    case "todas":
    default:
      // Consulta a y d: orden cronológico descendente
      query = query.order("fecha_registro", { ascending: false });
      break;
  }

  const { data, error } = await query;
  const tbody = document.getElementById("lecturasTableBody");

  if (error) {
    console.error("Error al obtener lecturas:", error);
    tbody.innerHTML = `<tr><td colspan="6" style="padding: 1rem; text-align: center; color: #fca5a5;">Error al cargar datos. Compruebe permisos de RLS.</td></tr>`;
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
    tbody.innerHTML = `<tr><td colspan="6" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No se encontraron lecturas para este criterio.</td></tr>`;
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
      ? `<a href="${l.evidencia_url}" target="_blank" style="color: var(--color-cyan); text-decoration: underline;">Ver Evidencia</a>`
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
// 5. REGISTRO DE TELEMETRÍA Y SUBIDA DE EVIDENCIA (STORAGE)
// ==========================================================================
async function registrarLectura(e) {
  e.preventDefault();
  const btn = document.getElementById("btnSubmitReading");
  const feedback = document.getElementById("formStatus");

  if (!currentUser) {
    feedback.className = "form-feedback error";
    feedback.innerText = "Acceso denegado: debe autenticarse para enviar telemetría.";
    feedback.classList.remove("hidden");
    return;
  }

  btn.disabled = true;
  feedback.classList.add("hidden");

  try {
    let evidenciaUrl = null;
    const fileInput = document.getElementById("evidenciaFile");

    // Subida opcional a Supabase Storage bucket 'evidencias'
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

    if (evidenciaUrl) {
      payload.evidencia_url = evidenciaUrl;
    }

    const { error: insertError } = await supabaseClient
      .from("lecturas_maquina")
      .insert([payload]);

    if (insertError) throw insertError;

    feedback.className = "form-feedback success";
    feedback.innerText = "✓ Lectura registrada exitosamente en Supabase.";
    feedback.classList.remove("hidden");

    document.getElementById("temperatura").value = "";
    document.getElementById("nivel_vibracion").value = "";
    document.getElementById("evidenciaFile").value = "";

  } catch (err) {
    console.error("Error al registrar:", err);
    feedback.className = "form-feedback error";
    feedback.innerText = `Error: ${err.message || "Fallo en la operación"}`;
    feedback.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
}

// ==========================================================================
// 6. TIEMPO REAL (SUPABASE REALTIME)
// ==========================================================================
function conectarRealtime() {
  const statusElem = document.getElementById("connectionStatus");

  supabaseClient
    .channel("public:lecturas_maquina")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "lecturas_maquina" },
      (payload) => {
        // Al llegar un nuevo registro en la base de datos, refrescar tabla y consola
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