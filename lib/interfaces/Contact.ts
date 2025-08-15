export interface Contact {
  id: number;
  account_id: number;
  jid: string;
  name?: string | null;
  is_group: boolean;
  group_subject?: string | null;
  group_description?: string | null;
  created_at: string;
  updated_at: string;
}