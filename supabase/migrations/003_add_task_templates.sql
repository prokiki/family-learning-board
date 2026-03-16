alter table public.tasks
add column if not exists template_id uuid;

create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  board_id text not null default 'family-demo',
  subject text,
  title text not null,
  details text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_task_templates_updated_at on public.task_templates;
create trigger set_task_templates_updated_at
before update on public.task_templates
for each row
execute function public.set_updated_at();

alter table public.task_templates enable row level security;

drop policy if exists "mvp public access templates" on public.task_templates;
create policy "mvp public access templates"
on public.task_templates
for all
using (true)
with check (true);
