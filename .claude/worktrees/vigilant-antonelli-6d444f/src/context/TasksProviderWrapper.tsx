'use client';

import { TasksProvider } from '@/context/TasksContext';
import { useState, useEffect } from 'react';

export default function TasksProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <TasksProvider>
      {children}
    </TasksProvider>
  );
}
