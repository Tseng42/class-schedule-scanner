// @ts-check
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/** @type {import("firebase-admin/firestore").Firestore | null} */
let firestore = null;
/** @type {{ email: string, uid: string } | null} */
let cachedOwner = null;

/**
 * Accepts the service-account JSON either pasted as-is or base64-encoded.
 * @param {string} raw
 */
function parseServiceAccount(raw) {
  const trimmed = raw.trim();
  const text = trimmed.startsWith("{") ? trimmed : Buffer.from(trimmed, "base64").toString("utf8");
  const parsed = JSON.parse(text);
  // Some env editors store the key's newlines as the two characters "\n".
  if (typeof parsed.private_key === "string") parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  return parsed;
}

/**
 * Why FIREBASE_SERVICE_ACCOUNT cannot be used, as a short code, or null when
 * its shape looks right. Safe to return to a caller: it never contains any
 * part of the value (JSON.parse error messages can quote their input, so those
 * are deliberately not passed on).
 * @returns {string | null}
 */
export function serviceAccountProblem() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT ?? "").trim();
  if (!raw) return "empty";
  let parsed;
  try {
    parsed = parseServiceAccount(raw);
  } catch {
    return "not-json";
  }
  if (!parsed || typeof parsed !== "object") return "not-json";
  if (parsed.type !== "service_account") return "not-a-service-account-key";
  for (const field of ["project_id", "client_email", "private_key"]) {
    if (typeof parsed[field] !== "string" || !parsed[field]) return `missing-${field}`;
  }
  if (!parsed.private_key.includes("PRIVATE KEY")) return "bad-private-key";
  return null;
}

/**
 * Shape facts about a FIREBASE_SERVICE_ACCOUNT value that does not parse, to
 * tell a truncated paste from a mangled one. Counts and yes/no answers only —
 * nothing here can reveal any part of the value. A downloaded key file is about
 * 2400 characters on 13 lines.
 */
function serviceAccountShape() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT ?? "").trim();
  const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  let parseError = "none";
  let position = -1;
  try {
    JSON.parse(text);
  } catch (error) {
    // Classified from the message, which itself is never returned: it can quote the input.
    const message = error instanceof Error ? error.message : "";
    parseError = /control character/i.test(message)
      ? "control-character-in-string"
      : /Unexpected end|Unterminated/i.test(message)
        ? "truncated"
        : /Expected property name/i.test(message)
          ? "bad-property-name"
          : "other";
    position = Number(/position (\d+)/.exec(message)?.[1] ?? -1);
  }
  return {
    length: raw.length,
    lines: raw.split("\n").length,
    startsWithBrace: raw.startsWith("{"),
    endsWithBrace: raw.endsWith("}"),
    startsWithQuote: /^["'`]/.test(raw),
    hasPrivateKeyField: raw.includes("private_key"),
    hasKeyMarker: raw.includes("PRIVATE KEY"),
    hasEscapedQuotes: raw.includes('\\"'),
    parseError,
    position,
  };
}

/**
 * What a caught server error can safely tell the caller: the Firebase/Google
 * error code (never the message) and, if the service account is the likely
 * cause, which check it fails.
 * @param {unknown} error
 * @returns {{ code: string, serviceAccount?: string, shape?: ReturnType<typeof serviceAccountShape> }}
 */
export function describeError(error) {
  const raw = /** @type {{ code?: unknown, name?: unknown }} */ (error ?? {});
  const code =
    typeof raw.code === "string" || typeof raw.code === "number"
      ? String(raw.code)
      : typeof raw.name === "string"
        ? raw.name
        : "unknown";
  const serviceAccount = serviceAccountProblem();
  if (!serviceAccount) return { code };
  return serviceAccount === "not-json" ? { code, serviceAccount, shape: serviceAccountShape() } : { code, serviceAccount };
}

function getAdminApp() {
  const [existing] = getApps();
  if (existing) return existing;
  return initializeApp({ credential: cert(parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT ?? "")) });
}

export function getDb() {
  if (!firestore) {
    firestore = getFirestore(getAdminApp());
    // REST transport avoids loading gRPC on every cold start.
    firestore.settings({ preferRest: true });
  }
  return firestore;
}

/**
 * The Firebase uid of the one account allowed to receive LINE reminders, or
 * null if that Google account has never signed in to the app.
 *
 * The site is public, so anyone can sign in and get their own `users/{uid}`
 * document — reminders must only ever read the owner's.
 * @returns {Promise<string | null>}
 */
export async function getOwnerUid() {
  const email = (process.env.LINE_OWNER_EMAIL ?? "").trim().toLowerCase();
  if (cachedOwner?.email === email) return cachedOwner.uid;
  try {
    const user = await getAuth(getAdminApp()).getUserByEmail(email);
    cachedOwner = { email, uid: user.uid };
    return user.uid;
  } catch (error) {
    if (/** @type {{ code?: string }} */ (error).code === "auth/user-not-found") return null;
    throw error;
  }
}

/**
 * Verifies a Firebase ID token and confirms it belongs to the owner account.
 * @param {string} idToken
 * @returns {Promise<"owner" | "not-owner" | "invalid">}
 */
export async function checkOwnerToken(idToken) {
  // Outside the try: a malformed service account is a server misconfiguration,
  // and must not be reported to the user as "your sign-in expired".
  const auth = getAuth(getAdminApp());
  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch {
    return "invalid";
  }
  const ownerEmail = (process.env.LINE_OWNER_EMAIL ?? "").trim().toLowerCase();
  const isOwner = decoded.email_verified === true && decoded.email?.toLowerCase() === ownerEmail;
  return isOwner ? "owner" : "not-owner";
}
