import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    name?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    constructor(props: Props) {
        super(props);
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center p-8 bg-red-500/10 border border-red-500/20 rounded-xl m-4 text-center">
                    <div className="flex flex-col items-center">
                        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                        <h2 className="text-xl font-bold text-red-400 mb-2">Something went wrong</h2>
                        <p className="text-slate-400 mb-4 max-w-md">
                            The application encountered an error in <strong>{this.props.name || 'this component'}</strong>.
                        </p>
                        {this.state.error && (
                            <pre className="bg-slate-950 p-4 rounded text-xs text-red-300 overflow-auto max-w-full text-left font-mono">
                                {this.state.error.toString()}
                            </pre>
                        )}
                        <button
                            onClick={() => this.setState({ hasError: false, error: null })}
                            className="mt-6 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
