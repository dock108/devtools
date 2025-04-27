'use client';

import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  rules_config: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateRuleSetPage() {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      is_active: true,
      rules_config: JSON.stringify(
        {
          // Default empty rule configuration
          rules: [],
        },
        null,
        2,
      ),
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);

    try {
      // Check if a rule set with this name already exists
      const { data: existing, error: checkError } = await supabase
        .from('rule_sets')
        .select('id')
        .eq('name', values.name)
        .maybeSingle();

      if (checkError) {
        throw new Error(checkError.message);
      }

      if (existing) {
        form.setError('name', {
          message: 'A rule set with this name already exists',
        });
        setIsSubmitting(false);
        return;
      }

      // Parse the rules_config to ensure it's valid JSON
      let rulesConfig = {};
      if (values.rules_config) {
        try {
          rulesConfig = JSON.parse(values.rules_config);
        } catch (err) {
          form.setError('rules_config', {
            message: 'Invalid JSON format',
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Create the new rule set
      const { error: insertError } = await supabase.from('rule_sets').insert({
        name: values.name,
        description: values.description || null,
        is_active: values.is_active,
        rules_config: rulesConfig,
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      toast({
        title: 'Rule set created',
        description: `${values.name} has been created successfully.`,
      });

      // Redirect to the rule sets listing page
      router.push('/admin/rulesets');
    } catch (_error) {
      console.error('Error creating rule set:', _error);
      toast({
        title: 'Error',
        description: `Failed to create rule set: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link href="/admin/rulesets">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Create Rule Set</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Rule Set</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter rule set name" {...field} />
                    </FormControl>
                    <FormDescription>A unique name for this rule set</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter a description (optional)"
                        className="min-h-24"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Provide details about when this rule set should be used
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        Enable this rule set for immediate use with accounts
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rules_config"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rules Configuration (JSON)</FormLabel>
                    <FormControl>
                      <Textarea className="font-mono min-h-48" {...field} />
                    </FormControl>
                    <FormDescription>
                      Specify rule configurations in valid JSON format
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/admin/rulesets')}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Rule Set'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
