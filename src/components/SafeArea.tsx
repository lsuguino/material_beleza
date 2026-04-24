'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Error Boundary: evita que a página inteira caia quando um componente filho der erro.
 * Mostra uma mensagem e opção de voltar, em vez de tela branca.
 */
export class SafeArea extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SafeArea]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0f1823] text-white">
          <h1 className="text-xl font-bold mb-2">Algo deu errado</h1>
          <p className="text-white/70 text-sm mb-4 max-w-md text-center">
            Ocorreu um erro na página. Você pode tentar novamente ou voltar ao início.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-sm mb-2"
          >
            Tentar novamente
          </button>
          <a href="/" className="text-sm text-white/60 hover:text-white underline">
            Voltar ao início
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}
