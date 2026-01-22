
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ScheduleEvent, User } from '../types';

let cachedClient: SupabaseClient | null = null;

const getCredentials = () => {
  const envUrl = (process.env as any).SUPABASE_URL;
  const envKey = (process.env as any).SUPABASE_KEY;
  if (envUrl && envKey) return { url: envUrl, key: envKey };

  const params = new URLSearchParams(window.location.search);
  const u = params.get('s_url');
  const k = params.get('s_key');
  if (u && k) {
    localStorage.setItem('synccircle_cloud_url', u);
    localStorage.setItem('synccircle_cloud_key', k);
    return { url: u, key: k };
  }

  return {
    url: localStorage.getItem('synccircle_cloud_url') || '',
    key: localStorage.getItem('synccircle_cloud_key') || ''
  };
};

export const getSupabaseClient = () => {
  const { url, key } = getCredentials();
  if (!url || !key) return null;
  if (!cachedClient) cachedClient = createClient(url, key);
  return cachedClient;
};

export const resetSupabaseClient = () => { cachedClient = null; };

export const generateSuperLink = (id: string) => {
  const { url, key } = getCredentials();
  const base = `${window.location.origin}${window.location.pathname}?group=${id}`;
  if ((process.env as any).SUPABASE_URL) return base;
  return `${base}&s_url=${encodeURIComponent(url)}&s_key=${encodeURIComponent(key)}`;
};

export const ensureCircleInCloud = async (id: string, name: string) => {
  const c = getSupabaseClient();
  if (c) await c.from('circles').upsert({ id, name });
};

export const checkCircleExists = async (id: string) => {
  const c = getSupabaseClient();
  if (!c) return false;
  const { data } = await c.from('circles').select('id').eq('id', id).maybeSingle();
  return !!data;
};

export const ensureUserInCloud = async (user: User, circleId: string) => {
  const c = getSupabaseClient();
  if (c) await c.from('circle_users').upsert({ id: user.id, circle_id: circleId, name: user.name, color: user.color });
};

export const fetchCircleData = async (id: string) => {
  const c = getSupabaseClient();
  if (!c) return { users: [], events: [] };
  const [u, e] = await Promise.all([
    c.from('circle_users').select('*').eq('circle_id', id),
    c.from('events').select('*').eq('circle_id', id)
  ]);
  return {
    users: (u.data || []).map(x => ({ ...x, active: true })),
    events: (e.data || []).map(x => ({ ...x, userId: x.user_id, startTime: x.start_time }))
  };
};

export const syncEventToCloud = async (e: Omit<ScheduleEvent, 'id'>, id: string) => {
  const c = getSupabaseClient();
  if (c) await c.from('events').insert([{ user_id: e.userId, circle_id: id, title: e.title, day: e.day, start_time: e.startTime, duration: e.duration }]);
};

export const deleteEventFromCloud = async (id: string) => {
  const c = getSupabaseClient();
  if (c) await c.from('events').delete().eq('id', id);
};

export const subscribeToCircle = (id: string, cb: () => void) => {
  const c = getSupabaseClient();
  if (!c) return { unsubscribe: () => {} };
  return c.channel(id).on('postgres_changes', { event: '*', schema: 'public' }, cb).subscribe();
};
