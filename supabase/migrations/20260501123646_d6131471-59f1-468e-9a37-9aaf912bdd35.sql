
-- Allow admins to update any post (e.g. flag it)
CREATE POLICY "Admins can update any post"
ON public.posts FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
