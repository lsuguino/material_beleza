'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { MaterialPreviewBlocks, type PreviewData } from '@/components/MaterialPreviewBlocks';
import { MermaidInit } from '@/components/MermaidInit';
import { SafeArea } from '@/components/SafeArea';

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
type TipoEntrada = 'transcricao' | 'organizado';

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
  const [tipoEntrada, setTipoEntrada] = useState<TipoEntrada>('transcricao');
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
        const list = Array.isArray(data) ? data : [];
        setThemes(list.length > 0 ? list : [{ id: 'geral', name: 'Venda Todo Santo Dia' }]);
        if (list.length > 0 && !cursoId) setCursoId(list[0].id);
        if (list.length === 0) setCursoId('geral');
      })
      .catch(() => {
        setThemes([{ id: 'geral', name: 'Venda Todo Santo Dia' }]);
        setCursoId('geral');
      });
  }, [cursoId]);

  const runGenerate = useCallback(
    async (textFile: File, effectiveCursoId?: string) => {
      const cid = effectiveCursoId ?? (cursoId || themes[0]?.id || 'geral');
      const form = new FormData();
      form.append('vtt', textFile);
      form.append('curso_id', cid);
      form.append('modo', modo);
      form.append('tipo_entrada', tipoEntrada);
      const res = await fetch('/api/generate', { method: 'POST', body: form });
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
    [cursoId, modo, tipoEntrada, themes]
  );

  const handleSubmit = useCallback(async () => {
    if (!file) {
      setError('Selecione um arquivo de texto (clique em "Selecionar Arquivo" ou arraste o arquivo na área).');
      return;
    }
    const cId = cursoId || (themes[0]?.id ?? 'geral');
    if (!cId) {
      setError('Selecione o curso de destino.');
      return;
    }
    setError(null);
    setLoading(true);
    setProgressStep(0);
    setGeneratedData(null);

    const interval = setInterval(() => setProgressStep((s) => s + 1), 2500);

    try {
      const data = await runGenerate(file, cId);
      clearInterval(interval);
      setError(null);
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
      runGenerate(textFiles[0])
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

  return (
    <div
      className={`font-sans bg-background-dark text-slate-100 flex flex-col relative overflow-x-hidden w-full ${
        generatedData ? 'h-screen overflow-y-hidden' : 'min-h-screen'
      }`}
    >
      {/* Background Accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" aria-hidden />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-neon-cyan/10 rounded-full blur-[120px] pointer-events-none" aria-hidden />

      <div className="relative z-20 flex flex-col flex-1 min-h-0 w-full">
        {/* Header */}
        <header className="sticky top-0 z-50 glass-panel border-b border-white/5 px-6 lg:px-20 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden h-10 w-10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-2xl">auto_awesome</span>
            </div>
            <h2 className="text-xl font-black tracking-tighter text-white uppercase italic">Design <span className="text-neon-cyan">Beleza</span></h2>
          </div>
          <nav className="hidden md:flex items-center gap-10">
            <a className="text-sm font-semibold text-slate-400 hover:text-neon-cyan transition-colors" href="#">Painel</a>
            <a className="text-sm font-semibold text-slate-400 hover:text-neon-cyan transition-colors" href="#">Meus Materiais</a>
            <a className="text-sm font-semibold text-white border-b-2 border-neon-cyan pb-1" href="#">Gerador</a>
          </nav>
          <div className="flex items-center gap-4">
            <button type="button" className="p-2 text-slate-400 hover:text-white transition-colors" aria-label="Notificações">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="h-10 w-10 rounded-full border-2 border-primary/50 overflow-hidden bg-slate-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-500">person</span>
            </div>
          </div>
        </header>

        <main
          className={`flex-1 flex w-full max-w-6xl mx-auto px-6 py-12 box-border relative z-10 ${
            generatedData
              ? 'flex-col md:flex-row gap-6 items-start min-h-0 overflow-hidden md:h-[calc(100vh-112px)]'
              : 'flex-col overflow-y-auto'
          }`}
        >
          {/* Card do formulário */}
          <div
            className={`w-full shrink-0 ${generatedData ? 'max-w-2xl h-fit md:h-full md:overflow-y-auto md:pr-1' : ''}`}
          >
            {!generatedData && (
              <section className="flex flex-col lg:flex-row items-center gap-12 mb-16">
                <div className="flex-1 space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-xs font-bold text-neon-cyan uppercase tracking-widest">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-cyan opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-cyan" />
                    </span>
                    Nova tecnologia Claude
                  </div>
                  <h1 className="text-5xl lg:text-7xl font-black leading-tight text-white tracking-tight">
                    Gerar Materiais de <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-neon-cyan to-white neon-text-glow">Estudo com IA</span>
                  </h1>
                  <p className="text-lg text-slate-400 max-w-xl">
                    Transforme seus conteúdos brutos em materiais didáticos estruturados, quizzes e resumos otimizados em questão de segundos.
                  </p>
                </div>
                <div className="w-full lg:w-2/5 flex justify-center">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-primary/30 blur-3xl rounded-full group-hover:bg-neon-cyan/20 transition-all duration-700" />
                    <div className="relative glass-panel rounded-3xl p-8 border border-white/10 overflow-hidden">
                      <span className="material-symbols-outlined text-8xl text-neon-cyan/80 animate-pulse">psychology</span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <div className="glass-panel rounded-3xl p-8 lg:p-12 mb-12 shadow-2xl relative">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Upload Area */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-neon-cyan">upload_file</span>
                    <h3 className="font-bold text-white uppercase tracking-wider text-sm">Upload de Conteúdo</h3>
                  </div>
                  <div className="relative">
                    <input
                      id="vtt-file-input"
                      ref={inputRef}
                      type="file"
                      accept=".txt,.vtt,.srt,.md,.csv,.json,.xml,.pdf,text/*,application/x-subrip,application/pdf"
                      className="absolute w-0 h-0 opacity-0 overflow-hidden"
                      aria-hidden
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
                      htmlFor="vtt-file-input"
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.types.includes('Files')) setIsDragging(true); }}
                      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                      onDrop={handleDrop}
                      className={isDragging ? 'flex-1 flex flex-col items-center justify-center gap-6 rounded-2xl border-2 border-dashed py-16 px-8 cursor-pointer group transition-all border-neon-cyan bg-white/10' : 'flex-1 flex flex-col items-center justify-center gap-6 rounded-2xl border-2 border-dashed py-16 px-8 cursor-pointer group transition-all border-primary/40 bg-white/5 hover:bg-white/10 hover:border-neon-cyan'}
                    >
                      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-4xl text-neon-cyan">cloud_upload</span>
                      </div>
                      <div className="text-center">
                        <p className="text-white text-xl font-bold mb-2">{file ? file.name : 'Arraste e solte seus arquivos'}</p>
                        <p className="text-slate-400 text-sm">PDF, TXT, VTT, SRT, MD (Máx 50MB)</p>
                      </div>
                      <button type="button" className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-bold text-sm border border-white/10 transition-all">
                        Selecionar Arquivo
                      </button>
                    </label>
                  </div>
                </div>

                {/* Configuration Area */}
                <div className="flex flex-col gap-8">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-neon-cyan">settings</span>
                    <h3 className="font-bold text-white uppercase tracking-wider text-sm">Configurações de Geração</h3>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-300">Tipo de entrada</label>
                      <div className="flex bg-slate-900/80 p-1.5 rounded-xl border border-white/5 gap-1">
                        <button type="button" onClick={() => !loading && setTipoEntrada('transcricao')} disabled={loading}
                          className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${tipoEntrada === 'transcricao' ? 'bg-primary text-white shadow-lg' : 'hover:bg-white/5 text-slate-400'}`}>
                          Transcrição
                        </button>
                        <button type="button" onClick={() => !loading && setTipoEntrada('organizado')} disabled={loading}
                          className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${tipoEntrada === 'organizado' ? 'bg-primary text-white shadow-lg' : 'hover:bg-white/5 text-slate-400'}`}>
                          Texto organizado
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-300">Selecionar Curso</label>
                      <div className="relative">
                        <select
                          value={cursoId}
                          onChange={(e) => setCursoId(e.target.value)}
                          disabled={loading}
                          className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-primary focus:border-transparent appearance-none outline-none disabled:opacity-50"
                        >
                          <option value="">Selecione o curso destino...</option>
                          {themes.map((t) => (
                            <option key={t.id} value={t.id} className="bg-slate-900 text-white">{t.name}</option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">expand_more</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-300">Tipo de Material</label>
                      <div className="flex bg-slate-900/80 p-1.5 rounded-xl border border-white/5 gap-1">
                        <button type="button" onClick={() => !loading && setModo('resumido')} disabled={loading}
                          className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${modo === 'resumido' ? 'bg-primary text-white shadow-lg' : 'hover:bg-white/5 text-slate-400'}`}>
                          Resumo
                        </button>
                        <button type="button" onClick={() => !loading && setModo('completo')} disabled={loading}
                          className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${modo === 'completo' ? 'bg-primary text-white shadow-lg' : 'hover:bg-white/5 text-slate-400'}`}>
                          Material Completo
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="pt-6 space-y-4">
                    <input
                      ref={(el) => {
                        (batchInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                        if (el) el.setAttribute('webkitdirectory', '');
                      }}
                      type="file"
                      accept=".txt,.vtt,.srt,.md,.csv,.json,.xml,.pdf"
                      className="absolute w-0 h-0 opacity-0 pointer-events-none overflow-hidden"
                      aria-hidden
                      multiple
                      onChange={handleBatchFolder}
                    />
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={loading}
                      className="w-full py-5 rounded-2xl bg-gradient-to-r from-primary to-blue-700 text-white font-black uppercase tracking-widest text-lg neon-glow-primary hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined">auto_awesome</span>
                      {loading ? 'Gerando...' : 'Geração Inteligente'}
                    </button>
                    <button
                      type="button"
                      onClick={() => batchInputRef.current?.click()}
                      disabled={loading}
                      className="w-full py-4 rounded-2xl bg-transparent border border-white/10 text-slate-300 font-bold hover:bg-white/5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-xl">layers</span>
                      Geração em Lote
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-12 pt-10 border-t border-white/5">
                <div className="flex justify-between items-end mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${loading ? 'bg-neon-cyan animate-pulse' : 'bg-slate-600'}`} />
                    <span className="text-sm font-medium text-slate-300">{loading ? progressLabel : 'Pronto para iniciar'}</span>
                  </div>
                  {loading && <span className="text-neon-cyan font-black text-xl">{progressStep < PROGRESS_MESSAGES.length ? Math.round(((progressStep + 1) / PROGRESS_MESSAGES.length) * 90) : 90}%</span>}
                </div>
                <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                  <div className="h-full bg-gradient-to-r from-primary to-neon-cyan shadow-[0_0_10px_rgba(0,242,255,0.5)] transition-all duration-500 ease-out" style={{ width: loading ? progressWidth : '0%' }} />
                </div>
              </div>

              {isBatchMode && (
                <p className="mt-3 text-xs text-slate-400">
                  Lote: {batchIndex + 1} de {batchQueue.length}
                  {currentBatchFile && ` — ${currentBatchFile.name}`}
                </p>
              )}

              <AnimatePresence>
                {error && (
                  <div className="mt-6 p-4 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-sm">{error}</div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Painel de preview ao lado quando há material gerado */}
          <AnimatePresence>
            {generatedData && (
              <div className="flex-1 min-w-0 min-h-0 h-full flex flex-col glass-panel rounded-3xl shadow-2xl overflow-hidden border border-white/10">
                <div className="p-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-white font-semibold">Preview do documento</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={openPreviewFull}
                      className="px-4 py-2 bg-gradient-to-r from-primary to-blue-700 text-white text-sm font-semibold rounded-xl hover:brightness-110 transition-colors flex items-center gap-1"
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
                        className="px-4 py-2 bg-white/10 text-slate-300 text-sm font-semibold rounded-xl hover:bg-white/20 transition-colors border border-white/10"
                      >
                        Gerar novo
                      </button>
                    )}
                  </div>
                </div>
                <div
                  className={`flex-1 overflow-y-auto overflow-x-hidden p-4 min-h-[400px] ${
                    generatedData.curso_id === 'geral' ||
                    (generatedData.tema?.name || '').toLowerCase().includes('venda todo santo dia')
                      ? 'bg-[#e6e6e4]'
                      : ''
                  }`}
                >
                  <SafeArea>
                    <MermaidInit className="flex flex-col items-center">
                      <MaterialPreviewBlocks data={generatedData} scale={0.35} />
                    </MermaidInit>
                  </SafeArea>
                </div>
              </div>
            )}
          </AnimatePresence>
        </main>

        {!generatedData && (
          <footer className="mt-auto py-10 px-6 border-t border-white/5 glass-panel text-center shrink-0">
            <p className="text-slate-500 text-sm">© {new Date().getFullYear()} Design Beleza - Powered by Advanced Machine Learning. Desenvolvido para o futuro da educação.</p>
          </footer>
        )}
      </div>
    </div>
  );
}
