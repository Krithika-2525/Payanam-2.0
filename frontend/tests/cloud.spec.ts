import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("Google redirect preserves the consented draft without uploading it", async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.PAYANAM_BROWSER_DATABASE,
    "Needs the credential fixture API",
  );
  await context.route("http://127.0.0.1:8010/**", async (route) =>
    route.fulfill({
      response: await route.fetch({
        url: route.request().url().replace(":8010", ":8020"),
      }),
    }),
  );
  await context.route("https://identity.example/auth/v1/authorize**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<script>location.href="http://127.0.0.1:5180/"</script>',
    }),
  );
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await page.getByLabel("Search destinations").fill("Madurai");
  await page
    .getByRole("button", { name: "Search cities", exact: true })
    .click();
  await page
    .getByTestId("place-card")
    .first()
    .getByRole("button", { name: "Add to trip" })
    .click();
  await page.getByLabel("Trip title").fill("Before Google");
  await page
    .getByRole("button", { name: "Save to cloud", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(
    page.getByText(
      "Your draft was restored after sign-in. Choose Save to cloud to upload it.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Trip title")).toHaveValue("Before Google");
  await expect(
    page.getByText("Local draft · nothing is uploaded until you choose"),
  ).toBeVisible();
});

test("signed JWT saves survive response loss and reload; other account cannot access", async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(90000);
  test.skip(
    !process.env.PAYANAM_BROWSER_DATABASE,
    "Needs the local RSA fixture API and migrated Postgres",
  );
  const tokens = JSON.parse(
    readFileSync("/tmp/payanam-browser-tokens.json", "utf8"),
  );
  let account = "a",
    loseCreate = true;
  await context.route("http://127.0.0.1:8010/**", async (route) => {
    const url = route.request().url().replace(":8010", ":8020");
    const response = await route.fetch({ url });
    if (
      loseCreate &&
      route.request().method() === "POST" &&
      url.endsWith("/trips")
    ) {
      loseCreate = false;
      await route.abort();
      return;
    }
    await route.fulfill({ response });
  });
  await context.route("https://identity.example/auth/v1/**", async (route) => {
    const user = tokens[account];
    await route.fulfill({
      json: {
        access_token: user.token,
        refresh_token: "test-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: user.id,
          aud: "authenticated",
          role: "authenticated",
          email: account + "@example.test",
          app_metadata: { provider: "email" },
          user_metadata: {},
          created_at: new Date().toISOString(),
        },
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("Search destinations").fill("Madurai");
  await page
    .getByRole("button", { name: "Search cities", exact: true })
    .click();
  await page
    .getByTestId("place-card")
    .first()
    .getByRole("button", { name: "Add to trip" })
    .click();
  const title = "Cloud journey " + Date.now();
  await page.getByLabel("Trip title").fill(title);
  await page
    .getByRole("button", { name: "Keep draft on this device", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save to cloud", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill("a@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page
    .getByRole("button", { name: "Sign in to your account", exact: true })
    .click();
  await expect(
    page.getByText("Signed in. Choose Save to cloud to upload your draft."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save to cloud", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("could not reach");
  await page
    .getByRole("button", { name: "Retry cloud save", exact: true })
    .click();
  await expect(
    page.getByText("Trip saved privately to your account."),
  ).toBeVisible();
  const list = await request.get("http://127.0.0.1:8020/api/v2/trips", {
    headers: { Authorization: "Bearer " + tokens.a.token },
  });
  const trips = (await list.json()).trips.filter(
    (t: { title: string }) => t.title === title,
  );
  expect(trips).toHaveLength(1);
  expect(trips[0].items).toHaveLength(1);
  await page.reload();
  await page.getByRole("button", { name: "My trips", exact: true }).click();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  await page
    .locator(".saved-trip-card")
    .filter({ has: page.getByText(title, { exact: true }) })
    .first()
    .getByRole("button", { name: "Open trip" })
    .click();
  await page.getByLabel("Notes for Madurai").fill("Reopened local association");
  await page
    .getByRole("button", { name: "Save to cloud", exact: true })
    .click();
  await expect(
    page.getByText("Trip saved privately to your account."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page.getByLabel("Search destinations").fill("Paris");
  await page
    .getByRole("button", { name: "Search cities", exact: true })
    .click();
  await page
    .getByTestId("place-card")
    .first()
    .getByRole("button", { name: "Add to trip" })
    .click();
  await page
    .getByRole("button", { name: "Move Paris earlier", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save to cloud", exact: true })
    .click();
  await expect(
    page.getByText("Trip saved privately to your account."),
  ).toBeVisible();
  let current = await (
    await request.get("http://127.0.0.1:8020/api/v2/trips/" + trips[0].id, {
      headers: { Authorization: "Bearer " + tokens.a.token },
    })
  ).json();
  expect(
    current.items.map((i: { place: { name: string } }) => i.place.name),
  ).toEqual(["Paris", "Madurai"]);
  await page.getByLabel("End date", { exact: true }).fill("2026-10-09");
  await page.getByLabel("Day for Madurai", { exact: true }).selectOption("2");
  await page
    .getByRole("button", { name: "Save to cloud", exact: true })
    .click();
  await expect(
    page.getByText("Trip saved privately to your account."),
  ).toBeVisible();
  await page.getByRole("tab").nth(2).click();
  await page.getByLabel("Day for Madurai", { exact: true }).selectOption("0");
  await page.getByLabel("End date", { exact: true }).fill("2026-10-07");
  await page
    .getByRole("button", { name: "Save to cloud", exact: true })
    .click();
  await expect(
    page.getByText("Trip saved privately to your account."),
  ).toBeVisible();
  current = await (
    await request.get("http://127.0.0.1:8020/api/v2/trips/" + trips[0].id, {
      headers: { Authorization: "Bearer " + tokens.a.token },
    })
  ).json();
  expect(current.end_date).toBe("2026-10-07");
  expect(
    current.items.every((i: { day_index: number }) => i.day_index === 0),
  ).toBeTruthy();
  trips[0].version = current.version;
  const ownerExport = await request.get(
    "http://127.0.0.1:8020/api/v2/trips/" + trips[0].id + "/export",
    { headers: { Authorization: "Bearer " + tokens.a.token } },
  );
  expect(ownerExport.status()).toBe(200);
  expect(JSON.stringify(await ownerExport.json())).not.toContain(
    tokens.a.token,
  );
  const seed = [];
  for (let i = 0; i < 51; i++) {
    const r = await request.post("http://127.0.0.1:8020/api/v2/trips", {
      headers: {
        Authorization: "Bearer " + tokens.a.token,
        "Idempotency-Key": crypto.randomUUID(),
      },
      data: {
        title: "Paging " + title + " " + i,
        start_date: "2026-10-07",
        end_date: "2026-10-07",
      },
    });
    expect(r.status()).toBe(201);
    seed.push(await r.json());
  }
  await page.getByRole("button", { name: "My trips", exact: true }).click();
  await page
    .getByRole("button", { name: "Refresh cloud trips", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Load more trips", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Load more trips", exact: true })
    .click();
  await expect(
    page
      .locator(".trip-collection")
      .last()
      .getByText(new RegExp("^Paging " + title)),
  ).toHaveCount(51);
  for (const t of seed)
    expect(
      (
        await request.delete("http://127.0.0.1:8020/api/v2/trips/" + t.id, {
          headers: {
            Authorization: "Bearer " + tokens.a.token,
            "If-Match": '"1"',
          },
        })
      ).status(),
    ).toBe(204);
  await page
    .locator(".trip-collection")
    .last()
    .locator(".saved-trip-card")
    .filter({ has: page.getByText(title, { exact: true }) })
    .getByRole("button", { name: "Open trip" })
    .click();
  const remote = await request.patch(
    "http://127.0.0.1:8020/api/v2/trips/" + trips[0].id,
    {
      headers: {
        Authorization: "Bearer " + tokens.a.token,
        "Idempotency-Key": crypto.randomUUID(),
        "If-Match": '"' + trips[0].version + '"',
      },
      data: {
        kind: "update_metadata",
        metadata: {
          title: "Remote account A trip",
          start_date: "2026-10-07",
          end_date: "2026-10-07",
          timezone: "Asia/Kolkata",
          currency: "INR",
        },
      },
    },
  );
  expect(remote.status()).toBe(200);
  trips[0].version = (await remote.json()).version;
  await page.getByLabel("Notes for Madurai").fill("Preserve private edit");
  await page
    .getByRole("button", { name: "Save to cloud", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("changed elsewhere");
  let release!: () => void, prepared!: () => void;
  const pending = new Promise<void>((r) => (prepared = r)),
    gate = new Promise<void>((r) => (release = r));
  await context.route(
    "http://127.0.0.1:8010/api/v2/trips/" + trips[0].id,
    async (route) => {
      const response = await route.fetch({
        url: route.request().url().replace(":8010", ":8020"),
      });
      prepared();
      await gate;
      await route.fulfill({ response });
    },
  );
  await page
    .getByRole("button", { name: "Load cloud version", exact: true })
    .click();
  await pending;
  await page.evaluate(() => {
    localStorage.removeItem("sb-identity-auth-token");
    const channel = new BroadcastChannel("sb-identity-auth-token");
    channel.postMessage({ event: "SIGNED_OUT", session: null });
    channel.close();
  });
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }).first(),
  ).toBeVisible();
  const completed = page.waitForResponse((r) =>
    r.url().endsWith("/api/v2/trips/" + trips[0].id),
  );
  release();
  await completed;
  await expect(
    page.getByRole("heading", { name: "Start a journey.", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Trip title")).not.toBeVisible();
  await page.getByRole("button", { name: "My trips", exact: true }).click();
  await expect(
    page.locator(".trip-collection").last().getByText(title, { exact: true }),
  ).not.toBeVisible();
  account = "b";
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .first()
    .click();
  await page.getByLabel("Email", { exact: true }).fill("b@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page
    .getByRole("button", { name: "Sign in to your account", exact: true })
    .click();
  await expect(
    page.locator(".trip-collection").last().getByText(title, { exact: true }),
  ).not.toBeVisible();
  expect(
    (
      await request.get(
        "http://127.0.0.1:8020/api/v2/trips/" + trips[0].id + "/export",
        { headers: { Authorization: "Bearer " + tokens.b.token } },
      )
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.delete(
        "http://127.0.0.1:8020/api/v2/trips/" + trips[0].id,
        {
          headers: {
            Authorization: "Bearer " + tokens.a.token,
            "If-Match": '"' + trips[0].version + '"',
          },
        },
      )
    ).status(),
  ).toBe(204);
  const legacy = await request.post(
    "http://127.0.0.1:8020/api/v1/plans/preview",
    { data: { date: "2026-10-07" } },
  );
  page.on("dialog", (dialog) => dialog.accept());
  const envelope = {
    kind: "payanam-journey",
    version: 1,
    plan: await legacy.json(),
  };
  await page.getByLabel("Import legacy export").setInputFiles({
    name: "legacy.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(envelope)),
  });
  await expect(
    page.getByText(
      "Imported as illustrative legacy data. Original times and fares are not verified.",
    ),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export draft", exact: true }).click();
  const exported = await download;
  const payload = JSON.parse(readFileSync((await exported.path())!, "utf8"));
  expect(payload.draft.items).toHaveLength(0);
  expect(payload.export_note).toContain("unqualified");
  expect(JSON.stringify(payload)).not.toContain(tokens.b.token);
});
