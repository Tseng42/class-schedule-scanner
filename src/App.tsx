import { useState } from "react";
import { HomePage } from "./pages/HomePage";
import { UploadPage } from "./pages/UploadPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ManageCoursesPage } from "./pages/ManageCoursesPage";
import { useSwipeNavigation } from "./hooks/useSwipeNavigation";
import { useAppUpdate } from "./hooks/useAppUpdate";

type View = "home" | "upload" | "manage" | "settings";
type Direction = "next" | "prev";

const TABS: { view: View; label: string }[] = [
  { view: "home", label: "課表" },
  { view: "manage", label: "所有課程" },
  { view: "upload", label: "掃描課表" },
  { view: "settings", label: "設定" },
];

function App() {
  const [view, setView] = useState<View>("home");
  const [direction, setDirection] = useState<Direction | null>(null);
  const updateReady = useAppUpdate();

  const navigateTo = (target: View) => {
    const from = TABS.findIndex((tab) => tab.view === view);
    const to = TABS.findIndex((tab) => tab.view === target);
    if (from === to) return;
    setDirection(to > from ? "next" : "prev");
    setView(target);
  };

  useSwipeNavigation((swipeDirection) => {
    const current = TABS.findIndex((tab) => tab.view === view);
    const target = TABS[current + (swipeDirection === "next" ? 1 : -1)];
    if (target) navigateTo(target.view);
  });

  return (
    <div className="min-h-screen bg-cream dark:bg-ink">
      <nav className="mx-auto flex max-w-2xl flex-wrap gap-1 px-4 pt-5">
        <div className="flex flex-wrap gap-1 rounded-full border-2 border-ink bg-white p-1 dark:border-white/20 dark:bg-white/5">
          {TABS.map((tab) => (
            <button
              key={tab.view}
              type="button"
              onClick={() => navigateTo(tab.view)}
              className={`rounded-full px-4 py-2 text-sm font-black transition-colors ${
                view === tab.view
                  ? "bg-ink text-lime dark:bg-lime dark:text-ink"
                  : "text-ink/50 hover:text-ink dark:text-white/50 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
      <div key={view} className={direction ? `page-enter-${direction}` : undefined}>
        {view === "home" && <HomePage onNavigateUpload={() => navigateTo("upload")} />}
        {view === "manage" && <ManageCoursesPage onNavigateUpload={() => navigateTo("upload")} />}
        {view === "upload" && <UploadPage onNavigateHome={() => navigateTo("home")} />}
        {view === "settings" && <SettingsPage />}
      </div>
      {updateReady && (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-full bg-ink py-2 pr-2 pl-5 text-sm font-black text-lime shadow-lg dark:bg-lime dark:text-ink">
          <span>有新版本可以使用</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-lime px-4 py-2 text-ink transition-transform active:scale-95 dark:bg-ink dark:text-lime"
          >
            更新
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
