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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md border-none shadow-modern">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-headline font-bold">Something went wrong</CardTitle>
          <CardDescription>
            We encountered an unexpected error while loading the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-slate-100 p-4 font-mono text-xs text-slate-700 overflow-auto max-h-40">
            {error.message || 'An unknown error occurred.'}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button 
            onClick={() => reset()} 
            className="w-full gap-2 font-bold shadow-modern"
          >
            <RefreshCcw className="h-4 w-4" />
            Try Again
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => window.location.href = '/'} 
            className="w-full text-muted-foreground"
          >
            Back to Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}