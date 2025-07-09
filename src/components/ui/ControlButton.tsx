// src/components/ui/ControlButton.tsx
import React from 'react';

interface ControlButtonProps {
  icon: React.ElementType;
  onClick: () => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export const ControlButton: React.FC<ControlButtonProps> = ({ 
  icon: Icon, 
  onClick, 
  label, 
  className = '', 
  size = 'md', 
  disabled = false 
}) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`
        ${sizeClasses[size]} 
        rounded-full 
        backdrop-blur-md 
        bg-white/20 
        border 
        border-white/30 
        flex 
        items-center 
        justify-center 
        text-white 
        hover:bg-white/30 
        transition-all 
        duration-200 
        active:scale-95
        disabled:opacity-50
        disabled:cursor-not-allowed
        ${className}
      `}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
};