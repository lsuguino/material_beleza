'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const BG_DARK = '#0D0D14';
const ACCENT = '#446EFF';

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

type Modo = 'completo' | 'resumido' | 'mapa_mental';

interface ThemeOption {
  id: string;
  name: string;
}

export default function Home() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [cursoId, setCursoId] = useState('');
  const [modo, setModo] = useState<Modo | null>(null);
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/themes')
      .then((res) => res.json())
      .then((data: ThemeOption[]) => {
        setThemes(data);
        if (data.length > 0 && !cursoId) setCursoId(data[0].id);
      })
      .catch(() => setThemes([{ id: 'geral', name: 'Geral' }]));
  }, [cursoId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && (f.name.toLowerCase().endsWith('.vtt') || f.type === 'text/vtt')) {
      setFile(f);
      setError(null);
    } else {
      setError('Envie apenas arquivos .vtt');
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (f.name.toLowerCase().endsWith('.vtt') || f.type === 'text/vtt') {
        setFile(f);
        setError(null);
      } else {
        setError('Envie apenas arquivos .vtt');
      }
    }
    e.target.value = '';
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file || !modo || !cursoId) {
      setError('Selecione o arquivo VTT, o curso e o modo de geração.');
      return;
    }
    setError(null);
    setLoading(true);
    setProgressStep(0);

    const interval = setInterval(() => {
      setProgressStep((s) => s + 1);
    }, 2500);

    try {
      const form = new FormData();
      form.append('vtt', file);
      form.append('curso_id', cursoId);
      form.append('modo', modo);

      const res = await fetch('/api/generate', { method: 'POST', body: form });
      clearInterval(interval);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data.error as string) || 'Falha ao gerar material');
      }

      const data = await res.json();
      const key = 'rtg-preview-data';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(data));
      }
      router.push('/preview');
    } catch (err) {
      clearInterval(interval);
      setError(err instanceof Error ? err.message : 'Erro ao gerar material');
      setLoading(false);
    }
  }, [file, modo, cursoId, router]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: BG_DARK, fontFamily: 'var(--font-sora), Sora, system-ui, sans-serif' }}
    >
      {/* Header */}
      <header className="border-b border-white/10 py-6 px-6 md:px-12">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-2xl md:text-3xl font-bold text-white"
        >
          Designer <span style={{ color: ACCENT }}>Beleza</span>
        </motion.h1>
      </header>

      <main className="flex-1 py-10 px-6 md:px-12 max-w-3xl mx-auto w-full">
        {/* Drop zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-10 md:p-14 text-center transition-colors cursor-pointer ${
            isDragging ? 'border-[#446EFF] bg-[#446EFF]/10' : 'border-white/20 hover:border-white/40'
          }`}
          onClick={() => document.getElementById('vtt-input')?.click()}
        >
          <input
            id="vtt-input"
            type="file"
            accept=".vtt,text/vtt"
            className="hidden"
            onChange={handleFileChange}
          />
          <motion.div
            animate={{ scale: isDragging ? 1.05 : 1 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ backgroundColor: `${ACCENT}20` }}
          >
            <svg className="w-8 h-8" style={{ color: ACCENT }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </motion.div>
          <p className="text-white/90 text-lg font-medium mb-1">
            {file ? file.name : 'Arraste seu arquivo .vtt aqui'}
          </p>
          <p className="text-white/50 text-sm">ou clique para selecionar</p>
        </motion.div>

        {/* Curso dropdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-8"
        >
          <label className="block text-white/70 text-sm font-medium mb-2">Curso</label>
          <select
            value={cursoId}
            onChange={(e) => setCursoId(e.target.value)}
            disabled={loading}
            className="w-full rounded-xl border border-white/20 bg-white/5 text-white py-3.5 px-4 focus:outline-none focus:ring-2 focus:ring-[#446EFF] focus:border-transparent disabled:opacity-50"
          >
            {themes.map((t) => (
              <option key={t.id} value={t.id} className="bg-[#0D0D14] text-white">
                {t.name}
              </option>
            ))}
          </select>
        </motion.div>

        {/* Modo cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-8"
        >
          <label className="block text-white/70 text-sm font-medium mb-3">Modo de geração</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(
              [
                { id: 'completo' as const, icon: '📖', title: 'Material Completo', desc: 'Explicação detalhada de todo o conteúdo' },
                { id: 'resumido' as const, icon: '📝', title: 'Material Resumido', desc: 'Pontos essenciais de forma objetiva' },
                { id: 'mapa_mental' as const, icon: '🧠', title: 'Mapa Mental', desc: 'Linha de raciocínio organizada e visual' },
              ] as const
            ).map((item) => (
              <motion.button
                key={item.id}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => !loading && setModo(item.id)}
                disabled={loading}
                className={`rounded-xl border-2 p-5 text-left transition-all ${
                  modo === item.id
                    ? 'border-[#446EFF] bg-[#446EFF]/15'
                    : 'border-white/15 bg-white/5 hover:border-white/30'
                } ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span className="text-2xl block mb-2">{item.icon}</span>
                <span className="text-white font-semibold block">{item.title}</span>
                <span className="text-white/60 text-sm mt-1 block">{item.desc}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Botão Gerar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="mt-10"
        >
          <motion.button
            type="button"
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 rounded-2xl text-lg font-bold text-white disabled:opacity-80 disabled:cursor-not-allowed transition-opacity"
            style={{ backgroundColor: ACCENT }}
          >
            {loading ? 'Gerando...' : 'Gerar Material'}
          </motion.button>
        </motion.div>

        {/* Barra de progresso */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-8 overflow-hidden"
            >
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: ACCENT }}
                  initial={{ width: '0%' }}
                  animate={{
                    width: progressStep < PROGRESS_MESSAGES.length
                      ? `${((progressStep + 1) / PROGRESS_MESSAGES.length) * 90}%`
                      : '90%',
                  }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                />
              </div>
              <p className="text-white/70 text-sm mt-2 text-center">
                {progressStep < PROGRESS_MESSAGES.length
                ? PROGRESS_MESSAGES[progressStep]
                : FINALIZANDO_CICLO[(progressStep - PROGRESS_MESSAGES.length) % FINALIZANDO_CICLO.length]}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Erro */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 p-4 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-sm"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
