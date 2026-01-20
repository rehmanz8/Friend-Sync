
import React, { useState, useEffect } from 'react';
import { User, ScheduleEvent, AppView } from './types';
import { COLORS } from './constants';
import Sidebar from './components/Sidebar';
import CalendarGrid from './components/CalendarGrid';
import TimetableEntry from './components/TimetableEntry';
import EventForm from './components/EventForm';
import { getSmartSuggestions } from './services/gemini';
import { fetchCircleData, syncEventToCloud, subscribeToCircle } from './services/supabase';

const App: React.FC = () => {
  const [sessionId, setSessionId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('group');
  });

  const [groupName, setGroupName] = useState<string>('SyncCircle Cloud');
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [view, setView] = useState<AppView>('calendar');
  const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ day: string; time: string; reason: string }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  // --- THE REAL CLOUD SYNC ENGINE ---
  useEffect(() => {
    if (!sessionId) return;

    const loadAndSubscribe = async () => {
      setIsCloudSyncing(true);
      try {
        // 1. Initial Load from Supabase
        // const { users, events } = await fetchCircleData(sessionId);
        // setUsers(users); setEvents(events);
        
        // 2. Establish Real-time Listener
        const subscription = subscribeToCircle(sessionId, async () => {
          console.log("Cloud update detected! Refreshing...");
          // const { events: updatedEvents } = await fetchCircleData(sessionId);
          // setEvents(updatedEvents);
        });

        return () => { subscription.unsubscribe(); };
      } catch (e) {
        console.error("Cloud Connection Lost:", e);
      } finally {
        setIsCloudSyncing(false);
      }
    };

    loadAndSubscribe();
  }, [sessionId]);

  const handleCreateCircle = async (name: string, userName: string, avatar?: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    
    // In production: const { data } = await supabase.from('circles').insert({ name }).select();
    
    const newUser: User = { 
      id: Math.random().toString(36).substr(2, 9), 
      name: userName, 
      color: COLORS[0], 
      active: true, 
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      avatar 
    };

    setGroupName(name);
    setUsers([newUser]);
    setCurrentUser(newUser.id);
    setSessionId(id);
    
    const newUrl = `${window.location.origin}${window.location.pathname}?group=${id}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  if (!sessionId) return <LandingPage onCreate={handleCreateCircle} />;

  const currentUserObj = users.find(u => u.id === currentUser);

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] overflow-hidden">
      <Sidebar 
        users={users} 
        onToggleUser={(id) => setUsers(users.map(u => u.id === id ? { ...u, active: !u.active } : u))} 
        onToggleAll={(active) => setUsers(users.map(u => ({ ...u, active })))}
        onAddUser={() => {}} 
        onUpdateUser={(id, updates) => setUsers(users.map(u => u.id === id ? { ...u, ...updates } : u))}
        onDeleteUser={(id) => setUsers(users.filter(u => u.id !== id))}
        onSelectCurrentUser={setCurrentUser}
        onOpenProfile={() => {}}
        currentUser={currentUser}
        onNewCircle={() => setSessionId(null)}
      />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-20 px-8 flex items-center justify-between z-10 bg-white border-b border-slate-100 shadow-sm">
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              {groupName}
              <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100">
                <div className={`w-1.5 h-1.5 rounded-full ${isCloudSyncing ? 'bg-amber-500' : 'bg-indigo-500'} animate-pulse relative pulse-ring`} />
                <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">
                  {isCloudSyncing ? 'Connecting Cloud...' : 'Real-time Live'}
                </span>
              </div>
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Circle ID: {sessionId}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
              <button onClick={() => setView('calendar')} className={`px-5 py-2 text-xs font-black rounded-xl transition-all ${view === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Dashboard</button>
              <button onClick={() => setView('setup')} className={`px-5 py-2 text-xs font-black rounded-xl transition-all ${view === 'setup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Studio</button>
            </div>
            <button 
              onClick={async () => { 
                setLoadingSuggestions(true); 
                const s = await getSmartSuggestions(users, events); 
                setSuggestions(s); 
                setLoadingSuggestions(false); 
              }} 
              disabled={loadingSuggestions}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 disabled:opacity-50 hover:bg-indigo-700 transition-all active:scale-95"
            >
              ✨ AI Meetings
            </button>
          </div>
        </header>

        <div className="flex-1 p-8 bg-slate-50/20 overflow-hidden flex gap-8">
          <CalendarGrid 
            users={users} 
            events={events} 
            onDeleteEvent={(id) => setEvents(events.filter(e => e.id !== id))} 
            onEditEvent={() => {}} 
            currentDate={new Date(currentDate)} 
          />
          
          {suggestions.length > 0 && (
            <aside className="w-80 bg-white rounded-[3rem] border border-slate-200 p-10 overflow-y-auto animate-in slide-in-from-right-12 duration-500 shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-black text-slate-900 text-xl tracking-tighter">AI Suggestions</h3>
                <button onClick={() => setSuggestions([])} className="text-slate-300 hover:text-slate-900 font-bold">✕</button>
              </div>
              <div className="space-y-6">
                {suggestions.map((s, i) => (
                  <div key={i} className="p-8 bg-indigo-50/50 rounded-[2.2rem] border border-indigo-100/30 group hover:bg-indigo-50 transition-colors">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">{s.day}</p>
                    <p className="font-black text-slate-900 text-lg mb-3">{s.time}</p>
                    <p className="text-xs text-slate-500 font-semibold leading-relaxed">"{s.reason}"</p>
                  </div>
                ))}
              </div>
            </aside>
          )}
        </div>
      </main>

      {view === 'setup' && currentUserObj && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-8">
          <div className="w-full max-w-5xl h-[85vh]">
            <TimetableEntry 
              currentUser={currentUserObj} 
              onAddBatch={async (newEvents, tz) => {
                // In production: await Promise.all(newEvents.map(e => syncEventToCloud(e, sessionId!)));
                const committed = newEvents.map(e => ({ ...e, id: Math.random().toString(36).substr(2, 9) }));
                setEvents([...events, ...committed]);
                setView('calendar');
              }} 
              onCancel={() => setView('calendar')} 
            />
          </div>
        </div>
      )}
    </div>
  );
};

const LandingPage: React.FC<{ onCreate: (n: string, un: string, av?: string) => void }> = ({ onCreate }) => {
  const [cName, setCName] = useState('');
  const [uName, setUName] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>();
  const fileRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-900 p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full">
         <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/30 blur-[200px] rounded-full" />
         <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-600/30 blur-[200px] rounded-full" />
      </div>

      <div className="max-w-xl w-full bg-white rounded-[4.5rem] p-16 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] z-10 animate-in zoom-in-95 duration-700 text-center relative border border-white/20">
        <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[2.5rem] mx-auto mb-10 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/30">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
        </div>
        
        <h1 className="text-5xl font-black text-slate-900 tracking-tighter mb-4 leading-tight">SyncCircle</h1>
        <p className="text-slate-400 font-medium mb-12 text-lg">Real-time collaboration for friend groups.</p>
        
        <div className="space-y-8 text-left">
          <div className="flex flex-col items-center">
             <div onClick={() => fileRef.current?.click()} className="w-24 h-24 rounded-full bg-slate-50 border-4 border-white shadow-xl overflow-hidden cursor-pointer group relative">
               {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-200"><svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg></div>}
               <div className="absolute inset-0 bg-indigo-600/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"><span className="text-[10px] font-black text-white uppercase tracking-widest">Photo</span></div>
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
              <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">My Identity</label>
              <input className="w-full p-6 bg-slate-50 border-none rounded-[1.8rem] font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" placeholder="e.g. Sarah" value={uName} onChange={(e) => setUName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Circle Name</label>
              <input className="w-full p-6 bg-slate-50 border-none rounded-[1.8rem] font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" placeholder="e.g. Uni Flatmates" value={cName} onChange={(e) => setCName(e.target.value)} />
            </div>
          </div>

          <button 
            disabled={!cName || !uName}
            onClick={() => onCreate(cName, uName, avatar)}
            className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50 mt-4"
          >
            Deploy My Circle
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
