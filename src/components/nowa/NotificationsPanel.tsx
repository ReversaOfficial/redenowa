import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2, X } from "lucide-react";
import { Avatar } from "./PostCard";
import {
  fetchNotifications,
  markAllRead,
  timeAgo,
  type Notification,
} from "@/lib/posts-api";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export function NotificationsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const listRef = useRef<HTMLDivElement>(null);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    enabled: open,
    staleTime: 10_000,
  });

  // Mark all as read when opening
  const markReadMut = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-count"] });
    },
  });

  useEffect(() => {
    if (open && notifications && notifications.some((n) => !n.read)) {
      markReadMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, notifications]);

  // Realtime
  useEffect(() => {
    if (!open || !user) return;
    const channel = supabase
      .channel("notifications-panel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
          qc.invalidateQueries({ queryKey: ["unread-count"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, user, qc]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60"
            onClick={onClose}
          />
          <motion.div
            key="panel"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed inset-x-0 bottom-0 z-50 flex h-[75dvh] flex-col rounded-t-3xl bg-background shadow-2xl"
            role="dialog"
            aria-label="Notificações"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-foreground" />
                <span className="text-sm font-bold text-foreground">
                  Notificações
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="nowa-tap flex h-8 w-8 items-center justify-center rounded-full bg-card"
              >
                <X className="h-4 w-4 text-foreground" />
              </button>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !notifications || notifications.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    Nenhuma notificação ainda.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Quando alguém te mencionar, aparecerá aqui.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {notifications.map((n) => (
                    <NotificationItem key={n.id} n={n} onClose={onClose} />
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function NotificationItem({
  n,
  onClose,
}: {
  n: Notification;
  onClose: () => void;
}) {
  return (
    <li
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
        n.read ? "bg-transparent" : "bg-primary/5"
      }`}
    >
      <Link
        to="/u/$handle"
        params={{ handle: n.actor.handle }}
        onClick={onClose}
      >
        <Avatar
          src={n.actor.avatar_url}
          name={n.actor.display_name}
          size={36}
        />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">
          <Link
            to="/u/$handle"
            params={{ handle: n.actor.handle }}
            onClick={onClose}
            className="font-bold hover:underline"
          >
            @{n.actor.handle}
          </Link>{" "}
          mencionou você{n.comment_id ? " em um comentário" : " em um post"}.
        </p>
        <span className="text-[10px] text-muted-foreground">
          {timeAgo(n.created_at)}
        </span>
      </div>
      {!n.read && (
        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </li>
  );
}

export function NotificationBell({ onClick }: { onClick: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: count } = useQuery({
    queryKey: ["unread-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("read", false);
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  // Realtime for badge count
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notif-badge")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["unread-count"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="nowa-tap relative flex h-9 w-9 items-center justify-center rounded-full bg-card"
      aria-label="Notificações"
    >
      <Bell className="h-5 w-5 text-foreground" strokeWidth={2} />
      {(count ?? 0) > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {count! > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
