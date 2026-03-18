create index if not exists idx_tasks_board_due_date
on public.tasks (board_id, due_date);

create index if not exists idx_tasks_template_id
on public.tasks (template_id)
where template_id is not null;

create index if not exists idx_task_templates_board_active
on public.task_templates (board_id, is_active, sort_order);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_template_id_fkey'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
    add constraint tasks_template_id_fkey
    foreign key (template_id)
    references public.task_templates(id)
    on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_source_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
    add constraint tasks_source_check
    check (source in ('manual', 'imported', 'template'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_last_updated_by_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
    add constraint tasks_last_updated_by_check
    check (last_updated_by in ('parent', 'child'));
  end if;
end
$$;
