
import { createClient } from '@supabase/supabase-js';
import { ScheduleEvent, User } from '../types';

/**
 * Gets credentials from either process.env or localStorage
 */
const getCredentials = () => {
  const envUrl = process.env.SUPABASE_URL;
  const envKey = process.env.SUPABASE_ANON_KEY;
  
  const localUrl = localStorage.getItem('synccircle_cloud_url');
  const localKey = localStorage.getItem('synccircle_cloud_key');

  return {
    url: envUrl || localUrl || '',
    key: envKey || localKey || ''
  };
};

export const getSupabaseClient = () => {
  try {
    const { url, key } = getCredentials();
    if (!url || !key) return null;
    return createClient(url, key);
  } catch (err) {
    return null;
  }
};

export const supabase = getSupabaseClient();

export const ensureCircleInCloud = async (id: string, name: string) => {
  const client = getSupabaseClient();
  if (!client) throw new Error("Cloud not configured.");
  const { error } = await client
    .from('circles')
    .upsert({ id, name }, { onConflict: 'id' });
  if (error) throw error;
};

export const ensureUserInCloud = async (user: User, circleId: string) => {
  const client = getSupabaseClient();
  if (!client) throw new Error("Cloud not configured.");
  const { data, error } = await client
    .from('circle_users')
    .upsert({
      id: user.id,
      circle_id: circleId,
      name: user.name,
      color: user.color,
      avatar_url: user.avatar,
      timezone: user.timezone
    }, { onConflict: 'id' })
    .select();
  if (error) throw error;
  return data?.[0];
};

export const fetchCircleData = async (circleId: string) => {
  const client = getSupabaseClient();
  if (!client) return { users: [], events: [], circleName: 'SyncCircle' };
  try {
    const [uRes, eRes, cRes] = await Promise.all([
      client.from('circle_users').select('*').eq('circle_id', circleId),
      client.from('events').select('*').eq('circle_id', circleId),
      client.from('circles').select('name').eq('id', circleId).single()
    ]);
    if (uRes.error) throw uRes.error;
    if (eRes.error) throw eRes.error;
    const users: User[] = (uRes.data || []).map(u => ({
      id: u.id,
      name: u.name,
      color: u.color,
      avatar: u.avatar_url,
      timezone: u.timezone,
      active: true
    }));
    const events: ScheduleEvent[] = (eRes.data || []).map(e => ({
      id: e.id,
      userId: e.user_id,
      title: e.title,
      day: e.day,
      startTime: e.start_time,
      duration: e.duration,
      startDate: e.start_date,
      endDate: e.end_date
    }));
    return { users, events, circleName: cRes.data?.name || 'SyncCircle' };
  } catch (err) {
    return { users: [], events: [], circleName: 'SyncCircle' };
  }
};

export const syncEventToCloud = async (event: Omit<ScheduleEvent, 'id'>, circleId: string) => {
  const client = getSupabaseClient();
  if (!client) throw new Error("Cloud not configured.");
  const { data, error } = await client
    .from('events')
    .insert([{
      user_id: event.userId,
      circle_id: circleId,
      title: event.title,
      day: event.day,
      start_time: event.startTime,
      duration: event.duration,
      start_date: event.startDate,
      end_date: event.endDate
    }])
    .select();
  if (error) throw error;
  return data?.[0];
};

export const deleteEventFromCloud = async (eventId: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.from('events').delete().eq('id', eventId);
  if (error) throw error;
};

export const subscribeToCircle = (circleId: string, onUpdate: () => void) => {
  const client = getSupabaseClient();
  if (!client) return { unsubscribe: () => {} };
  return client
    .channel(`circle-${circleId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `circle_id=eq.${circleId}` }, onUpdate)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'circle_users', filter: `circle_id=eq.${circleId}` }, onUpdate)
    .subscribe();
};
