import React, { createContext, useContext, useState } from 'react';

interface ChecklistItem {
  id: number;
  text: string;
  completed: boolean;
  notes: string;
}

interface Checklist {
  id: number;
  title: string;
  items: ChecklistItem[];
}

interface ChecklistContextType {
  checklists: Checklist[];
  updateChecklist: (id: number, updates: Partial<Checklist>) => Promise<void>;
  deleteChecklist: (id: number) => Promise<void>;
}

export const ChecklistContext = createContext<ChecklistContextType | undefined>(undefined);

export const ChecklistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [checklists, setChecklists] = useState<Checklist[]>([]);

  const updateChecklist = async (id: number, updates: Partial<Checklist>) => {
    setChecklists(prev =>
      prev.map(checklist =>
        checklist.id === id ? { ...checklist, ...updates } : checklist
      )
    );
  };

  const deleteChecklist = async (id: number) => {
    setChecklists(prev => prev.filter(checklist => checklist.id !== id));
  };

  return (
    <ChecklistContext.Provider value={{ checklists, updateChecklist, deleteChecklist }}>
      {children}
    </ChecklistContext.Provider>
  );
};

export const useChecklist = () => {
  const context = useContext(ChecklistContext);
  if (context === undefined) {
    throw new Error('useChecklist must be used within a ChecklistProvider');
  }
  return context;
}; 