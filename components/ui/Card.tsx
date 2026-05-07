import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div 
      onClick={onClick}
      data-reveal="card"
      className={`
        bg-card-gradient backdrop-blur-md 
        border border-white/5 
        text-white rounded-2xl p-6 
        shadow-xl
        ${onClick ? 'cursor-pointer hover:border-gold-500/30 hover:shadow-glow transition-all duration-300' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};
