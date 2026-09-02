import type { RunState } from './types';
import { SCHEMA_VERSION } from './config';

const KEY = 'gbs.run.v1';

/**
 * Loads a previously saved run from localStorage.
 * Returns null if the save is missing, corrupted, versioned differently, or inaccessible.
 */
export function loadRun(): RunState | null {
  try {
    const json = localStorage.getItem(KEY);
    if (!json) {
      return null;
    }

    let state: unknown;
    try {
      state = JSON.parse(json);
    } catch {
      // JSON parse failed — save is corrupt
      return null;
    }

    if (!state || typeof state !== 'object') {
      // Parsed value is not an object
      return null;
    }

    const run = state as RunState;

    if (run.schemaVersion !== SCHEMA_VERSION) {
      // Version mismatch — discard save for fresh run (POC, no migration worth doing)
      return null;
    }

    // Announcements are transient and never persisted; restore as empty.
    run.announcements = [];

    // Never restore mid-hold — spacingOut is always false on load.
    if (run.activeShift) {
      run.activeShift.spacingOut = false;
    }

    return run;
  } catch {
    // localStorage access failed (e.g., private browsing, blocked site data)
    return null;
  }
}

/**
 * Saves the current run state to localStorage.
 * Strips announcements before persisting (transient UI-only field).
 * Silently ignores any storage errors (quota exceeded, blocked storage).
 */
export function saveRun(state: RunState): void {
  try {
    const toSave = {
      ...state,
      announcements: [],
    };
    localStorage.setItem(KEY, JSON.stringify(toSave));
  } catch {
    // Silently ignore storage errors — a failed save must never break gameplay
  }
}

/**
 * Clears the saved run from localStorage.
 * Silently ignores any storage access errors.
 */
export function clearRun(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Silently ignore storage errors
  }
}
