
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
      title: title || 'Untitled Activity',
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

  const startEditing = (index: number) => {
    const d = drafts[index];
    if (!d) return;
    setEditingIndex(index);
    setTitle(d.title);
    setDay(d.day);
    const h = Math.floor(d.startTime / 60);
    const m = d.startTime % 60;
    setStartTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    setDuration(d.duration);
  };

  const removeDraft = (index: number) => {
    setDrafts(prev => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setTitle('');
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
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

  const handleFinalSync = () => {
    if (drafts.length === 0) return;
    onAddBatch(drafts, userTimezone);
  };

  if (step === 'dates') {
    return (
      <div className="max-w-xl w-full bg-white rounded-[3rem] shadow-2xl p-12 border border-slate-100 animate-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">Schedule Duration</h2>
          <p className="text-slate-500 text-sm mt-4 leading-relaxed font-medium px-4">Define the range for your timetable. All events you sync will stay active during this period.</p>
        </div>
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Commencement Date</label>
            <input type="date" className="w-full p-5 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-100 focus:ring-4 focus:ring-blue-500/10 font-bold text-slate-700 outline-none" value={globalStartDate} onChange={(e) => setGlobalStartDate(e.target.value)} />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Cessation Date</label>
            <input type="date" className="w-full p-5 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-100 focus:ring-4 focus:ring-blue-500/10 font-bold text-slate-700 outline-none" value={globalEndDate} onChange={(e) => setGlobalEndDate(e.target.value)} />
          </div>
          <div className="pt-6 flex gap-4">
            <button onClick={onCancel} className="flex-1 py-5 bg-slate-100 text-slate-400 font-black rounded-2xl hover:bg-slate-200 transition-all active:scale-95 border border-slate-200">Discard</button>
            <button onClick={() => setStep('studio')} className="flex-[2] py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.98]">Proceed</button>
          </div>
        </div>
      </div>
    );
  }

  const commonTimezones = (Intl as any).supportedValuesOf ? (Intl as any).supportedValuesOf('timeZone') : ['UTC', 'Europe/London', 'America/New_York', 'Asia/Tokyo'];

  return (
    <div className="max-w-6xl mx-auto w-full h-[88vh] flex flex-col animate-in fade-in slide-in-from-bottom-12 duration-700">
      <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-200/50 overflow-hidden flex flex-col flex-1">
        <div className="px-12 py-10 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none mb-3">Add Timetable Studio</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentUser.color }} /><span className="text-sm font-black uppercase tracking-widest text-slate-400">{currentUser.name}</span></div>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
              <button onClick={() => setStep('dates')} className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-all flex items-center gap-2">Range: {globalStartDate} — {globalEndDate} <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <label className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1.5">Local Timezone</label>
              <select value={userTimezone} onChange={(e) => setUserTimezone(e.target.value)} className="bg-slate-50 border-none text-xs font-black text-blue-600 rounded-xl px-4 py-2 ring-1 ring-slate-100 focus:ring-blue-500/20">{commonTimezones.map((tz: string) => <option key={tz} value={tz}>{tz}</option>)}</select>
            </div>
            <button onClick={onCancel} className="w-14 h-14 flex items-center justify-center bg-white border border-slate-200 rounded-[1.5rem] hover:bg-red-50 hover:text-red-500 transition-all text-slate-400 active:scale-90" title="Discard and Exit">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-white">
            <div className="mb-12 p-8 bg-blue-50/50 rounded-[2.5rem] border-2 border-dashed border-blue-200/50 flex flex-col items-center justify-center text-center">
              {isProcessingImage ? (
                <div className="flex flex-col items-center gap-4 py-4"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /><p className="font-black text-blue-600 text-sm uppercase tracking-widest">Scanning Image...</p></div>
              ) : (
                <>
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm mb-6"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">Scan Timetable Image</h3>
                  <p className="text-sm text-slate-500 font-medium max-w-sm mb-8">Upload a photo to populate the queue instantly.</p>
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                  <button onClick={() => fileInputRef.current?.click()} className="px-8 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl hover:bg-blue-700 transition-all active:scale-95 text-xs uppercase tracking-widest">Upload Photo</button>
                </>
              )}
            </div>

            <div className="flex items-center gap-6 mb-10"><div className="h-px flex-1 bg-slate-100" /><span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">{editingIndex !== null ? 'Modifying Item' : 'Manual Entry'}</span><div className="h-px flex-1 bg-slate-100" /></div>

            <form onSubmit={handleManualSubmit} className="space-y-10">
              <div className="space-y-8">
                <div><label className="block text-xs font-black text-slate-300 uppercase tracking-[0.2em] mb-4">Event Label</label><input type="text" required className="w-full text-3xl font-black bg-[#fafbff] rounded-[2rem] border-slate-100 shadow-sm focus:border-blue-500 focus:ring-[12px] focus:ring-blue-500/5 px-8 py-6 border transition-all placeholder:text-slate-200" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Class, Work, etc." /></div>
                <div className="grid grid-cols-2 gap-8">
                  <div className="group"><label className="block text-xs font-black text-slate-300 uppercase tracking-[0.2em] mb-4">Weekly Day</label><select className="w-full rounded-[1.5rem] border-slate-100 shadow-sm focus:ring-[12px] focus:ring-blue-500/5 px-6 py-5 border bg-[#fafbff] font-black text-slate-700 appearance-none transition-all" value={day} onChange={(e) => setDay(Number(e.target.value) as DayOfWeek)}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
                  <div className="group"><label className="block text-xs font-black text-slate-300 uppercase tracking-[0.2em] mb-4">Start Time</label><input type="time" className="w-full rounded-[1.5rem] border-slate-100 shadow-sm focus:ring-[12px] focus:ring-blue-500/5 px-6 py-5 border font-black text-slate-700 bg-[#fafbff] transition-all" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
                </div>
                <div>
                  <div className="flex justify-between items-end mb-6"><label className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">Duration</label><span className="text-blue-600 font-black text-lg bg-blue-50 px-4 py-2 rounded-2xl">{formatDuration(duration)}</span></div>
                  <input type="range" min="15" max="600" step="15" className="w-full h-3 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                </div>
              </div>
              <button type="submit" className={`w-full py-6 rounded-[2rem] transition-all font-black shadow-2xl flex items-center justify-center gap-4 active:scale-[0.98] ${editingIndex !== null ? 'bg-indigo-600 text-white shadow-indigo-100' : 'bg-slate-900 text-white shadow-slate-200'}`}>
                <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg></div>
                <span>{editingIndex !== null ? 'Update Draft' : 'Add to Queue'}</span>
              </button>
            </form>
          </div>

          <div className="w-[420px] bg-[#f8fafc] overflow-y-auto p-12 shrink-0 border-l border-slate-100/50 flex flex-col">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-8">Studio Queue</h3>
            <div className="space-y-5 flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
              {drafts.map((d, i) => (
                <div key={`${d.title}-${i}`} className={`group relative bg-white p-6 rounded-[2.2rem] border transition-all duration-300 shadow-sm animate-in zoom-in-95 ${editingIndex === i ? 'ring-2 ring-blue-500 border-transparent shadow-blue-100' : 'border-slate-200/50 hover:shadow-xl hover:-translate-y-1'}`}>
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 pr-4 cursor-pointer flex-1" onClick={() => startEditing(i)}>
                      <p className="text-base font-black text-slate-900 truncate mb-2">{d.title}</p>
                      <div className="flex flex-wrap gap-2"><span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-lg uppercase">{DAYS[d.day]}</span><span className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded-lg">{formatTime(d.startTime)}</span><span className="text-[9px] font-black bg-indigo-50 text-indigo-500 px-2 py-1 rounded-lg">{formatDuration(d.duration)}</span></div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={(e) => { e.stopPropagation(); startEditing(i); }} className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all active:scale-90" title="Edit Item">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); removeDraft(i); }} className="w-10 h-10 flex items-center justify-center bg-slate-50 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all active:scale-90" title="Discard Item">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {drafts.length === 0 && <div className="h-64 border-4 border-dashed border-slate-200/50 rounded-[2.5rem] flex flex-col items-center justify-center p-10 text-center"><p className="text-xs text-slate-400 font-black uppercase tracking-widest leading-loose">Queue is empty</p></div>}
            </div>
            {drafts.length > 0 && (
              <div className="mt-10 pt-10 border-t border-slate-200/50 space-y-4">
                <div className="flex justify-between items-center mb-4 px-4"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Duration</span><span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg tabular-nums">{globalStartDate} — {globalEndDate}</span></div>
                <button onClick={handleFinalSync} className="w-full py-6 bg-blue-600 text-white rounded-[2rem] hover:bg-blue-700 transition-all font-black shadow-2xl shadow-blue-100 flex items-center justify-center gap-3 active:scale-95 animate-in slide-in-from-bottom-4 duration-300">Sync Timetable ({drafts.length}) <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimetableEntry;
