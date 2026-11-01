-- La migración 20260224 nunca se aplicó y nada en la app crea estos vínculos.
-- Sin ellos RLS le oculta a los papás los resultados de los juegos.

INSERT INTO public.family_members (parent_id, kid_id)
SELECT parent.id, kid.id
FROM public.profiles parent
CROSS JOIN public.profiles kid
WHERE parent.role = 'parent' AND kid.role = 'kid'
ON CONFLICT (parent_id, kid_id) DO NOTHING;
