import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import express from "express";

import { browseRouter } from "./browse.js";

function requestJson(
  server: http.Server,
  path: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server address unavailable");
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: address.port,
        path,
        method: "GET",
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

test("GET /autocomplete returns 429 with Chinese message when upstream is rate limited", async () => {
  const originalFetch = globalThis.fetch;
  const app = express();
  app.use(browseRouter);
  const server = app.listen(0);

  globalThis.fetch = (async () => new Response("", { status: 429 })) as typeof fetch;

  try {
    const res = await requestJson(server, "/autocomplete?query=sf");
    assert.equal(res.status, 429);
    assert.equal(res.body.error, "请求过于频繁，请稍后再试");
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
});
