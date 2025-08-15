export interface MessageRevoke {
  id: number;
  message_id: number;
  revoked_by_jid?: string | null;
  revoked_at: string;
  revoked_for_me: boolean;
}