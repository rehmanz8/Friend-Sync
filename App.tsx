import React, { useState, useEffect, useCallback } from 'react';
import { User, ScheduleEvent } from './types';
import { COLORS } from './constants';
import Sidebar from './components/Sidebar';
import CalendarGrid from './components/CalendarGrid';
import EventForm from './components/EventForm';
import AuthScreen from './components/AuthScreen';
import AddPersonModal from './components/AddPersonModal';
import LandingScreen from './components/LandingScreen';
import { 
  fetchCircleData, 
  syncEventToCloud, 
  subscribeToCircle, 
  ensureUserInCloud, 
  ensureCircleInCloud, 
  deleteEventFromCloud, 
  getSupabaseClient, 
  generateSuperLink,
  resetSupabaseClient,
  getSupabaseCredentials
} from './services/supabase';

const generateId = () => crypto.randomUUID();

const App: React.FC = () => {
  const [sessionId, setSessionId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('group'));
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('synccircle_profile');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [cloudActive, setCloudActive] = useState(() => !!getSupabaseClient());
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const safeUpdateUrl = (url: string) => {
    try {
      window.history.pushState({}, '', url);
    } catch (e) {
      console.warn('URL update suppressed:', e);
    }
  };

  const loadData = useCallback(async (id: string) => {
    setIsSyncing(true);
    try {
      const { users: cloudUsers, events: cloudEvents, error } = await fetchCircleData(id);
      if (error) {
        setCloudError(error);
        return;
      }
      setUsers(cloudUsers);
      setEvents(cloudEvents);
      setCloudError(null);
    } catch (err) {
      console.error(err);
      setCloudError('Unable to load calendar data. Check your Supabase credentials.');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get('s_url');
    const sharedKey = params.get('s_key');
    const group = params.get('group');

    if (sharedUrl && sharedKey) {
      localStorage.setItem('synccircle_cloud_url', sharedUrl);
      localStorage.setItem('synccircle_cloud_key', sharedKey);
      resetSupabaseClient();
      setCloudActive(true);
      setCloudError(null);
      const nextUrl = group ? `?group=${group}` : window.location.pathname;
      safeUpdateUrl(nextUrl);
    }
  }, []);

  useEffect(() => {
    if (!sessionId || !cloudActive) return;
    loadData(sessionId);
    const subscription = subscribeToCircle(sessionId, () => loadData(sessionId));
    return () => { subscription.unsubscribe(); };
  }, [sessionId, cloudActive, loadData]);

  const handleCloudSetup = (url: string, key: string) => {
    if (!url.trim() || !key.trim()) {
      setCloudError('Please enter both a Supabase project URL and anon key.');
      return;
    }
    localStorage.setItem('synccircle_cloud_url', url);
    localStorage.setItem('synccircle_cloud_key', key);
    resetSupabaseClient();
    setCloudActive(true);
    setCloudError(null);
  };

  const handleCreateUser = async (name: string) => {
    if (!sessionId || !cloudActive) return;
    const newUser: User = {
      id: generateId(),
      name,
      color: COLORS[users.length % COLORS.length],
      active: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    const error = await ensureUserInCloud(newUser, sessionId);
    if (error) {
      setCloudError(error);
      return;
    }
    setCurrentUser(newUser);
    localStorage.setItem('synccircle_profile', JSON.stringify(newUser));
    setShowAddPersonModal(false);
    loadData(sessionId);
  };

  const handleCreateCalendar = async () => {
    const newId = generateId();
    const error = await ensureCircleInCloud(newId, "Shared Calendar");
    if (error) {
      setCloudError(error);
      return;
    }
    safeUpdateUrl(`?group=${newId}`);
    setSessionId(newId);
    setShowAddPersonModal(true); // Prompt for name immediately after creating
  };

  const handleAddEvent = async (event: Omit<ScheduleEvent, 'id'>) => {
    if (!sessionId) return;
    const error = await syncEventToCloud(event, sessionId);
    if (error) {
      setCloudError(error);
      return;
    }
    loadData(sessionId);
    setAddingEvent(false);
  };

  const handleDeleteEvent = async (id: string) => {
    if (!sessionId) return;
    const error = await deleteEventFromCloud(id);
    if (error) {
      setCloudError(error);
      return;
    }
    loadData(sessionId);
  };

  const copyLink = () => {
    if (!sessionId) return;
    const link = generateSuperLink(sessionId);
    navigator.clipboard.writeText(link);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!cloudActive) {
    const { url, key } = getSupabaseCredentials();
    return <AuthScreen onActivate={handleCloudSetup} error={cloudError} initialUrl={url} initialKey={key} />;
  }
  if (!sessionId) return <LandingScreen onCreate={handleCreateCalendar} />;
  
  // If we have a session but no current user, we must ask for a name
  if (!currentUser && users.length === 0 && !showAddPersonModal) {
    setShowAddPersonModal(true);
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans">
      <Sidebar 
        users={users} 
        onToggleUser={(id) => setUsers(u => u.map(x => x.id === id ? {...x, active: !x.active} : x))}
        onToggleAll={(a) => setUsers(u => u.map(x => ({...x, active: a})))}
        onAddPerson={() => setShowAddPersonModal(true)}
        currentUser={currentUser?.id || null}
        onSelectUser={(user) => {
            setCurrentUser(user);
            localStorage.setItem('synccircle_profile', JSON.stringify(user));
        }}
      />
      
      <main className="flex-1 flex flex-col p-6 gap-6 overflow-hidden">
        {cloudError && (
          <div className="px-4">
            <div className="flex items-center justify-between gap-4 bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-2xl text-xs font-bold">
              <span>{cloudError}</span>
              <button onClick={() => setCloudError(null)} className="text-rose-400 hover:text-rose-600">Dismiss</button>
            </div>
          </div>
        )}
        <header className="flex justify-between items-center px-4 shrink-0">
          <div>
            <h2 className="text-2xl font-black tracking-tight">Shared Calendar</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Live Collaboration Room</p>
          </div>
          <div className="flex gap-3">
            <button onClick={copyLink} className={`px-6 py-3 rounded-2xl text-xs font-black transition-all shadow-sm ${isCopied ? 'bg-emerald-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>
              {isCopied ? 'Invite Link Copied!' : 'Copy Invite Link'}
            </button>
            <button 
              disabled={!currentUser}
              onClick={() => setAddingEvent(true)} 
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black hover:bg-indigo-700 shadow-lg shadow-indigo-100 disabled:opacity-50"
            >
              + Add My Event
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col">
            <CalendarGrid 
              users={users} 
              events={events} 
              onDeleteEvent={handleDeleteEvent} 
              onEditEvent={() => {}} 
              currentDate={new Date()} 
            />
        </div>
      </main>

      {addingEvent && currentUser && (
        <EventForm userId={currentUser.id} onAdd={handleAddEvent} onClose={() => setAddingEvent(false)} />
      )}
      
      {showAddPersonModal && (
        <AddPersonModal 
            onConfirm={handleCreateUser} 
            onClose={() => sessionId && users.length > 0 && setShowAddPersonModal(false)} 
            canCancel={users.length > 0}
        />
      )}
    </div>
  );
};

export default App;
