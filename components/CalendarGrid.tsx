
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
    <div className="flex-1 bg-slate-900 rounded-[3rem] shadow-2xl border border-white/5 overflow-hidden flex flex-col">
      <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-white/5 bg-black/20">
        <div className="p-6 border-r border-white/5 flex items-center justify-center">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
           </svg>
        </div>
        {DAYS.map((day) => (
          <div key={day} className="p-6 text-center border-r border-white/5 last:border-r-0">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{day}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto relative custom-scrollbar">
        <div className="grid grid-cols-[80px_repeat(7,1fr)] relative min-h-full">
          <div className="border-r border-white/5 bg-slate-900 sticky left-0 z-10">
            {TIME_SLOTS.map(hour => (
              <div key={hour} className="h-24 p-4 text-right border-b border-white/5">
                <span className="text-[10px] font-black text-slate-600 uppercase tabular-nums">
                  {hour.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {DAYS.map((_, dayIndex) => (
            <div key={dayIndex} className="relative border-r border-white/5 last:border-r-0 h-full">
              {TIME_SLOTS.map(hour => (
                <div key={hour} className="h-24 border-b border-white/5" />
              ))}

              {filteredEvents
                .filter(e => e.day === dayIndex)
                .map(event => {
                  const user = users.find(u => u.id === event.userId);
                  const top = (event.startTime / 60) * 96;
                  const height = (event.duration / 60) * 96;

                  return (
                    <div
                      key={event.id}
                      onClick={() => onEditEvent(event)}
                      className="absolute left-1.5 right-1.5 rounded-2xl p-4 shadow-xl border-l-4 overflow-hidden group transition-all hover:scale-[1.03] hover:z-20 cursor-pointer backdrop-blur-md"
                      style={{
                        top: `${top + 4}px`,
                        height: `${height - 8}px`,
                        backgroundColor: `${user?.color || '#4F46E5'}15`,
                        borderColor: user?.color || '#4F46E5',
                      }}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <p 
                          className="text-[10px] font-black uppercase truncate tracking-tight pr-4"
                          style={{ color: user?.color }}
                        >
                          {event.title}
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteEvent(event.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/10 rounded-lg transition-all"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-[9px] font-black text-slate-500 tabular-nums">
                          {formatTime(event.startTime)}
                        </p>
                      </div>
                      
                      <div className="absolute bottom-3 right-3 flex items-center gap-2">
                        {user?.avatar ? (
                          <img src={user.avatar} className="w-5 h-5 rounded-full border-2 border-slate-900" />
                        ) : (
                          <div 
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-black text-white border-2 border-slate-900 shadow-lg"
                            style={{ backgroundColor: user?.color }}
                          >
                            {user?.name.charAt(0).toUpperCase()}
                          </div>
                        )}
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
