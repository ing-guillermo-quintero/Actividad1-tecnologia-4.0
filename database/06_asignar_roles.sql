-- database/06_asignar_roles.sql
-- Ejecutar manualmente para inicializar los perfiles

INSERT INTO public.perfiles (id, rol)
SELECT id, 'operador' FROM auth.users WHERE email = 'operador@empresagg.com'
ON CONFLICT (id) DO UPDATE SET rol = EXCLUDED.rol;

INSERT INTO public.perfiles (id, rol)
SELECT id, 'supervisor' FROM auth.users WHERE email = 'supervisor@empresagg.com'
ON CONFLICT (id) DO UPDATE SET rol = EXCLUDED.rol;