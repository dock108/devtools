'use client';\n\nimport { useState, useTransition, ChangeEvent } from 'react';\nimport { toast } from 'sonner';\nimport { Button } from "@/components/ui/button";\nimport { Input } from "@/components/ui/input";\nimport { \n    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose\n} from "@/components/ui/dialog";\nimport { \n    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger\n} from "@/components/ui/alert-dialog";\nimport { \n    Table, TableBody, TableCell, TableHead, TableHeader, TableRow\n} from "@/components/ui/table";\nimport { Label } from "@/components/ui/label";\nimport { Trash2, PlusCircle, Copy } from 'lucide-react';\nimport { ApiKeyInfo } from '@/lib/supabase/user'; // Import type\nimport { 
    generateApiKeyServerAction, 
    revokeApiKeyServerAction 
} from './actions'; // Import the real server actions\n\ninterface ApiKeysManagerProps {\n  initialApiKeys: ApiKeyInfo[];\n}\n\nexport function ApiKeysManager({ initialApiKeys }: ApiKeysManagerProps) {\n  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>(initialApiKeys);\n  const [newKeyName, setNewKeyName] = useState('');\n  const [generatedKey, setGeneratedKey] = useState<string | null>(null);\n  const [isGenerating, startGeneratingTransition] = useTransition();\n  const [isRevoking, startRevokingTransition] = useTransition();\n  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);\n\n  const handleGenerateKey = () => {\n    if (!newKeyName.trim()) {\n        toast.error('Please enter a name for the API key.');\n        return;\n    }\n    startGeneratingTransition(async () => {\n        const formData = new FormData();\n        formData.append('keyName', newKeyName);\n        const result = await generateApiKeyServerAction(formData);\n\n        if (result.success && result.apiKey) {\n            toast.success('API Key generated successfully!');\n            setGeneratedKey(result.apiKey);\n            // Optimistically add (or wait for re-fetch/invalidation)\n            // For simplicity, let\'s assume revalidation will handle list update\n            // Or manually refetch profile data here\n            setNewKeyName(''); // Clear input\n            // Keep dialog open to show the key\n        } else {\n            toast.error(`Error generating API key: ${result.error || 'Unknown error'}`);\n            setIsCreateDialogOpen(false); // Close dialog on error\n        }\n    });\n  };\n\n   const handleRevokeKey = (keyId: string) => {\n    startRevokingTransition(async () => {\n        const formData = new FormData();\n        formData.append('keyId', keyId);\n        const result = await revokeApiKeyServerAction(formData);\n\n        if (result.success) {\n            toast.success('API Key revoked successfully!');\n            // Optimistically remove from local state\n            setApiKeys(currentKeys => currentKeys.filter(key => key.id !== keyId));\n        } else {\n            toast.error(`Error revoking API key: ${result.error || 'Unknown error'}`);\n        }\n    });\n  };\n\n  const copyToClipboard = (text: string) => {\n    navigator.clipboard.writeText(text)\n      .then(() => toast.success('API Key copied to clipboard!'))\n      .catch(err => toast.error('Failed to copy key.'));\n  };\n\n  const closeCreateDialog = () => {\n      setIsCreateDialogOpen(false);\n      setGeneratedKey(null); // Clear generated key when dialog closes\n      setNewKeyName('');\n  }\n\n  return (\n    <div className="space-y-6">\n      {/* Key List */}\n      <div className="rounded-md border">\n          <Table>\n            <TableHeader>\n                <TableRow>\n                <TableHead>Name</TableHead>\n                <TableHead>Prefix</TableHead>\n                <TableHead>Created</TableHead>\n                <TableHead className="text-right">Actions</TableHead>\n                </TableRow>\n            </TableHeader>\n            <TableBody>\n                {apiKeys.length === 0 && (\n                    <TableRow>\n                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">\n                        No API keys created yet.\n                        </TableCell>\n                    </TableRow>\n                )}\n                {apiKeys.map((key) => (\n                <TableRow key={key.id}>\n                    <TableCell className="font-medium">{key.name}</TableCell>\n                    <TableCell>{key.prefix}****</TableCell> {/* Show prefix only */}\n                    <TableCell>{new Date(key.created_at).toLocaleDateString()}</TableCell>\n                    <TableCell className="text-right">\n                    {/* Revoke Button with Confirmation */}\n                    <AlertDialog>\n                        <AlertDialogTrigger asChild>\n                             <Button \
                                variant="ghost" \
                                size="sm" \
                                disabled={isRevoking} \
                                aria-label={`Revoke key ${key.name}`}\
                             >\
                                <Trash2 className="h-4 w-4 text-destructive" />\
                            </Button>\
                        </AlertDialogTrigger>\n                        <AlertDialogContent>\n                            <AlertDialogHeader>\n                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>\n                            <AlertDialogDescription>\n                                This action cannot be undone. This will permanently revoke the API key named "{key.name}".\n                            </AlertDialogDescription>\n                            </AlertDialogHeader>\n                            <AlertDialogFooter>\n                            <AlertDialogCancel>Cancel</AlertDialogCancel>\n                            <AlertDialogAction \
                                onClick={() => handleRevokeKey(key.id)} \
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90" \
                                disabled={isRevoking}\
                            >\
                                {isRevoking ? 'Revoking...' : 'Revoke Key'}\
                            </AlertDialogAction>\
                            </AlertDialogFooter>\
                        </AlertDialogContent>\
                    </AlertDialog>\
                    </TableCell>\
                </TableRow>\n                ))}\n            </TableBody>\n        </Table>\n      </div>\n\n      {/* Create Key Button & Dialog */}\n      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>\n            <DialogTrigger asChild>\n                <Button disabled={isGenerating}>\n                    <PlusCircle className="mr-2 h-4 w-4" /> Create New API Key\n                </Button>\n            </DialogTrigger>\n            <DialogContent onInteractOutside={(e) => { \
                // Prevent closing if we just generated a key to show\
                if (generatedKey) e.preventDefault(); \
            }}>\
                 {generatedKey ? (\
                    <>\
                        <DialogHeader>\
                            <DialogTitle>API Key Generated</DialogTitle>\
                            <DialogDescription>\
                                Your new API key has been created. Please copy it now, as you won\'t be able to see it again.\
                            </DialogDescription>\
                        </DialogHeader>\
                        <div className="flex items-center space-x-2 mt-4 bg-muted p-3 rounded-md">\
                            <Input \
                                id="new-api-key" \
                                value={generatedKey} \
                                readOnly \
                                className="flex-1 font-mono text-sm"\
                            />\
                            <Button type="button" size="sm" onClick={() => copyToClipboard(generatedKey)}>\
                                <Copy className="h-4 w-4" />\
                            </Button>\
                        </div>\
                        <DialogFooter>\
                             <Button variant="outline" onClick={closeCreateDialog}>Close</Button>\
                        </DialogFooter>\
                    </>\
                 ) : (\
                    <>\
                        <DialogHeader>\
                            <DialogTitle>Create New API Key</DialogTitle>\
                            <DialogDescription>\
                                Give your new API key a descriptive name.\
                            </DialogDescription>\
                        </DialogHeader>\
                        <div className="grid gap-4 py-4">\
                            <div className="grid grid-cols-4 items-center gap-4">\
                            <Label htmlFor="key-name" className="text-right">\
                                Name\
                            </Label>\
                            <Input \
                                id="key-name" \
                                value={newKeyName} \
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewKeyName(e.target.value)} \
                                className="col-span-3"\
                                placeholder="e.g., My Production Server"\
                                disabled={isGenerating}\
                             />\
                            </div>\
                        </div>\
                        <DialogFooter>\
                             <DialogClose asChild>\
                                <Button type="button" variant="outline" disabled={isGenerating}>Cancel</Button>\
                            </DialogClose>\
                            <Button type="button" onClick={handleGenerateKey} disabled={isGenerating || !newKeyName.trim()}>\
                                {isGenerating ? 'Generating...' : 'Generate Key'}\
                            </Button>\
                        </DialogFooter>\
                    </>\
                 )}\
            </DialogContent>\
        </Dialog>\n    </div>\n  );\n}\n 