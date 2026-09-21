-- 1. Agregar CHECK Constraints (SEC-09)
ALTER TABLE public.lecturas_maquina DROP CONSTRAINT IF EXISTS chk_estado;
ALTER TABLE public.lecturas_maquina
    ADD CONSTRAINT chk_estado CHECK (estado in ('Operativo','Alerta','Falla','Mantenimiento')),
    ADD CONSTRAINT chk_codigo_maquina CHECK (codigo_maquina in ('MOT-A1','MOT-B2','MOT-C3', 'MOT-SIM-01')),
    ADD CONSTRAINT chk_temperatura CHECK (temperatura BETWEEN -50 AND 250),
    ADD CONSTRAINT chk_vibracion CHECK (nivel_vibracion BETWEEN 0 AND 100);

-- 2. Limitar permisos (SEC-09)
REVOKE INSERT ON public.lecturas_maquina FROM authenticated;
GRANT INSERT (codigo_maquina, temperatura, nivel_vibracion, estado, evidencia_url) ON public.lecturas_maquina TO authenticated;

-- 3. Configurar Storage Seguro (SEC-04)
UPDATE storage.buckets
SET public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp']
WHERE id = 'evidencias';