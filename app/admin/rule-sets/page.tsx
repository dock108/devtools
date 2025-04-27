'use client';

import { useState, useEffect } from 'react';
import { Container } from '@/components/Container';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'react-hot-toast';
import { Loader2, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { Database, Json } from '@/types/supabase'; // Assuming Json type exists
import { z } from 'zod';

// Define Zod schema for rule set config validation
// TODO: Make this more specific based on actual rule config structure
const ruleSetConfigSchema = z.record(z.any()).refine(
  (val) => {
    try {
      // Basic check: is it a non-null object?
      return typeof val === 'object' && val !== null && !Array.isArray(val);
    } catch {
      return false;
    }
  },
  { message: 'Rule config must be a valid JSON object.' },
);

type RuleSet = Database['public']['Tables']['rule_sets']['Row'];

export default function RuleSetsAdminPage() {
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentRuleSet, setCurrentRuleSet] = useState<Partial<RuleSet>>({}); // For create/edit
  const [configJsonString, setConfigJsonString] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const fetchRuleSets = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/rule-sets');
      if (!res.ok) throw new Error('Failed to fetch rule sets');
      const data = await res.json();
      setRuleSets(data || []);
    } catch (error: any) {
      toast.error(`Error fetching rule sets: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRuleSets();
  }, []);

  const handleOpenDialog = (ruleSet?: RuleSet) => {
    if (ruleSet) {
      setCurrentRuleSet(ruleSet);
      setConfigJsonString(JSON.stringify(ruleSet.config ?? {}, null, 2));
    } else {
      // Default for new rule set
      const defaultConfig = {
        velocityBreach: { maxPayouts: 3, windowSeconds: 3600 },
        bankSwap: { minPayoutUsd: 1000, lookbackMinutes: 30 },
        // Add other default rule configs here
      };
      setCurrentRuleSet({ name: 'New Rule Set' }); // Initialize with partial data
      setConfigJsonString(JSON.stringify(defaultConfig, null, 2));
    }
    setJsonError(null);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setJsonError(null);
    let parsedConfig: Json;

    // 1. Validate Name
    if (!currentRuleSet.name || currentRuleSet.name.trim() === '') {
      toast.error('Rule set name cannot be empty.');
      setIsSaving(false);
      return;
    }

    // 2. Validate JSON structure and schema
    try {
      parsedConfig = JSON.parse(configJsonString);
      const validation = ruleSetConfigSchema.safeParse(parsedConfig);
      if (!validation.success) {
        setJsonError(validation.error.errors.map((e) => e.message).join(', '));
        throw new Error('Invalid JSON config structure.');
      }
      // Parsed and validated config is in validation.data (or parsedConfig)
    } catch (error: any) {
      toast.error(`Invalid JSON config: ${error.message}`);
      if (!jsonError && error instanceof SyntaxError) {
        setJsonError(`Invalid JSON: ${error.message}`);
      }
      setIsSaving(false);
      return;
    }

    // 3. Determine API method (POST for new, PUT for existing)
    const method = currentRuleSet.id ? 'PUT' : 'POST';
    const url = '/api/admin/rule-sets';
    const payload = {
      id: currentRuleSet.id, // Include ID for PUT
      name: currentRuleSet.name,
      config: parsedConfig,
    };

    // 4. Call API
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error || `Failed to ${method === 'POST' ? 'create' : 'update'} rule set`,
        );
      }

      toast.success(`Rule set ${method === 'POST' ? 'created' : 'updated'} successfully!`);
      setIsDialogOpen(false);
      setCurrentRuleSet({}); // Reset form state
      setConfigJsonString('');
      fetchRuleSets(); // Refresh list
    } catch (error: any) {
      toast.error(`Save failed: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // TODO: Implement Delete functionality
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule set? This cannot be undone.')) {
      return;
    }
    // Call DELETE /api/admin/rule-sets?id={id}
    toast.info('Delete functionality not yet implemented.');
  };

  return (
    <Container className="py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Manage Rule Sets</h1>
        <Button onClick={() => handleOpenDialog()}>
          {' '}
          <PlusCircle className="mr-2 h-4 w-4" /> New Rule Set
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Config Preview</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ruleSets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-slate-500 py-4">
                    No rule sets found.
                  </TableCell>
                </TableRow>
              )}
              {ruleSets.map((rs) => (
                <TableRow key={rs.id}>
                  <TableCell className="font-medium">{rs.name}</TableCell>
                  <TableCell>
                    <pre className="text-xs text-slate-500 overflow-hidden whitespace-pre-wrap truncate max-h-20">
                      {JSON.stringify(rs.config, null, 2)}
                    </pre>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDialog(rs)}
                      className="mr-2"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {/* Prevent deleting default? Add logic later */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(rs.id)}
                      disabled={rs.name === 'default'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{currentRuleSet.id ? 'Edit' : 'Create'} Rule Set</DialogTitle>
            <DialogDescription>
              Define the name and JSON configuration for this rule set.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={currentRuleSet.name || ''}
                onChange={(e) => setCurrentRuleSet({ ...currentRuleSet, name: e.target.value })}
                className="col-span-3"
                disabled={isSaving || currentRuleSet.name === 'default'} // Cannot rename default
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="config" className="text-right pt-2">
                Config (JSON)
              </Label>
              <Textarea
                id="config"
                value={configJsonString}
                onChange={(e) => {
                  setConfigJsonString(e.target.value);
                  setJsonError(null); // Clear error on change
                }}
                className="col-span-3 font-mono h-64"
                placeholder='{\n  "velocityBreach": { ... },\n  "bankSwap": { ... }\n}'
                disabled={isSaving}
              />
            </div>
            {jsonError && (
              <div className="col-span-4">
                <p className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                  {jsonError}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSaving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleSave} disabled={isSaving || !!jsonError}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Rule Set
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Container>
  );
}
