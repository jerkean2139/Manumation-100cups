import { DEFAULT_PROMPT_CONFIG, type PromptConfig } from "./prompts.js";
import { getPromptConfigOverrides } from "../modules/repo.js";

/**
 * The live voice/prompt profile: shipped defaults with any Settings overrides
 * applied. Engines call this each run so prompt edits take effect without a
 * deploy. Falls back to defaults when there's no database.
 */
export async function loadConfig(): Promise<PromptConfig> {
  const overrides = (await getPromptConfigOverrides()) ?? {};
  const merged: PromptConfig = { ...DEFAULT_PROMPT_CONFIG };
  for (const key of Object.keys(DEFAULT_PROMPT_CONFIG) as (keyof PromptConfig)[]) {
    const value = overrides[key];
    // Only accept non-empty overrides, so a blank field falls back to default.
    if (typeof value === "string" && value.trim()) {
      (merged[key] as string) = value;
    } else if (key === "effort" && (value === "low" || value === "medium" || value === "high")) {
      merged.effort = value;
    }
  }
  return merged;
}
