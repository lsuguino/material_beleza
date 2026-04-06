'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { type PreviewData } from '@/components/MaterialPreviewBlocks';
import { DropzoneParticles } from '@/components/DropzoneParticles';
import { FooterParticles } from '@/components/FooterParticles';
import { ScriboLogo } from '@/components/ScriboLogo';
import { useScriboUi } from '@/context/ScriboUiContext';
import { COURSE_PICKER_OPTIONS } from '@/lib/coursePickerOptions';
import { ClipboardQuestionRegular } from '@/vendor/dev-mbr-icons';

const STORAGE_KEY = 'rtg-preview-data';

const PROGRESS_MESSAGES = [
  'Lendo transcrição...',
  'Estruturando conteúdo...',
  'Aplicando design...',
  'Finalizando...',
];

const FINALIZANDO_CICLO = [
  'Aplicando design...',
  'Revisando material...',
  'Ajustando conteúdo...',
];

/** Extensões aceitas para arquivo de texto ou PDF. */
const TEXT_EXTENSIONS = ['.txt', '.vtt', '.srt', '.md', '.csv', '.json', '.xml'];
const PDF_EXTENSION = '.pdf';
function isAcceptedFile(f: File): boolean {
  const name = (f.name || '').toLowerCase();
  const okText = TEXT_EXTENSIONS.some((ext) => name.endsWith(ext));
  const okPdf = name.endsWith(PDF_EXTENSION) || f.type === 'application/pdf';
  const okType = (f.type || '').startsWith('text/') || f.type === 'application/x-subrip' || f.type === '';
  return okText || okPdf || okType;
}

type Modo = 'completo' | 'resumido';

function playNotificationSound() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // ignore
  }
}

export default function Home() {
  const router = useRouter();
  const { notifyWhenDone, dark, toggleDark, toggleNotifyWhenDone } = useScriboUi();
  const loadingWasActive = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLLabelElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cursoId, setCursoId] = useState('geral');
  const [modo, setModo] = useState<Modo>('completo');
  /** Na primeira geração (arquivo único ou 1º do lote), pede 3 perguntas extras ao backend. */
  const [comPerguntas, setComPerguntas] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<PreviewData | null>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  /** Controla o colapso animado da área de upload ao iniciar geração */
  const [dropzoneCollapsing, setDropzoneCollapsing] = useState(false);

  /** Referência ao AbortController ativo — permite cancelar a geração em curso */
  const abortControllerRef = useRef<AbortController | null>(null);

  const [batchQueue, setBatchQueue] = useState<File[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchCurrentFile, setBatchCurrentFile] = useState<File | null>(null);
  const [batchRegenerating, setBatchRegenerating] = useState(false);

  const isBatchMode = batchQueue.length > 0;
  const currentBatchFile = batchCurrentFile || (batchQueue.length > 0 ? batchQueue[batchIndex] : null);

  useEffect(() => {
    if (loadingWasActive.current && !loading && generatedData && notifyWhenDone) {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('scribo', { body: 'Diagramação do material concluída.' });
        } catch {
          // ignore
        }
      }
    }
    loadingWasActive.current = loading;
  }, [loading, generatedData, notifyWhenDone]);

  const runGenerate = useCallback(
    async (textFile: File, effectiveCursoId?: string, opts?: { comPerguntas?: boolean; signal?: AbortSignal }) => {
      const cid = effectiveCursoId ?? (cursoId || 'geral');
      const form = new FormData();
      form.append('vtt', textFile);
      form.append('curso_id', cid);
      form.append('modo', modo);
      if (opts?.comPerguntas) {
        form.append('com_perguntas', '1');
      }
      const res = await fetch('/api/generate', { method: 'POST', body: form, signal: opts?.signal });
      if (!res.ok) {
        let msg = 'Falha ao gerar material';
        try {
          const data = await res.json();
          if (typeof data?.error === 'string' && data.error.trim()) msg = data.error;
        } catch {
          const text = await res.text().catch(() => '');
          if (text && text.length < 300 && !text.startsWith('<')) msg = text;
        }
        throw new Error(msg);
      }
      return res.json() as Promise<PreviewData>;
    },
    [cursoId, modo]
  );

  /** Cancela a geração em curso e retorna à área de seleção de arquivo. */
  const handleCancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
    setProgressStep(0);
    setDropzoneCollapsing(false);
    setError(null);
    // Limpa lote se estiver em modo batch
    setBatchQueue([]);
    setBatchIndex(0);
    setBatchCurrentFile(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file) {
      setError('Selecione um arquivo de texto (clique em "Selecionar Arquivo" ou arraste o arquivo na área).');
      return;
    }
    const cId = cursoId || 'geral';
    if (!cId) {
      setError('Selecione o curso de destino.');
      return;
    }
    setError(null);
    // Dispara o colapso animado do dropzone antes de iniciar
    setDropzoneCollapsing(true);
    // Aguarda a transição CSS (500ms) antes de marcar loading
    await new Promise<void>((resolve) => setTimeout(resolve, 480));
    setLoading(true);
    setProgressStep(0);
    setGeneratedData(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const interval = setInterval(() => setProgressStep((s) => s + 1), 2500);

    try {
      const raw = await runGenerate(file, cId, { comPerguntas, signal: controller.signal });
      clearInterval(interval);
      setError(null);
      // Extrai _pdfId retornado pelo servidor (não faz parte do PreviewData)
      const rawAny = raw as Record<string, unknown>;
      const pdfId = typeof rawAny._pdfId === 'string' ? rawAny._pdfId : null;
      const { _pdfId: _omit, ...data } = rawAny;
      void _omit;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        if (pdfId) window.localStorage.setItem('rtg-pdf-id', pdfId);
        else window.localStorage.removeItem('rtg-pdf-id');
      }
      setGeneratedData(data as PreviewData);
    } catch (err) {
      clearInterval(interval);
      // Ignora erro de cancelamento (AbortError)
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Erro ao gerar material');
      // Reabre o dropzone se der erro
      setDropzoneCollapsing(false);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [file, cursoId, modo, comPerguntas, runGenerate]);

  const processNextBatch = useCallback(() => {
    if (batchQueue.length === 0) return;
    setGeneratedData(null);
    setDropzoneCollapsing(false);
    setBatchRegenerating(false);
    if (batchIndex >= batchQueue.length - 1) {
      setBatchQueue([]);
      setBatchIndex(0);
      setBatchCurrentFile(null);
      return;
    }
    const next = batchIndex + 1;
    setBatchIndex(next);
    setBatchCurrentFile(batchQueue[next]);
    setLoading(true);
    setProgressStep(0);
    runGenerate(batchQueue[next], undefined, { comPerguntas: false })
      .then((data) => {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
        setGeneratedData(data);
        playNotificationSound();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [batchQueue, batchIndex, runGenerate]);

  const handleBatchFolder = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const textFiles = files.filter((f) => isAcceptedFile(f));
      e.target.value = '';
      if (textFiles.length === 0) {
        setError('Nenhum arquivo de texto ou PDF na pasta (.txt, .vtt, .srt, .md, .pdf, etc.).');
        return;
      }
      setBatchQueue(textFiles);
      setBatchIndex(0);
      setBatchCurrentFile(textFiles[0]);
      setError(null);
      setGeneratedData(null);
      setLoading(true);
      setProgressStep(0);
      runGenerate(textFiles[0], undefined, { comPerguntas })
        .then((data) => {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          }
          setGeneratedData(data);
          playNotificationSound();
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Erro'))
        .finally(() => setLoading(false));
    },
    [runGenerate, comPerguntas]
  );

  const handleDiscardAndRegenerate = useCallback(() => {
    if (!currentBatchFile || batchQueue.length === 0) return;
    setBatchRegenerating(true);
    setLoading(true);
    setProgressStep(0);
    setGeneratedData(null);
    runGenerate(currentBatchFile, undefined, { comPerguntas: batchIndex === 0 && comPerguntas })
      .then((data) => {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
        setGeneratedData(data);
        playNotificationSound();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro'))
      .finally(() => {
        setLoading(false);
        setBatchRegenerating(false);
      });
  }, [currentBatchFile, batchQueue.length, batchIndex, comPerguntas, runGenerate]);

  const openPreviewFull = useCallback(() => {
    router.push('/preview');
  }, [router]);

  // Polling: verifica se o PDF pré-gerado está pronto
  useEffect(() => {
    if (!generatedData) { setPdfReady(false); return; }
    const id = typeof window !== 'undefined' ? window.localStorage.getItem('rtg-pdf-id') : null;
    if (!id) return;
    let cancelled = false;
    const poll = async () => {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/pdf/${id}?check=1`);
          if (!res.ok) { cancelled = true; return; }
          const json = await res.json() as { ready: boolean; error?: string };
          if (json.ready) { if (!cancelled) setPdfReady(true); return; }
        } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 1500));
      }
    };
    void poll();
    return () => { cancelled = true; };
  }, [generatedData]);

  const handleReset = useCallback(() => {
    setGeneratedData(null);
    setDropzoneCollapsing(false);
    setFile(null);
    setPdfReady(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('rtg-pdf-id');
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const handleDownloadPdfMain = useCallback(async () => {
    if (!generatedData) return;
    setPdfLoading(true);
    try {
      const title = (generatedData.conteudo?.titulo || generatedData.design?.titulo || 'material')
        .toLowerCase()
        .replace(/[^a-z0-9\u00C0-\u017F]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'material';
      const pdfId = typeof window !== 'undefined' ? window.localStorage.getItem('rtg-pdf-id') : null;
      let blob: Blob;
      if (pdfId) {
        const res = await fetch(`/api/pdf/${pdfId}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Erro ao baixar PDF.' }));
          throw new Error((err as { error?: string }).error || 'Erro ao baixar PDF.');
        }
        blob = await res.blob();
        window.localStorage.removeItem('rtg-pdf-id');
        setPdfReady(false);
      } else {
        const previewUrl = `${window.location.origin}/preview`;
        const storagePayload: Record<string, string> = {
          [STORAGE_KEY]: JSON.stringify(generatedData),
          'rtg-pdf-mode': '1',
        };
        const res = await fetch('/api/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: previewUrl, data: storagePayload }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Erro ao gerar PDF.' }));
          throw new Error((err as { error?: string }).error || 'Erro ao gerar PDF.');
        }
        blob = await res.blob();
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[handleDownloadPdfMain]', err);
      alert(err instanceof Error ? err.message : 'Erro inesperado ao gerar o PDF. Tente novamente.');
    } finally {
      setPdfLoading(false);
    }
  }, [generatedData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && isAcceptedFile(f)) {
      setFile(f);
      setError(null);
    } else if (f) {
      setError('Arraste apenas arquivos de texto ou PDF.');
    }
  }, []);

  const progressLabel =
    progressStep < PROGRESS_MESSAGES.length
      ? PROGRESS_MESSAGES[progressStep]
      : FINALIZANDO_CICLO[(progressStep - PROGRESS_MESSAGES.length) % FINALIZANDO_CICLO.length];
  const progressWidth =
    progressStep < PROGRESS_MESSAGES.length
      ? `${((progressStep + 1) / PROGRESS_MESSAGES.length) * 90}%`
      : '90%';
  const progressPercent =
    progressStep < PROGRESS_MESSAGES.length
      ? Math.round(((progressStep + 1) / PROGRESS_MESSAGES.length) * 90)
      : 90;

  const dropzoneClass = isDragging
    ? 'border-primary bg-primary/5 dark:bg-primary/15 shadow-lg shadow-primary/20 dark:shadow-primary/30 ring-2 ring-primary/30'
    : 'border-outline-variant hover:border-primary dark:border-outline-variant/40 dark:hover:border-primary';

  return (
    <div className="font-body bg-background text-on-surface flex w-full overflow-x-hidden selection:bg-primary/20 dark:selection:bg-primary/35 dark:selection:text-white min-h-screen flex-col">
      <div className="flex flex-col flex-1 min-h-0 min-w-0 w-full">
        <header className="sticky top-0 z-40 shrink-0 bg-[var(--scribo-header-bg)] backdrop-blur-xl">
          <div className="flex flex-wrap justify-between items-center gap-y-2 w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-2 sm:py-2.5 max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto">
            <div className="flex items-center min-w-0 shrink-0">
              <ScriboLogo className="shrink-0 text-[#1a2dc2] transition-colors dark:text-[#7B9CFF]" />
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <button
                type="button"
                onClick={() => void toggleNotifyWhenDone()}
                aria-pressed={notifyWhenDone}
                title={
                  notifyWhenDone
                    ? 'Aviso ao concluir ativo — clique para desligar'
                    : 'Avisar quando a diagramação terminar'
                }
                className={`relative p-1.5 rounded-full transition-colors ${
                  notifyWhenDone
                    ? 'text-primary bg-primary/15 dark:bg-primary/25'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high/80 dark:hover:bg-surface-high/45'
                }`}
              >
                <span className="material-symbols-outlined text-[20px] sm:text-[22px]">notifications</span>
                {notifyWhenDone && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-[var(--scribo-header-bg)]" />
                )}
              </button>
              <button
                type="button"
                onClick={toggleDark}
                aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
                title={dark ? 'Modo claro' : 'Modo escuro'}
                className="p-1.5 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-high/80 dark:hover:bg-surface-high/45 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] sm:text-[22px]">{dark ? 'light_mode' : 'dark_mode'}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0 w-full overflow-y-auto">
          <section className="relative isolate w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-8 lg:py-10">
              <FooterParticles hasFile={!!file} generating={loading} />
              <div className="mb-8 lg:mb-10 text-left max-w-3xl xl:max-w-4xl">
                <h1 className="font-headline text-3xl sm:text-4xl md:text-[2.75rem] font-bold text-on-surface dark:text-white tracking-tight leading-[1.12] mb-5">
                  <span className="block">Geração inteligente de</span>
                  <span className="mt-1.5 block sm:mt-2">
                    materiais de estudo com{' '}
                    <span className="inline-block align-middle rounded-full bg-primary/12 px-3 py-1 text-[0.92em] font-bold uppercase tracking-tight text-primary shadow-sm dark:bg-primary/20 dark:text-[#7B9CFF]">
                      IA
                    </span>
                  </span>
                </h1>
                <p className="max-w-2xl text-[#6b7280] dark:text-white/55 text-base sm:text-lg font-body font-normal leading-relaxed">
                  Transforme suas transquições de aulas em materiais de estudo, ou resumos em segundos.
                </p>
              </div>

              <div className="flex flex-col gap-7 lg:gap-8 w-full">
                {/* Dropzone — colapsa suavemente ao iniciar geração */}
                <div
                  className="w-full overflow-hidden transition-all duration-500 ease-in-out"
                  style={{
                    maxHeight: dropzoneCollapsing ? 0 : 520,
                    opacity: dropzoneCollapsing ? 0 : 1,
                    transform: dropzoneCollapsing ? 'translateY(-12px) scale(0.98)' : 'translateY(0) scale(1)',
                    pointerEvents: dropzoneCollapsing ? 'none' : undefined,
                  }}
                >
                <div className="group w-full">
                  <input
                    id="vtt-file-input"
                    ref={inputRef}
                    type="file"
                    accept=".txt,.vtt,.srt,.md,.csv,.json,.xml,.pdf,text/*,application/x-subrip,application/pdf"
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        if (isAcceptedFile(f)) {
                          setFile(f);
                          setError(null);
                        } else {
                          setError('Selecione um arquivo de texto ou PDF (.txt, .vtt, .srt, .md, .pdf, etc.).');
                        }
                      }
                      e.target.value = '';
                    }}
                  />
                  <label
                    ref={dropzoneRef}
                    htmlFor="vtt-file-input"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(false);
                    }}
                    onDrop={handleDrop}
                    className={`relative bg-surface-container-lowest dark:bg-surface-container-low/90 rounded-xl p-10 sm:p-12 border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[260px] sm:min-h-[300px] cursor-pointer overflow-hidden dark:ring-1 dark:ring-outline-variant/25 ${dropzoneClass}`}
                  >
                    <DropzoneParticles containerRef={dropzoneRef} hasFile={!!file} />
                    <div className="relative z-10 flex flex-col items-center justify-center w-full">
                      <h3 className="text-lg sm:text-xl font-bold font-headline mb-2 text-on-surface dark:text-white px-1">
                        {file ? file.name : 'Arraste e solte seus arquivos'}
                      </h3>
                      <p className="text-on-surface-variant dark:text-white/75 mb-5 text-xs sm:text-sm px-2">
                        PDF, TXT, VTT, SRT, MD e outros textos (até 50MB)
                      </p>
                      <span className="bg-primary text-white font-semibold py-3.5 px-10 rounded-full shadow-lg shadow-primary/30 dark:shadow-primary/40 ring-2 ring-transparent dark:ring-outline-variant/20 hover:brightness-110 transition-all pointer-events-none inline-block">
                        Selecionar arquivo
                      </span>
                    </div>
                  </label>
                </div>
                </div>{/* fim do wrapper colapsável do dropzone */}

                <div className="w-full">
                  <div className="bg-surface-container-low dark:bg-surface-container/60 rounded-xl p-5 sm:p-7 shadow-md dark:shadow-xl border border-outline-variant/30 dark:border-0 text-center">
                    <div className="space-y-7 text-left">
                      <div>
                        <label className="text-xs sm:text-sm font-bold text-on-surface-variant dark:text-white/90 uppercase tracking-wider mb-3 block text-center sm:text-left">
                          Curso relacionado
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-1.5 sm:gap-x-3 sm:gap-y-2">
                          {COURSE_PICKER_OPTIONS.map((opt) => {
                            const selected = cursoId === opt.id;
                            const logoMaxClass =
                              opt.id === 'master-fluxo' ||
                              opt.id === 'lightcopy' ||
                              opt.id === 'super-ads'
                                ? 'max-h-3.5 sm:max-h-4'
                                : 'max-h-7 sm:max-h-8';
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={loading || !opt.enabled}
                                aria-label={opt.ariaLabel}
                                aria-pressed={opt.enabled ? selected : undefined}
                                onClick={() => {
                                  if (loading || !opt.enabled) return;
                                  setCursoId(opt.id);
                                }}
                                className={`flex min-h-[2.625rem] items-center justify-center rounded-xl border-2 px-2 py-1.5 transition-all sm:min-h-[2.875rem] sm:py-2 ${
                                  !opt.enabled
                                    ? 'cursor-not-allowed border-slate-300/90 bg-slate-200/95 dark:border-zinc-500/55 dark:bg-zinc-600/45'
                                    : selected
                                      ? 'cursor-pointer border-primary bg-primary/10 shadow-md ring-2 ring-primary/40 dark:bg-primary/15 dark:shadow-[0_0_0_1px_rgba(63,65,77,0.55)]'
                                      : 'cursor-pointer border-transparent bg-surface-container-lowest/80 dark:bg-surface-low/80 hover:border-primary/30'
                                }`}
                              >
                                {opt.logoSrc ? (
                                  <img
                                    src={opt.logoSrc}
                                    alt=""
                                    width={200}
                                    height={52}
                                    draggable={false}
                                    className={`${logoMaxClass} w-auto max-w-full object-contain object-center ${
                                      opt.enabled && selected
                                        ? 'brightness-0 dark:brightness-100'
                                        : 'brightness-0 opacity-55 dark:brightness-100 dark:opacity-50'
                                    }`}
                                  />
                                ) : (
                                  <span
                                    className={`px-1 text-center text-[10px] font-bold uppercase leading-snug tracking-wide sm:text-[11px] ${
                                      !opt.enabled
                                        ? 'text-zinc-500 dark:text-zinc-400'
                                        : 'text-on-surface'
                                    }`}
                                  >
                                    {opt.ariaLabel}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs sm:text-sm font-bold text-on-surface-variant dark:text-white/90 uppercase tracking-wider mb-3 block text-center sm:text-left">
                          Tipo de material
                        </label>
                        <div className="bg-surface-container-high dark:bg-surface-high/80 p-1.5 rounded-2xl grid grid-cols-2 gap-1.5 border border-outline-variant/20 dark:border-0">
                          <button
                            type="button"
                            onClick={() => !loading && setModo('completo')}
                            disabled={loading}
                            aria-pressed={modo === 'completo'}
                            aria-label="Material completo"
                            className={`flex items-center justify-center min-w-0 w-full py-3 px-1 sm:px-2 rounded-xl font-semibold text-sm transition-all ${
                              modo === 'completo'
                                ? 'bg-surface-container-lowest dark:bg-surface-lowest text-primary shadow-md dark:shadow-[0_0_0_1px_rgba(63,65,77,0.55)] ring-2 ring-primary/40'
                                : 'text-on-surface-variant dark:text-white/70 hover:text-on-surface dark:hover:text-white'
                            }`}
                          >
                            <img
                              src="/material-completo.svg"
                              alt=""
                              width={357}
                              height={44}
                              draggable={false}
                              className={`h-5 sm:h-6 w-auto max-w-full object-contain object-center pointer-events-none select-none brightness-0 dark:brightness-100 ${
                                modo === 'completo' ? 'opacity-100' : 'opacity-90'
                              } dark:opacity-100`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => !loading && setModo('resumido')}
                            disabled={loading}
                            aria-pressed={modo === 'resumido'}
                            aria-label="Resumo"
                            className={`flex items-center justify-center min-w-0 w-full py-3 px-1 sm:px-2 rounded-xl font-semibold text-sm transition-all ${
                              modo === 'resumido'
                                ? 'bg-surface-container-lowest dark:bg-surface-lowest text-primary shadow-md dark:shadow-[0_0_0_1px_rgba(63,65,77,0.55)] ring-2 ring-primary/40'
                                : 'text-on-surface-variant dark:text-white/70 hover:text-on-surface dark:hover:text-white'
                            }`}
                          >
                            <img
                              src="/resumo.svg"
                              alt=""
                              width={178}
                              height={44}
                              draggable={false}
                              className={`h-5 sm:h-6 w-auto max-w-full object-contain object-center pointer-events-none select-none brightness-0 dark:brightness-100 ${
                                modo === 'resumido' ? 'opacity-100' : 'opacity-90'
                              } dark:opacity-100`}
                            />
                          </button>
                        </div>
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => !loading && setComPerguntas((v) => !v)}
                          disabled={loading}
                          aria-pressed={comPerguntas}
                          title="Na primeira geração, o sistema também elabora 3 perguntas sobre o tema com base no seu arquivo."
                          aria-label={
                            comPerguntas
                              ? 'Desativar perguntas de estudo na geração'
                              : 'Incluir perguntas de estudo na primeira geração'
                          }
                          className={`w-full flex items-center justify-center gap-3 rounded-full border-2 px-4 py-3 font-bold text-base transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                            comPerguntas
                              ? 'border-primary/90 dark:border-primary/55 bg-primary/15 dark:bg-primary/20 text-primary dark:text-primary shadow-lg shadow-primary/20 ring-2 ring-primary/35'
                              : 'border-primary/30 dark:border-primary/50 bg-primary/5 dark:bg-primary/10 text-primary hover:bg-primary/10 dark:hover:bg-primary/20'
                          }`}
                        >
                          <ClipboardQuestionRegular size={24} className="shrink-0" />
                          <span className="text-center sm:text-left leading-tight">
                            Gerar material com perguntas de estudo
                          </span>
                        </button>
                      </div>

                      <div className="pt-2 space-y-4">
                        <input
                          ref={(el) => {
                            (batchInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                            if (el) el.setAttribute('webkitdirectory', '');
                          }}
                          type="file"
                          accept=".txt,.vtt,.srt,.md,.csv,.json,.xml,.pdf"
                          className="sr-only"
                          aria-hidden
                          multiple
                          onChange={handleBatchFolder}
                        />
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={loading}
                          aria-busy={loading}
                          aria-label={loading ? 'Gerando material' : 'Geração inteligente'}
                          className="w-full bg-primary text-on-primary font-bold text-base py-3 rounded-full border-2 border-primary/90 dark:border-primary/55 shadow-lg shadow-primary/30 hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                          {loading ? (
                            <span className="font-bold text-base tracking-tight">Gerando...</span>
                          ) : (
                            <img
                              src="/geracao-inteligente.svg"
                              alt=""
                              width={889}
                              height={88}
                              className="h-6 sm:h-7 w-auto max-w-[min(100%,42rem)] object-contain object-center pointer-events-none select-none"
                              draggable={false}
                            />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => batchInputRef.current?.click()}
                          disabled={loading}
                          className="w-full text-primary font-bold py-3 rounded-xl border-2 border-primary/30 dark:border-primary/50 bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 dark:hover:bg-primary/20 transition-all disabled:opacity-50"
                        >
                          Gerar uma pasta completa
                        </button>

                        {/* Barra de progresso — aparece logo abaixo, no lugar do botão */}
                        {loading && (
                          <div className="bg-surface-container-highest/90 dark:bg-surface-high/95 backdrop-blur-md rounded-2xl p-3 pr-3 shadow-xl border border-outline-variant/30 dark:border-outline-variant/35 dark:ring-1 dark:ring-outline-variant/25 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 animate-pulse ring-2 ring-primary/30">
                              <span className="material-symbols-outlined text-[20px]">pending</span>
                            </div>
                            <div className="flex-grow min-w-0">
                              <div className="flex justify-between items-center mb-1 gap-2">
                                <span className="text-xs font-black uppercase tracking-widest text-on-surface-variant truncate">
                                  {progressLabel}
                                </span>
                                <span className="text-xs font-bold text-primary shrink-0">{progressPercent}%</span>
                              </div>
                              <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all duration-500 shadow-lg shadow-primary/50"
                                  style={{ width: progressWidth }}
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleCancelGeneration}
                              title="Cancelar geração"
                              aria-label="Cancelar geração e voltar à seleção de arquivo"
                              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 dark:hover:bg-error/15 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Strip de pré-visualização — aparece após a geração */}
              {generatedData && !loading && (() => {
                const genDesign = generatedData.design || generatedData.conteudo;
                const genRawPag = genDesign?.paginas ?? (genDesign as { pages?: unknown[] })?.pages;
                const genPaginas = Array.isArray(genRawPag) ? genRawPag as Array<Record<string, unknown>> : [];
                const genTitle = generatedData.conteudo?.titulo || generatedData.design?.titulo || 'Material gerado';
                const accentColor = String((genDesign as Record<string, unknown>)?.cor_fundo_destaque || '#446EFF');
                const bgColor = String((genDesign as Record<string, unknown>)?.cor_fundo_principal || '#f5f5f5');
                return (
                  <div className="mt-4 rounded-xl border border-outline-variant/30 dark:border-outline-variant/35 bg-surface-container-low dark:bg-surface-container/60 overflow-hidden shadow-md">
                    {/* Cabeçalho */}
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-outline-variant/20 dark:border-outline-variant/30">
                      <span className="font-semibold text-sm text-on-surface dark:text-white truncate min-w-0">
                        {genTitle}
                        {genPaginas.length > 0 && (
                          <span className="ml-2 text-xs text-on-surface-variant dark:text-white/50 font-normal">
                            {genPaginas.length} página{genPaginas.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isBatchMode && (
                          <>
                            <button
                              type="button"
                              onClick={handleDiscardAndRegenerate}
                              disabled={batchRegenerating || loading}
                              className="px-3 py-1.5 text-xs font-semibold rounded-full border-2 border-primary/40 text-primary bg-primary/5 hover:bg-primary/10 transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[14px]">refresh</span>
                              Refazer
                            </button>
                            <button
                              type="button"
                              onClick={() => { if (typeof window !== 'undefined') window.open('/preview'); processNextBatch(); }}
                              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-surface-container-high dark:bg-surface-high/45 text-on-surface dark:text-white hover:bg-surface-container dark:hover:bg-surface-high/60 transition-colors border border-outline-variant dark:border-outline-variant/40"
                            >
                              Próximo
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={openPreviewFull}
                          className="px-3 py-1.5 text-xs font-semibold rounded-full border-2 border-primary/40 text-primary bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/20 transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                          Ver preview
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadPdfMain}
                          disabled={pdfLoading}
                          className="px-3 py-1.5 text-xs font-semibold rounded-full text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
                          style={{ backgroundColor: '#446EFF' }}
                        >
                          <span className="material-symbols-outlined text-[14px]">download</span>
                          {pdfLoading ? 'Aguardando...' : pdfReady ? '⚡ PDF' : 'Download PDF'}
                        </button>
                        <button
                          type="button"
                          onClick={handleReset}
                          title="Gerar novo material"
                          aria-label="Fechar e gerar novo material"
                          className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-high/50 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    </div>

                    {/* Faixa horizontal de miniaturas */}
                    <div className="px-3 py-3 overflow-x-auto">
                      <div className="flex flex-row gap-2" style={{ width: 'max-content' }}>
                        {genPaginas.map((p, i) => {
                          const pagBg = String((p as Record<string, unknown>).cor_fundo || bgColor);
                          const isAccent = String((p as Record<string, unknown>).tipo || '') === 'capa' || i === 0;
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={openPreviewFull}
                              title={`Página ${i + 1}`}
                              className="flex-shrink-0 rounded border border-black/10 dark:border-white/15 overflow-hidden flex flex-col hover:opacity-90 transition-opacity cursor-pointer"
                              style={{ width: 70, height: 99, backgroundColor: isAccent ? accentColor : pagBg }}
                            >
                              <div className="flex-1" />
                              <div className="text-center pb-1" style={{ color: isAccent ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.35)', fontSize: 9, fontWeight: 700 }}>
                                {i + 1}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Perguntas para reflexão */}
                    {generatedData.perguntas && generatedData.perguntas.length > 0 && (
                      <div className="px-4 py-3 border-t border-outline-variant/20 dark:border-outline-variant/30 bg-primary/5 dark:bg-primary/10">
                        <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Perguntas para reflexão</p>
                        <ol className="list-decimal list-inside space-y-1.5 text-sm text-on-surface dark:text-white/90 leading-snug">
                          {generatedData.perguntas.map((q, i) => (
                            <li key={i} className="pl-0.5">{q}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                );
              })()}

              {isBatchMode && loading && (
                <p className="mt-6 text-xs text-on-surface-variant dark:text-white/70">
                  Lote: {batchIndex + 1} de {batchQueue.length}
                  {currentBatchFile && ` — ${currentBatchFile.name}`}
                </p>
              )}

              <AnimatePresence>
                {error && (
                  <div className="mt-6 p-4 rounded-xl bg-error-container/80 dark:bg-error/20 border border-error/30 dark:border-error/50 text-error dark:text-red-200 text-sm w-full">
                    {error}
                  </div>
                )}
              </AnimatePresence>

              <footer className="relative z-10 mt-16 py-10 text-center">
                <ScriboLogo className="inline-block text-[#1a2dc2] dark:text-[#7B9CFF] opacity-40 dark:opacity-30" />
              </footer>
            </section>

        </main>

      </div>
    </div>
  );
}
