import { expect, test } from "@playwright/test";

const TEST_COURSE_TITLE = "Engineering Stress Test";
const TEST_TOPIC_TITLE = "Structural Integrity";

const useEmulator = process.env.TSA_E2E_USE_EMULATOR === "true";
const email = process.env.TSA_E2E_EMAIL ?? (useEmulator ? "e2e@demo-tsa.local" : "");
const password = process.env.TSA_E2E_PASSWORD ?? (useEmulator ? "e2e-password-123456" : "");

test.beforeAll(async () => {
  if (!useEmulator) {
    return;
  }
  const { waitForPort } = await import("./wait-for-port");
  await waitForPort("127.0.0.1", 9099);
  await waitForPort("127.0.0.1", 8080);
  const { seedFirebaseEmulatorsForE2E } = await import("./emulator-seed");
  await seedFirebaseEmulatorsForE2E();
});

test("critical path smoke test", async ({ page }) => {
  test.skip(
    !email || !password,
    "Set TSA_E2E_EMAIL and TSA_E2E_PASSWORD, or run npm run test:e2e:emulator (uses local Auth/Firestore emulators + tests/e2e/env.emulator).",
  );

  await page.goto("/auth");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.goto("/courses");
  await expect(page.getByRole("heading", { name: "Course Cards" })).toBeVisible();

  await page.getByPlaceholder("Course title").fill(TEST_COURSE_TITLE);
  await page.getByPlaceholder("Code (optional)").fill("E2E-001");
  await page.getByPlaceholder("Lecturer name").fill("Automation");
  await page.getByRole("button", { name: "Create course" }).click();

  const courseCard = page.locator("article", { hasText: TEST_COURSE_TITLE }).first();
  await expect(courseCard).toBeVisible();
  await courseCard.getByRole("link", { name: "Open syllabus" }).click();

  await page.getByPlaceholder("Add topic (e.g. Thermodynamics)").fill(TEST_TOPIC_TITLE);
  await page.getByRole("button", { name: "Add topic" }).click();
  await expect(page.getByText(TEST_TOPIC_TITLE)).toBeVisible();

  await page.getByRole("combobox").first().selectOption("taught");

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Get a tailored next step" }).click();
  await expect(page.getByText("Study mission")).toBeVisible();

  await page.goto("/courses");
  const freshCourseCard = page.locator("article", { hasText: TEST_COURSE_TITLE }).first();
  await freshCourseCard.getByRole("button", { name: "Edit course" }).click();
  await freshCourseCard.getByRole("button", { name: "Delete" }).click();
  await expect(page.locator("article", { hasText: TEST_COURSE_TITLE })).toHaveCount(0);
});
