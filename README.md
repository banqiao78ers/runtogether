# 板橋約跑（runtogether）

板橋跑友揪團約跑 Progressive Web App。規格見 [`banqiao_running_pwa_spec.md`](./banqiao_running_pwa_spec.md)。

## 技術棧

- Next.js (App Router) + PWA
- Vercel 部署
- 共用 Supabase：`https://epmfustvktuqwppwgezt.supabase.co`（表前綴 `pwa_`）

## 本機開發

```bash
npm install
cp .env.example .env.local
npm run dev
```

## 連結 Vercel

1. 開啟 [Vercel New Project](https://vercel.com/new)
2. Import GitHub repo：`banqiao78ers/runtogether`
3. Framework Preset 選 **Next.js**（自動偵測）
4. 在 Environment Variables 貼上 `.env.example` 對應金鑰
5. Deploy

或一鍵：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/banqiao78ers/runtogether)

## 腳本

| 指令 | 說明 |
|------|------|
| `npm run dev` | 本機開發 |
| `npm run build` | 生產建置 |
| `npm run start` | 啟動生產伺服器 |
| `npm run lint` | ESLint |
