import type { Metadata } from 'next';
import { Inter, Lexend, Lora, Sora } from 'next/font/google';
import { SafeArea } from '@/components/SafeArea';
import './globals.css';
import './print-editorial.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
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
  title: 'Design Beleza — VTT em material didático',
  description: 'Transforme a transcrição da sua aula (VTT) em apostila de estudo com design de alto nível.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`dark ${inter.variable} ${lexend.variable} ${lora.variable} ${sora.variable}`}>
      <body className="font-display antialiased min-h-screen min-h-[100vh] flex flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 w-full overflow-x-hidden">
        {/* SafeArea: evita que a página caia por completo quando um componente der erro */}
        <SafeArea>
          {children}
        </SafeArea>
      </body>
    </html>
  );
}
