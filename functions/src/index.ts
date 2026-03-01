import { onRequest } from "firebase-functions/v2/https";
import { handleParse } from "./parseHandler";

// ── 简易 IP 限流（内存计数，函数实例重启后重置） ────────────
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 分钟窗口
const RATE_LIMIT_MAX = 30; // 每 IP 每分钟最多 30 次

const ipCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    ipCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// ── Cloud Function ──────────────────────────────────────────

export const parse = onRequest(
  {
    cors: true,
    region: "us-central1",
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // IP 限流
    const ip = req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
    if (isRateLimited(ip)) {
      console.warn("[Parse] 429 rate_limited", { ip: ip.slice(0, 8) + "..." });
      res.status(429).json({ error: "Too many requests, try again later" });
      return;
    }

    const result = await handleParse(req.body);
    res.status(result.status).json(result.body);
  }
);
