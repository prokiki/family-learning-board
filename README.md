# 家庭学习看板

面向三年级孩子与家长的家庭作业协同 Web App。

当前仓库包含一个可运行、可部署的 MVP：

- 家长端创建和管理今日任务
- 孩子端查看今日任务并更新状态
- 家长端实时同步看到状态变化
- 支持把老师作业文本拆分后导入任务
- 支持“每天固定任务”模板并一键加入当天任务

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase
- Vercel

## 环境变量

先复制模板文件：

```bash
cp .env.example .env.local
```

`.env.local` 需要填写：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_public_client_key
NEXT_PUBLIC_DEFAULT_BOARD_ID=family-demo
```

说明：

- `NEXT_PUBLIC_SUPABASE_URL`：Supabase 项目的 Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`：前端公开 key，可使用 anon public key 或新版 publishable key
- `NEXT_PUBLIC_DEFAULT_BOARD_ID`：家长端和孩子端共享的看板 ID，默认可使用 `family-demo`

## Supabase 初始化

### 1. 创建项目

在 Supabase 控制台创建一个新项目。

### 2. 执行 migrations

按顺序在 Supabase `SQL Editor` 中执行以下文件：

1. [001_init_tasks.sql](supabase/migrations/001_init_tasks.sql)
2. [002_add_subject_to_tasks.sql](supabase/migrations/002_add_subject_to_tasks.sql)
3. [003_add_task_templates.sql](supabase/migrations/003_add_task_templates.sql)
4. [004_harden_tasks_schema.sql](supabase/migrations/004_harden_tasks_schema.sql)
5. [005_add_task_attachments.sql](supabase/migrations/005_add_task_attachments.sql)

这些 migration 会创建或补齐：

- `public.tasks`
- `public.task_templates`
- `public.task_attachments`
- `task_status` enum
- `subject` 字段
- `template_id` 字段
- `updated_at` trigger
- RLS policy
- 常用索引与基础约束
- `teacher-attachments` storage bucket 与公开读写策略

### 3. 建议执行后的快速检查

可以在 SQL Editor 中运行以下 SQL 确认表结构已就绪：

```sql
select * from public.tasks limit 1;
select * from public.task_templates limit 1;
select * from public.task_attachments limit 1;
```

## 本地启动

1. 安装依赖

```bash
npm install
```

2. 配置 `.env.local`

参考上面的环境变量说明填写 Supabase URL 和公开 key。

3. 启动开发环境

```bash
npm run dev
```

4. 打开页面

- 首页：`http://localhost:3000`
- 家长端：`http://localhost:3000/parent`
- 孩子端：`http://localhost:3000/child`

如果 3000 端口被占用，请以终端输出的实际端口为准。

## 本地验收建议

建议至少验证以下流程：

1. 家长端新增任务
2. 孩子端能立即看到新增任务
3. 孩子端更新状态
4. 家长端实时同步看到状态变化
5. 刷新 `/parent` 和 `/child` 后数据仍然存在
6. 家长端导入老师作业文本，确认能按学科拆分
7. 家长端固定任务模板可保存并一键加入当天任务
8. 家长端上传老师图片资料，确认不会生成独立任务
9. 孩子端在对应学科下点击“查看参考图片”可以打开弹层
10. `parent_only` 或 `visible_to_child = false` 的图片不会出现在孩子端

## 数据模型概览

### tasks

核心字段：

- `board_id`: 家庭或设备对应的看板标识
- `due_date`: 日期维度，MVP 按天管理
- `subject`: 学科信息，用于导入分组和孩子端展示
- `template_id`: 固定任务模板来源 ID，可为空
- `title`: 任务标题
- `details`: 任务说明
- `status`: `pending` / `in_progress` / `done_by_child` / `needs_help` / `confirmed_by_parent`
- `source`: `manual` / `imported` / `template`
- `last_updated_by`: `parent` / `child`

### task_templates

核心字段：

- `board_id`: 看板标识
- `subject`: 学科
- `title`: 模板标题
- `details`: 模板备注
- `is_active`: 是否启用
- `sort_order`: 模板排序

### task_attachments

老师图片资料附件，独立于任务本体，不参与任务状态流转。

核心字段：

- `board_id`: 看板标识
- `due_date`: 日期维度
- `subject`: 学科归属
- `storage_path`: Supabase Storage 路径
- `public_url`: 图片公开地址
- `note`: 家长补充的一句说明
- `role`: `reference` / `instruction` / `parent_only`
- `visible_to_child`: 是否显示给孩子端
- `sort_order`: 同一学科下的图片顺序

## 部署到 Vercel

1. 将代码推送到 GitHub
2. 在 Vercel 中导入该仓库
3. 在 Vercel 项目设置中配置以下环境变量：

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_DEFAULT_BOARD_ID=family-demo
```

4. 触发部署

部署完成后，建议做一轮线上验收：

- `/parent` 新增任务
- `/child` 查看任务
- `/child` 更新状态
- `/parent` 确认实时同步
- 刷新后数据持久化正常
- `/parent` 上传老师图片资料
- `/child` 在对应学科下查看参考图片弹层

## 常用命令

```bash
npm run dev
npm run lint
npm run build
```

## 项目结构

- `src/app`：路由与页面
- `src/components`：家长端与孩子端核心界面
- `src/lib`：Supabase、日期、任务拆分等基础能力
- `src/types`：领域类型
- `supabase/migrations`：数据库初始化与补充迁移

## 说明

本次 README 和 migration 补全只针对基础工程可部署性，不改变现有 UI 与交互逻辑。
