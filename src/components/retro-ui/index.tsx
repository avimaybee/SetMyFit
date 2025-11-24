import React, { useEffect, useState } from 'react';
import Image, { ImageProps } from 'next/image';
import { X, Minus, Square, AlertCircle, Check, Info, AlertTriangle, ImageOff, Loader2 } from 'lucide-react';

interface RetroBoxProps {
  children: React.ReactNode;
  className?: string;
  color?: string; // Tailwind color class (e.g., bg-pink-300) or legacy
  noShadow?: boolean;
}

export const RetroBox: React.FC<RetroBoxProps> = ({ children, className = '', color = 'bg-[var(--bg-secondary)]', noShadow = false }) => {
  return (
    <div className={`${color} border-2 border-[var(--border)] ${noShadow ? '' : 'shadow-[4px_4px_0px_0px_var(--border)]'} p-4 ${className}`}>
      {children}
    </div>
  );
};

interface RetroCardProps {
    children: React.ReactNode;
    className?: string;
    noHover?: boolean;
}

export const RetroCard: React.FC<RetroCardProps> = ({ children, className = '', noHover = false }) => {
    return (
        <div className={`
            bg-[var(--bg-secondary)] border-2 border-[var(--border)] p-2 
            ${!noHover ? 'transition-transform hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_var(--border)]' : 'shadow-[2px_2px_0px_0px_var(--border)]'}
            ${className}
        `}>
            {children}
        </div>
    )
}

interface RetroButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'neutral';
}

export const RetroButton: React.FC<RetroButtonProps> = ({ children, className = '', variant = 'primary', ...props }) => {
  let bgClass = 'bg-[var(--accent-blue)]'; // Blue default
  if (variant === 'secondary') bgClass = 'bg-[var(--accent-pink)]'; // Pink
  if (variant === 'danger') bgClass = 'bg-[var(--accent-orange)]'; // Orange/Red
  if (variant === 'neutral') bgClass = 'bg-[var(--bg-secondary)]';

  return (
    <button
      className={`
        ${bgClass} 
        border-2 border-[var(--border)] 
        px-4 py-2 
        font-bold 
        text-[var(--text)]
        shadow-[4px_4px_0px_0px_var(--border)] 
        transition-all 
        active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

interface RetroWindowProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
  icon?: React.ReactNode;
  headerColor?: string;
}

export const RetroWindow: React.FC<RetroWindowProps> = ({ title, children, className = '', onClose, icon, headerColor = 'bg-[var(--accent-orange)]' }) => {
  return (
    <div className={`bg-[var(--bg-main)] border-2 border-[var(--border)] shadow-[8px_8px_0px_0px_var(--border)] flex flex-col ${className}`}>
      {/* Window Header */}
      <div className={`${headerColor} border-b-2 border-[var(--border)] p-1 px-2 flex items-center justify-between select-none`}>
        <div className="flex items-center gap-2 pl-1">
          {icon && <span className="text-[var(--text)]">{icon}</span>}
          <span className="font-bold font-mono text-sm uppercase tracking-wider text-[var(--text)] truncate">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-5 h-5 border-2 border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-center hover:opacity-80 cursor-default">
            <Minus size={12} strokeWidth={4} className="text-[var(--text)]" />
          </div>
          <div className="w-5 h-5 border-2 border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-center hover:opacity-80 cursor-default">
            <Square size={10} strokeWidth={4} className="text-[var(--text)]" />
          </div>
          <button 
            onClick={onClose}
            className="w-5 h-5 border-2 border-[var(--border)] bg-[var(--accent-pink)] flex items-center justify-center hover:bg-red-500 transition-colors active:bg-red-600 group" 
            aria-label="Close"
          >
            <X size={14} strokeWidth={4} className="text-[var(--text)]" />
          </button>
        </div>
      </div>
      {/* Window Content */}
      <div className="flex-1 p-4 overflow-auto relative flex flex-col">
        {/* Stripes texture for aesthetics in background */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none z-0" 
             style={{ backgroundImage: 'repeating-linear-gradient(45deg, var(--border) 0, var(--border) 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }}>
        </div>
        <div className="relative z-10 flex-1 flex flex-col text-[var(--text)]">
            {children}
        </div>
      </div>
    </div>
  );
};

export const RetroBadge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = 'bg-[var(--accent-yellow)]' }) => (
  <span className={`${color} border-2 border-[var(--border)] px-2 py-0.5 text-xs font-bold uppercase tracking-wide shadow-[2px_2px_0px_0px_var(--border)] text-[var(--text)]`}>
    {children}
  </span>
);

export const RetroInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
  <input 
    className={`w-full border-2 border-[var(--border)] p-2 font-mono text-sm bg-[var(--bg-secondary)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-pink)] focus:border-[var(--border)] placeholder:text-gray-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    {...props}
  />
);

export const RetroSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
    <div className="relative">
        <select 
            className="w-full appearance-none border-2 border-[var(--border)] p-2 font-mono text-sm bg-[var(--bg-secondary)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-pink)] shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] pr-8"
            {...props}
        >
            {props.children}
        </select>
        <div className="absolute right-2 top-3 pointer-events-none text-[var(--text)]">
            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-[var(--border)]"></div>
        </div>
    </div>
  );

interface RetroSliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    minLabel?: string;
    maxLabel?: string;
}

export const RetroSlider: React.FC<RetroSliderProps> = ({ label, minLabel, maxLabel, className, ...props }) => {
    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            <label className="font-bold font-mono text-xs uppercase text-[var(--text)]">{label}</label>
            <div className="relative flex items-center gap-2">
                {minLabel && <span className="text-[10px] font-mono text-[var(--text)]">{minLabel}</span>}
                <input 
                    type="range" 
                    className="w-full h-4 bg-[var(--bg-secondary)] border-2 border-[var(--border)] appearance-none cursor-pointer accent-[var(--border)]
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-[var(--accent-pink)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--border)] [&::-webkit-slider-thumb]:shadow-[2px_2px_0px_0px_var(--border)]
                    "
                    {...props} 
                />
                {maxLabel && <span className="text-[10px] font-mono text-[var(--text)]">{maxLabel}</span>}
            </div>
        </div>
    );
};

interface RetroToggleProps {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

export const RetroToggle: React.FC<RetroToggleProps> = ({ label, checked, onChange }) => {
    return (
        <div className="flex items-center justify-between cursor-pointer group" onClick={() => onChange(!checked)}>
            <span className="font-mono text-sm text-[var(--text)]">{label}</span>
            <div className={`w-12 h-6 border-2 border-[var(--border)] relative transition-colors ${checked ? 'bg-[var(--accent-green)]' : 'bg-[var(--bg-secondary)]'}`}>
                <div className={`absolute top-[-2px] left-[-2px] w-6 h-6 bg-[var(--bg-secondary)] border-2 border-[var(--border)] transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'} shadow-[2px_2px_0px_0px_var(--border)]`}></div>
            </div>
        </div>
    );
};

interface RetroToastProps {
    message: string;
    type?: 'success' | 'error' | 'info' | 'warning';
    onClose: () => void;
}

export const RetroToast: React.FC<RetroToastProps> = ({ message, type = 'info', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    let bg = 'bg-[var(--accent-blue)]'; // Default Info
    let icon = <Info size={18} />;
    
    switch (type) {
        case 'success':
            bg = 'bg-[var(--accent-green)]';
            icon = <Check size={18} />;
            break;
        case 'error':
            bg = 'bg-[var(--accent-orange)]';
            icon = <AlertCircle size={18} />;
            break;
        case 'warning':
            bg = 'bg-[var(--accent-yellow)]';
            icon = <AlertTriangle size={18} />;
            break;
        case 'info':
        default:
            bg = 'bg-[var(--accent-blue)]';
            icon = <Info size={18} />;
            break;
    }

    return (
        <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-right-10 fade-in duration-300">
             <div className={`${bg} border-2 border-[var(--border)] p-3 shadow-[4px_4px_0px_0px_var(--border)] flex items-center gap-3 min-w-[240px]`}>
                <div className="bg-[var(--bg-secondary)] border-2 border-[var(--border)] p-1 rounded-full text-[var(--text)]">
                    {icon}
                </div>
                <span className="font-mono text-sm font-bold text-[var(--text)]">{message}</span>
                <button onClick={onClose} className="ml-auto hover:bg-black/10 p-1 rounded text-[var(--text)]">
                    <X size={14} />
                </button>
             </div>
        </div>
    );
};

export const RetroSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div 
      className={`
        bg-[var(--bg-secondary)] 
        border-2 border-[var(--border)] 
        relative overflow-hidden
        ${className}
      `}
    >
      <div className="absolute inset-0 animate-pulse bg-black/5"></div>
      <div 
        className="absolute inset-0 opacity-20"
        style={{ 
          backgroundImage: 'repeating-linear-gradient(45deg, var(--border) 0, var(--border) 1px, transparent 0, transparent 10px)',
          backgroundSize: '20px 20px'
        }}
      ></div>
    </div>
  );
};

interface RetroImageProps extends Omit<ImageProps, 'className'> {
  containerClassName?: string;
  className?: string;
}

export const RetroImage: React.FC<RetroImageProps> = ({ 
  src, 
  alt, 
  className = '', 
  containerClassName = '',
  ...props 
}) => {
  const [status, setStatus] = useState<'loading' | 'error' | 'loaded'>('loading');

  useEffect(() => {
    setStatus('loading');
  }, [src]);

  const resolvedSrc = src || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

  return (
    <div className={`relative overflow-hidden bg-[var(--bg-secondary)] border-2 border-[var(--border)] ${containerClassName}`}>
      {/* Loading State */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-[var(--bg-secondary)]">
           <div className="flex flex-col items-center gap-2">
             <Loader2 className="animate-spin text-[var(--text)]" size={24} />
             <span className="font-mono text-xs text-[var(--text)] animate-pulse">LOADING...</span>
           </div>
           {/* Background pattern for loading */}
           <div className="absolute inset-0 opacity-10 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '8px 8px' }}>
           </div>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[var(--bg-secondary)] p-4 text-center">
          <ImageOff className="text-[var(--accent-orange)] mb-2" size={32} />
          <span className="font-mono text-xs font-bold text-[var(--text)]">IMG_ERR</span>
        </div>
      )}

      {/* Actual Image */}
      <div className="relative w-full h-full">
        <Image
          {...props}
          src={resolvedSrc}
          alt={alt || 'image'}
          fill
          sizes="100vw"
          className={`object-cover transition-opacity duration-300 ${status === 'loaded' ? 'opacity-100' : 'opacity-0'} ${className}`}
          onLoadingComplete={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      </div>
      
      {/* Scanline overlay (optional aesthetic) */}
      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px]"></div>
    </div>
  );
};
