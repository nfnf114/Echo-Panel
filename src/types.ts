export interface User {
  id: string;
  username: string;
  avatarUrl: string;
  discordId: string;
  token?: string;
}

export interface License {
  id: number;
  license_key: string;
  server_ip: string | null;
  owner_discord_id: string;
  product_name: string;
  is_active: boolean;
  slots: number;
  expires_at: string | null;
  created_at: string;
}

export interface Server {
  id: string;
  name: string;
  ip: string;
  licenseKey: string;
  expiresAt: string;
  status: 'online' | 'offline';
  currentPlayers: number;
  maxPlayers: number;
}

// Dummy export to ensure this is treated as a module in JS
export const VERSION = '1.0.0';
