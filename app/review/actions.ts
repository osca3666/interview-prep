"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  submitProblemReview,
  type ReviewRating,
} from "@/data/reviews";
import { createClient } from "@/lib/supabase/server";

const validRatings = new Set<ReviewRating>(["again", "hard", "good", "easy"]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const controlledRpcMessages = new Set([
  "stale_review",
  "problem_not_due",
  "invalid_rating",
  "not_authenticated",
]);

type DatabaseError = {
  code?: string;
  message?: string;
};

function getStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function parseExpectedVersion(value: string) {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function getControlledRpcMessage(error: DatabaseError) {
  if (error.code !== "P0001" || !error.message) {
    return null;
  }

  return controlledRpcMessages.has(error.message) ? error.message : null;
}

function logReviewError(error: DatabaseError) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.error("Review submission error", {
    operation: "submit_problem_review",
    code: error.code ?? null,
    message: error.message ?? null,
  });
}

export async function submitReviewAction(formData: FormData) {
  const userProblemId = getStringField(formData, "user_problem_id");
  const rating = getStringField(formData, "rating") as ReviewRating;
  const expectedScheduleVersion = parseExpectedVersion(
    getStringField(formData, "expected_schedule_version"),
  );

  if (
    !uuidPattern.test(userProblemId) ||
    !validRatings.has(rating) ||
    expectedScheduleVersion === null
  ) {
    redirect("/review?error=invalid_submission");
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
    logReviewError(error);

    const controlledMessage = getControlledRpcMessage(error);

    if (controlledMessage === "not_authenticated") {
      redirect("/sign-in");
    }

    if (controlledMessage) {
      redirect(`/review?error=${controlledMessage}`);
    }

    redirect("/review?error=save_failed");
  }

  revalidatePath("/review");
  revalidatePath("/problems");
  redirect("/review?message=reviewed");
}
