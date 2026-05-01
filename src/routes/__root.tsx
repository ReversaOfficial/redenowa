import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useState } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth-context";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          NOWA
        </p>
        <h1 className="mt-2 text-6xl font-bold tracking-tight text-foreground">404</h1>
        <h2 className="mt-3 text-lg font-semibold text-foreground">
          Esse momento já passou.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Quem viu, viu. Volte para o agora.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Ir para o feed
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1",
      },
      { name: "theme-color", content: "#ffffff" },
      { title: "NOWA — O momento é agora." },
      {
        name: "description",
        content:
          "NOWA é a rede social do agora. Sem filtros, sem passado. Poste agora ou perca.",
      },
      { property: "og:title", content: "NOWA — O momento é agora." },
      {
        property: "og:description",
        content: "Sem filtro. Sem passado. Quem viu, viu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      })
  );
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-center" theme="light" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
