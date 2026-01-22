
import React from 'react';
import { User } from '../types';

interface SidebarProps {
  users: User[];
  onToggleUser: (id: string) => void;
  onToggleAll: (active: boolean) => void;
  onAddPerson: () => void;
  currentUser: string | null;
  onSelectUser: (user: User) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  users, onToggleUser, onToggleAll, onAddPerson, currentUser, onSelectUser
}) => {
  return (
    <div className="w-80 bg-white border-r border-slate-200 flex flex-col p-8 h-full z-20 shrink-0">
      <div className="mb-12 flex items-center gap-4">
        <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
           <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <h1 className="text-xl font-black tracking-tighter text-slate-900 leading-none">SyncCircle</h1>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Active Friends</h2>
          <div className="flex gap-2">
            <button onClick={() => onToggleAll(true)} className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">All</button>
            <span className="text-slate-100">|</span>
            <button onClick={() => onToggleAll(false)} className="text-[9px] font-black text-slate-400 uppercase tracking-widest">None</button>
          </div>
        </div>

        <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1 mb-8">
          {users.map((user) => (
            <button 
                key={user.id} 
                onClick={() => onSelectUser(user)}
                className={`w-full flex items-center gap-4 p-4 rounded-[1.8rem] transition-all border group text-left ${currentUser === user.id ? 'bg-slate-50 border-slate-200 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}
            >
              <div className="relative shrink-0">
                <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-xs border-2 border-white shadow-sm" 
                    style={{ backgroundColor: user.color }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                {user.active && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-black truncate ${currentUser === user.id ? 'text-slate-900' : 'text-slate-500'}`}>{user.name}</p>
                {currentUser === user.id && <p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">Selected</p>}
              </div>
              <div onClick={(e) => { e.stopPropagation(); onToggleUser(user.id); }} className={`p-1.5 rounded-lg transition-all ${user.active ? 'text-indigo-400' : 'text-slate-200'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
              </div>
            </button>
          ))}
        </div>

        <div className="shrink-0 space-y-3">
            <button 
                onClick={onAddPerson}
                className="w-full py-5 rounded-[2rem] border-2 border-dashed border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all flex items-center justify-center gap-3"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                Add Person
            </button>
            <p className="text-[8px] text-center font-bold text-slate-300 uppercase tracking-[0.2em]">Switch identity by clicking a name</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
