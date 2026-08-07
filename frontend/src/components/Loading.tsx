import React, { useEffect, useState } from 'react';

interface LoadingProps {
  size?: number; // Size of each individual tile in px (default: 16)
  activeColor?: string;
  idleColor?: string;
}

const Loading: React.FC<LoadingProps> = ({ 
  size = 16, 
  activeColor = '#534AB7', // Brand purple
  idleColor = '#2C2C2A'    // Dark card background
}) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % 9);
    }, 160); // 160ms per step to match the HTML file
    return () => clearInterval(interval);
  }, []);

  const gap = Math.max(2, Math.floor(size / 6));
  const radius = Math.max(2, Math.floor(size / 5));

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', padding: '1rem 0' }}>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: `repeat(3, ${size}px)`, 
        gridTemplateRows: `repeat(3, ${size}px)`, 
        gap: `${gap}px` 
      }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: `${size}px`,
              height: `${size}px`,
              borderRadius: `${radius}px`,
              background: i === current ? activeColor : idleColor,
              border: `1px solid ${i === current ? 'transparent' : '#363634'}`,
              transition: 'background 0.25s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default Loading;
