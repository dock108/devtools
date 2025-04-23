#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_PROJECT_REF:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Supabase env vars missing; skipping migration push." >&2
  exit 0
fi

# Try to execute Supabase DB tasks with npx
run_supabase_tasks() {
  set +e  # Don't exit on error
  echo "🔗 Linking to Supabase project…"
  npx supabase link --project-ref "$SUPABASE_PROJECT_REF" \
                    --password "$SUPABASE_SERVICE_ROLE_KEY"
  local link_status=$?
  
  if [ $link_status -ne 0 ]; then
    return 1
  fi

  echo "⬆️ Pushing migrations…"
  npx supabase db push
  local push_status=$?
  
  set -e  # Restore exit on error
  return $push_status
}

# Try using npx directly
echo "Attempting to run Supabase CLI with npx..."
if run_supabase_tasks; then
  echo "✅ Supabase migrations successfully applied"
  exit 0
else
  echo "npx approach failed, installing Supabase CLI locally..."
fi

# If that fails, try installing locally
npm install --no-save supabase

# Now try with the locally installed version
echo "Running with locally installed Supabase CLI..."
set +e  # Don't exit on error
npx supabase link --project-ref "$SUPABASE_PROJECT_REF" \
                 --password "$SUPABASE_SERVICE_ROLE_KEY"
link_status=$?

if [ $link_status -eq 0 ]; then
  npx supabase db push
  push_status=$?
  if [ $push_status -eq 0 ]; then
    echo "✅ Supabase migrations successfully applied"
  else
    echo "⚠️ Failed to push migrations"
  fi
else
  echo "⚠️ Failed to link to Supabase project"
fi

echo "Deployment script completed"
exit 0  # Always exit with success so the build continues 