
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ScheduleEvent, User } from '../types';

let cachedClient: SupabaseClient | null = null;

const getCredentials = () => {
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
  return `${base}&s_url=${encodeURIComponent(url)}&s_key=${encodeURIComponent(key)}`;
};

export const ensureCircleInCloud = async (id: string, name: string) => {
  const c = getSupabaseClient();
  if (!c) return;

  const { data } = await c.from('circles').select('id').eq('id', id).maybeSingle();
  if (!data) {
    const { error } = await c.from('circles').insert({ id, name });
    if (error) console.error('Error creating circle:', error);
  }
};

export const ensureUserInCloud = async (user: User, circleId: string) => {
  const c = getSupabaseClient();
  if (!c) return;

  const { error } = await c.from('circle_users').upsert({ id: user.id, circle_id: circleId, name: user.name, color: user.color });
  if (error) console.error('Error upserting user:', error);
};

export const fetchCircleData = async (id: string) => {
  const c = getSupabaseClient();
  if (!c) return { users: [], events: [] };

  const { data: usersData, error: usersError } = await c.from('circle_users').select('*').eq('circle_id', id);
  if (usersError) console.error('Error fetching users:', usersError);

  const { data: eventsData, error: eventsError } = await c.from('events').select('*').eq('circle_id', id);
  if (eventsError) console.error('Error fetching events:', eventsError);

  return {
    users: (usersData || []).map(x => ({ ...x, active: true })),
    events: (eventsData || []).map(x => ({ ...x, userId: x.user_id, startTime: x.start_time }))
  };
};

export const syncEventToCloud = async (e: Omit<ScheduleEvent, 'id'>, id: string) => {
  const c = getSupabaseClient();
  if (!c) return;

  const { error } = await c.from('events').insert([{ user_id: e.userId, circle_id: id, title: e.title, day: e.day, start_time: e.startTime, duration: e.duration }]);
  if (error) console.error('Error syncing event:', error);
};

export const deleteEventFromCloud = async (id: string) => {
  const c = getSupabaseClient();
  if (!c) return;

  const { error } = await c.from('events').delete().eq('id', id);
  if (error) console.error('Error deleting event:', error);
};

export const subscribeToCircle = (id: string, cb: () => void) => {
  const c = getSupabaseClient();
  if (!c) return { unsubscribe: () => {} };

  return c.channel(id).on('postgres_changes', { event: '*', schema: 'public' }, cb).subscribe();
};
