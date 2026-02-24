-- ============================================================================
-- Family Quest — Parent Hub: Nuevas tablas para dashboard parental
-- Migration: 20260224_001_parent_hub_tables
-- Tablas: family_members, parent_notes, educational_content, focus_areas, game_results
-- ============================================================================

-- ============================================================================
-- 1. family_members — Relación padre ↔ hijo
-- ============================================================================
CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kid_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parent_id, kid_id)
);

CREATE INDEX idx_family_members_parent ON family_members(parent_id);
CREATE INDEX idx_family_members_kid ON family_members(kid_id);

-- RLS: solo padres vinculados pueden ver sus relaciones
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view their own family links"
  ON family_members FOR SELECT
  USING (auth.uid() = parent_id);

CREATE POLICY "Parents can insert family links"
  ON family_members FOR INSERT
  WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Parents can delete their own family links"
  ON family_members FOR DELETE
  USING (auth.uid() = parent_id);

-- ============================================================================
-- 2. parent_notes — Notas entre padres sobre hijos
-- ============================================================================
CREATE TABLE parent_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kid_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- NULL = nota general familiar
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_parent_notes_author ON parent_notes(author_id);
CREATE INDEX idx_parent_notes_kid ON parent_notes(kid_id);
CREATE INDEX idx_parent_notes_created ON parent_notes(created_at DESC);

-- RLS: solo padres vinculados al mismo kid pueden ver notas
ALTER TABLE parent_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view notes for their kids"
  ON parent_notes FOR SELECT
  USING (
    auth.uid() = author_id
    OR (
      kid_id IS NULL AND EXISTS (
        SELECT 1 FROM family_members fm
        WHERE fm.parent_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.parent_id = auth.uid() AND fm.kid_id = parent_notes.kid_id
    )
  );

CREATE POLICY "Parents can create notes"
  ON parent_notes FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND (
      kid_id IS NULL
      OR EXISTS (
        SELECT 1 FROM family_members fm
        WHERE fm.parent_id = auth.uid() AND fm.kid_id = parent_notes.kid_id
      )
    )
  );

CREATE POLICY "Authors can update their own notes"
  ON parent_notes FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete their own notes"
  ON parent_notes FOR DELETE
  USING (auth.uid() = author_id);

-- ============================================================================
-- 3. educational_content — Contenido educativo subido por padres
-- ============================================================================
CREATE TABLE educational_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('word_list', 'pdf', 'image', 'manual')),
  subject TEXT, -- 'spelling', 'math', 'reading', 'general'
  target_kid_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- NULL = para todos los hijos
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_educational_content_uploader ON educational_content(uploaded_by);
CREATE INDEX idx_educational_content_kid ON educational_content(target_kid_id);
CREATE INDEX idx_educational_content_type ON educational_content(content_type);
CREATE INDEX idx_educational_content_active ON educational_content(is_active) WHERE is_active = true;

-- RLS: padres vinculados pueden ver contenido de sus hijos
ALTER TABLE educational_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view content for their kids"
  ON educational_content FOR SELECT
  USING (
    auth.uid() = uploaded_by
    OR target_kid_id IS NULL
    OR EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.parent_id = auth.uid() AND fm.kid_id = educational_content.target_kid_id
    )
  );

CREATE POLICY "Parents can upload content"
  ON educational_content FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Uploaders can update their content"
  ON educational_content FOR UPDATE
  USING (auth.uid() = uploaded_by);

CREATE POLICY "Uploaders can delete their content"
  ON educational_content FOR DELETE
  USING (auth.uid() = uploaded_by);

-- ============================================================================
-- 4. focus_areas — Áreas de enfoque semanal por hijo
-- ============================================================================
CREATE TABLE focus_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kid_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- categoría de words.ts o custom
  priority INT NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 3), -- 1=alta, 2=media, 3=baja
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_week CHECK (week_end > week_start)
);

CREATE INDEX idx_focus_areas_kid ON focus_areas(kid_id);
CREATE INDEX idx_focus_areas_week ON focus_areas(week_start, week_end);
CREATE INDEX idx_focus_areas_kid_week ON focus_areas(kid_id, week_start DESC);

-- RLS: padres vinculados pueden gestionar áreas de enfoque de sus hijos
ALTER TABLE focus_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view focus areas for their kids"
  ON focus_areas FOR SELECT
  USING (
    auth.uid() = set_by
    OR EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.parent_id = auth.uid() AND fm.kid_id = focus_areas.kid_id
    )
  );

CREATE POLICY "Parents can create focus areas for their kids"
  ON focus_areas FOR INSERT
  WITH CHECK (
    auth.uid() = set_by
    AND EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.parent_id = auth.uid() AND fm.kid_id = focus_areas.kid_id
    )
  );

CREATE POLICY "Parents can update focus areas they set"
  ON focus_areas FOR UPDATE
  USING (auth.uid() = set_by);

CREATE POLICY "Parents can delete focus areas they set"
  ON focus_areas FOR DELETE
  USING (auth.uid() = set_by);

-- ============================================================================
-- 5. game_results — Detalle de partidas jugadas
-- ============================================================================
CREATE TABLE game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL, -- 'spelling_bee', 'math', etc.
  difficulty TEXT NOT NULL, -- 'easy', 'medium', 'hard'
  score INT NOT NULL DEFAULT 0,
  accuracy INT NOT NULL DEFAULT 0 CHECK (accuracy BETWEEN 0 AND 100),
  words_correct INT,
  words_total INT,
  time_seconds INT,
  details JSONB, -- palabras individuales, errores específicos, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_game_results_kid ON game_results(kid_id);
CREATE INDEX idx_game_results_kid_type ON game_results(kid_id, game_type);
CREATE INDEX idx_game_results_kid_created ON game_results(kid_id, created_at DESC);
CREATE INDEX idx_game_results_created ON game_results(created_at DESC);

-- RLS: kids ven sus propios resultados, padres ven los de sus hijos
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kids can view their own game results"
  ON game_results FOR SELECT
  USING (auth.uid() = kid_id);

CREATE POLICY "Kids can insert their own game results"
  ON game_results FOR INSERT
  WITH CHECK (auth.uid() = kid_id);

CREATE POLICY "Parents can view game results of their kids"
  ON game_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.parent_id = auth.uid() AND fm.kid_id = game_results.kid_id
    )
  );
