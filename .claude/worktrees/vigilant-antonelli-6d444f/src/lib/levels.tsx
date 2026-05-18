
import React from 'react';
import { Award, Feather, Star, Sparkles, Crown } from 'lucide-react';

export interface Level {
  name: string;
  minPoints: number;
  icon: React.ReactNode;
}

export const taskLevels: Level[] = [
  { name: 'Novato', minPoints: 0, icon: <Award className="h-7 w-7" /> },
  { name: 'Aprendiz', minPoints: 50, icon: <Feather className="h-7 w-7" /> },
  { name: 'Oficial', minPoints: 150, icon: <Star className="h-7 w-7" /> },
  { name: 'Maestro', minPoints: 300, icon: <Sparkles className="h-7 w-7" /> },
  { name: 'Gran Maestro', minPoints: 500, icon: <Crown className="h-7 w-7" /> },
];

export const getLevelForPoints = (points: number): Level => {
  let currentLevel: Level = taskLevels[0];
  for (const level of taskLevels) {
    if (points >= level.minPoints) {
      currentLevel = level;
    } else {
      break; 
    }
  }
  return currentLevel;
};

export const getNextLevel = (points: number): Level | null => {
    const currentLevel = getLevelForPoints(points);
    const currentLevelIndex = taskLevels.findIndex(l => l.name === currentLevel.name);
    if (currentLevelIndex < taskLevels.length - 1) {
        return taskLevels[currentLevelIndex + 1];
    }
    return null;
};
