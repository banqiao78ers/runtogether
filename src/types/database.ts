export type UserRole = "member" | "super_member" | "admin";

export type RunStatus =
  | "open"
  | "delayed"
  | "ongoing"
  | "completed"
  | "cancelled";

export type ParticipantStatus =
  | "registered"
  | "arrived"
  | "attended"
  | "cancelled"
  | "no_show";

export type AppealStatus = "pending" | "approved" | "rejected";

export type PushSubscriptionJSON = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type PwaUser = {
  id: string;
  line_uid: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  is_banned: boolean;
  pace_min: number | null;
  pace_max: number | null;
  push_subscription: PushSubscriptionJSON | null;
  created_at: string;
  updated_at: string;
};

export type PwaLocation = {
  id: string;
  city: string;
  district: string;
  title: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type PwaRun = {
  id: string;
  host_id: string;
  location_id: string | null;
  custom_location: string | null;
  location_detail: string | null;
  destination: string | null;
  start_time: string;
  estimated_duration_minutes: number;
  distance_km: number;
  pace_min: number;
  pace_max: number;
  max_participants: number;
  note: string | null;
  status: RunStatus;
  delay_count: number;
  total_delayed_minutes: number;
  cancel_reason: string | null;
  completion_reminder_sent_at: string | null;
  start_reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PwaRunParticipant = {
  id: string;
  run_id: string;
  user_id: string;
  status: ParticipantStatus;
  arrived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PwaRunComment = {
  id: string;
  run_id: string;
  user_id: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
};

export type PwaHostBlocklist = {
  id: string;
  host_id: string;
  blocked_user_id: string;
  created_at: string;
};

export type PwaHostFollow = {
  id: string;
  follower_id: string;
  host_id: string;
  created_at: string;
};

export type PwaCancellationVote = {
  id: string;
  run_id: string;
  voter_id: string;
  is_malicious: boolean;
  voted_at: string;
};

export type PwaPenaltyAppeal = {
  id: string;
  user_id: string;
  reason: string;
  status: AppealStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type LegacyProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type SessionPayload = {
  userId: string;
  lineUid: string;
  role: UserRole;
};

export type RegisterRpcResult = {
  ok: boolean;
  code?: string;
};
