import os
import random
from supabase import create_client, Client
from dotenv import load_dotenv
import sys

# Load environment variables
load_dotenv()

# Debugging flag - set to False to reduce log verbosity
DEBUG = os.environ.get("SEED_DEBUG", "0") == "1"

# Supabase credentials
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Optional account whitelist
ACCOUNTS_WHITELIST_STR = os.environ.get("ACCOUNTS_WHITELIST")
ACCOUNTS_WHITELIST = ACCOUNTS_WHITELIST_STR.split(',') if ACCOUNTS_WHITELIST_STR else []

# --- Fraud Scenarios --- 
FRAUD_SCENARIOS = [
    {
        "alert_type": "velocity",  # Changed from 'rule' to match alerts table schema
        "severity": "high",
        "details": "Synthetic: 3 payouts detected in under 30 seconds."
    },
    {
        "alert_type": "bank_swap",  # Changed from 'rule' to match alerts table schema
        "severity": "medium",
        "details": f"Synthetic: New external account ba_{random.randbytes(12).hex()} added."
    },
    {
        "alert_type": "geo_mismatch",  # Changed from 'rule' to match alerts table schema
        "severity": "medium",
        "details": "Synthetic: Charge attempted from IP 191.2.3.4, differs from US account geo."
    }
]

def debug_log(message):
    """Only print debug messages if DEBUG is enabled"""
    if DEBUG:
        print(f"[seed:debug] {message}")

def run_tick():
    """Selects an active account and inserts one random synthetic fraud alert."""
    debug_log(f"Using Supabase URL: {SUPABASE_URL[:20]}...")
    debug_log(f"Service Key Loaded: {bool(SUPABASE_SERVICE_KEY)}")

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("[seed:error] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.", file=sys.stderr)
        sys.exit(1)

    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    except Exception as e:
        print(f"[seed:error] Failed to initialize Supabase client: {e}", file=sys.stderr)
        sys.exit(1)

    # --- Pre-check Whitelisted Account (if applicable) ---
    if ACCOUNTS_WHITELIST and DEBUG:
        debug_log(f"Performing pre-check for whitelisted accounts: {ACCOUNTS_WHITELIST}")
        try:
            # Only select stripe_account_id and status
            pre_check_resp = supabase.table("connected_accounts") \
                .select("stripe_account_id, status") \
                .in_("stripe_account_id", ACCOUNTS_WHITELIST) \
                .execute()
            if pre_check_resp.data:
                for acc in pre_check_resp.data:
                    debug_log(f"Pre-check data for {acc['stripe_account_id']}: status='{acc.get('status')}'")
            else:
                debug_log("Whitelisted account(s) not found in pre-check.")
        except Exception as e:
            debug_log(f"Pre-check query failed: {e}")
    # --- End Pre-check ---

    print("[seed] Fetching active connected accounts...")
    try:
        # Construct the query for active accounts
        query = supabase.table("connected_accounts") \
            .select("stripe_account_id") \
            .eq("status", "active")  # Filter by status = active
        
        applied_filters = ["status='active'"]
        if ACCOUNTS_WHITELIST:
            print(f"[seed] Filtering by whitelist: {ACCOUNTS_WHITELIST}")
            # Apply whitelist filter if provided
            query = query.in_("stripe_account_id", ACCOUNTS_WHITELIST)
            applied_filters.append(f"stripe_account_id IN {ACCOUNTS_WHITELIST}")
        
        debug_log(f"Applying filters: {', '.join(applied_filters)}")
        response = query.execute()
        debug_log(f"Query response data count: {len(response.data) if response.data else 0}")

        if not response.data:
            print("[seed:warning] No active connected accounts found matching criteria.")
            return  # Exit gracefully if no accounts match

        eligible_accounts = [account['stripe_account_id'] for account in response.data]
        print(f"[seed] Found {len(eligible_accounts)} eligible accounts: {eligible_accounts}")

    except Exception as e:
        print(f"[seed:error] Failed to query connected_accounts: {e}", file=sys.stderr)
        sys.exit(1)

    # 1. Select target account
    target_account_id = random.choice(eligible_accounts)
    print(f"[seed] Selected account: {target_account_id}")

    # 2. Choose fraud scenario
    scenario = random.choice(FRAUD_SCENARIOS)
    # Refresh dynamic details if bank_swap (for unique bank account ID)
    if scenario['alert_type'] == 'bank_swap':
        scenario['details'] = f"Synthetic: New external account ba_{random.randbytes(12).hex()} added."
    print(f"[seed] Chosen scenario: {scenario['alert_type']} ({scenario['severity']})")

    # 3. Insert alert row using known schema
    try:
        print("[seed] Inserting alert into Supabase...")
        
        # Use the confirmed schema for alerts table
        insert_data = {
            "stripe_account_id": target_account_id,
            "alert_type": scenario['alert_type'],
            "severity": scenario['severity'],
            "resolved": False
            # Note: If you later need to add a message/details column,
            # uncomment this and add the correct column name
            # "description": scenario['details']
        }
        
        debug_log(f"Inserting with data: {insert_data}")
        insert_response = supabase.table("alerts").insert(insert_data).execute()
        
        # Check if the insert operation was successful
        if not insert_response.data:
            raise Exception("Insert operation returned no data, potential failure.")
        
        # Log the new alert ID
        inserted_alert_id = insert_response.data[0].get('id', 'N/A')
        print(f"[seed] Alert inserted: acct={target_account_id}, type={scenario['alert_type']}, severity={scenario['severity']}, id={inserted_alert_id}")
            
    except Exception as e:
        print(f"[seed:error] Failed to insert alert: {e}", file=sys.stderr)
        # Exit with error code if insertion fails
        sys.exit(1)

if __name__ == "__main__":
    print("[seed] Starting minimal Supabase seeder tick...")
    run_tick()
    print("[seed] Seeder tick finished.") 