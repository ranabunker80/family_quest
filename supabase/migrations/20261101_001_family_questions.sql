-- Preguntas de GarzaOS para los papás + cierre de acceso a profiles.
-- Solo profiles.role decide quién es papá; estas funciones lo leen sin depender de RLS.

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_profile_role() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;

-- ============================================================================
-- profiles: solo la familia lee, y nadie se cambia su propio rol
-- ============================================================================

DROP POLICY "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Family members can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.current_profile_role() IS NOT NULL);

DROP POLICY "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = public.current_profile_role());

-- ============================================================================
-- family_questions: las crea GarzaOS (service role), las contestan los papás
-- ============================================================================

CREATE TABLE public.family_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic TEXT NOT NULL,
  prompt TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  position INT NOT NULL DEFAULT 0,
  answer TEXT,
  answered_by UUID REFERENCES public.profiles(id),
  answered_at TIMESTAMPTZ,
  emailed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_family_questions_pending
  ON public.family_questions (created_at)
  WHERE answer IS NULL;

ALTER TABLE public.family_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view family questions"
  ON public.family_questions FOR SELECT
  TO authenticated
  USING (public.current_profile_role() = 'parent');

CREATE POLICY "Parents can answer family questions"
  ON public.family_questions FOR UPDATE
  TO authenticated
  USING (public.current_profile_role() = 'parent')
  WITH CHECK (public.current_profile_role() = 'parent');
