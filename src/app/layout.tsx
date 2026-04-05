import type { Metadata } from 'next';
import { Inter, Lexend, Lora, Manrope, Sora } from 'next/font/google';
import { SafeArea } from '@/components/SafeArea';
import { ScriboUiProvider } from '@/context/ScriboUiContext';
import './globals.css';
import './print-editorial.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-headline',
  display: 'swap',
  weight: ['400', '600', '700', '800'],
});

const lexend = Lexend({
  subsets: ['latin'],
  variable: '--font-lexend',
  display: 'swap',
});

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-material-serif',
  display: 'swap',
});

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
  weight: ['400', '600', '700'],
});

export const metadata: Metadata = {
  title: 'scribo — VTT em material didático',
  description: 'Transforme a transcrição da sua aula (VTT) em apostila de estudo com design de alto nível.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${manrope.variable} ${lexend.variable} ${lora.variable} ${sora.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='scribo-dark',s=localStorage.getItem(k),d=s==='1'?true:s==='0'?false:window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-body antialiased min-h-screen min-h-[100vh] flex flex-col bg-background text-on-surface w-full overflow-x-hidden selection:bg-primary/20 selection:text-on-surface dark:selection:bg-primary/35 dark:selection:text-white">
        <ScriboUiProvider>
          <SafeArea>{children}</SafeArea>
        </ScriboUiProvider>
      </body>
    </html>
  );
}
