import { useEffect, useRef } from 'react';

const SpinningCoin = ({ size = 24 }: { size?: number }) => {
  const rimRef = useRef<HTMLDivElement>(null);

  // The original coin is 250x250 in its scene. Scale it down to match `size`.
  const scale = size / 250;

  useEffect(() => {
    if (!rimRef.current) return;
    const rim = rimRef.current;
    
    // Clear previous if any
    rim.innerHTML = '';
    
    const radius = 100;    
    const depth = 24;      
    const segments = 80;   
    const stripWidth = ((2 * Math.PI * radius) / segments) + 0.5;

    for (let i = 0; i < segments; i++) {
      const angle = (360 / segments) * i;
      const strip = document.createElement('div');
      
      strip.className = 'rim-strip';
      strip.style.width = stripWidth + 'px';
      strip.style.height = depth + 'px';
      
      const lightIntensity = Math.abs(Math.cos(angle * (Math.PI / 180)));
      const lightness = 35 + (lightIntensity * 35); 
      strip.style.background = `hsl(43, 75%, ${lightness}%)`;

      strip.style.transform = `
        translate(-50%, -50%) 
        rotateZ(${angle}deg) 
        translateY(-${radius}px) 
        rotateX(90deg)
      `;
      
      rim.appendChild(strip);
    }
  }, []);

  return (
    <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
        <div className="scene-coin">
          <div className="coin-3d">
            
            <div className="coin-face face-front">
              <div className="coin-grid-container">
                <div className="coin-grid-cell"></div><div className="coin-grid-cell"></div><div className="coin-grid-cell"></div>
                <div className="coin-grid-cell"></div><div className="coin-grid-cell"></div><div className="coin-grid-cell"></div>
                <div className="coin-grid-cell"></div><div className="coin-grid-cell"></div><div className="coin-grid-cell"></div>
              </div>
            </div>

            <div className="coin-face face-back">
              <div className="coin-grid-container">
                <div className="coin-grid-cell"></div><div className="coin-grid-cell"></div><div className="coin-grid-cell"></div>
                <div className="coin-grid-cell"></div><div className="coin-grid-cell"></div><div className="coin-grid-cell"></div>
                <div className="coin-grid-cell"></div><div className="coin-grid-cell"></div><div className="coin-grid-cell"></div>
              </div>
            </div>

            <div id="coin-rim" ref={rimRef}></div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default SpinningCoin;
