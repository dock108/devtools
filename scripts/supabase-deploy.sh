#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_PROJECT_REF:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Supabase env vars missing; skipping migration push." >&2
  exit 0
fi

echo "🔗  Linking to Supabase project…"
supabase link --project-ref "$SUPABASE_PROJECT_REF" \
               --password "$SUPABASE_SERVICE_ROLE_KEY"

echo "⬆️   Pushing migrations…"
supabase db push

echo "✅  Supabase migrations applied" 