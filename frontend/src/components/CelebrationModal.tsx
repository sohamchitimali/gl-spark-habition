import React from 'react';
import SpinningCoin3D from './SpinningCoin3D';
import SpinningFire3D from './SpinningFire3D';

interface CelebrationModalProps {
  showCoin: boolean;
  showFire: boolean;
  message?: string;
}

const CelebrationModal: React.FC<CelebrationModalProps> = ({ showCoin, showFire, message }) => {
  if (!showCoin && !showFire) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4">
      {/* 
        We use a dark overlay that DOES NOT blur the screen (no backdrop-blur),
        it just dims the background slightly, or we can just have no dimming.
        The user wanted it in a window rather than blurring the entire screen.
      */}
      <div 
        className="w-full max-w-md rounded-2xl p-8 flex flex-col items-center justify-center animate-fade-up shadow-2xl relative"
        style={{ 
          background: 'linear-gradient(135deg, #2C2C2A 0%, #1a1a18 100%)',
          border: '1px solid #424240',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
        }}
      >
        <div className="flex items-center justify-center gap-6 mb-6">
          {showCoin && (
            <div className="w-32 h-32 flex items-center justify-center">
              <SpinningCoin3D />
            </div>
          )}
          
          {showFire && (
            <div className="w-32 h-32 flex items-center justify-center">
              <SpinningFire3D />
            </div>
          )}
        </div>

        {message && (
          <h2 className="text-xl font-bold text-center text-white">
            {message}
          </h2>
        )}
      </div>
    </div>
  );
};

export default CelebrationModal;
