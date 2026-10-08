import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "路線規劃",
  description: "用地圖規劃路跑路線，計算距離並套用到開團",
};

/**
 * 實際 UI 由 layout 的 PersistentRoutePlannerHost Keep-Alive 渲染，
 * 避免 BottomNav 切頁卸載 MapLibre 導致白屏。
 */
export default function RoutePlanPage() {
  return (
    <main
      className="flex min-h-[calc(100dvh-4rem)] flex-1 flex-col"
      aria-label="路線規劃"
    />
  );
}
