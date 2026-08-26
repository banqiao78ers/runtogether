"use client";

import { useEffect, useState } from "react";

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs =
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return iOS || iPadOs;
}

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || iosStandalone;
}

function isInAppBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Line\//i.test(ua) || /FBAN|FBAV/i.test(ua) || /Instagram/i.test(ua);
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * iOS 無法用程式直接「加入主畫面」，只能引導走 Safari 分享選單。
 * Android Chrome 可走 beforeinstallprompt。
 */
export function InstallApp() {
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(true);
  const [inApp, setInApp] = useState(false);
  const [open, setOpen] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    setIos(isIosDevice());
    setStandalone(isStandaloneDisplay());
    setInApp(isInAppBrowser());

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  // 已安裝則不顯示
  if (standalone) return null;

  async function installAndroid() {
    if (!deferred) {
      setOpen(true);
      return;
    }
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  return (
    <div className="rounded-lg border border-emerald-500/40 bg-emerald-400/10 px-4 py-4 text-sm text-emerald-100/80">
      <p className="font-medium text-emerald-100">安裝到主畫面</p>
      <p className="mt-1 text-emerald-100/60">
        {ios
          ? "iPhone／iPad 需用 Safari「分享」加入主畫面（系統功能，網站無法直接彈出）。"
          : "安裝後可像 App 一樣開啟，也較容易收到推播。"}
      </p>

      {inApp && (
        <p className="mt-2 rounded-md bg-amber-400/10 px-3 py-2 text-amber-200">
          目前是 LINE 等 App 內建瀏覽器，通常沒有「加入主畫面」。請點右上角
          「⋯」→「在 Safari／瀏覽器開啟」後再安裝。
        </p>
      )}

      {ios ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-3 h-11 w-full rounded-md bg-emerald-400 font-semibold text-emerald-950"
        >
          {open ? "收合說明" : "查看加入主畫面步驟"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void installAndroid()}
          className="mt-3 h-11 w-full rounded-md bg-emerald-400 font-semibold text-emerald-950"
        >
          {deferred ? "安裝板橋約跑" : "查看安裝說明"}
        </button>
      )}

      {open && ios && (
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-emerald-100/70">
          <li>請確認用 <strong className="text-emerald-100">Safari</strong> 開啟（不是 LINE 內頁）</li>
          <li>
            點螢幕底部中間的{" "}
            <strong className="text-emerald-100">分享</strong> 按鈕（方框＋向上箭頭）
          </li>
          <li>
            在選單中往下滑，選擇{" "}
            <strong className="text-emerald-100">「加入主畫面」</strong>
            （若沒看到，點「編輯動作」把它打開）
          </li>
          <li>右上角按「加入」</li>
          <li>回到手機主畫面，點「板橋約跑」圖示開啟</li>
        </ol>
      )}

      {open && !ios && !deferred && (
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-emerald-100/70">
          <li>請用 Chrome 開啟本站</li>
          <li>點右上角「⋮」選單</li>
          <li>選擇「安裝應用程式」或「加到主畫面」</li>
        </ol>
      )}
    </div>
  );
}
