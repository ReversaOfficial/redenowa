import { createServerFn } from "@tanstack/react-start";

export const moderateImage = createServerFn({ method: "POST" })
  .inputValidator((data: { imageBase64: string }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      // If no key, allow (fail open for dev)
      return { safe: true, reason: "" };
    }

    const res = await fetch("https://ai-gateway.lovable.dev/v1/chat/completions", {
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
                image_url: { url: data.imageBase64 },
              },
            ],
          },
        ],
        max_tokens: 100,
        temperature: 0,
      }),
    });

    if (!res.ok) {
      // Fail open if AI service is down
      console.error("[moderation] AI error:", res.status);
      return { safe: true, reason: "" };
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";

    try {
      // Extract JSON from response
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return { safe: !!parsed.safe, reason: parsed.reason ?? "" };
      }
    } catch {
      // parse error, allow
    }

    return { safe: true, reason: "" };
  });
