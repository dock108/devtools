import { test, expect, beforeAll, afterAll, describe } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid'; // For generating UUIDs

// Load environment variables for Supabase connection
// Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your test environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL and Service Role Key must be provided via environment variables.');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Helper function to clean up test data
const cleanup = async (alertIds: string[], accountId: string) => {
  await supabase.from('alert_feedback').delete().in('alert_id', alertIds);
  await supabase.from('alerts').delete().in('id', alertIds);
  // Consider cleaning up account if necessary, or use dedicated test accounts
  // await supabase.from('connected_accounts').delete().eq('stripe_account_id', accountId)
};

// Helper function to insert an alert (trigger will calculate initial score)
const insertAlert = async (accountId: string, type: string, severity: string = 'medium') => {
  const alertData = {
    id: uuidv4(), // Generate UUID for the test
    stripe_account_id: accountId,
    alert_type: type,
    severity: severity,
    message: `Test alert for ${type}`,
    triggered_at: new Date().toISOString(),
    // risk_score will be set by the trigger
  };
  const { data, error } = await supabase.from('alerts').insert(alertData).select().single();
  if (error) throw new Error(`Failed to insert alert: ${error.message}`);
  return data;
};

// Helper function to insert feedback
const insertFeedback = async (alertId: string, verdict: 'false_positive' | 'true_positive') => {
  const feedbackData = {
    alert_id: alertId,
    user_id: uuidv4(), // Mock user ID
    verdict: verdict,
    feedback_ts: new Date().toISOString(),
  };
  const { error } = await supabase.from('alert_feedback').insert(feedbackData);
  if (error) throw new Error(`Failed to insert feedback: ${error.message}`);
};

// Helper function to refresh the materialized view
const refreshMatView = async () => {
  // Using raw SQL as RPC might require specific setup; ensure it works or create a dedicated function
  const { error } = await supabase.sql`REFRESH MATERIALIZED VIEW public.rule_fp_stats;`;
  if (error) throw new Error(`Failed to refresh materialized view: ${error.message}`);
};

// Test Suite
describe('Risk Score Calculation', () => {
  const testAccountId = `test_acct_${uuidv4()}`;
  let createdAlertIds: string[] = [];

  // Cleanup after all tests in this suite
  afterAll(async () => {
    await cleanup(createdAlertIds, testAccountId);
  });

  test('Initial velocity alert should have a risk score near 60', async () => {
    // Baseline weight for velocity is 30. Formula: 30 * (1-0) * (1-0) * 2 = 60
    const alert = await insertAlert(testAccountId, 'velocity');
    createdAlertIds.push(alert.id);

    // Fetch the alert again to check the score set by the trigger
    const { data: updatedAlert, error } = await supabase
      .from('alerts')
      .select('risk_score')
      .eq('id', alert.id)
      .single();

    expect(error).toBeNull();
    expect(updatedAlert?.risk_score).toBeDefined();
    expect(updatedAlert?.risk_score).toBeCloseTo(60, 0); // Check if it's close to 60
  });

  test('False positive feedback should lower risk score for subsequent alerts of the same type/account', async () => {
    // 1. Insert an initial alert and mark it as false positive
    const firstAlert = await insertAlert(testAccountId, 'bank_swap'); // Baseline weight 40 -> initial score ~80
    createdAlertIds.push(firstAlert.id);
    await insertFeedback(firstAlert.id, 'false_positive');

    // 2. Refresh the materialized view (needed for global impact, but not strictly for this specific test case)
    // await refreshMatView();

    // 3. Insert a *second* alert of the same type for the same account
    const secondAlert = await insertAlert(testAccountId, 'bank_swap');
    createdAlertIds.push(secondAlert.id);

    // 4. Fetch alerts to compare scores
    const { data: alerts, error } = await supabase
      .from('alerts')
      .select('id, risk_score')
      .in('id', [firstAlert.id, secondAlert.id])
      .order('triggered_at');

    expect(error).toBeNull();
    expect(alerts).toHaveLength(2);

    const firstScore = alerts?.find((a) => a.id === firstAlert.id)?.risk_score;
    const secondScore = alerts?.find((a) => a.id === secondAlert.id)?.risk_score;

    console.log('First bank_swap score:', firstScore);
    console.log('Second bank_swap score (after FP):', secondScore);

    expect(firstScore).toBeDefined();
    expect(secondScore).toBeDefined();
    // Expect the second score to be lower due to account_fp_rate (now 1/1 = 1)
    expect(secondScore).toBeLessThan(firstScore!);
    expect(secondScore).toBeCloseTo(0, 0); // Score becomes 0 because acct_fp = 1

    // 5. Insert a third alert to see score with acct_fp = 1/2 = 0.5
    const thirdAlert = await insertAlert(testAccountId, 'bank_swap');
    createdAlertIds.push(thirdAlert.id);

    const { data: thirdAlertData, error: thirdError } = await supabase
      .from('alerts')
      .select('risk_score')
      .eq('id', thirdAlert.id)
      .single();

    expect(thirdError).toBeNull();
    const thirdScore = thirdAlertData?.risk_score;
    console.log('Third bank_swap score (acct_fp=0.5):', thirdScore);
    // Score = 40 * (1 - 0.5) * (1 - global_fp) * 2. Assuming global_fp ~ 0, score ~ 40.
    expect(thirdScore).toBeDefined();
    expect(thirdScore).toBeGreaterThan(0);
    expect(thirdScore).toBeCloseTo(40, 0);
  });

  test('Score should be clamped between 0 and 100', async () => {
    // Test clamping at 100
    // High weight rule (e.g., high_risk_review, weight 50) should start at 100 (50 * 2)
    const highRiskAlert = await insertAlert(testAccountId, 'high_risk_review', 'high');
    createdAlertIds.push(highRiskAlert.id);
    expect(highRiskAlert.risk_score).toBeCloseTo(100, 0);

    // Test clamping at 0 (already covered by the second bank_swap test above where acct_fp=1)
    // Can add an explicit test if needed:
    // Insert alert, mark FP, insert second alert, expect score 0.
  });

  test('Global FP rate should lower score for a different account', async () => {
    const account1 = `test_acct_${uuidv4()}`;
    const account2 = `test_acct_${uuidv4()}`;

    // 1. Account 1: Insert alert and mark FP
    const alert1 = await insertAlert(account1, 'geo_mismatch'); // Weight 25 -> Initial score ~50
    createdAlertIds.push(alert1.id);
    await insertFeedback(alert1.id, 'false_positive');

    // 2. Refresh the materialized view to update global FP rate
    await refreshMatView();

    // 3. Account 2: Insert alert of the same type
    const alert2 = await insertAlert(account2, 'geo_mismatch');
    createdAlertIds.push(alert2.id);

    // 4. Fetch scores
    const { data: fetchedAlert1 } = await supabase
      .from('alerts')
      .select('risk_score')
      .eq('id', alert1.id)
      .single();
    const { data: fetchedAlert2 } = await supabase
      .from('alerts')
      .select('risk_score')
      .eq('id', alert2.id)
      .single();

    const score1 = fetchedAlert1?.risk_score;
    const score2 = fetchedAlert2?.risk_score;

    console.log('Score 1 (Acct1, GeoMismatch, before refresh):', score1); // Should be ~50
    console.log('Score 2 (Acct2, GeoMismatch, after refresh):', score2); // Should be < 50

    expect(score1).toBeDefined();
    expect(score2).toBeDefined();
    // Score2 = 25 * (1 - acct2_fp=0) * (1 - global_fp > 0) * 2. Should be less than Score1.
    expect(score2).toBeLessThan(score1!);

    // Cleanup specific to this test's accounts if needed, or rely on afterAll
    // await cleanup([alert1.id], account1);
    // await cleanup([alert2.id], account2);
  });

  test('Unknown alert type should get default low score', async () => {
    // Default weight 10 -> Score ~20
    const unknownAlert = await insertAlert(testAccountId, 'some_future_alert_type');
    createdAlertIds.push(unknownAlert.id);
    expect(unknownAlert.risk_score).toBeCloseTo(20, 0);
  });

  // TODO: Add more tests:
  // - Test global FP rate impact (requires refreshing view and using a different account)
  // - Test clamping (scores should stay between 0 and 100)
  // - Test different alert types
  // - Test case where rule_fp_stats has no entry for the alert type yet
});
