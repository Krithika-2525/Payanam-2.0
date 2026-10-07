import { test, expect } from "@playwright/test";

test("plan, save, reload and compare a delayed journey using the real API", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Plan my journey", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Make room for what matters." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Build my itinerary", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your day, thoughtfully arranged." }),
  ).toBeVisible();
  await expect(
    page
      .getByText("No tickets or transport are booked.", { exact: false })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save journey", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: /Saved journeys/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Open itinerary" }).first().click();
  await page
    .getByRole("button", { name: "Explore a delay", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Compare alternatives", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A change of plan. The same purpose." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Keep original", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your day, thoughtfully arranged." }),
  ).toBeVisible();
});

test("API failure preserves preferences and never fabricates a plan", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Plan my journey", exact: true })
    .click();
  await page.getByLabel("Group transport budget").fill("4200");
  await page.route("**/api/v1/plans/preview", (route) => route.abort());
  await page
    .getByRole("button", { name: "Build my itinerary", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("reach");
  await expect(page.getByLabel("Group transport budget")).toHaveValue("4200");
});

test("mobile planning fits the viewport and remains accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Plan my journey", exact: true })
    .click();
  await expect(page.getByLabel("Departure time")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page
    .getByRole("button", { name: "Build my itinerary", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your day, thoughtfully arranged." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("invalid import is rejected without corrupting saved journeys", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /Saved journeys/ })
    .first()
    .click();
  await page.getByLabel("Import journey").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schema_version":99}'),
  });
  await expect(page.getByRole("alert")).toContainText("valid Payanam");
});

test("import rejects a fabricated successful itinerary", async ({ page }) => {
  await page.goto("/");
  const response = await page.request.post(
    "http://127.0.0.1:8000/api/v1/plans/preview",
    { data: { date: "2026-10-12" } },
  );
  const plan = await response.json();
  plan.stops = [];
  plan.finish_min = 0;
  plan.total_cost_inr = 0;
  plan.total_travel_minutes = 0;
  await page
    .getByRole("button", { name: /Saved journeys/ })
    .first()
    .click();
  await page.getByLabel("Import journey").setInputFiles({
    name: "fabricated.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ kind: "payanam-journey", version: 1, plan }),
    ),
  });
  await expect(page.getByRole("alert")).toContainText("valid Payanam");
});

test("delay dialog contains focus and restores it on Escape", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Plan my journey", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Build my itinerary", exact: true })
    .click();
  const trigger = page.getByRole("button", {
    name: "Explore a delay",
    exact: true,
  });
  await trigger.click();
  await expect(
    page.getByRole("button", { name: "Close delay comparison" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(
      () => !!document.activeElement?.closest('[role="dialog"]'),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("homepage search carries traveler choices into the real itinerary", async ({
  page,
}) => {
  test.setTimeout(12000);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your next great day starts here." }),
  ).toBeVisible({ timeout: 2000 });
  await page.getByLabel("Journey date").fill("2026-10-18");
  await page.getByLabel("Travelers", { exact: true }).fill("5");
  await page.getByLabel("Group transport budget").fill("4200");
  await page.getByLabel("Finish by", { exact: true }).fill("18:00");
  await page
    .getByRole("button", { name: "Plan my journey", exact: true })
    .click();
  await expect(page.getByLabel("Travelers", { exact: true })).toHaveValue("5");
  await expect(page.getByLabel("Journey date")).toHaveValue("2026-10-18");
  const response = page.waitForResponse("**/api/v1/plans/preview");
  await page
    .getByRole("button", { name: "Build my itinerary", exact: true })
    .click();
  const result = await (await response).json();
  expect(result.feasible).toBe(true);
  expect(result.request).toMatchObject({
    party_size: 5,
    budget_inr: 4200,
    end_time: "18:00",
    date: "2026-10-18",
  });
  await expect(
    page.getByRole("heading", { name: "Your day, thoughtfully arranged." }),
  ).toBeVisible();
});

test("journey filters and heritage preset select the intended places", async ({
  page,
}) => {
  test.setTimeout(12000);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Art & history", exact: true })
    .click({ timeout: 2000 });
  await expect(
    page.getByRole("button", { name: /A city with a story/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Sacred & slow/ })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: /A city with a story/ }).click();
  await expect(
    page.getByLabel("Priority for Thirumalai Nayakkar Palace"),
  ).toHaveValue("required");
  await expect(
    page.getByLabel("Priority for Gandhi Memorial Museum"),
  ).toHaveValue("required");
  await expect(
    page.getByLabel("Priority for Meenakshi Amman Temple"),
  ).toHaveValue("skip");
});

test("Tamil navigation fits a narrow mobile screen on every page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Switch Tamil place names and navigation" })
    .click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  await page
    .getByRole("button", { name: "பயணத்தைத் திட்டமிடுக", exact: true })
    .click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  await page
    .getByRole("button", { name: "சேமித்த பயணங்கள்", exact: true })
    .click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
});
