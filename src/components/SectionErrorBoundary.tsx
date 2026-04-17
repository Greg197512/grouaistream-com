import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  name?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Lekki ErrorBoundary dla pojedynczych sekcji strony głównej.
 * Crash jednej sekcji nie blokuje całej strony — zwraca null (ciche schowanie),
 * żeby reszta layoutu i sekcji działała dalej.
 */
class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[SectionErrorBoundary:${this.props.name || "section"}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

export default SectionErrorBoundary;
