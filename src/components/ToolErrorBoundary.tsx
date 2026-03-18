/**
 * ToolErrorBoundary — React error boundary for individual AI tools
 *
 * Wraps each tool so a crash in one tool doesn't unmount the entire AIToolsPage.
 * Shows a friendly fallback with a "Reload Tool" button.
 */
import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  toolName: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ToolErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ToolErrorBoundary] "${this.props.toolName}" crashed:`, error, info);
    console.error(`[ToolErrorBoundary] message:`, error?.message ?? String(error));
    console.error(`[ToolErrorBoundary] stack:`, error?.stack ?? 'no stack');
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <ToolError name={this.props.toolName} onReload={this.handleReload} />;
    }
    return this.props.children;
  }
}

// ── Fallback UI ───────────────────────────────────────────────────────────────

interface ToolErrorProps {
  name: string;
  onReload: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
function ToolError({ name, onReload }: ToolErrorProps) {
  return (
    <div
      data-testid="error-boundary"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        gap: 16,
        color: 'var(--text-secondary, #aaa)',
        textAlign: 'center',
        minHeight: 200,
      }}
    >
      <div style={{ fontSize: 36 }}>🔧</div>

      <div>
        <p style={{ margin: '0 0 6px', fontWeight: 600, color: 'var(--text-primary, #fff)', fontSize: 16 }}>
          The <strong>{name}</strong> encountered an error.
        </p>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary, #aaa)' }}>
          Your other tools are unaffected.
        </p>
      </div>

      <button
        onClick={onReload}
        style={{
          padding: '10px 20px',
          borderRadius: 8,
          border: '1px solid var(--accent, #6366f1)',
          background: 'transparent',
          color: 'var(--accent, #6366f1)',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Reload Tool
      </button>
    </div>
  );
}
