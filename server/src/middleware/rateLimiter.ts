import type { Request, Response, NextFunction } from "express";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

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

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
  if (isRateLimited(ip)) {
    console.warn("[Parse] 429 rate_limited", { ip: ip.slice(0, 8) + "..." });
    res.status(429).json({ error: "Too many requests, try again later" });
    return;
  }
  next();
}
