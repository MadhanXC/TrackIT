'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isUserLoading) {
      if (!user && pathname !== '/login' && pathname !== '/signup') {
        router.push('/login');
      } else if (user && (pathname === '/login' || pathname === '/signup')) {
        router.push('/');
      }
    }
  }, [user, isUserLoading, router, pathname]);

  // Prevent flash: If loading OR if we're in a redirect state
  const isPublicPath = pathname === '/login' || pathname === '/signup';
  const shouldShowLoader = isUserLoading || (!user && !isPublicPath) || (user && isPublicPath);

  if (shouldShowLoader) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground font-headline">Authenticating Workspace...</p>
        </div>
      </div>
    );
  }

  // To strictly prevent any dashboard rendering before the route redirect happens
  if (!user