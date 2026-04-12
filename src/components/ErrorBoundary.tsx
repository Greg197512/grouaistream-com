import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

/**
 * Global Error Boundary — catches React render crashes
 * and shows a recovery UI instead of a blank screen.
 * Also cleans up potential memory-leak sources before recovery.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorCount: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Caught:", error, info.componentStack);

    // Increment persistent crash counter for auto-cleanup
    try {
      const count = parseInt(localStorage.getItem("grooveai-crash-count") || "0", 10);
      localStorage.setItem("grooveai-crash-count", String(count + 1));

      // After 3+ crashes, clear caches to break potential corruption loops
      if (count >= 2) {
        this.cleanupCaches();
        localStorage.setItem("grooveai-crash-count", "0");
      }
    } catch {}
  }

  cleanupCaches = () => {
    try {
      // Clear React Query cache from localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith("tanstack") ||
          key.startsWith("REACT_QUERY") ||
          key.includes("grooveai-skip") ||
          key.includes("grooveai-cover-cache")
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      // Close any lingering AudioContexts
      if ((window as any).__audioContexts) {
        (window as any).__audioContexts.forEach((ctx: AudioContext) => {
          try { ctx.close(); } catch {}
        });
        (window as any).__audioContexts = [];
      }
    } catch {}
  };

  handleReload = () => {
    // Clear error state and reload
    this.cleanupCaches();
    window.location.reload();
  };

  handleSoftRecover = () => {
    this.setState({ hasError: false, error: null, errorCount: this.state.errorCount + 1 });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="text-6xl">🎵</div>
            <h1 className="text-2xl font-bold text-white">
              GrouAI Stream napotkał problem
            </h1>
            <p className="text-gray-400 text-sm">
              {this.state.error?.message || "Nieoczekiwany błąd aplikacji"}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleSoftRecover}
                className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-medium transition-colors"
              >
                Spróbuj kontynuować
              </button>
              <button
                onClick={this.handleReload}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                Przeładuj aplikację
              </button>
            </div>
            <p className="text-xs text-gray-600">
              Jeśli problem się powtarza, wyczyść dane przeglądarki dla tej strony.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
