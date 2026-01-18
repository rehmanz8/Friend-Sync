
import React, { useState, useEffect } from 'react';
import { DayOfWeek, ScheduleEvent } from '../types';
import { DAYS, formatDuration } from '../constants';

interface EventFormProps {
  userId: string;
  initialData?: ScheduleEvent;
  onAdd: (event: Omit<ScheduleEvent, 'id'>) => void;
  onClose: () => void;
  isEdit?: boolean;
}

const EventForm: React.FC<EventFormProps> = ({ userId, initialData, onAdd, onClose, isEdit }) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [day, setDay] = useState<DayOfWeek>(initialData?.day || 0);
  
  // Format starting minutes to HH:MM
  const getInitialTime = () => {
    if (!initialData) return '09:00';
    const h = Math.floor(initialData.startTime / 60);
    const m = initialData.startTime % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };
  
  const [startTime, setStartTime] = useState(getInitialTime());
  const [duration, setDuration] = useState(initialData?.duration || 60);
  const [startDate, setStartDate] = useState(initialData?.startDate || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(initialData?.endDate || new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const [h, m] = startTime.split(':').map(Number);
    onAdd({
      userId,
      title: title || 'Untitled Event',
      day,
      startTime: h * 60 + m,
      duration,
      startDate,
      endDate,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] overflow-y-auto max-h-[95vh] border border-slate-100">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{isEdit ? 'Refine Event' : 'Add Activity'}</h3>
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mt-2">Personal Timeline Adjustment</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-50 text-slate-300 hover:text-slate-600 rounded-2xl transition-all">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
             </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="block text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-3 ml-1">Event Name</label>
            <input
              type="text"
              required
              autoFocus
              className="w-full text-xl font-black bg-[#fafbff] rounded-2xl border-slate-100 shadow-sm focus:ring-[10px] focus:ring-blue-500/5 focus:border-blue-500 px-6 py-4 border transition-all placeholder:text-slate-200"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="E.g. Coffee Break"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-3 ml-1">Weekly Day</label>
              <select
                className="w-full rounded-2xl border-slate-100 shadow-sm focus:ring-[10px] focus:ring-blue-500/5 px-5 py-4 border bg-[#fafbff] font-black text-slate-600 appearance-none"
                value={day}
                onChange={(e) => setDay(Number(e.target.value) as DayOfWeek)}
              >
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-3 ml-1">Start Time</label>
              <input
                type="time"
                className="w-full rounded-2xl border-slate-100 shadow-sm focus:ring-[10px] focus:ring-blue-500/5 px-5 py-4 border font-black text-slate-600 bg-[#fafbff]"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-end mb-4">
               <label className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] ml-1">Duration</label>
               <span className="text-blue-600 font-black text-sm bg-blue-50 px-3 py-1.5 rounded-xl">{formatDuration(duration)}</span>
            </div>
            <input
              type="range"
              min="15"
              max="600"
              step="15"
              className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-50">
            <div>
              <label className="block text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-3">Effective From</label>
              <input
                type="date"
                required
                className="w-full rounded-2xl border-slate-100 px-5 py-3.5 border text-xs font-black text-slate-500 bg-[#fafbff]"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-3">Effective Until</label>
              <input
                type="date"
                required
                className="w-full rounded-2xl border-slate-100 px-5 py-3.5 border text-xs font-black text-slate-500 bg-[#fafbff]"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-5 bg-slate-50 text-slate-400 font-black rounded-2xl hover:bg-slate-100 transition-all text-sm uppercase tracking-widest"
            >
              Discard
            </button>
            <button
              type="submit"
              className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 text-sm uppercase tracking-widest"
            >
              {isEdit ? 'Save Changes' : 'Sync Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventForm;
