import type { Plugin } from "vite";

function phishguardApi(): Plugin {
  return {
    name: "phishguard-api",
    configureServer(server) {
      server.middlewares.use("/api", async (req, res, next) => {
        if (req.method !== "POST") return next();

        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
          try {
            const input = JSON.parse(body || "{}");
            const url = String(input.url || input.data?.url || "").trim();

            if (!url) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              return res.end(JSON.stringify({ message: "URL is required" }));
            }

            let parsed: URL;
            try {
              parsed = new URL(url);
            } catch {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              return res.end(JSON.stringify({ message: "Invalid URL" }));
            }

            const hostname = parsed.hostname;
            const protocol = parsed.protocol.replace(":", "");
            const path = parsed.pathname;
            const query = parsed.search;
            const port = parsed.port || (protocol === "https" ? "443" : "80");

            let score = 0;
            const signals: any[] = [];

            const add = (name: string, points: number, reason: string, severity = "moderate") => {
              score += points;
              signals.push({
                name,
                points,
                reason,
                severity
              });
            };

            if (protocol === "http") add("HTTP connection", 18, "The link does not use HTTPS.", "moderate");

            if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
              add("IP address hostname", 28, "The link uses an IP address instead of a normal domain.", "strong");
            }

            if (/xn--/i.test(hostname)) {
              add("Punycode domain", 20, "The hostname contains internationalized/punycode characters that can make lookalike domains harder to recognize.", "moderate");
            }

            if (url.length > 120) add("Long URL", 8, "The URL is unusually long.", "weak");

            const labels = hostname.split(".");
            if (labels.length >= 5) add("Many subdomains", 8, "The hostname contains several nested subdomains.", "weak");

            if (["bit.ly","tinyurl.com","t.co","is.gd","ow.ly"].includes(hostname.toLowerCase())) {
              add("URL shortener", 18, "A shortened URL hides the final destination until it is opened.", "moderate");
            }

            if (/@/.test(url)) add("Unusual @ character", 10, "The @ character can obscure the actual hostname in deceptive URLs.", "moderate");

            if (/%[0-9a-f]{2}/i.test(url)) add("Encoded URL content", 10, "The URL contains percent-encoded content.", "weak");

            if (["8080","8000","3000","4443"].includes(parsed.port)) {
              add("Unusual port", 8, "The link uses a non-standard web port.", "weak");
            }

            const text = (hostname + path + query).toLowerCase();

            const sensitive = [
              "login","verify","account","password","signin","secure",
              "payment","billing","wallet","update","confirm","unlock",
              "suspended","credential","otp","invoice"
            ];

            const urgency = [
              "urgent","immediately","action-required","action_required",
              "account-suspended","verify-now","expires-today","limited-time"
            ];

            const sensitiveMatches = sensitive.filter(x => text.includes(x));
            if (sensitiveMatches.length) {
              add(
                "Sensitive keywords",
                Math.min(15, 4 + sensitiveMatches.length * 2),
                "The URL contains account, authentication, payment or credential-related wording.",
                sensitiveMatches.length >= 3 ? "strong" : "moderate"
              );
            }

            const urgencyMatches = urgency.filter(x => text.includes(x));
            if (urgencyMatches.length) {
              add("Urgency language", Math.min(10, 5 + urgencyMatches.length * 2),
                "The URL contains wording associated with urgency or immediate action.", "moderate");
            }

            if (/\/(login\/verify|account\/confirm|secure\/update|password\/reset|payment\/verify)/i.test(path)) {
              add("Suspicious path pattern", 10,
                "The path combines sensitive actions in a pattern commonly worth reviewing.", "moderate");
            }

            if (/[?&](url|redirect|redirect_url|return|returnUrl|next|target|dest|destination)=/i.test(query) ||
                /\/redirect(?:\/|$)/i.test(path)) {
              add("Redirect indicator", 8,
                "The URL contains a redirect-style parameter or path. LinkSage AI does not follow it.", "moderate");
            }

            score = Math.min(100, score);

            const riskLevel =
              score >= 50 ? "High Concern" :
              score >= 20 ? "Medium / Review" :
              "Low Concern";

            const rootParts = hostname.split(".");
            const rootDomain = rootParts.length >= 2
              ? rootParts.slice(-2).join(".")
              : hostname;

            const subdomain = hostname.endsWith(rootDomain)
              ? hostname.slice(0, -(rootDomain.length + 1))
              : "";

            const result = {
              url,
              score,
              riskLevel,
              protocol,
              hostname,
              rootDomain,
              subdomain,
              path,
              queryParams: parsed.searchParams.size,
              port,
              signals,
              recommendations: [
                "Check the domain carefully before continuing.",
                "Do not enter passwords, OTPs, payment details or recovery codes.",
                "If the link came from a message, verify it through a trusted channel.",
                "HTTPS is useful for encryption but does not prove that a site is trustworthy."
              ]
            };

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          } catch {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ message: "Analysis failed" }));
          }
        });
      });
    }
  };
}

export default phishguardApi;
