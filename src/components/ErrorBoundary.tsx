import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-4 py-10 text-center">
          <p className="text-2xl font-black text-ink dark:text-white">發生錯誤,畫面跑不出來</p>
          <p className="max-w-md text-sm font-bold text-ink/60 dark:text-white/60">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full border-2 border-ink bg-lime px-6 py-3 text-sm font-black text-ink transition-transform active:scale-95 dark:border-lime"
          >
            重新整理畫面
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
