
import React, { useState, useEffect, useCallback } from 'react';
import { User, ScheduleEvent, AppView } from './types';
import { COLORS } from './constants';
import Sidebar from './components/Sidebar';
import CalendarGrid from './components/CalendarGrid';
import TimetableEntry from './components/TimetableEntry';
import EventForm from './components/EventForm';
import { 
  fetchCircleData, 
  syncEventToCloud, 
  updateEventInCloud,
  subscribeToCircle, 
  ensureUserInCloud, 
  ensureCircleInCloud, 
  deleteEventFromCloud, 
  getSupabaseClient, 
  generateSuperLink,
  resetSupabaseClient,
  checkCircleExists
} from './services/supabase';

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
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
  
  const [cloudActive, setCloudActive] = useState(() => !!getSupabaseClient());
  const [groupName, setGroupName] = useState<string>('SyncCircle');
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [view, setView] = useState<AppView>('calendar');
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const loadData = useCallback(async (id: string | null) => {
    if (!id || !cloudActive) return;
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
    } catch (err) {
      console.error("Load Data Error:", err);
      if (currentUser) setUsers([currentUser]);
    } finally {
      setIsCloudSyncing(false);
    }
  }, [currentUser, cloudActive]);

  useEffect(() => {
    if (!sessionId || !cloudActive) return;
    loadData(sessionId);
    const client = getSupabaseClient();
    if (client) {
      const subscription = subscribeToCircle(sessionId, () => loadData(sessionId));
      return () => { subscription.unsubscribe(); };
    }
  }, [sessionId, loadData, cloudActive]);

  const handleCloudSetup = (url: string, key: string) => {
    localStorage.setItem('synccircle_cloud_url', url);
    localStorage.setItem('synccircle_cloud_key', key);
    resetSupabaseClient();
    setCloudActive(true);
  };

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

    if (sessionId && cloudActive) {
      try {
        await ensureUserInCloud(newUser, sessionId);
        await loadData(sessionId);
        setView('setup');
      } catch (err) {
        console.error("Profile Sync Error:", err);
      }
    }
  };

  const handleCreateCircle = async (name: string = 'Our Circle') => {
    if (!currentUser || !cloudActive) {
      alert("Database not connected.");
      return;
    }
    const newSessionId = generateId();
    setIsCloudSyncing(true);
    try {
      await ensureCircleInCloud(newSessionId, name);
      await ensureUserInCloud(currentUser, newSessionId);
      
      const baseUrl = window.location.origin + window.location.pathname;
      window.history.pushState({}, '', `${baseUrl}?group=${newSessionId}`);
      
      setSessionId(newSessionId);
      setView('setup');
    } catch (err: any) {
      console.error("Create Circle Error:", err);
      alert(err.message || "Failed to create Room. Check SQL Setup.");
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleJoinByCode = async (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode || !currentUser || !cloudActive) return;
    setIsCloudSyncing(true);
    try {
      const exists = await checkCircleExists(cleanCode);
      if (!exists) {
        throw new Error("Room ID not found. Make sure you entered the full ID correctly.");
      }

      await ensureUserInCloud(currentUser, cleanCode);
      
      const baseUrl = window.location.origin + window.location.pathname;
      window.history.pushState({}, '', `${baseUrl}?group=${cleanCode}`);
      
      setSessionId(cleanCode);
      setShowJoinModal(false);
      setJoinCode('');
      await loadData(cleanCode);
      setView('setup');
    } catch (err: any) {
      console.error("Join Circle Error:", err);
      alert(err.message || "Join failed.");
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleUpsertEvent = async (event: Omit<ScheduleEvent, 'id'>) => {
    if (!sessionId || !cloudActive) return;
    setIsCloudSyncing(true);
    try {
      if (editingEvent) {
        await updateEventInCloud(editingEvent.id, event);
      } else {
        await syncEventToCloud(event, sessionId);
      }
      await loadData(sessionId);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCloudSyncing(false);
      setEditingEvent(null);
    }
  };

  const handleAddBatch = async (newEvents: Omit<ScheduleEvent, 'id'>[]) => {
    if (!sessionId || !cloudActive) return;
    setIsCloudSyncing(true);
    try {
      await Promise.all(newEvents.map(e => syncEventToCloud(e, sessionId)));
      await loadData(sessionId);
      setView('calendar');
    } catch (err) {
      console.error("Add Batch Error:", err);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!sessionId || !cloudActive) return;
    setIsCloudSyncing(true);
    try {
      await deleteEventFromCloud(id);
      await loadData(sessionId);
    } catch (err) {
      console.error("Delete Event Error:", err);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!sessionId) return;
    const magicLink = generateSuperLink(sessionId);

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(magicLink);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = magicLink;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!success) throw new Error("Fallback copy failed");
      }
      
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link: ', err);
      window.prompt("Copy this link to invite your friends:", magicLink);
    }
  };

  if (!cloudActive) return <ActivationScreen onActivate={handleCloudSetup} />;
  if (!currentUser) return <ProfileScreen isJoining={!!sessionId} circleName={groupName} onComplete={handleProfileComplete} />;
  if (!sessionId) return <ChoiceScreen user={currentUser} onCreate={handleCreateCircle} onJoin={() => setShowJoinModal(true)} />;

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
        onNewCircle={() => { setSessionId(null); window.history.pushState({}, '', window.location.origin + window.location.pathname); }}
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
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Collaborators:</span>
              <span className="text-[10px] font-bold text-indigo-400">{users.length}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <button 
               onClick={handleCopyInvite} 
               className={`px-8 py-3.5 rounded-2xl font-black text-sm shadow-xl transition-all active:scale-95 flex items-center gap-3 ${isCopied ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-[0_10px_30px_rgba(79,70,229,0.3)]'}`}
             >
                {isCopied ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    Link Copied!
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    Invite Friends
                  </>
                )}
             </button>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-hidden flex flex-col">
          <CalendarGrid users={users} events={events} onDeleteEvent={handleDeleteEvent} onEditEvent={setEditingEvent} currentDate={new Date()} />
        </div>
      </main>

      {editingEvent && (
        <EventForm 
          userId={currentUser.id} 
          initialData={editingEvent} 
          onAdd={handleUpsertEvent} 
          onClose={() => setEditingEvent(null)} 
          isEdit={true} 
        />
      )}

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
            <p className="text-slate-500 text-sm font-medium mb-8">Enter a friend's Room ID.</p>
            <input 
              className="w-full p-6 bg-white/5 border border-white/10 rounded-2xl font-mono font-bold text-center mb-6 outline-none focus:ring-4 focus:ring-indigo-500/20 text-indigo-400" 
              placeholder="xxxxxxxx..." 
              autoFocus 
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode(joinCode)} 
            />
            <div className="flex gap-4">
              <button onClick={() => { setShowJoinModal(false); setJoinCode(''); }} className="flex-1 py-4 bg-white/5 text-slate-500 font-black rounded-xl">Cancel</button>
              <button onClick={() => handleJoinByCode(joinCode)} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg transition-all active:scale-95">Join</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const ActivationScreen: React.FC<{ onActivate: (url: string, key: string) => void }> = ({ onActivate }) => {
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const sqlSetup = `
-- 1. Setup UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create tables
CREATE TABLE IF NOT EXISTS circles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS circle_users (
  id UUID PRIMARY KEY,
  circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  avatar_url TEXT,
  timezone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
  user_id UUID,
  title TEXT NOT NULL,
  day INTEGER NOT NULL,
  start_time INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. ENABLE RLS (Row Level Security)
ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 4. CREATE POLICIES (Grant full access for anonymous key)
DROP POLICY IF EXISTS "Public Access" ON circles;
CREATE POLICY "Public Access" ON circles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON circle_users;
CREATE POLICY "Public Access" ON circle_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON events;
CREATE POLICY "Public Access" ON events FOR ALL USING (true) WITH CHECK (true);

-- 5. Enable Realtime
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS circles, circle_users, events;
ALTER PUBLICATION supabase_realtime ADD TABLE circles, circle_users, events;
  `.trim();

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-950 p-6 font-sans overflow-y-auto custom-scrollbar">
      <div className={`max-w-5xl w-full flex flex-col ${showGuide ? 'md:flex-row' : 'items-center'} gap-8 transition-all duration-700`}>
        <div className="max-w-md w-full bg-slate-900 border border-white/5 rounded-[3.5rem] p-12 shadow-2xl space-y-10 animate-in zoom-in-95 shrink-0">
          <div className="text-center">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Initialize Sync</h1>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-3">Reactive Multi-user Cloud Engine</p>
          </div>
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Sync URL</label>
              <input id="db-url" className="w-full p-4 bg-white/5 border border-white/10 rounded-xl font-bold mt-2 outline-none focus:ring-4 focus:ring-indigo-500/20 text-white transition-all" placeholder="https://xxx.supabase.co" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Public API Key</label>
              <input id="db-key" className="w-full p-4 bg-white/5 border border-white/10 rounded-xl font-bold mt-2 outline-none focus:ring-4 focus:ring-indigo-500/20 text-white transition-all" placeholder="anon_public_key..." />
            </div>
            <button onClick={() => { const u = (document.getElementById('db-url') as HTMLInputElement).value; const k = (document.getElementById('db-key') as HTMLInputElement).value; if (u && k) onActivate(u, k); }} className="w-full py-6 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-indigo-700 transition-all">Connect Engine</button>
            <div className="text-center"><button onClick={() => setShowGuide(!showGuide)} className="text-[9px] font-black text-indigo-400 uppercase tracking-widest flex items-center justify-center gap-2 mx-auto">Help me set this up</button></div>
          </div>
        </div>
        {showGuide && (
          <div className="flex-1 bg-slate-900 border border-white/5 rounded-[3.5rem] p-14 shadow-2xl animate-in slide-in-from-right-8 text-left overflow-hidden">
            <h2 className="text-xl font-black text-white mb-8">Cloud Activation Guide</h2>
            <div className="space-y-8">
              <div className="relative pl-12"><div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-indigo-400">1</div><p className="text-xs text-slate-500 font-medium">Create a free Supabase project.</p></div>
              <div className="relative pl-12">
                <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-indigo-400">2</div>
                <p className="text-xs text-slate-500 font-medium">Copy the SQL below and run it in the **SQL Editor** tab. This opens the security policies for the app.</p>
                <div className="mt-4 relative group">
                  <pre className="p-4 bg-black/40 rounded-2xl border border-white/5 text-[9px] font-mono text-slate-400 overflow-x-auto max-h-48 custom-scrollbar">{sqlSetup}</pre>
                  <button onClick={() => { navigator.clipboard.writeText(sqlSetup); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="absolute top-2 right-2 px-3 py-1 bg-indigo-600 text-white text-[8px] font-black rounded-lg uppercase tracking-widest shadow-lg">{copied ? 'COPIED!' : 'COPY'}</button>
                </div>
              </div>
              <div className="relative pl-12"><div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-indigo-400">3</div><p className="text-xs text-slate-500 font-medium">Paste your **Project URL** and **Anon Key** on the left. The app will sync instantly.</p></div>
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
    <div className="h-screen w-full flex items-center justify-center bg-slate-950 p-6 font-sans">
      <div className="max-w-md w-full bg-slate-900 border border-white/5 rounded-[3.5rem] p-12 shadow-2xl text-center space-y-10 animate-in zoom-in-95">
        <h1 className="text-3xl font-black text-white tracking-tighter">{isJoining ? "Invite Accepted" : "SyncCircle"}</h1>
        <p className="text-slate-500 text-sm">{isJoining ? `Entering ${circleName}...` : "Welcome! Start by picking a name."}</p>
        <div onClick={() => fileRef.current?.click()} className="w-28 h-28 rounded-full bg-white/5 border-4 border-slate-900 shadow-xl overflow-hidden cursor-pointer mx-auto relative group transition-all hover:scale-105">
           {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl">👤</div>}
           <div className="absolute inset-0 bg-indigo-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-black uppercase tracking-widest transition-opacity">Change</div>
        </div>
        <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setAvatar(ev.target?.result as string); r.readAsDataURL(f); } }} />
        <input className="w-full p-6 bg-white/5 border border-white/10 rounded-2xl font-bold text-center text-white outline-none focus:ring-4 focus:ring-indigo-500/20 shadow-sm transition-all" placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && name && onComplete(name, avatar)} />
        <button disabled={!name} onClick={() => onComplete(name, avatar)} className="w-full py-6 bg-indigo-600 text-white rounded-2xl font-black text-xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50">Enter Room</button>
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
          <h1 className="text-5xl font-black text-white tracking-tighter">Hi, {user.name.split(' ')[0]}!</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          <button onClick={() => onCreate('Our Circle')} className="bg-white p-10 rounded-[3rem] text-left hover:scale-[1.02] transition-all group shadow-2xl">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-indigo-600 transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            </div>
            <h3 className="text-2xl font-black text-slate-900">New Circle</h3>
            <p className="text-sm text-slate-500 mt-2">Start a fresh shared calendar.</p>
          </button>
          <button onClick={onJoin} className="bg-slate-900 border border-white/10 p-10 rounded-[3rem] text-left hover:bg-slate-800 transition-all group shadow-2xl text-white">
            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-indigo-600 transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
            </div>
            <h3 className="text-2xl font-black">Join Code</h3>
            <p className="text-sm text-slate-500 mt-2">Enter a friend's room.</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
