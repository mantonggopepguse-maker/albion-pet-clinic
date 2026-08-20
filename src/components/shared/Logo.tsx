import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', showText = false }) => {
  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20'
  };

  return (
    <div className="flex items-center gap-3">
      <div 
        className={`relative rounded-2xl overflow-hidden bg-white p-0.5 border border-amber-500/30 shadow-md flex items-center justify-center transition-all duration-300 hover:scale-105 ${sizeClasses[size]} ${className}`}
      >
        <img 
          src="/logo.jpg" 
          alt="Albion Pharmaceuticals" 
          className="w-full h-full object-cover rounded-[14px]"
        />
      </div>

      {showText && (
        <div className="flex flex-col">
          <span className="font-extrabold text-slate-900 dark:text-white tracking-tight leading-none text-base">
            Albion <span className="text-amber-500">Pharmaceuticals</span>
          </span>
          <span className="text-[10px] font-black text-amber-600/80 tracking-widest uppercase mt-1">
            Pet Clinic OS
          </span>
        </div>
      )}
    </div>
  );
};
