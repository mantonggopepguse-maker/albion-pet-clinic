import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', showText = false }) => {
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-11 h-11'
  };

  return (
    <div className="flex items-center gap-3">
      {/* Vector Badge using pure Tailwind CSS & SVG */}
      <div 
        className={`relative rounded-2xl bg-gradient-to-br from-teal-500 via-emerald-600 to-teal-800 p-0.5 shadow-lg shadow-teal-500/20 flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-teal-500/30 ${sizeClasses[size]} ${className}`}
      >
        <div className="w-full h-full rounded-[14px] bg-slate-950/20 backdrop-blur-md flex items-center justify-center relative overflow-hidden">
          {/* Subtle light reflect ring */}
          <div className="absolute -top-6 -left-6 w-12 h-12 bg-white/20 rounded-full blur-md" />
          
          {/* Pure SVG Medical + Pill emblem */}
          <svg 
            className={`${iconSizes[size]} text-white drop-shadow-md`} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            {/* Pill Capsule */}
            <rect x="3" y="10" width="18" height="9" rx="4.5" transform="rotate(-30 12 14.5)" fill="currentColor" fillOpacity="0.25" />
            {/* Medical Cross */}
            <path d="M12 5v14M5 12h14" strokeWidth="2.5" />
            {/* Leaf Curve */}
            <path d="M17 7c-2 0-4 1.5-4 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
          </svg>
        </div>
      </div>

      {showText && (
        <div className="flex flex-col">
          <span className="font-extrabold text-slate-900 dark:text-white tracking-tight leading-none text-base">
            Albion <span className="text-teal-600 dark:text-teal-400">Pharmaceuticals</span>
          </span>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase mt-1">
            Pet Clinic OS
          </span>
        </div>
      )}
    </div>
  );
};
