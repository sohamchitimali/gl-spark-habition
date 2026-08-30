import React from 'react';

const SpinningFire3D: React.FC = () => {
  return (
    <div className="flex items-center justify-center pointer-events-none z-50">
      <div 
        className="relative flex items-center justify-center animate-fade-up"
        style={{
          width: '200px',
          height: '200px',
          animation: 'streak-flame-burst 1.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both'
        }}
      >
        <span 
          style={{ 
            fontSize: '120px', 
            filter: 'drop-shadow(0 0 40px rgba(239,68,68,0.8)) drop-shadow(0 0 80px rgba(249,115,22,0.6))',
            transformOrigin: 'bottom center',
            animation: 'fire-wobble 2s infinite ease-in-out'
          }}
        >
          🔥
        </span>
      </div>
      
      <style>{`
        @keyframes streak-flame-burst {
          0% {
            transform: scale(0) translateY(50px);
            opacity: 0;
          }
          40% {
            transform: scale(1.2) translateY(-20px);
            opacity: 1;
          }
          60% {
            transform: scale(0.9) translateY(10px);
          }
          80% {
            transform: scale(1.05) translateY(-5px);
          }
          100% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
        @keyframes fire-wobble {
          0%, 100% { transform: rotate(-5deg) scale(1); }
          50% { transform: rotate(5deg) scale(1.05); }
        }
      `}</style>
    </div>
  );
};

export default SpinningFire3D;
