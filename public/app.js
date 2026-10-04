// ==========================================================================
// 1. CONFIGURACIÓN Y CLIENTE SUPABASE
// ==========================================================================
const SUPABASE_URL = "https://uduyarryvxxxuayeuwdq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdXlhcnJ5dnh4eHVheWV1d2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNDUyODIsImV4cCI6MjEwNDkyMTI4Mn0.g-QHqAi4D0KLI8NPGBpD78MXAgMh34V-JVbUQ_jHTJQ";

// SEC-05: Uso forzado de sessionStorage para aislar el ciclo de vida del token
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: window.sessionStorage }
});

let currentUser = null;
let userRoleGlobal = null;
let maquinaSeleccionada = "todas";
let ordenColumnaActual = "fecha_registro";
let ordenDireccionActual = "DESC";
let filtrosNumericosActivos = [];
let canalMonitoreo = null;
let totalMaquinasGlobal = 0;
let temporizadorActualizacion = null;

// Instancia global del gráfico Chart.js
let instanciaGraficoSupervisor = null;

// ==========================================================================
// 2. INICIALIZACIÓN DE EVENTOS Y AUTENTICACIÓN
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  // SEC-14: Asignación dinámica de eventos (sin inline handlers en HTML)
  const loginForm = document.getElementById("mainLoginForm");
  if (loginForm) loginForm.addEventListener("submit", ejecutarLogin);

  const readingForm = document.getElementById("readingForm");
  if (readingForm) readingForm.addEventListener("submit", registrarLectura);

  const formInforme = document.getElementById("formInformeTecnico");
  if (formInforme) formInforme.addEventListener("submit", subirInformeTecnico);

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => cambiarPestana(btn.dataset.tab, btn));
  });

  // Selector Dinámico de Máquinas (Filtro Historial)
  const selectMaquina = document.getElementById("filtroMaquina");
  if (selectMaquina) {
    selectMaquina.addEventListener("change", (e) => {
      maquinaSeleccionada = e.target.value;
      cargarLecturas();
    });
  }

  // Controles de Ordenamiento
  const btnAplicarOrden = document.getElementById("btnAplicarOrden");
  if (btnAplicarOrden) {
    btnAplicarOrden.addEventListener("click", () => {
      ordenColumnaActual = document.getElementById("ordenColumna").value;
      ordenDireccionActual = document.getElementById("ordenDireccion").value;
      cargarLecturas();
    });
  }

  // Constructor de Filtros Numéricos
  const btnAgregarFiltro = document.getElementById("btnAgregarFiltro");
  if (btnAgregarFiltro) btnAgregarFiltro.addEventListener("click", agregarFiltroNumerico);

  const btnLimpiarFiltros = document.getElementById("btnLimpiarFiltros");
  if (btnLimpiarFiltros) btnLimpiarFiltros.addEventListener("click", limpiarFiltrosNumericos);

  // Selector de Fecha para la Escala Horaria del Gráfico
  const inputGraficoFecha = document.getElementById("inputGraficoFecha");
  if (inputGraficoFecha) {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    inputGraficoFecha.value = `${anio}-${mes}-${dia}`;
    inputGraficoFecha.addEventListener("change", renderizarGraficoSupervisor);
  }

  // Controles del Gráfico del Supervisor
  const selectGraficoVar = document.getElementById("selectGraficoVariable");
  const selectGraficoMaq = document.getElementById("selectGraficoMaquina");
  const selectGraficoEsc = document.getElementById("selectGraficoEscala");

  if (selectGraficoVar) selectGraficoVar.addEventListener("change", renderizarGraficoSupervisor);
  if (selectGraficoMaq) selectGraficoMaq.addEventListener("change", renderizarGraficoSupervisor);
  if (selectGraficoEsc) {
    selectGraficoEsc.addEventListener("change", () => {
      const contenedorFecha = document.getElementById("contenedorFechaGrafico");
      if (contenedorFecha) {
        contenedorFecha.style.display = selectGraficoEsc.value === "horas" ? "flex" : "none";
      }
      renderizarGraficoSupervisor();
    });
  }

  const { data: { session } } = await supabaseClient.auth.getSession();
  actualizarUIAuth(session);

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED") return; 
    actualizarUIAuth(session);
  });
});

// ==========================================================================
// 3. CONTROL DE PANELES Y AUTENTICACIÓN
// ==========================================================================
function cambiarPestana(tabId, btnElement) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  
  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');
  if (btnElement) btnElement.classList.add('active');

  if (tabId === 'tab-supervisor' && instanciaGraficoSupervisor) {
    setTimeout(() => instanciaGraficoSupervisor.resize(), 50);
  }
}

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
    userRoleGlobal = null;
    maquinaSeleccionada = "todas";
    filtrosNumericosActivos = [];

    loginPanel.classList.remove("hidden");
    dashboardPanel.classList.add("hidden");
    authSection.replaceChildren(); // SEC-01: Evitar sinks innerHTML
    
    statusElem.innerText = "● Esperando autenticación...";
    statusElem.style.color = "var(--text-muted)";
    
    if (btnLogin) {
      btnLogin.disabled = false;
      btnLogin.innerText = "Ingresar a Empresa GG";
    }

    if (canalMonitoreo) supabaseClient.removeChannel(canalMonitoreo);
    document.getElementById("lecturasTableBody").replaceChildren();
    document.getElementById("alertBanner").classList.add("hidden");

  } else {
    currentUser = session.user;
    
    const userRole = await obtenerRol();
    if (!userRole) {
      await ejecutarLogout();
      return;
    }
    userRoleGlobal = userRole;

    loginPanel.classList.add("hidden");
    dashboardPanel.classList.remove("hidden");

    // Control RBAC de navegación
    const tabRegistroBtn = document.getElementById("tab-registro-btn");
    const tabSupervisorBtn = document.getElementById("tab-supervisor-btn");

    if (userRole === "supervisor") {
      tabRegistroBtn.style.display = "none";
      tabSupervisorBtn.style.display = "block";
    } else {
      tabRegistroBtn.style.display = "block";
      tabSupervisorBtn.style.display = "none";
    }
    
    cambiarPestana('tab-vivo', document.querySelector('.tab-btn[data-tab="tab-vivo"]')); 

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

    await actualizarSelectoresMaquinas();
    cargarLecturas();
    
    if (userRole === "supervisor") {
      actualizarPanelSupervisor();
    }

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
// 4. GESTIÓN DINÁMICA DE MÁQUINAS (SIN NOMBRES FIJOS)
// ==========================================================================
async function actualizarSelectoresMaquinas() {
  const selectFiltro = document.getElementById("filtroMaquina");
  const selectGrafico = document.getElementById("selectGraficoMaquina");

  const { data, error } = await supabaseClient
    .from("lecturas_maquina")
    .select("codigo_maquina");

  const poblarSelect = (selectElement, valorActual) => {
    if (!selectElement) return;
    selectElement.replaceChildren();

    const optDefault = document.createElement("option");
    optDefault.value = "todas";
    optDefault.textContent = "Todas las máquinas";
    selectElement.appendChild(optDefault);

    if (error || !data || data.length === 0) return;

    const maquinasUnicas = [...new Set(data.map(d => d.codigo_maquina))].sort();
    totalMaquinasGlobal = maquinasUnicas.length;

    maquinasUnicas.forEach(maq => {
      const opt = document.createElement("option");
      opt.value = maq;
      opt.textContent = maq;
      if (maq === valorActual) opt.selected = true;
      selectElement.appendChild(opt);
    });
  };

  poblarSelect(selectFiltro, maquinaSeleccionada);
  poblarSelect(selectGrafico, selectGrafico ? selectGrafico.value : "todas");
}

function agregarFiltroNumerico() {
  const campoSelect = document.getElementById("filtroCampo");
  const operadorSelect = document.getElementById("filtroOperador");
  const valorInput = document.getElementById("filtroValor");

  const campo = campoSelect.value;
  const campoTexto = campoSelect.options[campoSelect.selectedIndex].text;
  const operador = operadorSelect.value;
  const valor = parseFloat(valorInput.value);

  if (!Number.isFinite(valor)) {
    alert("Por favor ingrese un valor numérico válido.");
    return;
  }

  const nuevoFiltro = {
    id: crypto.randomUUID(),
    campo,
    operador,
    valor,
    label: `${campoTexto} ${operador} ${valor}`
  };

  filtrosNumericosActivos.push(nuevoFiltro);
  valorInput.value = "";
  renderizarChipsFiltros();
  cargarLecturas();
}

function removerFiltroNumerico(id) {
  filtrosNumericosActivos = filtrosNumericosActivos.filter(f => f.id !== id);
  renderizarChipsFiltros();
  cargarLecturas();
}

function limpiarFiltrosNumericos() {
  filtrosNumericosActivos = [];
  renderizarChipsFiltros();
  cargarLecturas();
}

function renderizarChipsFiltros() {
  const container = document.getElementById("chipsFiltrosContainer");
  container.replaceChildren();

  filtrosNumericosActivos.forEach(f => {
    const chip = document.createElement("span");
    chip.style.cssText = "display:inline-flex;align-items:center;gap:0.4rem;padding:0.3rem 0.6rem;background:var(--bg-surface-elevated);border:1px solid var(--border-color);border-radius:20px;font-size:0.75rem;color:#fff;";
    
    const texto = document.createElement("span");
    texto.textContent = f.label;
    
    const btnQuitar = document.createElement("button");
    btnQuitar.textContent = "✕";
    btnQuitar.style.cssText = "background:transparent;border:none;color:#ef4444;font-size:0.75rem;cursor:pointer;padding:0;margin-left:4px;";
    btnQuitar.addEventListener("click", () => removerFiltroNumerico(f.id));

    chip.append(texto, btnQuitar);
    container.appendChild(chip);
  });
}

// ==========================================================================
// 5. HISTORIAL Y TABLAS
// ==========================================================================
async function cargarLecturas() {
  let query = supabaseClient.from("lecturas_maquina").select("*");

  if (maquinaSeleccionada && maquinaSeleccionada !== "todas") {
    query = query.eq("codigo_maquina", maquinaSeleccionada);
  }

  for (const f of filtrosNumericosActivos) {
    if (f.operador === ">") query = query.gt(f.campo, f.valor);
    else if (f.operador === "<") query = query.lt(f.campo, f.valor);
    else if (f.operador === ">=") query = query.gte(f.campo, f.valor);
    else if (f.operador === "<=") query = query.lte(f.campo, f.valor);
  }

  query = query.order(ordenColumnaActual, { ascending: ordenDireccionActual === "ASC" });

  const { data, error } = await query;
  const tbody = document.getElementById("lecturasTableBody");

  if (error) {
    console.error("Error al obtener lecturas:", error);
    tbody.replaceChildren();
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 10;
    td.style.cssText = "padding:1.5rem;text-align:center;color:#fca5a5;";
    td.textContent = "Error al consultar telemetría con los filtros especificados.";
    tr.appendChild(td);
    tbody.appendChild(tr);
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
    td.colSpan = 10;
    td.style.cssText = "padding:1.5rem;text-align:center;color:var(--text-muted)";
    td.textContent = "No hay registros coincidentes con los filtros actuales.";
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
    const esCritico = estadoLower.includes("alerta") || estadoLower.includes("falla");
    const temp = Number(l.temperatura);

    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
    
    tr.appendChild(celda(l.codigo_maquina, "font-weight:600;color:#fff;"));
    tr.appendChild(celda(l.piezas_producidas ?? 0, "font-weight:600;color:var(--color-cyan);"));
    tr.appendChild(celda(Number(l.tiempo_operacion_min).toFixed(1)));
    tr.appendChild(celda(Number(l.tiempo_parada_min).toFixed(1)));
    tr.appendChild(celda(temp.toFixed(2), `color:${temp > 80 ? "#ef4444" : "inherit"};font-weight:${temp > 80 ? 700 : 400};`));
    tr.appendChild(celda(Number(l.nivel_vibracion).toFixed(2)));
    tr.appendChild(celda(Number(l.consumo_energia_kwh).toFixed(2)));
    
    const infoAlarma = l.alarma && l.alarma !== "Ninguna" ? ` | ${l.alarma}` : "";
    tr.appendChild(celda(`${l.estado}${infoAlarma}`, `color:${esCritico ? "#ef4444" : "#10b981"};font-weight:600;`));

    const tdFoto = celda("");
    const url = urls[l.evidencia_path];
    if (url && new URL(url).protocol === "https:") {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
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

function actualizarConsolaKPI(lecturas) {
  if (!lecturas || lecturas.length === 0) return;

  let piezasTotales = 0;
  let consumoTotal = 0;
  let maquinasConReporte = new Set();
  let hayAlertaGlobal = false;
  let mensajeAlerta = "";

  const gridMotores = document.getElementById("motores-grid");
  gridMotores.replaceChildren();

  const ultimasPorMaquina = {};

  lecturas.forEach(l => {
    piezasTotales += Number(l.piezas_producidas || 0);
    consumoTotal += Number(l.consumo_energia_kwh || 0);
    maquinasConReporte.add(l.codigo_maquina);

    if (!ultimasPorMaquina[l.codigo_maquina]) {
      ultimasPorMaquina[l.codigo_maquina] = l;
    }
  });

  const totalMostrado = totalMaquinasGlobal > 0 ? totalMaquinasGlobal : maquinasConReporte.size;

  document.getElementById("kpi-total-piezas").innerText = piezasTotales.toLocaleString();
  document.getElementById("kpi-consumo-total").innerText = `${consumoTotal.toFixed(2)} kWh`;
  document.getElementById("kpi-maquinas-activas").innerText = `${maquinasConReporte.size} / ${totalMostrado}`;

  Object.keys(ultimasPorMaquina).sort().forEach(maq => {
    const d = ultimasPorMaquina[maq];
    const temp = Number(d.temperatura);
    const esAlerta = temp > 80 || d.estado.toLowerCase().includes("alerta") || d.estado.toLowerCase().includes("falla");

    if (esAlerta) {
      hayAlertaGlobal = true;
      mensajeAlerta += `[${maq}: ${d.estado}] `;
    }

    const card = document.createElement("div");
    card.className = "metric-box";

    const title = document.createElement("span");
    title.className = "metric-label";
    title.style.cssText = "font-weight:bold;color:var(--color-cyan);";
    title.textContent = maq;

    const val = document.createElement("span");
    val.className = "metric-val";
    val.style.color = esAlerta ? "#ef4444" : "#fff";
    val.textContent = `${temp.toFixed(1)} °C`;

    const sub1 = document.createElement("span");
    sub1.className = "metric-sub";
    sub1.textContent = `Vibración: ${Number(d.nivel_vibracion).toFixed(2)} mm/s | ${d.piezas_producidas} pzs`;

    const sub2 = document.createElement("span");
    sub2.className = "metric-sub";
    sub2.style.cssText = `margin-top:0.4rem;font-weight:bold;color:${esAlerta ? "#ef4444" : "#10b981"};`;
    sub2.textContent = `${d.estado} (${d.alarma || "Normal"})`;

    card.append(title, val, sub1, sub2);
    gridMotores.appendChild(card);
  });

  const alertBanner = document.getElementById("alertBanner");
  const alertText = document.getElementById("alertText");

  if (alertBanner && alertText) {
    if (hayAlertaGlobal) {
      alertBanner.classList.remove("hidden");
      alertText.innerText = `¡ANOMALÍA DETECTADA! ${mensajeAlerta}`;
    } else {
      alertBanner.classList.add("hidden");
    }
  }
}

// ==========================================================================
// 6. MÓDULO SUPERVISOR: BALANCE, GRÁFICO HORARIO DINÁMICO E INFORMES
// ==========================================================================
async function actualizarPanelSupervisor() {
  if (userRoleGlobal !== "supervisor") return;

  // 1. Obtener KPIs consolidados de costos y conteo dinámico de máquinas
  const { data: resumen, error: errResumen } = await supabaseClient.rpc("obtener_resumen_supervisor", { horas_atras: 24 });
  if (!errResumen && resumen) {
    document.getElementById("kpi-sup-piezas").innerText = Number(resumen.piezas_totales).toLocaleString();
    document.getElementById("kpi-sup-costo-energia").innerText = `$${Number(resumen.costo_energia_total).toFixed(2)}`;
    document.getElementById("kpi-sup-costo-parada").innerText = `$${Number(resumen.costo_paradas_total).toFixed(2)}`;
    
    document.getElementById("kpi-sup-maquinas").innerText = `${resumen.maquinas_activas} / ${resumen.maquinas_totales}`;
    totalMaquinasGlobal = resumen.maquinas_totales;
  }

  // 2. Evaluar anomalías del motor analítico
  const { data: alertas, error: errAlertas } = await supabaseClient.rpc("detectar_alertas_complejas");
  const banner = document.getElementById("bannerAlertasComplejas");
  const lista = document.getElementById("listaAlertasComplejas");

  if (!errAlertas && alertas && alertas.length > 0) {
    lista.replaceChildren();
    alertas.forEach(a => {
      const li = document.createElement("li");
      li.style.cssText = "display: flex; align-items: center; gap: 0.5rem;";
      
      const tag = document.createElement("strong");
      tag.style.color = a.severidad === "CRITICO" ? "#ef4444" : "#f59e0b";
      tag.textContent = `[${a.maquina} | ${a.tipo_alerta}]`;

      const desc = document.createElement("span");
      desc.textContent = a.descripcion;

      li.append(tag, desc);
      lista.appendChild(li);
    });
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }

  // 3. Renderizar gráfico interactivo
  await renderizarGraficoSupervisor();

  // 4. Cargar repositorio documental
  await cargarTablaInformes();
}

async function renderizarGraficoSupervisor() {
  const canvas = document.getElementById("canvasGraficoSupervisor");
  if (!canvas || typeof Chart === "undefined") return;

  const selectVariable = document.getElementById("selectGraficoVariable");
  const selectMaquina = document.getElementById("selectGraficoMaquina");
  const selectEscala = document.getElementById("selectGraficoEscala");
  const inputFecha = document.getElementById("inputGraficoFecha");

  const variable = selectVariable ? selectVariable.value : "piezas_producidas";
  const maquina = selectMaquina ? selectMaquina.value : "todas";
  const escala = selectEscala ? selectEscala.value : "horas";
  const fecha = inputFecha ? inputFecha.value : null;

  // Invocación a la función analítica RPC con soporte horario y por fecha
  const { data, error } = await supabaseClient.rpc("obtener_metricas_grafico", {
    p_codigo_maquina: maquina,
    p_escala: escala,
    p_fecha: fecha
  });

  if (error) {
    console.error("Error al obtener datos para el gráfico:", error.message);
    return;
  }

  const series = data || [];
  const labels = series.map(d => d.periodo);
  const valores = series.map(d => Number(d[variable] || 0));

  const metaVariables = {
    piezas_producidas: { label: "Piezas Producidas", color: "#0ea5e9", bg: "rgba(14, 165, 233, 0.15)" },
    costo_energia: { label: "Costo Eléctrico Estimado ($)", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" },
    costo_parada: { label: "Lucro Cesante / Paradas ($)", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
    consumo_energia_kwh: { label: "Consumo Energía (kWh)", color: "#f97316", bg: "rgba(249, 115, 22, 0.15)" },
    tiempo_parada_min: { label: "Tiempo de Parada (min)", color: "#fb7185", bg: "rgba(251, 113, 133, 0.15)" },
    tiempo_operacion_min: { label: "Tiempo de Operación (min)", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)" },
    temperatura_prom: { label: "Temperatura Promedio (°C)", color: "#ec4899", bg: "rgba(236, 72, 153, 0.15)" },
    vibracion_prom: { label: "Vibración Promedio (mm/s)", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.15)" }
  };

  const meta = metaVariables[variable] || { label: "Valor", color: "#0ea5e9", bg: "rgba(14, 165, 233, 0.15)" };

  if (instanciaGraficoSupervisor) {
    instanciaGraficoSupervisor.destroy();
  }

  let subtituloEscala = escala.toUpperCase();
  if (escala === "horas" && fecha) {
    subtituloEscala = `DÍA: ${fecha} (RANGO ACTIVO)`;
  }

  const ctx = canvas.getContext("2d");
  instanciaGraficoSupervisor = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: `${meta.label} [${maquina.toUpperCase()} | ${subtituloEscala}]`,
        data: valores,
        borderColor: meta.color,
        backgroundColor: meta.bg,
        borderWidth: 2,
        tension: 0.2,
        fill: true,
        pointRadius: series.length <= 15 ? 5 : 3,
        pointHoverRadius: 7,
        pointBackgroundColor: meta.color
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: "#f8fafc", font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 } }
        },
        tooltip: {
          backgroundColor: "#0e1726",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
          titleColor: "#f8fafc",
          bodyColor: "#0ea5e9"
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "#94a3b8", font: { family: "'JetBrains Mono', monospace", size: 10 } }
        },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "#94a3b8", font: { family: "'JetBrains Mono', monospace", size: 10 } },
          beginAtZero: true
        }
      }
    }
  });
}

async function subirInformeTecnico(e) {
  e.preventDefault();
  const btn = document.getElementById("btnSubirInforme");
  const status = document.getElementById("statusInforme");
  const fileInput = document.getElementById("informeArchivo");

  btn.disabled = true;
  status.classList.add("hidden");

  try {
    if (fileInput.files.length === 0) throw new Error("Debe adjuntar un archivo.");
    const file = fileInput.files[0];
    
    const extensiones = {
      "application/pdf": "pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx"
    };

    const ext = extensiones[file.type];
    if (!ext) throw new Error("Formato no soportado. Suba archivos PDF, XLSX o DOCX.");
    if (file.size > 10 * 1024 * 1024) throw new Error("El archivo excede el límite permitido de 10 MB.");

    const rutaStorage = `${currentUser.id}/${crypto.randomUUID()}.${ext}`;

    const { error: errUpload } = await supabaseClient.storage
      .from("informes")
      .upload(rutaStorage, file, { contentType: file.type, upsert: false });

    if (errUpload) throw errUpload;

    const payload = {
      titulo: document.getElementById("informeTitulo").value.trim(),
      tipo: document.getElementById("informeTipo").value,
      resumen: document.getElementById("informeResumen").value.trim(),
      documento_path: rutaStorage,
      generado_por: currentUser.id
    };

    const { error: errInsert } = await supabaseClient.from("informes_tecnicos").insert([payload]);
    if (errInsert) throw errInsert;

    status.className = "form-feedback success";
    status.innerText = "✓ Informe técnico radicado en el repositorio seguro.";
    status.classList.remove("hidden");
    
    document.getElementById("formInformeTecnico").reset();
    await cargarTablaInformes();

  } catch (err) {
    status.className = "form-feedback error";
    status.innerText = `Error: ${err.message}`;
    status.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
}

async function cargarTablaInformes() {
  const { data, error } = await supabaseClient
    .from("informes_tecnicos")
    .select("*")
    .order("fecha_registro", { ascending: false });

  const tbody = document.getElementById("tablaInformesBody");
  tbody.replaceChildren();

  if (error || !data || data.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.style.cssText = "padding: 1.5rem; text-align: center; color: var(--text-muted);";
    td.textContent = "No hay informes técnicos registrados.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const paths = data.map(d => d.documento_path);
  const { data: signedData } = await supabaseClient.storage.from("informes").createSignedUrls(paths, 300);
  const mapaUrls = {};
  (signedData || []).forEach(s => { if (s.signedUrl) mapaUrls[s.path] = s.signedUrl; });

  data.forEach(item => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";

    const tdTitulo = document.createElement("td");
    tdTitulo.style.padding = "0.6rem";
    tdTitulo.textContent = item.titulo;

    const tdTipo = document.createElement("td");
    tdTipo.style.padding = "0.6rem";
    tdTipo.textContent = item.tipo;

    const tdResumen = document.createElement("td");
    tdResumen.style.padding = "0.6rem";
    tdResumen.textContent = item.resumen || "-";

    const tdFecha = document.createElement("td");
    tdFecha.style.padding = "0.6rem";
    tdFecha.textContent = new Date(item.fecha_registro).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

    const tdDescarga = document.createElement("td");
    tdDescarga.style.padding = "0.6rem";
    const url = mapaUrls[item.documento_path];
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Descargar";
      a.style.cssText = "color: var(--color-cyan); text-decoration: underline;";
      tdDescarga.appendChild(a);
    } else {
      tdDescarga.textContent = "No disponible";
    }

    tr.append(tdTitulo, tdTipo, tdResumen, tdFecha, tdDescarga);
    tbody.appendChild(tr);
  });
}

// ==========================================================================
// 7. REGISTRO MANUAL DE TELEMETRÍA (OPERADOR)
// ==========================================================================
async function registrarLectura(e) {
  e.preventDefault();
  const btn = document.getElementById("btnSubmitReading");
  const feedback = document.getElementById("formStatus");

  btn.disabled = true;
  feedback.classList.add("hidden");

  try {
    const codigo_maquina = document.getElementById("codigo_maquina").value.trim().toUpperCase();
    const piezas_producidas = parseInt(document.getElementById("piezas_producidas").value, 10);
    const tiempo_operacion_min = parseFloat(document.getElementById("tiempo_operacion_min").value);
    const tiempo_parada_min = parseFloat(document.getElementById("tiempo_parada_min").value);
    const temperatura = parseFloat(document.getElementById("temperatura").value);
    const nivel_vibracion = parseFloat(document.getElementById("nivel_vibracion").value);
    const consumo_energia_kwh = parseFloat(document.getElementById("consumo_energia_kwh").value);
    const estado = document.getElementById("estado").value;
    const alarma = document.getElementById("alarma").value.trim() || "Ninguna";

    if (!Number.isFinite(temperatura) || !Number.isFinite(nivel_vibracion) || !Number.isFinite(consumo_energia_kwh)) {
      throw new Error("Los valores numéricos de variables operativas deben ser válidos.");
    }

    let evidenciaPath = null;
    const fileInput = document.getElementById("evidenciaFile");

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
      codigo_maquina,
      temperatura,
      nivel_vibracion,
      estado,
      piezas_producidas,
      tiempo_operacion_min,
      tiempo_parada_min,
      consumo_energia_kwh,
      alarma
    };

    if (evidenciaPath) payload.evidencia_path = evidenciaPath;

    const { error: insertError } = await supabaseClient.from("lecturas_maquina").insert([payload]);
    if (insertError) throw insertError;

    feedback.className = "form-feedback success";
    feedback.innerText = "✓ Lectura registrada exitosamente.";
    feedback.classList.remove("hidden");

    document.getElementById("readingForm").reset();
    document.getElementById("alarma").value = "Ninguna";
    
    await actualizarSelectoresMaquinas();
    cargarLecturas();

  } catch (err) {
    feedback.className = "form-feedback error";
    feedback.innerText = `Error: ${err.message}`;
    feedback.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
}

// ==========================================================================
// 8. TIEMPO REAL CON THROTTLING
// ==========================================================================
function conectarRealtime() {
  const statusElem = document.getElementById("connectionStatus");

  if (canalMonitoreo) supabaseClient.removeChannel(canalMonitoreo);

  canalMonitoreo = supabaseClient
    .channel("panel-planta-general")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "lecturas_maquina" },
      () => {
        if (!temporizadorActualizacion) {
          temporizadorActualizacion = setTimeout(async () => {
            await actualizarSelectoresMaquinas();
            cargarLecturas();
            if (userRoleGlobal === "supervisor") {
              actualizarPanelSupervisor();
            }
            temporizadorActualizacion = null;
          }, 2500);
        }
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