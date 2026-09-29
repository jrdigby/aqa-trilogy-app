-- Pre-launch security hardening (2026-09-29)
-- 1) AI mark gate: continued-access + question access + sliding-window rate limits
-- 2) Fix mutable search_path on advisor-flagged functions
-- 3) Revoke anon EXECUTE on SECURITY DEFINER RPCs (keep authenticated where clients need them)

-- ---------------------------------------------------------------------------
-- Rate-limit log for mark-long-answer (counts attempted Gemini invokes)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_mark_request_log (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid references public.questions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ai_mark_request_log_user_created_idx
  on public.ai_mark_request_log (user_id, created_at desc);

alter table public.ai_mark_request_log enable row level security;

-- No client insert/update. Developers may SELECT for ops (same pattern as ai_usage_events).
drop policy if exists ai_mark_request_log_developer_select on public.ai_mark_request_log;
create policy ai_mark_request_log_developer_select on public.ai_mark_request_log
  for select to authenticated
  using (public.is_developer());

comment on table public.ai_mark_request_log is
  'Per-user AI mark attempt log for sliding-window rate limits. Written by try_begin_ai_mark.';

-- ---------------------------------------------------------------------------
-- try_begin_ai_mark: access + rate limit before Gemini
-- Limits: 40 / hour, 120 / calendar day (UTC) — abuse throttle for any authenticated caller
-- (incl. in-trial). Not a trial-vs-pro feature gate.
-- ---------------------------------------------------------------------------
create or replace function public.try_begin_ai_mark(
  p_question_id uuid,
  p_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_caller uuid := auth.uid();
  v_hour int;
  v_day int;
  constant_hour_limit int := 40;
  constant_day_limit int := 120;
begin
  -- Authenticated JWT callers may only act as themselves; service_role has auth.uid() null.
  if v_caller is not null and v_caller is distinct from v_uid then
    return jsonb_build_object('allowed', false, 'reason', 'not_authorized');
  end if;

  if v_uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  end if;

  if p_question_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'missing_question_id');
  end if;

  -- Continued full access (active trial OR paid / Pilot Pro / class / developer).
  if not public.user_has_pro_access(v_uid) then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'subscription_required',
      'has_access', false
    );
  end if;

  -- Prefer session/attempt/developer access — blocks arbitrary UUID burn via service role.
  if not public.user_can_access_question(p_question_id, v_uid) then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'not_in_session',
      'has_access', true
    );
  end if;

  select count(*)::int into v_hour
  from public.ai_mark_request_log
  where user_id = v_uid
    and created_at > now() - interval '1 hour';

  if v_hour >= constant_hour_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'window', 'hour',
      'used', v_hour,
      'limit', constant_hour_limit
    );
  end if;

  select count(*)::int into v_day
  from public.ai_mark_request_log
  where user_id = v_uid
    and created_at >= (timezone('utc', now())::date)::timestamptz;

  if v_day >= constant_day_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'window', 'day',
      'used', v_day,
      'limit', constant_day_limit
    );
  end if;

  insert into public.ai_mark_request_log (user_id, question_id)
  values (v_uid, p_question_id);

  return jsonb_build_object(
    'allowed', true,
    'has_access', true,
    'hour_used', v_hour + 1,
    'hour_limit', constant_hour_limit,
    'day_used', v_day + 1,
    'day_limit', constant_day_limit
  );
end;
$$;

revoke all on function public.try_begin_ai_mark(uuid, uuid) from public;
revoke all on function public.try_begin_ai_mark(uuid, uuid) from anon;
grant execute on function public.try_begin_ai_mark(uuid, uuid) to authenticated;
grant execute on function public.try_begin_ai_mark(uuid, uuid) to service_role;

comment on function public.try_begin_ai_mark(uuid, uuid) is
  'Gate for mark-long-answer: continued-access check, question access, and per-user rate limits before Gemini.';

-- ---------------------------------------------------------------------------
-- Fix mutable search_path (advisor: function_search_path_mutable)
-- ---------------------------------------------------------------------------
alter function public.profiles_role_immutable() set search_path = public;
alter function public.tier_array_for_label(text) set search_path = public;
alter function public.bulk_import_full_question(uuid, text, text, jsonb, smallint, text, jsonb, text, jsonb, jsonb) set search_path = public;
alter function public.generate_join_code() set search_path = public;
alter function public._expert_query_summarise_key(text, jsonb) set search_path = public;
alter function public._expert_query_summarise_response(jsonb) set search_path = public;
alter function public.science_subjects_valid(jsonb) set search_path = public;
alter function public._expert_pretty_number(text) set search_path = public;
alter function public._expert_step_text(jsonb) set search_path = public;
alter function public.cross_board_equiv_set_updated_at() set search_path = public;

-- ---------------------------------------------------------------------------
-- Revoke anon EXECUTE on SECURITY DEFINER RPCs
-- Re-grant authenticated (and service_role where Edge needs it) for client RPCs.
-- Trigger-only helpers: no authenticated grant.
-- ---------------------------------------------------------------------------

-- Helper macro pattern repeated per signature:

revoke all on function public.build_weekly_progress_report(uuid, date) from public;
revoke all on function public.build_weekly_progress_report(uuid, date) from anon;
grant execute on function public.build_weekly_progress_report(uuid, date) to authenticated;
grant execute on function public.build_weekly_progress_report(uuid, date) to service_role;

revoke all on function public.bulk_import_full_question(uuid, text, text, jsonb, smallint, text, jsonb, text, jsonb, jsonb) from public;
revoke all on function public.bulk_import_full_question(uuid, text, text, jsonb, smallint, text, jsonb, text, jsonb, jsonb) from anon;
grant execute on function public.bulk_import_full_question(uuid, text, text, jsonb, smallint, text, jsonb, text, jsonb, jsonb) to authenticated;
grant execute on function public.bulk_import_full_question(uuid, text, text, jsonb, smallint, text, jsonb, text, jsonb, jsonb) to service_role;

revoke all on function public.claim_xp_milestone(text) from public;
revoke all on function public.claim_xp_milestone(text) from anon;
grant execute on function public.claim_xp_milestone(text) to authenticated;

revoke all on function public.consume_streak_freeze() from public;
revoke all on function public.consume_streak_freeze() from anon;
grant execute on function public.consume_streak_freeze() to authenticated;

revoke all on function public.developer_ai_usage_summary(integer) from public;
revoke all on function public.developer_ai_usage_summary(integer) from anon;
grant execute on function public.developer_ai_usage_summary(integer) to authenticated;

revoke all on function public.developer_ai_usage_summary_range(date, date) from public;
revoke all on function public.developer_ai_usage_summary_range(date, date) from anon;
grant execute on function public.developer_ai_usage_summary_range(date, date) to authenticated;

revoke all on function public.developer_expert_query_open_count() from public;
revoke all on function public.developer_expert_query_open_count() from anon;
grant execute on function public.developer_expert_query_open_count() to authenticated;

revoke all on function public.developer_list_expert_queries(text, integer, integer) from public;
revoke all on function public.developer_list_expert_queries(text, integer, integer) from anon;
grant execute on function public.developer_list_expert_queries(text, integer, integer) to authenticated;

revoke all on function public.developer_list_student_access() from public;
revoke all on function public.developer_list_student_access() from anon;
grant execute on function public.developer_list_student_access() to authenticated;

revoke all on function public.developer_reply_expert_query(uuid, text, text) from public;
revoke all on function public.developer_reply_expert_query(uuid, text, text) from anon;
grant execute on function public.developer_reply_expert_query(uuid, text, text) to authenticated;

revoke all on function public.developer_set_subscription_bulk(uuid[], text) from public;
revoke all on function public.developer_set_subscription_bulk(uuid[], text) from anon;
grant execute on function public.developer_set_subscription_bulk(uuid[], text) to authenticated;

revoke all on function public.developer_set_subscription_by_email(text, text) from public;
revoke all on function public.developer_set_subscription_by_email(text, text) from anon;
grant execute on function public.developer_set_subscription_by_email(text, text) to authenticated;
grant execute on function public.developer_set_subscription_by_email(text, text) to service_role;

revoke all on function public.developer_upsert_cross_board_equiv(jsonb) from public;
revoke all on function public.developer_upsert_cross_board_equiv(jsonb) from anon;
grant execute on function public.developer_upsert_cross_board_equiv(jsonb) to authenticated;

revoke all on function public.developer_upsert_question_bundle(jsonb) from public;
revoke all on function public.developer_upsert_question_bundle(jsonb) from anon;
grant execute on function public.developer_upsert_question_bundle(jsonb) to authenticated;

revoke all on function public.discover_country(text) from public;
revoke all on function public.discover_country(text) from anon;
grant execute on function public.discover_country(text) to authenticated;

revoke all on function public.filter_accessible_question_ids(uuid[]) from public;
revoke all on function public.filter_accessible_question_ids(uuid[]) from anon;
grant execute on function public.filter_accessible_question_ids(uuid[]) to authenticated;
grant execute on function public.filter_accessible_question_ids(uuid[]) to service_role;

revoke all on function public.get_plan_quotas() from public;
revoke all on function public.get_plan_quotas() from anon;
grant execute on function public.get_plan_quotas() to authenticated;
grant execute on function public.get_plan_quotas() to service_role;

-- Trigger-only: revoke from clients entirely
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;
grant execute on function public.handle_new_user() to service_role;

revoke all on function public.handle_new_user_profile() from public;
revoke all on function public.handle_new_user_profile() from anon;
revoke all on function public.handle_new_user_profile() from authenticated;
grant execute on function public.handle_new_user_profile() to service_role;

revoke all on function public.increment_user_xp(integer) from public;
revoke all on function public.increment_user_xp(integer) from anon;
grant execute on function public.increment_user_xp(integer) to authenticated;
grant execute on function public.increment_user_xp(integer) to service_role;

revoke all on function public.insert_srs_seed_rows(jsonb) from public;
revoke all on function public.insert_srs_seed_rows(jsonb) from anon;
grant execute on function public.insert_srs_seed_rows(jsonb) to authenticated;
grant execute on function public.insert_srs_seed_rows(jsonb) to service_role;

revoke all on function public.is_developer() from public;
revoke all on function public.is_developer() from anon;
grant execute on function public.is_developer() to authenticated;
grant execute on function public.is_developer() to service_role;

revoke all on function public.is_enrolled_in_class(uuid) from public;
revoke all on function public.is_enrolled_in_class(uuid) from anon;
grant execute on function public.is_enrolled_in_class(uuid) to authenticated;
grant execute on function public.is_enrolled_in_class(uuid) to service_role;

revoke all on function public.join_class_by_code(text) from public;
revoke all on function public.join_class_by_code(text) from anon;
grant execute on function public.join_class_by_code(text) to authenticated;
grant execute on function public.join_class_by_code(text) to service_role;

revoke all on function public.list_question_coverage(uuid[], text[]) from public;
revoke all on function public.list_question_coverage(uuid[], text[]) from anon;
grant execute on function public.list_question_coverage(uuid[], text[]) to authenticated;

revoke all on function public.list_question_meta_by_ids(uuid[]) from public;
revoke all on function public.list_question_meta_by_ids(uuid[]) from anon;
grant execute on function public.list_question_meta_by_ids(uuid[]) to authenticated;

revoke all on function public.list_question_pool_meta(uuid[], text[], text) from public;
revoke all on function public.list_question_pool_meta(uuid[], text[], text) from anon;
grant execute on function public.list_question_pool_meta(uuid[], text[], text) to authenticated;

revoke all on function public.mark_expert_query_seen(uuid) from public;
revoke all on function public.mark_expert_query_seen(uuid) from anon;
grant execute on function public.mark_expert_query_seen(uuid) to authenticated;

revoke all on function public.migrate_srs_for_track_change(text) from public;
revoke all on function public.migrate_srs_for_track_change(text) from anon;
grant execute on function public.migrate_srs_for_track_change(text) to authenticated;
grant execute on function public.migrate_srs_for_track_change(text) to service_role;

revoke all on function public.open_practice_session(uuid[], text) from public;
revoke all on function public.open_practice_session(uuid[], text) from anon;
grant execute on function public.open_practice_session(uuid[], text) to authenticated;

revoke all on function public.record_question_ingestion(jsonb) from public;
revoke all on function public.record_question_ingestion(jsonb) from anon;
grant execute on function public.record_question_ingestion(jsonb) to authenticated;

revoke all on function public.resolve_cross_board_equiv_fks(text, text) from public;
revoke all on function public.resolve_cross_board_equiv_fks(text, text) from anon;
grant execute on function public.resolve_cross_board_equiv_fks(text, text) to authenticated;

revoke all on function public.rls_auto_enable() from public;
revoke all on function public.rls_auto_enable() from anon;
revoke all on function public.rls_auto_enable() from authenticated;

revoke all on function public.seed_initial_srs() from public;
revoke all on function public.seed_initial_srs() from anon;
grant execute on function public.seed_initial_srs() to authenticated;
grant execute on function public.seed_initial_srs() to service_role;

revoke all on function public.set_expert_query_archived(uuid, boolean) from public;
revoke all on function public.set_expert_query_archived(uuid, boolean) from anon;
grant execute on function public.set_expert_query_archived(uuid, boolean) to authenticated;

revoke all on function public.set_expert_query_feedback(uuid, text) from public;
revoke all on function public.set_expert_query_feedback(uuid, text) from anon;
grant execute on function public.set_expert_query_feedback(uuid, text) to authenticated;

revoke all on function public.submit_expert_query(uuid, text, text, uuid, jsonb) from public;
revoke all on function public.submit_expert_query(uuid, text, text, uuid, jsonb) from anon;
grant execute on function public.submit_expert_query(uuid, text, text, uuid, jsonb) to authenticated;

revoke all on function public.sync_question_skills(uuid, uuid[]) from public;
revoke all on function public.sync_question_skills(uuid, uuid[]) from anon;
grant execute on function public.sync_question_skills(uuid, uuid[]) to authenticated;
grant execute on function public.sync_question_skills(uuid, uuid[]) to service_role;

revoke all on function public.try_consume_ai_mark() from public;
revoke all on function public.try_consume_ai_mark() from anon;
grant execute on function public.try_consume_ai_mark() to authenticated;
grant execute on function public.try_consume_ai_mark() to service_role;

revoke all on function public.try_consume_half_paper() from public;
revoke all on function public.try_consume_half_paper() from anon;
grant execute on function public.try_consume_half_paper() to authenticated;
grant execute on function public.try_consume_half_paper() to service_role;

revoke all on function public.user_can_access_question(uuid, uuid) from public;
revoke all on function public.user_can_access_question(uuid, uuid) from anon;
grant execute on function public.user_can_access_question(uuid, uuid) to authenticated;
grant execute on function public.user_can_access_question(uuid, uuid) to service_role;

revoke all on function public.user_has_pro_access(uuid) from public;
revoke all on function public.user_has_pro_access(uuid) from anon;
grant execute on function public.user_has_pro_access(uuid) to authenticated;
grant execute on function public.user_has_pro_access(uuid) to service_role;

-- Internal / trigger helpers also flagged via default PUBLIC grants
revoke all on function public.generate_join_code() from public;
revoke all on function public.generate_join_code() from anon;
revoke all on function public.generate_join_code() from authenticated;
grant execute on function public.generate_join_code() to service_role;

revoke all on function public.profiles_role_immutable() from public;
revoke all on function public.profiles_role_immutable() from anon;
revoke all on function public.profiles_role_immutable() from authenticated;
grant execute on function public.profiles_role_immutable() to service_role;

revoke all on function public.cross_board_equiv_set_updated_at() from public;
revoke all on function public.cross_board_equiv_set_updated_at() from anon;
revoke all on function public.cross_board_equiv_set_updated_at() from authenticated;
grant execute on function public.cross_board_equiv_set_updated_at() to service_role;

revoke all on function public._expert_query_summarise_key(text, jsonb) from public;
revoke all on function public._expert_query_summarise_key(text, jsonb) from anon;
revoke all on function public._expert_query_summarise_key(text, jsonb) from authenticated;

revoke all on function public._expert_query_summarise_response(jsonb) from public;
revoke all on function public._expert_query_summarise_response(jsonb) from anon;
revoke all on function public._expert_query_summarise_response(jsonb) from authenticated;

revoke all on function public._expert_pretty_number(text) from public;
revoke all on function public._expert_pretty_number(text) from anon;
revoke all on function public._expert_pretty_number(text) from authenticated;

revoke all on function public._expert_step_text(jsonb) from public;
revoke all on function public._expert_step_text(jsonb) from anon;
revoke all on function public._expert_step_text(jsonb) from authenticated;

revoke all on function public.tier_array_for_label(text) from public;
revoke all on function public.tier_array_for_label(text) from anon;
-- Used inside other RPCs as SECURITY DEFINER owner; client grant optional
grant execute on function public.tier_array_for_label(text) to authenticated;
grant execute on function public.tier_array_for_label(text) to service_role;

revoke all on function public.science_subjects_valid(jsonb) from public;
revoke all on function public.science_subjects_valid(jsonb) from anon;
grant execute on function public.science_subjects_valid(jsonb) to authenticated;
grant execute on function public.science_subjects_valid(jsonb) to service_role;
