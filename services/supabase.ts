
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ScheduleEvent, User } from '../types';

let cachedClient: SupabaseClient | null = null;

const getCredentials = () => {
  // 1. Priority: Environment Variables
  const envUrl = (process.env as any).SUPABASE_URL;
  const envKey = (process.env as any).SUPABASE_KEY;
  if (envUrl && envKey) return { url: envUrl, key: envKey };

  // 2. Secondary: URL Search Parameters (for Magic Links)
  const params = new URLSearchParams(window.location.search);
  const urlFromUrl = params.get('s_url');
  const keyFromUrl = params.get('s_key');
  
  if (urlFromUrl && keyFromUrl) {
    // Note: URLSearchParams.get() ALREADY decodes percent-encoding.
    // Do NOT call decodeURIComponent again as it may break on special characters.
    localStorage.setItem('synccircle_cloud_url', urlFromUrl);
    localStorage.setItem('synccircle_cloud_key', keyFromUrl);
    return { url: urlFromUrl, key: keyFromUrl };
  }

  // 3. Tertiary: Local Storage
  return {
    url: localStorage.getItem('synccircle_cloud_url') || '',
    key: localStorage.getItem('synccircle_cloud_key') || ''
  };
};

export const getSupabaseClient = () => {
  const { url, key } = getCredentials();
  if (!url || !key) return null;
  
  // Use a stable identifier for the client to avoid redundant recreations
  const clientKey = `${url}::${key}`;
  if (cachedClient && (cachedClient as any)._stableKey === clientKey) {
    return cachedClient;
  }

  try {
    const client = createClient(url, key);
    (client as any)._stableKey = clientKey;
    cachedClient = client;
    return cachedClient;
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
    return null;
  }
};

/**
 * Generates the "Zero-Config" link for friends.
 * Encodes current connection details into the URL so friends don't need to enter keys.
 */
export const generateSuperLink = (circleId: string) => {
  // Ensure we have a clean base URL without existing query params
  const baseUrl = window.location.origin + window.location.pathname;
  const { url, key } = getCredentials();
  
  // If the keys are hardcoded in the environment, we don't need to leak them in the URL
  const isEnvProvided = (process.env as any).SUPABASE_URL && (process.env as any).SUPABASE_KEY;
  
  if (isEnvProvided) {
    return `${baseUrl}?group=${circleId}`;
  }

  if (url && key) {
    // We encode these for the URL, they will be decoded by URLSearchParams.get() on the other end
    const encodedUrl = encodeURIComponent(url);
    const encodedKey = encodeURIComponent(key);
    return `${baseUrl}?group=${circleId}&s_url=${encodedUrl}&s_key=${encodedKey}`;
  }
  
  return `${baseUrl}?group=${circleId}`;
};

export const ensureCircleInCloud = async (id: string, name: string) => {
  const client = getSupabaseClient();
  if (!client) throw new Error("Cloud not connected");
  const { error } = await client.from('circles').upsert({ id, name }, { onConflict: 'id' });
  if (error) throw error;
};

export const ensureUserInCloud = async (user: User, circleId: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  await client.from('circle_users').upsert({
    id: user.id,
    circle_id: circleId,
    name: user.name,
    color: user.color,
    avatar_url: user.avatar,
    timezone: user.timezone
  }, { onConflict: 'id' });
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
    
    if (uRes.error || eRes.error) throw new Error("Database fetch error");

    const users: User[] = (uRes.data || []).map(u => ({
      id: u.id, name: u.name, color: u.color, avatar: u.avatar_url, timezone: u.timezone, active: true
    }));
    const events: ScheduleEvent[] = (eRes.data || []).map(e => ({
      id: e.id, userId: e.user_id, title: e.title, day: e.day, startTime: e.start_time, duration: e.duration, startDate: e.start_date, endDate: e.end_date
    }));
    return { users, events, circleName: cRes.data?.name || 'Live Circle' };
  } catch (err) {
    console.error("Fetch Circle Data failed:", err);
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
