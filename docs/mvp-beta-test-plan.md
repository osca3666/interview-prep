# MVP Beta Test Plan

## MVP Summary

LeetCode Review is a lightweight roadmap-based spaced-repetition tracker for LeetCode practice. The MVP helps a user save problems, preview imported LeetCode history, follow a built-in roadmap, review due problems, and track progress over time.

The main workspace is `/dashboard`. The supporting Library page is `/problems`.

Estimated tester time: 10-15 minutes.

## What The App Currently Does

- Supports email/password sign up and sign in.
- Shows `/dashboard` as the main review workspace.
- Lets users track LeetCode problems from the dashboard `Track Problem` modal.
- Lets users track LeetCode problems from `/problems`, the Library page.
- Lets users preview pasted LeetCode Practice History text from `/problems/import`.
- Shows a NeetCode 150 roadmap checklist/planning page at `/roadmaps/neetcode-150`.
- Lets users start one untracked roadmap problem for today from the roadmap page.
- Supports two Track Problem starting states:
  - `I practiced this problem`: counts as the first review/practice event.
  - `I have not practiced it yet`: schedules the first review without counting practice.
- Tracks due problems in the `Ready to review` section.
- Lets users rate reviews with:
  - `Redo`: retry soon, backend value `"again"`.
  - `OK`: normal progress, backend value `"good"`.
  - `Great`: faster progress, backend value `"easy"`.
- Lets users use `Skip today` on a due problem without counting it as a review.
- Shows a compact recent-problems preview on the dashboard.
- Shows tracked problems in the Library page using the shared Progress table.
- Shows the all-category LeetCode catalog in the Library page.
- Supports dark/light theme switching.
- Shows toast feedback for success and common errors.

## What Is Intentionally Not Included Yet

The beta should not be evaluated as if these features exist:

- Confirm/import saved LeetCode history to the database
- Bulk import persistence
- Goal planning
- AI coach
- Calendar
- Editing, archiving, or deleting problems
- Payments
- Public roadmap publishing
- Custom or shared roadmaps

## Tester Script

Use this script for each first-pass beta test session.

### 1. Account Setup

1. Open the app.
2. Create an account from `Sign up`.
3. Sign out.
4. Sign back in.
5. Confirm you land on `/dashboard`.

Expected result: auth works, the dashboard loads, and the nav shows signed-in controls.

### 2. Track A Practiced Problem From Dashboard

1. On `/dashboard`, click `Track Problem`.
2. Select a LeetCode problem.
3. Enter optional notes.
4. Choose `I practiced this problem`.
5. Keep practice date as today.
6. Choose `OK`.
7. Submit.

Expected result: modal submission succeeds, a toast appears, and the problem appears in Progress.

### 3. Track A Scheduled Problem From Dashboard

1. Click `Track Problem` again.
2. Add a different valid LeetCode problem.
3. Choose `I have not practiced it yet`.
4. Keep first review date as today or choose a future date.
5. Submit.

Expected result: the problem is added. If scheduled for today, it should be ready to review. If scheduled for the future, it should not appear in Ready to review yet.

### 4. Review A Ready Problem

1. Find a problem in `Ready to review`.
2. Open the LeetCode title link if desired.
3. Submit one review rating:
   - `Redo`
   - `OK`
   - or `Great`
4. Watch for the success toast.
5. Confirm the problem leaves the ready list if it is no longer due.

Expected result: review saves, the due queue updates, and Progress updates the review count, last reviewed date, next review date, and mastery.

### 5. Check Library

1. Open `/problems` from the nav.
2. Confirm the page is titled `Problem library`.
3. Track a problem using the page-level `Track Problem` modal.
4. Confirm the tracked problems table updates.
5. Use the Tracked table search to find a problem by title, problem number, difficulty, or topic.
6. Switch to `All LeetCode`.
7. Search the catalog by problem number, title, difficulty, topic, or category.

Expected result: Library works as a supporting tracked-problem browser and catalog view.

### 6. Preview LeetCode Practice History Import

1. Open `/problems/import` from the Library import link.
2. Open the linked LeetCode Practice History page.
3. Paste copied Practice History text into the textarea.
4. Click `Preview import`.
5. Review the Ready to import as practiced, Ready to schedule, Already in Library, Unmatched, and Duplicate rows removed sections.
6. Confirm the import/confirm button is disabled or clearly marked as coming next.

Expected result: the page previews parsed history and Library matches without saving anything to the database.

### 7. Check NeetCode 150 Roadmap

1. Open `/roadmaps/neetcode-150`.
2. Search for a known problem.
3. Confirm the table shows roadmap order, problem, pattern, difficulty, and next step.
4. Find an untracked problem and click `Start today`.
5. Confirm a success message appears.
6. Confirm the problem appears in Library or dashboard progress.
7. Confirm tracked roadmap rows show non-mutating labels such as `Scheduled`, `Reviewed`, or `Strong`.

Expected result: roadmap rows reflect current Library coverage, and `Start today` adds one untracked problem without changing review history.

### 8. Check Theme

1. Toggle between dark and light mode.
2. Refresh the page.
3. Confirm the selected theme persists.
4. Check `/dashboard`, `/problems`, `/problems/import`, `/roadmaps/neetcode-150`, and sign-in/sign-up pages.

Expected result: the app remains readable and usable in both themes.

## Manual QA Checklist

### Auth

- [ ] New user can sign up.
- [ ] Existing user can sign in.
- [ ] Signed-in user can sign out.
- [ ] Signed-out user is redirected to sign in for protected pages.

### Dashboard

- [ ] `/dashboard` loads without errors.
- [ ] `Ready to review` shows due/overdue problems only.
- [ ] Empty ready state says the user is caught up.
- [ ] `Track Problem` opens a modal.
- [ ] Modal closes with the close button.
- [ ] Modal closes with backdrop click.
- [ ] Modal closes with Escape.
- [ ] Recent problems preview shows at most five rows.
- [ ] `View all problems` links to `/problems`.

### Track Problem

- [ ] Practiced mode defaults to today and `OK`.
- [ ] Practiced mode rejects future practice dates.
- [ ] Scheduled mode defaults to today.
- [ ] Scheduled mode handles today and future review dates correctly.
- [ ] Duplicate problem shows the existing duplicate error.
- [ ] Track from dashboard returns to `/dashboard`.
- [ ] Track from Library returns to `/problems`.

### Review Flow

- [ ] `Redo` submits backend rating `"again"`.
- [ ] `OK` submits backend rating `"good"`.
- [ ] `Great` submits backend rating `"easy"`.
- [ ] `Skip today` is visually separate from review ratings.
- [ ] `Skip today` removes a due problem from today's queue.
- [ ] `Skip today` does not increase review count.
- [ ] `Skip today` does not change mastery.
- [ ] Review success shows a toast.
- [ ] Stale or invalid review states show a safe error.
- [ ] Review cards do not show pattern, topics, notes, mastery, or review count.

### Library

- [ ] `/problems` loads as `Problem library`.
- [ ] Track Problem modal works.
- [ ] Tracked problems display in the shared Progress table.
- [ ] Search works in the Library Progress table.
- [ ] All LeetCode catalog search works by number, title, difficulty, topic, or category.
- [ ] Catalog row Track action opens the Track Problem modal with the selected problem.
- [ ] Empty state is clear for a new user.

### Import Preview

- [ ] `/problems/import` is protected for signed-in users.
- [ ] The LeetCode Practice History link opens `https://leetcode.com/progress/`.
- [ ] Pasted full-page LeetCode text can be previewed.
- [ ] Accepted rows appear under Ready to import as practiced.
- [ ] Non-accepted-only rows appear under Ready to schedule.
- [ ] Duplicate rows are counted separately.
- [ ] Already-in-Library problems are separated from Ready to import and Ready to schedule.
- [ ] Invalid dates are visibly flagged but do not block preview.
- [ ] No database write happens from preview.
- [ ] Confirm import remains disabled or coming soon.

### Roadmap

- [ ] `/roadmaps/neetcode-150` is protected for signed-in users.
- [ ] Roadmap search filters by title, pattern, or difficulty.
- [ ] Untracked rows show `Start today`.
- [ ] `Start today` adds one scheduled problem for today.
- [ ] Tracked rows show non-mutating labels.
- [ ] Starting a roadmap problem revalidates dashboard and Library views.
- [ ] No batch import or full planner controls are shown.

### Data Isolation

- [ ] Create or use two separate test accounts.
- [ ] Add a problem in Account A.
- [ ] Sign out of Account A and sign in to Account B.
- [ ] Confirm Account B does not see Account A's problems, reviews, or progress.
- [ ] Add a different problem in Account B.
- [ ] Sign back in to Account A and confirm Account A still only sees its own data.

### Visual / Theme

- [ ] Dark mode is readable.
- [ ] Light mode is readable.
- [ ] Theme toggle persists after refresh.
- [ ] Toasts are readable in both themes.
- [ ] Internal scrollbars look acceptable.

## Feedback Questions For Test Users

1. What were you trying to do first after signing in?
2. Was it clear how to add a problem?
3. Was the difference between `I practiced this problem` and `I have not practiced it yet` clear?
4. Did `Redo`, `OK`, and `Great` match how you think about review outcomes?
5. Did the Ready to review list feel focused, or did you want more context?
6. Did the Library progress table help you understand what is happening over time?
7. Was anything confusing about dates, due status, or next review timing?
8. Did you expect to edit, archive, delete, snooze, or skip anything?
9. Did the LeetCode history import preview make sense before saving anything?
10. Did the NeetCode 150 roadmap help you decide what to do next?
11. Did the app feel too simple, too busy, or about right for a first version?
12. What is the one thing that would make this useful enough to keep using?

## Bug Report Template

Use this format for beta tester issues.

```md
## Summary

Short description of the issue.

## Steps To Reproduce

1.
2.
3.

## Expected Result

What did you expect to happen?

## Actual Result

What actually happened?

## Page / Route

Example: /dashboard, /problems, /sign-in

## Account State

Signed out / signed in / new account / existing account

## Browser And Device

Example: Chrome on Windows, Safari on iPhone

## Screenshot Or Screen Recording

Attach if possible.

## Notes

Any extra context, problem URL, or timing details.
```

## Known Non-Goals / Not-Yet-Built Features

These are intentionally outside the MVP beta scope:

- Confirm/import saved LeetCode history to the database
- Bulk import persistence
- Goal planning
- AI coach
- Calendar
- Editing/archiving/deleting problems
- Payments
- Public roadmap publishing
- Custom/shared roadmaps
