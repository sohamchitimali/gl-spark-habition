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
    <div className="scene-coin flex items-center justify-center pointer-events-none z-50">
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
  );
};

export default SpinningCoin3D;
