CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comments_content_len CHECK (char_length(content) BETWEEN 1 AND 500)
);

CREATE INDEX idx_comments_post_created ON public.comments(post_id, created_at DESC);
CREATE INDEX idx_comments_author ON public.comments(author_id);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read comments, except those involving a block
-- relationship between the viewer and the comment's author.
CREATE POLICY "Comments viewable by authenticated except blocked"
  ON public.comments FOR SELECT
  TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = comments.author_id)
         OR (b.blocker_id = comments.author_id AND b.blocked_id = auth.uid())
    )
  );

CREATE POLICY "Users insert own comments"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users delete own comments"
  ON public.comments FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

ALTER TABLE public.comments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;