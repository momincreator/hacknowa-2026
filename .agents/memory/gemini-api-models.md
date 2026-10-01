---
name: Gemini API model availability
description: Model retirement and access behavior observed with direct Gemini API keys.
---

For direct Google Gemini API keys, a model appearing in `ListModels` does not guarantee it is available for generation. A 404 may state that the model is unavailable to new users and name a replacement; use the provider's explicit guidance rather than treating the key as invalid.

**Why:** A direct Gemini API key listed `gemini-2.5-flash` but generation returned `NOT_FOUND` stating it was unavailable to new users and recommending `gemini-3.8-flash`.

**How to apply:** When `generateContent` returns 404, inspect only the provider's non-secret error details and check both model access and endpoint support before changing the key or API.