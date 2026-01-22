
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ScheduleEvent, User } from '../types';

let cachedClient: SupabaseClient | null = null;

const formatSupabaseError = (message: string) => {
  if (message.includes('relation') && message.includes('does not exist')) {
    return 'Supabase tables are missing. Please create the required tables: circles, circle_users, events.';
  }
  if (message.toLowerCase().includes('row-level security')) {
    return 'Row-level security is blocking access. Please add policies or disable RLS for the required tables.';
  }
  if (message.toLowerCase().includes('permission denied')) {
    return 'Supabase permissions are insufficient. Check your anon key or table policies.';
  }
  return message;
};

export const getSupabaseCredentials = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  return {
    url: localStorage.getItem('synccircle_cloud_url') || envUrl || '',
    key: localStorage.getItem('synccircle_cloud_key') || envKey || ''
  };
};

export const getSupabaseClient = () => {
  const { url, key } = getSupabaseCredentials();
  if (!url || !key) return null;
  if (!cachedClient) cachedClient = createClient(url, key);
  return cachedClient;
};

export const resetSupabaseClient = () => { cachedClient = null; };

export const generateSuperLink = (id: string) => {
  const { url, key } = getSupabaseCredentials();
  const base = `${window.location.origin}${window.location.pathname}?group=${id}`;
  return `${base}&s_url=${encodeURIComponent(url)}&s_key=${encodeURIComponent(key)}`;
};

export const ensureCircleInCloud = async (id: string, name: string) => {
  const c = getSupabaseClient();
  if (!c) return 'Supabase credentials are missing.';

  const { data, error } = await c.from('circles').select('id').eq('id', id).maybeSingle();
  if (error) return `Unable to check calendar: ${formatSupabaseError(error.message)}`;
  if (!data) {
    const { error: insertError } = await c.from('circles').insert({ id, name });
    if (insertError) return `Unable to create calendar: ${formatSupabaseError(insertError.message)}`;
  }

  return null;
};

export const ensureUserInCloud = async (user: User, circleId: string) => {
  const c = getSupabaseClient();
  if (!c) return 'Supabase credentials are missing.';

  const { error } = await c.from('circle_users').upsert({ id: user.id, circle_id: circleId, name: user.name, color: user.color });
  if (error) return `Unable to save profile: ${formatSupabaseError(error.message)}`;

  return null;
};

export const fetchCircleData = async (id: string) => {
  const c = getSupabaseClient();
  if (!c) return { users: [], events: [], error: 'Supabase credentials are missing.' };

  const { data: usersData, error: usersError } = await c.from('circle_users').select('*').eq('circle_id', id);

  const { data: eventsData, error: eventsError } = await c.from('events').select('*').eq('circle_id', id);
  const errorMessage = usersError?.message || eventsError?.message;

  return {
    users: (usersData || []).map(x => ({ ...x, active: true })),
    events: (eventsData || []).map(x => ({
      ...x,
      userId: x.user_id,
      startTime: x.start_time,
      startDate: x.start_date,
      endDate: x.end_date
    })),
    error: errorMessage ? `Unable to load calendar data: ${formatSupabaseError(errorMessage)}` : null
  };
};

export const syncEventToCloud = async (e: Omit<ScheduleEvent, 'id'>, id: string) => {
  const c = getSupabaseClient();
  if (!c) return 'Supabase credentials are missing.';

  const { error } = await c.from('events').insert([
    {
      user_id: e.userId,
      circle_id: id,
      title: e.title,
      day: e.day,
      start_time: e.startTime,
      duration: e.duration,
      start_date: e.startDate,
      end_date: e.endDate
    }
  ]);
  if (error) return `Unable to sync event: ${formatSupabaseError(error.message)}`;

  return null;
};

export const deleteEventFromCloud = async (id: string) => {
  const c = getSupabaseClient();
  if (!c) return 'Supabase credentials are missing.';

  const { error } = await c.from('events').delete().eq('id', id);
  if (error) return `Unable to delete event: ${formatSupabaseError(error.message)}`;

  return null;
};

export const subscribeToCircle = (id: string, cb: () => void) => {
  const c = getSupabaseClient();
  if (!c) return { unsubscribe: () => {} };

  return c.channel(id).on('postgres_changes', { event: '*', schema: 'public' }, cb).subscribe();
};
