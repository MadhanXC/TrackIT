
'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';

/**
 * Robust Auth Guard to handle transitions and prevent dashboard "flicker".
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isUserLoading) {
      const isAuthPage = pathname === '/login' || pathname === '/signup';
      
      if (!user && !isAuthPage) {
        // Not logged in and trying to access protected page
        router.replace('/login');
      } else if (user && isAuthPage) {
        // Logged in and trying to access auth page
        router.replace('/');
      } else {
        // State is consistent
        setIsReady(true);
      }
    }
  }, [user, isUserLoading, router, pathname]);

  // Global loading state while checking auth session
  if (isUserLoading || !isReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-6">
          <div className="h-12 w-12 rounded-none bg-slate-950 flex items-center justify-center shadow-lg animate-pulse">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-[10px] font-bold text-slate-950 uppercase tracking-[0.2em]">Authenticating Session</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Secure Audit-Ready Environment</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
