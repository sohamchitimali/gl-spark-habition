import React, { useState, useRef, useEffect } from 'react';

interface TimeWindowSliderProps {
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "22:00"
  onChange: (startTime: string, endTime: string) => void;
  minWindowHours?: number;
  frequency?: number;
}

export default function TimeWindowSlider({ startTime, endTime, onChange, minWindowHours = 6, frequency }: TimeWindowSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  
  // Convert HH:MM to integer hour (0-23)
  const timeToHour = (time: string) => parseInt(time.split(':')[0], 10) || 0;
  const hourToTime = (h: number) => `${h.toString().padStart(2, '0')}:00`;

  const [startHour, setStartHour] = useState(() => timeToHour(startTime));
  const [endHour, setEndHour] = useState(() => timeToHour(endTime));
  
  // Keep local state in sync with props
  useEffect(() => {
    setStartHour(timeToHour(startTime));
    setEndHour(timeToHour(endTime));
  }, [startTime, endTime]);

  const [dragState, setDragState] = useState<'none' | 'left' | 'right' | 'center'>('none');
  const [dragOffset, setDragOffset] = useState<number>(0);

  // Convert clientX to an hour value
  const getHourFromEvent = (clientX: number): number => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    let x = clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));
    const percentage = x / rect.width;
    const rawHour = percentage * 23; 
    return Math.round(rawHour);
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (dragState === 'none') return;
      
      const currentHour = getHourFromEvent(e.clientX);

      if (dragState === 'left') {
        // Adjust start, respecting minimum window size and bounds
        let newStart = Math.min(currentHour, endHour - minWindowHours);
        newStart = Math.max(0, newStart);
        if (newStart !== startHour) {
          setStartHour(newStart);
          onChange(hourToTime(newStart), hourToTime(endHour));
        }
      } else if (dragState === 'right') {
        // Adjust end, respecting minimum window size and bounds
        let newEnd = Math.max(currentHour, startHour + minWindowHours);
        newEnd = Math.min(23, newEnd);
        if (newEnd !== endHour) {
          setEndHour(newEnd);
          onChange(hourToTime(startHour), hourToTime(newEnd));
        }
      } else if (dragState === 'center') {
        // Shift entire window
        let targetStart = currentHour - dragOffset;
        const windowSize = endHour - startHour;
        
        // Bounds checking
        if (targetStart < 0) targetStart = 0;
        if (targetStart + windowSize > 23) targetStart = 23 - windowSize;

        if (targetStart !== startHour) {
          setStartHour(targetStart);
          setEndHour(targetStart + windowSize);
          onChange(hourToTime(targetStart), hourToTime(targetStart + windowSize));
        }
      }
    };

    const handlePointerUp = () => {
      setDragState('none');
    };

    if (dragState !== 'none') {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, startHour, endHour, dragOffset, minWindowHours, onChange]);

  // Convert hour to percentage for positioning
  const getPercentage = (hour: number) => (hour / 23) * 100;

  // Render dots for each hour (0 to 23)
  const dots = [];
  for (let i = 0; i <= 23; i++) {
    const inRange = i >= startHour && i <= endHour;
    dots.push(
      <div 
        key={i}
        className={`absolute top-1/2 -translate-y-1/2 rounded-full transition-colors ${inRange ? 'bg-white' : 'bg-[#5F5E5A]'}`}
        style={{ 
          left: `${getPercentage(i)}%`, 
          width: '6px', 
          height: '6px', 
          marginLeft: '-3px' 
        }}
      >
        <span className="absolute top-8 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] text-[#5F5E5A] font-medium whitespace-nowrap transition-colors">
          {i === 0 ? '12A' : i === 12 ? '12P' : i > 12 ? `${i-12}P` : `${i}A`}
        </span>
      </div>
    );
  }

  const formatDisplayTime = (hour: number) => {
    if (hour === 0) return '12:00 AM';
    if (hour === 12) return '12:00 PM';
    return hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`;
  };

  const calculateIntervalText = (start: number, end: number, freq?: number) => {
    if (!freq || freq <= 0) return '';
    let totalMinutes = (end - start) * 60;
    if (totalMinutes <= 0) totalMinutes += 24 * 60;
    const intervalMinutes = Math.floor(totalMinutes / freq);
    const h = Math.floor(intervalMinutes / 60);
    const m = intervalMinutes % 60;
    if (h > 0 && m > 0) return `~ every ${h} hour${h > 1 ? 's' : ''} and ${m} min`;
    if (h > 0) return `~ every ${h} hour${h > 1 ? 's' : ''}`;
    return `~ every ${m} min`;
  };

  return (
    <div className="w-full flex flex-col items-center py-6 select-none touch-none">
      
      {/* The Timeline */}
      <div 
        className="relative w-full h-16 flex items-center mb-6"
        ref={trackRef}
      >
        {/* Background Line */}
        <div className="absolute w-full h-1 bg-[#363634] top-1/2 -translate-y-1/2 rounded-full" />
        
        {/* Active Range Highlight */}
        <div 
          className="absolute h-2 bg-[#534AB7] top-1/2 -translate-y-1/2 rounded-full opacity-50"
          style={{ 
            left: `${getPercentage(startHour)}%`, 
            width: `${getPercentage(endHour) - getPercentage(startHour)}%` 
          }}
        />

        {/* Dots */}
        {dots}

        {/* Selected Window Slider Box */}
        <div 
          className="absolute h-8 top-1/2 -translate-y-1/2 bg-[#534AB7]/30 border border-[#534AB7] rounded-xl flex items-center group cursor-grab active:cursor-grabbing hover:bg-[#534AB7]/40 transition-colors"
          style={{ 
            left: `${getPercentage(startHour)}%`, 
            width: `${getPercentage(endHour) - getPercentage(startHour)}%` 
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            const clickHour = getHourFromEvent(e.clientX);
            setDragOffset(clickHour - startHour);
            setDragState('center');
          }}
        >
          {/* Left Thumb */}
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-10 -ml-3 bg-white shadow-lg rounded-full border-2 border-[#1A1A18] cursor-ew-resize flex items-center justify-center hover:scale-110 transition-transform z-10"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setDragState('left');
            }}
          >
            <div className="w-1 h-3 bg-gray-300 rounded-full" />
          </div>

          {/* Right Thumb */}
          <div 
            className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-10 -mr-3 bg-white shadow-lg rounded-full border-2 border-[#1A1A18] cursor-ew-resize flex items-center justify-center hover:scale-110 transition-transform z-10"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setDragState('right');
            }}
          >
            <div className="w-1 h-3 bg-gray-300 rounded-full" />
          </div>
        </div>
      </div>

      {/* Dynamic Summary Text */}
      <p className="text-sm text-center text-[#B4B2A9] font-medium bg-[#363634]/50 px-4 py-3 rounded-xl border border-[#424240] mt-2">
        Your notifications will be sent{' '}
        {frequency ? (
          <>
            <span className="text-white font-bold">({calculateIntervalText(startHour, endHour, frequency)})</span>{' '}
          </>
        ) : null}
        in the window starting from{' '}
        <span className="text-white font-bold">{formatDisplayTime(startHour)}</span> to{' '}
        <span className="text-white font-bold">{formatDisplayTime(endHour)}</span>.
      </p>
    </div>
  );
}
