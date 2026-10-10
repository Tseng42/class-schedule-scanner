// @ts-check

const PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";

/**
 * Pushes one text message to the owner's LINE account. Never throws: a network
 * failure is reported the same way as an API error so callers have one path.
 * @param {string} text
 * @returns {Promise<{ ok: true } | { ok: false, status: number, message: string }>}
 */
export async function pushText(text) {
  try {
    const response = await fetch(PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${(process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "").trim()}`,
      },
      body: JSON.stringify({
        to: (process.env.LINE_USER_ID ?? "").trim(),
        messages: [{ type: "text", text }],
      }),
    });
    if (response.ok) return { ok: true };
    const body = /** @type {{ message?: unknown } | null} */ (await response.json().catch(() => null));
    const message = typeof body?.message === "string" ? body.message : response.statusText;
    return { ok: false, status: response.status, message };
  } catch (error) {
    return { ok: false, status: 0, message: error instanceof Error ? error.message : "network error" };
  }
}
