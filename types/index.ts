export type Platform =
  | 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'uploaded'
  | 'pdf' | 'text' | 'image';

export type ProcessingStatus =
  | 'pending'
  | 'downloading'
  | 'analyzing'
  | 'cutting_clips'
  | 'uploading'
  | 'complete'
  | 'failed';


export type MovementMode = 'timed' | 'reps';

export type DetectionMethod = 'ocr' | 'twelve_labs' | 'llm_text' | 'manual';

export interface Movement {
  id: string;
  source_video_id: string;
  position: number;
  name: string;
  mode: MovementMode;
  // null for text-derived movements, which have no video timestamp range
  start_sec: number | null;
  end_sec: number | null;
  duration_sec: number | null;
  reps: number | null;
  sets: number | null;
  // null for text-derived movements, which have no video clip
  clip_url: string | null;
  thumbnail_url: string | null;
  detection_method: DetectionMethod;
  confidence: number;
  // a rest interval row rather than an exercise
  is_rest: boolean;
  // inserted by the "rest between moves" toggle rather than by hand — the
  // toggle only ever removes rows marked true here
  auto_generated: boolean;
  created_at: string;
}

export interface Workout {
  id: string;
  user_id: string;
  title: string;
  source_video_id: string;
  total_duration_sec: number | null;
  created_at: string;
  source_video?: SourceVideo;
  movements?: WorkoutMovement[];
}

export interface WorkoutMovement {
  id: string;
  workout_id: string;
  movement_id: string;
  position: number;
  movement: Movement;
}

export interface SourceVideo {
  id: string;
  user_id: string;
  original_url: string;
  platform: Platform;
  title: string;
  duration_sec: number | null;
  thumbnail_url: string | null;
  processing_status: ProcessingStatus;
  processed_at: string | null;
  created_at: string;
}

export interface ProcessingJob {
  id: string;
  user_id: string;
  source_video_id: string | null;
  status: ProcessingStatus;
  segments_found: number | null;
  detection_method_used: DetectionMethod | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}
