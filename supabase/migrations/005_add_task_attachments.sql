create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  board_id text not null default 'family-demo',
  due_date date not null,
  subject text,
  storage_path text not null,
  public_url text not null,
  note text,
  role text not null default 'reference',
  visible_to_child boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_task_attachments_board_due_date_subject
on public.task_attachments (board_id, due_date, subject, sort_order);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_attachments_role_check'
      and conrelid = 'public.task_attachments'::regclass
  ) then
    alter table public.task_attachments
    add constraint task_attachments_role_check
    check (role in ('reference', 'instruction', 'parent_only'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_attachments_parent_only_visibility_check'
      and conrelid = 'public.task_attachments'::regclass
  ) then
    alter table public.task_attachments
    add constraint task_attachments_parent_only_visibility_check
    check (role <> 'parent_only' or visible_to_child = false);
  end if;
end
$$;

drop trigger if exists set_task_attachments_updated_at on public.task_attachments;
create trigger set_task_attachments_updated_at
before update on public.task_attachments
for each row
execute function public.set_updated_at();

alter table public.task_attachments enable row level security;

drop policy if exists "mvp public access attachments" on public.task_attachments;
create policy "mvp public access attachments"
on public.task_attachments
for all
using (true)
with check (true);

alter table public.task_attachments replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.task_attachments;
exception
  when duplicate_object then null;
end
$$;

insert into storage.buckets (id, name, public)
values ('teacher-attachments', 'teacher-attachments', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "public teacher attachments read" on storage.objects;
create policy "public teacher attachments read"
on storage.objects
for select
using (bucket_id = 'teacher-attachments');

drop policy if exists "public teacher attachments insert" on storage.objects;
create policy "public teacher attachments insert"
on storage.objects
for insert
with check (bucket_id = 'teacher-attachments');

drop policy if exists "public teacher attachments update" on storage.objects;
create policy "public teacher attachments update"
on storage.objects
for update
using (bucket_id = 'teacher-attachments')
with check (bucket_id = 'teacher-attachments');

drop policy if exists "public teacher attachments delete" on storage.objects;
create policy "public teacher attachments delete"
on storage.objects
for delete
using (bucket_id = 'teacher-attachments');
