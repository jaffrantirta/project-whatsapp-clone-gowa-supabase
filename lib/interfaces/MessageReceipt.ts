import { ReceiptType } from "./ReceiptType";

export interface MessageReceipt {
  id: number;
  message_id: number;
  recipient_jid: string;
  receipt_type: ReceiptType;
  description?: string | null;
  created_at: string;
}