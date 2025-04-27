'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function SignupPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(''); // For success messages

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Basic password complexity check (example: min 8 chars)
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      // Sign up the user with Supabase Auth
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        // Optional: Redirect user after email confirmation
        // options: {
        //   emailRedirectTo: `${location.origin}/auth/callback`,
        // },
      });

      if (signUpError) {
        throw signUpError;
      }

      // Show success message - user needs to confirm email
      setMessage('Check your email to confirm your account!');
      // Optionally clear form or redirect after a delay
      // setEmail('');
      // setPassword('');
      // setConfirmPassword('');
      // router.push('/login?message=confirm_email'); // Redirect to login with message

      // **Deferred for Beta:** Stripe Connect initiation logic would go here.
      // For now, we just create the user account.
    } catch (error: any) {
      console.error('Signup error:', error);
      setError(error.message || 'An error occurred during sign up.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <Card className="w-full max-w-md bg-slate-800 text-white">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Sign Up for DOCK108 Beta</CardTitle>
          <CardDescription className="text-slate-400">
            Create your account to get started with the free beta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {message ? (
            <div className="text-center text-green-400 p-4 border border-green-600 bg-green-900/30 rounded-md">
              {message}
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="********"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  'Sign Up'
                )}
              </Button>
            </form>
          )}
        </CardContent>
        {!message && (
          <CardFooter className="flex flex-col space-y-2">
            <div className="text-center text-sm text-slate-400">
              Already have an account?
              <Link href="/login" className="ml-1 font-medium text-blue-400 hover:underline">
                Sign In
              </Link>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
