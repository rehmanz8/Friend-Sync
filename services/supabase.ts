
import { createClient } from '@supabase/supabase-js';
import { ScheduleEvent, User } from '../types';

// These should be set in your environment (e.g., Vercel or local .env)
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * CIRCLE OPERATIONS
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
    })
    .select();
  
  if (error) throw error;
  return data[0];
};

/**
 * FETCHING DATA
 */
export const fetchCircleData = async (circleId: string) => {
  // 1. Get Users
  const { data: usersData, error: uError } = await supabase
    .from('circle_users')
    .select('*')
    .eq('circle_id', circleId);

  // 2. Get Events
  const { data: eventsData, error: eError } = await supabase
    .from('events')
    .select('*')
    .eq('circle_id', circleId);

  if (uError || eError) throw new Error("Cloud fetch failed");
  
  // Map Supabase schema back to our App Types
  const users: User[] = (usersData || []).map(u => ({
    id: u.id,
    name: u.name,
    color: u.color,
    avatar: u.avatar_url,
    timezone: u.timezone,
    active: true
  }));

  const events: ScheduleEvent[] = (eventsData || []).map(e => ({
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
};

/**
 * SYNCING DATA
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
  return data[0];
};

export const deleteEventFromCloud = async (eventId: string) => {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);
  if (error) throw error;
};

/**
 * REAL-TIME SUBSCRIPTION
 */
export const subscribeToCircle = (circleId: string, onUpdate: (payload: any) => void) => {
  return supabase
    .channel(`circle-${circleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'events', filter: `circle_id=eq.${circleId}` },
      (payload) => onUpdate(payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'circle_users', filter: `circle_id=eq.${circleId}` },
      (payload) => onUpdate(payload)
    )
    .subscribe();
};
