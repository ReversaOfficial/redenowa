
-- Create close_friends table
CREATE TABLE public.close_friends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_id),
  CHECK (user_id != friend_id)
);

ALTER TABLE public.close_friends ENABLE ROW LEVEL SECURITY;

-- Owner can see their close friends list
CREATE POLICY "Users view own close friends"
  ON public.close_friends FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Owner can add close friends
CREATE POLICY "Users insert own close friends"
  ON public.close_friends FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Owner can remove close friends
CREATE POLICY "Users delete own close friends"
  ON public.close_friends FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add close_friends_only flag to posts
ALTER TABLE public.posts ADD COLUMN close_friends_only BOOLEAN NOT NULL DEFAULT false;

-- Drop old SELECT policy on posts and recreate with close friends logic
DROP POLICY IF EXISTS "Active posts public, archive owner-only, flagged hidden" ON public.posts;

CREATE POLICY "Posts visibility with close friends"
  ON public.posts FOR SELECT
  TO authenticated
  USING (
    -- Author always sees their own posts
    auth.uid() = author_id
    OR
    (
      -- Post must be active (24h) and not flagged
      created_at > (now() - interval '24 hours')
      AND flagged = false
      AND (
        -- Public posts: visible to all
        close_friends_only = false
        OR
        -- Close friends posts: only visible to people in the author's close friends list
        EXISTS (
          SELECT 1 FROM public.close_friends cf
          WHERE cf.user_id = posts.author_id
            AND cf.friend_id = auth.uid()
        )
      )
    )
  );
