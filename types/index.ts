export type Platform = 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'uploaded';

export type ProcessingStatus =
  | 'pending'
  | 'downloading'
  | 'analyzing'
  | 'cutting_clips'
  | 'uploading'
  | 'complete'
  | 'failed';


export type MovementMode = 'timed' | 'reps';

export type DetectionMethod = 'chapter_marker' | 'ocr' | 'twelve_labs';

export interface Movement {
  id: string;
  source_video_id: string;
  position: number;
  name: string;
  mode: MovementMode;
  start_sec: number;
  end_sec: number;
  duration_sec: number | null;
  reps: number | null;
  sets: number | null;
  clip_url: string;
  thumbnail_url: string | null;
  detection_method: DetectionMethod;
  confidence: number;
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
  override_duration_sec: number | null;
  rest_after_sec: number | null;
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
