
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ScheduleEvent, User } from '../types';

let cachedClient: SupabaseClient | null = null;
let cachedUrl: string | null = null;
let cachedKey: string | null = null;

const getCredentials = () => {
  const envUrl = (process.env as any).SUPABASE_URL;
  const envKey = (process.env as any).SUPABASE_KEY;
  if (envUrl && envKey) return { url: envUrl, key: envKey };

  const params = new URLSearchParams(window.location.search);
  const urlFromUrl = params.get('s_url');
  const keyFromUrl = params.get('s_key');
  
  if (urlFromUrl && keyFromUrl) {
    localStorage.setItem('synccircle_cloud_url', urlFromUrl);
    localStorage.setItem('synccircle_cloud_key', keyFromUrl);
    return { url: urlFromUrl, key: keyFromUrl };
  }

  return {
    url: localStorage.getItem('synccircle_cloud_url') || '',
    key: localStorage.getItem('synccircle_cloud_key') || ''
  };
};

export const getSupabaseClient = () => {
  const { url, key } = getCredentials();
  if (!url || !key) return null;
  
  // If credentials changed, recreate the client
  if (cachedClient && (cachedUrl !== url || cachedKey !== key)) {
    cachedClient = null;
  }

  if (cachedClient) return cachedClient;

  try {
    cachedClient = createClient(url, key);
    cachedUrl = url;
    cachedKey = key;
    return cachedClient;
  } catch (err) {
    console.error("Supabase Init Error:", err);
    return null;
  }
};

/**
 * Resets the internal cache if you need to force a re-init
 */
export const resetSupabaseClient = () => {
  cachedClient = null;
  cachedUrl = null;
  cachedKey = null;
};

export const generateSuperLink = (circleId: string) => {
  const baseUrl = window.location.origin + window.location.pathname;
  const { url, key } = getCredentials();
  
  const isEnvProvided = (process.env as any).SUPABASE_URL && (process.env as any).SUPABASE_KEY;
  
  if (isEnvProvided) {
    return `${baseUrl}?group=${circleId}`;
  }

  if (url && key) {
    const encodedUrl = encodeURIComponent(url);
    const encodedKey = encodeURIComponent(key);
    return `${baseUrl}?group=${circleId}&s_url=${encodedUrl}&s_key=${encodedKey}`;
  }
  
  return `${baseUrl}?group=${circleId}`;
};

export const ensureCircleInCloud = async (id: string, name: string) => {
  const client = getSupabaseClient();
  if (!client) throw new Error("Cloud database not initialized.");
  const { error } = await client.from('circles').upsert({ id, name }, { onConflict: 'id' });
  if (error) {
    if (error.code === '42P01') throw new Error("Database Tables Missing: Run the SQL Setup script in Supabase.");
    throw error;
  }
};

export const checkCircleExists = async (id: string) => {
  const client = getSupabaseClient();
  if (!client) return false;
  const { data, error } = await client.from('circles').select('id').eq('id', id).maybeSingle();
  return !!data && !error;
};

export const ensureUserInCloud = async (user: User, circleId: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.from('circle_users').upsert({
    id: user.id,
    circle_id: circleId,
    name: user.name,
    color: user.color,
    avatar_url: user.avatar,
    timezone: user.timezone
  }, { onConflict: 'id' });
  if (error) throw error;
};

export const fetchCircleData = async (circleId: string) => {
  const client = getSupabaseClient();
  if (!client) return { users: [], events: [], circleName: 'SyncCircle' };
  try {
    const [uRes, eRes, cRes] = await Promise.all([
      client.from('circle_users').select('*').eq('circle_id', circleId),
      client.from('events').select('*').eq('circle_id', circleId),
      client.from('circles').select('name').eq('id', circleId).maybeSingle()
    ]);
    
    if (uRes.error) throw uRes.error;
    if (eRes.error) throw eRes.error;

    const users: User[] = (uRes.data || []).map(u => ({
      id: u.id, name: u.name, color: u.color, avatar: u.avatar_url, timezone: u.timezone, active: true
    }));
    const events: ScheduleEvent[] = (eRes.data || []).map(e => ({
      id: e.id, userId: e.user_id, title: e.title, day: e.day, startTime: e.start_time, duration: e.duration, startDate: e.start_date, endDate: e.end_date
    }));
    return { users, events, circleName: cRes.data?.name || 'Live Circle' };
  } catch (err: any) {
    console.warn("Fetch failed:", err.message);
    return { users: [], events: [], circleName: 'SyncCircle' };
  }
};

export const syncEventToCloud = async (event: Omit<ScheduleEvent, 'id'>, circleId: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  await client.from('events').insert([{
    user_id: event.userId,
    circle_id: circleId,
    title: event.title,
    day: event.day,
    start_time: event.startTime,
    duration: event.duration,
    start_date: event.startDate,
    end_date: event.endDate
  }]);
};

export const updateEventInCloud = async (eventId: string, event: Partial<ScheduleEvent>) => {
  const client = getSupabaseClient();
  if (!client) return;
  const payload: any = {};
  if (event.title !== undefined) payload.title = event.title;
  if (event.day !== undefined) payload.day = event.day;
  if (event.startTime !== undefined) payload.start_time = event.startTime;
  if (event.duration !== undefined) payload.duration = event.duration;
  if (event.startDate !== undefined) payload.start_date = event.startDate;
  if (event.endDate !== undefined) payload.end_date = event.endDate;
  
  await client.from('events').update(payload).eq('id', eventId);
};

export const deleteEventFromCloud = async (eventId: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  await client.from('events').delete().eq('id', eventId);
};

export const subscribeToCircle = (circleId: string, onUpdate: () => void) => {
  const client = getSupabaseClient();
  if (!client) return { unsubscribe: () => {} };
  return client.channel(`circle-${circleId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `circle_id=eq.${circleId}` }, () => onUpdate())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'circle_users', filter: `circle_id=eq.${circleId}` }, () => onUpdate())
    .subscribe();
};
