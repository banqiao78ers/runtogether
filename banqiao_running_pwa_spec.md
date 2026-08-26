# 板橋約跑 PWA 系統開發規格書 (PRD & System Architecture Spec)

> 本文件整合全階段需求拷問 (`/grill-me`) 達成之最終共識，作為資料庫遷移 (Migration)、後端 API (Next.js App Router) 與前端 PWA 實作之唯一技術基準。

---

## 1. 系統架構與環境邊界

* **前端形態**：Next.js + Progressive Web App (PWA)。
* **部署平台**：Vercel。
* **程式碼倉庫**：https://github.com/banqiao78ers/runtogether.git
* **共用資料庫架構**：
  * 與既有系統共用同一個 Supabase 實體資料庫：https://epmfustvktuqwppwgezt.supabase.co
  * **隔離原則**：本專案所有新建資料表、觸發器與視圖一律強制使用 `pwa_` 前綴（如 `pwa_users`、`pwa_runs`），絕不修改既有系統資料表結構。
* **身分驗證 & 權限初始化**：
  * 於相同 LINE Developers Provider 下建立獨立 Login Channel（確保品牌獨立且 LINE UID 一致）。
  * 首次登入時，後端即時比對既有系統舊會員表；命中者直接初始化為 `super_member`，未命中者為 `member`。
  * **登入容錯機制**：若比對舊會員表逾時或異常，直接阻斷登入並提示稍後重試，避免身分誤判。
  * **Session 管理**：採用長效 HttpOnly Cookie（30 天效期 + 每次活動自動滑動續期）。
* **推播機制 (Web Push API)**：
  * 獨立 VAPID Key 簽發，不與其他專案混用。
  * 單一裝置覆蓋制（Single Active Device），收到 `410 Gone` 回應時後端自動清空該用戶之 `push_subscription`。
  * 推播發送採非同步背景執行（Fire-and-forget），API 秒級響應。

---

## 2. 角色權限矩陣 (RBAC)

| 功能維度 / 權限項目 | 一般會員 (Member) | 超級成員 (Super Member) | 系統管理員 (Admin) |
| :--- | :--- | :--- | :--- |
| **開團地區範圍** | 強制鎖定板橋區（選取後台固定點） | 全台自由選點 / 自訂地點文字 | 全台自由選點 / 自訂地點文字 |
| **取消開團懲罰** | 1 個月累計 3 次惡意取消自動停權 | **完全豁免懲罰**（不觸發檢舉投票） | **完全豁免懲罰** |
| **加入揪團** | 支援（受主揪黑名單阻擋） | 支援（受主揪黑名單阻擋） | 支援 |
| **集合點清單管理** | 唯讀選取 | 唯讀選取 | 新增 / 編輯 / 刪除 |
| **留言管理權限** | 僅可刪除個人留言 | 僅可刪除個人留言（若為主揪可刪該團留言） | 可刪除全站任何留言 |
| **停權申訴審核** | 僅被停權時可提交申訴 | 無 | 審核核准 / 駁回 |

---

## 3. 核心業務流程與防呆邏輯規格

### 3.1 首次登入引導 (Onboarding)
* 所有用戶（含新舊成員）首次登入完成後，若 `pace_min` 或 `pace_max` 為空，Middleware 強制攔截導向 `/onboarding/preference` 填寫配速偏好。

### 3.2 開團與修改限制 (Host Rules)
* **防呆重疊限制**：同一用戶在已有活動的時間區間內，嚴禁同時發起或報名其他時段重疊的約跑活動。
* **資訊鎖定**：開團成功後，集合時間與地點強制鎖定不可竄改。若有變動僅能發起即時延期廣播（上限 2 次，每次最多 30 分鐘，累計最多 60 分鐘），或取消活動重開。
* **主揪不克出席**：主揪無法單獨取消報名，必須選擇「取消整場活動」並填寫原因，系統立即非同步推播通知所有報名者。

### 3.3 報名與防併發機制 (Registration & Concurrency)
* **先搶先贏無候補**：額滿即鎖定報名按鈕，不設候補佇列（Waitlist）。若有人取消報名，名額立即釋出。
* **高併發防護 (Race Condition)**：報名 API 透過 Supabase RPC / 條件寫入鎖定（Atomic Check），當只剩最後 1 個名額且多人同時提交時，後進請求直接回傳 HTTP 409（名額已被搶走），杜絕超額報名。
* **取消報名時間**：起跑前隨時可於 PWA 點擊取消報名。

### 3.4 Web Push 推播與配速過濾引擎
* **開團通知匹配演算法**：
  採用嚴格區間交集（Overlap Algorithm）匹配推播受眾：
  `pwa_users.pace_min <= run.pace_max AND pwa_users.pace_max >= run.pace_min`
  （自動排除主揪本人與已關閉通知之用戶）。
* **開跑前提醒排程**：定時任務依剩餘時間門檻，向已報名者發送開跑提醒（各送一次）：
  * 一天前：`start_time - now ≤ 24h` 且尚未進入六小時內 → `reminder_1d_sent_at`
  * 六小時前：`≤ 6h` → `reminder_6h_sent_at`
  * 一小時前：`≤ 1h` → `start_reminder_sent_at`
  （Vercel Hobby Cron 每日一次；門檻採「進入時段即補送」，以降低漏送。若需準點六小時／一小時，需更高頻 Cron。）
* **推播點擊與喚醒**：Service Worker 監聽點擊事件，背景視窗喚醒 `focus()` 並精準導向該活動詳細頁 `/runs/[id]`，自動觸發 SWR 重新拉取最新狀態。

### 3.5 現場簽到、結案與留言
* **現場報到**：採信任制手動回報，跑友抵達集合點後點擊「我已到達」（`arrived`）。
* **結案防呆**：活動結束後發送推播提醒主揪點名結案。若超過 48 小時主揪未處理，系統排程定時自動將活動狀態設為 `completed`，並將所有報名者標記為正常出席。
* **活動留言板**：僅限該團主揪與已報名成員發言，設有 5 秒送出冷卻防刷機制；支援軟刪除（`deleted_at`）。
* **歷史資料保存**：所有活動與參與紀錄採軟刪除（Soft Delete），永久保留供個人主頁里程/出席率統計與管理稽核。

---

## 4. 資料庫實體關聯設計 (Supabase DDL / Schema)

```sql
-- 1. 會員主表
CREATE TABLE pwa_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_uid VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'super_member', 'admin')),
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  pace_min INT, -- 秒/公里，如 300 表示 5:00/km
  pace_max INT, -- 秒/公里，如 330 表示 5:30/km
  push_subscription JSONB, -- 單一裝置推播訂閱物件
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 集合地點表 (後台管理)
CREATE TABLE pwa_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city VARCHAR(50) NOT NULL DEFAULT '新北市',
  district VARCHAR(50) NOT NULL DEFAULT '板橋區',
  title VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 約跑活動主表
CREATE TABLE pwa_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE RESTRICT,
  location_id UUID REFERENCES pwa_locations(id) ON DELETE SET NULL,
  custom_location VARCHAR(150), -- 超級成員自訂地點
  location_detail VARCHAR(255), -- 詳細集合備註 (如：3號出口石獅子前)
  destination VARCHAR(150), -- 終點/折返點
  start_time TIMESTAMPTZ NOT NULL,
  estimated_duration_minutes INT NOT NULL DEFAULT 60,
  distance_km NUMERIC(5, 2) NOT NULL,
  pace_min INT NOT NULL,
  pace_max INT NOT NULL,
  max_participants INT NOT NULL DEFAULT 10,
  note TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'delayed', 'ongoing', 'completed', 'cancelled')),
  delay_count INT NOT NULL DEFAULT 0 CHECK (delay_count <= 2),
  total_delayed_minutes INT NOT NULL DEFAULT 0 CHECK (total_delayed_minutes <= 60),
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 4. 報名與出席紀錄表
CREATE TABLE pwa_run_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES pwa_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'arrived', 'attended', 'cancelled', 'no_show')),
  arrived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_run_user UNIQUE (run_id, user_id)
);

-- 5. 活動專屬留言板表
CREATE TABLE pwa_run_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES pwa_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE RESTRICT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 6. 主揪黑名單表
CREATE TABLE pwa_host_blocklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_host_blocked UNIQUE (host_id, blocked_user_id)
);

-- 6b. 追蹤主揪（開團推播略過配速過濾）
CREATE TABLE pwa_host_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_follower_host UNIQUE (follower_id, host_id),
  CONSTRAINT chk_not_self_follow CHECK (follower_id <> host_id)
);

-- 7. 惡意取消檢舉投票表
CREATE TABLE pwa_run_cancellation_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES pwa_runs(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE RESTRICT,
  is_malicious BOOLEAN NOT NULL DEFAULT TRUE,
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_run_voter UNIQUE (run_id, voter_id)
);

-- 8. 停權申訴工單表
CREATE TABLE pwa_penalty_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES pwa_users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
