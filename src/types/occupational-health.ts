export interface OccupationalSettings {
  id: string;
  user_id: string;
  desk_type: 'traditional' | 'standing';
  pomodoro_work_time: number;
  pomodoro_break_time: number;
  sitting_minutes: number;
  standing_minutes: number;
  moving_minutes: number;
  notifications_enabled: boolean;
  notifications_start_time: string;
  notifications_end_time: string;
  created_at: string;
  updated_at: string;
}

export interface OccupationalAudit {
  id: string;
  user_id: string;
  feet_alignment?: string;
  knees_alignment?: string;
  pelvis_alignment?: string;
  lumbar_support?: string;
  arms_alignment?: string;
  wrists_alignment?: string;
  monitor_alignment?: string;
  neck_alignment?: string;
  score?: number;
  notes?: string;
  created_at: string;
}

export interface OccupationalSymptom {
  id: string;
  user_id: string;
  pain_level?: number;
  pain_zones?: string[];
  visual_fatigue?: number;
  notes?: string;
  created_at: string;
}
