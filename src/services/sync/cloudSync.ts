import { doc, getDoc, setDoc } from "firebase/firestore";
import { z } from "zod";
import { scheduleSchema } from "../../schema/schedule";
import { appSettingsSchema, type AppSettings } from "../../schema/settings";
import { addCourses, addHolidays, loadSchedule } from "../storage/scheduleRepository";
import { loadSettings, saveSettings } from "../storage/settingsRepository";
import { db, isSyncConfigured } from "./firebaseConfig";
import { getCurrentUser } from "./googleAuth";
import { getSyncMeta, updateSyncMeta } from "./syncMeta";
import { onSyncRequested } from "./syncTrigger";

const cloudDocSchema = z.object({
  syncVersion: z.literal(1),
  schedule: scheduleSchema,
  settings: appSettingsSchema,
  scheduleUpdatedAt: z.string(),
  settingsUpdatedAt: z.string(),
});
type CloudDoc = z.infer<typeof cloudDocSchema>;

export interface SyncResult {
  action: "seeded" | "pulled" | "merged" | "pushed" | "noop";
  scheduleAddedCount?: number;
  holidayAddedCount?: number;
}

/** Cloud's semester dates win when both sides define a value; an undefined side falls back to the other. */
function mergeSettings(local: AppSettings, cloud: AppSettings): AppSettings {
  return {
    reminderMinutes: cloud.reminderMinutes,
    semesterStartDate: cloud.semesterStartDate ?? local.semesterStartDate,
    semesterEndDate: cloud.semesterEndDate ?? local.semesterEndDate,
  };
}

async function readCloudDoc(uid: string): Promise<CloudDoc | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const parsed = cloudDocSchema.safeParse(snap.data());
  // A corrupt/unexpected-shape document is treated the same as "no document yet" —
  // never let untrusted cloud data crash sync or get applied unvalidated.
  return parsed.success ? parsed.data : null;
}

async function pushCurrentState(uid: string, now: string): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, "users", uid), {
    syncVersion: 1,
    schedule: loadSchedule(),
    settings: loadSettings(),
    scheduleUpdatedAt: now,
    settingsUpdatedAt: now,
  });
  updateSyncMeta({
    lastReconcileAt: now,
    lastKnownCloudScheduleUpdatedAt: now,
    lastKnownCloudSettingsUpdatedAt: now,
  });
}

/**
 * The single entry point for every sync trigger (boot, background resume,
 * debounced edit, manual "立即同步"). Always ends by pushing the current
 * (possibly just-merged) local state back up, so the cloud timestamp always
 * reflects "last confirmed-in-sync moment".
 */
export async function syncNow(): Promise<SyncResult> {
  if (!isSyncConfigured || !db) return { action: "noop" };
  const user = getCurrentUser();
  if (!user) return { action: "noop" };

  let cloudData: CloudDoc | null;
  try {
    cloudData = await readCloudDoc(user.uid);
  } catch {
    return { action: "noop" };
  }

  const meta = getSyncMeta();
  const now = new Date().toISOString();
  let scheduleAddedCount = 0;
  let holidayAddedCount = 0;
  let action: SyncResult["action"] = cloudData ? "noop" : "seeded";

  if (cloudData) {
    const cloudScheduleIsNewer =
      !meta.lastKnownCloudScheduleUpdatedAt || cloudData.scheduleUpdatedAt > meta.lastKnownCloudScheduleUpdatedAt;
    if (cloudScheduleIsNewer) {
      scheduleAddedCount = addCourses(cloudData.schedule.courses).addedCount;
      if (cloudData.schedule.holidays && cloudData.schedule.holidays.length > 0) {
        holidayAddedCount = addHolidays(
          cloudData.schedule.holidays.map(({ name, startDate, endDate }) => ({ name, startDate, endDate })),
        ).addedCount;
      }
      action = scheduleAddedCount > 0 || holidayAddedCount > 0 ? "merged" : "pulled";
    }

    const cloudSettingsIsNewer =
      !meta.lastKnownCloudSettingsUpdatedAt || cloudData.settingsUpdatedAt > meta.lastKnownCloudSettingsUpdatedAt;
    if (cloudSettingsIsNewer) {
      saveSettings(mergeSettings(loadSettings(), cloudData.settings));
      if (action === "noop") action = "pulled";
    }
  }

  try {
    await pushCurrentState(user.uid, now);
  } catch {
    return { action: "noop" };
  }

  if (action === "noop") action = "pushed";
  return { action, scheduleAddedCount, holidayAddedCount };
}

// Registered at module scope (not inside a React effect) so it's wired up
// before any page can possibly mount and call a repository mutator.
onSyncRequested(() => {
  void syncNow();
});
