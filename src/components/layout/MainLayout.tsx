"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Shirt, BarChart3, Clock, Settings, Plus, User, Layers } from 'lucide-react';
import { RetroButton } from '../retro-ui';
import { onAuthChange, persistSession, clearSession, useFirebaseConfig } from '@/lib/firebase/client';
import { apiFetch } from '@/lib/api';
import { FirebaseConfigError } from '@/components/auth/ConfigError';
import { useAddItem } from '@/contexts/AddItemContext';
import { GlobalAddModal } from './GlobalAddModal';

import { clientLogger } from '@/lib/clientLogger';

interface LayoutProps {
    children: React.ReactNode;
}

export const MainLayout: React.FC<LayoutProps> = ({ children }) => {
    const pathname = usePathname();
    const router = useRouter();
    const [userEmail, setUserEmail] = useState<string>("USER_01");
    const { openGlobalAdd } = useAddItem();
    const fbConfig = useFirebaseConfig();

    useEffect(() => {
        if (fbConfig !== 'ready') return;
        clientLogger.auth.info('MainLayout auth listener initialized', { pathname });
        // Global auth gate: redirect signed-out users, refresh the
        // session cookie, and send users without a profile to onboarding.
        const unsubscribe = onAuthChange(async (fbUser) => {
            const onAuthPage = pathname.startsWith('/auth');
            if (!fbUser) {
                clientLogger.auth.info('No active Firebase user session detected');
                setUserEmail("USER_01");
                clearSession().catch(() => undefined);
                if (!onAuthPage && pathname !== '/onboarding') {
                    clientLogger.auth.info('Redirecting unauthenticated user to /auth/sign-in');
                    router.push('/auth/sign-in');
                }
                return;
            }

            const emailHandle = fbUser.email?.split('@')[0] ?? "USER_01";
            clientLogger.auth.success(`Firebase user authenticated: ${fbUser.email}`, { uid: fbUser.uid });
            setUserEmail(emailHandle);
            await persistSession().catch(() => false);

            if (!onAuthPage && pathname !== '/onboarding') {
                try {
                    const res = await apiFetch('/api/settings/profile');
                    if (res.status === 401) {
                        clientLogger.auth.warn('Session unauthorized on profile check, redirecting to sign-in');
                        router.push('/auth/sign-in');
                    } else {
                        const json = await res.json().catch(() => null);
                        const hasProfile = json && json.data !== null && json.hasProfile !== false;
                        clientLogger.profile.info('Profile verification result:', { hasProfile, userId: fbUser.uid });
                        if (!hasProfile || res.status === 404) {
                            clientLogger.profile.warn('User has no active profile, redirecting to /onboarding');
                            router.push('/onboarding');
                        }
                    }
                } catch (err) {
                    clientLogger.profile.warn('Profile check failed gracefully:', err);
                }
            }
        });
        return unsubscribe;
    }, [pathname, router, fbConfig]);

    const navItems = [
        { href: '/', icon: <Home size={20} />, label: 'Home', color: 'text-blue-600' },
        { href: '/wardrobe', icon: <Shirt size={20} />, label: 'Wardrobe', color: 'text-pink-500' },
        { href: '/templates', icon: <Layers size={20} />, label: 'Templates', color: 'text-purple-600' },
        { href: '/stats', icon: <BarChart3 size={20} />, label: 'Stats', color: 'text-green-600' },
        { href: '/history', icon: <Clock size={20} />, label: 'History', color: 'text-yellow-600' },
        { href: '/settings', icon: <Settings size={20} />, label: 'Settings', color: 'text-orange-500' },
    ];

    const mobileNavItems = [
        { href: '/', icon: <Home size={20} />, label: 'Home' },
        { href: '/wardrobe', icon: <Shirt size={20} />, label: 'Wardrobe' },
        { href: '/templates', icon: <Layers size={20} />, label: 'Templates' },
        { href: '/stats', icon: <BarChart3 size={20} />, label: 'Stats' },
        { href: '/history', icon: <Clock size={20} />, label: 'History' },
        { href: '/settings', icon: <Settings size={20} />, label: 'Settings' },
    ];

    const isActive = (href: string) => {
        if (href === '/' && pathname !== '/') return false;
        return pathname.startsWith(href);
    };

    // Auth and onboarding render chrome-less: no sidebar/nav to escape from.
    // A missing Firebase config (build-time AND runtime) fails closed with
    // an explanation, never a blank "Application error" crash.
    if (fbConfig === 'missing') {
        return <FirebaseConfigError />;
    }
    if (fbConfig === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center font-mono bg-[#FFF8E7]">
                <p className="animate-pulse">LOADING...</p>
            </div>
        );
    }
    if (pathname.startsWith('/auth') || pathname === '/onboarding') {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen flex flex-col md:flex-row max-w-7xl mx-auto md:p-4 gap-6 pb-24 md:pb-4">

            {/* MOBILE: Top Header */}
            <header className="md:hidden sticky top-0 z-40 bg-[#FF6B6B] border-b-2 border-black p-3 flex justify-between items-center shadow-md">
                <Link href="/" className="font-black text-xl text-white drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] tracking-tighter flex items-center gap-1" style={{ WebkitTextStroke: '1px black' }}>
                    SET<span className="text-[#FDFFB6]">MY</span>FIT <span className="text-[10px] font-mono mt-1 ml-1 opacity-80">v2.0.0</span>
                </Link>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => openGlobalAdd()}
                        aria-label="Quick add item"
                        className="w-10 h-10 min-w-[40px] min-h-[40px] bg-[#FDFFB6] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-transform"
                    >
                        <Plus size={20} strokeWidth={3} className="text-black" />
                    </button>
                    <Link
                        href="/settings"
                        aria-label="Settings and profile"
                        className="w-10 h-10 min-w-[40px] min-h-[40px] bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center justify-center transition-transform hover:bg-gray-50"
                    >
                        <User size={18} className="text-black" />
                    </Link>
                </div>
            </header>

            {/* DESKTOP: Sidebar / Navigation */}
            <aside className="hidden md:flex w-full md:w-64 flex-col gap-4 shrink-0 sticky top-4 h-[calc(100vh-2rem)] overflow-y-auto no-scrollbar pb-2">
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
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="w-2 h-2 bg-emerald-600 rounded-full border border-black animate-pulse"></span>
                            <span className="text-[10px] font-mono text-emerald-800 font-bold">ONLINE</span>
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
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#FFF8E7] border-t-2 border-black z-50 pb-safe shadow-[0_-4px_0px_0px_rgba(0,0,0,0.1)]">
                <div className="flex justify-around items-center py-1 px-1">
                    {mobileNavItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                                flex flex-col items-center justify-center gap-1 py-1.5 px-1 min-h-[48px] rounded transition-all flex-1 text-center
                                ${isActive(item.href)
                                    ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                    : 'text-black hover:bg-black/5 active:scale-95'
                                }
                            `}
                        >
                            {React.cloneElement(item.icon as React.ReactElement<{ size: number }>, { size: 18 })}
                            <span className="font-mono text-[9px] font-bold uppercase tracking-tight leading-none">{item.label}</span>
                        </Link>
                    ))}
                </div>
            </nav>

            {/* Global Add Item Modal */}
            <GlobalAddModal />
        </div>
    );
};
