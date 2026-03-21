-- AI 人设描述字段
alter table ai_config add column if not exists soul text not null default '';
