'use client';

import { ScribolitoWalk } from '@/components/ScribolitoWalk';

export default function ScribolitoPage() {
  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center gap-12 p-8">
      <h1 className="text-white text-3xl font-bold font-sora">Scribolito</h1>

      {/* Tamanhos diferentes */}
      <div className="flex items-end gap-8">
        <div className="text-center">
          <ScribolitoWalk size={60} speed="fast" />
          <p className="text-white/50 text-xs mt-2">60px fast</p>
        </div>
        <div className="text-center">
          <ScribolitoWalk size={120} />
          <p className="text-white/50 text-xs mt-2">120px normal</p>
        </div>
        <div className="text-center">
          <ScribolitoWalk size={200} speed="slow" />
          <p className="text-white/50 text-xs mt-2">200px slow</p>
        </div>
      </div>

      {/* Andando pela tela */}
      <div className="w-full max-w-4xl relative h-48 border border-white/10 rounded-xl overflow-hidden">
        <p className="absolute top-2 left-4 text-white/30 text-xs">moving={'{true}'}</p>
        <ScribolitoWalk size={120} moving speed="normal" />
      </div>

      {/* Grande */}
      <div className="text-center">
        <ScribolitoWalk size={300} speed="slow" />
        <p className="text-white/50 text-xs mt-2">300px — escalável sem perder qualidade (SVG)</p>
      </div>
    </div>
  );
}
