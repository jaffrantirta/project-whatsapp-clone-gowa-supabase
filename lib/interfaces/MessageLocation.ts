export interface MessageLocation {
  id: number;
  message_id: number;
  latitude: number;
  longitude: number;
  name?: string | null;
  address?: string | null;
  jpeg_thumbnail?: string | null; // base64
}