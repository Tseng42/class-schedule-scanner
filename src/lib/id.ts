/**
 * `crypto.randomUUID()` only works in a secure context (HTTPS or `localhost`).
 * This app is meant to be opened over plain HTTP from a phone on the same
 * LAN (e.g. `http://192.168.x.x:5180`), which is NOT a secure context, so
 * `randomUUID` is undefined there — falls back to `getRandomValues` (works
 * in any context) and, failing that, `Math.random`. These ids are only used
 * as local React keys / storage identifiers, not for anything security-sensitive.
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
