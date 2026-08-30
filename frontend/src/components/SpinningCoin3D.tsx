import React from 'react';

// Create a component that renders the 3D spinning coin from habition_spinning_coin.html
const SpinningCoin3D: React.FC = () => {
  const radius = 100;
  const depth = 24;
  const segments = 80;
  const stripWidth = ((2 * Math.PI * radius) / segments) + 0.5;

  // Generate the rim strips dynamically
  const rimStrips = Array.from({ length: segments }).map((_, i) => {
    const angle = (360 / segments) * i;
    const lightIntensity = Math.abs(Math.cos(angle * (Math.PI / 180)));
    const lightness = 35 + (lightIntensity * 35);

    return (
      <div
        key={i}
        className="absolute top-1/2 left-1/2"
        style={{
          width: `${stripWidth}px`,
          height: `${depth}px`,
          background: `hsl(43, 75%, ${lightness}%)`,
          transformOrigin: '50% 50%',
          backfaceVisibility: 'hidden',
          transform: `translate(-50%, -50%) rotateZ(${angle}deg) translateY(-${radius}px) rotateX(90deg)`
        }}
      />
    );
  });

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
        <div 
          className="scene-coin"
          style={{ 
            filter: 'drop-shadow(0 0 40px rgba(250,214,54,0.7)) drop-shadow(0 0 80px rgba(253,224,71,0.5))',
            transformOrigin: 'center',
            animation: 'coin-wobble 2s infinite ease-in-out',
          }}
        >
          <div className="coin-3d relative">
            {/* Front Face */}
            <div className="coin-face face-front">
              <div className="coin-grid-container">
                <div className="coin-grid-cell"></div><div className="coin-grid-cell"></div><div className="coin-grid-cell"></div>
                <div className="coin-grid-cell"></div><div className="coin-grid-cell"></div><div className="coin-grid-cell"></div>
                <div className="coin-grid-cell"></div><div className="coin-grid-cell"></div><div className="coin-grid-cell"></div>
              </div>
            </div>

            {/* Back Face */}
            <div className="coin-face face-back">
              <div className="coin-grid-container">
                <div className="coin-grid-cell"></div><div className="coin-grid-cell"></div><div className="coin-grid-cell"></div>
                <div className="coin-grid-cell"></div><div className="coin-grid-cell"></div><div className="coin-grid-cell"></div>
                <div className="coin-grid-cell"></div><div className="coin-grid-cell"></div><div className="coin-grid-cell"></div>
              </div>
            </div>

            {/* Rim */}
            <div className="absolute w-full h-full" style={{ transformStyle: 'preserve-3d' }}>
              {rimStrips}
            </div>
          </div>
        </div>
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
        @keyframes coin-wobble {
          0%, 100% { transform: scale(0.55) rotate(-5deg); }
          50% { transform: scale(0.58) rotate(5deg); }
        }
      `}</style>
    </div>
  );
};

export default SpinningCoin3D;
