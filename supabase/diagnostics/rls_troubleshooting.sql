-- Run in Supabase SQL Editor (or via MCP execute_sql) after connecting Cursor to Supabase.
-- Project: cbycwfhczyvzzhthpgsw

-- ---------------------------------------------------------------------------
-- A. Applied migrations (Supabase CLI tracking; empty if migrations were pasted manually)
-- ---------------------------------------------------------------------------
select version, name
from supabase_migrations.schema_migrations
order by version;

-- ---------------------------------------------------------------------------
-- B. RLS policies on srs_state and profiles
-- ---------------------------------------------------------------------------
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where tablename in ('srs_state', 'profiles')
order by tablename, policyname;

-- Expected on srs_state for students:
--   srs_state_select_own, srs_state_insert_own, srs_state_update_own (authenticated, user_id = auth.uid())

-- ---------------------------------------------------------------------------
-- C. RPC functions used by the app
-- ---------------------------------------------------------------------------
select p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on p.pronamespace = n.oid
where n.nspname = 'public'
  and p.proname in (
    'insert_srs_seed_rows',
    'seed_initial_srs',
    'join_class_by_code',
    'handle_new_user'
  )
order by p.proname;

-- insert_srs_seed_rows and seed_initial_srs should both exist.

-- ---------------------------------------------------------------------------
-- D. SRS data for test student
-- ---------------------------------------------------------------------------
select count(*) as srs_rows,
       count(*) filter (where due_date <= current_date) as due_today
from srs_state
where user_id = '9fc2a526-72de-431b-819d-f754cb40a51a';

-- If this shows 12 / 3 but the browser shows 0 due, the issue is client JWT (auth), not missing data.

-- ---------------------------------------------------------------------------
-- E. RLS enabled flags
-- ---------------------------------------------------------------------------
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('srs_state', 'profiles', 'attempts', 'classes')
order by c.relname;
