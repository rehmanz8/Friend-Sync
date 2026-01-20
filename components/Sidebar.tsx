
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
  users, onToggleUser, onToggleAll, onAddUser, onDeleteUser, onSelectCurrentUser, onOpenProfile, currentUser, onNewCircle
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
      <div className="mb-12">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-slate-900 rounded-[1rem] flex items-center justify-center text-white shadow-xl transition-transform hover:rotate-6 duration-300 shrink-0">
             <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h1 className="text-xl font-black tracking-tighter text-slate-900 leading-none">SyncCircle</h1>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">The Circle</h2>
          <div className="flex gap-2">
            <button onClick={() => onToggleAll(true)} className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest transition-colors">All</button>
            <span className="text-slate-100">|</span>
            <button onClick={() => onToggleAll(false)} className="text-[9px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors">None</button>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto pr-3 custom-scrollbar -mr-3 flex-1">
          {users.map((user) => (
            <div key={user.id} className="group animate-in fade-in duration-300">
              <div 
                className={`flex items-center gap-4 p-4 rounded-[1.8rem] transition-all relative cursor-pointer border ${currentUser === user.id ? 'bg-slate-50 border-slate-200' : 'hover:bg-slate-50/50 border-transparent'}`}
                onClick={() => onSelectCurrentUser(user.id)}
              >
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-white border-2 border-white shadow-md ring-1 ring-slate-100 shrink-0">
                    {user.avatar ? (
                      <img src={user.avatar} className="w-full h-full object-cover aspect-square" alt={user.name} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-black text-sm" style={{ backgroundColor: user.color }}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-4 border-white shadow-sm ${user.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-black truncate ${currentUser === user.id ? 'text-slate-900' : 'text-slate-600'}`}>{user.name}</p>
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-0.5">{user.active ? 'Viewing Live' : 'Not Active'}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onToggleUser(user.id); }} className={`p-2 rounded-xl transition-all ${user.active ? 'text-indigo-600 bg-indigo-50' : 'text-slate-300 bg-slate-50'}`}>
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                </button>
              </div>
            </div>
          ))}

          {isAdding ? (
            <div className="mt-4 p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 animate-in zoom-in-95 duration-200">
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <input autoFocus className="w-full text-sm font-bold rounded-2xl border-slate-200 bg-white px-5 py-4 outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-sm" placeholder="New Friend..." value={newName} onChange={(e) => setNewName(e.target.value)} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-3 text-[10px] font-black uppercase text-slate-400">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-slate-900 text-white font-black text-[10px] uppercase rounded-xl">Add</button>
                </div>
              </form>
            </div>
          ) : (
            <button onClick={() => setIsAdding(true)} className="w-full mt-4 flex items-center justify-center gap-2 p-5 border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all font-black text-[10px] uppercase tracking-widest group">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              Invite Friend
            </button>
          )}
        </div>
      </div>

      <div className="pt-8 border-t border-slate-100">
        <button 
          onClick={onOpenProfile}
          className={`group w-full p-4 rounded-[2rem] transition-all duration-300 border ${currentUser ? 'bg-slate-50 border-slate-200 hover:border-slate-300' : 'bg-slate-50 border-transparent text-slate-300'}`}
        >
          {currentUser ? (
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0 overflow-hidden shadow-md">
                {currentUserObj?.avatar ? <img src={currentUserObj.avatar} className="w-full h-full object-cover" /> : currentUserObj?.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black truncate leading-none mb-1">{currentUserObj?.name}</p>
                <p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">My Cloud Profile</p>
              </div>
            </div>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-widest">Select Profile</span>
          )}
        </button>
        <button onClick={onNewCircle} className="w-full mt-4 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">Return to Dashboard</button>
      </div>
    </div>
  );
};

export default Sidebar;
