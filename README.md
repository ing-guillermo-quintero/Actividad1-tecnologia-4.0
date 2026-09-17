# Especificación Técnica de Base de Datos: Tabla `lecturas_maquina`

**Sistema:** Monitoreo IoT / Telemetría Industrial  
**Gestor:** Supabase (PostgreSQL 15+)  
**Última actualización:** 17 de septiembre de 2026  

---

## 1. Propósito
La tabla `lecturas_maquina` está diseñada para registrar series temporales de telemetría y estado operativo de maquinaria física o estaciones de trabajo. Sirve como fuente de verdad para dashboards de monitoreo en tiempo real, análisis predictivo de fallas e históricos de mantenimiento.

---

## 2. Diccionario de Datos

| Nombre del Campo | Tipo de Dato (PostgreSQL) | Restricción / PK | Valor por Defecto | Descripción y Formato |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | **PRIMARY KEY** | `gen_random_uuid()` | Identificador único universal de cada lectura. |
| `codigo_maquina` | `TEXT` | `NOT NULL` | *Ninguno* | Identificador comercial o código interno del equipo (ej. `CNC-01`, `PRENSA-B3`). |
| `temperatura` | `NUMERIC(5, 2)` | `NOT NULL` | *Ninguno* | Temperatura del equipo o componente medido en grados Celsius (°C). Permite hasta 999.99 °C. |
| `nivel_vibracion` | `NUMERIC(5, 2)` | `NOT NULL` | *Ninguno* | Amplitud o velocidad de vibración en mm/s RMS (o g-force según calibración del sensor). |
| `estado` | `TEXT` | `NOT NULL` + `CHECK` | *Ninguno* | Estado operativo restringido a un conjunto de valores controlados. |
| `fecha_registro` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | Marca de tiempo con zona horaria UTC en la que se generó/recibió la lectura. |

---

## 3. Detalle de Campos y Reglas de Negocio

### `id`
* **Tipo:** `UUID` (Identificador Único Universal).
* **Motivo de diseño:** A diferencia de un identificador entero autoincremental (`SERIAL`), el `UUID` previene ataques de enumeración, permite la generación segura de IDs descentralizados en gateways de campo y evita colisiones si se sincronizan lecturas desde múltiples fuentes offline.

### `codigo_maquina`
* **Tipo:** `TEXT`.
* **Convención de nomenclatura:** Usar mayúsculas y guiones (ej. `BOMBA-AGUA-02`, `EXTRUSORA-01`). Evitar espacios en blanco para facilitar filtros en APIs y URLs.

### `temperatura` y `nivel_vibracion`
* **Tipo:** `NUMERIC(5, 2)`.
* **Rango:** Admite valores desde `-999.99` hasta `999.99`.
* **Precisión:** Utilizar `NUMERIC` en lugar de `FLOAT` garantiza precisión decimal exacta sin errores de redondeo de punto flotante.

### `estado`
* **Valores permitidos (Validación por Constraint):**
  * `'operativo'`: Máquina trabajando dentro de parámetros normales.
  * `'alerta'`: Variables operativas cerca de los límites de tolerancia.
  * `'falla'`: Parada por error crítico o sobrecalentamiento.
  * `'mantenimiento'`: Equipo en intervención programada o correctiva.
  * `'apagado'`: Equipo fuera de servicio o desenergizado.

### `fecha_registro`
* **Tipo:** `TIMESTAMPTZ` (`TIMESTAMP WITH TIME ZONE`).
* **Regla:** Siempre almacena y calcula en UTC (`now()`). La conversión a hora local debe gestionarse en la capa de presentación (Frontend/App móvil).

---

## 4. Índices y Rendimiento

Para garantizar respuestas ultrarrápidas al consultar historiales o alimentar gráficos en tiempo real, la tabla cuenta con los siguientes índices:

```sql
-- Acelera filtros por máquina específica
CREATE INDEX idx_lecturas_codigo_maquina ON lecturas_maquina (codigo_maquina);

-- Acelera consultas cronológicas y paginación descendente (últimas lecturas primero)
CREATE INDEX idx_lecturas_fecha_registro ON lecturas_maquina (fecha_registro DESC);
```

---

## 5. Ejemplos de Implementación para Desarrolladores

### Inserción mediante Supabase JS / TS Client

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('TU_SUPABASE_URL', 'TU_SUPABASE_ANON_KEY')

async function registrarLectura() {
  const { data, error } = await supabase
    .from('lecturas_maquina')
    .insert([
      {
        codigo_maquina: 'TORNO-CNC-01',
        temperatura: 68.45,
        nivel_vibracion: 2.15,
        estado: 'operativo'
        // 'id' y 'fecha_registro' se generan automáticamente
      }
    ])
    .select()

  if (error) console.error('Error insertando lectura:', error)
  else console.log('Lectura guardada:', data)
}
```

### Consulta de las últimas 10 lecturas de un equipo

```typescript
const { data, error } = await supabase
  .from('lecturas_maquina')
  .select('*')
  .eq('codigo_maquina', 'TORNO-CNC-01')
  .order('fecha_registro', { ascending: false })
  .limit(10)
```