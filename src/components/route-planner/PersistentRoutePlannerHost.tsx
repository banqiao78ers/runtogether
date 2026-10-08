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
      className={`fixed inset-x-0 top-0 bottom-14 z-30 mx-auto flex w-full max-w-lg flex-col bg-[#0f1f17] ${
        active
          ? "visible pointer-events-auto"
          : "invisible pointer-events-none"
      }`}
      aria-hidden={!active}
      data-route-planner-active={active ? "1" : "0"}
    >
      {/*
        inactive 用 invisible（維持尺寸）+ pointer-events-none（不擋下方頁）。
        軌跡改畫在 MapLibre 圖層，不再用全螢幕 SVG，以免吃掉觸控拖曳。
      */}
      <RoutePlanner mapVisible={active} />
    </div>
  );
}
