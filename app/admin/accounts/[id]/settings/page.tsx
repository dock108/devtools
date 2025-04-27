'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';

const formSchema = z.object({
  is_active: z.boolean().default(true),
  rule_set_id: z.string().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface RuleSet {
  id: string;
  name: string;
}

export default function AccountSettingsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [account, setAccount] = useState<any>(null);
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      is_active: true,
      rule_set_id: null,
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch account details
        const { data: accountData, error: accountError } = await supabase
          .from('accounts')
          .select('*')
          .eq('id', params.id)
          .single();

        if (accountError) {
          throw new Error(`Error fetching account: ${accountError.message}`);
        }

        if (!accountData) {
          throw new Error('Account not found');
        }

        setAccount(accountData);

        // Fetch rule sets
        const { data: ruleSetsData, error: ruleSetsError } = await supabase
          .from('rule_sets')
          .select('id, name')
          .order('name', { ascending: true });

        if (ruleSetsError) {
          throw new Error(`Error fetching rule sets: ${ruleSetsError.message}`);
        }

        setRuleSets(ruleSetsData || []);

        // Set form default values
        form.reset({
          is_active: accountData.is_active,
          rule_set_id: accountData.rule_set_id,
        });
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [params.id, supabase, form]);

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Update account settings
      const { error: updateError } = await supabase
        .from('accounts')
        .update({
          is_active: values.is_active,
          rule_set_id: values.rule_set_id,
        })
        .eq('id', params.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      toast({
        title: 'Settings updated',
        description: 'Account settings have been updated successfully.',
      });

      // Refresh account data
      const { data: accountData, error: accountError } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', params.id)
        .single();

      if (!accountError && accountData) {
        setAccount(accountData);
      }
    } catch (error) {
      console.error('Error updating account settings:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      toast({
        title: 'Error',
        description: `Failed to update settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href="/admin/accounts">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Error</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
            <Button className="mt-4" onClick={() => router.push('/admin/accounts')}>
              Return to Accounts
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link href="/admin/accounts">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{account?.display_name || 'Unnamed Account'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 text-sm">
            <div className="grid grid-cols-2 gap-1">
              <div className="text-muted-foreground">Stripe ID:</div>
              <div className="font-mono">{account?.stripe_id}</div>
              <div className="text-muted-foreground">Created:</div>
              <div>{new Date(account?.created_at).toLocaleDateString()}</div>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        When active, alerts will be processed for this account
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rule_set_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rule Set</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a rule set" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Default (No custom rules)</SelectItem>
                        {ruleSets.map((ruleSet) => (
                          <SelectItem key={ruleSet.id} value={ruleSet.id}>
                            {ruleSet.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Assign a rule set to customize alert behavior for this account
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/admin/accounts')}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
