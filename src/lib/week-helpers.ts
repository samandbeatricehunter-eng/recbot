export const WEEK_SEQUENCE = [
  "preseason",
  "week_1",
  "week_2",
  "week_3",
  "week_4",
  "week_5",
  "week_6",
  "week_7",
  "week_8",
  "week_9",
  "week_10",
  "week_11",
  "week_12",
  "week_13",
  "week_14",
  "week_15",
  "week_16",
  "week_17",
  "week_18",
  "wild_card",
  "divisional",
  "conference",
  "super_bowl",
  "offseason",
] as const;

export type WeekKey = (typeof WEEK_SEQUENCE)[number];

export function weekLabel(value: string | null | undefined): string {
  if (!value) return "Preseason";

  if (value.startsWith("week_")) {
    return `Week ${value.replace("week_", "")}`;
  }

  return value
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}