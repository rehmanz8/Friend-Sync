
import React from 'react';

const LandingScreen = ({ onCreate }: { onCreate: () => void }) => (
  <div className="h-screen w-full flex items-center justify-center bg-slate-100 p-6">
    <button onClick={onCreate} className="bg-indigo-600 p-16 rounded-[4rem] text-white text-center hover:scale-105 transition-all shadow-2xl shadow-indigo-200 group relative overflow-hidden">
      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10">
        <div className="w-20 h-20 bg-white/20 rounded-3xl mx-auto mb-8 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
        </div>
        <h3 className="text-4xl font-black tracking-tighter">Create New Calendar</h3>
        <p className="opacity-60 mt-4 font-bold text-lg">Start scheduling with friends in seconds.</p>
      </div>
    </button>
  </div>
);

export default LandingScreen;
