import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MobileShell } from "@/components/nowa/MobileShell";
import { NotificationBell, NotificationsPanel } from "@/components/nowa/NotificationsPanel";
import VideoFeed from "@/components/feed/VideoFeed";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "NOWA — O momento é agora." },
      {
        name: "description",
        content:
          "NOWA é a rede social do agora. Sem filtros, sem passado. Poste agora ou perca.",
      },
    ],
  }),
  component: FeedPage,
});

function FeedPage() {
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <MobileShell fullBleed>
      <div className="absolute top-4 right-4 z-30">
        <NotificationBell onClick={() => setNotifOpen(true)} />
      </div>
      <VideoFeed />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </MobileShell>
  );
}
