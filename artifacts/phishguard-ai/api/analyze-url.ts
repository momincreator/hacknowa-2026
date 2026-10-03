type Signal = {
  id: string;
  label: string;
  detail: string;
  severity: "positive" | "caution" | "danger";
  points: number;
  category: string;
};

export default function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const url = String(req.body?.url || "").trim();

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    if (url.length > 2048) {
      return res.status(400).json({ error: "URL is too long" });
    }

    let parsed: URL;

    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }

    const hostname = parsed.hostname.toLowerCase();
    const protocol = parsed.protocol;
    const path = parsed.pathname;
    const query = parsed.search;

    let score = 0;
    const signals: Signal[] = [];

    const add = (
      id: string,
      label: string,
      points: number,
      detail: string,
      severity: "caution" | "danger",
      category: string
    ) => {
      score += points;

      signals.push({
        id,
        label,
        detail,
        severity,
        points,
        category,
      });
    };

    if (protocol === "http:") {
      add(
        "http",
        "HTTP connection",
        18,
        "The link does not use HTTPS.",
        "caution",
        "Connection"
      );
    }

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
      add(
        "ip-host",
        "IP address hostname",
        28,
        "The link uses an IP address instead of a normal domain.",
        "danger",
        "Domain"
      );
    }

    if (/xn--/i.test(hostname)) {
      add(
        "punycode",
        "Punycode domain",
        20,
        "The hostname contains punycode that can make lookalike domains harder to recognize.",
        "caution",
        "Domain"
      );
    }

    if (url.length > 120) {
      add(
        "long-url",
        "Long URL",
        8,
        "The URL is unusually long.",
        "caution",
        "URL structure"
      );
    }

    if (hostname.split(".").length >= 5) {
      add(
        "subdomains",
        "Many subdomains",
        8,
        "The hostname contains several nested subdomains.",
        "caution",
        "Domain"
      );
    }

    const shorteners = [
      "bit.ly",
      "tinyurl.com",
      "t.co",
      "is.gd",
      "ow.ly",
    ];

    if (shorteners.includes(hostname)) {
      add(
        "shortener",
        "URL shortener",
        18,
        "A shortened URL hides the final destination until it is opened.",
        "caution",
        "URL structure"
      );
    }

    if (/@/.test(url)) {
      add(
        "at-character",
        "Unusual @ character",
        10,
        "The @ character can obscure the actual hostname in deceptive URLs.",
        "caution",
        "URL structure"
      );
    }

    if (/%[0-9a-f]{2}/i.test(url)) {
      add(
        "encoding",
        "Encoded URL content",
        10,
        "The URL contains percent-encoded content.",
        "caution",
        "URL structure"
      );
    }

    if (["8080", "8000", "3000", "4443"].includes(parsed.port)) {
      add(
        "unusual-port",
        "Unusual port",
        8,
        "The link uses a non-standard web port.",
        "caution",
        "Connection"
      );
    }

    const text = `${hostname}${path}${query}`.toLowerCase();

    const sensitive = [
      "login",
      "verify",
      "account",
      "password",
      "signin",
      "secure",
      "payment",
      "billing",
      "wallet",
      "update",
      "confirm",
      "unlock",
      "suspended",
      "credential",
      "otp",
      "invoice",
    ];

    const matches = sensitive.filter((word) => text.includes(word));

    if (matches.length > 0) {
      add(
        "sensitive-keywords",
        "Sensitive keywords",
        Math.min(15, 4 + matches.length * 2),
        "The URL contains account, authentication, payment or credential-related wording.",
        matches.length >= 3 ? "danger" : "caution",
        "Content"
      );
    }

    const urgency = [
      "urgent",
      "immediately",
      "action-required",
      "action_required",
      "account-suspended",
      "verify-now",
      "expires-today",
      "limited-time",
    ];

    const urgencyMatches = urgency.filter((word) => text.includes(word));

    if (urgencyMatches.length > 0) {
      add(
        "urgency",
        "Urgency language",
        Math.min(10, 5 + urgencyMatches.length * 2),
        "The URL contains wording associated with urgency or immediate action.",
        "caution",
        "Content"
      );
    }

    if (
      /\/(login\/verify|account\/confirm|secure\/update|password\/reset|payment\/verify)/i.test(
        path
      )
    ) {
      add(
        "suspicious-path",
        "Suspicious path pattern",
        10,
        "The path combines sensitive actions in a pattern worth reviewing.",
        "caution",
        "URL structure"
      );
    }

    if (
      /[?&](url|redirect|redirect_url|return|returnUrl|next|target|dest|destination)=/i.test(
        query
      ) ||
      /\/redirect(?:\/|$)/i.test(path)
    ) {
      add(
        "redirect",
        "Redirect indicator",
        8,
        "The URL contains a redirect-style parameter or path. PhishGuard does not follow it.",
        "caution",
        "URL structure"
      );
    }

    score = Math.min(100, score);

    let risk: "low" | "medium" | "high";
    let summary: string;

    if (score >= 50) {
      risk = "high";
      summary =
        "This URL contains multiple signals that deserve strong caution before opening.";
    } else if (score >= 20) {
      risk = "medium";
      summary =
        "This URL contains some signals that should be reviewed before continuing.";
    } else {
      risk = "low";
      summary =
        "No major suspicious URL patterns were detected by the current checks.";
    }

    if (signals.length === 0) {
      signals.push({
        id: "no-major-signals",
        label: "No major suspicious signals",
        detail:
          "The URL did not match the suspicious patterns currently checked by PhishGuard.",
        severity: "positive",
        points: 0,
        category: "Overview",
      });
    }

    return res.status(200).json({
      inputUrl: url,
      normalizedUrl: parsed.toString(),
      domain: hostname,
      risk,
      score,
      summary,
      signals,
      recommendations: [
        "Check the domain carefully before continuing.",
        "Do not enter passwords, OTPs, payment details or recovery codes.",
        "If the link came from a message, verify it through a trusted channel.",
        "HTTPS provides encryption but does not prove that a site is trustworthy.",
      ],
      analyzedAt: new Date().toISOString(),
      aiAvailable: false,
    });
  } catch {
    return res.status(500).json({
      error: "Analysis failed",
    });
  }
}