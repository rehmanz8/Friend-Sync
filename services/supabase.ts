
import { createClient } from '@supabase/supabase-js';
import { ScheduleEvent, User } from '../types';

// These would normally be in process.env
const supabaseUrl = 'https://your-project-url.supabase.co';
const supabaseKey = 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * FETCHING DATA
 */
export const fetchCircleData = async (circleId: string) => {
  // 1. Get Users
  const { data: users, error: uError } = await supabase
    .from('circle_users')
    .select('*')
    .eq('circle_id', circleId);

  // 2. Get Events
  const { data: events, error: eError } = await supabase
    .from('events')
    .select('*')
    .eq('circle_id', circleId);

  if (uError || eError) throw new Error("Cloud fetch failed");
  
  return { users, events };
};

/**
 * SYNCING DATA
 */
export const syncEventToCloud = async (event: Omit<ScheduleEvent, 'id'>, circleId: string) => {
  const { data, error } = await supabase
    .from('events')
    .insert([{ ...event, circle_id: circleId }])
    .select();
    
  if (error) throw error;
  return data[0];
};

/**
 * REAL-TIME SUBSCRIPTION
 * This is the magic part that makes your friends' changes appear on your screen instantly.
 */
export const subscribeToCircle = (circleId: string, onUpdate: () => void) => {
  return supabase
    .channel(`circle-${circleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'events', filter: `circle_id=eq.${circleId}` },
      () => onUpdate()
    )
    .subscribe();
};
