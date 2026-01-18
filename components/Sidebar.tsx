
import React, { useState } from 'react';
import { User } from '../types';

interface SidebarProps {
  users: User[];
  onToggleUser: (id: string) => void;
  onToggleAll: (active: boolean) => void;
  onAddUser: (name: string) => void;
  onUpdateUser: (id: string, updates: Partial<User>) => void;
  onDeleteUser: (id: string) => void;
  onSelectCurrentUser: (id: string) => void;
  currentUser: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  users, onToggleUser, onToggleAll, onAddUser, onUpdateUser, onDeleteUser, onSelectCurrentUser, currentUser 
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      onAddUser(newName.trim());
      setNewName('');
      setIsAdding(false);
    }
  };

  const handleStartEditing = (user: User) => {
    setEditingId(user.id);
    setTempName(user.name);
  };

  const handleSaveEdit = () => {
    if (editingId && tempName.trim()) {
      onUpdateUser(editingId, { name: tempName.trim() });
    }
    setEditingId(null);
  };

  const currentUserObj = users.find(u => u.id === currentUser);

  return (
    <div className="w-80 bg-white border-r border-slate-200/60 flex flex-col p-8 space-y-10 h-full z-20 shadow-[20px_0_60px_-15px_rgba(0,0,0,0.02)]">
      {/* Brand */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 rounded-[1.2rem] flex items-center justify-center text-white shadow-xl shadow-blue-100 transition-transform hover:scale-110 active:scale-95 duration-300">
           <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
           </svg>
        </div>
        <div className="flex flex-col">
          <h1 className="text-2xl font-black tracking-tighter text-slate-900 leading-none">SyncCircle</h1>
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] mt-1.5">Shared Timetable</span>
        </div>
      </div>

      {/* Friends Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">The Circle</h2>
          <div className="flex gap-2">
            <button
              onClick={() => onToggleAll(true)}
              className="text-[9px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest transition-colors"
            >
              All
            </button>
            <span className="text-slate-200">/</span>
            <button
              onClick={() => onToggleAll(false)}
              className="text-[9px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
            >
              None
            </button>
          </div>
        </div>

        <div className="space-y-2 overflow-y-auto pr-3 custom-scrollbar -mr-3 flex-1">
          {users.map((user) => (
            <div key={user.id} className="group flex items-center gap-2 animate-in fade-in duration-300">
              <div 
                className={`flex-1 flex items-center gap-4 p-3 rounded-[1.2rem] transition-all duration-300 relative overflow-hidden cursor-pointer ${currentUser === user.id ? 'bg-[#fafbff] border border-blue-50 shadow-sm' : 'hover:bg-slate-50 border border-transparent'}`}
                onClick={() => onSelectCurrentUser(user.id)}
              >
                {currentUser === user.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
                )}
                <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={user.active}
                    onChange={() => onToggleUser(user.id)}
                    className="w-5 h-5 rounded-[0.5rem] text-blue-600 focus:ring-4 focus:ring-blue-500/10 border-slate-200 transition-all cursor-pointer bg-white"
                  />
                  <div className="absolute -right-1 -bottom-1 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: user.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  {editingId === user.id ? (
                    <input
                      autoFocus
                      className="w-full text-sm font-bold bg-white border border-blue-200 rounded px-1 outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onBlur={handleSaveEdit}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <p className={`text-sm font-bold truncate transition-colors ${currentUser === user.id ? 'text-blue-700' : 'text-slate-600 group-hover:text-slate-900'}`}>
                      {user.name}
                    </p>
                  )}
                </div>
                
                <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStartEditing(user); }}
                    className="p-1.5 hover:bg-slate-100 text-slate-300 hover:text-slate-500 rounded-lg transition-all active:scale-75"
                    title="Rename"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm(`Remove ${user.name} and their schedule?`)) onDeleteUser(user.id); }}
                    className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-all active:scale-75"
                    title="Remove friend"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {isAdding ? (
            <form onSubmit={handleAddSubmit} className="mt-4 animate-in slide-in-from-top-2 duration-300">
              <input
                autoFocus
                className="w-full text-sm font-bold rounded-2xl border-slate-100 bg-slate-50 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 px-4 py-3 border transition-all placeholder:text-slate-300"
                placeholder="Friend's Name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => !newName && setIsAdding(false)}
              />
              <p className="text-[9px] text-slate-400 mt-2 ml-2 font-bold uppercase tracking-widest">Press Enter to add</p>
            </form>
          ) : (
            <button 
              onClick={() => setIsAdding(true)}
              className="w-full mt-4 flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-100 rounded-[1.5rem] text-slate-400 hover:text-blue-600 hover:border-blue-100 hover:bg-blue-50/30 transition-all font-bold text-xs group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:scale-125 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add a Friend
            </button>
          )}

          {users.length === 0 && !isAdding && (
            <div className="py-12 px-6 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
              <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest leading-loose">Circle empty</p>
            </div>
          )}
        </div>
      </div>

      {/* Profile Control */}
      <div className="pt-8 border-t border-slate-100">
        <div className="flex justify-between items-center mb-5">
           <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Editor Access</p>
           {currentUserObj && (
             <button 
              onClick={() => handleStartEditing(currentUserObj)}
              className="text-[9px] font-black text-blue-500 uppercase hover:text-blue-700 transition-colors"
             >
               Rename
             </button>
           )}
        </div>
        <div className={`p-5 rounded-[2rem] transition-all duration-500 ${currentUser ? 'bg-slate-900 text-white shadow-2xl shadow-slate-200 scale-100' : 'bg-slate-50 text-slate-300 border border-slate-100 animate-pulse'}`}>
          {currentUser ? (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center font-black text-base shadow-sm backdrop-blur-md">
                {currentUserObj?.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-black truncate leading-none mb-1.5">{currentUserObj?.name}</span>
                <div className="flex items-center gap-1.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                   <span className="text-[9px] font-black opacity-50 uppercase tracking-widest">Active Permissions</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="w-10 h-10 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                 </svg>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Select Profile</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
