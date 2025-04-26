#!/usr/bin/env python3
"""
Helper script to apply the event_buffer migration to a local Supabase instance.
- Applies the migration SQL
- Sets up pg_cron
- Prints environment variable suggestions
"""

import os
import subprocess
import sys

# Default TTL in days
DEFAULT_TTL_DAYS = 30

def run_command(cmd, capture_output=True):
    """Run a shell command and return the output."""
    try:
        result = subprocess.run(
            cmd, 
            shell=True, 
            check=True, 
            text=True,
            capture_output=capture_output
        )
        return result.stdout if capture_output else None
    except subprocess.CalledProcessError as e:
        print(f"Error executing command: {cmd}")
        print(f"Error output: {e.stderr}")
        sys.exit(1)

def main():
    print("Applying event_buffer migration...")
    
    # Check if Supabase CLI is installed
    try:
        run_command("supabase --version", capture_output=False)
        use_supabase_cli = True
    except Exception:
        use_supabase_cli = False
        print("Supabase CLI not found, falling back to psql...")
    
    migration_file = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "supabase/migrations/20250426_event_buffer.sql"
    )
    
    if not os.path.exists(migration_file):
        print(f"Migration file not found: {migration_file}")
        sys.exit(1)
    
    # Apply migration
    if use_supabase_cli:
        print("Using Supabase CLI to apply migration...")
        run_command("supabase db reset", capture_output=False)
    else:
        # Alternative using psql directly
        print("Using psql to apply migration...")
        db_url = os.environ.get("DATABASE_URL")
        if not db_url:
            print("DATABASE_URL environment variable not set.")
            print("Please set it or use Supabase CLI.")
            sys.exit(1)
        
        run_command(f"psql {db_url} -f {migration_file}", capture_output=False)
    
    print("\n✅ Migration applied successfully!")
    
    # Print environment variable suggestions
    print("\n" + "=" * 50)
    print("ENVIRONMENT VARIABLES")
    print("=" * 50)
    print("Add to .env (not in repo!):")
    print(f"EVENT_BUFFER_TTL_DAYS={DEFAULT_TTL_DAYS}")
    print("\nNote: This controls how long events are kept in the buffer.")
    print("      Default is 30 days if not specified.")
    print("=" * 50)

if __name__ == "__main__":
    main() 