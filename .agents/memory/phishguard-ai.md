---
name: URL safety boundary
description: Product safety and architecture constraints for the LinkSage AI URL analyzer.
---

The analyzer must treat submitted URLs as untrusted text: parse and score them locally, never fetch or open them, and never request credentials or sensitive data from the user. The built-in heuristic assessment is the reliable default; any AI explanation is an optional server-side enhancement and must not produce fabricated results when unconfigured.

**Why:** The core product promise is a safe pre-click check, and users need a useful result even when no AI provider is available.

**How to apply:** Preserve the no-network-to-submitted-URL boundary in future feature work, and keep provider keys and AI calls on the server only.