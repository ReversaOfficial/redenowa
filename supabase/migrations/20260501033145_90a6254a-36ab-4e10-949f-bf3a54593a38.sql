CREATE TABLE public.follows (
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows viewable by authenticated"
ON public.follows FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert own follows"
ON public.follows FOR INSERT TO authenticated
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users delete own follows"
ON public.follows FOR DELETE TO authenticated
USING (auth.uid() = follower_id);

CREATE INDEX idx_follows_following ON public.follows(following_id);
CREATE INDEX idx_follows_follower ON public.follows(follower_id);