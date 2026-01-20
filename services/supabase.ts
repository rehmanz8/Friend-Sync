
import { createClient } from '@supabase/supabase-js';
import { ScheduleEvent, User } from '../types';

/**
 * Safely get environment variables without crashing the browser
 */
const getEnv = (key: string) => {
  try {
    // Check global process object (standard in Vercel/Node envs)
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
    // Check for standard bundler injection (Vite/ESBuild)
    if ((window as any).import?.meta?.env) {
      return (window as any).import.meta.env[key];
    }
  } catch (e) {
    console.warn(`Could not safely read env key: ${key}`);
  }
  return '';
};

const getSupabase = () => {
  const url = getEnv('SUPABASE_URL');
  const key = getEnv('SUPABASE_ANON_KEY');

  if (!url || !key) {
    console.error("Supabase credentials missing. App will run in fallback mode.");
    return null;
  }

  try {
    return createClient(url, key);
  } catch (err) {
    console.error("Supabase Initialization Failed:", err);
    return null;
  }
};

export const supabase = getSupabase();

export const ensureCircleInCloud = async (id: string, name: string) => {
  if (!supabase) throw new Error("Database connection not configured.");
  const { error } = await supabase
    .from('circles')
    .upsert({ id, name }, { onConflict: 'id' });
  
  if (error) throw error;
};

export const ensureUserInCloud = async (user: User, circleId: string) => {
  if (!supabase) throw new Error("Database connection not configured.");
  const { data, error } = await supabase
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
  if (!supabase) return { users: [], events: [], circleName: 'SyncCircle' };
  try {
    const [uRes, eRes, cRes] = await Promise.all([
      supabase.from('circle_users').select('*').eq('circle_id', circleId),
      supabase.from('events').select('*').eq('circle_id', circleId),
      supabase.from('circles').select('name').eq('id', circleId).single()
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
    console.error("Supabase Fetch Failed:", err);
    return { users: [], events: [], circleName: 'SyncCircle' };
  }
};

export const syncEventToCloud = async (event: Omit<ScheduleEvent, 'id'>, circleId: string) => {
  if (!supabase) throw new Error("Database connection not configured.");
  const { data, error } = await supabase
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
  if (!supabase) return;
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);
  if (error) throw error;
};

export const subscribeToCircle = (circleId: string, onUpdate: () => void) => {
  if (!supabase) return { unsubscribe: () => {} };
  return supabase
    .channel(`circle-${circleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'events', filter: `circle_id=eq.${circleId}` },
      onUpdate
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'circle_users', filter: `circle_id=eq.${circleId}` },
      onUpdate
    )
    .subscribe();
};
