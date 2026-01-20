
import React, { useState, useRef } from 'react';
import { User } from '../types';

interface SidebarProps {
  users: User[];
  onToggleUser: (id: string) => void;
  onToggleAll: (active: boolean) => void;
  onAddUser: (name: string, avatar?: string) => void;
  onUpdateUser: (id: string, updates: Partial<User>) => void;
  onDeleteUser: (id: string) => void;
  onSelectCurrentUser: (id: string) => void;
  onOpenProfile: () => void;
  currentUser: string | null;
  onNewCircle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  users, onToggleUser, onToggleAll, onAddUser, onUpdateUser, onDeleteUser, onSelectCurrentUser, onOpenProfile, currentUser, onNewCircle
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAvatar, setNewAvatar] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 150;
          canvas.height = 150;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, 150, 150);
          setNewAvatar(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      onAddUser(newName.trim(), newAvatar);
      setNewName('');
      setNewAvatar(undefined);
      setIsAdding(false);
    }
  };

  const currentUserObj = users.find(u => u.id === currentUser);

  return (
    <div className="w-80 bg-white border-r border-slate-200/60 flex flex-col p-8 h-full z-20 shadow-[20px_0_60px_-15px_rgba(0,0,0,0.02)] overflow-hidden">
      <div className="mb-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 rounded-[1.2rem] flex items-center justify-center text-white shadow-xl shadow-blue-100 transition-transform hover:rotate-6 duration-300 shrink-0">
             <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-slate-900 leading-none">SyncCircle</h1>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">The Circle</h2>
          <div className="flex gap-2">
            <button onClick={() => onToggleAll(true)} className="text-[9px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest transition-colors">All</button>
            <span className="text-slate-200">/</span>
            <button onClick={() => onToggleAll(false)} className="text-[9px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors">None</button>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto pr-3 custom-scrollbar -mr-3 flex-1">
          {users.map((user) => (
            <div key={user.id} className="group flex items-center gap-2 animate-in fade-in duration-300">
              <div 
                className={`flex-1 flex items-center gap-4 p-3.5 rounded-[1.8rem] transition-all relative cursor-pointer border ${currentUser === user.id ? 'bg-[#fafbff] border-blue-100 shadow-sm' : 'hover:bg-slate-50 border-transparent'}`}
                onClick={() => onSelectCurrentUser(user.id)}
              >
                <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 border-2 border-white shadow-sm ring-1 ring-slate-100 shrink-0">
                    {user.avatar ? (
                      <img src={user.avatar} className="w-full h-full object-cover aspect-square" alt={user.name} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-black text-sm" style={{ backgroundColor: user.color }}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <input type="checkbox" checked={user.active} onChange={() => onToggleUser(user.id)} className="absolute -top-1 -left-1 w-5 h-5 rounded-full text-blue-600 border-slate-200 shadow-sm transition-all focus:ring-0 cursor-pointer" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${currentUser === user.id ? 'text-blue-700' : 'text-slate-600'}`}>{user.name}</p>
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-0.5">{user.active ? 'Viewing' : 'Hidden'}</p>
                </div>
                {currentUser !== user.id && (
                  <button onClick={(e) => { e.stopPropagation(); onDeleteUser(user.id); }} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 text-slate-200 hover:text-red-500 rounded-xl transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>
          ))}

          {isAdding ? (
            <div className="mt-4 p-5 bg-slate-50 rounded-[2.2rem] border border-slate-100 animate-in zoom-in-95 duration-200 shadow-inner">
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-full bg-white border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all overflow-hidden mx-auto group shrink-0">
                  {newAvatar ? (
                    <img src={newAvatar} className="w-full h-full object-cover aspect-square" alt="Avatar" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-200 group-hover:text-blue-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  )}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleAvatar} className="hidden" accept="image/*" />
                <input autoFocus className="w-full text-sm font-bold rounded-2xl border-slate-200 bg-white px-4 py-3 outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm" placeholder="Friend's Name..." value={newName} onChange={(e) => setNewName(e.target.value)} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-3 text-[10px] font-black uppercase text-slate-400 hover:bg-white rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-black text-[10px] uppercase rounded-xl shadow-lg hover:bg-blue-700">Add</button>
                </div>
              </form>
            </div>
          ) : (
            <button onClick={() => setIsAdding(true)} className="w-full mt-4 flex items-center justify-center gap-2 p-5 border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-400 hover:text-blue-600 hover:bg-blue-50/30 transition-all font-bold text-xs group">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
              Add a Profile
            </button>
          )}
        </div>
      </div>

      <div className="pt-8 border-t border-slate-100 space-y-4">
        <button onClick={onNewCircle} className="w-full py-4 px-6 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-[1.8rem] border border-slate-100 transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          Go to Circle Hub
        </button>
        
        <div 
          onClick={onOpenProfile}
          className={`group p-5 rounded-[2.8rem] transition-all duration-300 cursor-pointer ${currentUser ? 'bg-slate-900 text-white shadow-2xl hover:bg-black hover:scale-[1.02]' : 'bg-slate-50 text-slate-300'}`}
        >
          {currentUser ? (
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/10 overflow-hidden flex items-center justify-center font-black text-xl border border-white/5 shrink-0">
                {currentUserObj?.avatar ? (
                  <img src={currentUserObj.avatar} className="w-full h-full object-cover aspect-square" alt="Me" />
                ) : (
                  currentUserObj?.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black truncate leading-none">{currentUserObj?.name}</span>
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                  </div>
                </div>
                <span className="text-[9px] font-black opacity-40 uppercase tracking-widest mt-1.5 block">My Profile</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <span className="text-[9px] font-black uppercase tracking-widest block">Choose Profile</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
