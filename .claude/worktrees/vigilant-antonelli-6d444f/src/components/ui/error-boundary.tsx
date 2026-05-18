'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallbackTitle?: string;
    fallbackDescription?: string;
    onReset?: () => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Error capturado:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        this.props.onReset?.();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center">
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-full mb-4">
                        <AlertTriangle className="w-8 h-8 text-amber-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
                        {this.props.fallbackTitle || 'Algo no ha ido bien'}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-md">
                        {this.props.fallbackDescription ||
                            'Ha ocurrido un error inesperado. Puedes intentar recargar o volver al inicio.'}
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={this.handleReset}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-800 hover:bg-green-900 text-white rounded-xl text-sm font-medium transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reintentar
                        </button>
                        <a
                            href="/apps/mi-hogar"
                            className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <Home className="w-4 h-4" />
                            Ir al inicio
                        </a>
                    </div>
                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <details className="mt-6 text-left max-w-lg w-full">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-slate-600">
                                Detalles del error (solo en desarrollo)
                            </summary>
                            <pre className="mt-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs overflow-auto max-h-40">
                                {this.state.error.message}
                                {'\n'}
                                {this.state.error.stack}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

