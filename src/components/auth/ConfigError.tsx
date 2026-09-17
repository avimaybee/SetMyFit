"use client";

import React from 'react';
import { RetroWindow } from '@/components/retro-ui';
import { ShieldAlert } from 'lucide-react';

/**
 * Full-page fallback when the Firebase web config was not baked into the
 * build (NEXT_PUBLIC_FIREBASE_* missing). Renders instead of crashing so
 * the failure is diagnosable instead of a blank "Application error".
 */
export const FirebaseConfigError: React.FC = () => {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#FFF8E7] p-4"
      style={{ backgroundImage: 'radial-gradient(#e5e5e5 1px, transparent 1px)', backgroundSize: '20px 20px' }}
    >
      <div className="max-w-md w-full">
        <RetroWindow title="CONFIG_ERROR.SYS" icon={<ShieldAlert size={14} />}>
          <div className="flex flex-col gap-4 py-4">
            <p className="font-black text-2xl tracking-tighter">AUTH IS NOT CONFIGURED</p>
            <p className="font-mono text-xs leading-relaxed">
              The server has no Firebase web credentials. Set the
              NEXT_PUBLIC_FIREBASE_* variables (API key, auth domain, project ID,
              app ID) in the hosting dashboard and redeploy — plain Variables
              work, secrets are not required for these public keys.
            </p>
            <p className="font-mono text-[10px] leading-relaxed bg-black text-white p-2">
              NEXT_PUBLIC_FIREBASE_API_KEY / AUTH_DOMAIN / PROJECT_ID / APP_ID
            </p>
          </div>
        </RetroWindow>
      </div>
    </div>
  );
};
