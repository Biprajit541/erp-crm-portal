import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

/**
 * Service-to-service auth for the Amazon Connect integration.
 *
 * The AWS Lambda behind the contact flow is not a human user, so it does not
 * log in for a JWT. It sends a shared secret in the `x-api-key` header instead.
 *
 * - Fails closed: if CONNECT_API_KEY is not configured, the integration is off (503).
 * - Compares SHA-256 digests with timingSafeEqual so the check takes the same
 *   time whatever the input, and works even when the lengths differ.
 */
export function requireConnectApiKey(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.CONNECT_API_KEY;
  if (!expected) {
    return res.status(503).json({ error: "Contact center integration is not configured" });
  }

  const provided = req.header("x-api-key");
  if (!provided) {
    return res.status(401).json({ error: "Missing API key" });
  }

  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  if (!crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  next();
}
