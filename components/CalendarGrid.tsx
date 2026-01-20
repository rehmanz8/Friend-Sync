
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

interface EventLayout {
  event: ScheduleEvent;
  column: number;
  totalColumns: number;
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

  const calculateLayout = (dayEvents: ScheduleEvent[]): EventLayout[] => {
    const sorted = [...dayEvents].sort((a, b) => a.startTime - b.startTime);
    const columns: ScheduleEvent[][] = [];
    
    sorted.forEach(event => {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const lastEvent = columns[i][columns[i].length - 1];
        if (event.startTime >= lastEvent.startTime + lastEvent.duration) {
          columns[i].push(event);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([event]);
      }
    });

    const layout: EventLayout[] = [];
    columns.forEach((col, colIdx) => {
      col.forEach(event => {
        layout.push({
          event,
          column: colIdx,
          totalColumns: columns.length
        });
      });
    });
    return layout;
  };

  const hourHeight = 120;
  const colMinWidth = 250; 

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white rounded-[3rem] shadow-xl border border-slate-200/60">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto custom-scrollbar relative">
          
          <div className="flex sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 min-w-max">
            <div className="w-[100px] shrink-0 p-4 border-r border-slate-100 flex items-center justify-center">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none text-center">
                {viewerTz.split('/')[1]?.replace('_', ' ')}
              </span>
            </div>
            {DAYS.map((day) => (
              <div 
                key={day} 
                style={{ width: colMinWidth }} 
                className="shrink-0 py-8 text-center border-r border-slate-50 last:border-r-0"
              >
                <span className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">{day}</span>
              </div>
            ))}
          </div>

          <div className="flex min-w-max">
            <div className="w-[100px] shrink-0 bg-[#fafbff]/30 border-r border-slate-100/60 sticky left-0 z-20">
              {TIME_SLOTS.map((hour) => (
                <div key={hour} style={{ height: hourHeight }} className="px-4 py-4 text-[11px] font-black text-slate-300 border-b border-slate-50 text-right tabular-nums">
                  {hour.toString().padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {DAYS.map((_, dayIdx) => {
              const dayEvents = activeEvents.filter(e => e.day === dayIdx);
              const layouts = calculateLayout(dayEvents);
              
              return (
                <div 
                  key={dayIdx} 
                  style={{ width: colMinWidth }} 
                  className="shrink-0 relative border-r border-slate-50 last:border-r-0 h-full"
                >
                  {TIME_SLOTS.map((hour) => (
                    <div key={hour} style={{ height: hourHeight }} className="border-b border-slate-50/40" />
                  ))}

                  {layouts.map(({ event: e, column, totalColumns }) => {
                    const user = userMap[e.userId];
                    if (!user) return null;
                    const shiftedStartTime = getShiftedTime(e.startTime, user.timezone);
                    const top = (shiftedStartTime / 60) * hourHeight;
                    const height = (e.duration / 60) * hourHeight;
                    
                    const left = (column / totalColumns) * 100;
                    const width = (1 / totalColumns) * 100;

                    return (
                      <div
                        key={e.id}
                        onClick={() => onEditEvent(e)}
                        className="absolute rounded-[1.5rem] p-4 shadow-sm group transition-all duration-300 hover:z-40 hover:shadow-2xl hover:-translate-y-0.5 active:scale-[0.98] select-none border border-white ring-1 ring-black/[0.04] cursor-pointer overflow-hidden"
                        style={{
                          top: top + 2,
                          height: Math.max(height - 4, 85),
                          left: `${left}%`,
                          width: `calc(${width}% - 6px)`,
                          backgroundColor: `${user.color}10`,
                          borderLeft: `5px solid ${user.color}`,
                          margin: '0 3px'
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className="w-6 h-6 rounded-full overflow-hidden border border-white shadow-sm shrink-0 bg-slate-100">
                               {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover aspect-square" /> : <div className="w-full h-full flex items-center justify-center text-[8px] font-black text-white" style={{ backgroundColor: user.color }}>{user.name.charAt(0)}</div>}
                            </div>
                            <span className="font-black text-[9px] uppercase tracking-wider text-slate-500 truncate">
                              {user.name}
                            </span>
                          </div>
                          <button 
                            onClick={(ev) => { ev.stopPropagation(); onDeleteEvent(e.id); }}
                            className="w-7 h-7 bg-white text-red-300 hover:text-red-500 rounded-xl shadow-md border border-slate-100 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        
                        <div className="font-black text-xs text-slate-900 leading-tight mb-2 line-clamp-3">
                          {e.title}
                        </div>
                        
                        <div className="text-[9px] font-black text-slate-400 tabular-nums">
                          {formatTime(e.startTime)} — {formatTime(e.startTime + e.duration)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      <div className="h-10 bg-slate-50 border-t border-slate-100 px-8 flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2 text-blue-500">
            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            Live Sync Hub Active
          </span>
          <span className="opacity-40">|</span>
          <span>Click schedule to edit</span>
        </div>
        <span>SyncCircle Visual Engine v3.5</span>
      </div>
    </div>
  );
};

export default CalendarGrid;
