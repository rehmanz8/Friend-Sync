
import React, { useState, useEffect } from 'react';
import { User, ScheduleEvent, AppView } from './types';
import { COLORS } from './constants';
import Sidebar from './components/Sidebar';
import CalendarGrid from './components/CalendarGrid';
import TimetableEntry from './components/TimetableEntry';
import EventForm from './components/EventForm';
import { getSmartSuggestions } from './services/gemini';

const App: React.FC = () => {
  const [sessionId, setSessionId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('group');
  });

  const [groupName, setGroupName] = useState<string>(() => {
    return localStorage.getItem(`synccircle_name_${sessionId}`) || 'Our Group';
  });

  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [view, setView] = useState<AppView>('calendar');
  const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ day: string; time: string; reason: string }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Single event editing state
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [isAddingSingle, setIsAddingSingle] = useState(false);

  // Load data specific to this session
  useEffect(() => {
    if (!sessionId) return;
    
    const savedUsers = localStorage.getItem(`synccircle_users_${sessionId}`);
    const savedEvents = localStorage.getItem(`synccircle_events_${sessionId}`);
    
    if (savedUsers) {
      const parsedUsers = JSON.parse(savedUsers);
      setUsers(parsedUsers);
      if (parsedUsers.length > 0 && !currentUser) {
        setCurrentUser(parsedUsers[0].id);
      }
    }
    
    if (savedEvents) {
      setEvents(JSON.parse(savedEvents));
    }
  }, [sessionId]);

  // Persist data for this session
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem(`synccircle_users_${sessionId}`, JSON.stringify(users));
      localStorage.setItem(`synccircle_events_${sessionId}`, JSON.stringify(events));
      localStorage.setItem(`synccircle_name_${sessionId}`, groupName);
    }
  }, [users, events, sessionId, groupName]);

  const handleCreateSession = (gName: string, hName: string) => {
    const id = Math.random().toString(36).substr(2, 8);
    const defaultTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    setGroupName(gName);
    const initialUsers = [
      { id: '1', name: hName || 'Host', color: COLORS[0], active: true, timezone: defaultTz }
    ];
    setUsers(initialUsers);
    setCurrentUser('1');
    setSessionId(id);
    
    const newUrl = `${window.location.origin}${window.location.pathname}?group=${id}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const handleJoinSession = (id: string) => {
    setSessionId(id);
    const newUrl = `${window.location.origin}${window.location.pathname}?group=${id}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const handleToggleUser = (id: string) => {
    setUsers(users.map(u => u.id === id ? { ...u, active: !u.active } : u));
  };

  const handleToggleAll = (active: boolean) => {
    setUsers(users.map(u => ({ ...u, active })));
  };

  const handleAddUser = (name: string) => {
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      color: COLORS[users.length % COLORS.length],
      active: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    setUsers([...users, newUser]);
    setCurrentUser(newUser.id);
  };

  const handleUpdateUser = (id: string, updates: Partial<User>) => {
    setUsers(users.map(u => u.id === id ? { ...u, ...updates } : u));
  };

  const handleDeleteUser = (id: string) => {
    setUsers(users.filter(u => u.id !== id));
    setEvents(events.filter(e => e.userId !== id));
    if (currentUser === id) {
      const remaining = users.filter(u => u.id !== id);
      setCurrentUser(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleBatchAddEvents = (newEvents: Omit<ScheduleEvent, 'id'>[], timezone: string) => {
    const committedEvents = newEvents.map(e => ({
      ...e,
      id: Math.random().toString(36).substr(2, 9),
    }));
    
    if (currentUser) {
      setUsers(prev => prev.map(u => u.id === currentUser ? { ...u, timezone } : u));
    }
    
    setEvents([...events, ...committedEvents]);
    setView('calendar');
  };

  const handleAddSingleEvent = (eventData: Omit<ScheduleEvent, 'id'>) => {
    const newEvent: ScheduleEvent = {
      ...eventData,
      id: Math.random().toString(36).substr(2, 9),
    };
    setEvents([...events, newEvent]);
    setIsAddingSingle(false);
  };

  const handleUpdateEvent = (id: string, updates: Partial<ScheduleEvent>) => {
    setEvents(events.map(e => e.id === id ? { ...e, ...updates } : e));
    setEditingEvent(null);
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    const result = await getSmartSuggestions(users, events);
    setSuggestions(result);
    setLoadingSuggestions(false);
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?group=${sessionId}`;
    navigator.clipboard.writeText(url);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (!sessionId) {
    return <LandingScreen onCreate={handleCreateSession} onJoin={handleJoinSession} />;
  }

  const currentUserObj = users.find(u => u.id === currentUser);

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] overflow-hidden font-sans selection:bg-blue-100">
      <Sidebar 
        users={users} 
        onToggleUser={handleToggleUser} 
        onToggleAll={handleToggleAll}
        onAddUser={handleAddUser}
        onUpdateUser={handleUpdateUser}
        onDeleteUser={handleDeleteUser}
        onSelectCurrentUser={setCurrentUser}
        currentUser={currentUser}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-20 px-8 flex items-center justify-between z-10 bg-white/40 backdrop-blur-xl border-b border-slate-200/60">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                {view === 'calendar' ? `${groupName} • Calendar` : 'Add Timetable Studio'}
              </h2>
              {view === 'calendar' && (
                <div className="flex items-center gap-3 mt-0.5">
                   <div className="relative group">
                     <input 
                      type="date" 
                      value={currentDate} 
                      onChange={(e) => setCurrentDate(e.target.value)}
                      className="text-[11px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:bg-blue-100 transition-all uppercase tracking-wider"
                    />
                   </div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest opacity-60">Focusing Week</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={copyShareLink}
              className="group flex items-center gap-2 px-4 py-2.5 bg-white text-slate-600 rounded-2xl hover:bg-slate-50 transition-all font-bold text-sm border border-slate-200/80 shadow-sm active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-50 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 100-2.684 3 3 0 000 2.684zm0 12.684a3 3 0 100-2.684 3 3 0 000 2.684z" />
              </svg>
              {copySuccess ? 'Copied Link' : 'Invite Friend'}
            </button>
            
            {view === 'calendar' ? (
              <>
                <button
                  onClick={fetchSuggestions}
                  disabled={loadingSuggestions}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all font-bold text-sm shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95 border border-indigo-500/20"
                >
                  <span className="text-base leading-none">✨</span>
                  {loadingSuggestions ? 'Calculating...' : 'AI Insights'}
                </button>
                <div className="h-8 w-px bg-slate-200" />
                
                <div className="flex gap-2">
                   <button
                    disabled={!currentUser}
                    onClick={() => setIsAddingSingle(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-800 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all font-bold text-sm shadow-sm active:scale-95"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Add One
                  </button>
                  <button
                    disabled={!currentUser}
                    onClick={() => setView('setup')}
                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all font-black text-sm shadow-xl shadow-slate-200 disabled:opacity-50 active:scale-95"
                  >
                    <span>Add Timetable</span>
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setView('calendar')}
                className="px-6 py-2.5 bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 rounded-2xl transition-all text-sm"
              >
                Back to Calendar
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 p-8 flex gap-8 min-h-0 bg-slate-50/50 relative">
          {view === 'calendar' ? (
            <>
              <div className="flex-1 min-w-0">
                <CalendarGrid 
                  users={users} 
                  events={events} 
                  onDeleteEvent={handleDeleteEvent}
                  onEditEvent={setEditingEvent}
                  currentDate={new Date(currentDate)}
                />
              </div>

              {suggestions.length > 0 && (
                <aside className="w-80 bg-white rounded-[2.5rem] border border-slate-200/60 shadow-2xl p-7 overflow-y-auto animate-in slide-in-from-right-8 duration-500 flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="font-black text-slate-800 text-lg">Smart Slots</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Based on availability</p>
                    </div>
                    <button onClick={() => setSuggestions([])} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-xl transition-all">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-6 flex-1">
                    {suggestions.map((s, i) => (
                      <div key={i} className="group p-5 bg-[#fafbff] rounded-3xl border border-slate-100 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50/50 transition-all duration-300">
                        <div className="flex justify-between items-start mb-3">
                          <span className="font-black text-slate-900 text-sm tracking-tight">{s.day}</span>
                          <span className="text-[11px] font-black bg-indigo-600 text-white px-3 py-1 rounded-full shadow-sm shadow-indigo-100">{s.time}</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium group-hover:text-slate-700 transition-colors">"{s.reason}"</p>
                      </div>
                    ))}
                  </div>
                </aside>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {currentUserObj && (
                <TimetableEntry 
                  currentUser={currentUserObj}
                  onAddBatch={handleBatchAddEvents}
                  onCancel={() => setView('calendar')}
                />
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modals for Single Add/Edit */}
      {(isAddingSingle && currentUser) && (
        <EventForm 
          userId={currentUser}
          onAdd={handleAddSingleEvent}
          onClose={() => setIsAddingSingle(false)}
        />
      )}
      {editingEvent && (
        <EventForm 
          userId={editingEvent.userId}
          initialData={editingEvent}
          onAdd={(data) => handleUpdateEvent(editingEvent.id, data)}
          onClose={() => setEditingEvent(null)}
          isEdit
        />
      )}
    </div>
  );
};

const LandingScreen: React.FC<{ onCreate: (gName: string, hName: string) => void; onJoin: (id: string) => void }> = ({ onCreate, onJoin }) => {
  const [gName, setGName] = useState('');
  const [hName, setHName] = useState('');
  const [joinId, setJoinId] = useState('');

  return (
    <div className="h-screen w-full flex items-center justify-center bg-[#f0f2f5] relative overflow-hidden">
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-400/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-400/20 blur-[120px] rounded-full" />

      <div className="max-w-4xl w-full px-6 grid grid-cols-1 md:grid-cols-2 gap-8 z-10">
        <div className="flex flex-col justify-center space-y-6 p-10 bg-white/60 backdrop-blur-3xl rounded-[3rem] border border-white/40 shadow-2xl">
          <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-200">
             <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
             </svg>
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Start a Group</h2>
          <p className="text-slate-500 text-sm leading-relaxed">Create a fresh space for you and your friends to sync schedules.</p>
          <div className="space-y-4">
            <input 
              className="w-full p-4 rounded-2xl bg-white border-slate-100 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-slate-700 outline-none transition-all"
              placeholder="Your Name (Host)..."
              value={hName}
              onChange={(e) => setHName(e.target.value)}
            />
            <input 
              className="w-full p-4 rounded-2xl bg-white border-slate-100 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-slate-700 outline-none transition-all"
              placeholder="Group Name (e.g. Squad)..."
              value={gName}
              onChange={(e) => setGName(e.target.value)}
            />
            <button 
              onClick={() => gName && hName && onCreate(gName, hName)}
              disabled={!gName || !hName}
              className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              Host Session
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-center space-y-6 p-10 bg-slate-900 rounded-[3rem] shadow-2xl text-white">
          <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center text-white border border-white/10">
             <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
             </svg>
          </div>
          <h2 className="text-4xl font-black tracking-tighter">Join a Group</h2>
          <p className="text-slate-400 text-sm leading-relaxed">Enter an invite code to join a friend's group.</p>
          <div className="space-y-4">
            <input 
              className="w-full p-4 rounded-2xl bg-white/10 border-white/10 shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:bg-white/20 font-bold text-white outline-none transition-all placeholder:text-slate-600"
              placeholder="Enter Group ID..."
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
            />
            <button 
              onClick={() => joinId && onJoin(joinId)}
              disabled={!joinId}
              className="w-full py-5 bg-white text-slate-900 rounded-2xl font-black shadow-xl hover:bg-slate-100 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              Sync Timeline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
