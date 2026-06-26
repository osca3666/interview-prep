"use server";

import { redirect } from "next/navigation";
import { insertUserProblem } from "@/data/problems";
import { parseLeetCodeProblemUrl } from "@/lib/leetcode";
import { createClient } from "@/lib/supabase/server";

const titleMaxLength = 160;
const patternMaxLength = 80;
const notesMaxLength = 4000;
const validDifficulties = new Set(["easy", "medium", "hard"]);

type DatabaseError = {
  code?: string;
  message?: string;
};

function getTrimmedField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalField(value: string) {
  return value.length > 0 ? value : null;
}

function logProblemSaveError(error: DatabaseError) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.error("Problem save error", {
    operation: "insert_user_problem",
    code: error.code ?? null,
    message: error.message ?? null,
  });
}

export async function addProblemAction(formData: FormData) {
  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/sign-in");
  }

  const rawUrl = getTrimmedField(formData, "leetcode_url");
  const title = getTrimmedField(formData, "title");
  const difficulty = getTrimmedField(formData, "difficulty").toLowerCase();
  const pattern = getTrimmedField(formData, "pattern");
  const notes = getTrimmedField(formData, "notes");
  const parsedUrl = parseLeetCodeProblemUrl(rawUrl);

  if (!parsedUrl) {
    redirect("/problems?error=invalid_url");
  }

  if (
    title.length === 0 ||
    title.length > titleMaxLength ||
    !validDifficulties.has(difficulty) ||
    pattern.length > patternMaxLength ||
    notes.length > notesMaxLength
  ) {
    redirect("/problems?error=invalid_form");
  }

  const { error } = await insertUserProblem(supabase, {
    user_id: userId,
    leetcode_slug: parsedUrl.slug,
    leetcode_url: parsedUrl.canonicalUrl,
    title,
    difficulty,
    pattern: normalizeOptionalField(pattern),
    notes,
  });

  if (error) {
    logProblemSaveError(error);

    if (error.code === "23505") {
      redirect("/problems?error=already_added");
    }

    redirect("/problems?error=save_failed");
  }

  redirect("/problems?message=added");
}
