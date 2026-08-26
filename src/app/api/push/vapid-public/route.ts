import { jsonOk, jsonError, handleRouteError } from "@/lib/api";

/** 回傳 VAPID 公鑰（執行期讀取，避免客戶端 build 時內嵌錯誤） */
export async function GET() {
  try {
    const raw =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
      process.env.VAPID_PUBLIC_KEY ||
      "";
    const publicKey = raw.trim().replace(/^["']|["']$/g, "");
    if (!publicKey) return jsonError("VAPID_NOT_CONFIGURED", 500);

    // 粗驗：URL-safe base64，解碼後應為 65 bytes（未壓縮 P-256）
    const padded = publicKey + "=".repeat((4 - (publicKey.length % 4)) % 4);
    const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
    let bytes: Buffer;
    try {
      bytes = Buffer.from(b64, "base64");
    } catch {
      return jsonError("VAPID_INVALID", 500);
    }
    if (bytes.length !== 65 || bytes[0] !== 4) {
      return jsonError("VAPID_INVALID", 500);
    }

    return jsonOk({ publicKey });
  } catch (err) {
    return handleRouteError(err);
  }
}
