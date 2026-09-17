
// 1. CONFIGURACIÓN DE SUPABASE
// Reemplaza con tu URL y tu Clave Anónima (Anon Key) de Supabase
const SUPABASE_URL = "https://uduyarryvxxxuayeuwdq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdXlhcnJ5dnh4eHVheWV1d2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNDUyODIsImV4cCI6MjEwNDkyMTI4Mn0.g-QHqAi4D0KLI8NPGBpD78MXAgMh34V-JVbUQ_jHTJQ";

// Instanciación del cliente de Supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener("DOMContentLoaded", () => {
  // Manejador del formulario de contacto
  const leadForm = document.getElementById("leadForm");
  const submitBtn = document.getElementById("submitBtn");
  const feedback = document.getElementById("formFeedback");

  if (leadForm) {
    leadForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Deshabilitar botón durante el proceso
      submitBtn.disabled = true;
      const originalText = submitBtn.innerText;
      submitBtn.innerText = "Registrando solicitud...";
      hideFeedback();

      // Recopilar datos del formulario
      const formData = {
        nombre: document.getElementById("nombre").value.trim(),
        empresa: document.getElementById("empresa").value.trim() || "No especificada",
        email: document.getElementById("email").value.trim(),
        telefono: document.getElementById("telefono").value.trim(),
        ciudad: document.getElementById("ciudad").value.trim(),
        servicio_interes: document.getElementById("servicio_interes").value,
        descripcion_proyecto: document.getElementById("descripcion_proyecto").value.trim(),
      };

      try {
        // Inserción en la tabla de Supabase
        const { data, error } = await supabaseClient
            .from("solicitudes_contacto")
            .insert([formData]);

        if (error) throw error;

        // Feedback de éxito
        showFeedback(
            "✓ Solicitud radicada con éxito en el sistema de IDAD Engineer. Nuestro equipo técnico evaluará tu requerimiento y se comunicará a la brevedad.",
            "success"
        );
        leadForm.reset();

      } catch (err) {
        console.error("Error al enviar a Supabase:", err);
        showFeedback(
          "⚠️ Ocurrió un error al procesar el envío. Por favor escríbenos directamente a WhatsApp (+57 318 422 6261) o comercial@idad.com.co",
          "error"
        );
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
      }
    });
  }

  // Simulación dinámica de datos de telemetría (Dashboard en vivo)
  iniciarSimulacionTelemetria();

  // Toggle de navegación móvil
  const mobileToggle = document.getElementById("mobileToggle");
  const navLinks = document.getElementById("navLinks");
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener("click", () => {
      navLinks.style.display = navLinks.style.display === "flex" ? "none" : "flex";
      navLinks.style.flexDirection = "column";
      navLinks.style.position = "absolute";
      navLinks.style.top = "100%";
      navLinks.style.left = "0";
      navLinks.style.width = "100%";
      navLinks.style.background = "#070d18";
      navLinks.style.padding = "1.5rem";
    });
  }

  function showFeedback(message, type) {
    feedback.innerText = message;
    feedback.className = `form-feedback ${type}`;
    feedback.classList.remove("hidden");
  }

  function hideFeedback() {
    feedback.innerText = "";
    feedback.className = "form-feedback hidden";
  }

  function iniciarSimulacionTelemetria() {
    const vfdFreq = document.getElementById("vfdFreq");
    const powerFactor = document.getElementById("powerFactor");

    if (vfdFreq && powerFactor) {
      setInterval(() => {
        // Variación sutil de frecuencia de VFD (58.1 Hz - 59.9 Hz)
        const freq = (58.0 + Math.random() * 1.8).toFixed(1);
        vfdFreq.innerText = `${freq} Hz`;

        // Variación sutil del factor de potencia (0.97 - 0.99)
        const fp = (0.97 + Math.random() * 0.02).toFixed(2);
        powerFactor.innerText = `${fp} FP`;
      }, 3500);
    }
  }
});