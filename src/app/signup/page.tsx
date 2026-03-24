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
import { CheckSquare, Loader2, KeyRound, UserPlus } from 'lucide-react';
import { useAuth, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const signupSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  inviteCode: z.string().min(1, 'Invite code is required'),
});

type SignupValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [isLoading, setIsLoading] = React.useState(false);
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      inviteCode: '',
    },
  });

  async function onSubmit(values: SignupValues) {
    setIsLoading(true);
    try {
      const inviteCodeFromEnv = process.env.NEXT_PUBLIC_INVITE_CODE || 'WELCOME2024';
      const isBypass = values.inviteCode.toUpperCase() === inviteCodeFromEnv.toUpperCase();
      
      let codeRef = null;
      if (!isBypass) {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
        codeRef = doc(firestore, 'inviteCodes', values.inviteCode);
        const codeSnap = await getDoc(codeRef);

        if (!codeSnap.exists()) {
          throw new Error("Invalid invitation code.");
        }

        const codeData = codeSnap.data();
        if (codeData.usesLeft <= 0) {
          throw new Error("This invitation code has expired.");
        }
      }

      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: values.displayName,
      });

      const profileRef = doc(firestore, 'users', user.uid);
      const profileData = {
        id: user.uid,
        email: values.email,
        displayName: values.displayName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      setDocumentNonBlocking(profileRef, profileData, { merge: true });

      if (!isBypass && codeRef) {
        await updateDoc(codeRef, {
          usesLeft: increment(-1)
        });
      }

      toast({
        title: "Account Created",
        description: "Your professional workspace is now ready.",
      });
      
      router.push('/');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || "An unexpected error occurred during setup.",
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
              <UserPlus className="h-4 w-4 text-slate-400" />
              Join Workspace
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Invite-Only Profile Registration</CardDescription>
          </CardHeader>
          <CardContent className="pt-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="inviteCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[9px] font-bold uppercase text-primary tracking-widest flex items-center gap-1.5">
                        <KeyRound className="h-3 w-3" />
                        Invitation Code
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Enter unique code" {...field} className="h-12 border-primary/20 bg-primary/5 rounded-none font-bold uppercase text-[10px] focus:bg-white transition-all" />
                      </FormControl>
                      <FormMessage className="text-[10px] font-bold" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} className="h-12 border-slate-200 rounded-none font-bold text-[10px] bg-slate-50/50" />
                      </FormControl>
                      <FormMessage className="text-[10px] font-bold" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Work Email</FormLabel>
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
                      <FormLabel className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Min. 6 characters" {...field} className="h-12 border-slate-200 rounded-none font-bold text-[10px] bg-slate-50/50" />
                      </FormControl>
                      <FormMessage className="text-[10px] font-bold" />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full h-14 bg-slate-950 text-white rounded-none font-bold uppercase text-[11px] tracking-widest shadow-none hover:bg-slate-800 transition-all" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Initiate Profile
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col gap-6 pt-2 pb-8">
            <div className="h-px w-full bg-slate-50" />
            <div className="text-[10px] font-bold uppercase tracking-widest text-center text-slate-400">
              Already authorized?{' '}
              <Link href="/login" className="text-slate-950 hover:underline">
                Sign In
              </Link>
            </div>
          </CardFooter>
        </Card>
        
        <div className="text-center">
          <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.2em]">Secure Audit-Ready Environment v1.0</p>
        </div>
      </div>
    </div>
  );
}
