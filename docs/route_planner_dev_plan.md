# BQ揪跑 × 路跑路線規劃 — 開發計畫書

> **使用方式**：把本文件全文貼到 `BQ揪跑` 專案的 Cursor 對話框當開場任務。  
> **目標**：在既有約跑 PWA 內新增「地圖路線規劃」，服務開團與個人練跑，資料以 OpenStreetMap 為主。

---

## 0. 給 Agent 的開場指令（請一併執行）

請閱讀並遵守本計畫書，在既有專案 `runtogether`（板橋約跑 PWA）內實作「路跑路線規劃」功能。

開始前請先：

1. 閱讀 `banqiao_running_pwa_spec.md`、`README.md`、`AGENTS.md`
2. 閱讀 `node_modules/next/dist/docs/`（本專案 Next.js 版本與訓練資料不同）
3. 檢視現有開團頁 `src/app/runs/new/page.tsx`、地點 API、`pwa_locations`、`BottomNav`
4. **不要破壞**既有揪團、LINE 登入、推播、RBAC、`pwa_` 表前綴隔離
5. 先做 Phase 1 MVP，完成後再往下；每個 Phase 結束給可驗證清單

技術棧現況：Next.js App Router + React + Tailwind + Supabase（`pwa_`）+ Vercel + PWA。

---

## 1. 背景與動機

參考 [On The Go Map](https://onthegomap.com) 的使用情境：在陌生城市／本地用地圖點選規劃路跑、貼路算距離。

BQ揪跑現況缺口：

- 開團時 `distance_km` 靠手動填，無地圖驗證
- 集合點是文字清單（`pwa_locations`），無經緯度地圖
- 無法產出可分享／可匯出的實際路線（GPX）
- 跑友到外地或新路線時，缺少「定位 → 畫線 → 算距離」工具

本功能要補上：**定位、貼路規劃、距離／爬升、路況偏好、適合跑的環境圖層**，並與開團流程串接。

---

## 2. 產品定位

不做另一個完整 On The Go Map，而是：

> **打開 → 定位（或選集合點）→ 選目標距離 → 畫線／建議路線 → 看距離與爬升 → 匯出或帶回開團表單**

與約跑系統的關係：

| 場景 | 行為 |
|------|------|
| 開團前規劃 | `/routes/plan` 畫好路線 →「套用到開團」帶入距離、終點摘要、可選 GPX／路線 ID |
| 個人練跑 | 獨立使用規劃器，不需開團 |
| 活動詳情 | 若該團有綁定路線，顯示地圖預覽與距離（後期） |

---

## 3. 資料來源說明（重要）

### 3.1 主要用 OpenStreetMap（不必另購跑步資料庫）

| 能力 | OSM 是否足夠 | 實作介面 |
|------|--------------|----------|
| 底圖顯示 | ✅ | MapLibre GL 或 Leaflet + OSM／第三方圖磚 |
| 貼路步行路由、距離 | ✅ | GraphHopper 或 OSRM（讀 OSM 路網） |
| 優先步道／避開幹道 | ✅ | GraphHopper custom model／profile 權重 |
| 附近公園、河濱、操場 | ✅ | Overpass API 或預處理 POI |
| `sidewalk`、`foot`、部分 `lit` | ⚠️ 有但不完整 | 當加權／提示，勿當絕對真相 |

### 3.2 可選外部（非 MVP）

- 高程：SRTM／公開 elevation API（爬升）
- 天氣／日出：Open-Meteo
- 人潮、治安：**不做**或僅極粗略提示，文案不可承諾「保證安全」

### 3.3 架構原則

```
前端 MapLibre/Leaflet
    → 本專案 Next.js API Route（代理，避免暴露金鑰、統一錯誤處理）
        → GraphHopper / OSRM（路由）
        → Overpass（附近適合跑的環境 POI）
        → Elevation API（可選）
持久化（可選）
    → Supabase `pwa_routes`（登入用戶儲存／綁開團）
```

**不要**讓瀏覽器直打需金鑰的第三方 API；公開免金鑰端點也建議經 BFF 代理以便限流與日後替換。

---

## 4. 功能範圍

### Phase 1 — MVP（先做這個）

**必須有：**

1. 新頁面 `/routes/plan`（手機優先）
2. 進入頁請求定位；拒絕則提供地名搜尋（Nominatim 或同等，經代理）
3. 點選地圖新增途經點；貼路（foot／步行 profile）
4. 即時總距離（km）；可 Undo／清除
5. 目標距離快捷（5 / 8 / 10 / 12 km）+「還差 X km」
6. 匯出 GPX（client 產生即可）
7. 「套用到開團」：帶 query 或 sessionStorage 到 `/runs/new`，預填 `distance_km`、可選 `destination` 文字
8. BottomNav 或開團頁入口連到規劃器

**刻意不做（Phase 1）：**

- 帳號雲端存路線
- 自動建議整條 loop
- 人潮／治安
- 衛星圖付費層

### Phase 2 — 路況偏好（前對話「第四點」）

1. 開關：「優先步道／公園」「避開幹道」「寧願多繞也安全」
2. 路由權重調整（GraphHopper custom model 優先；若用公開 OSRM 則先做結果路段標色警示）
3. 路線結果以顏色標示：友善／普通／需注意
4. UI 文案註明資料來自 OSM，完整度因城市而異

### Phase 3 — 適合跑的環境圖層（前對話「第五點」）

1. 圖層開關：公園、河濱／親水、操場／跑道、（可選）飲水／廁所
2. Overpass 查詢目前視窗或定位半徑（注意 rate limit；可加簡單 cache）
3. 點 POI 可設為起點或途經點
4. 照明／人潮僅作「資料不足時的弱提示」，不作為主打安全指標

### Phase 4 — 與揪團深度整合

1. DB：`pwa_routes`（`pwa_` 前綴）
   - `id`, `creator_id`, `title`, `distance_m`, `elevation_gain_m`, `geometry` (GeoJSON), `gpx_url` 或 storage path, `prefs` jsonb, `created_at`…
2. `pwa_runs.route_id` 可空外鍵
3. 活動詳情頁顯示路線地圖預覽
4. 登入用戶「我的路線」列表（儲存／重新開啟／刪除）
5. Admin／super_member 可把常用路線綁到常用集合點（可選）

### Phase 5 — 體驗加分（有餘力再做）

- 往返（out-and-back）／環狀（loop）一鍵
- 依用戶 `pace_min/max` 估完跑時間
- 每 1 km 分段標記
- 離線快取已存路線（PWA）
- 爬升剖面圖

---

## 5. UX 要求（手機優先）

1. 第一屏不要儀表板感：地圖為主，控制項精簡
2. 進站自動定位；失敗立刻給搜尋，不要空白卡死
3. 大按鈕、Undo 明顯；畫線時底欄勿遮住地圖中心過久
4. 距離單位預設 km；與現有開團 `distance_km` 一致
5. 一般會員開團地區仍受板橋鎖定時：規劃器可全域使用，但「套用到開團」若角色無權自訂地點，僅帶入距離，地點仍走既有 `pwa_locations` 邏輯
6. 無障礙：關鍵操作可用按鈕完成，不只靠地圖手勢

---

## 6. 建議技術選型

| 項目 | 建議 | 備註 |
|------|------|------|
| 地圖 | MapLibre GL JS 或 Leaflet | 選一個貫穿；注意 Next.js client component |
| 路由 | GraphHopper（自架或雲端）或 OSRM public | Phase 2 客製權重優先 GraphHopper |
| Geocoding | Nominatim（須遵守使用條款／限流） | 務必經 `/api/geo/search` 代理 |
| POI | Overpass | `/api/geo/pois`；cache + 超時 |
| 高程 | 可選 open-elevation 類 API | Phase 1 可省略 |
| 狀態 | React state + URL／sessionStorage | Phase 4 再寫 Supabase |
| 樣式 | 沿用現有 Tailwind／品牌色 | 不要另起一套設計系統 |

環境變數（示例，實作時補進 `.env.example`）：

```env
# 路由引擎
GRAPHHOPPER_BASE_URL=
GRAPHHOPPER_API_KEY=
# 或 OSRM_BASE_URL=

# 圖磚（若用需 key 的供應商）
NEXT_PUBLIC_MAP_STYLE_URL=
```

---

## 7. 建議檔案／路由結構（實作時可微調）

```
src/app/routes/plan/page.tsx          # 規劃器 UI
src/app/api/routing/route/route.ts    # 代理路由請求
src/app/api/geo/search/route.ts       # 地名搜尋代理
src/app/api/geo/pois/route.ts         # Overpass 代理（Phase 3）
src/components/route-planner/         # Map、Controls、DistanceBar…
src/lib/routing/                      # profile、GPX、距離格式
supabase/migrations/00x_pwa_routes.sql  # Phase 4
```

開團串接：

- `src/app/runs/new/page.tsx`：讀取 `?distance_km=&destination=` 或 `sessionStorage.routeDraft`
- `src/components/BottomNav.tsx`：新增「路線」入口（文案與現有導航風格一致）

---

## 8. 資料庫（僅 Phase 4 需要）

遵循既有規範：表名 `pwa_` 前綴；不改舊系統表。

```sql
-- 草案，實作 Phase 4 時再定稿 migration
CREATE TABLE pwa_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  distance_m INT NOT NULL,
  elevation_gain_m INT,
  geometry JSONB NOT NULL, -- GeoJSON LineString / MultiLineString
  prefs JSONB,             -- 路況偏好開關快照
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- pwa_runs 增加可空：
-- ALTER TABLE pwa_runs ADD COLUMN route_id UUID REFERENCES pwa_routes(id) ON DELETE SET NULL;
```

---

## 9. 非目標／風險

- 不承諾即時人潮、治安、夜間絕對安全
- 不在 MVP 引入付費衛星圖造成成本失控
- 注意 Nominatim／Overpass／公開 OSRM 的 rate limit；生產環境應自架或付費方案
- 定位僅在 HTTPS／使用者授權下可用；PWA 需處理權限拒絕 UX
- 一般會員開團地區鎖定規則不可被路線規劃繞過

---

## 10. 驗收標準

### Phase 1 Done when

- [ ] `/routes/plan` 可定位或搜尋到城市
- [ ] 可點選至少 2 點產生貼路路線並顯示 km
- [ ] 目標距離提示「還差 X km」正確
- [ ] 可下載 GPX
- [ ] 「套用到開團」能預填距離
- [ ] 既有登入／開團／報名／推播回歸無損
- [ ] 手機寬度可用

### Phase 2 Done when

- [ ] 至少一個「安全多繞」或「優先步道」開關會改變路線或標色
- [ ] UI 標註 OSM 資料限制

### Phase 3 Done when

- [ ] 可顯示公園／河濱／操場圖層並點選加入路線

### Phase 4 Done when

- [ ] 登入可存路線；開團可綁 `route_id`；詳情頁可預覽

---

## 11. 建議實作順序（Agent 按此執行）

1. **勘查**：確認現有 BottomNav、開團表單欄位、env 慣例
2. **骨架**：`/routes/plan` + client 地圖 + 假距離（兩點直線）驗證 UI
3. **路由 API**：接上 OSRM 或 GraphHopper foot，改為貼路距離
4. **定位 + 搜尋**
5. **目標距離 UI + GPX 匯出**
6. **套用到 `/runs/new`**
7. **導航入口 + README／`.env.example` 更新**
8. 停在 Phase 1，向使用者確認後再進 Phase 2

---

## 12. 先前產品共識摘要（供上下文）

- On The Go Map 架構概念：OSM 底圖 + GraphHopper 貼路 + 前端算距離；定位靠瀏覽器權限
- 優化重點：自動定位、目標距離、往返／環狀、路況偏好、適合跑的環境
- 第四點路況偏好：**可做**，靠 OSM 標籤 + 路由權重
- 第五點安心感：**部分可做**（公園／河濱／操場）；照明／人潮弱；治安不做主打
- 資料以 OSM 為主，連的是路由／Overpass 等服務，不是另購跑步 DB

---

## 13. 完成 Phase 1 後的回報格式

請用繁體中文回報：

1. 新增／修改了哪些檔案
2. 如何本機啟動與設定 env
3. 驗收清單勾選結果
4. 已知限制（API 限流、城市 OSM 完整度等）
5. 是否建議下一步做 Phase 2 或 Phase 4
)
