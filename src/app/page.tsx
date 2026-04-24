'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { type PreviewData } from '@/components/MaterialPreviewBlocks';
import { PageThumbnail } from '@/components/PageThumbnail';
import { DropzoneParticles } from '@/components/DropzoneParticles';
import { FooterParticles } from '@/components/FooterParticles';
import { ScriboLogo } from '@/components/ScriboLogo';
import { useScriboUi } from '@/context/ScriboUiContext';
import { COURSE_PICKER_OPTIONS } from '@/lib/coursePickerOptions';
import { ScribolitoWalk } from '@/components/ScribolitoWalk';
import { IconBell, IconSun, IconMoon, IconMinimize, IconMaximize, IconCourse, IconMaterialType, IconBookOpen, IconResume, IconActivity, IconSettings } from '@/components/RtgIcons';
import { GENERATION_PHRASES, pickPhraseIndex } from '@/lib/generation-phrases';
import { clearPreviewDataFromClient, loadPreviewDataFromClient, savePreviewDataToClient } from '@/lib/preview-storage';
import { buildPlainTextFromPreview } from '@/lib/previewPlainText';
import { InlinePreview } from '@/components/InlinePreview';
import { GallerySidebar } from '@/components/GallerySidebar';
import { saveMaterialToGallery } from '@/lib/gallery-storage';

function SettingsSwitch({
  checked,
  onToggle,
  disabled,
  id,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-background ${
        checked ? 'bg-primary' : 'bg-surface-container-highest dark:bg-surface-high/80'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-1 left-1 block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

/** Extensões aceitas para arquivo de texto, PDF ou DOCX. */
const TEXT_EXTENSIONS = ['.txt', '.vtt', '.srt', '.md', '.csv', '.json', '.xml'];
const PDF_EXTENSION = '.pdf';
const DOCX_EXTENSION = '.docx';
function isAcceptedFile(f: File): boolean {
  const name = (f.name || '').toLowerCase();
  const okText = TEXT_EXTENSIONS.some((ext) => name.endsWith(ext));
  const okPdf = name.endsWith(PDF_EXTENSION) || f.type === 'application/pdf';
  const okDocx =
    name.endsWith(DOCX_EXTENSION) ||
    f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const okType = (f.type || '').startsWith('text/') || f.type === 'application/x-subrip' || f.type === '';
  return okText || okPdf || okDocx || okType;
}

type Modo = 'completo' | 'resumido' | 'design_only';

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
  const { notifyWhenDone, dark, toggleDark, toggleNotifyWhenDone } = useScriboUi();
  const loadingWasActive = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cursoId, setCursoId] = useState('geral');
  const [modo, setModo] = useState<Modo>('completo');
  /** Inclui página de atividades ao final do material (e perguntas no preview) quando ativo — arquivo único ou 1º arquivo do lote. */
  const [comPerguntas, setComPerguntas] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  /** Bump sempre que salvamos um novo material; sinaliza GallerySidebar pra recarregar. */
  const [gallerySeq, setGallerySeq] = useState(0);
  const [designOnlyAcknowledged, setDesignOnlyAcknowledged] = useState(false);
  const [genPhraseIndex, setGenPhraseIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<PreviewData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  /** Referência ao AbortController ativo — permite cancelar a geração em curso */
  const abortControllerRef = useRef<AbortController | null>(null);

  const [batchQueue, setBatchQueue] = useState<File[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchCurrentFile, setBatchCurrentFile] = useState<File | null>(null);
  const [batchRegenerating, setBatchRegenerating] = useState(false);

  const isBatchMode = batchQueue.length > 0;
  const currentBatchFile = batchCurrentFile || (batchQueue.length > 0 ? batchQueue[batchIndex] : null);
  const needsDesignOnlyAck = modo === 'design_only' && !designOnlyAcknowledged;

  // Recupera preview persistido após refresh/reload para não "voltar ao início"
  // durante ações longas (ex.: geração/download de PDF).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (generatedData || loading || isBatchMode) return;
      try {
        const restored = await loadPreviewDataFromClient();
        if (!cancelled && restored && typeof restored === 'object') {
          setGeneratedData(restored as PreviewData);
          setShowPreview(true);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [generatedData, loading, isBatchMode]);

  useEffect(() => {
    if (loadingWasActive.current && !loading && generatedData && notifyWhenDone) {
      if (typeof window !== 'undefined') {
        // Som de blop
        try { new Audio('/blop.wav').play(); } catch { /* ignore */ }
        // Notificação do navegador
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('Scribo', { body: 'Seu material está pronto!', icon: '/scribo-logo.svg' });
          } catch { /* ignore */ }
        }
      }
    }
    loadingWasActive.current = loading;
  }, [loading, generatedData, notifyWhenDone]);

  useEffect(() => {
    if (!loading) return;
    setGenPhraseIndex((i) => pickPhraseIndex(i, GENERATION_PHRASES.length));
    const id = window.setInterval(() => {
      setGenPhraseIndex((prev) => pickPhraseIndex(prev, GENERATION_PHRASES.length));
    }, 3400);
    return () => window.clearInterval(id);
  }, [loading]);

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
    setError(null);
    // Limpa lote se estiver em modo batch
    setBatchQueue([]);
    setBatchIndex(0);
    setBatchCurrentFile(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (needsDesignOnlyAck) {
      setError('Confirme o aviso do modo "Só design" para continuar.');
      return;
    }
    if (!file) {
      setError('Selecione um arquivo de texto, PDF ou DOCX (clique em "Selecionar Arquivo" ou arraste o arquivo na área).');
      return;
    }
    const cId = cursoId || 'geral';
    if (!cId) {
      setError('Selecione o curso de destino.');
      return;
    }
    setError(null);
    setLoading(true);
    setGeneratedData(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const raw = await runGenerate(file, cId, { comPerguntas, signal: controller.signal });
      setError(null);
      // Extrai _pdfId retornado pelo servidor (não faz parte do PreviewData)
      const rawAny = raw as Record<string, unknown>;
      const pdfId = typeof rawAny._pdfId === 'string' ? rawAny._pdfId : null;
      const { _pdfId: _omit, ...data } = rawAny;
      void _omit;
      if (typeof window !== 'undefined') {
        void savePreviewDataToClient(data);
        if (pdfId) window.localStorage.setItem('rtg-pdf-id', pdfId);
        else window.localStorage.removeItem('rtg-pdf-id');
      }
      // Persiste na galeria local (inclui o VTT pra permitir regerar no futuro).
      try {
        const vttText = await file.text().catch(() => undefined);
        await saveMaterialToGallery({
          previewData: data,
          originalVtt: vttText,
          cursoId: cId,
          modo,
        });
        setGallerySeq((s) => s + 1);
      } catch (galleryErr) {
        console.warn('[page] falha ao salvar na galeria:', galleryErr);
      }
      setGeneratedData(data as PreviewData);
    } catch (err) {
      // Ignora erro de cancelamento (AbortError)
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Erro ao gerar material');
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [needsDesignOnlyAck, file, cursoId, modo, comPerguntas, runGenerate]);

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
    const batchFile = batchQueue[next];
    runGenerate(batchFile, undefined, { comPerguntas: false })
      .then(async (data) => {
        if (typeof window !== 'undefined') {
          void savePreviewDataToClient(data);
        }
        try {
          const vttText = await batchFile.text().catch(() => undefined);
          await saveMaterialToGallery({ previewData: data, originalVtt: vttText, cursoId, modo });
          setGallerySeq((s) => s + 1);
        } catch (galleryErr) {
          console.warn('[page] falha ao salvar na galeria:', galleryErr);
        }
        setGeneratedData(data);
        playNotificationSound();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [batchQueue, batchIndex, runGenerate, cursoId, modo]);

  const handleBatchFolder = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const textFiles = files.filter((f) => isAcceptedFile(f));
      e.target.value = '';
      if (textFiles.length === 0) {
        setError('Nenhum arquivo compatível na pasta (.txt, .vtt, .srt, .md, .pdf, .docx, etc.).');
        return;
      }
      setBatchQueue(textFiles);
      setBatchIndex(0);
      setBatchCurrentFile(textFiles[0]);
      setError(null);
      setGeneratedData(null);
      setLoading(true);
      const firstFile = textFiles[0];
      runGenerate(firstFile, undefined, { comPerguntas })
        .then(async (data) => {
          if (typeof window !== 'undefined') {
            void savePreviewDataToClient(data);
          }
          try {
            const vttText = await firstFile.text().catch(() => undefined);
            await saveMaterialToGallery({ previewData: data, originalVtt: vttText, cursoId, modo });
            setGallerySeq((s) => s + 1);
          } catch (galleryErr) {
            console.warn('[page] falha ao salvar na galeria:', galleryErr);
          }
          setGeneratedData(data);
          playNotificationSound();
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Erro'))
        .finally(() => setLoading(false));
    },
    [runGenerate, comPerguntas, cursoId, modo]
  );

  const handleDiscardAndRegenerate = useCallback(() => {
    if (!currentBatchFile || batchQueue.length === 0) return;
    setBatchRegenerating(true);
    setLoading(true);
    setGeneratedData(null);
    runGenerate(currentBatchFile, undefined, { comPerguntas: batchIndex === 0 && comPerguntas })
      .then(async (data) => {
        if (typeof window !== 'undefined') {
          void savePreviewDataToClient(data);
        }
        try {
          const vttText = await currentBatchFile.text().catch(() => undefined);
          await saveMaterialToGallery({ previewData: data, originalVtt: vttText, cursoId, modo });
          setGallerySeq((s) => s + 1);
        } catch (galleryErr) {
          console.warn('[page] falha ao salvar na galeria:', galleryErr);
        }
        setGeneratedData(data);
        playNotificationSound();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro'))
      .finally(() => {
        setLoading(false);
        setBatchRegenerating(false);
      });
  }, [currentBatchFile, batchQueue.length, batchIndex, comPerguntas, runGenerate, cursoId, modo]);

  const openPreviewFull = useCallback(() => {
    setShowPreview(true);
  }, []);

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
    setFile(null);
    setPdfReady(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('rtg-pdf-id');
      clearPreviewDataFromClient();
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

      // Envia os dados ao servidor e recebe o PDF pronto (via Puppeteer)
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: generatedData }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro ao gerar PDF.' }));
        throw new Error((err as { error?: string }).error || `Erro ${res.status} ao gerar PDF.`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      console.error('[handleDownloadPdfMain]', err);
      alert(err instanceof Error ? err.message : 'Erro inesperado ao gerar o PDF. Tente novamente.');
    } finally {
      setPdfLoading(false);
    }
  }, [generatedData]);

  const handleDownloadTextMain = useCallback(() => {
    if (!generatedData) return;
    const text = buildPlainTextFromPreview(generatedData);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const title = (generatedData.conteudo?.titulo || generatedData.design?.titulo || 'material')
      .toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u017F]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'material';
    a.href = url;
    a.download = `${title}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
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
      setError('Arraste apenas arquivos de texto, PDF ou DOCX.');
    }
  }, []);

  const dropzoneClass = isDragging
    ? 'border-primary bg-primary/5 dark:bg-primary/15 shadow-lg shadow-primary/20 dark:shadow-primary/30 ring-2 ring-primary/30'
    : 'border-outline-variant hover:border-primary dark:border-outline-variant/40 dark:hover:border-primary';

  return (
    <div className="font-body bg-background text-on-surface flex h-screen w-full flex-col overflow-hidden selection:bg-primary/20 dark:selection:bg-primary/35 dark:selection:text-white">
      {/* Barra global: logo sempre visível acima da sidebar e do conteúdo */}
      <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center border-b border-outline-variant/25 bg-[var(--scribo-header-bg)] px-4 backdrop-blur-xl dark:border-slate-800/80 sm:px-6">
          <div className="mx-auto flex w-full max-w-[100vw] items-center justify-between gap-4">
          <ScriboLogo className="h-6 shrink-0 text-[#1a2dc2] dark:text-[#7B9CFF]" />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const wasOff = !notifyWhenDone;
                void toggleNotifyWhenDone();
                if (wasOff) { try { new Audio('/blop.wav').play(); } catch {} }
              }}
              className={`rounded-full p-1.5 transition-colors ${notifyWhenDone ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:text-primary'}`}
              title={notifyWhenDone ? 'Notificações ativas' : 'Ativar notificações'}
            >
              <IconBell size={20} />
            </button>
            <button
              type="button"
              onClick={toggleDark}
              className="rounded-full p-1.5 text-on-surface-variant transition-colors hover:text-primary"
              title={dark ? 'Modo claro' : 'Modo escuro'}
            >
              {dark ? <IconSun size={20} /> : <IconMoon size={20} />}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-full p-1.5 text-on-surface-variant transition-colors hover:text-primary lg:hidden"
              title="Configurações"
            >
              <IconSettings size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Sidebar colapsável */}
        {/* Backdrop overlay mobile */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <aside className={`
          ${mobileMenuOpen ? 'max-lg:fixed max-lg:inset-0 max-lg:z-50' : 'max-lg:hidden'}
          flex shrink-0 flex-col overflow-y-auto bg-[#eef0f4] font-body text-sm font-medium dark:bg-[#1e2028]
          lg:order-1 lg:h-auto lg:max-h-none lg:rounded-r-2xl transition-all duration-300
          ${sidebarCollapsed ? 'lg:w-24' : 'lg:w-80'}
        `}>
          {/* Controle de toggle */}
          <div className={`flex items-center transition-all duration-300 ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-5 py-3'}`}>
            {/* Botão fechar — mobile only */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container dark:hover:bg-zinc-700/60 transition-colors lg:hidden"
              title="Fechar"
            >
              <IconMinimize size={24} className="scale-x-[-1]" />
            </button>
            {/* Botão collapse — desktop only */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(v => !v)}
              title={sidebarCollapsed ? 'Expandir' : 'Recolher'}
              className="hidden lg:block p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container dark:hover:bg-zinc-700/60 transition-colors ml-auto"
            >
              {sidebarCollapsed ? <IconMaximize size={20} /> : <IconMinimize size={20} />}
            </button>
          </div>

          {/* Logo colapsada — sempre renderizada, animada com scale/opacity */}
          <div
            className="flex flex-col items-center justify-start px-2 py-4 transition-all duration-300 ease-in-out"
            style={{
              transformOrigin: 'top center',
              opacity: sidebarCollapsed ? 1 : 0,
              transform: sidebarCollapsed ? 'scale(1)' : 'scale(0.5)',
              maxHeight: sidebarCollapsed ? '80px' : '0px',
              overflow: 'hidden',
              pointerEvents: sidebarCollapsed ? 'auto' : 'none',
            }}
          >
            {(() => { const opt = COURSE_PICKER_OPTIONS.find(o => o.id === cursoId); return opt?.logoSrc ? (
              <button type="button" onClick={() => setSidebarCollapsed(false)} className="cursor-pointer transition-transform hover:scale-110">
                <img
                  src={opt.logoSrc}
                  alt={opt.ariaLabel}
                  className="h-auto w-full max-h-9 object-contain [filter:brightness(0)_saturate(100%)_invert(12%)_sepia(98%)_saturate(6000%)_hue-rotate(234deg)_brightness(0.8)] dark:[filter:brightness(0)_saturate(100%)_invert(72%)_sepia(30%)_saturate(800%)_hue-rotate(196deg)_brightness(1.05)]"
                />
              </button>
            ) : null; })()}
          </div>

          {/* Conteúdo expandido — animado com scale/opacity a partir do topo (posição da logo) */}
          <div
            className="flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out"
            style={{
              transformOrigin: 'top left',
              opacity: sidebarCollapsed ? 0 : 1,
              transform: sidebarCollapsed ? 'scale(0.85) translateY(-10px)' : 'scale(1) translateY(0)',
              pointerEvents: sidebarCollapsed ? 'none' : 'auto',
            }}
          >
          <nav className="flex flex-1 flex-col gap-8 pb-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-6 font-bold text-primary">
                <IconCourse size={20} />
                <span>Curso</span>
              </div>
              <div className="grid grid-cols-2 gap-2 px-6">
                {COURSE_PICKER_OPTIONS.map((opt) => {
                  const selected = cursoId === opt.id;
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
                      className={`flex min-h-[3rem] items-center justify-center rounded-xl border-2 px-2 py-2 transition-all ${
                        !opt.enabled
                          ? 'cursor-not-allowed border-slate-300/90 bg-slate-200/95 dark:border-zinc-500/55 dark:bg-zinc-600/45'
                          : selected
                            ? 'cursor-pointer border-primary bg-primary/10 shadow-md ring-2 ring-primary/40 dark:bg-primary/15'
                            : 'cursor-pointer border-transparent bg-surface-container-low/90 dark:bg-surface-low/40 hover:border-primary/30'
                      }`}
                    >
                      {opt.logoSrc ? (
                        <img
                          src={opt.logoSrc}
                          alt=""
                          draggable={false}
                          className={`h-auto w-full min-h-0 max-h-9 max-w-full object-contain object-center sm:max-h-10 ${
                            opt.enabled && selected
                              ? 'brightness-0 dark:brightness-100'
                              : 'brightness-0 opacity-55 dark:brightness-100 dark:opacity-50'
                          }`}
                        />
                      ) : (
                        <span
                          className={`px-1 text-center text-[10px] font-bold uppercase leading-tight tracking-wide ${
                            !opt.enabled ? 'text-zinc-500 dark:text-zinc-400' : 'text-on-surface'
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

            <div className="space-y-3">
              <div className="flex items-center gap-2 px-6 text-on-surface-variant dark:text-white/65">
                <IconMaterialType size={20} />
                <span className="font-semibold">Tipo de material</span>
              </div>
              <div className="mx-6 flex rounded-full bg-surface-container p-1 dark:bg-zinc-700/60">
                <button
                  type="button"
                  onClick={() => !loading && setModo('completo')}
                  disabled={loading}
                  aria-pressed={modo === 'completo'}
                  aria-label="Material completo"
                  className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full py-2 px-3 transition-all ${
                    modo === 'completo'
                      ? 'bg-white font-bold text-primary shadow-sm dark:bg-zinc-600 dark:shadow-[0_0_0_1px_rgba(100,100,120,0.5)]'
                      : 'font-medium text-on-surface-variant hover:text-on-surface dark:text-white/70'
                  }`}
                >
                  <IconBookOpen size={16} />
                  <span className="text-xs">Completo</span>
                </button>
                <button
                  type="button"
                  onClick={() => !loading && setModo('resumido')}
                  disabled={loading}
                  aria-pressed={modo === 'resumido'}
                  aria-label="Resumo"
                  className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full py-2 px-3 transition-all ${
                    modo === 'resumido'
                      ? 'bg-white font-bold text-primary shadow-sm dark:bg-zinc-600 dark:shadow-[0_0_0_1px_rgba(100,100,120,0.5)]'
                      : 'font-medium text-on-surface-variant hover:text-on-surface dark:text-white/70'
                  }`}
                >
                  <IconResume size={16} />
                  <span className="text-xs">Resumo</span>
                </button>
                <button
                  type="button"
                  onClick={() => !loading && setModo('design_only')}
                  disabled={loading}
                  aria-pressed={modo === 'design_only'}
                  aria-label="Aplicar apenas design"
                  className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full py-2 px-3 transition-all ${
                    modo === 'design_only'
                      ? 'bg-white font-bold text-primary shadow-sm dark:bg-zinc-600 dark:shadow-[0_0_0_1px_rgba(100,100,120,0.5)]'
                      : 'font-medium text-on-surface-variant hover:text-on-surface dark:text-white/70'
                  }`}
                  title="Use quando o texto já está pronto e você quer só diagramar"
                >
                  <span className="material-symbols-outlined text-[16px]">palette</span>
                  <span className="text-xs">Só design</span>
                </button>
              </div>
              {modo === 'design_only' && (
                <div className="mx-6 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <span className="font-semibold">Atenção:</span>{' '}
                  no modo <span className="font-semibold">Só design</span>, o arquivo deve estar minimamente
                  processado e estruturado (títulos, seções e parágrafos claros) para o material final
                  ter boa qualidade.
                  <label className="mt-2 flex items-start gap-2 text-[11px] leading-snug">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 rounded border-amber-500/60 text-primary focus:ring-primary"
                      checked={designOnlyAcknowledged}
                      onChange={(e) => {
                        setDesignOnlyAcknowledged(e.target.checked);
                        setError(null);
                      }}
                    />
                    <span>
                      Li o aviso e confirmo que o arquivo já está minimamente processado.
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="px-6">
              <div className="flex items-center justify-between gap-3 text-on-surface-variant dark:text-white/65">
                <div className="flex min-w-0 items-center gap-2">
                  <IconActivity size={20} className="shrink-0" />
                  <span className="text-left text-sm font-semibold leading-snug">
                    Atividades ao final
                  </span>
                </div>
                <SettingsSwitch
                  checked={comPerguntas}
                  disabled={loading}
                  onToggle={() => !loading && setComPerguntas((v) => !v)}
                  id="switch-perguntas-arquivo"
                />
              </div>
            </div>

            {/* Galeria local de materiais gerados — embaixo da sidebar, abaixo de "Atividades ao final" */}
            <div className={`mt-4 border-t border-on-surface-variant/10 pt-4 dark:border-white/10 ${sidebarCollapsed ? '' : ''}`}>
              <GallerySidebar refreshKey={gallerySeq} collapsed={sidebarCollapsed} />
            </div>
          </nav>
          </div>
        </aside>

        {/* Área principal */}
        <main className="relative order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background lg:order-2">
          {showPreview && generatedData ? (
            <div className="flex h-full min-h-0 flex-col p-2 sm:p-4">
              <InlinePreview
                data={generatedData}
                onClose={() => setShowPreview(false)}
                onDownloadPdf={handleDownloadPdfMain}
                onDownloadText={handleDownloadTextMain}
                pdfLoading={pdfLoading}
                file={file || currentBatchFile}
                cursoId={cursoId}
                modo={modo}
                onDataUpdate={(updated) => {
                  setGeneratedData(updated);
                }}
              />
            </div>
          ) : (
          <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden px-4 py-2 sm:px-6 lg:px-10 lg:py-3">

            <div className="mb-2 max-w-3xl shrink-0 lg:mb-3">
              <h1 className="text-2xl font-bold leading-[1.1] tracking-tight text-on-surface dark:text-white sm:text-3xl lg:text-4xl xl:text-4xl 2xl:text-5xl" style={{ fontFamily: "'Transforma Sans', sans-serif" }}>
                Transforme conhecimento em
                {' '}<span className="bg-gradient-to-r from-primary via-[#4f46e5] to-primary bg-clip-text text-transparent" style={{ fontFamily: "'Transforma Script', cursive", fontStyle: 'italic' }}>inteligência.</span>
              </h1>
              <p className="mt-1 text-xs font-bold text-on-surface dark:text-white sm:text-sm lg:text-base" style={{ fontFamily: "'Transforma Sans', sans-serif" }}>
                Crie materiais didáticos profissionais a partir de transcrições de vídeo, copys ou qualquer texto.
              </p>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-4 overflow-hidden lg:grid-cols-12 lg:gap-6">
              {/* Quadro principal: seleção, geração (orbes + frases) ou resultado */}
              <div className={loading ? 'lg:col-span-8' : 'lg:col-span-8'}>
                {loading ? (
                  <div
                    ref={workspaceRef}
                    className="generation-workspace-breath relative flex min-h-[320px] lg:min-h-[400px] xl:min-h-[480px] w-full flex-col overflow-hidden rounded-xl border-2 border-dashed border-primary/35 bg-surface-container-lowest shadow-lg shadow-on-surface/3 dark:border-primary/25 dark:bg-surface-container-low/90 dark:ring-1 dark:ring-outline-variant/25"
                  >
                    <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.08]">
                      <img
                        alt=""
                        className="h-full w-full object-cover"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuAJITf0jjGeGpM-bqq7rZe4V51n-Etb32Xf0DPPFueQqsPKBoSeVGWNr7LVB2IVInT7iORO512OixL5HElnLMmhdHj0fdB7HQQ9Jjr4d5IQIxWSQcd2Bd7xO_gBKXLTfEo4cybRdrM7Hr9qhOL01WHiXVAIc4rYMtMIlApYsnXMqsU5MaRmHeh6HyrQatA4sIUQXYsaiuhTqSM9nNl52vsJU5prVAAqJ9sBb1iDLc7MpJzdKvnULKwwyUkHduSEJoKYKvQ_vKRI2iUt"
                      />
                    </div>
                    <DropzoneParticles
                      containerRef={workspaceRef}
                      hasFile={!!file || !!currentBatchFile}
                      generating
                    />
                    <div className="relative z-10 flex min-h-[280px] lg:min-h-[360px] flex-col items-center justify-center px-4 py-10 text-center sm:px-8">
                      <p
                        key={genPhraseIndex}
                        className="font-headline max-w-xl text-lg font-semibold leading-snug text-on-surface transition-opacity duration-500 dark:text-white sm:text-xl"
                      >
                        {GENERATION_PHRASES[genPhraseIndex]}
                      </p>
                      {(file || currentBatchFile) && (
                        <p className="mt-4 max-w-lg truncate text-sm text-on-surface-variant dark:text-white/65" title={file?.name || currentBatchFile?.name}>
                          {file?.name || currentBatchFile?.name}
                        </p>
                      )}
                      {isBatchMode && (
                        <p className="mt-2 text-xs text-on-surface-variant dark:text-white/60">
                          Lote: {batchIndex + 1} de {batchQueue.length}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={handleCancelGeneration}
                        className="mt-10 inline-flex items-center justify-center gap-2 rounded-full border-2 border-error/40 bg-error/10 px-8 py-3.5 text-sm font-bold text-error shadow-sm transition-colors hover:bg-error/15 dark:border-error/50 dark:bg-error/15 dark:hover:bg-error/25"
                      >
                        <span className="material-symbols-outlined text-[20px]">stop_circle</span>
                        Parar geração
                      </button>
                    </div>
                  </div>
                ) : generatedData ? (
                  (() => {
                    const genDesign = generatedData.design || generatedData.conteudo;
                    const genRawPag = genDesign?.paginas ?? (genDesign as { pages?: unknown[] })?.pages;
                    const genPaginas = Array.isArray(genRawPag) ? (genRawPag as Array<Record<string, unknown>>) : [];
                    const genTitle = generatedData.conteudo?.titulo || generatedData.design?.titulo || 'Material gerado';
                    return (
                      <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low shadow-md dark:border-outline-variant/35 dark:bg-surface-container/60 overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/20 px-4 py-3 dark:border-outline-variant/30">
                          <span className="min-w-0 truncate font-semibold text-sm text-on-surface dark:text-white">
                            {genTitle}
                            {genPaginas.length > 0 && (
                              <span className="ml-2 text-xs font-normal text-on-surface-variant dark:text-white/50">
                                {genPaginas.length} página{genPaginas.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isBatchMode && (
                              <>
                                <button
                                  type="button"
                                  onClick={handleDiscardAndRegenerate}
                                  disabled={batchRegenerating || loading}
                                  className="flex items-center gap-1 rounded-full border-2 border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                                >
                                  <span className="material-symbols-outlined text-[14px]">refresh</span>
                                  Refazer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    processNextBatch();
                                  }}
                                  className="rounded-full border border-outline-variant bg-surface-container-high px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container dark:border-outline-variant/40 dark:bg-surface-high/45 dark:text-white dark:hover:bg-surface-high/60"
                                >
                                  Próximo
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={openPreviewFull}
                              className="flex items-center gap-1 rounded-full border-2 border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/20"
                            >
                              <span className="material-symbols-outlined text-[14px]">visibility</span>
                              Ver preview
                            </button>
                            <button
                              type="button"
                              onClick={handleDownloadPdfMain}
                              disabled={pdfLoading}
                              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                              style={{ backgroundColor: '#446EFF' }}
                            >
                              <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
                              {pdfLoading ? 'Gerando PDF...' : 'PDF'}
                            </button>
                            <button
                              type="button"
                              onClick={handleDownloadTextMain}
                              className="flex items-center gap-1 rounded-full border border-[#1f8f6f]/40 bg-[#1f8f6f]/15 px-3 py-1.5 text-xs font-semibold text-[#1a6b55] dark:text-emerald-300"
                            >
                              <span className="material-symbols-outlined text-[14px]">article</span>
                              TXT
                            </button>
                            <button
                              type="button"
                              onClick={handleReset}
                              title="Gerar novo material"
                              aria-label="Fechar e gerar novo material"
                              className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high dark:hover:bg-surface-high/50"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </div>
                        </div>
                        <div className="overflow-x-auto px-3 py-3">
                          <div className="flex flex-row gap-2" style={{ width: 'max-content' }}>
                            {genPaginas.map((_p, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={openPreviewFull}
                                title={`Página ${i + 1}`}
                                className="flex-shrink-0 cursor-pointer overflow-hidden rounded border border-black/10 transition-opacity hover:opacity-90 dark:border-white/15"
                                style={{ width: 70, height: 99 }}
                              >
                                <PageThumbnail data={generatedData} pageIndex={i} width={70} height={99} />
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Perguntas de atividade são exibidas dentro do material (PageAtividadesFinais), não na interface */}
                      </div>
                    );
                  })()
                ) : (
                  <div className="group w-full">
                    <input
                      id="vtt-file-input"
                      ref={inputRef}
                      type="file"
                      accept=".txt,.vtt,.srt,.md,.csv,.json,.xml,.pdf,.docx,text/*,application/x-subrip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="sr-only"
                      tabIndex={-1}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          if (isAcceptedFile(f)) {
                            setFile(f);
                            setError(null);
                          } else {
                            setError('Selecione um arquivo de texto, PDF ou DOCX (.txt, .vtt, .srt, .md, .pdf, .docx, etc.).');
                          }
                        }
                        e.target.value = '';
                      }}
                    />
                    <div
                      ref={workspaceRef}
                      className={`relative overflow-hidden rounded-xl border-2 border-dashed bg-surface-container-lowest shadow-lg shadow-on-surface/3 dark:bg-surface-container-low/90 dark:ring-1 dark:ring-outline-variant/25 ${dropzoneClass}`}
                    >
                      <div className="absolute inset-0 opacity-[0.04] transition-opacity duration-700 group-hover:opacity-[0.08] dark:opacity-[0.06] dark:group-hover:opacity-[0.1]">
                        <img
                          alt=""
                          className="h-full w-full object-cover"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAJITf0jjGeGpM-bqq7rZe4V51n-Etb32Xf0DPPFueQqsPKBoSeVGWNr7LVB2IVInT7iORO512OixL5HElnLMmhdHj0fdB7HQQ9Jjr4d5IQIxWSQcd2Bd7xO_gBKXLTfEo4cybRdrM7Hr9qhOL01WHiXVAIc4rYMtMIlApYsnXMqsU5MaRmHeh6HyrQatA4sIUQXYsaiuhTqSM9nNl52vsJU5prVAAqJ9sBb1iDLc7MpJzdKvnULKwwyUkHduSEJoKYKvQ_vKRI2iUt"
                        />
                      </div>
                      <DropzoneParticles
                        containerRef={workspaceRef}
                        hasFile={!!file || !!currentBatchFile}
                        generating={false}
                      />
                      <label
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
                        className="relative z-10 flex min-h-[160px] cursor-pointer flex-col items-center justify-center p-4 text-center sm:p-6 sm:min-h-[240px] lg:min-h-[280px] lg:p-8"
                      >
                        <div className="flex w-full max-w-xl flex-col items-center justify-center px-3 sm:px-4">
                          {file ? (
                            <>
                              <p className="font-headline mb-2 text-center text-lg font-bold text-on-surface dark:text-white sm:text-xl">{file.name}</p>
                              <p className="mb-8 text-center text-sm text-on-surface-variant dark:text-white/65">
                                Toque no botão abaixo para trocar o arquivo, se quiser.
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="mb-8 text-center text-xs leading-relaxed text-on-surface-variant dark:text-white/70 sm:text-sm">
                                Solte o arquivo aqui ou selecione-o. Formatos: DOCX, PDF, TXT, VTT, SRT, MD, CSV, JSON, XML (até 50&nbsp;MB).
                              </p>
                            </>
                          )}
                          <span className="pointer-events-none inline-flex items-center rounded-full bg-surface-container-high px-8 py-3 font-semibold text-on-surface shadow-sm transition-colors group-hover:bg-surface-container-highest dark:bg-surface-high/80 dark:text-white">
                            Selecionar arquivo
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Coluna direita: botões + Scribolito (ou Scribolito durante loading) */}
              <div className="flex flex-col gap-3 lg:col-span-4">
                {loading ? (
                  <div className="hidden lg:flex flex-col items-center justify-center">
                    <ScribolitoWalk size={250} speed="normal" balloon={GENERATION_PHRASES[genPhraseIndex]} shadow />
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-3">
                      <input
                        ref={(el) => {
                          (batchInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                          if (el) el.setAttribute('webkitdirectory', '');
                        }}
                        type="file"
                        accept=".txt,.vtt,.srt,.md,.csv,.json,.xml,.pdf,.docx"
                        className="sr-only"
                        aria-hidden
                        multiple
                        onChange={handleBatchFolder}
                      />
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading || needsDesignOnlyAck}
                        aria-busy={loading}
                        aria-label="Geração inteligente"
                        className="group flex w-full items-center justify-center rounded-full px-8 py-3 text-base text-white shadow-lg transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg xl:text-xl xl:py-4 bg-gradient-to-br from-primary/90 to-[#6366f1] hover:from-primary hover:to-[#4f46e5] hover:shadow-xl hover:shadow-primary/30 focus:ring-4 focus:ring-primary/30"
                        style={{ fontFamily: "'Transforma Script', cursive", fontWeight: 500 }}
                      >
                        Geração inteligente
                      </button>
                      <button
                        type="button"
                        onClick={() => batchInputRef.current?.click()}
                        disabled={loading}
                        className="group flex w-full items-center justify-center rounded-full px-8 border-2 border-slate-200 bg-white py-3 text-sm text-slate-600 shadow-sm transition-all hover:border-primary/30 hover:text-primary hover:shadow-md active:scale-[0.98] disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-white/70 dark:hover:border-primary/40 dark:hover:text-primary focus:ring-4 focus:ring-primary/20 sm:text-base xl:text-lg xl:py-4"
                        style={{ fontFamily: "'Transforma Sans', sans-serif", fontWeight: 500 }}
                      >
                        Gerar pasta completa
                      </button>
                    </div>
                    {/* Scribolito abaixo dos botões — responsivo */}
                    <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                      <div className="hidden 2xl:block"><ScribolitoWalk size={250} speed="slow" shadow /></div>
                      <div className="hidden xl:block 2xl:hidden"><ScribolitoWalk size={220} speed="slow" shadow /></div>
                      <div className="hidden lg:block xl:hidden"><ScribolitoWalk size={180} speed="slow" shadow /></div>
                      <div className="hidden sm:block lg:hidden"><ScribolitoWalk size={200} speed="slow" shadow hideBalloon /></div>
                      <div className="block sm:hidden"><ScribolitoWalk size={160} speed="slow" shadow hideBalloon /></div>
                    </div>
                  </>
                )}
              </div>
            </div>

              <AnimatePresence>
                {error && (
                  <div className="mt-6 p-4 rounded-xl bg-error-container/80 dark:bg-error/20 border border-error/30 dark:border-error/50 text-error dark:text-red-200 text-sm w-full">
                    {error}
                  </div>
                )}
              </AnimatePresence>

              <footer className="relative z-10 shrink-0 pt-2 pb-4 text-center">
                <span className="inline-block scale-[1.5] origin-center">
                  <ScriboLogo className="inline-block text-[#1a2dc2] dark:text-[#7B9CFF] opacity-20 dark:opacity-10" />
                </span>
              </footer>
          </div>
          )}
        </main>
      </div>
    </div>
  );
}
