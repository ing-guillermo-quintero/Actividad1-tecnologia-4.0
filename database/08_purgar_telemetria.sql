-- database/08_purgar_telemetria.sql
-- ==========================================================================
-- SCRIPT DE PURGADO DE TELEMETRÍA (REESTRUCTURACIÓN)
-- ==========================================================================

-- 1. Vaciar tabla de telemetría e historiales
TRUNCATE TABLE public.lecturas_maquina;

-- 2. Verificación
SELECT COUNT(*) AS total_lecturas FROM public.lecturas_maquina;