export interface WhatsAppAccount {
  id: number;
  phone_number: string;
  name?: string | null;
  status: 'connected' | 'disconnected';
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}
