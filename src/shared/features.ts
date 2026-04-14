/**
 * Owns: static feature flags used to gate in-progress or incomplete functionality.
 * Out of scope: user-facing settings and runtime configuration.
 * Inputs/Outputs: none; exports a frozen FEATURES object.
 * Side effects: none.
 */

export const FEATURES = Object.freeze({
  // Git integration is incomplete: pushes silently fail when the remote has
  // newer commits and no error is surfaced to the user. Disabled until fixed.
  git: false,
  // Multiple tabs: not yet implemented. Reserved for future work.
  multipleTabs: false
});

export type FeatureFlag = keyof typeof FEATURES;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURES[flag];
}
