import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldAlert, ExternalLink, CheckCircle2, XCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: AdminReportsPage,
});

const REASON_LABELS: Record<string, string> = {
  nudity: "Nudez / Sexual",
  violence: "Violência",
  harassment: "Assédio",
  spam: "Spam",
  hate_speech: "Discurso de ódio",
  misinformation: "Informação falsa",
  underage: "Menores de idade",
  other: "Outro",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-yellow-500/20 text-yellow-400" },
  reviewed_valid: { label: "Válida", color: "bg-red-500/20 text-red-400" },
  reviewed_invalid: { label: "Inválida", color: "bg-green-500/20 text-green-400" },
  actioned: { label: "Ação tomada", color: "bg-blue-500/20 text-blue-400" },
};

function AdminReportsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Check admin role
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .then(({ data }) => {
        setIsAdmin(!!data && data.length > 0);
      });
  }, [user?.id]);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true,
  });

  if (isAdmin === null) {
    return (
      <div className="flex h-[60dvh] items-center justify-center">
        <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <h1 className="text-lg font-bold text-foreground">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">
          Você não tem permissão para acessar esta página.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Denúncias</h1>
        <Badge variant="secondary" className="ml-auto">
          {reports.filter((r: any) => r.status === "pending").length} pendentes
        </Badge>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando…</p>
      ) : reports.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma denúncia encontrada.</p>
      ) : (
        <div className="space-y-4">
          {reports.map((report: any) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({ report }: { report: any }) {
  const qc = useQueryClient();
  const [note, setNote] = useState(report.admin_note ?? "");
  const [status, setStatus] = useState(report.status);
  const statusInfo = STATUS_LABELS[report.status] ?? STATUS_LABELS.pending;

  // Fetch post info
  const { data: post } = useQuery({
    queryKey: ["post-for-report", report.post_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("media_url, media_type, caption, author_id")
        .eq("id", report.post_id)
        .single();
      return data;
    },
  });

  // Fetch reporter handle
  const { data: reporter } = useQuery({
    queryKey: ["profile-for-report", report.reporter_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("handle, display_name")
        .eq("id", report.reporter_id)
        .single();
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("reports")
        .update({
          status,
          admin_note: note.trim() || null,
          resolved_at: status !== "pending" ? new Date().toISOString() : null,
        })
        .eq("id", report.id);
      if (error) throw error;

      // If valid report, flag the post so it's hidden from feed
      if (status === "reviewed_valid" || status === "actioned") {
        await supabase
          .from("posts")
          .update({
            flagged: true,
            flagged_reason: REASON_LABELS[report.reason] ?? report.reason,
          })
          .eq("id", report.post_id);
      }
      // If invalid, unflag if it was flagged
      if (status === "reviewed_invalid") {
        await supabase
          .from("posts")
          .update({ flagged: false, flagged_reason: null })
          .eq("id", report.post_id);
      }
    },
    onSuccess: () => {
      toast.success("Denúncia atualizada");
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}>
            {report.status === "pending" ? (
              <Clock className="h-3 w-3" />
            ) : report.status === "reviewed_invalid" ? (
              <XCircle className="h-3 w-3" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            {statusInfo.label}
          </span>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {REASON_LABELS[report.reason] ?? report.reason}
          </p>
        </div>
        <time className="text-xs text-muted-foreground">
          {new Date(report.created_at).toLocaleDateString("pt-BR")}
        </time>
      </div>

      {report.details && (
        <p className="text-sm text-muted-foreground">{report.details}</p>
      )}

      <div className="text-xs text-muted-foreground">
        Denunciado por: <span className="font-medium text-foreground">@{reporter?.handle ?? "…"}</span>
      </div>

      {/* Post preview */}
      {post && (
        <div className="rounded-lg border border-border overflow-hidden">
          {post.media_type === "video" ? (
            <video src={post.media_url} controls className="w-full max-h-48 object-cover" />
          ) : (
            <img src={post.media_url} alt="" className="w-full max-h-48 object-cover" />
          )}
          {post.caption && (
            <p className="p-2 text-xs text-muted-foreground line-clamp-2">{post.caption}</p>
          )}
        </div>
      )}

      {/* Admin actions */}
      <div className="space-y-2 border-t border-border pt-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="reviewed_valid">Válida — conteúdo impróprio</SelectItem>
            <SelectItem value="reviewed_invalid">Inválida — conteúdo ok</SelectItem>
            <SelectItem value="actioned">Ação tomada</SelectItem>
          </SelectContent>
        </Select>

        <Textarea
          placeholder="Nota do administrador…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="text-xs"
        />

        <Button
          size="sm"
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          className="w-full"
        >
          {updateMutation.isPending ? "Salvando…" : "Salvar veredito"}
        </Button>
      </div>
    </div>
  );
}
