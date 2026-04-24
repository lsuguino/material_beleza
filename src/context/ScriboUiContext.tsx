'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** Cor de destaque fixa (azul Scribo); no escuro, tom mais claro para contraste. */
const SCRIBO_ACCENT_LIGHT = { hex: '#1A2DC2', on: '#ffffff' } as const;
const SCRIBO_ACCENT_DARK = { hex: '#7B9CFF', on: '#ffffff' } as const;

const LS_DARK = 'scribo-dark';
const LS_NOTIFY = 'scribo-notify-on-done';

type ScriboUiContextValue = {
  dark: boolean;
  setDark: (v: boolean) => void;
  toggleDark: () => void;
  notifyWhenDone: boolean;
  setNotifyWhenDone: (v: boolean) => void;
  toggleNotifyWhenDone: () => Promise<void>;
};

const ScriboUiContext = createContext<ScriboUiContextValue | null>(null);

/** RGB separados por espaço — necessário para `bg-primary/20` etc. no Tailwind 3.4 */
function hexToRgbSpace(hex: string): string {
  const h = hex.replace('#', '').trim();
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return `${r} ${g} ${b}`;
  }
  if (h.length !== 6) return '26 45 194';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

function applyAccentToDocument(hex: string, onHex: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--scribo-primary', hex);
  document.documentElement.style.setProperty('--scribo-on-primary', onHex);
  document.documentElement.style.setProperty('--scribo-primary-rgb', hexToRgbSpace(hex));
  document.documentElement.style.setProperty('--scribo-on-primary-rgb', hexToRgbSpace(onHex));
}

export function ScriboUiProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDarkState] = useState(false);
  const [notifyWhenDone, setNotifyWhenDoneState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const d = localStorage.getItem(LS_DARK);
      if (d === '1') {
        setDarkState(true);
      } else if (d === '0') {
        setDarkState(false);
      } else if (typeof window !== 'undefined') {
        setDarkState(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
      const n = localStorage.getItem(LS_NOTIFY);
      if (n === '1') setNotifyWhenDoneState(true);
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem(LS_DARK, dark ? '1' : '0');
    } catch {
      // ignore
    }
  }, [dark, ready]);

  useEffect(() => {
    if (!ready) return;
    const applied = dark ? SCRIBO_ACCENT_DARK : SCRIBO_ACCENT_LIGHT;
    applyAccentToDocument(applied.hex, applied.on);
  }, [ready, dark]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(LS_NOTIFY, notifyWhenDone ? '1' : '0');
    } catch {
      // ignore
    }
  }, [notifyWhenDone, ready]);

  const setDark = useCallback((v: boolean) => {
    setDarkState(v);
  }, []);

  const toggleDark = useCallback(() => {
    setDarkState((d) => !d);
  }, []);

  const setNotifyWhenDone = useCallback((v: boolean) => {
    setNotifyWhenDoneState(v);
  }, []);

  const toggleNotifyWhenDone = useCallback(async () => {
    if (notifyWhenDone) {
      setNotifyWhenDoneState(false);
      return;
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotifyWhenDoneState(true);
        return;
      }
      if (Notification.permission === 'default') {
        const r = await Notification.requestPermission();
        setNotifyWhenDoneState(r === 'granted');
        return;
      }
    }
    setNotifyWhenDoneState(false);
  }, [notifyWhenDone]);

  const value = useMemo(
    () => ({
      dark,
      setDark,
      toggleDark,
      notifyWhenDone,
      setNotifyWhenDone,
      toggleNotifyWhenDone,
    }),
    [dark, setDark, toggleDark, notifyWhenDone, setNotifyWhenDone, toggleNotifyWhenDone]
  );

  return <ScriboUiContext.Provider value={value}>{children}</ScriboUiContext.Provider>;
}

export function useScriboUi() {
  const ctx = useContext(ScriboUiContext);
  if (!ctx) {
    throw new Error('useScriboUi must be used within ScriboUiProvider');
  }
  return ctx;
}
