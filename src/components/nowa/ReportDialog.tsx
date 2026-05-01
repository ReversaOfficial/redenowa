import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const REASONS = [
  { value: "nudity", label: "Nudez ou conteúdo sexual" },
  { value: "violence", label: "Violência ou ameaça" },
  { value: "harassment", label: "Assédio ou bullying" },
  { value: "spam", label: "Spam" },
  { value: "hate_speech", label: "Discurso de ódio" },
  { value: "misinformation", label: "Informação falsa" },
  { value: "underage", label: "Envolve menores de idade" },
  { value: "other", label: "Outro" },
] as const;

type ReportReason = (typeof REASONS)[number]["value"];

export function ReportDialog({
  postId,
  open,
  onOpenChange,
}: {
  postId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!reason) throw new Error("Selecione um motivo");
      const { error } = await supabase.from("reports").insert({
        post_id: postId,
        reporter_id: (await supabase.auth.getUser()).data.user!.id,
        reason: reason as any,
        details: details.trim() || null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Você já denunciou este post.");
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Denúncia enviada", {
        description: "Vamos analisar o conteúdo o mais breve possível.",
      });
      onOpenChange(false);
      setReason("");
      setDetails("");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar denúncia");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Denunciar post</DialogTitle>
          <DialogDescription>
            Selecione o motivo da denúncia. Nossa equipe irá analisar o conteúdo.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={reason}
          onValueChange={(v) => setReason(v as ReportReason)}
          className="gap-2"
        >
          {REASONS.map((r) => (
            <div key={r.value} className="flex items-center gap-2">
              <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
              <Label htmlFor={`reason-${r.value}`} className="text-sm cursor-pointer">
                {r.label}
              </Label>
            </div>
          ))}
        </RadioGroup>

        <Textarea
          placeholder="Detalhes adicionais (opcional)"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={500}
          rows={3}
        />

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={!reason || mutation.isPending}
          >
            {mutation.isPending ? "Enviando…" : "Denunciar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
