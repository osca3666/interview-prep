import { expect, test } from "@playwright/test";
import {
  createDisposableUser,
  createLocalAdminClient,
  deleteDisposableUser,
} from "./helpers/local-supabase";

const admin = createLocalAdminClient();
const mailpitOrigin = (() => {
  const rawUrl = process.env.E2E_MAILPIT_URL;
  if (!rawUrl) throw new Error("Missing local Mailpit URL.");
  const url = new URL(rawUrl);
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "54124"
  ) {
    throw new Error("Refusing a non-local Mailpit URL.");
  }
  return url.origin;
})();
let recoveryUser: Awaited<ReturnType<typeof createDisposableUser>>;

type MailpitAddress = { Address?: string; address?: string };
type MailpitMessageSummary = {
  ID?: string;
  id?: string;
  To?: MailpitAddress[];
  to?: MailpitAddress[];
};

type MailpitListResponse = {
  messages?: MailpitMessageSummary[];
  Messages?: MailpitMessageSummary[];
};

type MailpitMessage = {
  HTML?: string;
  Text?: string;
  html?: string;
  text?: string;
};

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#x3D;", "=")
    .replaceAll("=\r\n", "")
    .replaceAll("=\n", "");
}

function extractRecoveryLink(message: MailpitMessage) {
  const body = decodeHtml(
    message.HTML ?? message.html ?? message.Text ?? message.text ?? "",
  );
  const links = body.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
  const recoveryLink = links.find((link) => link.includes("/auth/v1/verify"));

  if (!recoveryLink) {
    throw new Error("Mailpit recovery email did not contain a verification link.");
  }

  return recoveryLink;
}

async function findRecoveryLink(email: string) {
  const listResponse = await fetch(`${mailpitOrigin}/api/v1/messages`);
  if (!listResponse.ok) return null;
  const list = (await listResponse.json()) as MailpitListResponse;
  const messages = list.messages ?? list.Messages ?? [];
  const summary = messages.find((message) => {
    const recipients = message.To ?? message.to ?? [];
    return recipients.some(
      (recipient) =>
        (recipient.Address ?? recipient.address)?.toLowerCase() ===
        email.toLowerCase(),
    );
  });
  const id = summary?.ID ?? summary?.id;
  if (!id) return null;
  const messageResponse = await fetch(
    `${mailpitOrigin}/api/v1/message/${encodeURIComponent(id)}`,
  );
  if (!messageResponse.ok) return null;
  return extractRecoveryLink((await messageResponse.json()) as MailpitMessage);
}

async function getRecoveryLink(email: string) {
  await expect
    .poll(() => findRecoveryLink(email), { timeout: 20_000 })
    .not.toBeNull();
  const link = await findRecoveryLink(email);
  if (!link) throw new Error("Mailpit recovery message disappeared.");
  return link;
}

test.describe.serial("password recovery", () => {
  test.beforeAll(async () => {
    recoveryUser = await createDisposableUser(admin, "password-recovery");
  });

  test.afterAll(async () => {
    await deleteDisposableUser(admin, recoveryUser?.id);
  });

  test("forgot-password response does not reveal account existence", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await page.getByLabel("Email").fill(`missing-${crypto.randomUUID()}@example.test`);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "If an account exists for that email, we sent a password reset link.",
    );
  });

  test("invalid callback codes show safe failure states", async ({ page }) => {
    await page.goto("/auth/callback?flow=confirmation&code=invalid-code");
    await expect(page).toHaveURL(/\/sign-in\?error=confirmation_failed$/);
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();

    await page.goto("/auth/callback?flow=recovery&code=invalid-code");
    await expect(page).toHaveURL(/\/reset-password\?error=invalid_recovery$/);
    await expect(
      page.getByText(
        "This reset link is invalid or has expired. Request a new one.",
        { exact: true },
      ),
    ).toBeVisible();
  });

  test("the recovery marker cannot authorize a reset without a Supabase session", async ({
    context,
    page,
  }) => {
    await page.goto("/sign-in");
    const origin = new URL(page.url()).origin;
    await context.addCookies([
      {
        name: "interviewprep-password-recovery",
        value: "active",
        url: `${origin}/reset-password`,
        httpOnly: true,
        sameSite: "Lax",
        secure: false,
      },
    ]);

    await page.goto("/reset-password");
    await expect(
      page.getByText(
        "This reset link is invalid or has expired. Request a new one.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Update password" }),
    ).toHaveCount(0);
  });

  test("recovery email updates the password through the server callback", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(recoveryUser.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText(
      "If an account exists",
    );

    const recoveryLink = await getRecoveryLink(recoveryUser.email);
    await page.goto(recoveryLink);
    await expect(page).toHaveURL(/\/reset-password$/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: "Choose a new password" }),
    ).toBeVisible();

    await page.getByLabel("New password", { exact: true }).fill("Updated-password-1!");
    await page.getByLabel("Confirm new password").fill("Updated-password-2!");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(
      page.getByText("The passwords do not match.", { exact: true }),
    ).toBeVisible();

    await page.getByLabel("New password", { exact: true }).fill("Updated-password-1!");
    await page.getByLabel("Confirm new password").fill("Updated-password-1!");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(
      page.getByRole("heading", { name: "Password updated" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Back to sign in" }).click();
    await page.getByLabel("Email").fill(recoveryUser.email);
    await page.getByLabel("Password").fill(recoveryUser.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText(/email or password/i)).toBeVisible();

    await page.getByLabel("Email").fill(recoveryUser.email);
    await page.getByLabel("Password").fill("Updated-password-1!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/, { timeout: 20_000 });
  });
});
