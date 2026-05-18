'use client';

// CRITICAL: Import first - registers share target listener before React mounts
import '@/lib/share-target-init';

import TasksProviderWrapper from '@/context/TasksProviderWrapper';
import React from 'react';
import StartMenu from '@/components/dashboard/start-menu';
import TaskPostIts from '@/components/dashboard/task-post-its';
import SystemPostIts from '@/components/dashboard/system-post-its';
import { PostItSettingsProvider } from '@/context/PostItSettingsContext';
import { JournalProvider } from '@/context/JournalContext';
import MedicineAlarmManager from '@/components/apps/mi-hogar/pharmacy/medicine-alarm-manager';
import TaskNotificationManager from '@/components/apps/mi-hogar/tasks/task-notification-manager';
import VehicleNotificationManager from '@/components/apps/mi-hogar/garage/vehicle-notification-manager';
import PlantNotificationManager from '@/components/apps/huerto/plant-notification-manager';
import TextSelectionToolbar from '@/components/journal/text-selection-toolbar';
import LayoutResizer from './LayoutResizer';
import { GlobalMenuProvider } from '@/context/GlobalMenuContext';
import { ShareTargetProvider } from '@/context/ShareTargetContext';
import { AiProvider } from '@/context/AiContext';
import AiPanel from '@/components/assistant/ai-panel';

import { defineCustomElements } from '@ionic/pwa-elements/loader';

export default function ClientProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    defineCustomElements(window);
  }, []);

  return (
    <TasksProviderWrapper>
      <GlobalMenuProvider>
        <PostItSettingsProvider>
          <JournalProvider>
            <AiProvider>
              <ShareTargetProvider>
                <TextSelectionToolbar />
                <MedicineAlarmManager />
                <TaskNotificationManager />
                <VehicleNotificationManager />
                <PlantNotificationManager />
                <LayoutResizer>
                  {children}
                </LayoutResizer>
                <StartMenu />
                <TaskPostIts />
                <SystemPostIts />
                <AiPanel />
              </ShareTargetProvider>
            </AiProvider>
          </JournalProvider>
        </PostItSettingsProvider>
      </GlobalMenuProvider>
    </TasksProviderWrapper>
  );
}
