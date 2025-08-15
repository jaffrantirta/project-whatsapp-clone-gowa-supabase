export interface GroupParticipant {
  id: number;
  group_id: number; // FK to Contact.id (is_group = true)
  participant_jid: string;
  is_admin: boolean;
  joined_at: string;
  left_at?: string | null;
}