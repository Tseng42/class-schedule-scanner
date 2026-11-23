import type { AppSettings } from "../schema/settings";
import { THEMES } from "../lib/theme";

interface ThemeSettingsProps {
  settings: AppSettings;
  /** Called with the full updated settings; the parent persists and applies them. */
  onChange: (next: AppSettings) => void;
}

export function ThemeSettings({ settings, onChange }: ThemeSettingsProps) {
  const current = settings.theme ?? "original";
  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-bold">選一套配色,整個 App 會一起換</legend>
        {THEMES.map((theme) => (
          <label
            key={theme.id}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 ${
              current === theme.id ? "border-ink" : "border-ink/15"
            }`}
          >
            <input
              type="radio"
              name="theme"
              value={theme.id}
              checked={current === theme.id}
              onChange={() => onChange({ ...settings, theme: theme.id })}
              className="accent-ink"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black">{theme.name}</span>
              <span className="mt-0.5 block text-xs font-bold opacity-70">{theme.description}</span>
            </span>
            <span aria-hidden="true" className="flex shrink-0 -space-x-1.5">
              {Object.values(theme.colors).map((color) => (
                <span
                  key={color}
                  className="size-6 rounded-full border-2 border-ink"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
          </label>
        ))}
      </fieldset>
      <p className="text-xs font-bold opacity-70">每套配色的文字對比都檢查過。改完會自動儲存;有開雲端同步的話,其他裝置也會一起換。</p>
    </>
  );
}
