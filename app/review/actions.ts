"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  submitProblemReview,
  snoozeProblemReview,
  type ReviewRating,
} from "@/data/reviews";
import {
  getStringField,
  getTrimmedStringField,
  isUuid,
  parseExpectedVersion,
} from "@/lib/form-data";
import { createClient } from "@/lib/supabase/server";

import {
  isValidTimeZone,
  normalizeTimeZone,
} from "@/lib/time-zone";

const validRatings = new Set<ReviewRating>(["again", "hard", "good", "easy"]);
const controlledRpcMessages = new Set([
  "stale_review",
  "problem_not_due",
  "invalid_rating",
  "invalid_submission",
  "invalid_time_zone",
  "not_found",
  "not_authenticated",
  "problem_not_active",
]);
const allowedReturnPaths = new Set(["/dashboard"]);

type DatabaseError = {
  code?: string;
  message?: string;
};

function getReturnPath(formData: FormData) {
  const value = getStringField(formData, "return_to");
  return allowedReturnPaths.has(value) ? value : "/dashboard";
}

function getControlledRpcMessage(error: DatabaseError) {
  if (error.code !== "P0001" || !error.message) {
    return null;
  }

  return controlledRpcMessages.has(error.message) ? error.message : null;
}

function logReviewError(operation: string, error: DatabaseError) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.error("Review action error", {
    operation,
    code: error.code ?? null,
    message: error.message ?? null,
  });
}

export async function submitReviewAction(formData: FormData) {
  const returnTo = getReturnPath(formData);
  const userProblemId = getStringField(formData, "user_problem_id");
  const rating = getStringField(formData, "rating") as ReviewRating;
  const expectedScheduleVersion = parseExpectedVersion(
    getStringField(formData, "expected_schedule_version"),
  );

  if (
    !isUuid(userProblemId) ||
    !validRatings.has(rating) ||
    expectedScheduleVersion === null
  ) {
    redirect(`${returnTo}?error=invalid_submission`);
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !data?.claims?.sub) {
    redirect("/sign-in");
  }

  const { error } = await submitProblemReview(supabase, {
    userProblemId,
    rating,
    expectedScheduleVersion,
  });

  if (error) {
    logReviewError("submit_problem_review", error);

    const controlledMessage = getControlledRpcMessage(error);

    if (controlledMessage === "not_authenticated") {
      redirect("/sign-in");
    }

    if (controlledMessage) {
      redirect(`${returnTo}?error=${controlledMessage}`);
    }

    redirect(`${returnTo}?error=save_failed`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/problems");
  redirect(`${returnTo}?message=reviewed`);
}

export async function snoozeReviewAction(formData: FormData){
  const returnTo = getReturnPath(formData);
  const userProblemId = getStringField(formData, "user_problem_id");
  const expectedScheduleVersion = parseExpectedVersion(
    getStringField(formData, "expected_schedule_version"),
  );
  const timeZone = normalizeTimeZone(
    getTrimmedStringField(formData, "time_zone"),
  );

  // Validating submitted fields
  if (!isUuid(userProblemId) || expectedScheduleVersion === null) {
    redirect(`${returnTo}?error=invalid_submission`);
  }
  if (!timeZone || !isValidTimeZone(timeZone)) {
    redirect(`${returnTo}?error=invalid_time_zone`);
  }

  // Auth 
  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (claimsError || !userId) {
    redirect("/sign-in")
  }

  // Call snoozeProblemReview RPC
  const { error } = await snoozeProblemReview(supabase, {
    userProblemId,
    timeZone,
    expectedScheduleVersion
  });

  if (error) {
    logReviewError("snooze_problem_review", error);

    const controlledMessage = getControlledRpcMessage(error);

    if (controlledMessage === "not_authenticated") {
      redirect("/sign-in");
    }

    if (controlledMessage) {
      redirect(`${returnTo}?error=${controlledMessage}`);
    }

    redirect(`${returnTo}?error=save_failed`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/problems");
  redirect(`${returnTo}?message=snoozed`);
}
