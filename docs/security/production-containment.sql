-- PROPOSED ONLY. Production authorization required. No business rows are read.
-- Non-destructive temporary guard; do not remove until reviewed replacement RLS exists.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '20s';
do $$
declare t text;
begin
  foreach t in array array['tasks','task_templates','task_attachments','ai_config'] loop
    if to_regclass(format('public.%I',t)) is not null then
      execute format('alter table public.%I enable row level security',t);
      execute format('drop policy if exists security_review_deny_clients on public.%I',t);
      execute format('create policy security_review_deny_clients on public.%I as restrictive for all to public using (false) with check (false)',t);
    end if;
  end loop;
end $$;
update storage.buckets set public=false where id='teacher-attachments';
drop policy if exists security_review_deny_teacher_bucket on storage.objects;
create policy security_review_deny_teacher_bucket on storage.objects as restrictive
for all to public
using (bucket_id <> 'teacher-attachments')
with check (bucket_id <> 'teacher-attachments');
commit;
-- Owners / service_role can bypass RLS. This is not a claim of complete project isolation.
