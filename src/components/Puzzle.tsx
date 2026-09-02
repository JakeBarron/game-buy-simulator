import { useState, useRef, useEffect } from 'react';
import type { Puzzle } from '../lib/types';
import { checkAnswer } from '../lib/puzzles';

export function PuzzleGate({
  puzzle,
  onSolved,
}: {
  puzzle: Puzzle;
  onSolved: (answer: string) => void;
}) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!puzzle.choices) {
      inputRef.current?.focus();
    }
  }, [puzzle]);

  const handleSubmit = (given: string) => {
    if (checkAnswer(puzzle, given)) {
      onSolved(given);
    } else {
      setError('Wrong. Try again.');
      setInputValue('');
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit(inputValue);
    }
  };

  const handleChoiceClick = (choice: string) => {
    handleSubmit(choice);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-6">
            Complete this task to clock in
          </p>
        </div>

        <div className="bg-slate-800 border border-slate-700 p-8 mb-8">
          <p className="text-2xl font-medium text-center text-slate-100 mb-8">
            {puzzle.prompt}
          </p>

          {puzzle.choices ? (
            <div className="space-y-3">
              {puzzle.choices.map((choice) => (
                <button
                  key={choice}
                  onClick={() => handleChoiceClick(choice)}
                  className="w-full px-6 py-4 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-100 font-medium transition-colors duration-150 active:bg-slate-500"
                >
                  {choice}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (error) setError('');
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="Your answer"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors"
              />
              <button
                onClick={() => handleSubmit(inputValue)}
                className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-100 font-medium transition-colors duration-150 active:bg-slate-500"
              >
                Submit
              </button>
            </div>
          )}

          {error && (
            <p className="mt-6 text-center text-slate-400 text-sm">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
