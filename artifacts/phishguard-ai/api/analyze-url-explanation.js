const GEMINI_REQUEST_TIMEOUT_MS = 40_000;

export const config = {
  maxDuration: 45,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { url, analysis } = req.body || {};

    if (!url) {
      return res.status(400).json({
        error: "URL is required",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        error: "AI explanation is not configured",
        aiAvailable: false,
      });
    }

    const prompt = `
You are LinkSage AI, a calm cybersecurity assistant.

Explain the following URL risk assessment in simple language.

Important rules:
- Do NOT open or visit the URL.
- Do NOT claim the website is definitely malicious.
- Explain the detected signals.
- Give practical safety advice.
- Keep the explanation under 120 words.
- Do not ask the user for passwords, OTPs, payment information, or secrets.

URL:
${url}

Risk:
${analysis?.risk || "unknown"}

Score:
${analysis?.score ?? "unknown"}

Detected signals:
${JSON.stringify(analysis?.signals || [])}
`;

    const generateContent = async (model) => {
      const controller = new AbortController();
      const startedAt = Date.now();
      const timeoutId = setTimeout(
        () => controller.abort(),
        GEMINI_REQUEST_TIMEOUT_MS
      );

      const logFailure = (category, status) => {
        console.warn("Gemini explanation attempt failed", {
          model,
          status,
          category,
          elapsedMs: Date.now() - startedAt,
        });
      };

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: prompt }],
                },
              ],
              generationConfig: {
                maxOutputTokens: 256,
                thinkingConfig: {
                  thinkingLevel: "low",
                },
              },
            }),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          let providerError;
          try {
            providerError = (await response.json())?.error;
          } catch {
            providerError = undefined;
          }

          const sanitizeProviderValue = (value) => {
            if (typeof value !== "string" && typeof value !== "number") {
              return undefined;
            }
            return String(value).replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80);
          };
          const sanitizeProviderMessage = (message) => {
            if (typeof message !== "string") return undefined;
            const submittedUrl = String(url);
            return message
              .replaceAll(apiKey, "[redacted]")
              .replaceAll(encodeURIComponent(apiKey), "[redacted]")
              .replaceAll(prompt, "[redacted prompt]")
              .replaceAll(submittedUrl, "[redacted submitted URL]")
              .replaceAll(encodeURIComponent(submittedUrl), "[redacted submitted URL]")
              .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted URL]")
              .replace(/[\r\n\t]+/g, " ")
              .slice(0, 300);
          };

          console.warn("Gemini explanation attempt failed", {
            model,
            status: response.status,
            providerStatus: sanitizeProviderValue(providerError?.status),
            providerCode: sanitizeProviderValue(providerError?.code),
            providerMessage: sanitizeProviderMessage(providerError?.message),
            elapsedMs: Date.now() - startedAt,
          });
          return "";
        }

        try {
          const data = await response.json();
          const parts = data?.candidates?.[0]?.content?.parts;
          const explanation = Array.isArray(parts)
            ? parts
                .map((part) => (typeof part?.text === "string" ? part.text : ""))
                .join("")
                .trim()
            : "";

          if (!explanation) {
            logFailure("empty-or-invalid-response", response.status);
          }
          return explanation;
        } catch {
          logFailure(
            controller.signal.aborted ? "timeout" : "invalid-response",
            response.status
          );
          return "";
        }
      } catch {
        logFailure(
          controller.signal.aborted ? "timeout" : "network-error",
          undefined
        );
        return "";
      } finally {
        clearTimeout(timeoutId);
      }
    };

    let explanation = "";
    explanation = await generateContent("gemini-3.8-flash");

    if (!explanation) {
      return res.status(502).json({
        error: "AI explanation service failed",
        aiAvailable: false,
      });
    }

    return res.status(200).json({
      explanation,
      aiAvailable: true,
    });
  } catch (error) {
    return res.status(500).json({
      error: "AI explanation failed",
      aiAvailable: false,
    });
  }
}