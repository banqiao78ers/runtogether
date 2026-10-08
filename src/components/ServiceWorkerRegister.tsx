"use client";

import { useEffect } from "react";

/** 註冊 Service Worker（圖磚快取＋推播）。盡早掛在 layout，不必等「我的」頁。 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // 忽略：私密模式／不支援
    });
  }, []);
  return null;
}
