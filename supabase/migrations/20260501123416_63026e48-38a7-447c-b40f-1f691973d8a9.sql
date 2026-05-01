
-- Enum for report reasons
CREATE TYPE public.report_reason AS ENUM (
  'nudity',
  'violence',
  'harassment',
  'spam',
  'hate_speech',
  'misinformation',
  'underage',
  'other'
);

-- Enum for report status
CREATE TYPE public.report_status AS ENUM (
  'pending',
  'reviewed_valid',
  'reviewed_invalid',
  'actioned'
);

-- Reports table
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL,
  reporter_id UUID NOT NULL,
  reason report_reason NOT NULL,
  details TEXT,
  status report_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (post_id, reporter_id)
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: Users can insert their own reports
CREATE POLICY "Users insert own reports"
ON public.reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = reporter_id);

-- RLS: Users see their own reports, admins see all
CREATE POLICY "Users view own reports or admin sees all"
ON public.reports FOR SELECT TO authenticated
USING (
  auth.uid() = reporter_id
  OR public.has_role(auth.uid(), 'admin')
);

-- RLS: Only admins can update reports (review)
CREATE POLICY "Admins update reports"
ON public.reports FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS: user_roles readable by the user themselves or admins
CREATE POLICY "Users view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
