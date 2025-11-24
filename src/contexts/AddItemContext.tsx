"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AddItemContextType {
    isGlobalAddOpen: boolean;
    openGlobalAdd: () => void;
    closeGlobalAdd: () => void;
}

const AddItemContext = createContext<AddItemContextType | undefined>(undefined);

export const AddItemProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isGlobalAddOpen, setIsGlobalAddOpen] = useState(false);

    const openGlobalAdd = () => setIsGlobalAddOpen(true);
    const closeGlobalAdd = () => setIsGlobalAddOpen(false);

    return (
        <AddItemContext.Provider value={{ isGlobalAddOpen, openGlobalAdd, closeGlobalAdd }}>
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
