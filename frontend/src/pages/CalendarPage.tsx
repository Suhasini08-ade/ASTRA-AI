import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  MapPin, 
  Users, 
  X,
  CalendarDays,
  Bell,
  CheckCircle2,
  Tag,
  Filter,
  Sparkles,
  Info
} from 'lucide-react';
import { CalendarEventItem, TaskItem, ReminderItem } from '../types';

interface CalendarPageProps {
  events: CalendarEventItem[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEventItem[]>>;
  tasks?: TaskItem[];
  reminders?: ReminderItem[];
}

export const CalendarPage: React.FC<CalendarPageProps> = ({
  events,
  setEvents,
  tasks = [],
  reminders = [],
}) => {
  // Real today's date setup
  const todayDate = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const y = todayDate.getFullYear();
    const m = String(todayDate.getMonth() + 1).padStart(2, '0');
    const d = String(todayDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [todayDate]);

  // Current viewed month date state
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  // Selected day string (YYYY-MM-DD) - default to today
  const [selectedDay, setSelectedDay] = useState<string>(todayStr);

  // Direction animation state for month transitions
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  // Filter category state
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');

  // Modal State
  const [showModal, setShowModal] = useState(false);

  // New Event Form
  const [evtTitle, setEvtTitle] = useState('');
  const [evtTime, setEvtTime] = useState('10:00 AM - 11:00 AM');
  const [evtDate, setEvtDate] = useState(selectedDay);
  const [evtLocation, setEvtLocation] = useState('');
  const [evtCategory, setEvtCategory] = useState<CalendarEventItem['category']>('Meeting');

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Current year & month details
  const viewYear = currentDate.getFullYear();
  const viewMonth = currentDate.getMonth();

  // Navigation handlers
  const handlePrevMonth = () => {
    setSlideDirection('left');
    setCurrentDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setSlideDirection('right');
    setCurrentDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const handleTodayClick = () => {
    const now = new Date();
    setSlideDirection(now > currentDate ? 'right' : 'left');
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(todayStr);
  };

  const handleAddEvent = () => {
    if (!evtTitle.trim()) return;

    const newEvt: CalendarEventItem = {
      id: `evt-${Date.now()}`,
      title: evtTitle.trim(),
      date: evtDate || selectedDay,
      time: evtTime || 'All Day',
      location: evtLocation.trim() || undefined,
      category: evtCategory,
      attendees: ['Me'],
      color: '#3B82F6',
    };

    setEvents(prev => [...prev, newEvt]);
    setShowModal(false);
    setEvtTitle('');
    setEvtLocation('');
  };

  // Compute Days Grid for View Month
  const { monthDays, prevMonthDaysCount, startDayIndex } = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startIdx = firstDay.getDay(); // 0 = Sun, 1 = Mon ...
    const daysInCurrMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    return {
      startDayIndex: startIdx,
      monthDays: daysInCurrMonth,
      prevMonthDaysCount: daysInPrevMonth,
    };
  }, [viewYear, viewMonth]);

  // Map reminders to YYYY-MM-DD strings
  const formattedReminders = useMemo(() => {
    return reminders.map(r => {
      let dStr = r.date;
      if (r.date === 'Today') {
        dStr = todayStr;
      } else if (r.date === 'Tomorrow') {
        const tom = new Date(todayDate);
        tom.setDate(tom.getDate() + 1);
        const y = tom.getFullYear();
        const m = String(tom.getMonth() + 1).padStart(2, '0');
        const d = String(tom.getDate()).padStart(2, '0');
        dStr = `${y}-${m}-${d}`;
      } else if (r.date.includes('Jul')) {
        // e.g. "Jul 28"
        const num = r.date.replace(/[^0-9]/g, '');
        if (num) {
          const padded = num.padStart(2, '0');
          dStr = `2026-07-${padded}`;
        }
      }
      return { ...r, dateFormatted: dStr };
    });
  }, [reminders, todayStr, todayDate]);

  // Lookup helper for items per date
  const getItemsForDate = (dateStr: string) => {
    const evts = events.filter(e => e.date === dateStr);
    const tsks = tasks.filter(t => t.dueDate === dateStr);
    const rems = formattedReminders.filter(r => r.dateFormatted === dateStr);

    let filteredEvts = evts;
    if (selectedCategoryFilter !== 'All') {
      filteredEvts = evts.filter(e => e.category === selectedCategoryFilter);
    }

    return {
      events: filteredEvts,
      allEventsCount: evts.length,
      tasks: tsks,
      reminders: rems,
      totalCount: filteredEvts.length + tsks.length + rems.length,
    };
  };

  // Selected Day Items Agenda
  const selectedDayItems = useMemo(() => {
    return getItemsForDate(selectedDay);
  }, [selectedDay, events, tasks, formattedReminders, selectedCategoryFilter]);

  // Selected Date Formatting
  const formattedSelectedDateText = useMemo(() => {
    if (!selectedDay) return '';
    const [y, m, d] = selectedDay.split('-').map(Number);
    if (!y || !m || !d) return selectedDay;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, [selectedDay]);

  return (
    <div className="space-y-6 text-left selection:bg-blue-500 selection:text-white">
      
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-sm">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Calendar & Schedule</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800/40">
                Pro
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Plan events, manage deadlines, and track daily reminders
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter dropdown */}
          <div className="relative flex items-center">
            <Filter className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
            <select
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value)}
              className="pl-8 pr-7 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors"
            >
              <option value="All">All Categories</option>
              <option value="Meeting">Meetings</option>
              <option value="Deadline">Deadlines</option>
              <option value="Review">Reviews</option>
              <option value="Personal">Personal</option>
            </select>
          </div>

          <button
            onClick={() => {
              setEvtDate(selectedDay);
              setShowModal(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-medium text-xs shadow-md shadow-blue-500/10 transition-all shrink-0 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>New Event</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Calendar (2 cols) & Agenda Side Panel (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Calendar View Container */}
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors duration-200">
          
          {/* Navigation & Month Title Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {monthNames[viewMonth]} <span className="text-blue-600 dark:text-blue-400">{viewYear}</span>
              </h2>
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <button
                onClick={handleTodayClick}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors border border-slate-200/80 dark:border-slate-700"
              >
                Today
              </button>

              <div className="flex items-center space-x-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/80 dark:border-slate-700">
                <button
                  onClick={handlePrevMonth}
                  aria-label="Previous Month"
                  className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-none hover:shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextMonth}
                  aria-label="Next Month"
                  className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-none hover:shadow-sm"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-400 dark:text-slate-500 py-1">
            {daysOfWeek.map((d, index) => {
              const isWeekend = index === 0 || index === 6;
              return (
                <div 
                  key={d} 
                  className={`py-1.5 rounded-md ${isWeekend ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-400'}`}
                >
                  {d}
                </div>
              );
            })}
          </div>

          {/* Animated Calendar Grid */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${viewYear}-${viewMonth}`}
              initial={{ opacity: 0, x: slideDirection === 'right' ? 16 : -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: slideDirection === 'right' ? -16 : 16 }}
              transition={{ duration: 0.18, ease: 'easeInOut' }}
              className="grid grid-cols-7 gap-1.5"
            >
              {/* Previous month overflow day cells */}
              {Array.from({ length: startDayIndex }).map((_, i) => {
                const dayNum = prevMonthDaysCount - startDayIndex + i + 1;
                return (
                  <div
                    key={`prev-${i}`}
                    className="min-h-[84px] sm:min-h-[96px] p-2 rounded-xl border border-transparent bg-slate-50/50 dark:bg-slate-900/30 text-slate-300 dark:text-slate-700 opacity-40 select-none cursor-default"
                  >
                    <span className="text-xs font-semibold">{dayNum}</span>
                  </div>
                );
              })}

              {/* Current month day cells */}
              {Array.from({ length: monthDays }).map((_, i) => {
                const dayNum = i + 1;
                const mStr = String(viewMonth + 1).padStart(2, '0');
                const dStr = String(dayNum).padStart(2, '0');
                const dateStr = `${viewYear}-${mStr}-${dStr}`;

                const isSelected = selectedDay === dateStr;
                const isToday = dateStr === todayStr;

                // Day of week index (0 = Sun, 6 = Sat)
                const dayOfWeekIdx = (startDayIndex + i) % 7;
                const isWeekend = dayOfWeekIdx === 0 || dayOfWeekIdx === 6;

                // Items for this day
                const dayItems = getItemsForDate(dateStr);
                const { events: dayEvts, tasks: dayTsks, reminders: dayRems, totalCount } = dayItems;

                return (
                  <div
                    key={dayNum}
                    onClick={() => setSelectedDay(dateStr)}
                    className={`min-h-[84px] sm:min-h-[96px] p-1.5 sm:p-2 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col justify-between relative group text-left ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-600 dark:border-blue-500 shadow-sm ring-2 ring-blue-500/20 z-10'
                        : isToday
                        ? 'bg-blue-50/30 dark:bg-slate-800/70 border-blue-300 dark:border-blue-800'
                        : isWeekend
                        ? 'bg-slate-50/80 dark:bg-slate-800/30 border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                        : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Top Row: Date Number & Badges */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-transform group-hover:scale-105 ${
                          isToday
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-bold'
                            : isSelected
                            ? 'text-blue-700 dark:text-blue-300 font-bold'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {dayNum}
                      </span>

                      {/* Tooltip on hover */}
                      {totalCount > 0 && (
                        <div className="hidden group-hover:flex absolute top-[-32px] left-1/2 -translate-x-1/2 z-30 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-semibold whitespace-nowrap shadow-lg pointer-events-none transition-opacity">
                          {totalCount} {totalCount === 1 ? 'item' : 'items'} scheduled
                        </div>
                      )}
                    </div>

                    {/* Middle: Render event title labels (Max 2 labels shown) */}
                    <div className="space-y-1 my-1 overflow-hidden">
                      {dayEvts.slice(0, 2).map((evt) => (
                        <div
                          key={evt.id}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight truncate bg-blue-100/80 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border border-blue-200/50 dark:border-blue-800/40"
                          title={evt.title}
                        >
                          {evt.title}
                        </div>
                      ))}

                      {/* Remaining counter "+N more" */}
                      {dayEvts.length > 2 && (
                        <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-400 pl-1 block">
                          +{dayEvts.length - 2} more
                        </span>
                      )}
                    </div>

                    {/* Bottom Indicator Dots (Events = Blue, Tasks = Purple, Reminders = Amber) */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center space-x-1">
                        {dayEvts.length > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm" title="Events" />
                        )}
                        {dayTsks.length > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-sm" title="Tasks" />
                        )}
                        {dayRems.length > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-sm" title="Reminders" />
                        )}
                      </div>

                      {totalCount > 0 && (
                        <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">
                          {totalCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>

          {/* Color Legend Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center space-x-4">
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Events</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                <span>Tasks</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Reminders</span>
              </span>
            </div>

            <span className="text-slate-400 dark:text-slate-500 italic text-[10px]">
              Click any date to inspect agenda
            </span>
          </div>

        </div>

        {/* Side Panel: Selected Date Agenda & Scheduled Items */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 transition-colors duration-200">
          
          <div className="space-y-4">
            {/* Agenda Header */}
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Agenda for Date</span>
                </h3>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                  {formattedSelectedDateText}
                </p>
              </div>

              {selectedDay === todayStr && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                  Today
                </span>
              )}
            </div>

            {/* Agenda Items List */}
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {selectedDayItems.totalCount === 0 ? (
                /* Empty State */
                <div className="py-12 px-4 text-center rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      No events scheduled
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[200px] mx-auto">
                      Your schedule is clear for this date.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEvtDate(selectedDay);
                      setShowModal(true);
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-200 dark:border-blue-800/60 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Event</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Events Section */}
                  {selectedDayItems.events.map(evt => (
                    <div
                      key={evt.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-2 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white text-xs leading-snug">
                          {evt.title}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 shrink-0">
                          {evt.category}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="font-mono">{evt.time}</span>
                      </div>

                      {evt.location && (
                        <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 text-[11px]">
                          <MapPin className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          <span className="truncate">{evt.location}</span>
                        </div>
                      )}

                      {evt.attendees && evt.attendees.length > 0 && (
                        <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 text-[11px]">
                          <Users className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="truncate">{evt.attendees.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Tasks Section */}
                  {selectedDayItems.tasks.map(tsk => (
                    <div
                      key={tsk.id}
                      className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          <span className="font-semibold text-slate-900 dark:text-white text-xs">
                            {tsk.title}
                          </span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                          Task
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 pl-5">
                        {tsk.description}
                      </p>
                    </div>
                  ))}

                  {/* Reminders Section */}
                  {selectedDayItems.reminders.map(rem => (
                    <div
                      key={rem.id}
                      className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="font-semibold text-slate-900 dark:text-white text-xs">
                            {rem.title}
                          </span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                          {rem.time}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Agenda Summary Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Total Items: <strong className="text-slate-700 dark:text-slate-200">{selectedDayItems.totalCount}</strong></span>
            <button
              onClick={() => {
                setEvtDate(selectedDay);
                setShowModal(true);
              }}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-xs flex items-center space-x-1"
            >
              <Plus className="w-3 h-3" />
              <span>Add Event</span>
            </button>
          </div>

        </div>

      </div>

      {/* Schedule Event Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4 text-left"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <CalendarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Schedule New Event</span>
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Event Title *
                  </label>
                  <input
                    type="text"
                    value={evtTitle}
                    onChange={e => setEvtTitle(e.target.value)}
                    placeholder="E.g., Design Sync & Architecture Review"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={evtDate}
                      onChange={e => setEvtDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Time Slot
                    </label>
                    <input
                      type="text"
                      value={evtTime}
                      onChange={e => setEvtTime(e.target.value)}
                      placeholder="10:00 AM - 11:30 AM"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Location / Link
                    </label>
                    <input
                      type="text"
                      value={evtLocation}
                      onChange={e => setEvtLocation(e.target.value)}
                      placeholder="Virtual Room A"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Category
                    </label>
                    <select
                      value={evtCategory}
                      onChange={e => setEvtCategory(e.target.value as CalendarEventItem['category'])}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Meeting">Meeting</option>
                      <option value="Deadline">Deadline</option>
                      <option value="Review">Review</option>
                      <option value="Personal">Personal</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddEvent}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  Save Event
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
