/**
 * A light tick when something is checked off or marked. Android only: iPhone
 * browsers ignore vibration, and the known workaround stopped working in iOS 26.5.
 */
export function tapHaptic(): void {
  try {
    navigator.vibrate?.(10);
  } catch {
    // Nice-to-have only.
  }
}
