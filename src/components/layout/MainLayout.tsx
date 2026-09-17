"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Shirt, BarChart3, Clock, Settings, Plus, User, Layers } from 'lucide-react';
import { RetroButton } from '../retro-ui';
import { onAuthChange, persistSession, clearSession, isFirebaseConfigured } from '@/lib/firebase/client';
import { apiFetch } from '@/lib/api';
import { FirebaseConfigError } from '@/components/auth/ConfigError';
import { useAddItem } from '@/contexts/AddItemContext';
import { GlobalAddModal } from './GlobalAddModal';

interface LayoutProps {
    children: React.ReactNode;
}

export const MainLayout: React.FC<LayoutProps> = ({ children }) => {
    const pathname = usePathname();
    const router = useRouter();
    const [userEmail, setUserEmail] = useState<string>("USER_01");
    const { openGlobalAdd } = useAddItem();

    useEffect(() => {
        if (!isFirebaseConfigured()) return;
        // Global auth gate: redirect signed-out users, refresh the
        // session cookie, and send users without a profile to onboarding.
        const unsubscribe = onAuthChange(async (fbUser) => {
            const onAuthPage = pathname.startsWith('/auth');
            if (!fbUser) {
                setUserEmail("USER_01");
                // Clear a potentially stale cookie so middleware and Firebase
                // can't disagree and ping-pong between / and /auth/sign-in.
                clearSession().catch(() => undefined);
                if (!onAuthPage && pathname !== '/onboarding') {
                    router.push('/auth/sign-in');
                }
                return;
            }
            setUserEmail(fbUser.email?.split('@')[0] ?? "USER_01");
            await persistSession().catch(() => false);
            if (!onAuthPage && pathname !== '/onboarding') {
                try {
                    const res = await apiFetch('/api/settings/profile');
                    if (res.status === 401) {
                        router.push('/auth/sign-in');
                    } else if (res.status === 404) {
                        router.push('/onboarding');
                    }
                    // Other errors (500/network): stay — pages surface their own errors.
                } catch {
                    // Ignore — pages surface their own errors.
                }
            }
        });
        return unsubscribe;
    }, [pathname, router]);

    const navItems = [
        { href: '/', icon: <Home size={20} />, label: 'Home', color: 'text-blue-600' },
        { href: '/wardrobe', icon: <Shirt size={20} />, label: 'Wardrobe', color: 'text-pink-500' },
        { href: '/templates', icon: <Layers size={20} />, label: 'Templates', color: 'text-purple-600' },
        { href: '/stats', icon: <BarChart3 size={20} />, label: 'Stats', color: 'text-green-600' },
        { href: '/history', icon: <Clock size={20} />, label: 'History', color: 'text-yellow-600' },
        { href: '/settings', icon: <Settings size={20} />, label: 'Settings', color: 'text-orange-500' },
    ];

    const isActive = (href: string) => {
        if (href === '/' && pathname !== '/') return false;
        return pathname.startsWith(href);
    };

    // Auth and onboarding render chrome-less: no sidebar/nav to escape from.
    // A missing Firebase build config fails closed with an explanation,
    // never a blank "Application error" crash.
    if (!isFirebaseConfigured()) {
        return <FirebaseConfigError />;
    }
    if (pathname.startsWith('/auth') || pathname === '/onboarding') {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen flex flex-col md:flex-row max-w-7xl mx-auto md:p-4 gap-6 pb-20 md:pb-4">

            {/* MOBILE: Top Header */}
            <header className="md:hidden sticky top-0 z-40 bg-[#FF6B6B] border-b-2 border-black p-3 flex justify-between items-center shadow-md">
                <h1 className="font-black text-xl text-white drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] tracking-tighter flex items-center gap-1" style={{ WebkitTextStroke: '1px black' }}>
                    SET<span className="text-[#FDFFB6]">MY</span>FIT <span className="text-[10px] font-mono mt-1 ml-1 opacity-80">v2.0.0</span>
                </h1>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => openGlobalAdd()}
                        aria-label="Quick add item"
                        className="w-11 h-11 min-w-[44px] min-h-[44px] bg-[#FDFFB6] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                    >
                        <Plus size={20} strokeWidth={3} />
                    </button>
                    <div className="w-8 h-8 bg-white border-2 border-black rounded-full overflow-hidden flex items-center justify-center">
                        <User size={20} className="text-gray-600" />
                    </div>
                </div>
            </header>

            {/* DESKTOP: Sidebar / Navigation */}
            <aside className="hidden md:flex w-full md:w-64 flex-col gap-4 shrink-0 sticky top-4 h-[calc(100vh-2rem)]">
                {/* Logo Box */}
                <div className="bg-[#FF6B6B] border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h1 className="font-black text-3xl text-white drop-shadow-[3px_3px_0px_rgba(0,0,0,1)] tracking-tighter" style={{ WebkitTextStroke: '1.5px black' }}>
                        SET<span className="text-[#FDFFB6]">MY</span>FIT
                    </h1>
                    <p className="text-xs font-mono font-bold mt-2 border-t-2 border-black pt-1 flex justify-between">
                        <span>v2.0.0</span>
                        <span>[BETA]</span>
                    </p>
                </div>

                {/* User Profile Snippet */}
                <div className="bg-white border-2 border-black p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 border-2 border-black rounded-none overflow-hidden relative flex items-center justify-center">
                        <User size={24} className="text-gray-600" />
                    </div>
                    <div className="leading-none">
                        <span className="block font-black text-sm uppercase">{userEmail}</span>
                        <div className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full border border-black animate-pulse"></span>
                            <span className="text-[10px] font-mono text-gray-600">ONLINE</span>
                        </div>
                    </div>
                </div>

                {/* Desktop Navigation Menu */}
                <nav className="flex flex-col gap-3">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                                flex items-center gap-3 px-4 py-3 border-2 border-black font-bold transition-all whitespace-nowrap flex-shrink-0
                                ${isActive(item.href)
                                    ? 'bg-black text-white translate-x-[4px] translate-y-[4px] shadow-none'
                                    : 'bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                }
                            `}
                        >
                            {item.icon}
                            <span className="font-mono uppercase tracking-tight">{item.label}</span>
                        </Link>
                    ))}
                </nav>

                {/* Quick Add Button (Bottom Left) */}
                <div className="mt-auto">
                    <RetroButton
                        onClick={() => openGlobalAdd()}
                        className="w-full py-4 flex items-center justify-center gap-2 border-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                        variant="neutral"
                    >
                        <Plus size={18} strokeWidth={3} /> QUICK ADD ITEM
                    </RetroButton>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col p-4 md:p-0 overflow-x-hidden">
                {children}
            </main>

            {/* MOBILE: Bottom Navigation Bar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#FFF8E7] border-t-2 border-black z-50 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_0px_0px_rgba(0,0,0,0.1)]">
                <div className="flex justify-around items-center py-2 px-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                                flex flex-col items-center justify-center gap-1 p-2 py-2.5 min-h-[56px] rounded-lg transition-all w-full
                                ${isActive(item.href)
                                    ? 'bg-black text-white'
                                    : 'text-black hover:bg-black/5 active:scale-95'
                                }
                            `}
                        >
                            {React.cloneElement(item.icon as React.ReactElement<{ size: number }>, { size: 18 })}
                            <span className="font-mono text-[9px] font-bold uppercase tracking-tight">{item.label}</span>
                        </Link>
                    ))}
                </div>
            </nav>

            {/* Global Add Item Modal */}
            <GlobalAddModal />
        </div>
    );
};
