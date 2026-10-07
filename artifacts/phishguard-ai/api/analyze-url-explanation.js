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

    const generateContent = (model) =>
      fetch(
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
          }),
        }
      );

    let explanation = "";
    for (const model of ["gemini-3.8-flash", "gemini-2.5-flash"]) {
      let response;
      try {
        response = await generateContent(model);
      } catch {
        continue;
      }
      if (!response.ok) continue;

      try {
        const data = await response.json();
        explanation = Array.isArray(data?.candidates?.[0]?.content?.parts)
          ? data.candidates[0].content.parts
              .map((part) => part?.text || "")
              .join("")
              .trim()
          : "";
      } catch {
        explanation = "";
      }

      if (explanation) break;
    }

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