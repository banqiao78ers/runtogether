import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth/user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { RegisterRpcResult } from "@/types/database";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    if (user.is_banned) return jsonError("BANNED", 403);
    const { id } = await ctx.params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.rpc("pwa_register_for_run", {
      p_run_id: id,
      p_user_id: user.id,
    });

    if (error) {
      console.error(error);
      return jsonError("DB", 500);
    }

    const result = data as RegisterRpcResult;
    if (!result?.ok) {
      const code = result?.code || "FAILED";
      const status = code === "FULL" || code === "TIME_OVERLAP" ? 409 : 400;
      return jsonError(code, status);
    }

    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
