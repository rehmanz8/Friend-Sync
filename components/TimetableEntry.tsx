
import React, { useState, useRef, useEffect } from 'react';
import { DayOfWeek, ScheduleEvent, User } from '../types';
import { DAYS, formatTime, formatDuration } from '../constants';
import { parseScheduleImage } from '../services/gemini';

interface TimetableEntryProps {
  currentUser: User;
  onAddBatch: (events: Omit<ScheduleEvent, 'id'>[], timezone: string) => void;
  onCancel: () => void;
}

const TimetableEntry: React.FC<TimetableEntryProps> = ({ currentUser, onAddBatch, onCancel }) => {
  const [step, setStep] = useState<'dates' | 'studio'>('dates');
  const [drafts, setDrafts] = useState<Omit<ScheduleEvent, 'id'>[]>([]);
  const [userTimezone, setUserTimezone] = useState(currentUser.timezone);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [globalStartDate, setGlobalStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [globalEndDate, setGlobalEndDate] = useState(() => {
    const end = new Date();
    end.setMonth(end.getMonth() + 4); 
    return end.toISOString().split('T')[0];
  });

  const [title, setTitle] = useState('');
  const [day, setDay] = useState<DayOfWeek>(0);
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(60);

  useEffect(() => {
    setDrafts(prev => prev.map(d => ({ ...d, startDate: globalStartDate, endDate: globalEndDate })));
  }, [globalStartDate, globalEndDate]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const [h, m] = startTime.split(':').map(Number);
    const updatedDraft: Omit<ScheduleEvent, 'id'> = {
      userId: currentUser.id,
      title: title || 'Activity',
      day,
      startTime: h * 60 + m,
      duration,
      startDate: globalStartDate,
      endDate: globalEndDate,
    };

    if (editingIndex !== null) {
      setDrafts(prev => {
        const next = [...prev];
        next[editingIndex] = updatedDraft;
        return next;
      });
      setEditingIndex(null);
    } else {
      setDrafts(prev => [...prev, updatedDraft]);
    }
    setTitle(''); 
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const aiEvents = await parseScheduleImage(base64Data, file.type);
        const mappedDrafts = aiEvents.map((ae: any) => ({
          userId: currentUser.id,
          title: ae.title || 'Extracted Event',
          day: (ae.day % 7) as DayOfWeek,
          startTime: ae.startTime,
          duration: ae.duration,
          startDate: globalStartDate,
          endDate: globalEndDate,
        }));
        setDrafts(prev => [...prev, ...mappedDrafts]);
        setIsProcessingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsProcessingImage(false);
      alert("AI failed to read image.");
    }
  };

  if (step === 'dates') {
    return (
      <div className="max-w-xl w-full bg-white rounded-[3.5rem] shadow-2xl p-16 border border-slate-100 animate-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-[1.8rem] flex items-center justify-center text-white shadow-xl mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Timeline Validity</h2>
          <p className="text-slate-400 text-sm mt-3 font-medium px-4">When should these schedule items be active?</p>
        </div>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Start Date</label>
            <input type="date" className="w-full p-5 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-100 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10" value={globalStartDate} onChange={(e) => setGlobalStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">End Date</label>
            <input type="date" className="w-full p-5 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-100 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10" value={globalEndDate} onChange={(e) => setGlobalEndDate(e.target.value)} />
          </div>
          <div className="pt-6 flex gap-4">
            <button onClick={onCancel} className="flex-1 py-5 bg-slate-100 text-slate-400 font-black rounded-2xl hover:bg-slate-200 transition-all">Cancel</button>
            <button onClick={() => setStep('studio')} className="flex-[2] py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Proceed to Studio</button>
          </div>
        </div>
      </div>
    );
  }

  const commonTimezones = (Intl as any).supportedValuesOf ? (Intl as any).supportedValuesOf('timeZone') : ['UTC', 'Europe/London', 'America/New_York'];

  return (
    <div className="max-w-6xl mx-auto w-full h-full flex flex-col animate-in fade-in slide-in-from-bottom-12 duration-700">
      <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-200/50 overflow-hidden flex flex-col flex-1">
        <div className="px-12 py-10 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">Schedule Studio</h2>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{currentUser.name}'s Queue</span>
              <button onClick={() => setStep('dates')} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-all">Range: {globalStartDate} — {globalEndDate}</button>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Zone</label>
              <select value={userTimezone} onChange={(e) => setUserTimezone(e.target.value)} className="bg-slate-50 border-none text-[10px] font-black text-indigo-600 rounded-xl px-4 py-2 ring-1 ring-slate-100 outline-none">{commonTimezones.map((tz: string) => <option key={tz} value={tz}>{tz}</option>)}</select>
            </div>
            <button onClick={onCancel} className="p-4 bg-slate-50 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-white">
            <div className="mb-12 p-10 bg-indigo-50/40 rounded-[2.5rem] border-2 border-dashed border-indigo-200/50 text-center">
              {isProcessingImage ? (
                <div className="flex flex-col items-center gap-4 py-4"><div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /><p className="font-black text-indigo-600 text-xs uppercase tracking-widest">Scanning Image...</p></div>
              ) : (
                <>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">Sync via Image</h3>
                  <p className="text-xs text-slate-500 font-medium mb-8">Drop your timetable screenshot here.</p>
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                  <button onClick={() => fileInputRef.current?.click()} className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all text-xs uppercase tracking-widest">Upload Screenshot</button>
                </>
              )}
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-8">
              <div><label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4 ml-4">Event Name</label><input type="text" required className="w-full text-2xl font-black bg-slate-50 rounded-[1.8rem] border-none px-8 py-6 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-200" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="E.g. Bio Lecture" /></div>
              <div className="grid grid-cols-2 gap-8">
                <div><label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4 ml-4">Weekly Day</label><select className="w-full rounded-[1.5rem] bg-slate-50 border-none px-6 py-5 font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" value={day} onChange={(e) => setDay(Number(e.target.value) as DayOfWeek)}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
                <div><label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4 ml-4">Start Time</label><input type="time" className="w-full rounded-[1.5rem] bg-slate-50 border-none px-6 py-5 font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
              </div>
              <button type="submit" className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black shadow-xl hover:bg-slate-800 transition-all active:scale-[0.98]">
                {editingIndex !== null ? 'Update Draft' : 'Add to Studio Queue'}
              </button>
            </form>
          </div>

          <div className="w-[400px] bg-slate-50 overflow-y-auto p-12 shrink-0 border-l border-slate-100 flex flex-col">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8">Studio Queue</h3>
            <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
              {drafts.map((d, i) => (
                <div key={i} className="group bg-white p-6 rounded-[2rem] border border-slate-200 transition-all hover:shadow-xl hover:-translate-y-1">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-black text-slate-900 truncate mb-2">{d.title}</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">{DAYS[d.day]}</span>
                        <span className="text-[9px] font-black bg-indigo-50 text-indigo-500 px-2 py-1 rounded-lg">{formatTime(d.startTime)}</span>
                      </div>
                    </div>
                    <button onClick={() => setDrafts(prev => prev.filter((_, idx) => idx !== i))} className="p-2 text-slate-300 hover:text-red-500 rounded-xl transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              ))}
              {drafts.length === 0 && <div className="h-40 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex items-center justify-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Studio Empty</div>}
            </div>
            {drafts.length > 0 && (
              <button onClick={() => onAddBatch(drafts, userTimezone)} className="w-full mt-10 py-6 bg-indigo-600 text-white rounded-[2rem] font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">
                Sync Timetable ({drafts.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimetableEntry;
