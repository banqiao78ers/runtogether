"use client";

import { useState } from "react";
import useSWR from "swr";
import type { UserRole } from "@/types/database";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminUsersPage() {
  const { data, mutate } = useSWR("/api/admin/users", fetcher);
  const [filter, setFilter] = useState("");

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

  const users = (data?.users ?? []).filter((u: { display_name: string }) =>
    u.display_name.toLowerCase().includes(filter.toLowerCase()),
  );
  const profiles = (data?.profiles ?? []).filter(
    (p: { display_name: string }) =>
      p.display_name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <main className="px-5 py-8">
      <h1 className="text-xl font-bold text-white">會員角色（規則 C）</h1>
      <p className="mt-2 text-sm text-emerald-100/55">
        首次 LINE 登入皆為 member。請對照下方既有 profiles 顯示名稱，手動升格
        super_member／admin。
      </p>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="搜尋顯示名稱"
        className="mt-6 w-full rounded-md border border-emerald-800/60 bg-transparent px-3 py-2 text-sm"
      />

      <h2 className="mt-8 text-sm font-medium text-emerald-300/80">PWA 會員</h2>
      <ul className="mt-3 space-y-4">
        {users.map(
          (u: {
            id: string;
            display_name: string;
            role: UserRole;
            is_banned: boolean;
          }) => (
            <li
              key={u.id}
              className="border-b border-emerald-900/40 pb-3 text-sm text-emerald-100/80"
            >
              <div className="flex items-center justify-between gap-2">
                <span>
                  {u.display_name}
                  {u.is_banned ? " · 停權" : ""}
                </span>
                <select
                  value={u.role}
                  onChange={(e) =>
                    void setRole(u.id, e.target.value as UserRole)
                  }
                  className="rounded border border-emerald-800/60 bg-[#0c1812] px-2 py-1"
                >
                  <option value="member">member</option>
                  <option value="super_member">super_member</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <button
                type="button"
                className="mt-2 text-xs text-emerald-300/70"
                onClick={() => void setBanned(u.id, !u.is_banned)}
              >
                {u.is_banned ? "解除停權" : "手動停權"}
              </button>
            </li>
          ),
        )}
      </ul>

      <h2 className="mt-10 text-sm font-medium text-emerald-300/80">
        既有 profiles（對照用）
      </h2>
      {data?.profiles_error && (
        <p className="mt-2 text-xs text-amber-300">
          無法讀取 profiles：{data.profiles_error}
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
