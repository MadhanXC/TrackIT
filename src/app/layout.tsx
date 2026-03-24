import type {Metadata} from 'next';
import './globals.css';
import {SidebarProvider} from '@/components/ui/sidebar';
import {Toaster} from '@/components/ui/toaster';
import {FirebaseClientProvider} from '@/firebase/client-provider';
import {AuthGuard} from '@/components/auth-guard';

export const metadata: Metadata = {
  title: 'TrackIt | Professional Workspace',
  description: 'Precision task tracking and operational auditing for high-performance teams.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.ico', type: 'image/x-icon' }
    ],
    apple: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=Open+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <AuthGuard>
            <SidebarProvider defaultOpen={true}>
              {children}
            </SidebarProvider>
          </AuthGuard>
          <Toaster />
        </FirebaseClientProvider>
        {/* Dedicated Print Root for Isolated Export */}
        <div id="print-root"></div>
      </body>
    </html>
  );
}
