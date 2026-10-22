"use client";

import { useState } from "react";
import useSWR from "swr";
import { roleLabel } from "@/lib/format";
import { apiErrorMessage } from "@/lib/api-errors";
import type { UserRole } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type AdminUser = {
  id: string;
  display_name: string;
  role: UserRole;
  is_banned: boolean;
  line_uid: string | null;
};

type InviteRow = {
  id: string;
  purpose: "register" | "login";
  user_id: string | null;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

function inviteStatus(inv: InviteRow): string {
  if (inv.revoked_at) return "已撤銷";
  if (inv.used_at) return "已使用";
  if (new Date(inv.expires_at).getTime() <= Date.now()) return "已過期";
  return "未使用";
}

export default function AdminUsersPage() {
  const { data, mutate } = useSWR("/api/admin/users", fetcher);
  const {
    data: inviteData,
    mutate: mutateInvites,
  } = useSWR("/api/admin/invites", fetcher);
  const [filter, setFilter] = useState("");
  const [linkBanner, setLinkBanner] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function setRole(id: string, role: UserRole) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role }),
    });
    await mutate();
  }

  async function setBanned(id: string, is_banned: boolean) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_banned }),
    });
    await mutate();
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setLinkBanner(`已複製連結：${url}`);
    } catch {
      setLinkBanner(url);
    }
  }

  async function createRegisterInvite() {
    setBusy(true);
    setLinkError(null);
    setLinkBanner(null);
    try {
      const res = await fetch("/api/admin/invites", { method: "POST" });
      const j = (await res.json()) as { error?: string; url?: string };
      if (!res.ok || !j.url) {
        setLinkError(apiErrorMessage(j.error, "產生邀請連結失敗"));
        return;
      }
      await copyUrl(j.url);
      await mutateInvites();
    } catch {
      setLinkError("網路錯誤");
    } finally {
      setBusy(false);
    }
  }

  async function createLoginLink(userId: string) {
    setBusy(true);
    setLinkError(null);
    setLinkBanner(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/login-link`, {
        method: "POST",
      });
      const j = (await res.json()) as { error?: string; url?: string };
      if (!res.ok || !j.url) {
        setLinkError(apiErrorMessage(j.error, "產生登入連結失敗"));
        return;
      }
      await copyUrl(j.url);
      await mutateInvites();
    } catch {
      setLinkError("網路錯誤");
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvite(id: string) {
    setBusy(true);
    setLinkError(null);
    try {
      const res = await fetch(`/api/admin/invites/${id}/revoke`, {
        method: "POST",
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setLinkError(apiErrorMessage(j.error, "撤銷失敗"));
        return;
      }
      await mutateInvites();
    } catch {
      setLinkError("網路錯誤");
    } finally {
      setBusy(false);
    }
  }

  const users = ((data?.users ?? []) as AdminUser[]).filter((u) =>
    u.display_name.toLowerCase().includes(filter.toLowerCase()),
  );
  const profiles = (data?.profiles ?? []).filter(
    (p: { display_name: string }) =>
      p.display_name.toLowerCase().includes(filter.toLowerCase()),
  );
  const invites = (inviteData?.invites ?? []) as InviteRow[];

  return (
    <main className="px-5 py-8">
      <h1 className="text-xl font-bold text-white">會員角色（規則 C）</h1>
      <p className="mt-2 text-sm text-emerald-100/55">
        首次 LINE 登入皆為一般會員。請對照下方既有會員資料的顯示名稱，手動升格為超級會員或管理員。無法用
        LINE 登入者，可用邀請連結開通。
      </p>

      <section className="mt-8 rounded-lg border border-emerald-800/50 bg-emerald-950/30 p-4">
        <h2 className="text-sm font-medium text-emerald-300/90">邀請開通</h2>
        <p className="mt-1 text-xs text-emerald-100/50">
          產生單次邀請連結（7
          天有效）。對方只需填群內名稱。無 LINE 會員若登出／清資料，請再產生登入連結（24
          小時有效）。
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void createRegisterInvite()}
          className="mt-3 inline-flex h-10 items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-400/15 px-3 text-sm text-emerald-100 disabled:opacity-50"
        >
          產生邀請連結
        </button>
        {linkBanner && (
          <p className="mt-3 break-all text-xs text-emerald-200/80">{linkBanner}</p>
        )}
        {linkError && (
          <p className="mt-2 text-xs text-amber-300" role="alert">
            {linkError}
          </p>
        )}

        <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto text-xs text-emerald-100/65">
          {invites.map((inv) => {
            const status = inviteStatus(inv);
            const canRevoke = status === "未使用";
            return (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-2 border-b border-emerald-900/40 pb-2"
              >
                <span>
                  {inv.purpose === "register" ? "邀請" : "登入"} · {status} ·{" "}
                  {new Date(inv.created_at).toLocaleString("zh-TW")}
                </span>
                {canRevoke && (
                  <button
                    type="button"
                    disabled={busy}
                    className="shrink-0 text-amber-200/80"
                    onClick={() => void revokeInvite(inv.id)}
                  >
                    撤銷
                  </button>
                )}
              </li>
            );
          })}
          {invites.length === 0 && <li>尚無邀請紀錄</li>}
        </ul>
      </section>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="搜尋顯示名稱"
        className="mt-6 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2 text-sm"
      />

      <h2 className="mt-8 text-sm font-medium text-emerald-300/80">本站會員</h2>
      <ul className="mt-3 space-y-4">
        {users.map((u) => (
          <li
            key={u.id}
            className="border-b border-emerald-900/40 pb-3 text-sm text-emerald-100/80"
          >
            <div className="flex items-center justify-between gap-2">
              <span>
                {u.display_name}
                {u.is_banned ? " · 停權" : ""}
                {!u.line_uid ? " · 邀請開通" : ""}
              </span>
              <select
                value={u.role}
                onChange={(e) => void setRole(u.id, e.target.value as UserRole)}
                className="rounded border border-emerald-800/60 bg-[#0c1812] px-2 py-1"
              >
                <option value="member">{roleLabel("member")}</option>
                <option value="super_member">
                  {roleLabel("super_member")}
                </option>
                <option value="admin">{roleLabel("admin")}</option>
              </select>
            </div>
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                className="text-xs text-emerald-300/70"
                onClick={() => void setBanned(u.id, !u.is_banned)}
              >
                {u.is_banned ? "解除停權" : "手動停權"}
              </button>
              {!u.line_uid && !u.is_banned && (
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs text-teal-300/80 disabled:opacity-50"
                  onClick={() => void createLoginLink(u.id)}
                >
                  產生登入連結
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-sm font-medium text-emerald-300/80">
        既有會員資料（對照用）
      </h2>
      {data?.profiles_error && (
        <p className="mt-2 text-xs text-amber-300">
          無法讀取既有會員資料：{data.profiles_error}
        </p>
      )}
      <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm text-emerald-100/50">
        {profiles.map((p: { id: string; display_name: string }) => (
          <li key={p.id}>{p.display_name}</li>
        ))}
      </ul>
    </main>
  );
}
