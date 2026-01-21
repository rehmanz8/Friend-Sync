
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, ScheduleEvent, AppView } from './types';
import { COLORS } from './constants';
import Sidebar from './components/Sidebar';
import CalendarGrid from './components/CalendarGrid';
import TimetableEntry from './components/TimetableEntry';
import { getSmartSuggestions } from './services/gemini';
import { 
  fetchCircleData, 
  syncEventToCloud, 
  subscribeToCircle, 
  ensureUserInCloud,
  ensureCircleInCloud,
  deleteEventFromCloud,
  getSupabaseClient
} from './services/supabase';

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

const App: React.FC = () => {
  const [sessionId, setSessionId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('group'));
  const [groupName, setGroupName] = useState<string>('SyncCircle');
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [view, setView] = useState<AppView>('calendar');
  const [showCloudWizard, setShowCloudWizard] = useState(false);
  
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    if (!sessionId) return localStorage.getItem('synccircle_current_user_local');
    return localStorage.getItem(`synccircle_user_${sessionId}`);
  });

  const [suggestions, setSuggestions] = useState<{ day: string; time: string; reason: string }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  const isCloudEnabled = !!getSupabaseClient();

  const loadData = useCallback(async (id: string | null) => {
    if (!id) return;
    setIsCloudSyncing(true);
    
    const client = getSupabaseClient();
    if (client) {
      try {
        const { users: cloudUsers, events: cloudEvents, circleName } = await fetchCircleData(id);
        if (cloudUsers.length > 0) {
          setUsers(cloudUsers);
          setEvents(cloudEvents);
          setGroupName(circleName);
          setIsCloudSyncing(false);
          return;
        }
      } catch (e) {
        console.warn("Cloud load failed:", e);
      }
    }

    const localUsers = JSON.parse(localStorage.getItem(`synccircle_users_${id}`) || '[]');
    const localEvents = JSON.parse(localStorage.getItem(`synccircle_events_${id}`) || '[]');
    const localName = localStorage.getItem(`synccircle_name_${id}`) || 'SyncCircle';
    
    setUsers(localUsers);
    setEvents(localEvents);
    setGroupName(localName);
    setIsCloudSyncing(false);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    loadData(sessionId);
    const client = getSupabaseClient();
    if (client) {
      const subscription = subscribeToCircle(sessionId, () => loadData(sessionId));
      return () => { subscription.unsubscribe(); };
    }
  }, [sessionId, loadData]);

  const handleOnboard = async (userName: string, circleName: string, avatar?: string) => {
    const activeSessionId = sessionId || generateId();
    const newUserId = generateId();
    const newUser: User = { 
      id: newUserId, 
      name: userName, 
      color: COLORS[Math.floor(Math.random() * COLORS.length)], 
      active: true, 
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      avatar 
    };

    if (getSupabaseClient()) {
      setIsCloudSyncing(true);
      try {
        await ensureCircleInCloud(activeSessionId, circleName || 'SyncCircle');
        await ensureUserInCloud(newUser, activeSessionId);
      } catch (e) {
        console.error("Cloud Onboard Failed:", e);
      } finally {
        setIsCloudSyncing(false);
      }
    }

    const existingUsers = JSON.parse(localStorage.getItem(`synccircle_users_${activeSessionId}`) || '[]');
    const updatedUsers = [...existingUsers, newUser];
    localStorage.setItem(`synccircle_users_${activeSessionId}`, JSON.stringify(updatedUsers));
    localStorage.setItem(`synccircle_name_${activeSessionId}`, circleName || 'SyncCircle');
    localStorage.setItem(`synccircle_user_${activeSessionId}`, newUser.id);
    localStorage.setItem('synccircle_current_user_local', newUser.id);

    setUsers(updatedUsers);
    setGroupName(circleName || 'SyncCircle');
    setCurrentUser(newUser.id);
    setSessionId(activeSessionId);
    
    const newUrl = `${window.location.origin}${window.location.pathname}?group=${activeSessionId}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const handleAddBatch = async (newEvents: Omit<ScheduleEvent, 'id'>[]) => {
    const eventsWithIds: ScheduleEvent[] = newEvents.map(e => ({ ...e, id: generateId() }));
    if (getSupabaseClient() && sessionId) {
      setIsCloudSyncing(true);
      try {
        await Promise.all(newEvents.map(e => syncEventToCloud(e, sessionId)));
        await loadData(sessionId);
      } catch (e) {
        setEvents(prev => [...prev, ...eventsWithIds]);
      } finally {
        setIsCloudSyncing(false);
      }
    } else {
      const updatedEvents = [...events, ...eventsWithIds];
      setEvents(updatedEvents);
      if (sessionId) localStorage.setItem(`synccircle_events_${sessionId}`, JSON.stringify(updatedEvents));
    }
    setView('calendar');
  };

  const handleDeleteEvent = async (id: string) => {
    if (getSupabaseClient()) {
      setIsCloudSyncing(true);
      try {
        await deleteEventFromCloud(id);
        await loadData(sessionId!);
      } catch (e) {
        setEvents(prev => prev.filter(e => e.id !== id));
      } finally {
        setIsCloudSyncing(false);
      }
    } else {
      const updatedEvents = events.filter(e => e.id !== id);
      setEvents(updatedEvents);
      if (sessionId) localStorage.setItem(`synccircle_events_${sessionId}`, JSON.stringify(updatedEvents));
    }
  };

  if (!sessionId || !currentUser || !users.find(u => u.id === currentUser)) {
    return <LandingPage isJoining={!!sessionId} onComplete={handleOnboard} isSyncing={isCloudSyncing} />;
  }

  const currentUserObj = users.find(u => u.id === currentUser);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      <Sidebar 
        users={users} 
        onToggleUser={(id) => setUsers(users.map(u => u.id === id ? { ...u, active: !u.active } : u))} 
        onToggleAll={(active) => setUsers(users.map(u => ({ ...u, active })))}
        onAddUser={() => {}} 
        onUpdateUser={() => {}}
        onDeleteUser={() => {}}
        onSelectCurrentUser={setCurrentUser}
        onOpenProfile={() => setView('setup')}
        currentUser={currentUser}
        onNewCircle={() => window.location.href = window.location.origin + window.location.pathname}
      />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-20 px-8 flex items-center justify-between z-10 bg-white border-b border-slate-100 shrink-0">
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              {groupName}
              <button 
                onClick={() => setShowCloudWizard(true)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all hover:scale-105 ${isCloudEnabled ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}
              >
                <span className={`text-[8px] font-black uppercase tracking-widest ${isCloudEnabled ? 'text-indigo-600' : 'text-slate-400'}`}>
                  {isCloudSyncing ? 'Syncing...' : isCloudEnabled ? 'Live' : 'Go Live'}
                </span>
              </button>
            </h2>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
               Share: <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert('Copied Link!'); }} className="text-indigo-500 hover:underline">Copy Link</button>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={async () => { setLoadingSuggestions(true); const s = await getSmartSuggestions(users, events); setSuggestions(s); setLoadingSuggestions(false); }} 
              disabled={loadingSuggestions}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2"
            >
              {loadingSuggestions ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '✨ AI Assist'}
            </button>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-hidden flex gap-8">
          <CalendarGrid users={users} events={events} onDeleteEvent={handleDeleteEvent} onEditEvent={() => {}} currentDate={new Date()} />
          
          {suggestions.length > 0 && (
            <aside className="w-80 bg-white rounded-[3rem] border border-slate-200 p-10 overflow-y-auto shadow-2xl shrink-0">
              <div className="flex justify-between items-center mb-8"><h3 className="font-black text-slate-900 text-xl tracking-tighter">Ideas</h3><button onClick={() => setSuggestions([])} className="text-slate-300 hover:text-slate-900">✕</button></div>
              <div className="space-y-6">
                {suggestions.map((s, i) => (
                  <div key={i} className="p-8 bg-indigo-50/50 rounded-[2.2rem] border border-indigo-100/30">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">{s.day}</p>
                    <p className="font-black text-slate-900 text-lg mb-3 tracking-tight">{s.time}</p>
                    <p className="text-xs text-slate-500 font-semibold leading-relaxed">"{s.reason}"</p>
                  </div>
                ))}
              </div>
            </aside>
          )}
        </div>
      </main>

      {view === 'setup' && currentUserObj && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-8 animate-in fade-in"><div className="w-full max-w-5xl h-[85vh]"><TimetableEntry currentUser={currentUserObj} onAddBatch={handleAddBatch} onCancel={() => setView('calendar')} /></div></div>
      )}

      {showCloudWizard && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-2xl flex items-center justify-center p-8 animate-in zoom-in-95">
          <div className="bg-white rounded-[4rem] p-16 max-w-xl w-full text-center shadow-2xl">
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-4">Cloud Sync</h2>
            <p className="text-slate-400 text-sm mb-12 font-medium">Connect to Supabase for real-time collaboration.</p>
            <div className="space-y-6 text-left">
              <div>
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Supabase URL</label>
                <input id="sw-url" className="w-full p-6 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-100 font-bold mt-2" placeholder="https://xxx.supabase.co" defaultValue={localStorage.getItem('synccircle_cloud_url') || ''} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Anon Key</label>
                <input id="sw-key" className="w-full p-6 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-100 font-bold mt-2" placeholder="eyJhbGci..." defaultValue={localStorage.getItem('synccircle_cloud_key') || ''} />
              </div>
              <button onClick={() => {
                const u = (document.getElementById('sw-url') as HTMLInputElement).value;
                const k = (document.getElementById('sw-key') as HTMLInputElement).value;
                localStorage.setItem('synccircle_cloud_url', u);
                localStorage.setItem('synccircle_cloud_key', k);
                window.location.reload();
              }} className="w-full py-6 bg-indigo-600 text-white rounded-2xl font-black text-xl shadow-2xl hover:bg-indigo-700 transition-all">Save & Connect</button>
              <button onClick={() => setShowCloudWizard(false)} className="w-full py-4 text-slate-400 font-black text-sm uppercase">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LandingPage: React.FC<{ isJoining: boolean; onComplete: (un: string, cn: string, av?: string) => void, isSyncing: boolean }> = ({ isJoining, onComplete, isSyncing }) => {
  const [cName, setCName] = useState('');
  const [uName, setUName] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-900 p-6 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/20 blur-[200px] rounded-full" />
      <div className="max-w-xl w-full bg-white rounded-[4rem] p-16 shadow-2xl z-10 animate-in zoom-in-95 text-center">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">{isJoining ? 'Join the Circle' : 'SyncCircle'}</h1>
        <p className="text-slate-400 font-medium mb-12 text-base">Real-time collaborative scheduling for friends.</p>
        <div className="space-y-8 text-left">
          <div className="flex flex-col items-center">
             <div onClick={() => fileRef.current?.click()} className="w-24 h-24 rounded-full bg-slate-50 border-4 border-white shadow-xl overflow-hidden cursor-pointer group relative">
               {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-200 text-2xl">📸</div>}
               <div className="absolute inset-0 bg-indigo-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center"><span className="text-[10px] font-black text-white uppercase tracking-widest">Photo</span></div>
             </div>
             <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={(e) => {
               const file = e.target.files?.[0];
               if (file) {
                 const reader = new FileReader();
                 reader.onload = (ev) => setAvatar(ev.target?.result as string);
                 reader.readAsDataURL(file);
               }
             }} />
          </div>
          <div className="space-y-6">
            <div><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Your Name</label><input className="w-full p-6 bg-slate-50 border-none rounded-2xl font-bold mt-2" placeholder="E.g. Alex" value={uName} onChange={(e) => setUName(e.target.value)} /></div>
            {!isJoining && (<div><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Circle Name</label><input className="w-full p-6 bg-slate-50 border-none rounded-2xl font-bold mt-2" placeholder="E.g. Group Name" value={cName} onChange={(e) => setCName(e.target.value)} /></div>)}
          </div>
          <button 
            disabled={!uName || (!isJoining && !cName)} 
            onClick={() => onComplete(uName, cName, avatar)} 
            className="w-full py-6 bg-indigo-600 text-white rounded-2xl font-black text-xl shadow-2xl disabled:opacity-50 flex items-center justify-center gap-3 transition-all active:scale-95"
          >
            {isSyncing && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isJoining ? 'Join' : 'Start'} Circle
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
