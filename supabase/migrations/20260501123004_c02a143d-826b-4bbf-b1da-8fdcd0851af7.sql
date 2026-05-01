-- Add flagged columns
ALTER TABLE public.posts ADD COLUMN flagged boolean NOT NULL DEFAULT false;
ALTER TABLE public.posts ADD COLUMN flagged_reason text;

-- Drop old SELECT policy and recreate with flagged filter
DROP POLICY IF EXISTS "Active posts public, archive owner-only" ON public.posts;

CREATE POLICY "Active posts public, archive owner-only, flagged hidden"
ON public.posts
FOR SELECT
TO authenticated
USING (
  (
    (created_at > (now() - '24:00:00'::interval)) AND (flagged = false)
  )
  OR (auth.uid() = author_id)
);