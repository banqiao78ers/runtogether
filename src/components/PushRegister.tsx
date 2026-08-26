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

function isInAppBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Line\//i.test(ua) || /FBAN|FBAV/i.test(ua) || /Instagram/i.test(ua);
}

type Props = {
  guideOnly?: boolean;
};

export function PushRegister({ guideOnly = false }: Props) {
  const [status, setStatus] = useState<"idle" | "on" | "off" | "unsupported">(
    "idle",
  );
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIos(isIosDevice());
    setStandalone(isStandaloneDisplay());
    setInApp(isInAppBrowser());

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    void navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? "on" : "off");
      })
      .catch(() => {
        setStatus("unsupported");
        setError("無法註冊背景服務，請改用 Chrome／Safari 重新開啟");
      });
  }, []);

  async function enable() {
    setError(null);
    setBusy(true);
    try {
      if (inApp) {
        setError("請用系統瀏覽器開啟（Chrome 或 Safari），LINE 內建瀏覽器無法開啟推播");
        return;
      }

      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setError("尚未設定推播金鑰，請聯絡管理員");
        return;
      }

      if (!window.isSecureContext) {
        setError("需在安全連線（HTTPS）下才能開啟推播");
        return;
      }

      if (!("Notification" in window)) {
        setError("此瀏覽器不支援通知");
        return;
      }

      if (Notification.permission === "denied") {
        setError(
          "瀏覽器已封鎖通知。請到瀏覽器網站設定中允許「通知」，再重新整理此頁",
        );
        return;
      }

      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();

      if (permission !== "granted") {
        setError("需要允許通知才能收到開團推播");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          j.error === "UNAUTHORIZED"
            ? "登入已過期，請重新登入後再試"
            : "推播訂閱儲存失敗，請稍後再試",
        );
        return;
      }
      setStatus("on");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/denied|not allowed/i.test(msg)) {
        setError("通知權限被拒絕，請在瀏覽器設定允許後重試");
      } else {
        setError(`開啟失敗：${msg || "未知錯誤"}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setError(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        credentials: "same-origin",
      });
      setStatus("off");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`關閉失敗：${msg || "未知錯誤"}`);
    } finally {
      setBusy(false);
    }
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
    <div className="relative z-10 space-y-3 rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-4 text-sm text-emerald-100/70">
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

      {inApp && (
        <p className="rounded-md bg-amber-400/10 px-3 py-2 text-amber-200">
          偵測到 App 內建瀏覽器。請用右上角選單「在瀏覽器開啟」，再用
          Chrome／Safari 操作推播。
        </p>
      )}

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

      {error && (
        <p className="rounded-md bg-amber-400/10 px-3 py-2 text-amber-200" role="alert">
          {error}
        </p>
      )}

      {!guideOnly && canEnablePush && !iosNeedsInstall && (
        <button
          type="button"
          disabled={busy || inApp}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void (status === "on" ? disable() : enable());
          }}
          className="relative z-10 h-11 w-full cursor-pointer touch-manipulation rounded-md bg-emerald-400 font-semibold text-emerald-950 active:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? "處理中…"
            : status === "on"
              ? "關閉推播"
              : "開啟推播通知"}
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
