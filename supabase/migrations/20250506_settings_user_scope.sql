-- 1. Remove mistaken account_id if migration B was applied earlier
alter table if exists settings
  drop column if exists account_id;

-- 2. Add user_id column (nullable) and ensure it's not unique
alter table settings
  add column if not exists user_id uuid references auth.users(id);
alter table settings drop constraint if exists settings_user_id_key; -- Remove unique constraint if present

-- 3. Remove logic related to global_settings row
-- -- Ensure the global settings row exists (UPSERT or INSERT IGNORE)
-- -- INSERT INTO settings ...

-- 4. Drop previous RLS policies if they exist
drop policy if exists "Owner can read/write" on settings;
drop policy if exists "Admins can read/write global settings" on settings;
drop policy if exists "Users can read/write their own settings" on settings;

-- 5. Enable row-level security (if not already enabled)
alter table settings enable row level security;

-- 6. Create RLS policy for user-specific settings
create policy "Users can manage their own settings" on settings
  for all -- Grants SELECT, INSERT, UPDATE, DELETE
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id ); 