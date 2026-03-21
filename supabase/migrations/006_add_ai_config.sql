-- AI 服务配置表
-- 每个 board 可以独立配置 AI 服务商和模型
create table if not exists ai_config (
  id uuid primary key default gen_random_uuid(),
  board_id text not null,
  provider text not null default 'openai',      -- openai / anthropic / deepseek / zhipu / qwen
  api_key text not null default '',              -- 加密存储（前端传入时已脱敏显示）
  model text not null default 'gpt-4o-mini',    -- 当前选中的模型
  is_active boolean not null default true,       -- 是否启用
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id)
);

-- RLS 策略
alter table ai_config enable row level security;

create policy "Allow all for ai_config"
  on ai_config for all
  using (true)
  with check (true);
