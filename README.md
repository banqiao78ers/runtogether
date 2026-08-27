# 板橋約跑（runtogether）

板橋跑友揪團約跑 Progressive Web App。規格見 [`banqiao_running_pwa_spec.md`](./banqiao_running_pwa_spec.md)。

## 技術棧

- Next.js (App Router) + PWA
- Vercel 部署 + [cron-job.org](https://cron-job.org) 每小時排程（`/api/cron/tick`）
- 共用 Supabase：`https://epmfustvktuqwppwgezt.supabase.co`（表前綴 `pwa_`）

## 上線前必做

1. 在 Supabase SQL Editor 依序執行 [`001_pwa_schema.sql`](./supabase/migrations/001_pwa_schema.sql)、[`002_host_follows.sql`](./supabase/migrations/002_host_follows.sql)、[`003_run_reminders.sql`](./supabase/migrations/003_run_reminders.sql)（已執行過的可略過）
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
3. Deploy，並設定 `CRON_SECRET`（見下方「定時任務」）

## 定時任務（cron-job.org）

開跑提醒與 48h 自動結案由外部 Cron 每小時呼叫 `GET /api/cron/tick`（Hobby 無法用 Vercel 內建高頻 Cron）。

1. 產生密鑰（至少 16 字元），加入 Vercel Environment Variables：`CRON_SECRET`
2. 至 [cron-job.org](https://console.cron-job.org) 新增 Cronjob：
   - **URL**：`https://<你的網域>/api/cron/tick`（與 `NEXT_PUBLIC_APP_URL` 相同）
   - **Schedule**：每小時（例如 `0 * * * *`）
   - **Request method**：GET
   - **Request headers**（擇一）：
     - `Authorization`：`Bearer <CRON_SECRET>`
     - 或 `x-cron-secret`：`<CRON_SECRET>`
3. 儲存後按 **Run now** 測試；成功時 HTTP 200，body 類似 `{"reminders_1d":0,...}`

## 主要路由

| 路徑 | 說明 |
|------|------|
| `/` | 活動列表 |
| `/runs/new` | 開團 |
| `/runs/[id]` | 詳情／報名／留言 |
| `/me` | 個人與推播 |
| `/admin/*` | 地點／角色／申訴 |
| `/api/cron/tick` | 開跑提醒＋48h 自動結案 |
