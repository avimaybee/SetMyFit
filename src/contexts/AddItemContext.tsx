"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AddItemContextType {
    isGlobalAddOpen: boolean;
    openGlobalAdd: () => void;
    closeGlobalAdd: () => void;
    wardrobeVersion: number;
    notifyItemAdded: () => void;
}

const AddItemContext = createContext<AddItemContextType | undefined>(undefined);

export const AddItemProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isGlobalAddOpen, setIsGlobalAddOpen] = useState(false);
    const [wardrobeVersion, setWardrobeVersion] = useState(0);

    const openGlobalAdd = () => setIsGlobalAddOpen(true);
    const closeGlobalAdd = () => setIsGlobalAddOpen(false);
    const notifyItemAdded = () => {
        setWardrobeVersion(v => v + 1);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('wardrobe:updated'));
        }
    };

    return (
        <AddItemContext.Provider value={{ isGlobalAddOpen, openGlobalAdd, closeGlobalAdd, wardrobeVersion, notifyItemAdded }}>
            {children}
        </AddItemContext.Provider>
    );
};

export const useAddItem = () => {
    const context = useContext(AddItemContext);
    if (!context) {
        throw new Error('useAddItem must be used within AddItemProvider');
    }
    return context;
};
