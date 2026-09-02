import { Puzzle, PuzzleKind } from './types';

/**
 * Picks a random element from an array using the injected rand function.
 */
function pickRandomIndex<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

/**
 * Fisher-Yates shuffle using the injected rand function.
 */
function shuffle<T>(arr: T[], rand: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generates a trivially easy puzzle for work-shift preamble.
 * Picks one of three kinds at random: arithmetic, match-shape, or type-word.
 * All puzzles should be solvable in under 10 seconds by an average person.
 */
export function makePuzzle(rand: () => number): Puzzle {
  const kind = pickRandomIndex<PuzzleKind>(
    ['arithmetic', 'match-shape', 'type-word'],
    rand
  );

  switch (kind) {
    case 'arithmetic':
      return makeArithmetic(rand);
    case 'match-shape':
      return makeMatchShape(rand);
    case 'type-word':
      return makeTypeWord(rand);
  }
}

/**
 * Single-digit or small two-digit addition/subtraction.
 * e.g. "7 + 5" or "12 - 4". Answer is the number as a string.
 */
function makeArithmetic(rand: () => number): Puzzle {
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15];
  const a = pickRandomIndex(numbers, rand);
  const b = pickRandomIndex(numbers, rand);
  const op = rand() < 0.5 ? '+' : '-';
  const answer = op === '+' ? a + b : Math.abs(a - b);

  return {
    kind: 'arithmetic',
    prompt: `${a} ${op} ${b}`,
    answer: answer.toString(),
  };
}

/**
 * Shape/color identification with 3 choices, exactly one correct.
 * e.g. prompt "Which is the square?" with choices ['■', '●', '▲'].
 * Answer is the correct choice string.
 */
function makeMatchShape(rand: () => number): Puzzle {
  const options = [
    { prompt: 'Which is the square?', shapes: ['■', '●', '▲'], correct: '■' },
    { prompt: 'Which is the circle?', shapes: ['■', '●', '▲'], correct: '●' },
    { prompt: 'Which is the triangle?', shapes: ['■', '●', '▲'], correct: '▲' },
  ];

  const selected = pickRandomIndex(options, rand);
  const choices = shuffle(selected.shapes, rand);

  return {
    kind: 'match-shape',
    prompt: selected.prompt,
    answer: selected.correct,
    choices,
  };
}

/**
 * Type a short common word. Mundane office-y words for tone.
 * e.g. prompt "Type the word: DESK", answer "desk".
 */
function makeTypeWord(rand: () => number): Puzzle {
  const words = [
    'desk',
    'chair',
    'folder',
    'memo',
    'inbox',
    'stapler',
    'meeting',
    'coffee',
  ];
  const word = pickRandomIndex(words, rand);

  return {
    kind: 'type-word',
    prompt: `Type the word: ${word.toUpperCase()}`,
    answer: word,
  };
}

/**
 * Compares player's answer against puzzle answer.
 * Case-insensitive, trimmed whitespace.
 */
export function checkAnswer(puzzle: Puzzle, given: string): boolean {
  return given.trim().toLowerCase() === puzzle.answer.trim().toLowerCase();
}
