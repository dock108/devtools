# Guardian Performance Guide

This document covers performance considerations for the Guardian fraud detection system.

## Database Indexes

Guardian relies on efficient database queries to evaluate fraud rules quickly. The following indexes have been created to optimize the most common query patterns:

| Table           | Index                                                              | Purpose                                                                          |
| --------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `event_buffer`  | `event_buffer_acct_time_idx (stripe_account_id, received_at DESC)` | Optimizes lookups of recent events for a specific account                        |
| `payout_events` | `payout_events_acct_time_idx (stripe_account_id, created_at DESC)` | Speeds up queries for recent payout events when evaluating velocity breach rules |
| `alerts`        | `alerts_acct_time_idx (stripe_account_id, created_at DESC)`        | Improves dashboard performance when loading recent alerts for an account         |

These indexes dramatically improve performance for the hot-path queries executed by the rule engine and dashboard.

## Query Performance Analysis

### Analyzing Query Performance

To analyze query performance in Supabase:

1. Connect to your Supabase instance using the SQL Editor
2. Prepend your query with `EXPLAIN ANALYZE` to see the execution plan
3. Look for slow operations like sequential scans (`Seq Scan`) on large tables

Example:

```sql
EXPLAIN ANALYZE
SELECT *
FROM public.event_buffer
WHERE stripe_account_id = 'acct_123'
AND received_at > now() - interval '1 day'
ORDER BY received_at DESC
LIMIT 100;
```

### What to Look For

- **Index Usage**: Ensure queries are using indexes (`Index Scan` instead of `Seq Scan`)
- **Sort Operations**: Watch for expensive sorts that could be avoided with properly indexed columns
- **Execution Time**: Query execution should typically be under 50ms for hot-path operations

## Performance Best Practices

1. **Batch Queries Instead of N+1**: Always fetch related data in a single query rather than multiple round-trips
2. **Use Specific Indexes**: Create indexes for common query patterns with appropriate sort order
3. **Limit Result Sets**: Always include a LIMIT clause for potentially large result sets
4. **Consider Data Archiving**: Implement a TTL (time-to-live) strategy for old data
5. **Monitor Query Times**: Log and alert on slow-running queries (>100ms)

## Performance Testing

Guardian includes performance benchmark tests that verify:

1. Rule evaluation over 5,000 events completes in <50ms
2. Dashboard queries return in <100ms
3. End-to-end webhook processing completes in <500ms

To run these tests locally:

```bash
RUN_PERF_TESTS=true npm test tests/perf.spec.ts
```

## Troubleshooting Slow Queries

If you encounter slow queries:

1. Check if indexes are being used (EXPLAIN ANALYZE)
2. Verify the query is properly constrained (WHERE clauses)
3. Consider adding a more specific index for the query pattern
4. Check if data volume has grown significantly
5. Investigate if the Postgres query planner needs statistics updates (`ANALYZE table_name`)

## Monitoring and Alerting

In production, we monitor:

1. P95 and P99 query latencies for critical paths
2. Database connection pool utilization
3. Index hit rates
4. Slow query logs (>100ms)

Alerts are triggered if performance degrades below acceptable thresholds.
