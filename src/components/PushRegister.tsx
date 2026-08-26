"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
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

type Props = {
  /** 精簡版：用在配速設定等頁，只顯示教學 */
  guideOnly?: boolean;
};

export function PushRegister({ guideOnly = false }: Props) {
  const [status, setStatus] = useState<"idle" | "on" | "off" | "unsupported">(
    "idle",
  );
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setIos(isIosDevice());
    setStandalone(isStandaloneDisplay());

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    void navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    });
  }, []);

  async function enable() {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) {
      alert("尚未設定推播金鑰，請聯絡管理員");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      alert("需要允許通知才能收到開團推播");
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    setStatus("on");
  }

  async function disable() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    await fetch("/api/push/subscribe", { method: "DELETE" });
    setStatus("off");
  }

  if (status === "idle") {
    return (
      <div className="space-y-2 text-sm text-emerald-100/50">
        <p className="font-medium text-emerald-100/90">推播通知</p>
        <p>檢查裝置中…</p>
      </div>
    );
  }

  const canEnablePush = status === "on" || status === "off";
  const iosNeedsInstall = ios && !standalone;

  return (
    <div className="space-y-3 rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-4 text-sm text-emerald-100/70">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-emerald-100/90">推播通知</p>
        {!guideOnly && canEnablePush && (
          <span
            className={
              status === "on" ? "text-emerald-300" : "text-amber-200/80"
            }
          >
            {status === "on" ? "已開啟" : "未開啟"}
          </span>
        )}
      </div>

      {ios ? (
        <div className="space-y-2">
          <p className="font-medium text-emerald-200/90">iPhone／iPad 設定步驟</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-emerald-100/65">
            <li>請用 Safari 開啟本站（勿用 LINE 內建瀏覽器）</li>
            <li>系統需 iOS 16.4 或更新版本</li>
            <li>點底部分享按鈕 → 選擇「加入主畫面」</li>
            <li>從主畫面圖示開啟 App（不是 Safari 分頁）</li>
            <li>到「我的」點「開啟推播通知」並允許</li>
          </ol>
          {iosNeedsInstall ? (
            <p className="text-amber-200/90">
              目前還在瀏覽器分頁中。請先加入主畫面，否則 iPhone
              無法收到推播。
            </p>
          ) : (
            <p className="text-emerald-100/60">
              已從主畫面開啟。請點下方按鈕並允許通知。
            </p>
          )}
        </div>
      ) : status === "unsupported" ? (
        <p className="text-emerald-100/60">
          此瀏覽器不支援網頁推播。請改用 Android 的 Chrome，或將網站加入主畫面後再開啟。
        </p>
      ) : (
        <p className="text-emerald-100/60">
          Android 或電腦版 Chrome：直接點下方按鈕並允許通知即可。
        </p>
      )}

      {!guideOnly && canEnablePush && !iosNeedsInstall && (
        <button
          type="button"
          onClick={() => void (status === "on" ? disable() : enable())}
          className="h-10 w-full rounded-md bg-emerald-400/90 font-semibold text-emerald-950"
        >
          {status === "on" ? "關閉推播" : "開啟推播通知"}
        </button>
      )}

      {!guideOnly && (
        <p className="text-xs text-emerald-100/45">
          另需已設定配速偏好，才會收到符合區間的開團推播；追蹤主揪則不受配速限制。
        </p>
      )}
    </div>
  );
}
