export const studyRatings = [
  { value: "bad", label: "Bad", description: "Struggled" },
  { value: "ok", label: "OK", description: "Some difficulty" },
  { value: "good", label: "Good", description: "Solved confidently" },
] as const;

export type StudyRating = (typeof studyRatings)[number]["value"];

const studyRatingValues = new Set<string>(
  studyRatings.map((rating) => rating.value),
);

export function isStudyRating(value: unknown): value is StudyRating {
  return typeof value === "string" && studyRatingValues.has(value);
}
