# PhishGuard AI

PhishGuard AI is a mobile-first web app for checking a suspicious link before opening it. It performs a safe, explainable risk assessment from the URL text alone and translates technical signals into practical next steps.

## The problem it solves

Phishing links often look familiar while hiding a different destination, using urgency, or asking for sensitive information. People should not need a cybersecurity background to pause, inspect a link, and make a safer decision.

## Features

- Risk assessment with **Low Risk**, **Medium Risk**, and **High Risk** results
- Explainable signal breakdown in plain language
- HTTPS, IP address, subdomain, URL length, suspicious characters, shortener, punycode/IDN, keyword, port, encoding, and domain-pattern checks
- Practical safety recommendations tailored to the result
- Loading, invalid-input, retryable-error, empty, and analyzed states
- Example links for a safe demo without opening any destination
- Responsive layout designed for phones first
- Optional server-side AI explanation endpoint
- No automatic URL fetching or visiting

## How URL analysis works

The server validates that the input is an HTTP or HTTPS URL without embedded credentials, then parses it locally. It never requests the submitted URL. Each explainable signal contributes a weighted number of points:

- **0–19:** Low risk — no major warning signs were detected
- **20–44:** Medium risk — pause and verify the sender and destination
- **45+:** High risk — do not open the link or enter information

These scores are a risk assessment, not a verdict. A safe-looking URL can still lead to harmful content, and a suspicious-looking URL may be legitimate in context.

## AI integration

The built-in heuristic engine is the default and does not require an AI provider. The API also includes `POST /api/analyze-url/explanation`, which can request an optional explanation from Gemini on the server. The browser never receives or handles the provider key.

To enable Gemini explanations, add the Google AI API key as a Replit Secret named `GEMINI_API_KEY`. The server uses the Gemini 3.8 Flash model; no OpenAI key or browser-side key is required.

If `GEMINI_API_KEY` is missing or Gemini is unavailable, the main analyzer still works normally and uses its existing heuristic assessment.

## Technologies

- React + TypeScript + Vite
- Express 5 API server
- Zod and OpenAPI-generated API contracts
- TanStack React Query for API mutations
- Tailwind CSS and Lucide icons
- pnpm workspace monorepo

## Run the project

Install dependencies:

```bash
pnpm install
```

The Replit workflows run the frontend and API server for you. For local development, the relevant commands are:

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/phishguard-ai run dev
```

Useful checks:

```bash
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/phishguard-ai run typecheck
pnpm --filter @workspace/phishguard-ai run build
```

## Limitations and future improvements

PhishGuard AI does not guarantee safety, inspect page contents, check reputation feeds, resolve redirects, or replace a browser's built-in protections. Users should never enter passwords, OTPs, banking information, or other sensitive information on a suspicious website.

Possible future improvements include optional reputation lookups through a privacy-conscious threat-intelligence provider, redirect-chain analysis in a sandbox, user education flows, multilingual explanations, and confidence calibration against a labeled dataset.

> **Disclaimer:** PhishGuard AI provides a risk assessment, not a guarantee of safety. Never enter passwords, OTPs, or financial information on a suspicious website.