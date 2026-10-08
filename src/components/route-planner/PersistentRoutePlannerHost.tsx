"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { RoutePlanner } from "./RoutePlanner";

/**
 * 規劃頁地圖 Keep-Alive：
 * 第一次進入 /routes/plan 後保持掛載；切到其他 BottomNav 頁時用 invisible 隱藏
 *（維持尺寸，避免 display:none / 卸載造成 MapLibre 白屏）。
 */
export function PersistentRoutePlannerHost() {
  const pathname = usePathname();
  const active =
    pathname === "/routes/plan" || pathname.startsWith("/routes/plan/");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (active) setMounted(true);
  }, [active]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-x-0 top-0 bottom-14 mx-auto flex w-full max-w-lg flex-col overflow-hidden bg-[#0f1f17] ${
        active
          ? "z-30 visible pointer-events-auto"
          : // 維持版面尺寸（避免回規劃頁白屏），但降到底層且不可見，避免蓋住分享頁
            "z-0 invisible pointer-events-none"
      }`}
      aria-hidden={!active}
      data-route-planner-active={active ? "1" : "0"}
    >
      <RoutePlanner mapVisible={active} />
    </div>
  );
}
