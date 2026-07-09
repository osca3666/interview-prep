"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createUserProblem } from "@/data/problems";
import { neetcode150Problems } from "@/data/problem-sets/neetcode-150";
import { getTrimmedStringField } from "@/lib/form-data";
import { createClient } from "@/lib/supabase/server";
import {
  getDateOnlyInTimeZone,
  isValidTimeZone,
  normalizeTimeZone,
} from "@/lib/time-zone";

const roadmapReturnPath = "/roadmaps/neetcode-150";
const controlledRpcMessages = new Set([
  "not_authenticated",
  "invalid_start_mode",
  "invalid_rating",
  "invalid_date",
  "invalid_time_zone",
  "duplicate_problem",
]);

type DatabaseError = {
  code?: string;
  message?: string;
};

function getReturnPath(formData: FormData) {
  const value = getTrimmedStringField(formData, "return_to");
  return value === roadmapReturnPath ? value : roadmapReturnPath;
}

function getControlledRpcMessage(error: DatabaseError) {
  if (error.code !== "P0001" || !error.message) {
    return null;
  }

  return controlledRpcMessages.has(error.message) ? error.message : null;
}

function logRoadmapProblemSaveError(error: DatabaseError) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.error("Roadmap problem save error", {
    operation: "create_user_problem_with_timezone",
    code: error.code ?? null,
    message: error.message ?? null,
  });
}

export async function addRoadmapProblemAction(formData: FormData) {
  const returnTo = getReturnPath(formData);
  const roadmapSlug = getTrimmedStringField(formData, "roadmap_slug");
  const timeZone = normalizeTimeZone(
    getTrimmedStringField(formData, "time_zone"),
  );
  const roadmapProblem = neetcode150Problems.find(
    (problem) => problem.slug === roadmapSlug,
  );

  if (!roadmapProblem) {
    redirect(`${returnTo}?error=invalid_roadmap_problem`);
  }

  if (!isValidTimeZone(timeZone)) {
    redirect(`${returnTo}?error=invalid_time_zone`);
  }

  const startDate = getDateOnlyInTimeZone(new Date(), timeZone);

  if (!startDate) {
    redirect(`${returnTo}?error=invalid_date`);
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/sign-in");
  }

  const { error } = await createUserProblem(supabase, {
    p_leetcode_slug: roadmapProblem.slug,
    p_leetcode_url: roadmapProblem.leetcode_url,
    p_title: roadmapProblem.title,
    p_difficulty: roadmapProblem.difficulty,
    p_pattern: roadmapProblem.pattern,
    p_notes: "",
    p_start_mode: "scheduled",
    p_rating: "good",
    p_start_date: startDate,
    p_time_zone: timeZone,
  });

  if (error) {
    logRoadmapProblemSaveError(error);

    const controlledMessage = getControlledRpcMessage(error);

    if (controlledMessage === "not_authenticated") {
      redirect("/sign-in");
    }

    if (controlledMessage === "duplicate_problem") {
      redirect(`${returnTo}?error=already_added`);
    }

    if (controlledMessage === "invalid_time_zone") {
      redirect(`${returnTo}?error=invalid_time_zone`);
    }

    if (controlledMessage === "invalid_date") {
      redirect(`${returnTo}?error=invalid_date`);
    }

    redirect(`${returnTo}?error=save_failed`);
  }

  revalidatePath("/roadmaps/neetcode-150");
  revalidatePath("/dashboard");
  revalidatePath("/problems");
  redirect(`${returnTo}?message=roadmap_added`);
}
