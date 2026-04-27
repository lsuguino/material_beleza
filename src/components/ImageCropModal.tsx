'use client';

import { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import {
  getAspectRatioForLayout,
  type ImageAspectRatio,
} from '@/lib/image-prompt';

interface Props {
  open: boolean;
  imageUrl: string;
  layoutTipo?: string;
  pageTipo?: string;
  onCancel: () => void;
  onSave: (newDataUrl: string) => void;
}

const ASPECT_NUMERIC: Record<ImageAspectRatio, number> = {
  wide: 16 / 9,
  portrait: 3 / 4,
  square: 1,
};

/**
 * Carrega a imagem em um <img> e devolve quando estiver pronta —
 * necessário pra desenhar no canvas com tamanho correto.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem pro crop'));
    img.src = src;
  });
}

/**
 * Aplica a área de crop selecionada e devolve a nova imagem como data URL JPEG.
 * Trabalha em pixels reais da imagem original (não em pixels de tela).
 */
async function getCroppedDataUrl(
  imageSrc: string,
  pixelCrop: Area,
): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(pixelCrop.width);
  canvas.height = Math.round(pixelCrop.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context indisponível');

  ctx.drawImage(
    img,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  // JPEG 0.92 — bom equilíbrio entre tamanho e qualidade pra impressão A4
  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Modal de edição de imagem: zoom + reposicionamento + crop.
 * Aspect ratio respeita o layout da página (wide/portrait/square).
 * Esc fecha; Enter salva.
 */
export function ImageCropModal({
  open,
  imageUrl,
  layoutTipo,
  pageTipo,
  onCancel,
  onSave,
}: Props) {
  const ratioName = getAspectRatioForLayout(layoutTipo, pageTipo);
  const aspect = ASPECT_NUMERIC[ratioName];

  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  // Resetar quando abre/troca de imagem
  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, [open, imageUrl]);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const url = await getCroppedDataUrl(imageUrl, croppedAreaPixels);
      onSave(url);
    } catch (err) {
      console.error('[ImageCropModal] erro ao salvar crop:', err);
      alert('Não foi possível aplicar o corte. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }, [imageUrl, croppedAreaPixels, onSave]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && !saving) void handleSave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, handleSave, saving]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editar imagem"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl flex flex-col gap-4"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        <header className="flex items-center justify-between">
          <h2
            className="text-lg font-bold text-neutral-900"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            Editar imagem
          </h2>
          <span className="text-xs text-neutral-500 uppercase tracking-wider">
            {ratioName === 'wide' && '16:9 (paisagem)'}
            {ratioName === 'portrait' && '3:4 (retrato)'}
            {ratioName === 'square' && '1:1 (quadrado)'}
          </span>
        </header>

        <div
          className="relative w-full overflow-hidden rounded-lg bg-neutral-900"
          style={{ height: 380 }}
        >
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid
            objectFit="contain"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-3 text-xs text-neutral-700">
            <span className="material-symbols-outlined text-[18px]">zoom_in</span>
            <span className="w-12 shrink-0 font-medium">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[#446EFF]"
              aria-label="Zoom"
            />
            <span className="w-10 shrink-0 text-right tabular-nums">{zoom.toFixed(2)}x</span>
          </label>
          <p className="text-[11px] text-neutral-500">
            Arraste a imagem pra reposicionar. Use o zoom pra aumentar ou diminuir o detalhe.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !croppedAreaPixels}
            className="flex-1 rounded-xl px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
            style={{ backgroundColor: '#446EFF' }}
          >
            {saving ? 'Salvando…' : 'Salvar mudanças'}
          </button>
        </div>
      </div>
    </div>
  );
}
