
import React, { useState } from 'react';

const AddPersonModal = ({ onConfirm, onClose, canCancel }: { onConfirm: (n: string) => void, onClose: () => void, canCancel: boolean }) => {
  const [n, setN] = useState('');
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 z-[100]">
      <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl w-full max-w-sm text-center border border-white/20 animate-in zoom-in-95 duration-300">
        <h1 className="text-3xl font-black mb-2 tracking-tighter">Who are you?</h1>
        <p className="text-slate-400 text-sm mb-10 font-medium">Your events will use your unique color.</p>
        <input 
            autoFocus
            className="w-full p-6 bg-slate-50 rounded-2xl mb-6 text-center text-xl font-black border border-slate-100 outline-none focus:ring-4 focus:ring-indigo-500/10" 
            placeholder="Your Name" 
            value={n} 
            onChange={e => setN(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && n && onConfirm(n)} 
        />
        <div className="flex gap-3">
          {canCancel && <button onClick={onClose} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-2xl font-black">Back</button>}
          <button disabled={!n} onClick={() => onConfirm(n)} className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg disabled:opacity-50">Enter Room</button>
        </div>
      </div>
    </div>
  );
};

export default AddPersonModal;
