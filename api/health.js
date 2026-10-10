// @ts-check
// Temporary deployment diagnostic — reports which server module fails to load on Vercel.

/** @param {() => Promise<unknown>} load */
async function probe(load) {
  try {
    await load();
    return "ok";
  } catch (error) {
    return String(error instanceof Error ? `${error.name}: ${error.message}` : error).slice(0, 400);
  }
}

/**
 * @param {import("node:http").IncomingMessage} _request
 * @param {import("node:http").ServerResponse} response
 */
export default async function handler(_request, response) {
  const helpers = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (response));
  const report = {
    node: process.version,
    helpers: { status: typeof helpers.status, json: typeof helpers.json },
    imports: {
      env: await probe(() => import("./_lib/env.js")),
      schedule: await probe(() => import("./_lib/schedule.js")),
      line: await probe(() => import("./_lib/line.js")),
      adminApp: await probe(() => import("firebase-admin/app")),
      adminAuth: await probe(() => import("firebase-admin/auth")),
      adminFirestore: await probe(() => import("firebase-admin/firestore")),
      firebaseAdmin: await probe(() => import("./_lib/firebaseAdmin.js")),
    },
  };
  response.statusCode = 200;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(report, null, 2));
}
