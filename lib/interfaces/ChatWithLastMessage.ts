import { Contact } from "./Contact";
import { Message } from "./Message";

export interface ChatWithLastMessage extends Contact {
  last_message?: Message;
  unread_count: number;
  participant_count?: number;
}