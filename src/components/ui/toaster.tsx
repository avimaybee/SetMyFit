"use client";

import { Toaster as HotToaster, toast as hotToast } from "react-hot-toast";
import { X, Check, AlertCircle, Info, AlertTriangle } from "lucide-react";

export const toast = hotToast;

export function Toaster() {
  return (
    <HotToaster
      position="bottom-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: "transparent",
          boxShadow: "none",
          padding: 0,
        },
      }}
    >
      {(t) => {
        let bg = 'bg-[var(--accent-blue)]'; // Default Info
        let icon = <Info size={18} />;
        
        switch (t.type) {
            case 'success':
                bg = 'bg-[var(--accent-green)]';
                icon = <Check size={18} />;
                break;
            case 'error':
                bg = 'bg-[var(--accent-orange)]';
                icon = <AlertCircle size={18} />;
                break;
            case 'loading':
                bg = 'bg-[var(--accent-yellow)]';
                icon = <AlertTriangle size={18} />;
                break;
            default:
                bg = 'bg-[var(--accent-blue)]';
                icon = <Info size={18} />;
                break;
        }

        return (
             <div className={`${bg} border-2 border-[var(--border)] p-3 shadow-[4px_4px_0px_0px_var(--border)] flex items-center gap-3 min-w-[240px] mb-4 animate-in slide-in-from-right-10 fade-in duration-300`}>
                <div className="bg-[var(--bg-secondary)] border-2 border-[var(--border)] p-1 rounded-full text-[var(--text)]">
                    {icon}
                </div>
                <span className="font-mono text-sm font-bold text-[var(--text)]">
                  {typeof t.message === 'function' ? t.message(t) : t.message}
                </span>
                <button onClick={() => toast.dismiss(t.id)} className="ml-auto hover:bg-black/10 p-1 rounded text-[var(--text)]">
                    <X size={14} />
                </button>
             </div>
        );
      }}
    </HotToaster>
  );
}


