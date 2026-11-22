import { expect, test, type Page } from "@playwright/test";

const PASS = process.env.E2E_PASSPHRASE ?? "e2e-heslo";

async function login(page: Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Heslo").fill(PASS);
  await page.getByRole("button", { name: "Vstoupit" }).click();
  await expect(startButton(page)).toBeVisible();
}

/** "Začít" / "Pokračovat", or "Pokračovat s novými poznatky" once the daily goal is met (tests share one database). */
const startButton = (page: Page) => page.getByRole("button", { name: /^(Začít|Pokračovat)/ }).first();

/** Answer whatever card is on screen. Returns a label of what was done, or null at the end of the session. */
async function answerCard(page: Page): Promise<string | null> {
  const btn = (name: string) => page.getByRole("button", { name, exact: true });
  await expect(
    btn("Rozumím").or(btn("Ukázat odpověď")).or(btn("Potvrdit")).or(btn("Zkontrolovat")).or(btn("Mám hotovo — porovnat")).or(page.getByText(/plán je splněný|Pro dnešek je hotovo/)),
  ).toBeVisible();
  if (await btn("Rozumím").isVisible()) {
    await btn("Rozumím").click();
    return "intro";
  }
  if (await btn("Ukázat odpověď").isVisible()) {
    await btn("Ukázat odpověď").click();
    await btn("Věděla").click();
    return "reveal";
  }
  if (await btn("Zkontrolovat").isVisible()) {
    await page.getByLabel("Výsledek").fill("1500");
    await btn("Zkontrolovat").click();
    await btn("Další").click();
    return "numeric";
  }
  if (await btn("Mám hotovo — porovnat").isVisible()) {
    await btn("Mám hotovo — porovnat").click();
    await page.getByRole("checkbox").first().click();
    await btn("Hotovo").click();
    return "explain";
  }
  if (await btn("Potvrdit").isVisible()) {
    await page.locator('[role="radio"],[role="checkbox"]').first().click();
    await btn("Potvrdit").click();
    await btn("Další").click();
    return "choice";
  }
  return null;
}

test("log in, study, reload mid-session, and progress persists on the server", async ({ page, request }) => {
  await login(page);
  await startButton(page).click();
  await expect(page).toHaveURL(/\/studium/);

  const done: string[] = [];
  for (let i = 0; i < 5; i++) {
    const r = await answerCard(page);
    if (!r) break;
    done.push(r);
  }
  // The two projects share one database, so the second run may start with reviews instead of intros.
  expect(done.length).toBeGreaterThanOrEqual(3);

  // Remember the card on screen, reload, and expect the same card back (resume).
  const heading = page.getByRole("heading", { level: 2 }).first();
  const before = await heading.textContent();
  await page.reload();
  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText(before ?? "");

  for (let i = 0; i < 5; i++) if (!(await answerCard(page))) break;

  // Events reached the server (outbox flushed) and point state was derived.
  await expect
    .poll(async () => {
      const res = await page.request.get("/api/state");
      const data = (await res.json()) as { states: Record<string, { introducedAt: string | null; answers: number }> };
      return Object.values(data.states).filter((s) => s.answers > 0).length;
    })
    .toBeGreaterThan(0);

  // Unauthenticated API access is refused.
  const anon = await request.get("/api/state", { headers: { cookie: "" } });
  expect(anon.status()).toBe(401);
});

test("library and progress pages render", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Témata" }).click();
  await expect(page.getByRole("heading", { name: "Témata" })).toBeVisible();
  await page.getByRole("link", { name: /Energetická bilance/ }).click();
  await expect(page.getByRole("link", { name: "Procvičit toto téma" })).toBeVisible();
  await page.getByRole("link", { name: "Pokrok" }).click();
  await expect(page.getByText("Podle kompetencí zkoušky")).toBeVisible();
});

test("answers given offline are kept and sent when the connection returns", async ({ page, context }) => {
  await login(page);
  const answered = async () => {
    const res = await page.request.get("/api/state");
    const data = (await res.json()) as { states: Record<string, { answers: number }> };
    return Object.values(data.states).reduce((n, s) => n + s.answers, 0);
  };
  const before = await answered();
  await startButton(page).click();
  await expect(page).toHaveURL(/\/studium/);
  await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
  await context.setOffline(true);
  let answers = 0;
  for (let i = 0; i < 6 && answers < 2; i++) {
    const r = await answerCard(page);
    if (!r) break;
    if (r !== "intro") answers++;
  }
  expect(answers).toBeGreaterThan(0);
  await expect(page.getByText(/Jsi offline/)).toBeVisible({ timeout: 10_000 });
  await context.setOffline(false);
  await expect.poll(answered, { timeout: 30_000 }).toBeGreaterThanOrEqual(before + answers);
});
