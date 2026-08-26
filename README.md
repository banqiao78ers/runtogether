# 板橋約跑（runtogether）

板橋跑友揪團約跑 Progressive Web App。規格見 [`banqiao_running_pwa_spec.md`](./banqiao_running_pwa_spec.md)。

## 技術棧

- Next.js (App Router) + PWA
- Vercel 部署 + Cron（`/api/cron/tick`；Hobby 限每日一次，見 `vercel.json`）
- 共用 Supabase：`https://epmfustvktuqwppwgezt.supabase.co`（表前綴 `pwa_`）

## 上線前必做

1. 在 Supabase SQL Editor 執行 [`supabase/migrations/001_pwa_schema.sql`](./supabase/migrations/001_pwa_schema.sql)；若尚未建追蹤表，再執行 [`002_host_follows.sql`](./supabase/migrations/002_host_follows.sql)
2. 複製 `.env.example` → `.env.local`（與 Vercel Environment Variables）填入金鑰
3. 第一位 admin：於 DB 手動 `UPDATE pwa_users SET role='admin' WHERE ...`，之後可用後台升格
4. 舊會員升格採**規則 C**：對照 `profiles` 顯示名稱，於 `/admin/users` 手動設為 `super_member`

## 本機開發

```bash
npm install
cp .env.example .env.local
npm run dev
```

## 連結 Vercel

1. Import `banqiao78ers/runtogether`
2. 填入環境變數
3. Deploy（Cron 會依 `vercel.json` 註冊）

## 主要路由

| 路徑 | 說明 |
|------|------|
| `/` | 活動列表 |
| `/runs/new` | 開團 |
| `/runs/[id]` | 詳情／報名／留言 |
| `/me` | 個人與推播 |
| `/admin/*` | 地點／角色／申訴 |
| `/api/cron/tick` | 開跑提醒＋48h 自動結案 |
