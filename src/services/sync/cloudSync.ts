import { doc, runTransaction } from "firebase/firestore";
import { z } from "zod";
import { scheduleSchema, type Schedule } from "../../schema/schedule";
import { appSettingsSchema, type AppSettings } from "../../schema/settings";
import { applySyncedSchedule, loadSchedule } from "../storage/scheduleRepository";
import { loadSettings, replaceSettings } from "../storage/settingsRepository";
import { db, isSyncConfigured } from "./firebaseConfig";
import { getCurrentUser } from "./googleAuth";
import { mergeSchedules, type MergeResult } from "./mergeSchedule";
import { getSyncMeta, updateSyncMeta } from "./syncMeta";
import { onSyncRequested } from "./syncTrigger";

/**
 * Bumped when the schedule merge rules change in a way that needs a one-time
 * reconciliation on each device. 2 = per-record merge with deletion records.
 */
const SCHEDULE_MERGE_VERSION = 2;

const cloudDocSchema = z.object({
  syncVersion: z.literal(1),
  schedule: scheduleSchema,
  settings: appSettingsSchema,
  scheduleUpdatedAt: z.string(),
  settingsUpdatedAt: z.string(),
});

export interface SyncResult {
  action: "seeded" | "pulled" | "merged" | "pushed" | "noop";
  scheduleAddedCount?: number;
  scheduleRemovedCount?: number;
  holidayAddedCount?: number;
  holidayRemovedCount?: number;
}

/** Cloud wins wherever it defines a value; a field it leaves undefined keeps the local value. */
function mergeSettings(local: AppSettings, cloud: AppSettings): AppSettings {
  const definedInCloud = Object.fromEntries(Object.entries(cloud).filter(([, value]) => value !== undefined));
  return { ...local, ...definedInCloud };
}

interface TransactionOutcome {
  merge: MergeResult | null;
  schedule: Schedule;
  settings: AppSettings;
  settingsPulled: boolean;
}

/**
 * The single entry point for every sync trigger (boot, background resume,
 * debounced edit, manual "立即同步"). Reads the cloud copy, merges it with
 * this device record by record (see mergeSchedules), and writes the result
 * back in one transaction, so a device syncing at the same moment cannot
 * overwrite what this one just merged.
 */
export async function syncNow(): Promise<SyncResult> {
  if (!isSyncConfigured || !db) return { action: "noop" };
  const user = getCurrentUser();
  if (!user) return { action: "noop" };

  const firestore = db;
  const ref = doc(firestore, "users", user.uid);
  const meta = getSyncMeta();
  const reconcileLegacy = meta.scheduleMergeVersion !== SCHEDULE_MERGE_VERSION;
  const now = new Date().toISOString();

  let outcome: TransactionOutcome;
  try {
    outcome = await runTransaction(firestore, async (transaction) => {
      const snap = await transaction.get(ref);
      // A corrupt/unexpected-shape document is treated the same as "no document yet" —
      // never let untrusted cloud data crash sync or get applied unvalidated.
      const parsed = snap.exists() ? cloudDocSchema.safeParse(snap.data()) : null;
      const cloud = parsed?.success ? parsed.data : null;

      const local = loadSchedule();
      const merge = cloud ? mergeSchedules(local, cloud.schedule, { reconcileLegacy }) : null;
      const schedule = merge ? merge.schedule : local;

      const settingsPulled =
        cloud !== null &&
        (!meta.lastKnownCloudSettingsUpdatedAt || cloud.settingsUpdatedAt > meta.lastKnownCloudSettingsUpdatedAt);
      const settings = cloud && settingsPulled ? mergeSettings(loadSettings(), cloud.settings) : loadSettings();

      transaction.set(ref, { syncVersion: 1, schedule, settings, scheduleUpdatedAt: now, settingsUpdatedAt: now });
      return { merge, schedule, settings, settingsPulled };
    });
  } catch {
    return { action: "noop" };
  }

  // Merged again with whatever is stored now, in case the schedule was edited during the round-trip.
  applySyncedSchedule(mergeSchedules(loadSchedule(), outcome.schedule, { reconcileLegacy: false }).schedule);
  if (outcome.settingsPulled) replaceSettings(outcome.settings);
  updateSyncMeta({
    lastReconcileAt: now,
    lastKnownCloudSettingsUpdatedAt: now,
    scheduleMergeVersion: SCHEDULE_MERGE_VERSION,
  });

  const { merge } = outcome;
  if (!merge) return { action: "seeded" };
  const changed = merge.coursesAdded + merge.coursesRemoved + merge.holidaysAdded + merge.holidaysRemoved > 0;
  return {
    action: changed ? "merged" : outcome.settingsPulled ? "pulled" : "pushed",
    scheduleAddedCount: merge.coursesAdded,
    scheduleRemovedCount: merge.coursesRemoved,
    holidayAddedCount: merge.holidaysAdded,
    holidayRemovedCount: merge.holidaysRemoved,
  };
}

// Registered at module scope (not inside a React effect) so it's wired up
// before any page can possibly mount and call a repository mutator.
onSyncRequested(() => {
  void syncNow();
});
