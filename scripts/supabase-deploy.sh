#!/usr/bin/env bash
set -euo pipefail

# Skip Supabase migrations in Vercel builds - we now apply them locally only
echo "🗸  Supabase migrations already applied via local workflow."
echo "   We no longer run 'supabase db push' during Vercel builds."
echo "   See README.md → Deploy checklist for migration workflow."

# Always exit with success so the build continues
exit 0 