
import React from 'react';
import { DAYS, TIME_SLOTS, formatTime } from '../constants';
import { ScheduleEvent, User } from '../types';

interface CalendarGridProps {
  users: User[];
  events: ScheduleEvent[];
  onDeleteEvent: (id: string) => void;
  onEditEvent: (event: ScheduleEvent) => void;
  currentDate: Date;
}

const CalendarGrid: React.FC<CalendarGridProps> = ({ users, events, onDeleteEvent, onEditEvent, currentDate }) => {
  const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {} as Record<string, User>);
  
  const getShiftedTime = (startTime: number, userTz: string) => {
    const now = new Date();
    const viewerOffset = -now.getTimezoneOffset();
    
    const userDate = new Date(now.toLocaleString('en-US', { timeZone: userTz }));
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const userOffset = (userDate.getTime() - utcDate.getTime()) / 60000;

    const diff = userOffset - viewerOffset;
    return startTime - diff;
  };

  const activeEvents = events.filter(e => {
    const user = userMap[e.userId];
    if (!user?.active) return false;

    const eventStart = new Date(e.startDate);
    const eventEnd = new Date(e.endDate);
    const checkDate = new Date(currentDate);
    
    checkDate.setHours(0, 0, 0, 0);
    eventStart.setHours(0, 0, 0, 0);
    eventEnd.setHours(0, 0, 0, 0);

    return checkDate >= eventStart && checkDate <= eventEnd;
  });

  const hourHeight = 92; 

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white rounded-[2.8rem] shadow-[0_32px_80px_-20px_rgba(0,0,0,0.06)] border border-slate-200/50">
      <div className="grid grid-cols-[80px_1fr] border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="p-4 border-r border-slate-100 text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] flex flex-col items-center justify-center leading-none">
          <span>Local</span>
          <span className="mt-1 opacity-50">View</span>
        </div>
        <div className="grid grid-cols-7">
          {DAYS.map((day) => (
            <div key={day} className="py-7 text-center group cursor-default">
              <span className="text-[11px] font-black text-slate-400 group-hover:text-blue-600 transition-colors uppercase tracking-[0.2em]">{day}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[80px_1fr] flex-1 overflow-y-auto relative custom-scrollbar bg-white">
        <div className="bg-[#fafbff]/50 border-r border-slate-100/60 sticky left-0 z-10">
          {TIME_SLOTS.map((hour) => (
            <div key={hour} style={{ height: hourHeight }} className="px-4 py-3 text-[10px] font-black text-slate-300 border-b border-slate-50 text-right tabular-nums">
              {hour.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 relative">
          {DAYS.map((_, dayIdx) => (
            <div key={dayIdx} className="relative border-r border-slate-50 last:border-r-0 h-full">
              {TIME_SLOTS.map((hour) => (
                <div key={hour} style={{ height: hourHeight }} className="border-b border-slate-50/60" />
              ))}

              {activeEvents
                .filter((e) => e.day === dayIdx)
                .map((e) => {
                  const user = userMap[e.userId];
                  const shiftedStartTime = getShiftedTime(e.startTime, user.timezone);
                  const top = (shiftedStartTime / 60) * hourHeight;
                  const height = (e.duration / 60) * hourHeight;
                  
                  return (
                    <div
                      key={e.id}
                      onClick={() => onEditEvent(e)}
                      className="absolute left-2 right-2 rounded-[1.4rem] p-4 text-[10px] shadow-sm overflow-hidden group transition-all duration-500 hover:z-30 hover:shadow-2xl hover:-translate-y-0.5 active:scale-[0.98] select-none border border-white/40 ring-1 ring-black/[0.02] cursor-pointer"
                      style={{
                        top: top + 6,
                        height: Math.max(height - 12, 44),
                        background: `linear-gradient(135deg, ${user.color}18, ${user.color}08)`,
                        borderLeft: `6px solid ${user.color}`,
                        color: user.color,
                      }}
                    >
                      {/* USER NAME AS HEADER */}
                      <div className="font-black truncate leading-none uppercase tracking-tight mb-2 text-[11px]">{user.name}</div>
                      
                      {/* EVENT AS SUBTEXT */}
                      <div className="flex items-center gap-1.5 opacity-80 font-black text-[9px] uppercase tracking-tighter">
                        <span className="w-1 h-1 rounded-full bg-current" />
                        {e.title}
                      </div>
                      
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={(ev) => { ev.stopPropagation(); onEditEvent(e); }}
                          className="bg-white/95 backdrop-blur-md shadow-lg rounded-xl w-7 h-7 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all active:scale-75"
                          title="Edit"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button 
                          onClick={(ev) => { ev.stopPropagation(); if(confirm(`Delete this event?`)) onDeleteEvent(e.id); }}
                          className="bg-white/95 backdrop-blur-md shadow-lg rounded-xl w-7 h-7 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-75"
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
      
      <div className="h-10 bg-slate-50/80 backdrop-blur-md border-t border-slate-100 px-6 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Viewer TZ: {viewerTz}
          </span>
        </div>
        <span>SyncCircle Engine v2.5</span>
      </div>
    </div>
  );
};

export default CalendarGrid;
