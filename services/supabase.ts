
import { createClient } from '@supabase/supabase-js';
import { ScheduleEvent, User } from '../types';

// These should be set in your Vercel Environment Variables
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Ensures user profile exists in cloud
 */
export const ensureUserInCloud = async (user: User, circleId: string) => {
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

/**
 * Fetches all circle data (users + events)
 */
export const fetchCircleData = async (circleId: string) => {
  try {
    const [uRes, eRes] = await Promise.all([
      supabase.from('circle_users').select('*').eq('circle_id', circleId),
      supabase.from('events').select('*').eq('circle_id', circleId)
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
    
    return { users, events };
  } catch (err) {
    console.error("Supabase Fetch Failed:", err);
    return { users: [], events: [] };
  }
};

/**
 * Push single event to cloud
 */
export const syncEventToCloud = async (event: Omit<ScheduleEvent, 'id'>, circleId: string) => {
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

/**
 * Delete event from cloud
 */
export const deleteEventFromCloud = async (eventId: string) => {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);
  if (error) throw error;
};

/**
 * Real-time subscription to circle updates
 */
export const subscribeToCircle = (circleId: string, onUpdate: () => void) => {
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
