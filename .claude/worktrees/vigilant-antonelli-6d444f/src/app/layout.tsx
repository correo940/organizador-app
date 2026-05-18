import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import Taskbar from '@/components/layout/taskbar';
import MobileNav from '@/components/layout/mobile-nav';
import ClientProvider from '@/components/layout/ClientProvider';
import { AuthProvider } from '@/components/apps/mi-hogar/auth-context';

export const metadata: Metadata = {
  title: 'Quioba',
  description: 'Tu espacio para la salud y el bienestar financiero.',
  icons: {
    icon: '/images/logo.png',
    shortcut: '/images/logo.png',
    apple: '/images/logo.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased flex flex-col min-h-screen" suppressHydrationWarning>
        <AuthProvider>
          <ClientProvider>
            <div className="print:hidden">
              <Header />
            </div>
            <main className="flex-grow">{children}</main>
            <div className="print:hidden">
              <Footer />
              <Taskbar />
              <MobileNav />
            </div>
            <Toaster />
            <SonnerToaster position="top-right" />
          </ClientProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
