import { useState } from "react";
import { HomePage } from "./pages/HomePage";
import { UploadPage } from "./pages/UploadPage";
import { SettingsPage } from "./pages/SettingsPage";

type View = "home" | "upload" | "settings";

const TABS: { view: View; label: string }[] = [
  { view: "home", label: "今天課表" },
  { view: "upload", label: "掃描課表" },
  { view: "settings", label: "設定" },
];

function App() {
  const [view, setView] = useState<View>("home");

  return (
    <div className="min-h-screen bg-cream dark:bg-ink">
      <nav className="mx-auto flex max-w-2xl gap-1 px-4 pt-5">
        <div className="flex gap-1 rounded-full border-2 border-ink bg-white p-1 dark:border-white/20 dark:bg-white/5">
          {TABS.map((tab) => (
            <button
              key={tab.view}
              type="button"
              onClick={() => setView(tab.view)}
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
      {view === "home" && <HomePage onNavigateUpload={() => setView("upload")} />}
      {view === "upload" && <UploadPage onNavigateHome={() => setView("home")} />}
      {view === "settings" && <SettingsPage />}
    </div>
  );
}

export default App;
