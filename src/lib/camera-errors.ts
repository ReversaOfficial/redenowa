// Classifica erros de getUserMedia em mensagens humanas + instruções por dispositivo.

export type CameraErrorKind =
  | "denied"        // usuário (ou política do site) bloqueou
  | "not-found"     // sem dispositivo de câmera
  | "in-use"        // outro app usando
  | "insecure"      // contexto não-HTTPS
  | "unsupported"   // navegador sem MediaDevices
  | "overconstrained"
  | "unknown";

export type CameraErrorInfo = {
  kind: CameraErrorKind;
  title: string;
  message: string;
  steps: string[]; // instruções passo-a-passo, dependentes do dispositivo detectado
  raw?: string;
};

function detectPlatform(): "ios" | "android" | "mac" | "windows" | "linux" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  if (/Windows/i.test(ua)) return "windows";
  if (/Linux/i.test(ua)) return "linux";
  return "other";
}

function detectBrowser(): "safari" | "chrome" | "firefox" | "edge" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/Edg\//i.test(ua)) return "edge";
  if (/Firefox\//i.test(ua)) return "firefox";
  if (/Chrome\//i.test(ua)) return "chrome";
  if (/Safari\//i.test(ua)) return "safari";
  return "other";
}

function stepsForDenied(): string[] {
  const platform = detectPlatform();
  const browser = detectBrowser();

  if (platform === "ios") {
    return [
      "Abra Ajustes do iPhone › Safari › Câmera",
      "Selecione 'Permitir' (ou 'Perguntar')",
      "Volte ao NOWA e toque em 'Tentar de novo'",
    ];
  }
  if (platform === "android") {
    return [
      "Toque no cadeado 🔒 ao lado do endereço",
      "Toque em 'Permissões' › 'Câmera' › 'Permitir'",
      "Recarregue a página e tente novamente",
    ];
  }
  if (platform === "mac" && browser === "safari") {
    return [
      "Menu Safari › Ajustes › Sites › Câmera",
      "Mude o NOWA para 'Permitir'",
      "Recarregue a página",
    ];
  }
  if (browser === "firefox") {
    return [
      "Clique no ícone de câmera na barra de endereço",
      "Remova o bloqueio e escolha 'Permitir'",
      "Recarregue a página",
    ];
  }
  // Chrome / Edge / outros desktop
  return [
    "Clique no cadeado 🔒 ao lado do endereço",
    "Em 'Câmera', escolha 'Permitir'",
    "Recarregue a página e tente de novo",
  ];
}

export function classifyCameraError(err: unknown): CameraErrorInfo {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err);

  // Sem suporte algum
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return {
      kind: "unsupported",
      title: "Navegador sem suporte à câmera",
      message:
        "Este navegador não permite acesso à câmera. Tente abrir o NOWA no Safari (iPhone) ou Chrome.",
      steps: [
        "Atualize seu navegador para a versão mais recente",
        "Ou abra esta página em outro navegador",
      ],
      raw,
    };
  }

  // Contexto inseguro (http://)
  if (
    typeof window !== "undefined" &&
    window.isSecureContext === false &&
    location.hostname !== "localhost"
  ) {
    return {
      kind: "insecure",
      title: "Conexão insegura",
      message:
        "A câmera só funciona em páginas HTTPS. Acesse o NOWA pelo endereço seguro (https://).",
      steps: ["Troque http:// por https:// no endereço", "Recarregue a página"],
      raw,
    };
  }

  const name = err instanceof Error ? err.name : "";
  const msg = err instanceof Error ? err.message.toLowerCase() : "";

  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    msg.includes("permission") ||
    msg.includes("denied")
  ) {
    return {
      kind: "denied",
      title: "Acesso à câmera bloqueado",
      message:
        "O navegador está bloqueando a câmera. Libere a permissão para capturar o seu momento.",
      steps: stepsForDenied(),
      raw,
    };
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      kind: "not-found",
      title: "Nenhuma câmera encontrada",
      message:
        "Não detectamos uma câmera neste dispositivo. Conecte uma câmera ou tente em outro aparelho.",
      steps: [
        "Verifique se há uma câmera conectada e ligada",
        "Se for externa, desconecte e conecte novamente",
      ],
      raw,
    };
  }

  if (
    name === "NotReadableError" ||
    name === "TrackStartError" ||
    msg.includes("in use") ||
    msg.includes("could not start")
  ) {
    return {
      kind: "in-use",
      title: "Câmera em uso por outro app",
      message:
        "Outro aplicativo ou aba está usando a câmera. Feche-o e tente novamente.",
      steps: [
        "Feche outras chamadas (Zoom, Meet, FaceTime, etc.)",
        "Feche outras abas que usam câmera",
        "Toque em 'Tentar de novo'",
      ],
      raw,
    };
  }

  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return {
      kind: "overconstrained",
      title: "Câmera incompatível",
      message:
        "A câmera selecionada não atende ao formato pedido. Tente virar a câmera.",
      steps: ["Toque no botão de virar câmera", "Tente de novo"],
      raw,
    };
  }

  return {
    kind: "unknown",
    title: "Não conseguimos abrir a câmera",
    message:
      "Algo impediu o acesso à câmera. Verifique as permissões do navegador e tente de novo.",
    steps: stepsForDenied(),
    raw,
  };
}

/** Verifica permissão (sem disparar prompt) quando a Permissions API existe. */
export async function getCameraPermissionState(): Promise<
  "granted" | "denied" | "prompt" | "unknown"
> {
  try {
    const status = await (
      navigator.permissions as unknown as {
        query?: (d: { name: string }) => Promise<{ state: string }>;
      }
    )?.query?.({ name: "camera" });
    if (!status) return "unknown";
    return (status.state as "granted" | "denied" | "prompt") ?? "unknown";
  } catch {
    return "unknown";
  }
}
