'use client';

import { useState, useTransition, ChangeEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Trash2, PlusCircle, Copy } from 'lucide-react';
import { ApiKeyInfo } from '@/lib/supabase/user'; // Import type
import { generateApiKeyServerAction, revokeApiKeyServerAction } from './actions'; // Import the real server actions
import { Card, CardContent, CardFooter, CardDescription } from '@/components/ui/card';

interface ApiKeysManagerProps {
  initialApiKeys: ApiKeyInfo[];
}

export function ApiKeysManager({ initialApiKeys }: ApiKeysManagerProps) {
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>(initialApiKeys);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isGenerating, startGeneratingTransition] = useTransition();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeyInfo | null>(null);

  const handleGenerateKey = () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a name for the API key.');
      return;
    }
    startGeneratingTransition(async () => {
      const formData = new FormData();
      formData.append('keyName', newKeyName);
      const result = await generateApiKeyServerAction(formData);

      if (result.success && result.apiKey) {
        toast.success('API Key generated successfully!');
        setGeneratedKey(result.apiKey);
        // Optimistically add (or wait for re-fetch/invalidation)
        // For simplicity, let's assume revalidation will handle list update
        // Or manually refetch profile data here
        setNewKeyName(''); // Clear input
        // Keep dialog open to show the key
      } else {
        toast.error(`Error generating API key: ${result.error || 'Unknown error'}`);
        setIsCreateDialogOpen(false); // Close dialog on error
      }
    });
  };

  const handleRevokeKey = (keyId: string) => {
    const revoke = async () => {
      const formData = new FormData();
      formData.append('keyId', keyId);
      const result = await revokeApiKeyServerAction(formData);

      if (result.success) {
        toast.success('API Key revoked successfully!');
        setApiKeys((currentKeys) => currentKeys.filter((key) => key.id !== keyId));
      } else {
        toast.error(`Error revoking API key: ${result.error || 'Unknown error'}`);
      }
    };
    revoke();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success('API Key copied to clipboard!'))
      .catch((_err) => toast.error('Failed to copy key.'));
  };

  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setGeneratedKey(null); // Clear generated key when dialog closes
    setNewKeyName('');
  };

  const handleRevoke = (keyId: string, keyName: string) => {
    setKeyToRevoke({ id: keyId, name: keyName });
    setShowRevokeDialog(true);
  };

  const confirmRevoke = () => {
    if (keyToRevoke) {
      handleRevokeKey(keyToRevoke.id);
      setShowRevokeDialog(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Key List */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiKeys.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No API keys created yet.
                </TableCell>
              </TableRow>
            )}
            {apiKeys.map((key) => (
              <TableRow key={key.id}>
                <TableCell className="font-medium">{key.name}</TableCell>
                <TableCell>{key.prefix}****</TableCell> {/* Show prefix only */}
                <TableCell>{new Date(key.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center space-x-2">
                    <Button onClick={() => handleRevoke(key.id, key.name)} variant="destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> Revoke
                    </Button>

                    {/* Confirmation Dialog */}
                    <AlertDialog open={showRevokeDialog && keyToRevoke?.id === key.id}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to revoke the key named &quot;{keyToRevoke?.name}
                            &quot;? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setShowRevokeDialog(false)}>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction onClick={confirmRevoke} variant="destructive">
                            Revoke Key
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Key Button & Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button disabled={isGenerating}>
            <PlusCircle className="mr-2 h-4 w-4" /> Create New API Key
          </Button>
        </DialogTrigger>
        <DialogContent
          onInteractOutside={(e) => {
            // Prevent closing if we just generated a key to show
            if (generatedKey) e.preventDefault();
          }}
        >
          {generatedKey ? (
            <>
              <DialogHeader>
                <DialogTitle>API Key Generated</DialogTitle>
                <DialogDescription>
                  Your new API key has been created. Please copy it now, as you won't be able to see
                  it again.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center space-x-2 mt-4 bg-muted p-3 rounded-md">
                <Input
                  id="new-api-key"
                  value={generatedKey}
                  readOnly
                  className="flex-1 font-mono text-sm"
                />
                <Button type="button" size="sm" onClick={() => copyToClipboard(generatedKey)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeCreateDialog}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Create New API Key</DialogTitle>
                <DialogDescription>Give your new API key a descriptive name.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="key-name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="key-name"
                    value={newKeyName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNewKeyName(e.target.value)}
                    className="col-span-3"
                    placeholder="e.g., My Production Server"
                    disabled={isGenerating}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isGenerating}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  onClick={handleGenerateKey}
                  disabled={isGenerating || !newKeyName.trim()}
                >
                  {isGenerating ? 'Generating...' : 'Generate Key'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Card className="mt-6">
        <CardContent>
          <p className="text-xs text-muted-foreground">
            API keys grant access to your account. Treat them like passwords and keep them secure.
          </p>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <CardDescription>
            Manage your API keys here. Be sure to store them securely, as they won&apos;t be shown
            again.
          </CardDescription>
        </CardFooter>
      </Card>
    </div>
  );
}
