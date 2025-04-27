'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { Container } from '@/components/Container';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert as ShadcnAlert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns'; // For formatting dates on axes/tooltips
import { useUser } from '@/lib/hooks/useUser'; // Assuming hook to get user/profile
import { isPro } from '@/lib/guardian/plan'; // Assuming plan helper exists
import StripeAccountSelect from '@/app/components/StripeAccountSelect'; // Import account selector
import { Database } from '@/types/supabase'; // Import Database type

// Define SettingsRow type locally or import if available elsewhere
type SettingsRow = Database['public']['Tables']['settings']['Row'];
type ConnectedAccount = Database['public']['Tables']['connected_accounts']['Row'];

// Placeholder types for view data - adjust based on actual view structure
type AlertsByDayData = { day: string; alerts: number }[];
type AlertsRuleRankData = { alert_type: string; alerts: number }[];
type FpRateRuleData = {
  alert_type: string;
  total_alerts: number;
  fp_count: number;
  fp_rate: number;
}[];
type AvgRiskScoreData = { day: string; avg_risk: number }[];

// --- Data Fetching Functions --- //
const fetchAnalyticsView = async (viewName: string, accountId?: string | null, isPro?: boolean) => {
  const supabase = createClient();

  // Note: Views currently DO NOT support account filtering.
  // This function fetches global data regardless of accountId/isPro.
  // Filtering logic needs to be added to the SQL views or use RPC functions.
  // For now, the UI gating relies on the isPro flag passed to the component.
  let query = supabase.from(viewName).select('*');

  // Placeholder for future filtering logic:
  // if (isPro && accountId) {
  //   // Need RPC or modified view: e.g., supabase.rpc('get_view_data_for_account', { view_name: viewName, p_account_id: accountId })
  // }

  const { data, error } = await query;

  if (error) {
    console.error(`Error fetching ${viewName}:`, error);
    throw new Error(`Failed to fetch ${viewName}: ${error.message}`);
  }
  return data;
};

// --- Helper to format date string --- //
const formatDateTick = (dateString: string) => {
  try {
    return format(new Date(dateString), 'MMM d'); // Format like 'Apr 26'
  } catch {
    return dateString; // Fallback
  }
};

// --- Reusable Chart Card Component --- //
interface ChartCardProps {
  title: string;
  description: string;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  children: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({
  title,
  description,
  isLoading,
  isError,
  error,
  children,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px]">
        {' '}
        {/* Fixed height for consistency */}
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="flex justify-center items-center h-full">
            <ShadcnAlert variant="destructive" className="w-auto">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error loading data</AlertTitle>
              <AlertDescription>{error?.message || 'An unknown error occurred'}</AlertDescription>
            </ShadcnAlert>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
};

// --- Main Analytics Page Component --- //
export default function AnalyticsPage() {
  const supabase = createClient();
  const { user, profile, isLoading: isLoadingUser } = useUser(); // Get user/profile info
  const [allAccounts, setAllAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [settings, setSettings] = useState<SettingsRow | null>(null); // State for settings
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  // Determine if user is Pro based on settings
  const isProUser = useMemo(() => isPro(settings), [settings]);

  // Fetch settings on mount or when user changes
  useEffect(() => {
    async function fetchSettingsData() {
      if (!user) {
        setIsLoadingSettings(false);
        return;
      }
      setIsLoadingSettings(true);
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .eq('id', 'global_settings') // Assuming global for now, adjust if per-user/account
          .maybeSingle();
        if (error) throw error;
        setSettings(data);
      } catch (error: any) {
        console.error('Error fetching settings:', error);
        // Optionally show toast
      } finally {
        setIsLoadingSettings(false);
      }
    }
    fetchSettingsData();
  }, [user, supabase]);

  // Fetch connected accounts on mount or when user changes (needed for Pro dropdown)
  useEffect(() => {
    async function fetchUserAccounts() {
      if (!user) {
        setIsLoadingAccounts(false);
        return;
      }
      setIsLoadingAccounts(true);
      try {
        const { data, error } = await supabase
          .from('connected_accounts')
          .select('*') // Select needed fields for dropdown
          .eq('user_id', user.id);

        if (error) throw error;
        setAllAccounts(data || []);
        // Set initial selection if not already set and accounts exist
        if (!selectedAccountId && data && data.length > 0) {
          setSelectedAccountId(data[0].stripe_account_id);
        }
      } catch (error: any) {
        console.error('Error fetching connected accounts:', error);
        setAllAccounts([]); // Clear accounts on error
        // Optionally show toast
      } finally {
        setIsLoadingAccounts(false);
      }
    }
    fetchUserAccounts();
  }, [user, supabase, selectedAccountId]); // Add selectedAccountId dependency?

  // Memoize fetchAccountId based on PRO status and selected account ID
  const fetchAccountId = useMemo(() => {
    // const { accountId, isPro } = args; // Removed unused destructured args
    // Current logic always fetches global data, will change when filtering is implemented
    // if (isPro && accountId) {
    if (error) throw error;

    // const profile = data; // Removed unused variable

    // if (!profile?.is_pro) {
    return null; // Always fetch global for now
  }, []);

  // --- React Query Hooks --- //
  // Pass fetchAccountId to queryKey and queryFn
  const {
    data: alertsByDay,
    isLoading: isLoadingAlertsByDay,
    isError: isErrorAlertsByDay,
    error: errorAlertsByDay,
  } = useQuery<AlertsByDayData>({
    queryKey: ['analytics', 'alerts_by_day', fetchAccountId],
    queryFn: () => fetchAnalyticsView('alerts_by_day', fetchAccountId, isProUser),
    enabled: !isLoadingSettings && !isLoadingUser, // Only fetch when user/settings known
  });

  const {
    data: alertsRuleRank,
    isLoading: isLoadingRuleRank,
    isError: isErrorRuleRank,
    error: errorRuleRank,
  } = useQuery<AlertsRuleRankData>({
    queryKey: ['analytics', 'alerts_rule_rank', fetchAccountId],
    queryFn: () => fetchAnalyticsView('alerts_rule_rank', fetchAccountId, isProUser),
    enabled: !isLoadingSettings && !isLoadingUser,
  });

  const {
    data: fpRateRule,
    isLoading: isLoadingFpRate,
    isError: isErrorFpRate,
    error: errorFpRate,
  } = useQuery<FpRateRuleData>({
    queryKey: ['analytics', 'fp_rate_rule', fetchAccountId],
    queryFn: () => fetchAnalyticsView('fp_rate_rule', fetchAccountId, isProUser),
    enabled: !isLoadingSettings && !isLoadingUser,
  });

  const {
    data: avgRiskScore,
    isLoading: isLoadingAvgRisk,
    isError: isErrorAvgRisk,
    error: errorAvgRisk,
  } = useQuery<AvgRiskScoreData>({
    queryKey: ['analytics', 'avg_risk_score', fetchAccountId],
    queryFn: () => fetchAnalyticsView('avg_risk_score', fetchAccountId, isProUser),
    enabled: !isLoadingSettings && !isLoadingUser,
  });

  // Memoize formatted data for charts to prevent re-renders
  const formattedFpRateData = useMemo(() => {
    return fpRateRule?.map((item) => ({ ...item, fp_percent: item.fp_rate * 100 })) || [];
  }, [fpRateRule]);

  // Combined loading state
  const isLoading = isLoadingUser || isLoadingSettings || isLoadingAccounts;

  if (isLoading) {
    return (
      <Container className="py-10">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Guardian Analytics</h1>
        {isProUser && allAccounts.length > 0 && (
          <div className="w-full md:w-auto md:min-w-[250px]">
            <StripeAccountSelect
              accounts={allAccounts}
              selectedAccountId={selectedAccountId}
              onAccountChange={setSelectedAccountId}
            />
          </div>
        )}
      </div>

      {!isProUser && (
        <ShadcnAlert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Free Tier View</AlertTitle>
          <AlertDescription>
            You are viewing aggregated analytics data across all users. Upgrade to Pro to see data
            specific to your connected accounts.
            {/* Add link to billing page */}
          </AlertDescription>
        </ShadcnAlert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card A: Alerts per day */}
        <ChartCard
          title="Alerts / Day (Last 30 Days)"
          description={
            isProUser && selectedAccountId
              ? `For account ${selectedAccountId}`
              : 'Global daily alert volume.'
          }
          isLoading={isLoadingAlertsByDay}
          isError={isErrorAlertsByDay}
          error={errorAlertsByDay as Error | null}
        >
          {alertsByDay && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={alertsByDay} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickFormatter={formatDateTick} fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip
                  contentStyle={{ fontSize: '12px', padding: '4px 8px' }}
                  labelFormatter={formatDateTick}
                />
                <Line
                  type="monotone"
                  dataKey="alerts"
                  stroke="#8884d8"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Card B: Top rules by count */}
        <ChartCard
          title="Top Rules by Count (Last 30 Days)"
          description={
            isProUser && selectedAccountId
              ? `For account ${selectedAccountId}`
              : 'Global trigger frequency.'
          }
          isLoading={isLoadingRuleRank}
          isError={isErrorRuleRank}
          error={errorRuleRank as Error | null}
        >
          {alertsRuleRank && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={alertsRuleRank}
                layout="vertical"
                margin={{ top: 5, right: 20, bottom: 5, left: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} fontSize={12} />
                <YAxis
                  dataKey="alert_type"
                  type="category"
                  width={100}
                  fontSize={10}
                  interval={0}
                />
                <Tooltip contentStyle={{ fontSize: '12px', padding: '4px 8px' }} />
                <Bar dataKey="alerts" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Card C: False-positive % per rule */}
        <ChartCard
          title="False Positive Rate by Rule (Last 30 Days)"
          description={
            isProUser && selectedAccountId
              ? `For account ${selectedAccountId}`
              : 'Global false positive rates.'
          }
          isLoading={isLoadingFpRate}
          isError={isErrorFpRate}
          error={errorFpRate as Error | null}
        >
          {formattedFpRateData && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={formattedFpRateData}
                layout="vertical"
                margin={{ top: 5, right: 20, bottom: 5, left: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" unit="%" domain={[0, 100]} fontSize={12} />
                <YAxis
                  dataKey="alert_type"
                  type="category"
                  width={100}
                  fontSize={10}
                  interval={0}
                />
                <Tooltip
                  formatter={(value) => `${Number(value).toFixed(1)}%`}
                  contentStyle={{ fontSize: '12px', padding: '4px 8px' }}
                />
                <Bar dataKey="fp_percent" fill="#ffc658" name="False Positive %" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Card D: Average risk score */}
        <ChartCard
          title="Average Risk Score (Last 7 Days)"
          description={
            isProUser && selectedAccountId
              ? `For account ${selectedAccountId}`
              : 'Global average daily risk score.'
          }
          isLoading={isLoadingAvgRisk}
          isError={isErrorAvgRisk}
          error={errorAvgRisk as Error | null}
        >
          {avgRiskScore && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={avgRiskScore} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="colorAvgRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff7300" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#ff7300" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickFormatter={formatDateTick} fontSize={12} />
                <YAxis domain={[0, 100]} fontSize={12} />
                <Tooltip
                  formatter={(value) => Number(value).toFixed(1)}
                  labelFormatter={formatDateTick}
                  contentStyle={{ fontSize: '12px', padding: '4px 8px' }}
                />
                <Area
                  type="monotone"
                  dataKey="avg_risk"
                  stroke="#ff7300"
                  fillOpacity={1}
                  fill="url(#colorAvgRisk)"
                  name="Avg Risk"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </Container>
  );
}
