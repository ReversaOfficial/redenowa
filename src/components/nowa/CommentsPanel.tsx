import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Avatar } from "./PostCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  addComment,
  deleteComment,
  fetchComments,
  timeAgo,
  type Comment,
} from "@/lib/posts-api";

const commentSchema = z
  .string()
  .trim()
  .min(1, "Diga alguma coisa")
  .max(500, "Máx 500 caracteres");

export function CommentsPanel({
  postId,
  open,
  onClose,
}: {
  postId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const queryKey = ["comments", postId] as const;
  const { data: comments, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchComments(postId),
    enabled: open, // only refetch when open, but uses prefetched cache
    staleTime: 30_000,
    placeholderData: (prev) => prev, // keep showing prefetched data while refetching
  });

  // Realtime: refresh on insert/delete for this post
  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel(`comments:${postId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey });
          qc.invalidateQueries({ queryKey: ["comments-count", postId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, postId, qc]);

  // Auto-scroll to newest when comments change
  useEffect(() => {
    if (!open || !comments) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, comments]);

  // Focus the input when opened
  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 250);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const sendMutation = useMutation({
    mutationFn: (content: string) => addComment(postId, content),
    onMutate: async (content) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<Comment[]>(queryKey) ?? [];
      const optimistic: Comment = {
        id: `optimistic-${Date.now()}`,
        post_id: postId,
        author_id: user!.id,
        content,
        created_at: new Date().toISOString(),
        author: {
          id: user!.id,
          handle: (user!.user_metadata?.handle as string) ?? "voce",
          display_name:
            (user!.user_metadata?.display_name as string) ?? "Você",
          avatar_url: (user!.user_metadata?.avatar_url as string) ?? null,
        },
      };
      qc.setQueryData<Comment[]>(queryKey, [...prev, optimistic]);
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
      toast.error("Não foi possível comentar", {
        description:
          e instanceof Error ? e.message : "Tente novamente em instantes.",
      });
    },
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["comments-count", postId] });
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<Comment[]>(queryKey) ?? [];
      qc.setQueryData<Comment[]>(
        queryKey,
        prev.filter((c) => c.id !== id),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
      toast.error("Não foi possível remover");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["comments-count", postId] });
    },
  });

  const handleSend = () => {
    const parsed = commentSchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Comentário inválido");
      return;
    }
    sendMutation.mutate(parsed.data);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60"
            onClick={onClose}
          />

          {/* panel */}
          <motion.div
            key="panel"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed inset-x-0 bottom-0 z-50 flex h-[75dvh] flex-col rounded-t-3xl bg-background shadow-2xl"
            role="dialog"
            aria-label="Comentários"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  Comentários
                </span>
                {comments && (
                  <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {comments.length}
                  </span>
                )}
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

            <div
              ref={listRef}
              className="flex-1 overflow-y-auto px-4 py-3"
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !comments || comments.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    Sem comentários ainda.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Seja o primeiro a falar.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {comments.map((c) => {
                    const mine = c.author_id === user?.id;
                    const optimistic = c.id.startsWith("optimistic-");
                    return (
                      <li key={c.id} className="flex gap-3">
                        <Avatar
                          src={c.author.avatar_url}
                          name={c.author.display_name}
                          size={36}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-bold text-foreground">
                              @{c.author.handle}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {optimistic ? "enviando…" : timeAgo(c.created_at)}
                            </span>
                          </div>
                          <p className="break-words text-sm leading-snug text-foreground">
                            {c.content}
                          </p>
                        </div>
                        {mine && !optimistic && (
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(c.id)}
                            aria-label="Apagar"
                            className="nowa-tap flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* composer */}
            <div className="border-t border-border bg-background px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  maxLength={500}
                  placeholder="Comentar como momento agora…"
                  className="flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={
                    sendMutation.isPending || draft.trim().length === 0
                  }
                  aria-label="Enviar"
                  className="nowa-tap flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" strokeWidth={2.5} />
                  )}
                </button>
              </div>
              <p className="mt-1 px-2 text-right text-[10px] text-muted-foreground">
                {draft.length}/500
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
