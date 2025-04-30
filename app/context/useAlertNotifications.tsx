'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { createClient } from '@/utils/supabase/client';
// import { SupabaseClient } from '@supabase/supabase-js'; // Removed
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Database } from '@/types/supabase'; // Assuming your generated types
import { log } from '@/lib/logger'; // Assuming logger is available

// Define the shape of an alert for the context
// Adapt based on the actual fields available/needed from the 'alerts' table payload
type AlertPayload = Database['public']['Tables']['alerts']['Row'];

interface AlertNotificationContextType {
  unreadCount: number;
  unreadAlerts: AlertPayload[];
  isLoading: boolean;
  markAllRead: () => Promise<void>;
  markSingleRead: (alertId: string) => Promise<void>;
}

const AlertNotificationContext = createContext<AlertNotificationContextType | undefined>(undefined);

interface AlertNotificationsProviderProps {
  children: ReactNode;
  userStripeAccounts?: string[]; // Required to filter alerts
}

export const AlertNotificationsProvider: React.FC<AlertNotificationsProviderProps> = ({
  children,
  userStripeAccounts = [],
}) => {
  const supabase = createClient();
  const router = useRouter();
  const [unreadAlerts, setUnreadAlerts] = useState<AlertPayload[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // --- Initial Fetch --- //
  const fetchInitialUnread = useCallback(
    async (currentUserId: string, accounts: string[]) => {
      if (!currentUserId || accounts.length === 0) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      console.log('Fetching initial unread alerts for user:', currentUserId, 'accounts:', accounts);
      try {
        // Fetch alerts for user's accounts that are NOT in alert_reads for this user
        // This requires an RPC function or careful filtering
        // Option 1: RPC function `get_unread_alerts(user_id, account_ids)` (Recommended)
        // Option 2: Fetch all recent alerts for accounts, then filter client-side (Less efficient)
        // Option 3: Fetch alerts LEFT JOIN alert_reads WHERE read_at IS NULL

        // Using Option 3 approach (ensure RLS allows reading alerts for owned accounts)
        const { data, error } = await supabase
          .from('alerts')
          .select(
            `
          *,
          alert_reads!left(user_id)
        `,
          )
          .in('stripe_account_id', accounts)
          .is('alert_reads.user_id', null) // Only where there's no matching read record for *this* user
          .order('triggered_at', { ascending: false })
          .limit(100); // Limit initial fetch for performance

        if (error) {
          throw error;
        }

        // Filter out alerts where the join found a read record for the specific user (double check)
        // The .is('alert_reads.user_id', null) should handle this server-side with Supabase v2.4+
        // For older versions or complex RLS, manual filter might be needed:
        // const trulyUnread = data?.filter(alert => !(alert.alert_reads && alert.alert_reads.length > 0 && alert.alert_reads.some(read => read.user_id === currentUserId))) || [];

        const trulyUnread = data || []; // Assume server-side filter works

        console.log(`Found ${trulyUnread.length} initial unread alerts.`);
        setUnreadAlerts(trulyUnread);
        setUnreadCount(trulyUnread.length);
      } catch (error) {
        log.error(
          { error: error.message, userId: currentUserId },
          'Failed to fetch initial unread alerts',
        );
        setUnreadAlerts([]);
        setUnreadCount(0);
      } finally {
        setIsLoading(false);
      }
    },
    [supabase],
  );

  // Get user ID and trigger initial fetch
  useEffect(() => {
    const getUserAndFetch = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        await fetchInitialUnread(user.id, userStripeAccounts);
      } else {
        setIsLoading(false); // No user, not loading
      }
    };
    getUserAndFetch();
  }, [supabase, fetchInitialUnread, userStripeAccounts]);

  // --- Actions --- //
  const markAllRead = useCallback(async () => {
    if (unreadAlerts.length === 0 || !userId) return;

    const alertIdsToMark = unreadAlerts.map((alert) => alert.id);
    console.log(`Calling API to mark ${alertIdsToMark.length} alerts as read for user ${userId}`);

    // Optimistic update first
    const previousAlerts = [...unreadAlerts];
    setUnreadAlerts([]);
    setUnreadCount(0);

    try {
      const { error } = await supabase.rpc('mark_alerts_read', {
        p_alert_ids: alertIdsToMark,
        p_user_id: userId,
      });

      if (error) {
        log.error(
          { error: error.message, userId, count: alertIdsToMark.length },
          'Failed to mark all alerts as read via RPC',
        );
        // Revert optimistic update on failure
        setUnreadAlerts(previousAlerts);
        setUnreadCount(previousAlerts.length);
        toast.error('Failed to mark alerts as read.');
      }
    } catch (error) {
      log.error(
        { error: error.message, userId, count: alertIdsToMark.length },
        'Exception marking all alerts read',
      );
      // Revert optimistic update on failure
      setUnreadAlerts(previousAlerts);
      setUnreadCount(previousAlerts.length);
      toast.error('An error occurred.');
    } finally {
      // **Always refetch after attempt**
      console.log('Refetching unread count after markAllRead attempt.');
      // Use a slight delay to allow potential DB replication/cache update?
      setTimeout(() => fetchInitialUnread(userId, userStripeAccounts), 500); // 0.5s delay
    }
  }, [supabase, userId, unreadAlerts, fetchInitialUnread, userStripeAccounts]);

  const markSingleRead = useCallback(
    async (alertId: string) => {
      if (!userId) return;
      console.log(`Calling API to mark alert ${alertId} as read for user ${userId}`);

      // Optimistic update
      const previousAlerts = [...unreadAlerts];
      const previousCount = unreadCount;
      setUnreadAlerts((prev) => prev.filter((a) => a.id !== alertId));
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        const { error } = await supabase.rpc('mark_alerts_read', {
          p_alert_ids: [alertId],
          p_user_id: userId,
        });

        if (error) {
          log.error(
            { error: error.message, userId, alertId },
            'Failed to mark single alert as read via RPC',
          );
          // Revert optimistic update
          setUnreadAlerts(previousAlerts);
          setUnreadCount(previousCount);
          toast.error('Failed to mark alert as read.');
        }
      } catch (error) {
        log.error({ error: error.message, userId, alertId }, 'Exception marking single alert read');
        // Revert optimistic update
        setUnreadAlerts(previousAlerts);
        setUnreadCount(previousCount);
        toast.error('An error occurred.');
      } finally {
        // **Always refetch after attempt**
        console.log(`Refetching unread count after markSingleRead attempt for ${alertId}.`);
        // Use a slight delay?
        setTimeout(() => fetchInitialUnread(userId, userStripeAccounts), 500); // 0.5s delay
      }
    },
    [supabase, userId, unreadAlerts, unreadCount, fetchInitialUnread, userStripeAccounts],
  );

  // Handle incoming new alerts via Realtime
  const handleNewAlert = useCallback(
    (payload: { new: AlertPayload }) => {
      console.log('Realtime INSERT received:', payload.new);
      const newAlert = payload.new;

      // Check if the alert belongs to one of the user's connected accounts
      if (!userStripeAccounts.includes(newAlert.stripe_account_id)) {
        console.log(
          `Alert ${newAlert.id} ignored (account ${newAlert.stripe_account_id} not linked to user).`,
        );
        return;
      }

      // Check if we already have this alert (e.g., from initial fetch or race condition)
      if (unreadAlerts.some((alert) => alert.id === newAlert.id)) {
        console.log(`Alert ${newAlert.id} already in unread list.`);
        return;
      }

      // Add to queue and update count
      // Ensure we don't exceed any reasonable limit if the tab is open for ages
      setUnreadAlerts((prev) => [newAlert, ...prev].slice(0, 100)); // Keep max 100 unread in memory
      setUnreadCount((prev) => prev + 1);

      // Show toast notification
      toast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
          >
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <span className="text-xl">🚨</span>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">New Guardian Alert</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {newAlert.type} ({newAlert.severity})
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-gray-200">
              <button
                onClick={() => {
                  router.push(`/guardian/alerts/${newAlert.id}`); // Link to specific alert page
                  toast.dismiss(t.id);
                  // Mark single read optimistically and via API
                  markSingleRead(newAlert.id);
                }}
                className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                View
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full border border-transparent rounded-none p-4 flex items-center justify-center text-sm font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Close
              </button>
            </div>
          </div>
        ),
        {
          duration: 10000, // Keep toast longer
          position: 'top-right',
        },
      );
    },
    [router, userStripeAccounts, unreadAlerts, markSingleRead],
  );

  // Subscribe to Realtime changes on mount
  useEffect(() => {
    if (!userId || userStripeAccounts.length === 0) {
      // console.log('Realtime subscription skipped (no user or no accounts).');
      setIsLoading(false);
      return; // Don't subscribe until we have user/accounts
    }

    console.log(
      'Subscribing to Realtime alerts channel for accounts:',
      userStripeAccounts.join(', '),
    );

    const channel = supabase
      .channel('realtime-alerts') // Unique channel name
      .on<'postgres_changes'>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts',
        },
        handleNewAlert,
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime channel subscribed successfully!');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime channel error:', err);
        }
        if (status === 'TIMED_OUT') {
          console.warn('Realtime channel subscription timed out.');
        }
        if (status === 'CLOSED') {
          console.log('Realtime channel closed.');
        }
      });

    // Cleanup subscription on unmount
    return () => {
      console.log('Unsubscribing from Realtime alerts channel.');
      supabase.removeChannel(channel);
    };
  }, [supabase, handleNewAlert, userId, userStripeAccounts]); // Depend on userId and accounts

  const contextValue = {
    unreadCount,
    unreadAlerts,
    isLoading,
    markAllRead,
    markSingleRead,
  };

  return (
    <AlertNotificationContext.Provider value={contextValue}>
      {children}
    </AlertNotificationContext.Provider>
  );
};

// Custom hook to use the context
export const useAlertNotifications = (): AlertNotificationContextType => {
  const context = useContext(AlertNotificationContext);
  if (context === undefined) {
    throw new Error('useAlertNotifications must be used within an AlertNotificationsProvider');
  }
  return context;
};
