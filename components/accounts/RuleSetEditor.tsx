'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CodeIcon, SaveIcon } from 'lucide-react';
import Ajv from 'ajv';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/utils/supabase/client';
import schema from '@/schemas/rule-set.json';
import defaultConfig from '@/lib/guardian/config/default-rule-set.json';

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

interface RuleSetEditorProps {
  accountId: string;
  ruleSet: Record<string, unknown> | null;
}

export function RuleSetEditor({ accountId, ruleSet }: RuleSetEditorProps) {
  const [open, setOpen] = useState(false);
  const [jsonText, setJsonText] = useState(() => {
    return JSON.stringify(ruleSet ?? defaultConfig, null, 2);
  });
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSave = async () => {
    setLoading(true);
    
    try {
      const parsedJson = JSON.parse(jsonText);
      
      if (!validate(parsedJson)) {
        toast.error(`Invalid rule set: ${ajv.errorsText(validate.errors)}`);
        return;
      }
      
      const { error } = await supabase
        .from('connected_accounts')
        .update({ rule_set: parsedJson })
        .eq('stripe_account_id', accountId);
      
      if (error) throw error;
      
      toast.success('Rule set saved successfully');
      setOpen(false);
    } catch (e: any) {
      if (e instanceof SyntaxError) {
        toast.error(`Invalid JSON: ${e.message}`);
      } else {
        console.error('Error saving rule set:', e);
        toast.error('Failed to save rule set');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetToDefault = () => {
    setJsonText(JSON.stringify(defaultConfig, null, 2));
    toast.info('Reset to default settings');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-2">
          <CodeIcon className="h-4 w-4 mr-2" />
          Edit Thresholds
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Rule Set Configuration</DialogTitle>
          <DialogDescription>
            Customize threshold settings for fraud detection rules.
            Changes will take effect for future events.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="font-mono h-[300px] overflow-y-auto"
            placeholder="JSON rule configuration"
          />
          <p className="text-xs text-slate-500 mt-2">
            Configure velocity limits, bank swap detection windows, and other fraud detection thresholds.
          </p>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={resetToDefault}
            disabled={loading}
          >
            Reset to Default
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
            {!loading && <SaveIcon className="h-4 w-4 ml-2" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 