'use client';

import React, { createContext, useState, useEffect, useContext, ReactNode, useRef } from 'react';
import { Level, getLevelForPoints, getNextLevel } from '@/lib/levels';
import { streakBonuses } from '@/lib/streaks';


// --- Types Definition ---
export interface Subtask {
  id: number;
  text: string;
  completed: boolean;
}

export interface Task {
  id: number;
  text: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string | null;
  category: keyof typeof categories;
  priority: keyof typeof priorities;
  subtasks?: Subtask[];
  dueDate?: string;
}

export const categories = {
  personal: { name: 'Personal' },
  work: { name: 'Trabajo' },
  health: { name: 'Salud' },
  home: { name: 'Hogar' },
  learning: { name: 'Aprender' },
  fun: { name: 'Diversión' },
};

export const priorities = {
  low: { name: 'Baja' },
  medium: { name: 'Media' },
  high: { name: 'Alta' },
};

interface TasksContextType {
  tasks: Task[];
  magicPoints: number;
  currentStreak: number;
  currentLevel: Level;
  nextLevel: Level | null;
  progressToNextLevel: number;
  addTask: (taskData: Omit<Task, 'id' | 'completed' | 'createdAt'>) => void;
  updateTask: (taskId: number, taskData: Partial<Omit<Task, 'id'>>) => void;
  toggleTaskCompletion: (taskId: number) => void;
  deleteTask: (taskId: number) => void;
  addSubtask: (taskId: number, subtaskText: string) => void;
  toggleSubtaskCompletion: (taskId: number, subtaskId: number) => void;
  deleteSubtask: (taskId: number, subtaskId: number) => void;
  updateSubtask: (taskId: number, subtaskId: number, newText: string) => void;
  categories: typeof categories;
  priorities: typeof priorities;
}

// --- Context Creation ---
const TasksContext = createContext<TasksContextType | undefined>(undefined);

// --- Provider Component ---
export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [magicPoints, setMagicPoints] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const isInitialMount = useRef(true);

  useEffect(() => {
    try {
      const storedTasks = localStorage.getItem('tasks');
      if (storedTasks) setTasks(JSON.parse(storedTasks));

      const storedPoints = localStorage.getItem('magicPoints');
      if (storedPoints) setMagicPoints(parseInt(storedPoints, 10));

      const storedStreak = localStorage.getItem('currentStreak');
      if (storedStreak) setCurrentStreak(parseInt(storedStreak, 10));
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    } catch (error) {
      console.error("Failed to save tasks to localStorage", error);
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem('magicPoints', magicPoints.toString());
      localStorage.setItem('currentStreak', currentStreak.toString());
    } catch (error) {
      console.error("Failed to save gamification data to localStorage", error);
    }
  }, [magicPoints, currentStreak]);

  useEffect(() => {
    if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
    }

    const bonus = streakBonuses.find(b => b.streak === currentStreak);
    if (bonus) {
        setMagicPoints(prev => prev + bonus.points);
        alert(`¡Racha de ${bonus.streak} días! +${bonus.points} puntos extra`);
    }
  }, [currentStreak]);

  const addTask = (taskData: Omit<Task, 'id' | 'completed' | 'createdAt'>) => {
    const newTask: Task = {
      ...taskData,
      id: Date.now(),
      completed: false,
      createdAt: new Date().toISOString(),
      subtasks: [],
    };
    setTasks(prevTasks => [newTask, ...prevTasks]);
    setMagicPoints(prev => prev + 5);
  };

  const updateTask = (taskId: number, taskData: Partial<Omit<Task, 'id'>>) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, ...taskData } : task
      )
    );
  };

 const toggleTaskCompletion = (taskId: number) => {
    setTasks(prevTasks => prevTasks.map(task => {
        if (task.id === taskId) {
            const isCompleting = !task.completed;
            if (isCompleting && task.subtasks && task.subtasks.some(st => !st.completed)) {
                return task; 
            }

            if (isCompleting && !task.completed) {
              setMagicPoints(prev => prev + 10);
              setCurrentStreak(prev => prev + 1);
            }

            return {
                ...task,
                completed: isCompleting,
                completedAt: isCompleting ? new Date().toISOString() : null,
                subtasks: task.subtasks?.map(st => ({ ...st, completed: isCompleting }))
            };
        }
        return task;
    }));
  };

  const deleteTask = (taskId: number) => {
    if (currentStreak > 0) {
        setCurrentStreak(0);
    }
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  const addSubtask = (taskId: number, subtaskText: string) => {
    const newSubtask: Subtask = {
      id: Date.now(),
      text: subtaskText,
      completed: false,
    };
    setTasks(prevTasks => prevTasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          subtasks: [...(task.subtasks || []), newSubtask],
          completed: false,
        };
      }
      return task;
    }));
  };

  const toggleSubtaskCompletion = (taskId: number, subtaskId: number) => {
    setTasks(prevTasks => prevTasks.map(task => {
        if (task.id === taskId) {
            const newSubtasks = task.subtasks?.map(st => 
                st.id === subtaskId ? { ...st, completed: !st.completed } : st
            );

            const allSubtasksCompleted = newSubtasks?.every(st => st.completed);
            
            if (allSubtasksCompleted && !task.completed) {
              setMagicPoints(prev => prev + 10);
              setCurrentStreak(prev => prev + 1);
            }

            return {
                ...task,
                subtasks: newSubtasks,
                completed: allSubtasksCompleted || false,
                completedAt: allSubtasksCompleted ? new Date().toISOString() : null,
            };
        }
        return task;
    }));
  };

  const deleteSubtask = (taskId: number, subtaskId: number) => {
    setTasks(prevTasks => prevTasks.map(task => {
      if (task.id === taskId) {
        const newSubtasks = task.subtasks?.filter(st => st.id !== subtaskId);
        return { ...task, subtasks: newSubtasks };
      }
      return task;
    }));
  };

  const updateSubtask = (taskId: number, subtaskId: number, newText: string) => {
      setTasks(prevTasks => prevTasks.map(task => {
          if (task.id === taskId) {
              const newSubtasks = task.subtasks?.map(st => 
                  st.id === subtaskId ? { ...st, text: newText } : st
              );
              return { ...task, subtasks: newSubtasks };
          }
          return task;
      }));
  };

  // --- Level Calculation ---
  const currentLevel = getLevelForPoints(magicPoints);
  const nextLevel = getNextLevel(magicPoints);

  let progressToNextLevel = 0;
  if (nextLevel) {
      const pointsForNextLevel = nextLevel.minPoints - currentLevel.minPoints;
      const userProgress = magicPoints - currentLevel.minPoints;
      progressToNextLevel = (userProgress / pointsForNextLevel) * 100;
  } else {
      progressToNextLevel = 100;
  }

  const value = {
    tasks,
    magicPoints,
    currentStreak,
    currentLevel,
    nextLevel,
    progressToNextLevel,
    addTask,
    updateTask,
    toggleTaskCompletion,
    deleteTask,
    addSubtask,
    toggleSubtaskCompletion,
    deleteSubtask,
    updateSubtask,
    categories,
    priorities,
  };

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

// --- Custom Hook ---
export function useTasks() {
  const context = useContext(TasksContext);
  if (context === undefined) {
    throw new Error('useTasks must be used within a TasksProvider');
  }
  return context;
}
