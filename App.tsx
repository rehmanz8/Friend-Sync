
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
  const [showSetupModal, setShowSetupModal] = useState(false);

  const supabase = getSupabaseClient();

  const loadData = useCallback(async (id: string | null) => {
    if (!id) return;
    setIsCloudSyncing(true);
    try {
      const { users: cloudUsers, events: cloudEvents, circleName } = await fetchCircleData(id);
      // Logic: If we find users in the cloud, use them. Otherwise, keep current local user.
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
  }, [currentUser]);

  useEffect(() => {
    if (!sessionId) return;
    loadData(sessionId);
    if (supabase) {
      const subscription = subscribeToCircle(sessionId, () => loadData(sessionId));
      return () => { subscription.unsubscribe(); };
    }
  }, [sessionId, loadData, supabase]);

  const handleProfileComplete = (name: string, avatar?: string) => {
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
  };

  const handleCreateCircle = async (name: string = 'Our Circle') => {
    if (!currentUser) return;
    const newSessionId = generateId();
    
    setIsCloudSyncing(true);
    try {
      if (supabase) {
        await ensureCircleInCloud(newSessionId, name);
        await ensureUserInCloud(currentUser, newSessionId);
      }
      setSessionId(newSessionId);
      window.history.pushState({}, '', `?group=${newSessionId}`);
      await loadData(newSessionId);
    } catch (e) {
      setSessionId(newSessionId);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleJoinByCode = async (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode || !currentUser) return;
    
    setIsCloudSyncing(true);
    try {
      if (supabase) {
        await ensureUserInCloud(currentUser, cleanCode);
      }
      setSessionId(cleanCode);
      setShowJoinModal(false);
      window.history.pushState({}, '', `?group=${cleanCode}`);
      await loadData(cleanCode);
    } catch (e) {
      setSessionId(cleanCode);
      setShowJoinModal(false);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleAddBatch = async (newEvents: Omit<ScheduleEvent, 'id'>[]) => {
    if (!sessionId) return;
    setIsCloudSyncing(true);
    try {
      if (supabase) {
        await Promise.all(newEvents.map(e => syncEventToCloud(e, sessionId)));
      } else {
        const demoEvents = newEvents.map(e => ({ ...e, id: generateId() }));
        setEvents(prev => [...prev, ...demoEvents]);
      }
      await loadData(sessionId);
      setView('calendar');
    } catch (e) {
      console.error(e);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!sessionId) return;
    setIsCloudSyncing(true);
    try {
      if (supabase) {
        await deleteEventFromCloud(id);
        await loadData(sessionId);
      } else {
        setEvents(prev => prev.filter(e => e.id !== id));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  if (!currentUser) {
    return <ProfileScreen onComplete={handleProfileComplete} />;
  }

  if (!sessionId) {
    return (
      <ChoiceScreen 
        user={currentUser} 
        onCreate={handleCreateCircle} 
        onJoin={() => setShowJoinModal(true)} 
        isSyncing={isCloudSyncing}
        onShowSetup={() => setShowSetupModal(true)}
      />
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
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
        isCloud={!!supabase}
        onConnectCloud={() => setShowSetupModal(true)}
      />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-20 px-8 flex items-center justify-between z-10 bg-white border-b border-slate-100 shrink-0">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">{groupName}</h2>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${supabase ? 'border-indigo-100 bg-indigo-50 text-indigo-600' : 'border-slate-100 bg-slate-50 text-slate-400'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${supabase ? 'bg-indigo-600' : 'bg-slate-300'} ${isCloudSyncing ? 'animate-pulse' : ''}`} />
                <span className="text-[8px] font-black uppercase tracking-widest">
                  {supabase ? 'Live Sync Active' : 'Offline Mode'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             {sessionId && (
               <div className="hidden md:flex flex-col items-end mr-4">
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Group Code</span>
                  <span className="text-xs font-mono font-bold text-slate-400">{sessionId}</span>
               </div>
             )}
             
             {process.env.API_KEY && (
               <button 
                 onClick={() => setShowVoiceAssistant(true)}
                 className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 hover:bg-indigo-100 transition-all border border-indigo-100"
                 title="Voice Assistant"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3zM5 8a1 1 0 00-2 0 7 7 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07A7 7 0 0017 8a1 1 0 00-2 0 5 5 0 01-10 0z" /></svg>
               </button>
             )}

             <button 
                onClick={() => { navigator.clipboard.writeText(sessionId!); alert('Code copied! Send this to your friend.'); }}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2"
             >
                Copy Invite Code
             </button>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-hidden flex flex-col">
          <CalendarGrid users={users} events={events} onDeleteEvent={handleDeleteEvent} onEditEvent={() => {}} currentDate={new Date()} />
        </div>
      </main>

      {view === 'setup' && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-8 animate-in fade-in">
          <div className="w-full max-w-5xl h-[85vh]">
            <TimetableEntry currentUser={currentUser} onAddBatch={handleAddBatch} onCancel={() => setView('calendar')} />
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-8 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-[3rem] p-12 shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter mb-2 text-center">Join with Code</h2>
            <p className="text-slate-400 text-sm font-medium mb-8 text-center">Paste the code your friend shared.</p>
            <input 
              id="join-code-input"
              className="w-full p-6 bg-slate-50 border-none rounded-2xl font-mono font-bold text-center mb-6 outline-none focus:ring-4 focus:ring-indigo-500/10"
              placeholder="xxxxxxxx-xxxx-..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJoinByCode((e.target as HTMLInputElement).value);
              }}
            />
            <div className="flex gap-4">
              <button onClick={() => setShowJoinModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 font-black rounded-xl">Cancel</button>
              <button onClick={() => handleJoinByCode((document.getElementById('join-code-input') as HTMLInputElement).value)} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg">Join Circle</button>
            </div>
          </div>
        </div>
      )}

      {showSetupModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-8 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-[3.5rem] p-12 shadow-2xl">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">Connect Database</h2>
              <p className="text-slate-400 text-xs font-medium">To sync with friends, you need to connect your Supabase project.</p>
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Supabase URL</label>
                <input id="db-url" className="w-full p-4 bg-slate-50 border-none rounded-xl font-bold mt-2" placeholder="https://xxx.supabase.co" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Anon Key</label>
                <input id="db-key" className="w-full p-4 bg-slate-50 border-none rounded-xl font-bold mt-2" placeholder="eyJ..." />
              </div>
              <div className="flex gap-4 pt-4">
                 <button onClick={() => setShowSetupModal(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black rounded-xl">Skip</button>
                 <button 
                  onClick={() => {
                    const u = (document.getElementById('db-url') as HTMLInputElement).value;
                    const k = (document.getElementById('db-key') as HTMLInputElement).value;
                    if (u && k) {
                      localStorage.setItem('synccircle_cloud_url', u);
                      localStorage.setItem('synccircle_cloud_key', k);
                      window.location.reload();
                    }
                  }} 
                  className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg"
                 >
                  Connect
                 </button>
              </div>
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

const ProfileScreen: React.FC<{ onComplete: (name: string, avatar?: string) => void }> = ({ onComplete }) => {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>();
  const fileRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-900 p-6 font-sans overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[150px] rounded-full" />
      <div className="max-w-md w-full bg-white rounded-[3.5rem] p-12 shadow-2xl z-10 text-center space-y-10 animate-in zoom-in-95">
        <div>
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Welcome to SyncCircle</h1>
          <p className="text-slate-400 text-sm font-medium mt-2">Create your profile to start scheduling.</p>
        </div>
        <div className="flex flex-col items-center">
           <div onClick={() => fileRef.current?.click()} className="w-28 h-28 rounded-full bg-slate-50 border-4 border-white shadow-xl overflow-hidden cursor-pointer relative group">
             {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl">👤</div>}
             <div className="absolute inset-0 bg-indigo-600/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-black uppercase tracking-widest">Upload</div>
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
            className="w-full p-6 bg-slate-50 border-none rounded-2xl font-bold text-center outline-none focus:ring-4 focus:ring-indigo-500/10" 
            placeholder="What is your name?" 
            value={name} 
            onChange={e => setName(e.target.value)} 
          />
          <button 
            disabled={!name}
            onClick={() => onComplete(name, avatar)}
            className="w-full py-6 bg-indigo-600 text-white rounded-2xl font-black text-xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
          >
            Create Profile
          </button>
        </div>
      </div>
    </div>
  );
};

const ChoiceScreen: React.FC<{ user: User; onCreate: (n: string) => void; onJoin: () => void; isSyncing: boolean; onShowSetup: () => void }> = ({ user, onCreate, onJoin, isSyncing, onShowSetup }) => {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-900 p-6 font-sans">
      <div className="max-w-xl w-full flex flex-col items-center space-y-12">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-white/10 shadow-2xl mx-auto mb-6">
             {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white font-black">{user.name.charAt(0)}</div>}
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter">Hey {user.name.split(' ')[0]}!</h1>
          <p className="text-indigo-200/40 font-medium">Create a group or join your friends.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          <button 
            onClick={() => onCreate('My Circle')}
            className="bg-white p-10 rounded-[3rem] text-left hover:scale-[1.02] transition-all group shadow-2xl"
          >
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Create New</h3>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">Start a fresh calendar and get a code to share.</p>
          </button>

          <button 
            onClick={onJoin}
            className="bg-slate-800/50 border border-white/5 p-10 rounded-[3rem] text-left hover:bg-slate-800 transition-all group shadow-2xl backdrop-blur-xl"
          >
            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
            </div>
            <h3 className="text-xl font-black text-white mb-2">Join by Code</h3>
            <p className="text-sm text-indigo-200/40 font-medium leading-relaxed">Input a code from your friend to join their circle.</p>
          </button>
        </div>

        <div className="flex gap-8">
           <button onClick={onShowSetup} className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] hover:text-indigo-400 transition-colors">Connect Database</button>
           <button onClick={() => { localStorage.removeItem('synccircle_profile'); window.location.reload(); }} className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] hover:text-white transition-colors">Reset Profile</button>
        </div>
      </div>
    </div>
  );
};

export default App;
