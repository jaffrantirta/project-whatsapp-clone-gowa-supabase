import { MessageType } from "./MessageType";

export interface Message {
  id: number;
  account_id: number;
  chat_id: number; // FK to Contact.id
  sender_jid: string;
  message_id: string;
  type: MessageType;
  text?: string | null;
  quoted_message?: string | null;
  replied_to_id?: string | null;
  forwarded: boolean;
  view_once: boolean;
  created_at: string;
  updated_at: string;
}