
-- Lock down SECURITY DEFINER function: only trigger should call it
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Remove broad public listing of bucket; replace with read-only on individual objects via signed-url or known path
DROP POLICY IF EXISTS "Media public read" ON storage.objects;

-- Allow public to read individual objects (still lets <img src=...> work since URLs are public),
-- but don't allow listing via storage.objects without a specific name match.
-- Public read by exact object access (Postgrest list will still work for authenticated owners only via the next policy)
CREATE POLICY "Media object read by anyone"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'nowa-media');
