
DROP POLICY IF EXISTS "Media object read by anyone" ON storage.objects;

-- Only the owner can list their own objects via the API.
-- Public image rendering still works because public buckets serve files via CDN
-- (object/public/<bucket>/<path>) without going through this RLS policy.
CREATE POLICY "Owner can list own media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'nowa-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
