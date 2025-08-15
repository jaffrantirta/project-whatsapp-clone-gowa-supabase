export interface MessageReaction {
  id: number;
  message_id: number;
  sender_jid: string;
  reaction: string;
  created_at: string;
}