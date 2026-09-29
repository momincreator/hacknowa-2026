import { Router, type IRouter } from "express";
import {
  AnalyzeUrlBody,
  GenerateUrlExplanationBody,
  GenerateUrlExplanationResponse,
} from "@workspace/api-zod";
import {
  analyzeUrl,
  generateAiExplanation,
  isSupportedUrl,
} from "../lib/url-analyzer";

const router: IRouter = Router();

router.post("/analyze-url", (req, res): void => {
  const parsedBody = AnalyzeUrlBody.safeParse(req.body);
  if (!parsedBody.success || !isSupportedUrl(parsedBody.data?.url ?? "")) {
    req.log.warn("Rejected invalid URL analysis input");
    res.status(400).json({
      error:
        "Enter a valid HTTP or HTTPS URL without username, password, or credentials.",
    });
    return;
  }

  try {
    res.json(analyzeUrl(parsedBody.data.url));
  } catch (error) {
    req.log.warn({ error }, "URL analysis failed validation");
    res.status(400).json({ error: "That URL could not be analyzed safely." });
  }
});

router.post("/analyze-url/explanation", async (req, res): Promise<void> => {
  const parsedBody = GenerateUrlExplanationBody.safeParse(req.body);
  if (!parsedBody.success || !isSupportedUrl(parsedBody.data?.url ?? "")) {
    res.status(400).json({ error: "Enter a valid HTTP or HTTPS URL." });
    return;
  }

  const explanation = await generateAiExplanation(
    parsedBody.data.url,
    parsedBody.data.signals,
    req.log,
  );
  if (!explanation) {
    res.status(503).json({
      error: "AI explanation is not configured. The built-in risk assessment is still available.",
    });
    return;
  }

  res.json(
    GenerateUrlExplanationResponse.parse({
      explanation,
      provider: "configured server-side AI provider",
    }),
  );
});

export default router;