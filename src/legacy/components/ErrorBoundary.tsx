import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export interface ErrorBoundaryProps {
  children?: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
  key?: React.Key;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AndradeAgro ErrorBoundary] Erro capturado na renderização:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full min-h-[300px] p-6 rounded-3xl bg-[#042d23] border border-amber-500/40 text-slate-100 flex flex-col items-center justify-center text-center space-y-4 shadow-xl my-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-[#FACC15]" />
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="font-bold text-sm text-slate-100">
              {this.props.fallbackTitle || 'Ocorreu um erro ao exibir este módulo'}
            </h3>
            <p className="text-xs text-amber-200/80">
              {this.state.error?.message || 'Falha temporária de interface.'}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2 rounded-xl bg-[#FACC15] hover:bg-amber-400 text-gray-950 font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Recarregar Módulo</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
