import fs from 'fs/promises';
import Anthropic from '@anthropic-ai/sdk';

export interface CompactExercise {
  name: string;
  // seconds to hold each rep; null if the exercise has no time component
  // (e.g. "10 reps" with no hold called out — left to the reps/sets fields)
  hold_sec: number | null;
  reps: number | null;
  sets: number | null;
  // rest between reps/sets, only when the source actually specifies one
  rest_sec: number | null;
  // index into the images passed alongside the text, if a photo illustrates this exercise
  image_index: number | null;
}

const TOOL_NAME = 'record_exercises';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// The one model call in the text pipeline. Everything before this
// (routing, extraction) and everything after (expanding reps/sets into an
// actual move/rest sequence) is plain deterministic code — this is the only
// step that reads natural language and decides what it means.
export async function interpretExercises(input: {
  text: string;
  imagePaths?: string[];
}): Promise<CompactExercise[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set — required for the text-input pipeline');
  }

  const imageBlocks = await Promise.all(
    (input.imagePaths ?? []).slice(0, 8).map(async (p) => {
      const data = (await fs.readFile(p)).toString('base64');
      return {
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: 'image/png' as const, data },
      };
    })
  );

  const message = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4096,
    tools: [
      {
        name: TOOL_NAME,
        description: 'Record the exercises extracted from the workout instructions, in reading order.',
        input_schema: {
          type: 'object',
          properties: {
            exercises: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  hold_sec: { type: ['number', 'null'], description: 'Seconds to hold each rep. Null if no hold time is given.' },
                  reps: { type: ['number', 'null'] },
                  sets: { type: ['number', 'null'] },
                  rest_sec: { type: ['number', 'null'], description: 'Rest between reps/sets — only if the source states one, otherwise null.' },
                  image_index: { type: ['number', 'null'], description: '0-based index into the provided images that illustrates this exercise, if any.' },
                },
                required: ['name', 'hold_sec', 'reps', 'sets', 'rest_sec', 'image_index'],
              },
            },
          },
          required: ['exercises'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Extract every exercise from these workout instructions, in the order they appear. ' +
              'For each one, interpret hold time, reps, sets, and rest exactly as described — e.g. ' +
              '"hold each move 6 seconds, repeat 6 times, 3 sets" means hold_sec: 6, reps: 6, sets: 3. ' +
              'If any images are attached, they are provided in the same order they appear in the ' +
              'source document — set image_index to the one showing that exercise, matching by ' +
              'position and content, and leave it null if you\'re not confident which one matches. ' +
              'If a rest duration between reps or sets isn\'t stated, leave rest_sec null rather than guessing. ' +
              'If there\'s no hold time at all (just a rep count), leave hold_sec null.\n\n' +
              `Instructions:\n${input.text}`,
          },
          ...imageBlocks,
        ],
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Model did not return structured exercise data');
  }

  // The model occasionally serializes the array field as a JSON string
  // instead of filling in the schema's actual array type — handle both.
  let exercises = (toolUse.input as { exercises: CompactExercise[] | string }).exercises;
  if (typeof exercises === 'string') {
    const parsed = JSON.parse(exercises);
    exercises = Array.isArray(parsed) ? parsed : parsed.exercises;
  }
  if (!Array.isArray(exercises)) {
    throw new Error('Model returned exercises in an unexpected shape');
  }
  return exercises;
}
