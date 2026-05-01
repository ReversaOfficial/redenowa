import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated")({
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

  // Sem sessão → manda para a tela de boas-vindas/login.
  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/welcome", replace: true });
    }
  }, [loading, session, navigate]);

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

