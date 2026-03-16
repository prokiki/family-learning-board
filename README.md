# 家庭学习看板

面向三年级孩子与家长的家庭作业协同 Web App，当前是可运行的 MVP：

- 家长端创建和管理今日任务
- 孩子端查看今日任务并更新状态
- 家长端实时同步看到状态变化
- 支持把老师作业文本拆分后导入任务

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase
- Vercel

## 本地启动

1. 安装依赖

```bash
npm install
```

2. 复制环境变量

```bash
cp .env.example .env.local
```

3. 在 Supabase 项目中执行 [supabase/migrations/001_init_tasks.sql](/Users/yuan/Documents/Playground/supabase/migrations/001_init_tasks.sql)

4. 填写 `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Supabase anon key
NEXT_PUBLIC_DEFAULT_BOARD_ID=family-demo
```

5. 启动开发环境

```bash
npm run dev
```

## 页面说明

- `/` 产品入口页
- `/parent` 家长管理端
- `/child` 孩子使用端

## 当前数据模型

`tasks` 表核心字段：

- `board_id`: 家庭或设备对应的看板标识
- `due_date`: 日期维度，MVP 按天管理
- `title`: 任务标题
- `details`: 任务说明
- `status`: `pending` / `in_progress` / `done_by_child` / `needs_help` / `confirmed_by_parent`
- `source`: `manual` / `imported`

## 结构设计

- `src/app` 路由与页面
- `src/components` 家长端与孩子端核心界面
- `src/lib` Supabase、日期、任务拆分等基础能力
- `src/types` 领域类型
- `supabase/migrations` 数据库初始化 SQL

## 后续建议

- OCR 导入和图片上传
- 奖励与激励系统
- 家长确认后的消息提示
- 更稳妥的权限模型与家庭成员隔离
