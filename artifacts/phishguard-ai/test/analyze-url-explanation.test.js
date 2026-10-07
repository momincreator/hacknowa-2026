import assert from "node:assert/strict";
import test from "node:test";
import handler, { config } from "../api/analyze-url-explanation.js";

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function configureApiKey(t, value = "test-api-key") {
  const previousApiKey = process.env.GEMINI_API_KEY;
  t.after(() => {
    if (previousApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = previousApiKey;
    }
  });
  if (value == null) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = value;
  }
}

function mockGemini(t, json, { ok = true, status = 200 } = {}) {
  return t.mock.method(globalThis, "fetch", async (input, options) => {
    assert.match(String(input), /models\/gemini-3\.8-flash:generateContent/);
    assert.match(String(input), /key=test-api-key/);
    assert.equal(options.method, "POST");
    const response = {
      ok,
      status,
      json: async () => json,
    };
    return response;
  });
}

async function requestExplanation(response = { url: "https://example.test/" }) {
  const result = createResponse();
  await handler({ method: "POST", body: response }, result);
  return result;
}

test("uses the bounded Vercel duration and joins normal text parts, excluding thoughts", async (t) => {
  configureApiKey(t);
  assert.deepEqual(config, { maxDuration: 45 });

  t.mock.method(globalThis, "setTimeout", (_callback, delay) => {
    assert.equal(delay, 40_000);
    return 1;
  });
  t.mock.method(globalThis, "clearTimeout", () => {});
  let requestBody;
  t.mock.method(globalThis, "fetch", async (input, options) => {
    assert.match(String(input), /models\/gemini-3\.8-flash:generateContent/);
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [
              { text: "Internal thought must not appear. ", thought: true },
              { text: "This URL appears low risk. " },
              { text: "Check the domain before sharing information." },
            ],
          },
          finishReason: "STOP",
        }],
      }),
    };
  });

  const response = await requestExplanation({
    url: "https://example.test/",
    analysis: { risk: "low", score: 0, signals: ["no major signals"] },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    explanation:
      "This URL appears low risk. Check the domain before sharing information.",
  });
  assert.equal(requestBody.generationConfig.temperature, 0.2);
  assert.equal(requestBody.generationConfig.thinkingConfig.thinkingLevel, "low");
  assert.equal(requestBody.generationConfig.maxOutputTokens, 1024);
  assert.match(
    requestBody.contents[0].parts[0].text,
    /2 to 4 short, complete sentences/,
  );
  assert.match(
    requestBody.contents[0].parts[0].text,
    /overall risk, the most important signals, and what the user should do next/,
  );
  assert.match(requestBody.contents[0].parts[0].text, /never start with a greeting/);
});

test("accepts a complete candidate without finishReason", async (t) => {
  configureApiKey(t);
  mockGemini(t, {
    candidates: [{
      content: {
        parts: [{ text: "No major warning signs were found. Verify the domain before proceeding." }],
      },
    }],
  });

  const response = await requestExplanation();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    explanation:
      "No major warning signs were found. Verify the domain before proceeding.",
  });
});

test("accepts a complete response with an unspecified finish reason", async (t) => {
  configureApiKey(t);
  mockGemini(t, {
    candidates: [{
      content: {
        parts: [{ text: "This URL has limited risk indicators. Avoid sharing sensitive information." }],
      },
      finishReason: "FINISH_REASON_UNSPECIFIED",
    }],
  });

  const response = await requestExplanation();
  assert.equal(response.statusCode, 200);
  assert.equal(
    response.body.explanation,
    "This URL has limited risk indicators. Avoid sharing sensitive information.",
  );
});

test("accepts a complete response with the normal STOP finish reason", async (t) => {
  configureApiKey(t);
  mockGemini(t, {
    candidates: [{
      content: {
        parts: [{ text: "The URL contains suspicious signals. Verify it through a trusted channel." }],
      },
      finishReason: "STOP",
    }],
  });

  const response = await requestExplanation();
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.explanation, "The URL contains suspicious signals. Verify it through a trusted channel.");
});

test("rejects genuinely empty and thought-only responses", async (t) => {
  configureApiKey(t);
  t.mock.method(console, "warn", () => {});

  for (const parts of [
    [],
    [{ text: "Internal reasoning only.", thought: true }],
  ]) {
    mockGemini(t, {
      candidates: [{ content: { parts }, finishReason: "STOP" }],
    });
    const response = await requestExplanation();
    assert.equal(response.statusCode, 200);
    assert.match(response.body.explanation, /risk/i);
  }
});

test("falls back for MAX_TOKENS and visibly incomplete Gemini responses", async (t) => {
  configureApiKey(t);
  t.mock.method(console, "warn", () => {});

  for (const candidate of [
    {
      content: { parts: [{ text: "This URL may be risky because" }] },
      finishReason: "MAX_TOKENS",
    },
    {
      content: { parts: [{ text: "This URL may be risky because" }] },
    },
  ]) {
    mockGemini(t, { candidates: [candidate] });
    const response = await requestExplanation({
      url: "https://example.test/",
      analysis: {
        risk: "low",
        signals: [{ id: "no-major-signals", label: "No major suspicious signals" }],
      },
    });
    assert.equal(response.statusCode, 200);
    assert.match(response.body.explanation, /does not guarantee/i);
    assert.doesNotMatch(response.body.explanation, /may be risky because/);
  }
});

test("uses a local explanation after Gemini HTTP failure without exposing provider details", async (t) => {
  configureApiKey(t);
  t.mock.method(console, "warn", () => {});
  mockGemini(
    t,
    {
      error: {
        code: 403,
        status: "PERMISSION_DENIED",
        message: "API key test-api-key is invalid",
      },
    },
    { ok: false, status: 403 },
  );

  const response = await requestExplanation({
    url: "https://example.test/",
    analysis: {
      risk: "medium",
      signals: [{ id: "shortener", label: "URL shortener" }],
    },
  });
  assert.equal(response.statusCode, 200);
  assert.match(response.body.explanation, /URL shortener/i);
  assert.doesNotMatch(JSON.stringify(response.body), /test-api-key|PERMISSION_DENIED/);
});

test("creates a cautious low-risk fallback without a provider key", async (t) => {
  configureApiKey(t, null);
  let fetchCalled = false;
  t.mock.method(globalThis, "fetch", async () => {
    fetchCalled = true;
    throw new Error("Fallback must not fetch any URL");
  });

  const response = await requestExplanation({
    url: "https://example.com",
    analysis: {
      risk: "low",
      signals: [{ id: "no-major-signals", label: "No major suspicious signals" }],
    },
  });
  assert.equal(response.statusCode, 200);
  assert.match(response.body.explanation, /low risk/i);
  assert.match(response.body.explanation, /No major suspicious URL patterns were detected/i);
  assert.match(response.body.explanation, /does not guarantee that the destination is trustworthy/i);
  assert.equal(fetchCalled, false);
});

test("explains actual high-risk HTTP, IP, sensitive-keyword, and path signals", async (t) => {
  configureApiKey(t, null);
  const response = await requestExplanation({
    url: "http://192.168.1.10/login/verify-account?password=reset",
    analysis: {
      risk: "high",
      signals: [
        { id: "http", label: "HTTP connection" },
        { id: "ip-host", label: "IP address hostname" },
        { id: "sensitive-keywords", label: "Sensitive keywords" },
        { id: "suspicious-path", label: "Suspicious path pattern" },
      ],
    },
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body.explanation, /high risk/i);
  assert.match(response.body.explanation, /HTTP instead of HTTPS/i);
  assert.match(response.body.explanation, /IP address instead of a normal domain/i);
  assert.match(response.body.explanation, /account-.*credential-related wording/i);
  assert.match(response.body.explanation, /suspicious URL path pattern/i);
  assert.match(response.body.explanation, /Do not enter passwords, OTPs, payment details, or recovery codes/i);
  assert.doesNotMatch(response.body.explanation, /punycode|URL shortener|urgency/i);
});

test("mentions only signals present in the assessment", async (t) => {
  configureApiKey(t, null);
  const response = await requestExplanation({
    url: "https://example.test/",
    analysis: {
      risk: "medium",
      signals: [{ id: "long-url", label: "Long URL" }],
    },
  });

  assert.match(response.body.explanation, /unusually long URL/i);
  assert.doesNotMatch(response.body.explanation, /HTTP instead of HTTPS|IP address|punycode|shortener|redirect/i);
});

test("uses the local fallback after network errors", async (t) => {
  configureApiKey(t);
  t.mock.method(console, "warn", () => {});
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("network failure");
  });

  const response = await requestExplanation();
  assert.equal(response.statusCode, 200);
  assert.match(response.body.explanation, /risk/i);
});

test("returns the required JSON shape for non-POST requests", async (t) => {
  t.mock.method(globalThis, "fetch", () => {
    assert.fail("Gemini should not be called for a non-POST request");
  });

  const response = createResponse();
  await handler({ method: "GET" }, response);

  assert.equal(response.statusCode, 405);
  assert.deepEqual(response.body, {
    explanation: null,
    error: "Method not allowed",
  });
});
