import { createClient } from '@supabase/supabase-js';
import { log } from '@/lib/logger';

// --- Types --- (Define expected config structure)
type RuleConfig = Record<string, any>; // Define more specific type if possible

interface CacheEntry {
  config: RuleConfig;
  fetchedAt: number;
}

// --- Constants ---
const DEFAULT_RULE_SET_NAME = 'default';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// --- Cache ---
const configCache = new Map<string, CacheEntry>();

// --- Supabase Client (Admin for server-side fetching) ---
// Ensure client is only created once if possible, or manage connections.
let supabaseAdminClient: ReturnType<typeof createClient> | null = null;
const getSupabaseAdmin = () => {
  if (!supabaseAdminClient) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      log.error(
        { service: 'getRuleConfig' },
        'Supabase URL or Service Key is missing for admin client.',
      );
      throw new Error('Supabase admin client not configured.');
    }
    supabaseAdminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
  return supabaseAdminClient;
};

// --- Fetcher Logic ---
async function fetchRuleConfigFromDb(accountId: string | null): Promise<RuleConfig | null> {
  const supabase = getSupabaseAdmin();
  let ruleSetConfig: RuleConfig | null = null;

  try {
    if (accountId) {
      // 1. Try fetching the config linked to the specific account
      const { data: accountData, error: accountError } = await supabase
        .from('connected_accounts')
        .select(
          `
          rule_sets (
            config
          )
        `,
        )
        .eq('stripe_account_id', accountId)
        .maybeSingle();

      if (accountError) {
        log.warn(
          { service: 'getRuleConfig', accountId, err: accountError.message },
          'Error fetching rule set for account',
        );
      } else if (accountData?.rule_sets?.config) {
        log.debug({ service: 'getRuleConfig', accountId }, 'Found custom rule set for account');
        ruleSetConfig = accountData.rule_sets.config as RuleConfig;
      }
    }

    // 2. If no account-specific config found, fetch the default config
    if (!ruleSetConfig) {
      const { data: defaultData, error: defaultError } = await supabase
        .from('rule_sets')
        .select('config')
        .eq('name', DEFAULT_RULE_SET_NAME)
        .single();

      if (defaultError) {
        log.error(
          { service: 'getRuleConfig', err: defaultError.message },
          'Error fetching default rule set',
        );
        // Potentially return a hardcoded default as ultimate fallback?
        return null;
      } else if (defaultData?.config) {
        log.debug(
          { service: 'getRuleConfig', accountId: accountId ?? 'N/A' },
          'Using default rule set',
        );
        ruleSetConfig = defaultData.config as RuleConfig;
      }
    }
  } catch (error: any) {
    log.error(
      { service: 'getRuleConfig', accountId, err: error.message },
      'Exception fetching rule config',
    );
    return null;
  }

  return ruleSetConfig;
}

/**
 * Retrieves the rule configuration for a given Stripe account ID.
 * Fetches from the database and uses a time-based in-memory cache.
 * Falls back to the 'default' rule set if no specific set is linked
 * or if the account ID is null.
 *
 * @param accountId - The Stripe account ID (e.g., acct_...). Can be null.
 * @returns The rule configuration object, or null if fetching fails entirely.
 */
export const getRuleConfig = async (accountId: string | null): Promise<RuleConfig | null> => {
  const cacheKey = accountId || DEFAULT_RULE_SET_NAME; // Use default name as key for null accountId
  const now = Date.now();

  // Check cache
  const cachedEntry = configCache.get(cacheKey);
  if (cachedEntry && now - cachedEntry.fetchedAt < CACHE_TTL_MS) {
    log.debug(
      { service: 'getRuleConfig', accountId, cache: 'hit' },
      'Returning cached rule config',
    );
    return cachedEntry.config;
  }

  // Fetch from DB
  log.debug({ service: 'getRuleConfig', accountId, cache: 'miss' }, 'Fetching rule config from DB');
  const fetchedConfig = await fetchRuleConfigFromDb(accountId);

  if (fetchedConfig) {
    // Update cache
    configCache.set(cacheKey, { config: fetchedConfig, fetchedAt: now });
    // Add default cache entry if fetched for null accountId
    if (!accountId) {
      configCache.set(DEFAULT_RULE_SET_NAME, { config: fetchedConfig, fetchedAt: now });
    }
    return fetchedConfig;
  } else {
    // If fetch failed, potentially return stale cache data if available?
    if (cachedEntry) {
      log.warn(
        { service: 'getRuleConfig', accountId },
        'DB fetch failed, returning stale cache data',
      );
      return cachedEntry.config;
    }
    log.error(
      { service: 'getRuleConfig', accountId },
      'Failed to fetch rule config and no cache available',
    );
    return null; // Indicate failure
  }
};

// Function to clear the cache (for testing or manual refresh)
export const clearRuleConfigCache = () => {
  configCache.clear();
  log.info({ service: 'getRuleConfig' }, 'Rule config cache cleared.');
};
