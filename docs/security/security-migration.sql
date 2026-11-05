-- REVIEW DRAFT ONLY. Run against an isolated test database first.
-- Production requires approved project mapping, schema comparison and backup.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
create table public.board_members (
  board_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('parent','child')),
  primary key (board_id,user_id)
);
alter table public.board_members enable row level security;
revoke all on public.board_members from anon, authenticated;
grant select on public.board_members to authenticated;
create policy member_self on public.board_members for select to authenticated using (user_id = (select auth.uid()));

-- Fail closed on unexpected policies: do not silently remove unrelated policies.
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename in ('tasks','task_templates','task_attachments','ai_config') and policyname not in ('mvp public access','mvp public access templates','mvp public access attachments','Allow all for ai_config','security_review_deny_clients')) then
    raise exception 'Unexpected policies: manual review required';
  end if;
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname not in ('public teacher attachments read','public teacher attachments insert','public teacher attachments update','public teacher attachments delete','security_review_deny_teacher_bucket')) then
    raise exception 'Unexpected storage policies: manual review required';
  end if;
  if exists (
    select 1 from pg_policies p
    where p.schemaname='public' and p.tablename in ('tasks','task_templates','task_attachments','ai_config')
      and p.policyname<>'security_review_deny_clients'
      and not (p.permissive='PERMISSIVE' and p.cmd='ALL' and p.roles=array['public']::name[]
        and p.qual='true' and p.with_check='true'
        and (p.tablename,p.policyname) in (('tasks','mvp public access'),
          ('task_templates','mvp public access templates'),('task_attachments','mvp public access attachments'),
          ('ai_config','Allow all for ai_config')))
  ) then raise exception 'Altered baseline policies: manual review required'; end if;
  if exists (
    select 1 from pg_policies p where p.schemaname='storage' and p.tablename='objects'
      and p.policyname<>'security_review_deny_teacher_bucket'
      and not (p.permissive='PERMISSIVE' and p.roles=array['public']::name[]
        and (p.policyname,p.cmd) in (('public teacher attachments read','SELECT'),
          ('public teacher attachments insert','INSERT'),('public teacher attachments update','UPDATE'),
          ('public teacher attachments delete','DELETE'))
        and p.qual is not distinct from case when p.cmd='INSERT' then null else $guard$(bucket_id = 'teacher-attachments'::text)$guard$ end
        and p.with_check is not distinct from case when p.cmd in ('INSERT','UPDATE') then $guard$(bucket_id = 'teacher-attachments'::text)$guard$ else null end)
  ) then raise exception 'Altered baseline storage policies: manual review required'; end if;
  -- Accept either the original baseline or the complete, reviewed containment.
  -- Names alone are insufficient: reject incomplete or altered guards.
  if exists (select 1 from pg_policies where
      (schemaname='public' and tablename in ('tasks','task_templates','task_attachments','ai_config') and policyname='security_review_deny_clients')
      or (schemaname='storage' and tablename='objects' and policyname='security_review_deny_teacher_bucket')) then
    if (select count(*) from pg_policies where schemaname='public'
        and tablename in ('tasks','task_templates','task_attachments','ai_config')
        and policyname='security_review_deny_clients' and permissive='RESTRICTIVE'
        and cmd='ALL' and roles=array['public']::name[] and qual='false' and with_check='false') <> 4
      or (select count(*) from pg_policies where schemaname='storage' and tablename='objects'
        and policyname='security_review_deny_teacher_bucket' and permissive='RESTRICTIVE'
        and cmd='ALL' and roles=array['public']::name[]
        and qual=$guard$(bucket_id <> 'teacher-attachments'::text)$guard$
        and with_check=$guard$(bucket_id <> 'teacher-attachments'::text)$guard$) <> 1
      or not exists(select 1 from storage.buckets where id='teacher-attachments' and public=false)
      or exists(select 1 from pg_class where oid in ('public.tasks'::regclass,'public.task_templates'::regclass,
          'public.task_attachments'::regclass,'public.ai_config'::regclass,'storage.objects'::regclass) and not relrowsecurity)
    then raise exception 'Incomplete or altered containment: manual review required'; end if;
  end if;
end $$;
drop policy if exists "mvp public access" on public.tasks;
drop policy if exists "mvp public access templates" on public.task_templates;
drop policy if exists "mvp public access attachments" on public.task_attachments;
drop policy if exists "Allow all for ai_config" on public.ai_config;
alter table public.tasks enable row level security;
alter table public.task_templates enable row level security;
alter table public.task_attachments enable row level security;
alter table public.ai_config enable row level security;
revoke all on public.tasks, public.task_templates, public.task_attachments, public.ai_config from anon, authenticated;
grant select,insert,update,delete on public.tasks, public.task_templates, public.task_attachments to authenticated;
-- ai_config deliberately has no browser grants or policies. Old secrets retained
-- inaccessible until separately approved cleanup, never selected by the app.

create policy task_member_read on public.tasks for select to authenticated using (
  exists(select 1 from public.board_members m where m.board_id=tasks.board_id and m.user_id=auth.uid())
);
create policy task_parent_all on public.tasks for all to authenticated using (
  exists(select 1 from public.board_members m where m.board_id=tasks.board_id and m.user_id=auth.uid() and m.role='parent')
) with check (
  exists(select 1 from public.board_members m where m.board_id=tasks.board_id and m.user_id=auth.uid() and m.role='parent')
);
create policy task_child_insert on public.tasks for insert to authenticated with check (
  category='extra' and source='manual' and status='pending' and last_updated_by='child' and template_id is null
  and exists(select 1 from public.board_members m where m.board_id=tasks.board_id and m.user_id=auth.uid() and m.role='child')
);
create policy task_child_update on public.tasks for update to authenticated using (
  status <> 'confirmed_by_parent' and exists(select 1 from public.board_members m where m.board_id=tasks.board_id and m.user_id=auth.uid() and m.role='child')
) with check (
  status in ('pending','in_progress','done_by_child','needs_help') and last_updated_by='child'
  and exists(select 1 from public.board_members m where m.board_id=tasks.board_id and m.user_id=auth.uid() and m.role='child')
);
-- RLS limits rows; this invoker trigger also limits columns and old/new transitions.
create function public.enforce_task_actor() returns trigger language plpgsql security invoker set search_path='' as $$
declare actor text;
begin
  select m.role into actor from public.board_members m where m.board_id=new.board_id and m.user_id=auth.uid();
  if actor is null then raise exception 'No membership'; end if;
  if TG_OP='UPDATE' and (new.board_id<>old.board_id or new.id<>old.id or new.created_at<>old.created_at) then raise exception 'Immutable task identity'; end if;
  if actor='child' and TG_OP='UPDATE' then
    if old.status='confirmed_by_parent' or new.status='confirmed_by_parent' then raise exception 'Parent confirmation required'; end if;
    if (to_jsonb(new)-array['status','last_updated_by','updated_at']) is distinct from (to_jsonb(old)-array['status','last_updated_by','updated_at']) then raise exception 'Child may only update status'; end if;
  end if;
  new.last_updated_by:=actor;
  return new;
end $$;
revoke all on function public.enforce_task_actor() from public;
create trigger enforce_task_actor before insert or update on public.tasks for each row execute function public.enforce_task_actor();

create policy template_parent on public.task_templates for all to authenticated using (
  exists(select 1 from public.board_members m where m.board_id=task_templates.board_id and m.user_id=auth.uid() and m.role='parent')
) with check (
  exists(select 1 from public.board_members m where m.board_id=task_templates.board_id and m.user_id=auth.uid() and m.role='parent')
);
create policy attachment_read on public.task_attachments for select to authenticated using (
  exists(select 1 from public.board_members m where m.board_id=task_attachments.board_id and m.user_id=auth.uid() and (m.role='parent' or (visible_to_child and task_attachments.role<>'parent_only')))
);
create policy attachment_parent on public.task_attachments for all to authenticated using (
  exists(select 1 from public.board_members m where m.board_id=task_attachments.board_id and m.user_id=auth.uid() and m.role='parent')
) with check (
  split_part(storage_path,'/',1)=board_id and exists(select 1 from public.board_members m where m.board_id=task_attachments.board_id and m.user_id=auth.uid() and m.role='parent')
);

update storage.buckets set public=false, file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp'] where id='teacher-attachments';
drop policy if exists "public teacher attachments read" on storage.objects;
drop policy if exists "public teacher attachments insert" on storage.objects;
drop policy if exists "public teacher attachments update" on storage.objects;
drop policy if exists "public teacher attachments delete" on storage.objects;
-- Inspect ALL other storage.objects policies before deployment: permissive policies OR together.
create policy teacher_private_read on storage.objects for select to authenticated using (
  bucket_id='teacher-attachments' and (
    exists(select 1 from public.board_members m where m.board_id=split_part(name,'/',1) and m.user_id=auth.uid() and m.role='parent')
    or exists(select 1 from public.task_attachments a where a.storage_path=name and a.visible_to_child and a.role<>'parent_only')
  )
);
create policy teacher_parent_insert on storage.objects for insert to authenticated with check (
  bucket_id='teacher-attachments' and exists(select 1 from public.board_members m where m.board_id=split_part(name,'/',1) and m.user_id=auth.uid() and m.role='parent')
);
create policy teacher_parent_delete on storage.objects for delete to authenticated using (
  bucket_id='teacher-attachments' and exists(select 1 from public.board_members m where m.board_id=split_part(name,'/',1) and m.user_id=auth.uid() and m.role='parent')
);
-- Replacement uses a new object path; no UPDATE permission on objects.

create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create table private.ai_quota (
  user_id uuid primary key references auth.users(id) on delete cascade,
  minute_start timestamptz not null, minute_count int not null,
  day_start date not null, day_count int not null
);
alter table private.ai_quota enable row level security;
-- Intentional narrow privileged function: no arguments, identity from verified JWT,
-- static SQL, fixed search_path, no data returned, execute only for authenticated.
create function private.consume_ai_quota() returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); n timestamptz:=clock_timestamp(); today date:=(clock_timestamp() at time zone 'UTC')::date; q private.ai_quota;
begin
  if uid is null or not exists(select 1 from public.board_members where user_id=uid) then return false; end if;
  insert into private.ai_quota values(uid,n,0,today,0) on conflict(user_id) do nothing;
  select * into q from private.ai_quota where user_id=uid for update;
  if q.minute_start <= n-interval '1 minute' then q.minute_start:=n; q.minute_count:=0; end if;
  if q.day_start<>today then q.day_start:=today; q.day_count:=0; end if;
  if q.minute_count>=6 or q.day_count>=40 then return false; end if;
  update private.ai_quota set minute_start=q.minute_start, minute_count=q.minute_count+1, day_start=q.day_start, day_count=q.day_count+1 where user_id=uid;
  return true;
end $$;
revoke all on function private.consume_ai_quota() from public,anon;
grant execute on function private.consume_ai_quota() to authenticated;
grant usage on schema private to authenticated;
create function public.consume_ai_quota() returns boolean language sql security invoker set search_path='' as $$ select private.consume_ai_quota() $$;
revoke all on function public.consume_ai_quota() from public,anon;
grant execute on function public.consume_ai_quota() to authenticated;
alter function public.set_updated_at() set search_path = '';
-- Final handoff: all new policies and grants exist before temporary guards go.
-- No intermediate state is committed. Failure rolls back the entire migration.
drop policy if exists security_review_deny_clients on public.tasks;
drop policy if exists security_review_deny_clients on public.task_templates;
drop policy if exists security_review_deny_clients on public.task_attachments;
drop policy if exists security_review_deny_clients on public.ai_config;
drop policy if exists security_review_deny_teacher_bucket on storage.objects;
commit;
