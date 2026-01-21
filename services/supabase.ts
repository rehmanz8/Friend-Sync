
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ScheduleEvent, User } from '../types';

let cachedClient: SupabaseClient | null = null;

const getCredentials = () => {
  const params = new URLSearchParams(window.location.search);
  
  const urlFromUrl = params.get('s_url');
  const keyFromUrl = params.get('s_key');
  
  if (urlFromUrl && keyFromUrl) {
    localStorage.setItem('synccircle_cloud_url', urlFromUrl);
    localStorage.setItem('synccircle_cloud_key', keyFromUrl);
  }

  const url = process.env.SUPABASE_URL || localStorage.getItem('synccircle_cloud_url') || '';
  const key = process.env.SUPABASE_ANON_KEY || localStorage.getItem('synccircle_cloud_key') || '';

  return { url, key };
};

export const getSupabaseClient = () => {
  if (cachedClient) return cachedClient;
  
  const { url, key } = getCredentials();
  if (!url || !key) return null;

  try {
    cachedClient = createClient(url, key);
    return cachedClient;
  } catch (err) {
    return null;
  }
};

export const generateSuperLink = (circleId: string) => {
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?group=${circleId}`;
};

export const ensureCircleInCloud = async (id: string, name: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  await client.from('circles').upsert({ id, name }, { onConflict: 'id' });
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
  if (!client) return { users: [], events: [], circleName: 'Local Calendar' };
  
  try {
    const [uRes, eRes, cRes] = await Promise.all([
      client.from('circle_users').select('*').eq('circle_id', circleId),
      client.from('events').select('*').eq('circle_id', circleId),
      client.from('circles').select('name').eq('id', circleId).maybeSingle()
    ]);
    
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

export const deleteEventFromCloud = async (eventId: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  await client.from('events').delete().eq('id', eventId);
};

export const subscribeToCircle = (circleId: string, onUpdate: () => void) => {
  const client = getSupabaseClient();
  if (!client) return { unsubscribe: () => {} };
  
  const channel = client.channel(`circle-${circleId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `circle_id=eq.${circleId}` }, () => onUpdate())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'circle_users', filter: `circle_id=eq.${circleId}` }, () => onUpdate())
    .subscribe();

  return channel;
};
