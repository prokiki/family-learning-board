-- 任务分类：学校任务 / 课外学习
alter table tasks add column if not exists category text not null default 'school';
-- 为查询性能建索引
create index if not exists idx_tasks_category on tasks (board_id, due_date, category);
