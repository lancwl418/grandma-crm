import test from "node:test";
import assert from "node:assert/strict";

import { searchListings } from "./zillow.js";

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
  });
}

test("searchListings retries once on 5xx and then succeeds", async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalApiKey = process.env.RAPIDAPI_KEY;
  let calls = 0;
  process.env.RAPIDAPI_KEY = "test-key";

  globalThis.setTimeout = ((cb: (...args: unknown[]) => void) => {
    cb();
    return 0 as unknown as NodeJS.Timeout;
  }) as typeof setTimeout;

  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) return jsonResponse({}, 500);
    return jsonResponse({ searchResults: [], pagesInfo: { totalPages: 1 } });
  }) as typeof fetch;

  try {
    const result = await searchListings({ location: "Retry-Success-City" });
    assert.equal(result.totalPages, 1);
    assert.equal(calls, 2);
  } finally {
    process.env.RAPIDAPI_KEY = originalApiKey;
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("searchListings caches by request key and avoids duplicate upstream call", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.RAPIDAPI_KEY;
  let calls = 0;
  process.env.RAPIDAPI_KEY = "test-key";

  globalThis.fetch = (async () => {
    calls += 1;
    return jsonResponse({ searchResults: [], pagesInfo: { totalPages: 1 } });
  }) as typeof fetch;

  try {
    const first = await searchListings({ location: "Cache-Hit-City" });
    const second = await searchListings({ location: "Cache-Hit-City" });
    assert.equal(first.totalPages, 1);
    assert.equal(second.totalPages, 1);
    assert.equal(calls, 1);
  } finally {
    process.env.RAPIDAPI_KEY = originalApiKey;
    globalThis.fetch = originalFetch;
  }
});

test("searchListings throws RATE_LIMITED after exhausting 429 retries", async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalApiKey = process.env.RAPIDAPI_KEY;
  let calls = 0;
  process.env.RAPIDAPI_KEY = "test-key";

  globalThis.setTimeout = ((cb: (...args: unknown[]) => void) => {
    cb();
    return 0 as unknown as NodeJS.Timeout;
  }) as typeof setTimeout;

  globalThis.fetch = (async () => {
    calls += 1;
    return jsonResponse({}, 429);
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => searchListings({ location: "Rate-Limited-City" }),
      (err: unknown) => err instanceof Error && err.message === "RATE_LIMITED"
    );
    assert.equal(calls, 4);
  } finally {
    process.env.RAPIDAPI_KEY = originalApiKey;
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});
