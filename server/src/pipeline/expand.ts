import { CompactExercise } from './llmInterpret';

export interface FlatMovement {
  name: string;
  mode: 'timed' | 'reps';
  duration_sec: number | null;
  reps: number | null;
  sets: number | null;
  is_rest: boolean;
  auto_generated: boolean;
  image_index: number | null;
}

const DEFAULT_REST_SEC = 3;

// Applies whenever an exercise gives neither a hold time nor a rep count —
// a screenshot listing exercise names next to a generic countdown ring is
// the clearest case, but this is a universal fallback, not specific to any
// one input type: any source (PDF, plain text, image) that names an
// exercise with no timing/rep info at all lands here.
const DEFAULT_NO_INFO_HOLD_SEC = 30;
const DEFAULT_NO_INFO_REST_SEC = 10;

// Turns "hold 6 sec, repeat 6 times, 3 sets" into 18 flat timed movements
// with a rest interleaved between every rep, set, and exercise. Deliberately
// plain code, not the LLM's job — asking a model to emit the same object
// eighteen times in a row is exactly the kind of thing that gets flaky.
export function expandToMovements(
  exercises: CompactExercise[],
  defaultRestSec: number = DEFAULT_REST_SEC
): FlatMovement[] {
  const out: FlatMovement[] = [];

  exercises.forEach((ex, exIndex) => {
    let interExerciseRest = defaultRestSec;

    if (ex.hold_sec != null) {
      const reps = ex.reps ?? 1;
      const sets = ex.sets ?? 1;
      const restBetween = ex.rest_sec ?? defaultRestSec;
      const totalReps = reps * sets;

      for (let i = 0; i < totalReps; i++) {
        out.push({
          name: ex.name,
          mode: 'timed',
          duration_sec: ex.hold_sec,
          reps: null,
          sets: null,
          is_rest: false,
          auto_generated: false,
          image_index: ex.image_index,
        });
        if (i < totalReps - 1) {
          out.push(makeRest(restBetween));
        }
      }
    } else if (ex.reps != null) {
      // A rep count with no hold time — nothing to repeat into a timed
      // sequence, so keep it as a single reps-mode movement instead of
      // guessing a duration.
      out.push({
        name: ex.name,
        mode: 'reps',
        duration_sec: null,
        reps: ex.reps,
        sets: ex.sets,
        is_rest: false,
        auto_generated: false,
        image_index: ex.image_index,
      });
    } else {
      // Neither hold time nor reps given at all.
      out.push({
        name: ex.name,
        mode: 'timed',
        duration_sec: DEFAULT_NO_INFO_HOLD_SEC,
        reps: null,
        sets: null,
        is_rest: false,
        auto_generated: false,
        image_index: ex.image_index,
      });
      interExerciseRest = DEFAULT_NO_INFO_REST_SEC;
    }

    if (exIndex < exercises.length - 1) {
      out.push(makeRest(interExerciseRest));
    }
  });

  return out;
}

function makeRest(durationSec: number): FlatMovement {
  return {
    name: 'Rest',
    mode: 'timed',
    duration_sec: durationSec,
    reps: null,
    sets: null,
    is_rest: true,
    auto_generated: true,
    image_index: null,
  };
}
