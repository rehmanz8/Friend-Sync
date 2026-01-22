
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

const CalendarGrid: React.FC<CalendarGridProps> = ({ 
  users, 
  events, 
  onDeleteEvent, 
  onEditEvent,
  currentDate 
}) => {
  const activeUserIds = new Set(users.filter(u => u.active).map(u => u.id));
  const filteredEvents = events.filter(e => activeUserIds.has(e.userId));

  return (
    <div className="flex-1 bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-slate-100 bg-slate-50/50">
        <div className="p-4 border-r border-slate-100 flex items-center justify-center text-slate-300">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        {DAYS.map((day) => (
          <div key={day} className="p-4 text-center border-r border-slate-100 last:border-r-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{day}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto relative custom-scrollbar">
        <div className="grid grid-cols-[80px_repeat(7,1fr)] relative min-h-full">
          <div className="border-r border-slate-100 bg-white sticky left-0 z-10">
            {TIME_SLOTS.map(hour => (
              <div key={hour} className="h-20 p-4 text-right border-b border-slate-50 flex items-start justify-end">
                <span className="text-[9px] font-black text-slate-400 uppercase tabular-nums">
                  {hour.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {DAYS.map((_, dayIndex) => (
            <div key={dayIndex} className="relative border-r border-slate-50 last:border-r-0 h-full group/col">
              {TIME_SLOTS.map(hour => (
                <div key={hour} className="h-20 border-b border-slate-50" />
              ))}

              {filteredEvents
                .filter(e => e.day === dayIndex)
                .map(event => {
                  const user = users.find(u => u.id === event.userId);
                  const top = (event.startTime / 60) * 80;
                  const height = (event.duration / 60) * 80;

                  return (
                    <div
                      key={event.id}
                      className="absolute left-1 right-1 rounded-xl p-3 shadow-md border-l-4 overflow-hidden group transition-all hover:z-20 cursor-default"
                      style={{
                        top: `${top + 2}px`,
                        height: `${height - 4}px`,
                        backgroundColor: `${user?.color || '#6366f1'}10`,
                        borderColor: user?.color || '#6366f1',
                      }}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-[9px] font-black uppercase truncate tracking-tight pr-4 text-slate-800">
                          {event.title}
                        </p>
                        <button
                          onClick={() => onDeleteEvent(event.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-black/5 rounded transition-all"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-[8px] font-bold text-slate-400 tabular-nums">
                          {formatTime(event.startTime)}
                        </span>
                        <div 
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[6px] font-black text-white shadow-sm"
                            style={{ backgroundColor: user?.color }}
                        >
                          {user?.name.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarGrid;
