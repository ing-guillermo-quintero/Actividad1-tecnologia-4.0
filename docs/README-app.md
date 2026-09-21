# ⚡ SCADA Cloud | Supervisión de Maquinaria 4.0

Un sistema web de supervisión, control y adquisición de datos (SCADA) enfocado en la industria 4.0. Permite el monitoreo de telemetría en tiempo real de maquinaria industrial, registro de novedades operativas y control de acceso basado en roles.

---

## 🏗️ Arquitectura y Tecnologías

El proyecto sigue una arquitectura **Serverless** y de cliente ligero (Thin Client), donde el frontend se comunica directamente con los servicios en la nube a través de una API (Backend-as-a-Service).

### Stack Tecnológico
*   **Frontend:** Vanilla JavaScript (ES6), HTML5, CSS3. (No utiliza frameworks de UI, lo que lo hace ligero y rápido).
*   **Backend & Base de Datos:** [Supabase](https://supabase.com/) (PostgreSQL subyacente).
*   **Autenticación:** Supabase Auth (Email/Contraseña).
*   **Tiempo Real:** Supabase Realtime (WebSockets) para la actualización instantánea de la telemetría.
*   **Almacenamiento:** Supabase Storage para el alojamiento de evidencias fotográficas.
*   **Tipografía:** *Plus Jakarta Sans* para UI general y *JetBrains Mono* para datos numéricos y consolas de telemetría (vía Google Fonts).

---

## ⚙️ Funcionalidades Principales

1.  **Autenticación y Control de Acceso (RBAC):**
    *   El sistema está protegido; requiere inicio de sesión para visualizar los datos.
    *   **Rol Supervisor:** Puede monitorear en tiempo real y ver el historial, pero no tiene permisos para registrar nuevas lecturas (la pestaña de registro se oculta automáticamente).
    *   **Rol Operador:** Tiene acceso a la lectura en vivo, historial y posee permisos exclusivos para radicar nuevas lecturas y subir fotografías de la maquinaria.

2.  **Panel de Monitoreo en Vivo (Dashboard):**
    *   Visualización del estado actual de 3 motores principales: *MOT-A1 (Principal), MOT-B2 (Bomba), MOT-C3 (Compresor)*.
    *   Métricas en tiempo real de Temperatura (°C), Vibración (mm/s) y Estado Operativo.
    *   Sistema de alertas visuales: Si un motor supera los 80°C o presenta estado de "Alerta"/"Falla", los indicadores cambian a rojo y se despliega un banner de anomalía global.

3.  **Historial de Telemetría:**
    *   Tabla de registros históricos obtenidos directamente de la base de datos `lecturas_maquina`.
    *   Filtros rápidos para auditar datos: *Todas las lecturas, Temperatura > 80°C, Estado 'Alerta', y Orden Cronológico*.
    *   Acceso directo a los enlaces de las fotografías (evidencias) subidas por los operadores.

4.  **Registro de Novedades (Telemetría Manual):**
    *   Formulario de ingreso de datos para operadores.
    *   Carga de imágenes directo al bucket de Supabase (`evidencias`) generando URLs públicas automáticas.
    - Carga de imágenes al bucket **privado** `evidencias` (ruta `<uid>/<uuid>.<ext>`); la aplicación genera URLs firmadas de 5 minutos para visualizarlas.

        ### Instalación Backend (Supabase)
        Ejecutar en orden en el SQL Editor:
        1. `database/02_seguridad.sql`
        2. `database/03b_rls_endurecimiento.sql`
        3. `database/04_evidencia_path.sql`
        4. `database/05_storage_policies.sql`
        5. `database/06_asignar_roles.sql`

        * Registro público de usuarios **desactivado** en Supabase Auth.
        * RLS activo y Bucket `evidencias` **privado** (5 MB, solo JPG/PNG/WebP).
    *   Prevención de envíos múltiples (deshabilitación de botón) y feedback visual de éxito/error.

---

## 📁 Estructura del Proyecto

El proyecto está estructurado de manera monolítica y directa en tres archivos principales:

```text
/
├── index.html   # Estructura de la aplicación, paneles (Login/Dashboard) y sistema de pestañas.
├── styles.css   # Variables de diseño, sistema de grillas, UI responsive y animaciones (pulso).
└── app.js       # Lógica de la aplicación: Auth, Supabase DB, Storage, Realtime y manipulación del DOM.
```

---

## 🎨 Diseño y Paleta de Colores

El diseño visual está construido para entornos industriales y cuartos de control (Modo Oscuro nativo), utilizando la paleta corporativa de **IDAD ENGINEER S.A.S.**

*   **Fondos (Oscuros/Grafito):**
    *   `--bg-primary`: `#070d18` (Fondo base)
    *   `--bg-surface`: `#0e1726` (Tarjetas y contenedores)
    *   `--bg-surface-elevated`: `#162238` (Elementos elevados/Hover)
*   **Acentos (Identidad y Señalización):**
    *   `--color-orange`: `#f97316` (Naranja eléctrico, principal de la marca)
    *   `--color-cyan`: `#0ea5e9` (Cian tecnológico para destacar hardware)
    *   `--color-green`: `#10b981` (Verde para estado "Operativo" y conexión)
*   **Alertas Críticas:**
    *   Rojo: `#ef4444` (Para temperaturas > 80°C y estados de Falla/Alerta)
    *   Amarillo: `#f59e0b` (Indicadores secundarios)
*   **Texto:** Blanco alto contraste (`#f8fafc`) y gris atenuado (`#94a3b8`) para etiquetas.

---

## 🚀 Despliegue y Configuración

Para poner en marcha este proyecto en un entorno local o productivo:

1. Proveer las credenciales de Supabase en `app.js`:
   * `SUPABASE_URL`
   * `SUPABASE_ANON_KEY`
2. Asegurar que la base de datos de Supabase tenga:
   * Tabla `lecturas_maquina` (con columnas: codigo_maquina, temperatura, nivel_vibracion, estado, evidencia_url, fecha_registro).
   * Storage Bucket llamado `evidencias` configurado como público.
   * Políticas RLS (Row Level Security) configuradas para permitir lectura/escritura según los perfiles de los usuarios.
3. Desplegar mediante cualquier servidor estático (Vercel, Netlify, GitHub Pages, o un servidor Apache/Nginx clásico), ya que la aplicación es 100% frontend estático interactuando con una API en la nube.

