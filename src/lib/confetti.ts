const COLORS = ["#d7f24c", "#ff8fc0", "#7fd6f5", "#b0f5c8", "#0b0b0f"];

/** A one-off confetti burst from the top of the screen. No-ops under reduced-motion. */
export function burstConfetti(pieceCount = 60): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const container = document.createElement("div");
  container.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;";
  document.body.appendChild(container);

  for (let i = 0; i < pieceCount; i++) {
    const piece = document.createElement("span");
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const startX = Math.random() * 100;
    const drift = (Math.random() * 2 - 1) * 24;
    const width = 6 + Math.random() * 6;
    const height = width * (0.4 + Math.random() * 0.3);
    const duration = 1400 + Math.random() * 900;
    const delay = Math.random() * 150;
    const rotateEnd = (360 + Math.random() * 360) * (Math.random() < 0.5 ? -1 : 1);

    piece.style.cssText = `
      position:absolute;
      top:-16px;
      left:${startX}vw;
      width:${width}px;
      height:${height}px;
      background:${color};
      border-radius:1px;
      opacity:1;
      animation:confetti-fall ${duration}ms cubic-bezier(0.35,0,0.65,1) ${delay}ms forwards;
      --confetti-drift:${drift}vw;
      --confetti-rotate:${rotateEnd}deg;
    `;
    container.appendChild(piece);
  }

  window.setTimeout(() => container.remove(), 2600);
}
