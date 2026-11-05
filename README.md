# 家庭学习看板

Next.js + Supabase 的家庭任务、学习资料和 AI 辅助工具。

> 本地安全修复版本，尚未上线。旧生产部署保持暂停。不要只发布前端而跳过数据库权限迁移。

## 身份与权限

使用 Supabase Auth 的邮箱/密码登录，关闭公开注册和匿名登录。家长在后台配置账号，并在 `board_members` 绑定看板及 `parent` / `child` 角色。成员关系不可由客户端编辑。当前登录页面向每个账号一个看板。

浏览器会话由 Supabase SDK 保存、续期；应用 API 使用 Bearer token，并通过 Auth 服务验证用户、查询数据库成员关系。页面入口的校验只是界面控制，真实权限由 API 与数据库 RLS 执行。退出登录可清除该设备会话。共用设备请退出后切换账号。

孩子可读本家庭任务、修改未获家长确认的任务状态、添加课外任务。模板、图片管理和家长确认操作仅家长可用。附件采用私有桶和五分钟签名地址；标记为仅家长可见的附件在数据库及 Storage 两层受限。

## 配置

公开变量：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`（项目公开客户端 key）。

仅服务端变量：`AI_PROVIDER`、`AI_MODEL`、`AI_API_KEY`、可选 `AI_SOUL`。OpenAI 配置兼容 `OPENAI_API_KEY`。禁止使用 `NEXT_PUBLIC_` 前缀存储秘密。网页不接收、读取或显示 Key。应用不再需要 service_role。图片生成仅允许 OpenAI 配置。

每账号 AI 限额：每分钟6次、每天40次（UTC日界，所有 AI 接口合计；失败调用也计数）。一次图片请求可能生成四张图，限额不等于金额预算；上线前还应设置服务商项目预算。登录限速由 Supabase Auth 提供，上线前核实其配置。

## 本地开发与验证

```
npm ci
npm run test:security
npm run lint
npx tsc --noEmit
npm run build
npm run dev
```

安全测试使用本地 PGlite/Postgres 引擎及模拟 HTTP，不连接生产数据库或收费 AI。

## 数据库与上线

旧的001—008迁移仅保留历史。新的权限 SQL 审核草案在 [docs/security/security-migration.sql](docs/security/security-migration.sql)，不自动执行。正式迁移文件需在上线前使用 Supabase CLI 生成，并纳入部署审核。

详细操作、验证限制及回滚见 [安全修复说明](docs/security/REVIEW.md)。
