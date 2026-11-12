-- Respaldo en la nube del Estudio de Animación: bucket privado, cada niño solo ve y escribe su carpeta (<user id>/...).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('studio-backup', 'studio-backup', false, 52428800, ARRAY['application/json'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Studio backup: read own folder"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'studio-backup' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Studio backup: create in own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'studio-backup' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Studio backup: update own folder"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'studio-backup' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'studio-backup' AND (storage.foldername(name))[1] = auth.uid()::text);
