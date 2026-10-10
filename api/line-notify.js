// @ts-check
import { FieldValue } from "firebase-admin/firestore";
import { bearerToken, missingEnv, safeEqual } from "./_lib/env.js";
import { getDb, getOwnerUid } from "./_lib/firebaseAdmin.js";
import { pushText } from "./_lib/line.js";
import { planTick, taipeiParts } from "./_lib/schedule.js";

const REQUIRED_ENV = ["FIREBASE_SERVICE_ACCOUNT", "LINE_OWNER_EMAIL", "LINE_CHANNEL_ACCESS_TOKEN", "LINE_USER_ID"];
/** LINE's status once the month's free message quota is used up. */
const QUOTA_EXCEEDED = 429;

/** @param {number} epochMs */
function formatTaipei(epochMs) {
  const { dateKey, minutes } = taipeiParts(epochMs);
  return `${dateKey} ${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * Sends whatever LINE reminders are due right now. Called every ~10 minutes by
 * .github/workflows/line-notify.yml and once a day by Vercel Cron (vercel.json).
 *
 * Safe to call at any frequency and concurrently: each message is claimed in a
 * Firestore transaction before it is pushed, so overlapping or duplicated
 * scheduler calls cannot double-send.
 *
 * The response carries statuses only, never schedule contents — the GitHub
 * Actions log that prints it is public.
 *
 * @param {import("./_lib/env.js").ApiRequest} request
 * @param {import("./_lib/env.js").ApiResponse} response
 */
export default async function handler(request, response) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return response.status(503).json({ ok: false, reason: "not-configured" });
  const token = bearerToken(request.headers.authorization);
  if (!token || !safeEqual(token, secret)) return response.status(401).json({ ok: false, reason: "unauthorized" });

  const missing = missingEnv(REQUIRED_ENV);
  if (missing.length > 0) return response.status(200).json({ ok: false, reason: "not-configured", missing });

  try {
    const uid = await getOwnerUid();
    if (!uid) return response.status(200).json({ ok: false, reason: "owner-never-signed-in" });

    const db = getDb();
    const userRef = db.collection("users").doc(uid);
    const stateRef = db.collection("lineState").doc(uid);
    const nowMs = Date.now();

    const claimed = await db.runTransaction(async (transaction) => {
      const [userSnap, stateSnap] = await transaction.getAll(userRef, stateRef);
      const data = userSnap.data();
      if (!data) return null;
      const previous = stateSnap.data() ?? {};
      const plan = planTick(data.schedule ?? {}, data.settings ?? {}, previous, nowMs);
      if (plan.nextState) transaction.set(stateRef, plan.nextState);
      return { plan, previousDailySentDate: /** @type {string | undefined} */ (previous.dailySentDate) };
    });
    if (!claimed) return response.status(200).json({ ok: false, reason: "no-synced-schedule" });

    const { plan, previousDailySentDate } = claimed;
    /** @type {string} */
    let daily = plan.dailyStatus;
    let reminders = 0;
    /** @type {{ step: string, status: number, message: string }[]} */
    const errors = [];

    // A failed push gives its claim back so the next call retries — except when
    // the quota is gone, where retrying every 10 minutes all month is pointless.
    if (plan.dailyText) {
      const result = await pushText(plan.dailyText);
      if (result.ok) {
        daily = "sent";
      } else {
        daily = "failed";
        errors.push({ step: "daily", status: result.status, message: result.message });
        if (result.status !== QUOTA_EXCEEDED) {
          await stateRef.update({ dailySentDate: previousDailySentDate ?? FieldValue.delete() }).catch(() => {});
        }
      }
    }

    if (plan.reminderText) {
      const result = await pushText(plan.reminderText);
      if (result.ok) {
        reminders = plan.reminderKeys.length;
      } else {
        errors.push({ step: "reminders", status: result.status, message: result.message });
        if (result.status !== QUOTA_EXCEEDED) {
          await stateRef.update({ reminderKeys: FieldValue.arrayRemove(...plan.reminderKeys) }).catch(() => {});
        }
      }
    }

    return response.status(200).json({ ok: errors.length === 0, at: formatTaipei(nowMs), daily, reminders, errors });
  } catch (error) {
    console.error("line-notify failed", error);
    return response.status(500).json({ ok: false, reason: "error" });
  }
}
