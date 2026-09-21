-- database/04_evidencia_path.sql
ALTER TABLE public.lecturas_maquina ADD COLUMN IF NOT EXISTS evidencia_path text;
ALTER TABLE public.lecturas_maquina DROP CONSTRAINT IF EXISTS chk_evidencia_path;
ALTER TABLE public.lecturas_maquina ADD CONSTRAINT chk_evidencia_path
    CHECK (evidencia_path IS NULL OR
        evidencia_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');

-- La API deja de poder escribir evidencia_url (columna heredada, solo lectura histórica)
REVOKE INSERT ON public.lecturas_maquina FROM authenticated;
GRANT INSERT (codigo_maquina, temperatura, nivel_vibracion, estado, evidencia_path)
    ON public.lecturas_maquina TO authenticated;