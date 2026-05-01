import { createServerFn } from "@tanstack/react-start";

/** Client-side pre-upload moderation (base64 image) */
export const moderateImage = createServerFn({ method: "POST" })
  .inputValidator((data: { imageBase64: string }) => data)
  .handler(async ({ data }) => {
    return runImageModeration(data.imageBase64);
  });

/** Server-side post-upload moderation — checks a public media URL and flags the post if inappropriate */
export const moderatePost = createServerFn({ method: "POST" })
  .inputValidator((data: { postId: string; mediaUrl: string }) => data)
  .handler(async ({ data }) => {
    const result = await runImageModeration(data.mediaUrl);

    if (!result.safe) {
      // Flag the post server-side using admin client
      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );
      await supabaseAdmin
        .from("posts")
        .update({ flagged: true, flagged_reason: result.reason || "Conteúdo impróprio detectado" })
        .eq("id", data.postId);
    }

    return result;
  });

/** Shared moderation logic */
async function runImageModeration(
  imageSource: string,
): Promise<{ safe: boolean; reason: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return { safe: true, reason: "" };
  }

  try {
    const res = await fetch(
      "https://ai-gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `You are a content moderation system. Analyze this image and determine if it contains any of the following prohibited content:
- Nudity or sexually explicit content
- Gore, extreme violence, or graphic injury
- Child exploitation or abuse
- Illegal drugs or drug use
- Hate symbols or extremist content
- Animal cruelty

Respond ONLY with a JSON object: {"safe": true} if the image is acceptable, or {"safe": false, "reason": "brief reason in Portuguese"} if it violates any rule. No other text.`,
                },
                {
                  type: "image_url",
                  image_url: { url: imageSource },
                },
              ],
            },
          ],
          max_tokens: 100,
          temperature: 0,
        }),
      },
    );

    if (!res.ok) {
      console.error("[moderation] AI error:", res.status);
      return { safe: true, reason: "" };
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";

    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return { safe: !!parsed.safe, reason: parsed.reason ?? "" };
    }
  } catch (err) {
    console.error("[moderation] check failed:", err);
  }

  return { safe: true, reason: "" };
}
