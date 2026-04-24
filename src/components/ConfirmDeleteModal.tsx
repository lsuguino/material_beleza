'use client';

import { useEffect } from 'react';
import { Scribolito } from '@/components/Scribolito';

interface Props {
  open: boolean;
  message?: string;
  materialTitle?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal de confirmação de delete com Scribolito "surpreso".
 * Renderiza fullscreen overlay + card centralizado.
 * Fecha com Escape. Não fecha no click-fora (exige decisão explícita).
 */
export function ConfirmDeleteModal({
  open,
  message,
  materialTitle,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  const defaultMessage = materialTitle
    ? `Você realmente quer apagar "${materialTitle}"?`
    : 'Você realmente quer apagar esse material?';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        <div className="flex flex-col items-center text-center gap-6">
          <Scribolito size={140} walking={false} face="surpreso" />
          <div className="flex flex-col gap-2">
            <h2
              id="confirm-delete-title"
              className="text-xl font-bold text-neutral-900"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              {message || defaultMessage}
            </h2>
            <p className="text-sm text-neutral-500">Essa ação não pode ser desfeita.</p>
          </div>
          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 font-semibold text-neutral-700 transition-colors hover:bg-neutral-100"
            >
              Não
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-red-700"
            >
              Sim
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
