
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCcw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service if needed
    console.error('Application Error:', error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 p-4 min-h-screen w-full">
      <div className="w-full max-w-md">
        <Card className="border-none shadow-modern rounded-none bg-white">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-none bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-headline font-bold uppercase tracking-tight">System Error</CardTitle>
            <CardDescription className="text-[12px] font-bold uppercase tracking-widest text-slate-400">
              Operational workspace failure detected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-none bg-slate-100 p-4 font-mono text-[12px] text-slate-700 overflow-auto max-h-40 border border-slate-200">
              {error.message || 'An unknown error occurred during process execution.'}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 pt-6">
            <Button 
              onClick={() => reset()} 
              className="w-full gap-2 font-bold bg-slate-950 text-white rounded-none h-12 uppercase text-[13px] tracking-widest shadow-none"
            >
              <RefreshCcw className="h-4 w-4" />
              Restart Workspace
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => window.location.href = '/'} 
              className="w-full text-[12px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-950"
            >
              Return to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
