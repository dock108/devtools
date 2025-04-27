'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface NotificationChannelActionsProps {
  channelId: string;
  channelName: string;
}

export function NotificationChannelActions({
  channelId,
  channelName,
}: NotificationChannelActionsProps) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      // First check if this channel is being used by any rule sets
      const { data: ruleSets, error: checkError } = await supabase
        .from('rule_sets')
        .select('id, name')
        .contains('notification_channels', [channelId]);

      if (checkError) {
        throw new Error(checkError.message);
      }

      // If channel is in use, don't allow deletion
      if (ruleSets && ruleSets.length > 0) {
        const ruleSetNames = ruleSets.map((rs) => rs.name).join(', ');
        toast({
          title: 'Cannot delete channel',
          description: `This channel is in use by the following rule sets: ${ruleSetNames}`,
          variant: 'destructive',
        });
        setShowDeleteDialog(false);
        return;
      }

      // Delete the channel if it's not in use
      const { error: deleteError } = await supabase
        .from('notification_channels')
        .delete()
        .eq('id', channelId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      toast({
        title: 'Channel deleted',
        description: `${channelName} has been deleted successfully.`,
      });

      // Refresh the page to show updated list
      router.refresh();
    } catch (error) {
      console.error('Error deleting channel:', error);
      toast({
        title: 'Error',
        description: `Failed to delete channel: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the notification channel
              <span className="font-medium"> {channelName}</span>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
