const LINE_AUTH = "https://access.line.me/oauth2/v2.1/authorize";
const LINE_TOKEN = "https://api.line.me/oauth2/v2.1/token";
const LINE_PROFILE = "https://api.line.me/v2/profile";

export function getLineConfig() {
  const channelId = process.env.LINE_CHANNEL_ID;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const callbackUrl = process.env.LINE_CALLBACK_URL;

  if (!channelId || !channelSecret || !callbackUrl) {
    throw new Error("LINE_CHANNEL_ID / LINE_CHANNEL_SECRET / LINE_CALLBACK_URL required");
  }

  return { channelId, channelSecret, callbackUrl };
}

export function buildLineAuthorizeUrl(state: string): string {
  const { channelId, callbackUrl } = getLineConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: channelId,
    redirect_uri: callbackUrl,
    state,
    scope: "profile openid",
  });
  return `${LINE_AUTH}?${params.toString()}`;
}

export async function exchangeLineCode(code: string): Promise<string> {
  const { channelId, channelSecret, callbackUrl } = getLineConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl,
    client_id: channelId,
    client_secret: channelSecret,
  });

  const res = await fetch(LINE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`LINE token exchange failed: ${res.status}`);
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("LINE token missing");
  return json.access_token;
}

export type LineProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
};

export async function fetchLineProfile(accessToken: string): Promise<LineProfile> {
  const res = await fetch(LINE_PROFILE, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`LINE profile failed: ${res.status}`);
  }
  return res.json() as Promise<LineProfile>;
}
