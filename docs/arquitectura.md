# Arquitectura del Sistema de Monitoreo IoT - Empresa GG

## Diagrama de Componentes

El siguiente diagrama ilustra el flujo de datos desde la simulación de telemetría en campo hasta la visualización en tiempo real.

```mermaid
graph TD
    subgraph "Capa de Borde (Edge / Campo)"
        M1[Motor A1] --- S[Simulador Node.js]
        M2[Motor B2] --- S
        M3[Motor C3] --- S
    end

    subgraph "Capa de Nube (Supabase)"
        S -- "Inserta datos (Auth: Operador)" --> API[Supabase REST API]
        API -- "Valida RLS" --> DB[(PostgreSQL: lecturas_maquina)]
        DB -- "Dispara Eventos" --> RT[Supabase Realtime]
    end

    subgraph "Capa de Presentación (Aplicación)"
        RT -- "WebSocket (Auth: Supervisor)" --> SUP[Panel Supervisor Node.js]
        RT -- "WebSocket (Auth: Supervisor)" --> WEB[Dashboard Web - Próximamente]
    end

    classDef motor fill:#f9f,stroke:#333,stroke-width:2px;
    classDef cloud fill:#00b4d8,stroke:#03045e,stroke-width:2px,color:#fff;
    classDef db fill:#0077b6,stroke:#03045e,stroke-width:2px,color:#fff;
    
    class M1,M2,M3 motor;
    class API,RT cloud;
    class DB db;