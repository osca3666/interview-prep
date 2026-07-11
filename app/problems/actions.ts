"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createUserProblem } from "@/data/problems";
import { isValidDateOnly } from "@/lib/date-only";
import { getTrimmedStringField } from "@/lib/form-data";
import { getLeetCodeProblemByFrontendId } from "@/lib/leetcode-catalog";
import { createClient } from "@/lib/supabase/server";
import {
  getDateOnlyInTimeZone,
  isValidTimeZone,
  normalizeTimeZone,
} from "@/lib/time-zone";

const patternMaxLength = 80;
const notesMaxLength = 4000;
const validStartModes = new Set(["practiced", "scheduled"]);
const validRatings = new Set(["again", "hard", "good", "easy"]);
const controlledRpcMessages = new Set([
  "not_authenticated",
  "invalid_start_mode",
  "invalid_rating",
  "invalid_date",
  "invalid_time_zone",
  "duplicate_problem",
]);
const allowedReturnPaths = new Set(["/dashboard", "/problems"]);

type DatabaseError = {
  code?: string;
  message?: string;
};

function getReturnPath(formData: FormData) {
  const value = getTrimmedStringField(formData, "return_to");
  return allowedReturnPaths.has(value) ? value : "/problems";
}

function getControlledRpcMessage(error: DatabaseError) {
  if (error.code !== "P0001" || !error.message) {
    return null;
  }

  return controlledRpcMessages.has(error.message) ? error.message : null;
}

function logProblemSaveError(error: DatabaseError) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.error("Problem save error", {
    operation: "create_user_problem_with_timezone",
    code: error.code ?? null,
    message: error.message ?? null,
  });
}

export async function addProblemAction(formData: FormData) {
  const returnTo = getReturnPath(formData);
  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/sign-in");
  }

  const frontendId = getTrimmedStringField(formData, "leetcode_frontend_id");
  const catalogProblem = getLeetCodeProblemByFrontendId(frontendId);
  const pattern = getTrimmedStringField(formData, "pattern");
  const notes = getTrimmedStringField(formData, "notes");
  const startMode = getTrimmedStringField(formData, "start_mode");
  const rating = getTrimmedStringField(formData, "rating");
  const practiceDate = getTrimmedStringField(formData, "practice_date");
  const firstReviewDate = getTrimmedStringField(formData, "first_review_date");
  const timeZone = normalizeTimeZone(
    getTrimmedStringField(formData, "time_zone"),
  );

  if (!catalogProblem) {
    redirect(`${returnTo}?error=invalid_problem`);
  }

  if (
    pattern.length > patternMaxLength ||
    notes.length > notesMaxLength ||
    !validStartModes.has(startMode)
  ) {
    redirect(`${returnTo}?error=invalid_form`);
  }

  const startDate = startMode === "practiced" ? practiceDate : firstReviewDate;

  if (!isValidDateOnly(startDate)) {
    redirect(`${returnTo}?error=invalid_date`);
  }

  if (!isValidTimeZone(timeZone)) {
    redirect(`${returnTo}?error=invalid_time_zone`);
  }

  const todayInUserTimeZone = getDateOnlyInTimeZone(new Date(), timeZone);

  if (!todayInUserTimeZone) {
    redirect(`${returnTo}?error=invalid_date`);
  }

  if (startMode === "practiced") {
    if (!validRatings.has(rating)) {
      redirect(`${returnTo}?error=invalid_rating`);
    }

    if (startDate > todayInUserTimeZone) {
      redirect(`${returnTo}?error=invalid_date`);
    }
  }

  if (startMode === "scheduled" && startDate < todayInUserTimeZone) {
    redirect(`${returnTo}?error=invalid_date`);
  }

  const { error } = await createUserProblem(supabase, {
    p_leetcode_slug: catalogProblem.slug,
    p_leetcode_url: catalogProblem.leetcodeUrl,
    p_title: catalogProblem.title,
    p_difficulty: catalogProblem.difficulty,
    p_pattern: pattern,
    p_notes: notes,
    p_start_mode: startMode,
    p_rating: startMode === "practiced" ? rating : "good",
    p_start_date: startDate,
    p_time_zone: timeZone,
  });

  if (error) {
    logProblemSaveError(error);

    const controlledMessage = getControlledRpcMessage(error);

    if (controlledMessage === "not_authenticated") {
      redirect("/sign-in");
    }

    if (controlledMessage === "duplicate_problem") {
      redirect(`${returnTo}?error=already_added`);
    }

    if (controlledMessage === "invalid_rating") {
      redirect(`${returnTo}?error=invalid_rating`);
    }

    if (controlledMessage === "invalid_date") {
      redirect(`${returnTo}?error=invalid_date`);
    }

    if (controlledMessage === "invalid_time_zone") {
      redirect(`${returnTo}?error=invalid_time_zone`);
    }

    if (controlledMessage === "invalid_start_mode") {
      redirect(`${returnTo}?error=invalid_form`);
    }

    redirect(`${returnTo}?error=save_failed`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/problems");
  redirect(`${returnTo}?message=added`);
}
