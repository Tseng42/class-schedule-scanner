// @ts-check
import { timingSafeEqual } from "node:crypto";

/**
 * Vercel's helpers on top of Node's request/response for functions in /api.
 * @typedef {import("node:http").IncomingMessage} ApiRequest
 * @typedef {import("node:http").ServerResponse & {
 *   status(code: number): ApiResponse,
 *   json(body: unknown): void,
 * }} ApiResponse
 */

/**
 * Names (never values) of the environment variables that are unset.
 * @param {string[]} names
 */
export function missingEnv(names) {
  return names.filter((name) => !process.env[name]?.trim());
}

/**
 * @param {string | undefined} header
 * @returns {string | null}
 */
export function bearerToken(header) {
  const match = /^Bearer\s+(.+)$/i.exec(header ?? "");
  return match ? match[1].trim() : null;
}

/**
 * @param {string} a
 * @param {string} b
 */
export function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
