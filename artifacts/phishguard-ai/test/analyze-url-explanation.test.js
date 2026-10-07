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

function restoreApiKey(t) {
  const previousApiKey = process.env.GEMINI_API_KEY;
  t.after(() => {
    if (previousApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = previousApiKey;
    }
  });
}

test("uses the bounded Vercel duration and returns Gemini's explanation", async (t) => {
  restoreApiKey(t);
  process.env.GEMINI_API_KEY = "test-api-key";
  assert.deepEqual(config, { maxDuration: 45 });

  t.mock.method(globalThis, "setTimeout", (_callback, delay) => {
    assert.equal(delay, 40_000);
    return 1;
  });
  t.mock.method(globalThis, "clearTimeout", () => {});

  let request;
  t.mock.method(globalThis, "fetch", async (input, options) => {
    request = {
      url: String(input),
      body: JSON.parse(options.body),
    };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Review the domain carefully." }] } }],
      }),
    };
  });

  const response = createResponse();
  await handler(
    {
      method: "POST",
      body: {
        url: "https://example.test/login",
        analysis: { risk: "Medium", score: 42, signals: ["login keyword"] },
      },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    explanation: "Review the domain carefully.",
    aiAvailable: true,
  });
  assert.match(request.url, /models\/gemini-3\.8-flash:generateContent/);
  assert.match(request.url, /key=test-api-key/);
  assert.equal(request.body.generationConfig.thinkingConfig.thinkingLevel, "low");
  assert.equal(request.body.generationConfig.maxOutputTokens, 256);
});

test("rejects non-POST methods without calling Gemini", async (t) => {
  t.mock.method(globalThis, "fetch", () => {
    assert.fail("Gemini should not be called for a non-POST request");
  });

  const response = createResponse();
  await handler({ method: "GET" }, response);

  assert.equal(response.statusCode, 405);
  assert.deepEqual(response.body, { error: "Method not allowed" });
});

test("reports a failed provider request without fabricating an explanation", async (t) => {
  restoreApiKey(t);
  process.env.GEMINI_API_KEY = "test-api-key";
  t.mock.method(console, "warn", () => {});
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("network failure");
  });

  const response = createResponse();
  await handler(
    { method: "POST", body: { url: "https://example.test/" } },
    response,
  );

  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.body, {
    error: "AI explanation service failed",
    aiAvailable: false,
  });
});
