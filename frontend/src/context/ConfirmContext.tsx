import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

type ConfirmOptions = {
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
};

type ConfirmContextType = {
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [options, setOptions] = useState<ConfirmOptions>({});
  const [resolver, setResolver] = useState<{ resolve: (value: boolean) => void } | null>(null);

  const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
    setMessage(message);
    setOptions(options);
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolver({ resolve });
    });
  }, []);

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolver) resolver.resolve(true);
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolver) resolver.resolve(false);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fade-in">
          <div className="bg-[#1a1a18] border border-[#363634] rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-fade-up">
            <h3 className="text-xl font-bold text-white mb-4 text-center">Are you sure?</h3>
            <p className="text-gray-300 mb-8 text-center text-sm">{message}</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleConfirm}
                className={`w-full py-3 px-4 rounded-xl font-bold transition-colors border ${options.isDestructive
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20'
                    : 'bg-[#534AB7] hover:bg-[#534AB7]/80 text-white border-transparent'
                  }`}
              >
                {options.confirmText || 'Confirm'}
              </button>
              <button
                onClick={handleCancel}
                className="w-full py-3 px-4 rounded-xl font-bold transition-colors bg-transparent text-gray-400 hover:text-white"
              >
                {options.cancelText || 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};
