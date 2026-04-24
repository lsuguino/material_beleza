'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PreviewData } from '@/components/MaterialPreviewBlocks';

type Props = {
  data: PreviewData;
  isVtsdPreview: boolean;
};

export function TrainingFeedbackBar({ data, isVtsdPreview }: Props) {
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<{ approved: number; rejected: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/training-feedback');
        if (!res.ok || cancelled) return;
        const j = (await res.json()) as { approved?: number; rejected?: number; total?: number };
        if (!cancelled) {
          setStats({
            approved: j.approved ?? 0,
            rejected: j.rejected ?? 0,
            total: j.total ?? 0,
          });
        }
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const send = useCallback(
    async (verdict: 'approve' | 'reject') => {
      setStatus('loading');
      setMessage(null);
      try {
        const res = await fetch('/api/training-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verdict,
            format: 'scribo',
            snapshot: data,
            note: note.trim() || undefined,
            meta: {
              curso_id: data.curso_id ?? '',
              titulo: (data.conteudo?.titulo || data.design?.titulo || '').slice(0, 200),
            },
          }),
        });
        const j = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
        if (!res.ok) {
          throw new Error(j.error || `Erro ${res.status}`);
        }
        setStatus('ok');
        setMessage(
          verdict === 'approve'
            ? 'Material registrado como referência para próximas gerações.'
            : 'Feedback negativo registrado para orientar o modelo.'
        );
        setNote('');
      } catch (e) {
        setStatus('err');
        setMessage(e instanceof Error ? e.message : 'Falha ao enviar.');
      }
    },
    [data, note]
  );

  const muted = isVtsdPreview ? 'text-neutral-500' : 'text-white/50';
  const labelBtn =
    isVtsdPreview
      ? 'border border-black/15 bg-white text-neutral-800 hover:bg-neutral-50'
      : 'border border-white/20 bg-white/5 text-white hover:bg-white/10';

  return (
    <div
      className={`flex w-full max-w-2xl flex-col gap-3 rounded-2xl border px-4 py-3 ${
        isVtsdPreview ? 'border-black/10 bg-white/80' : 'border-white/10 bg-black/20'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-sm font-medium ${isVtsdPreview ? 'text-neutral-800' : 'text-white/90'}`}>
          Treino do modelo
        </p>
        {stats && stats.total > 0 && (
          <span className={`text-xs ${muted}`}>
            Histórico: {stats.approved} aprov. · {stats.rejected} reprov.
          </span>
        )}
      </div>
      <p className={`text-xs leading-snug ${muted}`}>
        Depois de revisar o PDF (e editar páginas, se quiser), registre se este material está adequado. Aprovados viram
        referência de estilo nas próximas gerações; reprovações ajudam a evitar padrões indesejados.
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Comentário opcional (ex.: tom, estrutura, o que corrigir)"
        rows={2}
        className={`w-full resize-y rounded-xl border px-3 py-2 text-sm outline-none ring-[#446EFF]/30 focus:ring-2 ${
          isVtsdPreview
            ? 'border-black/15 bg-white text-neutral-800 placeholder:text-neutral-400'
            : 'border-white/15 bg-[#1a1a24] text-white placeholder:text-white/35'
        }`}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={status === 'loading'}
          onClick={() => void send('approve')}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:cursor-wait disabled:opacity-60 ${labelBtn}`}
        >
          Aprovar material
        </button>
        <button
          type="button"
          disabled={status === 'loading'}
          onClick={() => void send('reject')}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:cursor-wait disabled:opacity-60 ${labelBtn}`}
        >
          Reprovar
        </button>
      </div>
      {message && (
        <p
          className={`text-sm ${status === 'err' ? 'text-amber-300' : isVtsdPreview ? 'text-emerald-800' : 'text-emerald-300/90'}`}
          role="status"
        >
          {message}
        </p>
      )}
    </div>
  );
}
