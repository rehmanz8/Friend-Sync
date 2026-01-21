
import React, { useState, useEffect, useCallback } from 'react';
import { User, ScheduleEvent, AppView } from './types';
import { COLORS } from './constants';
import Sidebar from './components/Sidebar';
import CalendarGrid from './components/CalendarGrid';
import TimetableEntry from './components/TimetableEntry';
import VoiceAssistant from './components/VoiceAssistant';
import { 
  fetchCircleData, 
  syncEventToCloud, 
  subscribeToCircle, 
  ensureUserInCloud, 
  ensureCircleInCloud, 
  deleteEventFromCloud, 
  getSupabaseClient, 
  generateSuperLink 
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
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('synccircle_profile');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [groupName, setGroupName] = useState<string>('SyncCircle');
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [view, setView] = useState<AppView>('calendar');
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);

  const isSyncConfigured = !!getSupabaseClient();

  const loadData = useCallback(async (id: string | null) => {
    if (!id || !isSyncConfigured) return;
    setIsCloudSyncing(true);
    try {
      const { users: cloudUsers, events: cloudEvents, circleName } = await fetchCircleData(id);
      if (cloudUsers.length > 0) {
        setUsers(cloudUsers);
      } else if (currentUser) {
        setUsers([currentUser]);
      }
      setEvents(cloudEvents);
      setGroupName(circleName);
    } catch (e) {
      if (currentUser) setUsers([currentUser]);
    } finally {
      setIsCloudSyncing(false);
    }
  }, [currentUser, isSyncConfigured]);

  useEffect(() => {
    if (!sessionId || !isSyncConfigured) return;
    loadData(sessionId);
    
    const client = getSupabaseClient();
    if (client) {
      const subscription = subscribeToCircle(sessionId, () => loadData(sessionId));
      return () => { subscription.unsubscribe(); };
    }
  }, [sessionId, loadData, isSyncConfigured]);

  const handleProfileComplete = async (name: string, avatar?: string) => {
    const newUser: User = {
      id: generateId(),
      name,
      avatar,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      active: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    localStorage.setItem('synccircle_profile', JSON.stringify(newUser));
    setCurrentUser(newUser);

    if (sessionId && isSyncConfigured) {
      await ensureUserInCloud(newUser, sessionId);
      await loadData(sessionId);
    }
  };

  const handleCreateCircle = async (name: string = 'Our Circle') => {
    if (!currentUser || !isSyncConfigured) return;

    const newSessionId = generateId();
    setIsCloudSyncing(true);
    try {
      await ensureCircleInCloud(newSessionId, name);
      await ensureUserInCloud(currentUser, newSessionId);
      setSessionId(newSessionId);
      window.history.pushState({}, '', `?group=${newSessionId}`);
      await loadData(newSessionId);
    } catch (e) {
      alert("Synchronization failed. Ensure you have run the SQL setup in your database dashboard.");
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleJoinByCode = async (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode || !currentUser || !isSyncConfigured) return;
    
    setIsCloudSyncing(true);
    try {
      await ensureUserInCloud(currentUser, cleanCode);
      setSessionId(cleanCode);
      setShowJoinModal(false);
      window.history.pushState({}, '', `?group=${cleanCode}`);
      await loadData(cleanCode);
    } catch (e) {
      alert("Group not found.");
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleAddBatch = async (newEvents: Omit<ScheduleEvent, 'id'>[]) => {
    if (!sessionId || !isSyncConfigured) return;
    setIsCloudSyncing(true);
    try {
      await Promise.all(newEvents.map(e => syncEventToCloud(e, sessionId)));
      await loadData(sessionId);
      setView('calendar');
    } catch (e) {
      console.error(e);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!sessionId || !isSyncConfigured) return;
    setIsCloudSyncing(true);
    try {
      await deleteEventFromCloud(id);
      await loadData(sessionId);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleCopyInvite = () => {
    if (!sessionId) return;
    const magicLink = generateSuperLink(sessionId);
    navigator.clipboard.writeText(magicLink);
    alert('Magic Link Copied! Send this to friends—they skip setup and join your live room instantly.');
  };

  // --- RENDERING LOGIC ---

  if (!isSyncConfigured && !sessionId) {
    return (
      <ActivationScreen 
        onActivate={(url, key) => {
          localStorage.setItem('synccircle_cloud_url', url);
          localStorage.setItem('synccircle_cloud_key', key);
          window.location.reload();
        }}
      />
    );
  }

  if (!currentUser) {
    return <ProfileScreen isJoining={!!sessionId} circleName={groupName} onComplete={handleProfileComplete} />;
  }

  if (!sessionId) {
    return (
      <ChoiceScreen 
        user={currentUser} 
        onCreate={handleCreateCircle} 
        onJoin={() => setShowJoinModal(true)} 
      />
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-950 text-white overflow-hidden font-sans">
      <Sidebar 
        users={users} 
        onToggleUser={(id) => setUsers(users.map(u => u.id === id ? { ...u, active: !u.active } : u))} 
        onToggleAll={(active) => setUsers(users.map(u => ({ ...u, active })))}
        onAddUser={() => {}} 
        onUpdateUser={() => {}}
        onDeleteUser={() => {}}
        onSelectCurrentUser={() => {}}
        onOpenProfile={() => setView('setup')}
        currentUser={currentUser.id}
        onNewCircle={() => { setSessionId(null); window.history.pushState({}, '', window.location.pathname); }}
        onJoinByCode={() => setShowJoinModal(true)}
      />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-900 shadow-[-20px_0_40px_rgba(0,0,0,0.3)]">
        <header className="h-24 px-8 flex items-center justify-between z-10 bg-slate-900 border-b border-white/5 shrink-0">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-white tracking-tighter">{groupName}</h2>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                <div className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${isCloudSyncing ? 'animate-pulse' : ''}`} />
                <span className="text-[8px] font-black uppercase tracking-widest">Always Live</span>
              </div>
            </div>
            {sessionId && (
               <div className="flex items-center gap-2 mt-1">
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Room ID:</span>
                 <span className="text-[10px] font-mono font-bold text-indigo-400">{sessionId.slice(0, 8)}</span>
               </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
             {process.env.API_KEY && (
               <button 
                 onClick={() => setShowVoiceAssistant(true)}
                 className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white hover:bg-indigo-600 transition-all border border-white/10"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
               </button>
             )}

             <button 
                onClick={handleCopyInvite}
                className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-[0_10px_30px_rgba(79,70,229,0.3)] hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-3"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                Copy Invite Link
             </button>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-hidden flex flex-col">
          <CalendarGrid users={users} events={events} onDeleteEvent={handleDeleteEvent} onEditEvent={() => {}} currentDate={new Date()} />
        </div>
      </main>

      {view === 'setup' && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center p-8 animate-in fade-in">
          <div className="w-full max-w-5xl h-[85vh]">
            <TimetableEntry currentUser={currentUser} onAddBatch={handleAddBatch} onCancel={() => setView('calendar')} />
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center p-8 animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 rounded-[3rem] p-12 border border-white/5 shadow-2xl text-center">
            <h2 className="text-2xl font-black text-white tracking-tighter mb-2">Join Room</h2>
            <p className="text-slate-500 text-sm font-medium mb-8">Enter the Room ID shared by your friend.</p>
            <input 
              id="join-code-input"
              className="w-full p-6 bg-white/5 border border-white/10 rounded-2xl font-mono font-bold text-center mb-6 outline-none focus:ring-4 focus:ring-indigo-500/20 text-indigo-400"
              placeholder="xxxxxxxx..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJoinByCode((e.target as HTMLInputElement).value);
              }}
            />
            <div className="flex gap-4">
              <button onClick={() => setShowJoinModal(false)} className="flex-1 py-4 bg-white/5 text-slate-500 font-black rounded-xl">Cancel</button>
              <button onClick={() => handleJoinByCode((document.getElementById('join-code-input') as HTMLInputElement).value)} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg">Join</button>
            </div>
          </div>
        </div>
      )}

      {showVoiceAssistant && (
        <VoiceAssistant users={users} events={events} onClose={() => setShowVoiceAssistant(false)} />
      )}
    </div>
  );
};

const ActivationScreen: React.FC<{ onActivate: (url: string, key: string) => void }> = ({ onActivate }) => {
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  const sqlSetup = `
-- 1. Create circles table
create table circles (
  id uuid primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create circle_users table
create table circle_users (
  id uuid primary key,
  circle_id uuid references circles(id) on delete cascade,
  name text not null,
  color text,
  avatar_url text,
  timezone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create events table
create table events (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references circles(id) on delete cascade,
  user_id uuid,
  title text not null,
  day integer not null,
  start_time integer not null,
  duration integer not null,
  start_date date,
  end_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Enable Realtime for all tables
alter publication supabase_realtime add table circles, circle_users, events;
  `.trim();

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSetup);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-950 p-6 font-sans overflow-y-auto custom-scrollbar">
      <div className={`max-w-5xl w-full flex flex-col ${showGuide ? 'md:flex-row' : 'items-center'} gap-8 transition-all duration-700`}>
        
        {/* Connection Form */}
        <div className="max-w-md w-full bg-slate-900 border border-white/5 rounded-[3.5rem] p-12 shadow-2xl space-y-10 animate-in zoom-in-95 shrink-0">
          <div className="text-center">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Initialize Sync</h1>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-3">Engaging Multi-user Cloud Engine</p>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Sync URL</label>
              <input id="db-url" className="w-full p-4 bg-white/5 border border-white/10 rounded-xl font-bold mt-2 outline-none focus:ring-4 focus:ring-indigo-500/20 text-white transition-all placeholder:text-white/10" placeholder="https://xxx.supabase.co" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Public API Key</label>
              <input id="db-key" className="w-full p-4 bg-white/5 border border-white/10 rounded-xl font-bold mt-2 outline-none focus:ring-4 focus:ring-indigo-500/20 text-white transition-all placeholder:text-white/10" placeholder="anon_public_key..." />
            </div>
            <button 
              onClick={() => {
                const u = (document.getElementById('db-url') as HTMLInputElement).value;
                const k = (document.getElementById('db-key') as HTMLInputElement).value;
                if (u && k) onActivate(u, k);
              }}
              className="w-full py-6 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-indigo-700 transition-all active:scale-95"
            >
              Connect Engine
            </button>
            <div className="text-center">
              <button onClick={() => setShowGuide(!showGuide)} className="text-[9px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors flex items-center justify-center gap-2 mx-auto">
                {showGuide ? "Hide Setup Instructions" : "Help me set this up"}
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${showGuide ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Step-by-Step Guide */}
        {showGuide && (
          <div className="flex-1 bg-slate-900 border border-white/5 rounded-[3.5rem] p-10 md:p-14 shadow-2xl animate-in slide-in-from-right-8 duration-500 overflow-hidden">
            <h2 className="text-xl font-black text-white mb-8 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-xs">🚀</span>
              3-Step Cloud Launch
            </h2>
            
            <div className="space-y-12">
              <div className="relative pl-12">
                <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-indigo-400">1</div>
                <h4 className="text-sm font-black text-white mb-1">Create Free Project</h4>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">Visit <a href="https://supabase.com/dashboard" target="_blank" className="text-indigo-400 underline font-black">Supabase Dashboard</a> and start a new project (it takes 1 minute).</p>
              </div>

              <div className="relative pl-12">
                <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-indigo-400">2</div>
                <h4 className="text-sm font-black text-white mb-1">Engage Database</h4>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">Open the <b>SQL Editor</b> (left sidebar) and run this script to create your calendar infrastructure:</p>
                <div className="relative group">
                  <pre className="p-4 bg-black/40 rounded-2xl border border-white/5 text-[9px] font-mono text-slate-400 overflow-x-auto max-h-40 custom-scrollbar">
                    {sqlSetup}
                  </pre>
                  <button 
                    onClick={handleCopySql}
                    className={`absolute top-3 right-3 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white hover:bg-indigo-600'}`}
                  >
                    {copied ? "Copied!" : "Copy SQL"}
                  </button>
                </div>
              </div>

              <div className="relative pl-12">
                <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-indigo-400">3</div>
                <h4 className="text-sm font-black text-white mb-1">Engage Keys</h4>
                <p className="text-xs text-slate-500 leading-relaxed">Go to <b>Settings &rarr; API</b> to find your <b>URL</b> and <b>anon public key</b>. Paste them on the left.</p>
              </div>
            </div>

            <div className="mt-12 p-6 bg-indigo-600/10 rounded-2xl border border-indigo-500/10">
               <p className="text-[10px] font-bold text-indigo-300 leading-relaxed">
                 <span className="font-black uppercase tracking-widest">Pro Tip:</span> If you host this on Vercel, add these as environment variables (<code>SUPABASE_URL</code> and <code>SUPABASE_KEY</code>) to skip this setup for everyone!
               </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ProfileScreen: React.FC<{ isJoining: boolean; circleName: string; onComplete: (name: string, avatar?: string) => void }> = ({ isJoining, circleName, onComplete }) => {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>();
  const fileRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-950 p-6 font-sans overflow-hidden">
      <div className="max-w-md w-full bg-slate-900 border border-white/5 rounded-[3.5rem] p-12 shadow-2xl text-center space-y-10 animate-in zoom-in-95">
        <div>
           <h1 className="text-3xl font-black text-white tracking-tighter">
             {isJoining ? "Invite Accepted" : "SyncCircle"}
           </h1>
           <p className="text-slate-500 text-sm font-medium mt-2 leading-relaxed">
             {isJoining ? `Entering ${circleName}...` : "Welcome! Start by picking a name."}
           </p>
        </div>
        <div className="flex flex-col items-center">
           <div onClick={() => fileRef.current?.click()} className="w-28 h-28 rounded-full bg-white/5 border-4 border-slate-900 shadow-xl overflow-hidden cursor-pointer relative group transition-all hover:scale-105">
             {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl">👤</div>}
             <div className="absolute inset-0 bg-indigo-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-black uppercase tracking-widest transition-opacity">Change</div>
           </div>
           <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={(e) => {
             const file = e.target.files?.[0];
             if (file) {
               const r = new FileReader();
               r.onload = (ev) => setAvatar(ev.target?.result as string);
               r.readAsDataURL(file);
             }
           }} />
        </div>
        <div className="space-y-6">
          <input 
            className="w-full p-6 bg-white/5 border border-white/10 rounded-2xl font-bold text-center outline-none focus:ring-4 focus:ring-indigo-500/20 text-white shadow-sm" 
            placeholder="Your Name" 
            autoFocus
            value={name} 
            onChange={e => setName(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && name && onComplete(name, avatar)}
          />
          <button 
            disabled={!name}
            onClick={() => onComplete(name, avatar)}
            className="w-full py-6 bg-indigo-600 text-white rounded-2xl font-black text-xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
          >
            Enter Room
          </button>
        </div>
      </div>
    </div>
  );
};

const ChoiceScreen: React.FC<{ user: User; onCreate: (n: string) => void; onJoin: () => void; }> = ({ user, onCreate, onJoin }) => {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-950 p-6 font-sans">
      <div className="max-w-xl w-full flex flex-col items-center space-y-12">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white/10 shadow-2xl mx-auto mb-6">
             {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white font-black text-3xl">{user.name.charAt(0)}</div>}
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter leading-tight">Hi, {user.name.split(' ')[0]}!</h1>
          <p className="text-slate-500 text-lg font-medium">Coordinate your group schedule in real-time.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          <button 
            onClick={() => onCreate('Our Circle')}
            className="bg-white p-10 rounded-[3rem] text-left hover:scale-[1.02] transition-all group shadow-2xl"
          >
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-indigo-600 transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">New Circle</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">Start a fresh shared calendar and get your Magic Link.</p>
          </button>

          <button 
            onClick={onJoin}
            className="bg-slate-900 border border-white/10 p-10 rounded-[3rem] text-left hover:bg-slate-800 transition-all group shadow-2xl"
          >
            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-indigo-600 transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
            </div>
            <h3 className="text-2xl font-black text-white mb-2">Join Code</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">Paste a Room ID shared by a friend to join their calendar.</p>
          </button>
        </div>

        <button onClick={() => { localStorage.clear(); window.location.href = window.location.pathname; }} className="text-[10px] font-black text-white/10 uppercase tracking-[0.3em] hover:text-white transition-colors">Reset Sync Engine</button>
      </div>
    </div>
  );
};

export default App;
