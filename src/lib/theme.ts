import type { AppSettings } from "../schema/settings";

export type ThemeId = NonNullable<AppSettings["theme"]>;

/** The four accent slots every screen is built from; a theme swaps them all at once. */
export interface ThemeColors {
  lime: string;
  pink: string;
  sky: string;
  mint: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  colors: ThemeColors;
}

// Every color here stays at 9:1 or better against ink (#0b0b0f) in both directions, since
// the app puts ink text on these and also uses them as text on ink (WCAG asks 4.5:1).
export const THEMES: Theme[] = [
  {
    id: "original",
    name: "原本",
    description: "萊姆綠、粉紅、天藍、薄荷綠",
    colors: { lime: "#d7f24c", pink: "#ff8fc0", sky: "#7fd6f5", mint: "#b0f5c8" },
  },
  {
    id: "morandi",
    name: "莫蘭迪",
    description: "灰綠、灰粉、灰藍、奶茶,低調不刺眼",
    colors: { lime: "#c3cca5", pink: "#dcb5b0", sky: "#adc0d1", mint: "#d8c7ad" },
  },
  {
    id: "ocean",
    name: "海洋",
    description: "湖綠、水藍、淺青、沙色",
    colors: { lime: "#72d6c4", pink: "#90c2f0", sky: "#b6e9f4", mint: "#eadbb7" },
  },
  {
    id: "sunset",
    name: "夕陽",
    description: "橘色、珊瑚、奶黃、淺桃",
    colors: { lime: "#ffb26b", pink: "#ff9b8c", sky: "#ffe08a", mint: "#ffc8c2" },
  },
  {
    id: "candy",
    name: "糖果粉彩",
    description: "淺紫、淺粉、淺藍、淺黃",
    colors: { lime: "#cdb9f5", pink: "#ffc2dd", sky: "#b9dbff", mint: "#fff0a6" },
  },
];

const SLOTS = ["lime", "pink", "sky", "mint"] as const;

export function findTheme(id: ThemeId | undefined): Theme {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

let activeTheme: Theme = THEMES[0];

/**
 * Points the Tailwind color variables (--color-lime etc.) at the theme's colors, so every
 * bg-lime / text-pink / border-sky on screen follows. The original theme just clears the
 * overrides and falls back to the values in index.css.
 */
export function applyTheme(id: ThemeId | undefined): void {
  activeTheme = findTheme(id);
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const slot of SLOTS) {
    if (activeTheme.id === "original") root.style.removeProperty(`--color-${slot}`);
    else root.style.setProperty(`--color-${slot}`, activeTheme.colors[slot]);
  }
}

/** The active theme's accents in slot order, for drawing that can't use CSS (canvas, confetti). */
export function accentHex(): string[] {
  return SLOTS.map((slot) => activeTheme.colors[slot]);
}
