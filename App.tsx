
import React, { useState, useEffect } from 'react';
import { User, ScheduleEvent, AppView } from './types';
import { COLORS } from './constants';
import Sidebar from './components/Sidebar';
import CalendarGrid from './components/CalendarGrid';
import TimetableEntry from './components/TimetableEntry';
import EventForm from './components/EventForm';
import { getSmartSuggestions } from './services/gemini';

interface RecentSession {
  id: string;
  name: string;
  lastUsed: number;
}

const App: React.FC = () => {
  const [sessionId, setSessionId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('group');
  });

  const [groupName, setGroupName] = useState<string>('Our Circle');
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [view, setView] = useState<AppView>('calendar');
  const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ day: string; time: string; reason: string }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [linkCopySuccess, setLinkCopySuccess] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [syncCode, setSyncCode] = useState('');
  
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);

  // Load master list of all local circles
  useEffect(() => {
    const saved = localStorage.getItem('synccircle_all_sessions');
    if (saved) setRecentSessions(JSON.parse(saved));
  }, []);

  // Sync state with local storage whenever it changes
  useEffect(() => {
    if (!sessionId) {
      setUsers([]);
      setEvents([]);
      return;
    }
    
    const savedUsers = localStorage.getItem(`synccircle_users_${sessionId}`);
    const savedEvents = localStorage.getItem(`synccircle_events_${sessionId}`);
    const savedName = localStorage.getItem(`synccircle_name_${sessionId}`);
    
    if (savedName) setGroupName(savedName);
    
    if (savedUsers) {
      const parsedUsers = JSON.parse(savedUsers);
      setUsers(parsedUsers);
      const lastUser = localStorage.getItem(`synccircle_lastuser_${sessionId}`);
      if (lastUser && parsedUsers.find((u: User) => u.id === lastUser)) {
        setCurrentUser(lastUser);
      } else if (parsedUsers.length > 0) {
        setCurrentUser(parsedUsers[0].id);
      }
    } else {
      setUsers([]);
      setEvents([]);
      setCurrentUser(null);
    }
    
    if (savedEvents) setEvents(JSON.parse(savedEvents));

    // Update the master session list
    setRecentSessions(prev => {
      const filtered = prev.filter(s => s.id !== sessionId);
      const updated = [{ 
        id: sessionId, 
        name: savedName || groupName || 'Unnamed Circle', 
        lastUsed: Date.now() 
      }, ...filtered].slice(0, 15);
      localStorage.setItem('synccircle_all_sessions', JSON.stringify(updated));
      return updated;
    });
  }, [sessionId]);

  // Persist current state to localStorage
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem(`synccircle_users_${sessionId}`, JSON.stringify(users));
      localStorage.setItem(`synccircle_events_${sessionId}`, JSON.stringify(events));
      localStorage.setItem(`synccircle_name_${sessionId}`, groupName);
      if (currentUser) {
        localStorage.setItem(`synccircle_lastuser_${sessionId}`, currentUser);
      }
    }
  }, [users, events, sessionId, groupName, currentUser]);

  const handleCreateSession = (gName: string, hName: string, avatar?: string) => {
    const id = sessionId || Math.random().toString(36).substr(2, 8);
    const defaultTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    const newUser = { 
      id: Math.random().toString(36).substr(2, 9), 
      name: hName, 
      color: COLORS[users.length % COLORS.length], 
      active: true, 
      timezone: defaultTz,
      avatar 
    };

    if (sessionId && users.length > 0) {
      // Joining an existing circle ID with a new local profile
      setUsers(prev => [...prev, newUser]);
    } else {
      // Starting a brand new circle ID
      setGroupName(gName);
      setUsers([newUser]);
    }
    
    setCurrentUser(newUser.id);
    setSessionId(id);
    
    const newUrl = `${window.location.origin}${window.location.pathname}?group=${id}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const handleSwitchSession = (id: string | null) => {
    setSessionId(id);
    const newUrl = id 
      ? `${window.location.origin}${window.location.pathname}?group=${id}`
      : `${window.location.origin}${window.location.pathname}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const handleImportData = () => {
    try {
      const data = JSON.parse(atob(syncCode));
      if (data.users && data.events) {
        // Advanced Merge: Combine existing users with new ones
        const existingUserIds = new Set(users.map(u => u.id));
        const mergedUsers = [...users];
        
        data.users.forEach((incomingUser: User) => {
          if (!existingUserIds.has(incomingUser.id)) {
            mergedUsers.push(incomingUser);
          } else {
            // Update existing users in case they changed their profile pic or name
            const idx = mergedUsers.findIndex(u => u.id === incomingUser.id);
            if (idx !== -1) mergedUsers[idx] = { ...mergedUsers[idx], ...incomingUser };
          }
        });
        
        // Advanced Merge: Combine existing events with new ones (avoid duplicates)
        const existingEventIds = new Set(events.map(e => e.id));
        const newEvents = data.events.filter((e: ScheduleEvent) => !existingEventIds.has(e.id));
        
        setUsers(mergedUsers);
        setEvents([...events, ...newEvents]);
        
        setShowSyncModal(false);
        setSyncCode('');
        alert("Circle merged! You and your friends are now in the same calendar.");
      }
    } catch (e) {
      alert("Invalid sync code. Please check that you copied the entire message from your friend.");
    }
  };

  const generateSyncCode = () => {
    const data = { users, events };
    const code = btoa(JSON.stringify(data));
    navigator.clipboard.writeText(code);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?group=${sessionId}`;
    navigator.clipboard.writeText(url);
    setLinkCopySuccess(true);
    setTimeout(() => setLinkCopySuccess(false), 2000);
  };

  if (!sessionId) return <LandingScreen onCreate={handleCreateSession} recentSessions={recentSessions} onSwitch={handleSwitchSession} />;

  // User is joining via link but doesn't have a local profile yet
  if (sessionId && users.length === 0) {
    return <LandingScreen onCreate={handleCreateSession} recentSessions={[]} onSwitch={handleSwitchSession} isJoining />;
  }

  const currentUserObj = users.find(u => u.id === currentUser);

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] overflow-hidden font-sans">
      <Sidebar 
        users={users} 
        onToggleUser={(id) => setUsers(users.map(u => u.id === id ? { ...u, active: !u.active } : u))} 
        onToggleAll={(active) => setUsers(users.map(u => ({ ...u, active })))}
        onAddUser={(name, avatar) => {
          const newUser: User = { 
            id: Math.random().toString(36).substr(2, 9), 
            name, 
            avatar,
            color: COLORS[users.length % COLORS.length], 
            active: true, 
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone 
          };
          setUsers([...users, newUser]);
          setCurrentUser(newUser.id);
        }}
        onUpdateUser={(id, updates) => setUsers(users.map(u => u.id === id ? { ...u, ...updates } : u))}
        onDeleteUser={(id) => {
          if (confirm(`Remove this profile? This will hide their schedule on your device.`)) {
            setUsers(users.filter(u => u.id !== id));
            setEvents(events.filter(e => e.userId !== id));
            if (currentUser === id) setCurrentUser(null);
          }
        }}
        onSelectCurrentUser={setCurrentUser}
        onOpenProfile={() => setShowProfileModal(true)}
        currentUser={currentUser}
        onNewCircle={() => handleSwitchSession(null)}
      />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-20 px-8 flex items-center justify-between z-10 bg-white/40 backdrop-blur-xl border-b border-slate-200/60">
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-slate-800 tracking-tight">{view === 'calendar' ? groupName : 'Timetable Studio'}</h2>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
                Peer-to-Peer Circle
              </span>
              <button onClick={() => setShowSyncModal(true)} className="text-[10px] text-slate-400 font-bold hover:text-blue-600 transition-colors uppercase tracking-widest">Share & Sync Updates</button>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             {view === 'calendar' ? (
               <>
                 <input type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-black text-slate-600 outline-none hover:border-slate-300 transition-all shadow-sm" />
                 <button onClick={async () => { setLoadingSuggestions(true); const s = await getSmartSuggestions(users, events); setSuggestions(s); setLoadingSuggestions(false); }} disabled={loadingSuggestions} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all font-bold text-sm shadow-lg shadow-indigo-100 disabled:opacity-50">✨ AI Suggestions</button>
                 <button disabled={!currentUser} onClick={() => setView('setup')} className="px-6 py-2.5 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all shadow-lg shadow-slate-200">Add My Schedule</button>
               </>
             ) : (
               <button onClick={() => setView('calendar')} className="px-6 py-2.5 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 transition-all">Back to Circle</button>
             )}
          </div>
        </header>

        <div className="flex-1 p-8 bg-slate-50/50 overflow-hidden flex gap-6">
          {view === 'calendar' ? (
            <>
              <div className="flex-1 min-w-0">
                <CalendarGrid 
                  users={users} 
                  events={events} 
                  onDeleteEvent={(id) => setEvents(events.filter(e => e.id !== id))} 
                  onEditEvent={setEditingEvent} 
                  currentDate={new Date(currentDate)} 
                />
              </div>
              {suggestions.length > 0 && (
                <aside className="w-80 bg-white rounded-[2.5rem] border border-slate-200 p-8 overflow-y-auto animate-in slide-in-from-right-8 duration-500 shadow-xl">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="font-black text-slate-900 text-lg">Smart Slots</h3>
                    <button onClick={() => setSuggestions([])} className="text-slate-300 hover:text-slate-900 transition-colors">✕</button>
                  </div>
                  <div className="space-y-6">
                    {suggestions.map((s, i) => (
                      <div key={i} className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100">
                        <div className="flex justify-between items-start mb-3">
                          <span className="font-black text-indigo-900 text-sm">{s.day}</span>
                          <span className="text-[10px] font-black bg-indigo-600 text-white px-3 py-1 rounded-full">{s.time}</span>
                        </div>
                        <p className="text-xs text-indigo-700 leading-relaxed font-medium">"{s.reason}"</p>
                      </div>
                    ))}
                  </div>
                </aside>
              )}
            </>
          ) : (
            <div className="w-full flex items-center justify-center">
              {currentUserObj && (
                <TimetableEntry 
                  currentUser={currentUserObj} 
                  onAddBatch={(newEvents, tz) => {
                    const committed = newEvents.map(e => ({ ...e, id: Math.random().toString(36).substr(2, 9) }));
                    setEvents([...events, ...committed]);
                    setUsers(users.map(u => u.id === currentUser ? { ...u, timezone: tz } : u));
                    setView('calendar');
                  }} 
                  onCancel={() => setView('calendar')} 
                />
              )}
            </div>
          )}
        </div>
      </main>

      {/* Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[150] p-4">
          <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-xl shadow-2xl overflow-y-auto max-h-[90vh] border border-slate-100 animate-in zoom-in-95 duration-300">
            <h3 className="text-3xl font-black text-slate-900 mb-2 tracking-tighter text-center">Sync Schedules</h3>
            <p className="text-sm text-slate-500 mb-8 font-medium text-center">
              This app is private and local. To see each other's schedules, you must exchange Sync Codes.
            </p>
            
            <div className="space-y-10">
              <section className="space-y-4">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Step 1: Invite your Friend</label>
                <button onClick={copyInviteLink} className="w-full py-5 bg-blue-50 text-blue-600 rounded-[1.8rem] font-black text-xs uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center justify-center gap-3">
                    {linkCopySuccess ? 'Link Copied!' : 'Copy Invite Link'}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                </button>
                <p className="text-[10px] text-slate-400 text-center font-medium italic">Send this link to your friend first so they join the same Room ID.</p>
              </section>

              <div className="h-px bg-slate-100 w-full" />

              <section className="space-y-4">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Step 2: Sync Your Content</label>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={generateSyncCode} className="py-5 bg-indigo-600 text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex flex-col items-center gap-2">
                      <span className="text-[9px] opacity-70">Push Updates</span>
                      {copySuccess ? 'Code Copied!' : 'Copy My Sync Code'}
                  </button>
                  <button onClick={handleImportData} className="py-5 bg-slate-900 text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-200 flex flex-col items-center gap-2">
                      <span className="text-[9px] opacity-70">Pull Updates</span>
                      Sync Friend's Code
                  </button>
                </div>
                <textarea 
                    className="w-full h-32 p-6 bg-slate-50 border border-slate-100 rounded-[2rem] text-[10px] font-mono outline-none focus:ring-4 focus:ring-blue-500/10 transition-all resize-none shadow-inner"
                    placeholder="Paste your friend's code here to see their schedule on your screen..."
                    value={syncCode}
                    onChange={(e) => setSyncCode(e.target.value)}
                 />
                <p className="text-[10px] text-slate-400 text-center font-medium">Both users should exchange codes to see each other's latest changes.</p>
              </section>

              <button onClick={() => setShowSyncModal(false)} className="w-full py-5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] border border-slate-100 hover:bg-slate-50 transition-all">Back to Calendar</button>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && currentUserObj && (
        <ProfileModal 
          user={currentUserObj} 
          onUpdate={(updates) => {
            setUsers(users.map(u => u.id === currentUser ? { ...u, ...updates } : u));
            setShowProfileModal(false);
          }} 
          onClose={() => setShowProfileModal(false)} 
        />
      )}

      {editingEvent && (
        <EventForm 
          userId={editingEvent.userId} 
          initialData={editingEvent} 
          onAdd={(data) => {
            setEvents(events.map(e => e.id === editingEvent.id ? { ...e, ...data } : e));
            setEditingEvent(null);
          }} 
          onClose={() => setEditingEvent(null)} 
          isEdit 
        />
      )}
    </div>
  );
};

const ProfileModal: React.FC<{ user: User, onUpdate: (updates: Partial<User>) => void, onClose: () => void }> = ({ user, onUpdate, onClose }) => {
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 300;
          canvas.height = 300;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, 300, 300);
          setAvatar(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-100">
        <h3 className="text-3xl font-black text-slate-900 mb-10 tracking-tighter text-center">My Identity</h3>
        <div className="space-y-8">
          <div className="flex flex-col items-center gap-6">
             <div onClick={() => fileRef.current?.click()} className="w-40 h-40 rounded-full bg-slate-50 border-8 border-white shadow-2xl overflow-hidden cursor-pointer hover:scale-105 transition-all group relative shrink-0">
                {avatar ? (
                  <img src={avatar} className="w-full h-full object-cover aspect-square" alt="Profile" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                   <span className="text-xs font-black text-white uppercase tracking-widest">Update Photo</span>
                </div>
             </div>
             <input type="file" ref={fileRef} onChange={handleAvatar} className="hidden" accept="image/*" />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Display Name</label>
            <input className="w-full p-5 rounded-3xl bg-slate-50 border-none ring-1 ring-slate-100 font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex gap-4 pt-4">
            <button onClick={onClose} className="flex-1 py-5 bg-slate-50 text-slate-400 font-black rounded-3xl text-[10px] uppercase tracking-widest">Cancel</button>
            <button onClick={() => onUpdate({ name, avatar })} className="flex-1 py-5 bg-blue-600 text-white font-black rounded-3xl text-[10px] uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const LandingScreen: React.FC<{ 
  onCreate: (gName: string, hName: string, avatar?: string) => void, 
  recentSessions: RecentSession[],
  onSwitch: (id: string | null) => void,
  isJoining?: boolean
}> = ({ onCreate, recentSessions, onSwitch, isJoining }) => {
  const [gName, setGName] = useState('');
  const [hName, setHName] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 300;
          canvas.height = 300;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, 300, 300);
          setAvatar(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-[#f4f7f9] p-6 relative overflow-hidden">
      <div className="absolute top-[-30%] right-[-10%] w-[70%] h-[70%] bg-blue-400/5 blur-[220px] rounded-full" />
      <div className="absolute bottom-[-30%] left-[-10%] w-[70%] h-[70%] bg-indigo-400/5 blur-[220px] rounded-full" />
      
      <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-10 z-10 animate-in fade-in slide-in-from-bottom-12 duration-700">
        {!isJoining && (
          <div className="bg-white/60 backdrop-blur-3xl p-14 rounded-[5rem] border border-white/50 shadow-2xl flex flex-col justify-center min-h-[650px]">
            <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter">Circle Hub</h2>
            <p className="text-sm font-medium text-slate-500 mb-12">Access all your collaborative spaces from this device.</p>
            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-4 custom-scrollbar">
              {recentSessions.length > 0 ? recentSessions.map(s => (
                <button key={s.id} onClick={() => onSwitch(s.id)} className="w-full flex items-center justify-between p-6 bg-white rounded-[2.8rem] border border-slate-100 hover:border-blue-300 transition-all group shadow-sm hover:shadow-2xl hover:-translate-y-1">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-gradient-to-tr from-blue-50 to-indigo-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-xl border border-blue-100/50">{s.name.charAt(0)}</div>
                    <div className="text-left">
                      <p className="text-lg font-black text-slate-800 leading-tight">{s.name}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Room ID: {s.id}</p>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </button>
              )) : (
                <div className="py-24 text-center border-4 border-dashed border-slate-200/40 rounded-[3.5rem]">
                   <p className="text-[12px] font-black text-slate-300 uppercase tracking-[0.4em] leading-loose">No active circles yet.<br/>Start one on the right! →</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className={`${isJoining ? 'md:col-span-2 max-w-xl mx-auto' : ''} bg-white p-14 rounded-[5rem] shadow-2xl border border-slate-100 flex flex-col justify-center text-center relative animate-in zoom-in-95 duration-500`}>
          <div onClick={() => fileInputRef.current?.click()} className="w-40 h-40 bg-slate-50 rounded-full mx-auto mb-10 cursor-pointer hover:scale-105 transition-all flex items-center justify-center border-8 border-white shadow-2xl overflow-hidden group relative shrink-0">
            {avatar ? (
              <img src={avatar} className="w-full h-full object-cover aspect-square" alt="Preview" />
            ) : (
              <div className="text-slate-200 group-hover:text-blue-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
            )}
            <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
               <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg></div>
            </div>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleAvatar} className="hidden" accept="image/*" />
          
          <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tighter leading-none">
            {isJoining ? 'Join Friend\'s Circle' : 'Start Fresh Circle'}
          </h2>
          <p className="text-slate-400 text-sm font-medium mb-12 px-6">
            {isJoining ? 'Pick a name and photo to introduce yourself to this group.' : 'Coordinate schedules instantly with friends in a shared room.'}
          </p>
          
          <div className="space-y-6 text-left">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">My Profile Name</label>
              <input className="w-full p-6 rounded-[2rem] bg-slate-50 border-none ring-1 ring-slate-100 font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" placeholder="e.g. Alice Smith" value={hName} onChange={(e) => setHName(e.target.value)} />
            </div>
            {!isJoining && (
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Room Label</label>
                <input className="w-full p-6 rounded-[2rem] bg-slate-50 border-none ring-1 ring-slate-100 font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" placeholder="e.g. Weekend Crew" value={gName} onChange={(e) => setGName(e.target.value)} />
              </div>
            )}
            <button 
              onClick={() => onCreate(isJoining ? 'Our Circle' : gName, hName, avatar)} 
              disabled={(!isJoining && !gName) || !hName} 
              className="w-full py-6 bg-blue-600 text-white rounded-[2.5rem] font-black text-lg shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 mt-8"
            >
              {isJoining ? 'Enter Shared Room' : 'Initialize Circle'}
            </button>
            {isJoining && (
              <button onClick={() => onSwitch(null)} className="w-full py-4 text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em] hover:text-slate-600 transition-colors">Return to Hub</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
