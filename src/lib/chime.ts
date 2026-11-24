let context: AudioContext | null = null;

/**
 * Browsers (iOS Safari especially) only let a page make sound after the user
 * has tapped something, so this runs on the tap that starts the timer.
 */
export function unlockChime(): void {
  try {
    context ??= new AudioContext();
    void context.resume();
  } catch {
    // No Web Audio: the timer still works, silently.
  }
}

/** Two short soft tones, plus a buzz on phones that support vibration (not iPhone). */
export function playChime(): void {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // Vibration is a nice-to-have.
  }
  if (!context || context.state !== "running") return;
  const start = context.currentTime;
  [880, 660].forEach((frequency, index) => {
    const at = start + index * 0.25;
    const oscillator = context!.createOscillator();
    const gain = context!.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
    oscillator.connect(gain).connect(context!.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.45);
  });
}
