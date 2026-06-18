import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** A calm color band for a 0-100 score. */
export function scoreTone(score: number): string {
  if (score >= 85) return "text-sage";
  if (score >= 65) return "text-ink";
  if (score >= 45) return "text-clay";
  return "text-clay";
}

export function scoreBar(score: number): string {
  if (score >= 85) return "bg-sage";
  if (score >= 65) return "bg-ink/70";
  return "bg-clay";
}

export function stageLabel(stage: string): string {
  return stage
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
