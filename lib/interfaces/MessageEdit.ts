export interface MessageEdit {
  id: number;
  message_id: number;
  edited_text?: string | null;
  edited_at: string;
}