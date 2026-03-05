'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { MaterialPreviewBlocks, type PreviewData } from '@/components/MaterialPreviewBlocks';
import { MermaidInit } from '@/components/MermaidInit';

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

type Modo = 'completo' | 'resumido';

interface ThemeOption {
  id: string;
  name: string;
}

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
  const inputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cursoId, setCursoId] = useState('');
  const [modo, setModo] = useState<Modo>('completo');
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<PreviewData | null>(null);

  const [batchQueue, setBatchQueue] = useState<File[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchCurrentFile, setBatchCurrentFile] = useState<File | null>(null);
  const [batchRegenerating, setBatchRegenerating] = useState(false);

  const isBatchMode = batchQueue.length > 0;
  const currentBatchFile = batchCurrentFile || (batchQueue.length > 0 ? batchQueue[batchIndex] : null);

  useEffect(() => {
    fetch('/api/themes')
      .then((res) => res.json())
      .then((data: ThemeOption[]) => {
        setThemes(data);
        if (data.length > 0 && !cursoId) setCursoId(data[0].id);
      })
      .catch(() => setThemes([{ id: 'geral', name: 'Venda Todo Santo Dia' }]));
  }, [cursoId]);

  const runGenerate = useCallback(
    async (vttFile: File) => {
      const form = new FormData();
      form.append('vtt', vttFile);
      form.append('curso_id', cursoId);
      form.append('modo', modo);
      const res = await fetch('/api/generate', { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data.error as string) || 'Falha ao gerar material');
      }
      return res.json() as Promise<PreviewData>;
    },
    [cursoId, modo]
  );

  const handleSubmit = useCallback(async () => {
    if (!file || !cursoId) {
      setError('Selecione o arquivo VTT e o curso de destino.');
      return;
    }
    setError(null);
    setLoading(true);
    setProgressStep(0);
    setGeneratedData(null);

    const interval = setInterval(() => setProgressStep((s) => s + 1), 2500);

    try {
      const data = await runGenerate(file);
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
      setGeneratedData(data);
    } catch (err) {
      clearInterval(interval);
      setError(err instanceof Error ? err.message : 'Erro ao gerar material');
    } finally {
      setLoading(false);
    }
  }, [file, cursoId, modo, runGenerate]);

  const processNextBatch = useCallback(() => {
    if (batchQueue.length === 0) return;
    setGeneratedData(null);
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
    runGenerate(batchQueue[next])
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
      const vtts = files.filter((f) => f.name.toLowerCase().endsWith('.vtt'));
      e.target.value = '';
      if (vtts.length === 0) {
        setError('Nenhum arquivo .vtt na pasta.');
        return;
      }
      setBatchQueue(vtts);
      setBatchIndex(0);
      setBatchCurrentFile(vtts[0]);
      setError(null);
      setGeneratedData(null);
      setLoading(true);
      setProgressStep(0);
      runGenerate(vtts[0])
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
    [runGenerate]
  );

  const handleDiscardAndRegenerate = useCallback(() => {
    if (!currentBatchFile || batchQueue.length === 0) return;
    setBatchRegenerating(true);
    setLoading(true);
    setProgressStep(0);
    setGeneratedData(null);
    runGenerate(currentBatchFile)
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
  }, [currentBatchFile, batchQueue.length, runGenerate]);

  const openPreviewFull = useCallback(() => {
    router.push('/preview');
  }, [router]);

  const progressLabel =
    progressStep < PROGRESS_MESSAGES.length
      ? PROGRESS_MESSAGES[progressStep]
      : FINALIZANDO_CICLO[(progressStep - PROGRESS_MESSAGES.length) % FINALIZANDO_CICLO.length];
  const progressWidth =
    progressStep < PROGRESS_MESSAGES.length
      ? `${((progressStep + 1) / PROGRESS_MESSAGES.length) * 90}%`
      : '90%';

  return (
    <div className="font-lexend bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen relative overflow-x-hidden">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-navy/60 dark:bg-navy/80 z-10" />
        <img
          alt="Fundo decorativo"
          className="w-full h-full object-cover"
          src="https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1920&q=80"
        />
      </div>

      <div className="relative z-20 flex flex-col min-h-screen">
        <header className="w-full px-6 py-4 flex items-center justify-between glass border-b-0 mt-4 mx-auto max-w-6xl rounded-xl">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-xl">auto_awesome</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-navy dark:text-white">Design Beleza</h1>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <span className="text-sm font-medium text-navy/70">Gerador de Materiais</span>
          </nav>
        </header>

        <main
          className={`flex-1 flex p-6 overflow-hidden min-h-0 ${
            generatedData
              ? 'flex-col md:flex-row gap-6'
              : 'flex-col items-center justify-center'
          }`}
        >
          {/* Card do formulário */}
          <div
            className={`w-full max-w-2xl glass rounded-xl p-8 shadow-2xl shrink-0 ${
              generatedData ? 'h-fit' : ''
            }`}
          >
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-extrabold text-navy mb-2">Geração Inteligente</h2>
              <p className="text-navy/60">Transforme suas aulas em materiais de estudo de alta qualidade.</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-navy/80 mb-2">Arquivo de Origem</label>
              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.types.includes('Files')) setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f && (f.name.toLowerCase().endsWith('.vtt') || f.type === 'text/vtt')) {
                    setFile(f);
                    setError(null);
                  } else setError('Envie apenas arquivos .vtt');
                }}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center bg-white/40 hover:bg-white/60 transition-all cursor-pointer group ${
                  isDragging ? 'border-primary bg-primary/10' : 'border-primary/30'
                }`}
              >
                <input ref={inputRef} type="file" accept=".vtt,text/vtt" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && (f.name.toLowerCase().endsWith('.vtt') || f.type === 'text/vtt')) {
                    setFile(f);
                    setError(null);
                  } else if (f) setError('Envie apenas arquivos .vtt');
                  e.target.value = '';
                }} />
                <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-primary text-3xl">upload_file</span>
                </div>
                <p className="text-navy font-medium">
                  {file ? file.name : 'Arraste seu arquivo VTT ou clique para selecionar'}
                </p>
                <p className="text-navy/40 text-xs mt-1">Apenas arquivos .vtt — limite 50MB</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                  className="mt-4 px-6 py-2 bg-primary/10 text-primary font-semibold rounded-lg hover:bg-primary/20 transition-colors text-sm"
                >
                  Selecionar Arquivo
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-navy/80 mb-2">Curso de Destino</label>
                <div className="relative">
                  <select
                    value={cursoId}
                    onChange={(e) => setCursoId(e.target.value)}
                    disabled={loading}
                    className="w-full bg-white/50 border border-white/40 rounded-xl h-12 px-4 pr-10 appearance-none focus:ring-2 focus:ring-primary focus:border-transparent text-navy outline-none disabled:opacity-50"
                  >
                    <option value="">Selecione um curso</option>
                    {themes.map((t) => (
                      <option key={t.id} value={t.id} className="bg-white text-navy">{t.name}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-3 text-navy/40 pointer-events-none text-xl">expand_more</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-navy/80 mb-2">Modo de Geração</label>
                <div className="flex p-1 bg-white/40 rounded-xl gap-1">
                  <button type="button" onClick={() => !loading && setModo('completo')} disabled={loading}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${modo === 'completo' ? 'bg-white text-primary shadow-sm' : 'text-navy/60 hover:bg-white/30'}`}>
                    Completo
                  </button>
                  <button type="button" onClick={() => !loading && setModo('resumido')} disabled={loading}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${modo === 'resumido' ? 'bg-white text-primary shadow-sm' : 'text-navy/60 hover:bg-white/30'}`}>
                    Resumido
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3 mb-4"
            >
              <span className="material-symbols-outlined">psychology</span>
              {loading ? 'Gerando...' : 'Geração Inteligente'}
            </button>

            <input
              ref={(el) => {
                (batchInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                if (el) el.setAttribute('webkitdirectory', '');
              }}
              type="file"
              accept=".vtt"
              className="hidden"
              multiple
              onChange={handleBatchFolder}
            />
            <button
              type="button"
              onClick={() => batchInputRef.current?.click()}
              disabled={loading}
              className="w-full py-3 rounded-xl border-2 border-primary/40 text-primary font-semibold hover:bg-primary/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-xl">folder_open</span>
              Geração em lote
            </button>

            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-navy/50 uppercase tracking-wider">Status do Processamento</span>
                <span className="text-xs font-bold text-primary">{loading ? progressLabel : 'Pronto para iniciar'}</span>
              </div>
              <div className="w-full bg-white/30 h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full transition-all duration-500 ease-out" style={{ width: loading ? progressWidth : '0%' }} />
              </div>
            </div>

            {isBatchMode && (
              <p className="mt-3 text-xs text-navy/70">
                Lote: {batchIndex + 1} de {batchQueue.length}
                {currentBatchFile && ` — ${currentBatchFile.name}`}
              </p>
            )}

            <AnimatePresence>
              {error && (
                <div className="mt-6 p-4 rounded-xl bg-red-500/20 border border-red-500/40 text-red-600 text-sm">{error}</div>
              )}
            </AnimatePresence>
          </div>

          {/* Painel de preview ao lado quando há material gerado */}
          <AnimatePresence>
            {generatedData && (
              <div className="flex-1 min-w-0 flex flex-col glass rounded-xl shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-white/20 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-navy font-semibold">Preview do documento</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={openPreviewFull}
                      className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-lg">open_in_new</span>
                      Abrir preview completo
                    </button>
                    {isBatchMode ? (
                      <>
                        <button
                          type="button"
                          onClick={() => { if (typeof window !== 'undefined') window.open('/preview'); processNextBatch(); }}
                          className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-lg">download</span>
                          Download PDF
                        </button>
                        <button
                          type="button"
                          onClick={handleDiscardAndRegenerate}
                          disabled={batchRegenerating || loading}
                          className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-lg">refresh</span>
                          Descartar e gerar novamente
                        </button>
                        <button
                          type="button"
                          onClick={processNextBatch}
                          className="px-4 py-2 bg-white/80 text-navy text-sm font-semibold rounded-lg hover:bg-white transition-colors"
                        >
                          Próximo
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setGeneratedData(null)}
                        className="px-4 py-2 bg-white/80 text-navy text-sm font-semibold rounded-lg hover:bg-white transition-colors"
                      >
                        Gerar novo
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-h-[400px]">
                  <MermaidInit className="flex flex-col items-center">
                    <MaterialPreviewBlocks data={generatedData} scale={0.35} />
                  </MermaidInit>
                </div>
              </div>
            )}
          </AnimatePresence>
        </main>

        <footer className="p-6 text-center text-white/40 text-xs shrink-0">
          © {new Date().getFullYear()} Design Beleza. Todos os direitos reservados.
        </footer>
      </div>
    </div>
  );
}
