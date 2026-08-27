"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { formatDateTime, paceLabel, participantStatusLabel, runStatusLabel, isRunFull, participantsCountLabel } from "@/lib/format";
import { apiErrorMessage } from "@/lib/api-errors";
import { MemberNameLink } from "@/components/MemberNameLink";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Participant = {
  id: string;
  user_id: string;
  status: string;
  user?: { id: string; display_name: string };
};

type AttendanceMark = "attended" | "no_show";

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, mutate, isLoading } = useSWR(
    id ? `/api/runs/${id}` : null,
    fetcher,
    { refreshInterval: 10000 },
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [delayMins, setDelayMins] = useState(10);
  const [forcePushBusy, setForcePushBusy] = useState(false);
  const [rollCallOpen, setRollCallOpen] = useState(false);
  const [attendance, setAttendance] = useState<Record<string, AttendanceMark>>({});
  const [completeBusy, setCompleteBusy] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const run = data?.run;
  const me = data?.me;
  const isAdmin = me?.role === "admin";

  async function act(path: string, body?: unknown) {
    setMsg(null);
    if (path === "cancel") {
      const reason =
        typeof body === "object" &&
        body &&
        "reason" in body &&
        typeof (body as { reason?: string }).reason === "string"
          ? (body as { reason: string }).reason.trim()
          : "";
      if (!reason) {
        setMsg("請填寫取消原因");
        return;
      }
    }
    const res = await fetch(`/api/runs/${id}/${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(apiErrorMessage(json.error));
      return;
    }
    await mutate();
    if (path === "cancel" && json.voting_enabled) {
      setMsg("活動已取消。若認為惡意取消，可投票檢舉。");
    } else if (path === "cancel") {
      setMsg("活動已取消");
    }
  }

  async function sendComment() {
    const res = await fetch(`/api/runs/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: comment }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(apiErrorMessage(j.error, "留言失敗"));
      return;
    }
    setComment("");
    await mutate();
  }

  async function copyRunLink() {
    const url = `${window.location.origin}/runs/${id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 2000);
  }

  async function forcePush() {
    if (forcePushBusy) return;
    const ok = window.confirm(
      "確定要強制推播此活動給所有已開啟推播的會員？（略過配速過濾）",
    );
    if (!ok) return;
    setForcePushBusy(true);
    setMsg(null);
    const res = await fetch(`/api/runs/${id}/force-push`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setForcePushBusy(false);
    if (!res.ok) {
      setMsg(apiErrorMessage(json.error, "強制推播失敗"));
      return;
    }
    setMsg(
      `強制推播完成：訂閱 ${json.total}、成功 ${json.sent}、失敗 ${json.failed}、過期 ${json.expired}`,
    );
  }

  const participants = (data?.participants ?? []) as Participant[];

  const rollCallTargets = useMemo(
    () =>
      participants.filter((p) =>
        ["registered", "arrived"].includes(p.status),
      ),
    [participants],
  );

  function openRollCall() {
    const initial: Record<string, AttendanceMark> = {};
    for (const p of rollCallTargets) {
      initial[p.user_id] = p.status === "arrived" ? "attended" : "no_show";
    }
    setAttendance(initial);
    setRollCallOpen(true);
    setMsg(null);
  }

  function setAllAttended() {
    const next: Record<string, AttendanceMark> = {};
    for (const p of rollCallTargets) {
      next[p.user_id] = "attended";
    }
    setAttendance(next);
  }

  async function submitRollCall() {
    if (completeBusy) return;
    const missing = rollCallTargets.filter((p) => !attendance[p.user_id]);
    if (missing.length > 0) {
      setMsg("請為每位報名者選擇出席或未到");
      return;
    }
    const attended = rollCallTargets.filter(
      (p) => attendance[p.user_id] === "attended",
    ).length;
    const noShow = rollCallTargets.length - attended;
    const ok = window.confirm(
      `確認結案？\n出席 ${attended} 人、未到 ${noShow} 人`,
    );
    if (!ok) return;

    setCompleteBusy(true);
    setMsg(null);
    const res = await fetch(`/api/runs/${id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendance }),
    });
    const json = await res.json().catch(() => ({}));
    setCompleteBusy(false);
    if (!res.ok) {
      setMsg(apiErrorMessage(json.error));
      return;
    }
    setRollCallOpen(false);
    await mutate();
    setMsg("點名結案完成");
  }

  if (isLoading || !run) {
    return (
      <main className="px-5 py-10 text-sm text-emerald-100/50">載入中…</main>
    );
  }

  const place =
    run.custom_location ||
    (run.location
      ? `${run.location.city}${run.location.district} ${run.location.title}`
      : "—");
  const full = isRunFull(data.participant_count, run.max_participants);
  const isHost = me?.is_host;
  const joined = !!me?.participation;
  const closed = ["completed", "cancelled"].includes(run.status);
  const canArrive = new Date(run.start_time).getTime() <= Date.now();

  return (
    <main className="px-5 py-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-sm text-emerald-300/70"
      >
        ← 返回
      </button>

      <h1 className="mt-4 text-2xl font-bold text-white">
        {formatDateTime(run.start_time)}
      </h1>
      <p className="mt-2 text-emerald-100/80">{place}</p>
      {run.location_detail && (
        <p className="text-sm text-emerald-100/50">{run.location_detail}</p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-2 text-sm text-emerald-100/70">
          <span>主揪</span>
          <MemberNameLink
            userId={run.host?.id ?? run.host_id}
            name={run.host?.display_name}
          />
        </p>
        <button
          type="button"
          onClick={() => void copyRunLink()}
          className="shrink-0 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-200"
        >
          {linkCopied ? "已複製連結" : "複製活動連結"}
        </button>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm text-emerald-100/70">
        <div>
          <dt className="text-emerald-100/40">距離</dt>
          <dd>{run.distance_km} km</dd>
        </div>
        <div>
          <dt className="text-emerald-100/40">配速</dt>
          <dd>
            {paceLabel(run.pace_min)}–{paceLabel(run.pace_max)}
          </dd>
        </div>
        <div>
          <dt className="text-emerald-100/40">名額</dt>
          <dd>
            {participantsCountLabel(data.participant_count, run.max_participants)}
          </dd>
        </div>
        <div>
          <dt className="text-emerald-100/40">狀態</dt>
          <dd>{runStatusLabel(run.status)}</dd>
        </div>
      </dl>

      {run.note && (
        <p className="mt-4 text-sm text-emerald-100/60">{run.note}</p>
      )}
      {run.cancel_reason && (
        <p className="mt-4 text-sm text-amber-300">取消原因：{run.cancel_reason}</p>
      )}

      {msg && <p className="mt-4 text-sm text-amber-300">{msg}</p>}

      {isAdmin && !closed && (
        <button
          type="button"
          disabled={forcePushBusy}
          onClick={() => void forcePush()}
          className="mt-4 h-11 w-full rounded-lg border border-amber-400/50 bg-amber-400/10 font-medium text-amber-100 disabled:opacity-50"
        >
          {forcePushBusy ? "推播中…" : "管理員：強制推播宣傳此活動"}
        </button>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {!closed && me && !isHost && !joined && (
          <button
            type="button"
            disabled={full}
            onClick={() => void act("register")}
            className="h-11 rounded-lg bg-emerald-400 font-semibold text-emerald-950 disabled:opacity-40"
          >
            {full ? "已額滿" : "報名"}
          </button>
        )}
        {!closed && me && !isHost && joined && (
          <>
            {canArrive ? (
              <button
                type="button"
                onClick={() => void act("arrive")}
                className="h-11 rounded-lg border border-emerald-500/40 text-emerald-200"
              >
                我已到達
              </button>
            ) : (
              <p className="text-center text-sm text-emerald-100/45">
                集合時間到後才能簽到到達
              </p>
            )}
            <button
              type="button"
              onClick={() => void act("cancel-registration")}
              className="h-11 text-sm text-emerald-100/50"
            >
              取消報名
            </button>
          </>
        )}

        {isHost && !closed && (
          <>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={30}
                value={delayMins}
                onChange={(e) => setDelayMins(Number(e.target.value))}
                className="w-24 rounded-md border border-emerald-800/60 bg-transparent px-2 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void act("delay", { minutes: delayMins })}
                className="flex-1 rounded-lg border border-emerald-500/40 py-2 text-sm text-emerald-200"
              >
                延期廣播
              </button>
            </div>
            {!rollCallOpen ? (
              <button
                type="button"
                onClick={openRollCall}
                className="h-11 rounded-lg bg-emerald-400 font-semibold text-emerald-950"
              >
                結案點名
              </button>
            ) : (
              <div className="rounded-lg border border-emerald-700/50 bg-emerald-950/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-emerald-200">
                    點名結案
                  </h3>
                  <button
                    type="button"
                    onClick={setAllAttended}
                    className="text-xs text-emerald-300 underline"
                  >
                    全部出席
                  </button>
                </div>
                <p className="mt-1 text-xs text-emerald-100/45">
                  請確認每位報名者是否出席，已到達者預設為出席。
                </p>
                {rollCallTargets.length === 0 ? (
                  <p className="mt-4 text-sm text-emerald-100/50">
                    目前無待點名報名者，可直接結案。
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {rollCallTargets.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="text-emerald-100/80">
                          {p.user?.display_name || "跑友"}
                          <span className="ml-2 text-xs text-emerald-100/40">
                            {participantStatusLabel(p.status)}
                          </span>
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setAttendance((prev) => ({
                                ...prev,
                                [p.user_id]: "attended",
                              }))
                            }
                            className={`rounded px-2 py-1 text-xs ${
                              attendance[p.user_id] === "attended"
                                ? "bg-emerald-400 text-emerald-950"
                                : "border border-emerald-700/60 text-emerald-100/60"
                            }`}
                          >
                            出席
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setAttendance((prev) => ({
                                ...prev,
                                [p.user_id]: "no_show",
                              }))
                            }
                            className={`rounded px-2 py-1 text-xs ${
                              attendance[p.user_id] === "no_show"
                                ? "bg-rose-400/90 text-rose-950"
                                : "border border-emerald-700/60 text-emerald-100/60"
                            }`}
                          >
                            未到
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRollCallOpen(false)}
                    className="flex-1 rounded-lg border border-emerald-700/60 py-2 text-sm text-emerald-100/70"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={completeBusy}
                    onClick={() => void submitRollCall()}
                    className="flex-1 rounded-lg bg-emerald-400 py-2 text-sm font-semibold text-emerald-950 disabled:opacity-50"
                  >
                    {completeBusy ? "結案中…" : "確認結案"}
                  </button>
                </div>
              </div>
            )}
            <input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="取消整場原因"
              className="rounded-md border border-emerald-800/60 bg-transparent px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void act("cancel", { reason: cancelReason })}
              className="h-11 text-sm text-rose-300/80"
            >
              取消整場活動
            </button>
          </>
        )}

        {run.status === "cancelled" && me && !isHost && (
          <button
            type="button"
            onClick={() => void act("vote-cancel", { is_malicious: true })}
            className="h-11 rounded-lg border border-rose-400/40 text-rose-200"
          >
            投票：惡意取消
          </button>
        )}

        {!me && (
          <a
            href="/login"
            className="flex h-11 items-center justify-center rounded-lg bg-emerald-400 font-semibold text-emerald-950"
          >
            登入後報名
          </a>
        )}
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-emerald-200/80">
          報名者（{data.participant_count}）
        </h2>
        <p className="mt-1 text-xs text-emerald-100/40">
          點姓名可查看對方活動紀錄與追蹤／黑名單
        </p>
        <ul className="mt-3 space-y-2">
          {participants.map((p) => {
            const isRunHost = p.user_id === run.host_id;
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-2 text-sm text-emerald-100/70"
              >
                <MemberNameLink
                  userId={p.user_id}
                  name={p.user?.display_name}
                />
                {isRunHost && (
                  <span className="text-xs text-emerald-300/60">主揪</span>
                )}
                <span className="text-emerald-100/40">·</span>
                <span>{participantStatusLabel(p.status)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-emerald-200/80">留言板</h2>
        <ul className="mt-3 space-y-3">
          {(data.comments ?? []).map(
            (c: {
              id: string;
              content: string;
              user_id: string;
              user?: { display_name: string };
            }) => (
              <li key={c.id} className="border-b border-emerald-900/40 pb-2 text-sm">
                <MemberNameLink
                  userId={c.user_id}
                  name={c.user?.display_name}
                  className="mb-1"
                />
                <p className="mt-1 text-emerald-100/80">{c.content}</p>
              </li>
            ),
          )}
        </ul>
        {me && (isHost || joined) && (
          <div className="mt-4 flex gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="flex-1 rounded-md border border-emerald-800/60 bg-transparent px-3 py-2 text-sm"
              placeholder="留言（5 秒冷卻）"
            />
            <button
              type="button"
              onClick={() => void sendComment()}
              className="rounded-md bg-emerald-500/20 px-3 text-sm text-emerald-200"
            >
              送出
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
