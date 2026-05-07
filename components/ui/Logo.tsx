import React from 'react';
import { Landmark } from 'lucide-react';

export const Logo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center gap-3 select-none ${className}`}>
    <div className="bg-gradient-to-br from-dark-800 to-black p-2 rounded-xl border border-gold-500/20 shadow-glow flex items-center justify-center shrink-0">
      <Landmark className="text-gold-400 w-6 h-6" />
    </div>
    <div className="flex flex-col text-left">
      <span className="font-black text-xs tracking-tighter leading-none text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(to right, #E3BC53, #F3E2B5, #AA8C2C)' }}>
        GESTÃO DE
      </span>
      <span className="font-black text-xl tracking-tighter leading-none text-white">
        BANCA
      </span>
    </div>
  </div>
);