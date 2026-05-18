import { fetchWithAuth } from './api';
import { API_URL } from '../config';
import type { License } from '../types';

/**
 * Check if a user has an active, non-expired subscription by fetching their licenses.
 * Returns true if any license has is_active=true AND expires_at is in the future.
 */
export async function checkActiveSubscription(discordId: string): Promise<boolean> {
  try {
    const res = await fetchWithAuth(`${API_URL}/api/user/licenses/${discordId}`);
    if (!res.ok) return false;
    const data = await res.json();
    const licenses: License[] = data.licenses || [];

    return licenses.some((license) => {
      if (!license.is_active) return false;
      if (!license.expires_at) return true; // No expiry = perpetual active
      return new Date(license.expires_at) > new Date();
    });
  } catch {
    return false;
  }
}
