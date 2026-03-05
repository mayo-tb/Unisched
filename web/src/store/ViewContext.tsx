import React, { createContext, useContext, useState } from 'react';

export type ViewType = 'dashboard' | 'timetable' | 'resources' | 'settings';

interface ViewContextType {
    currentView: ViewType;
    setView: (view: ViewType) => void;
}

const ViewContext = createContext<ViewContextType | undefined>(undefined);

export function ViewProvider({ children }: { children: React.ReactNode }) {
    const [currentView, setView] = useState<ViewType>('dashboard');

    return (
        <ViewContext.Provider value={{ currentView, setView }}>
            {children}
        </ViewContext.Provider>
    );
}

export function useView() {
    const context = useContext(ViewContext);
    if (!context) {
        throw new Error('useView must be used within a ViewProvider');
    }
    return context;
}
