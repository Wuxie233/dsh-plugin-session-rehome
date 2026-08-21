/**
 * Ask vs auto policy for move_agent_to_root.
 *
 * Ask preserves the current confirmation rules. Auto skips every
 * userQuestions prompt and keeps the model's canonical path when several
 * registered workspaces match.
 */

/** Durable settings namespace (host schema + browser bind). */
export const SETTINGS_NAMESPACE = 'session-rehome'

/** Field carrying ask vs auto. */
export const REHOME_MODE_FIELD = 'rehomeMode'

/** Accepted rehome modes. */
export const REHOME_MODES = ['ask', 'auto']

/** Default matches the historical confirmation behavior. */
export const DEFAULT_REHOME_MODE = 'ask'

/**
 * Coerce a stored or resolved value to a known mode.
 * @param {unknown} value raw preference
 * @returns {'ask' | 'auto'}
 */
export function normalizeRehomeMode(value) {
  return value === 'auto' ? 'auto' : 'ask'
}

/**
 * Decide confirmation and unique-match remapping for one tool call.
 * @param {object} input
 * @param {'ask' | 'auto'} input.mode live preference
 * @param {boolean} input.onNoRepo current home is No Repo (or unset)
 * @param {boolean} input.leavingProject current home is a real project and differs from the target
 * @param {number} input.matchCount registered non-No-Repo workspaces matching the target
 */
export function rehomePolicy({ mode, onNoRepo, leavingProject, matchCount }) {
  const auto = mode === 'auto'
  return {
    remapUnique: onNoRepo && matchCount === 1,
    confirmLeave: !auto && leavingProject,
    chooseMatch: !auto && onNoRepo && matchCount > 1,
  }
}
