import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
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
  const { session, loading } = useAuth();
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowFallback(true), 250);
    return () => clearTimeout(t);
  }, []);

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
