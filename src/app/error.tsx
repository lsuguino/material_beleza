'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0f1823] text-white">
      <h1 className="text-xl font-bold mb-2">Algo deu errado</h1>
      <p className="text-white/70 text-sm mb-4 max-w-md text-center">
        A página encontrou um erro. Tente recarregar ou voltar ao início.
      </p>
      <button
        type="button"
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-sm"
      >
        Tentar novamente
      </button>
      <a href="/" className="mt-4 text-sm text-white/60 hover:text-white underline">
        Voltar ao início
      </a>
    </div>
  );
}
