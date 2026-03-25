
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CheckSquare, Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = React.useState(false);
  const auth = useAuth();
  const { toast } = useToast();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: LoginValues) {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({
        title: "Access Granted",
        description: "Welcome back to your professional workspace.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: error.message || "Invalid credentials provided.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-14 w-14 rounded-none bg-slate-950 flex items-center justify-center shadow-lg">
            <CheckSquare className="text-white h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-headline font-bold text-slate-950 uppercase tracking-tighter">TrackIt</h1>
          </div>
        </div>

        <Card className="border-slate-200 shadow-none rounded-none bg-white">
          <CardHeader className="border-b border-slate-50 pb-6">
            <CardTitle className="font-headline text-lg uppercase tracking-tight flex items-center gap-2">
              <Lock className="h-4 w-4 text-slate-400" />
              Sign In
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Enter your credentials to proceed</CardDescription>
          </CardHeader>
          <CardContent className="pt-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Work Email</FormLabel>
                      <FormControl>
                        <Input placeholder="name@company.com" {...field} className="h-12 border-slate-200 rounded-none font-bold uppercase text-[10px] bg-slate-50/50" />
                      </FormControl>
                      <FormMessage className="text-[10px] font-bold" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} className="h-12 border-slate-200 rounded-none font-bold text-[10px] bg-slate-50/50" />
                      </FormControl>
                      <FormMessage className="text-[10px] font-bold" />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full h-14 bg-slate-950 text-white rounded-none font-bold uppercase text-[11px] tracking-widest shadow-none hover:bg-slate-800 transition-all" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Authorize Access
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col gap-6 pt-2 pb-8">
            <div className="h-px w-full bg-slate-50" />
            <div className="text-[10px] font-bold uppercase tracking-widest text-center text-slate-400">
              New to the workspace?{' '}
              <Link href="/signup" className="text-slate-950 hover:underline">
                Register Profile
              </Link>
            </div>
          </CardFooter>
        </Card>
        
        <div className="text-center">
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">Secure Audit-Ready Environment v1.0</p>
        </div>
      </div>
    </div>
  );
}
