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

export function PushRegister() {
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
      alert("尚未設定 VAPID public key");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

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

  if (status === "idle") return null;

  const canEnablePush = status === "on" || status === "off";
  const iosNeedsInstall = ios && !standalone;

  return (
    <div className="space-y-3 text-sm text-emerald-100/70">
      <p className="font-medium text-emerald-100/90">推播通知</p>

      {iosNeedsInstall ? (
        <ol className="list-decimal space-y-1.5 pl-5 text-emerald-100/60">
          <li>使用 Safari 開啟本站（需 iOS 16.4 以上）</li>
          <li>點底部分享 →「加入主畫面」</li>
          <li>從主畫面圖示開啟 App 後，再回來點「開啟推播通知」</li>
        </ol>
      ) : ios ? (
        <p className="text-emerald-100/60">
          已從主畫面開啟。點下方按鈕並允許通知即可收到開團推播。
        </p>
      ) : status === "unsupported" ? (
        <p className="text-emerald-100/60">
          此瀏覽器不支援 Web Push。請改用 Android Chrome，或將網站加入主畫面後再開啟。
        </p>
      ) : (
        <p className="text-emerald-100/60">
          Android／桌面 Chrome：直接點下方按鈕並允許通知即可，無需額外安裝。
        </p>
      )}

      {canEnablePush && !iosNeedsInstall && (
        <button
          type="button"
          onClick={() => void (status === "on" ? disable() : enable())}
          className="text-emerald-300 underline-offset-2 hover:underline"
        >
          {status === "on" ? "關閉推播" : "開啟推播通知"}
        </button>
      )}

      {canEnablePush && iosNeedsInstall && (
        <p className="text-amber-200/80">加入主畫面並從圖示開啟後，才會出現開啟按鈕。</p>
      )}
    </div>
  );
}
