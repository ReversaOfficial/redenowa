import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/welcome" });
    }
  },
  component: AuthGuard,
});

function AuthGuard() {
  const { session, profile, loading } = useAuth();
  const [showFallback, setShowFallback] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const t = setTimeout(() => setShowFallback(true), 250);
    return () => clearTimeout(t);
  }, []);

  // Força onboarding pós-cadastro até o usuário concluir.
  useEffect(() => {
    if (loading) return;
    if (!profile) return;
    if (location.pathname === "/onboarding") return;
    if (!profile.onboarded_at) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [loading, profile, location.pathname, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        {showFallback && (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  return <Outlet />;
}

