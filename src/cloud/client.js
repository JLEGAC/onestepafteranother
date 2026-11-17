import { createClient } from '../../vendor/supabase.js';
import { cloudConfig } from './config.js';
export function makeClient() {
  if (!cloudConfig.url || !cloudConfig.publishableKey) return null;
  if (cloudConfig.publishableKey.startsWith('sb_secret_')) throw new Error('Clé secrète interdite dans la PWA.');
  if (cloudConfig.publishableKey.startsWith('ey')) {
    try { if (JSON.parse(atob(cloudConfig.publishableKey.split('.')[1])).role === 'service_role') throw new Error('service_role interdit dans la PWA.'); }
    catch (e) { throw new Error('Utilise une clé publique publishable Supabase.'); }
  }
  return createClient(cloudConfig.url, cloudConfig.publishableKey, { auth: {
    persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce',
    storageKey: 'upa-auth-session'
  } });
}
