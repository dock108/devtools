'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client'; // Assuming client setup utility exists
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { Container } from '@/components/Container';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert as ShadcnAlert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns'; // For formatting dates on axes/tooltips

// Assuming a way to get user/settings info, e.g., context or hook
// import { useAuth } from '@/context/AuthContext';
// import { isPro } from '@/lib/guardian/plan';

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
const fetchAnalyticsView = async (viewName: string, accountId?: string | null) => {
  const supabase = createClient();
  let query = supabase.from(viewName).select('*');

  // TODO: Implement Pro tier filtering if accountId is provided
  // if (accountId) {
  //   query = query.eq('stripe_account_id', accountId); // Example, view needs account id
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
  // TODO: Get user settings to determine tier and potentially selected account
  // const { settings, selectedAccountId } = useAuth(); // Example
  const isProUser = false; // Placeholder
  const selectedAccountId = null; // Placeholder

  // --- React Query Hooks --- //
  const {
    data: alertsByDay,
    isLoading: isLoadingAlertsByDay,
    isError: isErrorAlertsByDay,
    error: errorAlertsByDay,
  } = useQuery<AlertsByDayData>({
    // Specify the type
    queryKey: ['analytics', 'alerts_by_day', selectedAccountId], // Include account ID if used
    queryFn: () => fetchAnalyticsView('alerts_by_day', selectedAccountId),
  });

  const {
    data: alertsRuleRank,
    isLoading: isLoadingRuleRank,
    isError: isErrorRuleRank,
    error: errorRuleRank,
  } = useQuery<AlertsRuleRankData>({
    // Specify the type
    queryKey: ['analytics', 'alerts_rule_rank', selectedAccountId],
    queryFn: () => fetchAnalyticsView('alerts_rule_rank', selectedAccountId),
  });

  const {
    data: fpRateRule,
    isLoading: isLoadingFpRate,
    isError: isErrorFpRate,
    error: errorFpRate,
  } = useQuery<FpRateRuleData>({
    // Specify the type
    queryKey: ['analytics', 'fp_rate_rule', selectedAccountId],
    queryFn: () => fetchAnalyticsView('fp_rate_rule', selectedAccountId),
  });

  const {
    data: avgRiskScore,
    isLoading: isLoadingAvgRisk,
    isError: isErrorAvgRisk,
    error: errorAvgRisk,
  } = useQuery<AvgRiskScoreData>({
    // Specify the type
    queryKey: ['analytics', 'avg_risk_score', selectedAccountId],
    queryFn: () => fetchAnalyticsView('avg_risk_score', selectedAccountId),
  });

  // Memoize formatted data for charts to prevent re-renders
  const formattedFpRateData = useMemo(() => {
    return fpRateRule?.map((item) => ({ ...item, fp_percent: item.fp_rate * 100 })) || [];
  }, [fpRateRule]);

  return (
    <Container className="py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Guardian Analytics</h1>
        {/* TODO: Add Account Selector for Pro users */}
        {/* {isProUser && <AccountSelector />} */}
      </div>

      {/* TODO: Add Free Tier notice if applicable */}
      {/* {!isProUser && <FreeTierNotice />} */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card A: Alerts per day */}
        <ChartCard
          title="Alerts / Day (Last 30 Days)"
          description="Daily alert volume trend."
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
          description="Most frequently triggered alert types."
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
          description="Percentage of alerts marked as false positive for each rule type."
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
          description="Daily average risk score of triggered alerts."
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
