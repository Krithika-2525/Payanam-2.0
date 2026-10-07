import { test, expect } from "@playwright/test";

test("selected real city becomes a multi-day itinerary, travel tools survive save and reload", async ({
  page,
}) => {
  test.setTimeout(60000);
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page.getByLabel("Search destinations").fill("Madurai");
  await page
    .getByRole("button", { name: "Search cities", exact: true })
    .click();
  await page
    .getByTestId("place-card")
    .first()
    .getByRole("button", { name: "Explore & plan" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Explore Madurai", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("hotspot-card").first()).toContainText(
    "OpenStreetMap",
  );
  await page.getByLabel("Number of days").selectOption("2");
  await page
    .getByRole("button", { name: "Generate itinerary", exact: true })
    .click();
  await expect(page.getByTestId("scheduled-stop").first()).toBeVisible();
  await expect(
    page.getByText("Estimated travel", { exact: false }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Budget & packing", exact: true })
    .click();
  await page.getByLabel("Trip budget").fill("3000");
  await page.getByLabel("Expense description").fill("Train ticket");
  await page.getByLabel("Expense amount").fill("450");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await expect(page.getByText("Train ticket", { exact: true })).toBeVisible();
  await page.getByLabel("Water bottle", { exact: true }).check();
  await page
    .getByRole("button", { name: "Keep draft on this device", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "My trips", exact: true }).click();
  await page
    .getByRole("button", { name: "Open trip", exact: true })
    .first()
    .click();
  await expect(page.getByTestId("scheduled-stop").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Budget & packing", exact: true })
    .click();
  await expect(page.getByText("Train ticket", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Water bottle", { exact: true })).toBeChecked();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export calendar", exact: true })
    .click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.ics$/);
});

test("mobile city planner fits viewport and editing invalidates generated times", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByLabel("Search destinations").fill("Madurai");
  await page
    .getByRole("button", { name: "Search cities", exact: true })
    .click();
  await page
    .getByTestId("place-card")
    .first()
    .getByRole("button", { name: "Explore & plan" })
    .click();
  await page
    .getByRole("button", { name: "Generate itinerary", exact: true })
    .click();
  await expect(page.getByTestId("scheduled-stop").first()).toBeVisible();
  await page
    .getByTestId("scheduled-stop")
    .first()
    .getByRole("button", { name: /Remove / })
    .click();
  await expect(
    page.getByText(
      "Your stops changed. Recalculate times before exporting a calendar.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await expect(
    page.getByRole("button", { name: "Export calendar", exact: true }),
  ).toBeDisabled();
});

test("portable JSON reopens a private-free copy and calendar uses destination timezone", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Search destinations").fill("Madurai");
  await page
    .getByRole("button", { name: "Search cities", exact: true })
    .click();
  await page
    .getByTestId("place-card")
    .first()
    .getByRole("button", { name: "Explore & plan" })
    .click();
  await page
    .getByRole("button", { name: "Generate itinerary", exact: true })
    .click();
  await expect(page.getByTestId("scheduled-stop").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Keep draft on this device", exact: true })
    .click();
  const original = await page.evaluate(
    () => JSON.parse(localStorage.getItem("payanam.drafts.v2") || "[]")[0],
  );
  const exported = {
    kind: "payanam-draft",
    version: 2,
    draft: {
      ...original,
      cloud_id: "foreign-cloud",
      cloud_owner: "foreign-owner",
    },
  };
  await page.getByRole("button", { name: "My trips", exact: true }).click();
  await page.getByLabel("Import trip JSON", { exact: true }).setInputFiles({
    name: "my-trip.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(page.getByTestId("scheduled-stop").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Keep draft on this device", exact: true })
    .click();
  const imported = await page.evaluate(
    () => JSON.parse(localStorage.getItem("payanam.drafts.v2") || "[]")[0],
  );
  expect(imported.id).not.toBe(original.id);
  expect(imported.cloud_id).toBeUndefined();
  expect(imported.cloud_owner).toBeUndefined();
  const calendar = await page.evaluate(async () => {
    const m = await import("/src/travel/planner.ts");
    const d = JSON.parse(localStorage.getItem("payanam.drafts.v2") || "[]")[0];
    d.items[0].notes = "Train, temple; water\nRemember";
    return m.calendar(d);
  });
  expect(calendar).toContain("DTSTART;TZID=Asia/Kolkata:");
  expect(calendar).toContain("BEGIN:VEVENT");
  expect(calendar).toContain("Train\\, temple\\; water\\nRemember");
});

test("invalid imported facts, currencies and schedules are rejected safely", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Search destinations").fill("Madurai");
  await page
    .getByRole("button", { name: "Search cities", exact: true })
    .click();
  await page
    .getByTestId("place-card")
    .first()
    .getByRole("button", { name: "Explore & plan" })
    .click();
  await page
    .getByRole("button", { name: "Generate itinerary", exact: true })
    .click();
  await expect(page.getByTestId("scheduled-stop").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Keep draft on this device", exact: true })
    .click();
  const results = await page.evaluate(async () => {
    const { validDraft } = await import("/src/travel/drafts.ts");
    const draft = JSON.parse(localStorage.getItem("payanam.drafts.v2")!)[0];
    return [
      validDraft(draft),
      validDraft({
        ...draft,
        items: draft.items.map((i, index) =>
          index
            ? i
            : { ...i, place: { ...i.place, opening_hours: { bad: "object" } } },
        ),
      }),
      validDraft({
        ...draft,
        metadata: { ...draft.metadata, currency: "not-currency" },
      }),
      validDraft({
        ...draft,
        metadata: { ...draft.metadata, timezone: "invalid-zone" },
      }),
      validDraft({
        ...draft,
        metadata: { ...draft.metadata, end_date: "2020-01-01" },
      }),
      validDraft({
        ...draft,
        metadata: {
          ...draft.metadata,
          planning: {
            ...draft.metadata.planning,
            visits: [
              { ...draft.metadata.planning.visits[0], departure: "06:00" },
            ],
          },
        },
      }),
    ];
  });
  expect(results).toEqual([true, false, false, false, false, false]);
  const bad = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("payanam.drafts.v2")!)[0];
    d.items[0].place.opening_hours = { bad: "object" };
    return { kind: "payanam-draft", version: 2, draft: d };
  });
  await page.getByRole("button", { name: "My trips", exact: true }).click();
  await page
    .getByLabel("Import trip JSON", { exact: true })
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(bad)),
    });
  await expect(page.getByText(/valid Payanam/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "My trips", exact: true }),
  ).toBeVisible();
});

test("personal controls stay locked while generation is pending", async ({
  page,
}) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page.getByLabel("Search destinations").fill("Madurai");
  await page
    .getByRole("button", { name: "Search cities", exact: true })
    .click();
  await page
    .getByTestId("place-card")
    .first()
    .getByRole("button", { name: "Explore & plan" })
    .click();
  await page
    .getByRole("button", { name: "Generate itinerary", exact: true })
    .click();
  await expect(page.getByTestId("scheduled-stop").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Budget & packing", exact: true })
    .click();
  await page.getByLabel("Trip budget").fill("1000");
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/itineraries/generate", async (route) => {
    const response = await route.fetch();
    await blocked;
    await route.fulfill({ response });
  });
  await page
    .getByRole("button", { name: "Generate itinerary", exact: true })
    .click();
  await expect(page.getByLabel("Trip budget")).toBeDisabled();
  await expect(page.getByLabel("Expense description")).toBeDisabled();
  await expect(page.getByLabel("Water bottle", { exact: true })).toBeDisabled();
  release();
  await expect(page.getByTestId("scheduled-stop").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Budget & packing", exact: true })
    .click();
  await expect(page.getByLabel("Trip budget")).toHaveValue("1000");
});
