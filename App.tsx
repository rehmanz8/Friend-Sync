
import React, { useState, useEffect, useCallback } from 'react';
import { User, ScheduleEvent } from './types';
import { COLORS } from './constants';
import Sidebar from './components/Sidebar';
import CalendarGrid from './components/CalendarGrid';
import EventForm from './components/EventForm';
import { 
  fetchCircleData, 
  syncEventToCloud, 
  subscribeToCircle, 
  ensureUserInCloud, 
  ensureCircleInCloud, 
  deleteEventFromCloud, 
  getSupabaseClient, 
  generateSuperLink,
  resetSupabaseClient
} from './services/supabase';

const generateId = () => crypto.randomUUID();

const App: React.FC = () => {
  const [sessionId, setSessionId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('group'));
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('synccircle_profile');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [cloudActive, setCloudActive] = useState(() => !!getSupabaseClient());
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
      const { users: cloudUsers, events: cloudEvents } = await fetchCircleData(id);
      setUsers(cloudUsers);
      setEvents(cloudEvents);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionId || !cloudActive) return;
    loadData(sessionId);
    const subscription = subscribeToCircle(sessionId, () => loadData(sessionId));
    return () => { subscription.unsubscribe(); };
  }, [sessionId, cloudActive, loadData]);

  const handleCloudSetup = (url: string, key: string) => {
    localStorage.setItem('synccircle_cloud_url', url);
    localStorage.setItem('synccircle_cloud_key', key);
    resetSupabaseClient();
    setCloudActive(true);
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
    await ensureUserInCloud(newUser, sessionId);
    setCurrentUser(newUser);
    localStorage.setItem('synccircle_profile', JSON.stringify(newUser));
    setShowAddPersonModal(false);
    loadData(sessionId);
  };

  const handleCreateCalendar = async () => {
    const newId = generateId();
    await ensureCircleInCloud(newId, "Shared Calendar");
    safeUpdateUrl(`?group=${newId}`);
    setSessionId(newId);
    setShowAddPersonModal(true); // Prompt for name immediately after creating
  };

  const handleAddEvent = async (event: Omit<ScheduleEvent, 'id'>) => {
    if (!sessionId) return;
    await syncEventToCloud(event, sessionId);
    loadData(sessionId);
    setAddingEvent(false);
  };

  const handleDeleteEvent = async (id: string) => {
    if (!sessionId) return;
    await deleteEventFromCloud(id);
    loadData(sessionId);
  };

  const copyLink = () => {
    if (!sessionId) return;
    const link = generateSuperLink(sessionId);
    navigator.clipboard.writeText(link);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!cloudActive) return <AuthScreen onActivate={handleCloudSetup} />;
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

const AuthScreen = ({ onActivate }: { onActivate: (u: string, k: string) => void }) => (
  <div className="h-screen w-full flex items-center justify-center bg-slate-100 p-6">
    <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md border border-slate-100">
      <div className="w-16 h-16 bg-indigo-600 rounded-3xl mb-8 flex items-center justify-center text-white shadow-xl rotate-3">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
      </div>
      <h1 className="text-3xl font-black mb-2 tracking-tighter">Sync Engine</h1>
      <p className="text-slate-400 text-sm mb-10 font-medium">Link your Supabase database to start collaborating.</p>
      <div className="space-y-4">
        <input id="u" className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" placeholder="Project URL" />
        <input id="k" className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" placeholder="Anon Key" />
        <button onClick={() => onActivate((document.getElementById('u') as HTMLInputElement).value, (document.getElementById('k') as HTMLInputElement).value)} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 mt-4">Connect Cloud</button>
      </div>
    </div>
  </div>
);

const AddPersonModal = ({ onConfirm, onClose, canCancel }: { onConfirm: (n: string) => void, onClose: () => void, canCancel: boolean }) => {
  const [n, setN] = useState('');
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 z-[100]">
      <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl w-full max-w-sm text-center border border-white/20 animate-in zoom-in-95 duration-300">
        <h1 className="text-3xl font-black mb-2 tracking-tighter">Who are you?</h1>
        <p className="text-slate-400 text-sm mb-10 font-medium">Your events will use your unique color.</p>
        <input 
            autoFocus
            className="w-full p-6 bg-slate-50 rounded-2xl mb-6 text-center text-xl font-black border border-slate-100 outline-none focus:ring-4 focus:ring-indigo-500/10" 
            placeholder="Your Name" 
            value={n} 
            onChange={e => setN(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && n && onConfirm(n)} 
        />
        <div className="flex gap-3">
          {canCancel && <button onClick={onClose} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-2xl font-black">Back</button>}
          <button disabled={!n} onClick={() => onConfirm(n)} className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg disabled:opacity-50">Enter Room</button>
        </div>
      </div>
    </div>
  );
};

const LandingScreen = ({ onCreate }: { onCreate: () => void }) => (
  <div className="h-screen w-full flex items-center justify-center bg-slate-100 p-6">
    <button onClick={onCreate} className="bg-indigo-600 p-16 rounded-[4rem] text-white text-center hover:scale-105 transition-all shadow-2xl shadow-indigo-200 group relative overflow-hidden">
      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10">
        <div className="w-20 h-20 bg-white/20 rounded-3xl mx-auto mb-8 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
        </div>
        <h3 className="text-4xl font-black tracking-tighter">Create New Calendar</h3>
        <p className="opacity-60 mt-4 font-bold text-lg">Start scheduling with friends in seconds.</p>
      </div>
    </button>
  </div>
);

export default App;
