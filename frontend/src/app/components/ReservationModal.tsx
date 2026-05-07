import { useState, useEffect, useMemo } from "react";
import { X, Calendar, Clock, Users as UsersIcon, CheckCircle2 } from "lucide-react";

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  resourceName: string;
}

// Generate an array of time strings at 30-min intervals
const generateTimes = (startHour: number, startMin: number, endHour: number, endMin: number) => {
  const times = [];
  let current = startHour * 60 + startMin;
  const end = endHour * 60 + endMin;
  while (current <= end) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    times.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    current += 30;
  }
  return times;
};

// Start times from 10:00 to 21:30
const startTimeOptionsList = generateTimes(10, 0, 21, 30);
// End times from 09:30 to 22:00
const endTimeOptionsList = generateTimes(9, 30, 22, 0);
// Grid rows from 10:00 to 21:30 (representing the 30min blocks)
const gridSlots = generateTimes(10, 0, 21, 30);

// Mock function to determine max capacity based on resource name
const getResourceCapacity = (resource: string) => {
  let hash = 0;
  for (let i = 0; i < resource.length; i++) {
    hash = ((hash << 5) - hash) + resource.charCodeAt(i);
    hash |= 0;
  }
  const capacities = [2, 4, 6, 8, 10, 15, 20];
  return capacities[Math.abs(hash) % capacities.length];
};

// Stable mock function to determine if a slot is occupied
const isSlotOccupied = (dateVal: string, slotTime: string, resource: string) => {
  const str = `${dateVal}-${slotTime}-${resource}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 10 < 2; // 20% occupied probability
};

export function ReservationModal({ isOpen, onClose, resourceName }: ReservationModalProps) {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [people, setPeople] = useState("1");
  const [isSuccess, setIsSuccess] = useState(false);

  const maxPeople = useMemo(() => getResourceCapacity(resourceName), [resourceName]);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setIsSuccess(false);
      setDate("");
      setStartTime("");
      setEndTime("");
      setPeople("1");
    }
  }, [isOpen]);

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  // Calculate the next 5 non-weekend dates mapping to Mon-Fri
  const mappedDates = useMemo(() => {
    const dates: Record<string, { display: string, value: string, chronological: Date }> = {};
    const next5 = [];
    let curr = new Date(); // Mocking "today" 
    
    while (next5.length < 5) {
      const d = curr.getDay();
      if (d !== 0 && d !== 6) { // Skip Sun, Sat
        next5.push(new Date(curr));
      }
      curr.setDate(curr.getDate() + 1);
    }
    
    next5.forEach(d => {
      const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
      dates[dayName] = {
        display: `${d.getMonth() + 1}/${d.getDate()}`,
        value: d.toISOString().split('T')[0],
        chronological: d
      };
    });
    return dates;
  }, []);

  // Filter available start times for the selected date
  const availableStartTimes = useMemo(() => {
    if (!date) return [];
    return startTimeOptionsList.filter(t => !isSlotOccupied(date, t, resourceName));
  }, [date, resourceName]);

  // Filter available end times based on selected start time
  const availableEndTimes = useMemo(() => {
    if (!date || !startTime) return [];
    
    // We only want end times > start time
    const validEndTimes = endTimeOptionsList.filter(t => t > startTime);
    const available = [];
    
    for (const et of validEndTimes) {
      // Check for any occupied slots between startTime and et
      let hasConflict = false;
      let curr = startTime;
      
      while (curr < et) {
        if (isSlotOccupied(date, curr, resourceName)) {
          hasConflict = true;
          break;
        }
        
        // Add 30 mins to curr
        const [h, m] = curr.split(':').map(Number);
        const nextMin = m + 30;
        curr = `${String(h + Math.floor(nextMin/60)).padStart(2, '0')}:${String(nextMin % 60).padStart(2, '0')}`;
      }
      
      if (hasConflict) break; // If we hit a block, we can't select any end time past it
      available.push(et);
    }
    
    return available;
  }, [date, startTime, resourceName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSuccess(true);
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-100 bg-slate-800/50 hover:bg-slate-800 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Side: Form (40%) */}
        <div className="w-full md:w-2/5 p-8 border-b md:border-b-0 md:border-r border-slate-700/50 bg-slate-900/50">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-100 mb-1">Reserve Space</h2>
            <p className="text-sm text-emerald-400 font-medium tracking-wide">{resourceName}</p>
          </div>

          {isSuccess ? (
            <div className="flex flex-col items-center justify-center h-64 text-center animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-100">Reservation Confirmed!</h3>
              <p className="text-sm text-slate-400 mt-2">Your slot has been successfully booked.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  Select Date
                </label>
                <div className="relative">
                  <select 
                    required
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setStartTime("");
                      setEndTime("");
                    }}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all appearance-none"
                  >
                    <option value="" disabled>Select next 5 non-weekend days...</option>
                    {Object.values(mappedDates)
                      .sort((a, b) => a.chronological.getTime() - b.chronological.getTime())
                      .map(d => (
                        <option key={d.value} value={d.value}>{d.display} ({(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])[d.chronological.getDay()]})</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  Reservation Duration
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 pl-1">Start Time</span>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Clock className={`w-3.5 h-3.5 ${!date ? 'text-slate-700' : 'text-slate-500'}`} />
                      </div>
                      <select 
                        required
                        disabled={!date}
                        value={startTime}
                        onChange={(e) => {
                          setStartTime(e.target.value);
                          setEndTime("");
                        }}
                        className="w-full pl-9 pr-8 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all appearance-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="" disabled>--:--</option>
                        {availableStartTimes.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <svg className={`w-4 h-4 ${!date ? 'text-slate-700' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                  </div>
                  <span className="text-slate-500 font-medium pt-5">-</span>
                  <div className="flex-1 space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 pl-1">End Time</span>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Clock className={`w-3.5 h-3.5 ${!startTime ? 'text-slate-700' : 'text-slate-500'}`} />
                      </div>
                      <select 
                        required
                        disabled={!startTime}
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full pl-9 pr-8 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all appearance-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="" disabled>--:--</option>
                        {availableEndTimes.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <svg className={`w-4 h-4 ${!startTime ? 'text-slate-700' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <UsersIcon className="w-4 h-4 text-slate-500" />
                  Number of People
                  <span className="text-xs text-slate-500 font-normal ml-auto">Max capacity: {maxPeople}</span>
                </label>
                <input 
                  type="number" 
                  min="1" 
                  max={maxPeople}
                  required
                  value={people}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val > maxPeople) {
                      setPeople(maxPeople.toString());
                    } else {
                      setPeople(e.target.value);
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                />
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]"
                >
                  Confirm Reservation
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right Side: Availability Grid (60%) */}
        <div className="w-full md:w-3/5 p-8 bg-slate-950 flex flex-col h-[500px]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-wider text-slate-400 uppercase">Availability Overview</h3>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-slate-800 border border-slate-700"></div>
                <span className="text-slate-500">Free</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-emerald-500/20 border border-emerald-500/50"></div>
                <span className="text-emerald-400">Your Selection</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-rose-500/20 border border-rose-500/50"></div>
                <span className="text-rose-400">Occupied</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar pr-2">
            <div className="min-w-max">
              {/* Header Row */}
              <div className="flex">
                <div className="w-16 shrink-0"></div> {/* Empty corner */}
                {days.map(day => (
                  <div key={day} className="w-20 flex flex-col items-center justify-center text-xs font-semibold text-slate-500 py-1">
                    <span>{day}</span>
                    <span className="text-[10px] text-slate-600 font-medium">
                      {mappedDates[day]?.display || "--/--"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Grid Rows */}
              {gridSlots.map((slot) => (
                <div key={slot} className="flex group">
                  <div className="w-16 shrink-0 text-right pr-4 py-1 text-[10px] font-medium text-slate-500 self-center group-hover:text-slate-300 transition-colors">
                    {slot}
                  </div>
                  {days.map((day) => {
                    const mappedDateVal = mappedDates[day]?.value;
                    const isOccupied = mappedDateVal ? isSlotOccupied(mappedDateVal, slot, resourceName) : false;
                    
                    const isSelected = date === mappedDateVal && startTime !== "" && endTime !== "" && 
                                       slot >= startTime && slot < endTime;

                    return (
                      <div 
                        key={`${day}-${slot}`} 
                        className={`w-20 h-8 border border-slate-800/50 m-[1px] rounded-sm transition-colors cursor-pointer
                          ${isOccupied ? 'bg-rose-500/10 border-rose-500/20 cursor-not-allowed' : 
                            isSelected ? 'bg-emerald-500/30 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 
                            'bg-slate-900/40 hover:bg-slate-800'}`
                        }
                        title={isOccupied ? 'Occupied' : 'Free'}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
