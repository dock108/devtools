import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';
import { Container } from '@/components/Container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle } from 'lucide-react';

// Define the expected shape of the query result
interface FeedbackAnalyticsData {
  alert_type: string;
  total: number;
  fp: number;
}

// Fetch data server-side
async function getFeedbackAnalytics(supabase: any): Promise<FeedbackAnalyticsData[]> {
  // TODO: Ideally, filter this data based on the accounts the current user has access to.
  // This might require joining with connected_accounts or modifying the query/RLS.
  const query = `
    select 
      a.alert_type,
      count(a.id) as total,
      count(f.id) filter (where f.verdict = 'false_positive') as fp
    from public.alerts a
    left join public.alert_feedback f on a.id = f.alert_id
    -- Add account filtering here if needed
    group by a.alert_type
    order by total desc;
  `;

  const { data, error } = await supabase.rpc('execute_sql', { sql: query });
  // Note: Using a generic execute_sql RPC requires parsing the result.
  // A dedicated RPC function would be cleaner.

  // const { data, error } = await supabase.from('alerts').select('alert_type, count:id.count()'); // Simpler example, needs join/grouping

  if (error) {
    console.error('Error fetching feedback analytics:', error);
    return [];
  }

  // Assuming the rpc returns the data in a usable format, might need parsing
  return data as FeedbackAnalyticsData[];
}

export default async function AnalyticsPage() {
  const cookieStore = cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
      },
    },
  );

  const feedbackData = await getFeedbackAnalytics(supabase);

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Guardian Analytics</h1>

      {/* Other analytics cards would go here... */}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="mr-2 h-5 w-5 text-yellow-500" />
            Alert Feedback Summary
          </CardTitle>
          <CardDescription>
            False positive rates based on user feedback per alert type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {feedbackData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule (Alert Type)</TableHead>
                  <TableHead className="text-right">Total Alerts</TableHead>
                  <TableHead className="text-right">False Positives</TableHead>
                  <TableHead className="text-right">False Positive %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedbackData.map((row) => {
                  const fpRate = row.total > 0 ? ((row.fp / row.total) * 100).toFixed(1) : '0.0';
                  return (
                    <TableRow key={row.alert_type}>
                      <TableCell className="font-medium">{row.alert_type}</TableCell>
                      <TableCell className="text-right">{row.total}</TableCell>
                      <TableCell className="text-right">{row.fp}</TableCell>
                      <TableCell className="text-right">{fpRate}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">
              No feedback data available yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Placeholder for Top 10 accounts with most FP flags - requires different query */}
      {/* <Card className="mt-6">
        <CardHeader>
          <CardTitle>Accounts with Most False Positives</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 text-center py-4">
            [Placeholder: Top 10 Accounts by FP Count]
          </p>
        </CardContent>
      </Card> */}
    </Container>
  );
}
