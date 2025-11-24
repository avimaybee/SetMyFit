import React from 'react';
import { RetroWindow } from '@/components/retro-ui';

interface SystemMsgProps {
    logs: { message: string; ts: string }[];
    location?: string;
    season?: string;
    itemCount?: number;
}

export const SystemMsg: React.FC<SystemMsgProps> = ({ location, season, itemCount }) => {
    return (
        <RetroWindow title="SYSTEM_MSG" className="h-full bg-[#FDFFB6]" headerColor="bg-[#FF6B6B]">
            <div className="p-6 h-full flex flex-col font-mono text-sm space-y-3"
                 style={{ 
                     backgroundImage: 'repeating-linear-gradient(transparent, transparent 23px, #e5e5e5 24px)',
                     backgroundAttachment: 'local'
                 }}>
                
                <p className="font-bold">{`> Analyzing local trends...`}</p>
                <p>{`> Season: ${season || 'November'}`}</p>
                <p>{`> Location: ${location || 'SIMULATION_CITY'}`}</p>
                <p>{`> Items in database: ${itemCount || 0}`}</p>
                
                <div className="mt-auto">
                    <span className="animate-pulse font-black">_</span>
                </div>
            </div>
        </RetroWindow>
    );
};
