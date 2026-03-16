create extension if not exists pgcrypto;

create type public.task_status as enum (
  'pending',
  'in_progress',
  'done_by_child',
  'needs_help',
  'confirmed_by_parent'
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  board_id text not null default 'family-demo',
  due_date date not null,
  title text not null,
  details text,
  status public.task_status not null default 'pending',
  sort_order integer not null default 0,
  source text not null default 'manual',
  last_updated_by text not null default 'parent',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

alter table public.tasks enable row level security;

drop policy if exists "mvp public access" on public.tasks;
create policy "mvp public access"
on public.tasks
for all
using (true)
with check (true);

alter table public.tasks replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception
  when duplicate_object then null;
end
$$;
