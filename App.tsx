
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
  supabase
} from './services/supabase';

// Safe UUID generation
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const App: React.FC = () => {
  const [sessionId, setSessionId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('group');
  });

  const [groupName, setGroupName] = useState<string>('SyncCircle');
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [view, setView] = useState<AppView>('calendar');
  const [currentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    if (!sessionId) return null;
    return localStorage.getItem(`synccircle_user_${sessionId}`);
  });

  const [suggestions, setSuggestions] = useState<{ day: string; time: string; reason: string }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  const loadCloudData = useCallback(async (id: string) => {
    setIsCloudSyncing(true);
    try {
      const { users: cloudUsers, events: cloudEvents, circleName } = await fetchCircleData(id);
      setUsers(cloudUsers);
      setEvents(cloudEvents);
      setGroupName(circleName);
    } catch (e) {
      console.error("Cloud Fetch Error:", e);
    } finally {
      setIsCloudSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionId || !supabase) return;
    loadCloudData(sessionId);
    const subscription = subscribeToCircle(sessionId, () => loadCloudData(sessionId));
    return () => { subscription.unsubscribe(); };
  }, [sessionId, loadCloudData]);

  if (!supabase) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-900 p-10 text-center font-sans">
        <div className="max-w-md bg-white p-12 rounded-[3rem] shadow-2xl">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Configuration Needed</h1>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">
            The app can't connect to Supabase. Make sure you added <b>SUPABASE_URL</b> and <b>SUPABASE_ANON_KEY</b> to your environment variables.
          </p>
          <button onClick={() => window.location.reload()} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest">Retry Connection</button>
        </div>
      </div>
    );
  }

  const handleOnboard = async (userName: string, circleName: string, avatar?: string) => {
    setIsCloudSyncing(true);
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

    try {
      await ensureCircleInCloud(activeSessionId, circleName || 'SyncCircle');
      await ensureUserInCloud(newUser, activeSessionId);
      
      localStorage.setItem(`synccircle_user_${activeSessionId}`, newUser.id);
      setGroupName(circleName || 'SyncCircle');
      setCurrentUser(newUser.id);
      setSessionId(activeSessionId);
      
      const newUrl = `${window.location.origin}${window.location.pathname}?group=${activeSessionId}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
      await loadCloudData(activeSessionId);
    } catch (e) {
      console.error(e);
      alert("Check the console for errors. Usually this means the SQL script wasn't run or tables are missing.");
    } finally {
      setIsCloudSyncing(false);
    }
  };

  if (!sessionId || !currentUser) {
    return <LandingPage 
      isJoining={!!sessionId} 
      onComplete={handleOnboard}
      isSyncing={isCloudSyncing}
    />;
  }

  const currentUserObj = users.find(u => u.id === currentUser);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans selection:bg-indigo-100 selection:text-indigo-900">
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
        onNewCircle={() => {
          window.location.href = window.location.origin + window.location.pathname;
        }}
      />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-20 px-8 flex items-center justify-between z-10 bg-white border-b border-slate-100 shrink-0">
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              {groupName}
              <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100">
                <div className={`w-1.5 h-1.5 rounded-full ${isCloudSyncing ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse relative pulse-ring`} />
                <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">
                  {isCloudSyncing ? 'Syncing' : 'Live'}
                </span>
              </div>
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
               <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Share this URL with friends</span>
               <button 
                onClick={() => { navigator.clipboard.writeText(window.location.href); alert('Invite link copied!'); }}
                className="text-[10px] text-indigo-500 font-bold hover:underline"
               >
                 Copy Link
               </button>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
              <button onClick={() => setView('calendar')} className={`px-5 py-2 text-xs font-black rounded-xl transition-all ${view === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Dashboard</button>
              <button onClick={() => setView('setup')} className={`px-5 py-2 text-xs font-black rounded-xl transition-all ${view === 'setup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Studio</button>
            </div>
            <button 
              onClick={async () => { 
                setLoadingSuggestions(true); 
                const s = await getSmartSuggestions(users, events); 
                setSuggestions(s); 
                setLoadingSuggestions(false); 
              }} 
              disabled={loadingSuggestions}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 disabled:opacity-50 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2"
            >
              {loadingSuggestions ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '✨ AI Suggest'}
            </button>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-hidden flex gap-8">
          <CalendarGrid 
            users={users} 
            events={events} 
            onDeleteEvent={deleteEventFromCloud} 
            onEditEvent={() => {}} 
            currentDate={new Date(currentDate)} 
          />
          
          {suggestions.length > 0 && (
            <aside className="w-80 bg-white rounded-[3rem] border border-slate-200 p-10 overflow-y-auto animate-in slide-in-from-right-12 duration-500 shadow-2xl shrink-0">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-black text-slate-900 text-xl tracking-tighter">AI Ideas</h3>
                <button onClick={() => setSuggestions([])} className="text-slate-300 hover:text-slate-900 font-bold p-2 transition-colors">✕</button>
              </div>
              <div className="space-y-6">
                {suggestions.map((s, i) => (
                  <div key={i} className="p-8 bg-indigo-50/50 rounded-[2.2rem] border border-indigo-100/30 group hover:bg-white hover:shadow-xl transition-all duration-300 cursor-default">
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-8 animate-in fade-in duration-300">
          <div className="w-full max-w-5xl h-[85vh]">
            <TimetableEntry 
              currentUser={currentUserObj} 
              onAddBatch={async (newEvents) => {
                setIsCloudSyncing(true);
                try {
                  await Promise.all(newEvents.map(e => syncEventToCloud(e, sessionId!)));
                  setView('calendar');
                } catch (e) {
                  alert("Failed to save. Check your connection.");
                } finally {
                  setIsCloudSyncing(false);
                }
              }} 
              onCancel={() => setView('calendar')} 
            />
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
    <div className="h-screen w-full flex items-center justify-center bg-slate-900 p-6 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
         <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/20 blur-[200px] rounded-full" />
         <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-600/20 blur-[200px] rounded-full" />
      </div>

      <div className="max-w-xl w-full bg-white rounded-[4rem] p-16 shadow-2xl z-10 animate-in zoom-in-95 duration-700 text-center relative border border-white/20">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[2rem] mx-auto mb-8 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/30">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
        </div>
        
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2 leading-tight">
          {isJoining ? 'Join the Circle' : 'SyncCircle'}
        </h1>
        <p className="text-slate-400 font-medium mb-12 text-base">
          {isJoining ? 'Enter your details to join your friends.' : 'Real-time collaborative scheduling for friend groups.'}
        </p>
        
        <div className="space-y-8 text-left">
          <div className="flex flex-col items-center">
             <div onClick={() => fileRef.current?.click()} className="w-24 h-24 rounded-full bg-slate-50 border-4 border-white shadow-xl overflow-hidden cursor-pointer group relative ring-1 ring-slate-100">
               {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-200"><svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg></div>}
               <div className="absolute inset-0 bg-indigo-600/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"><span className="text-[10px] font-black text-white uppercase tracking-widest">Photo</span></div>
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

          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Your Name</label>
              <input className="w-full p-6 bg-slate-50 border-none rounded-[1.8rem] font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" placeholder="E.g. Alex" value={uName} onChange={(e) => setUName(e.target.value)} />
            </div>

            {!isJoining && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Circle Name</label>
                <input className="w-full p-6 bg-slate-50 border-none rounded-[1.8rem] font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" placeholder="E.g. The Squad" value={cName} onChange={(e) => setCName(e.target.value)} />
              </div>
            )}
          </div>

          <button 
            disabled={!uName || (!isJoining && !cName) || isSyncing}
            onClick={() => onComplete(uName, cName || 'SyncCircle', avatar)}
            className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50 mt-4 flex items-center justify-center gap-3"
          >
            {isSyncing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            {isJoining ? 'Join Circle' : 'Start Circle'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
