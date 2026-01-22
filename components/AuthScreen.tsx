
import React from 'react';

const AuthScreen = ({ onActivate }: { onActivate: (u: string, k: string) => void }) => (
  <div className="h-screen w-full flex items-center justify-center bg-slate-100 p-6">
    <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md border border-slate-100">
      <div className="w-16 h-16 bg-indigo-600 rounded-3xl mb-8 flex items-center justify-center text-white shadow-xl rotate-3">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
      </div>
      <h1 className="text-3xl font-black mb-2 tracking-tighter">Sync Engine</h1>
      <p className="text-slate-400 text-sm mb-10 font-medium">Link your Supabase database to start collaborating.</p>
      <div className="space-y-4">
        <input id="u" className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" placeholder="Project URL" />
        <input id="k" className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" placeholder="Anon Key" />
        <button onClick={() => onActivate((document.getElementById('u') as HTMLInputElement).value, (document.getElementById('k') as HTMLInputElement).value)} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 mt-4">Connect Cloud</button>
      </div>
    </div>
  </div>
);

export default AuthScreen;
