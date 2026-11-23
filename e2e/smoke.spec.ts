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

/** Work through a client case step by step (case steps continue with "Pokračovat"), then leave via "Další". */
async function answerCase(page: Page) {
  await finishCaseSteps(page);
  await page.getByRole("button", { name: "Další", exact: true }).click();
}

/** Answer every remaining step of the case on screen, stopping on its result screen. */
async function finishCaseSteps(page: Page) {
  const btn = (name: string) => page.getByRole("button", { name, exact: true });
  for (let i = 0; i < 10 && (await page.getByText(/^Krok \d+ z \d+$/).isVisible()); i++) {
    if (await btn("Zkontrolovat").isVisible()) {
      await page.getByLabel("Výsledek").fill("1500");
      await btn("Zkontrolovat").click();
      await btn("Pokračovat").click();
    } else if (await btn("Potvrdit").isVisible()) {
      await page.locator('[role="radio"],[role="checkbox"]').first().click();
      await btn("Potvrdit").click();
      await btn("Pokračovat").click();
    } else if (await btn("Mám hotovo — porovnat").isVisible()) {
      await btn("Mám hotovo — porovnat").click();
      await page.getByRole("checkbox").first().click();
      await btn("Pokračovat").click();
    } else if (await btn("Ukázat odpověď").isVisible()) {
      await btn("Ukázat odpověď").click();
      await btn("Věděla").click();
    }
  }
  await expect(btn("Další")).toBeVisible();
}

/** Answer whatever card is on screen. Returns a label of what was done, or null at the end of the session. */
async function answerCard(page: Page): Promise<string | null> {
  const btn = (name: string) => page.getByRole("button", { name, exact: true });
  await expect(
    btn("Rozumím").or(btn("Ukázat odpověď")).or(btn("Potvrdit")).or(btn("Zkontrolovat")).or(btn("Mám hotovo — porovnat")).or(page.getByText(/plán je splněný|Pro dnešek je hotovo|Pro tuhle chvíli hotovo/)),
  ).toBeVisible();
  if (await page.getByText(/^Krok \d+ z \d+$/).isVisible()) {
    await answerCase(page);
    return "case";
  }
  if (await btn("Rozumím").isVisible()) {
    // Go straight to the question: after "Rozumím" the first retrieval is (by design) ≥ 2 minutes away.
    await btn("Už to znám").click();
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
  await expect(page.getByText("Písemná zkouška")).toBeVisible();
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

test("a model client case is worked through step by step and recorded as one answer", async ({ page }) => {
  await login(page);
  await page.goto("/studium?tema=pripady");
  const skip = page.getByRole("button", { name: "Už to znám" });
  await expect(skip.or(page.getByText(/^Krok 1 z \d+$/))).toBeVisible();
  if (await skip.isVisible()) await skip.click();
  await expect(page.getByText("Modelový případ", { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/^Krok 1 z \d+$/)).toBeVisible();
  const caseAnswers = async () => {
    const res = await page.request.get("/api/state");
    const data = (await res.json()) as { states: Record<string, { answers: number }> };
    return Object.entries(data.states)
      .filter(([id]) => id.startsWith("kaz."))
      .reduce((n, [, st]) => n + st.answers, 0);
  };
  const before = await caseAnswers();
  await answerCase(page);
  await expect.poll(caseAnswers, { timeout: 20_000 }).toBe(before + 1);
});

// ---------- R1 reliability regressions ----------

type Sess = { current: { next: { pointId: string }; answer?: unknown; caseSteps?: unknown[] } | null };
const sessionNow = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("nutri.session.v1") ?? "null") as Sess);
const answersOf = async (page: Page, pointId: string) => {
  const res = await page.request.get("/api/state");
  const data = (await res.json()) as { states: Record<string, { answers: number }> };
  return data.states[pointId]?.answers ?? 0;
};

test("reloading after answering shows the recorded result and never records a second answer", async ({ page }) => {
  const btn = (name: string) => page.getByRole("button", { name, exact: true });
  await login(page);
  await page.goto("/studium?tema=sacharidy");
  // Get to a multiple-choice question (skip intros straight to the question).
  for (let i = 0; i < 8 && !(await btn("Potvrdit").isVisible()); i++) {
    const skip = btn("Už to znám");
    await expect(skip.or(btn("Potvrdit")).or(btn("Ukázat odpověď")).or(btn("Zkontrolovat")).or(btn("Mám hotovo — porovnat"))).toBeVisible();
    if (await skip.isVisible()) await skip.click();
    else if (!(await btn("Potvrdit").isVisible())) await answerCard(page);
  }
  await expect(btn("Potvrdit")).toBeVisible();
  const pointId = (await sessionNow(page)).current!.next.pointId;
  const before = await answersOf(page, pointId);
  await page.locator('[role="radio"],[role="checkbox"]').first().click();
  await btn("Potvrdit").click();
  await expect(btn("Další")).toBeVisible();
  await expect.poll(() => answersOf(page, pointId)).toBe(before + 1);

  await page.reload();
  // Same card, already answered: feedback, no way to answer again.
  await expect(btn("Další")).toBeVisible();
  await expect(btn("Potvrdit")).toHaveCount(0);
  await page.reload();
  await btn("Další").click();
  await expect.poll(() => answersOf(page, pointId)).toBe(before + 1);
  expect((await sessionNow(page)).current?.next.pointId).not.toBe(pointId);
});

test("reloading in the middle of a client case resumes at the same step and records the case once", async ({ page }) => {
  const btn = (name: string) => page.getByRole("button", { name, exact: true });
  await login(page);
  await page.goto("/studium?tema=pripady");
  const skip = btn("Už to znám");
  await expect(skip.or(page.getByText(/^Krok \d+ z \d+$/))).toBeVisible();
  if (await skip.isVisible()) await skip.click();
  await expect(page.getByText(/^Krok 1 z \d+$/)).toBeVisible();
  const pointId = (await sessionNow(page)).current!.next.pointId;
  const before = await answersOf(page, pointId);
  // Finish step 1, then reload.
  if (await btn("Zkontrolovat").isVisible()) {
    await page.getByLabel("Výsledek").fill("1500");
    await btn("Zkontrolovat").click();
  } else if (await btn("Potvrdit").isVisible()) {
    await page.locator('[role="radio"],[role="checkbox"]').first().click();
    await btn("Potvrdit").click();
  } else {
    await btn("Mám hotovo — porovnat").click();
  }
  await btn("Pokračovat").click();
  await expect(page.getByText(/^Krok 2 z \d+$/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/^Krok 2 z \d+$/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Hotové kroky" }).getByRole("listitem")).toHaveCount(1);
  expect(await answersOf(page, pointId)).toBe(before);

  // Finish the case; reloading on the result screen keeps the result and adds nothing.
  await finishCaseSteps(page);
  await expect.poll(() => answersOf(page, pointId)).toBe(before + 1);
  await page.reload();
  await expect(btn("Další")).toBeVisible();
  await expect(page.getByText(/^Krok \d+ z \d+$/)).toHaveCount(0);
  await btn("Další").click();
  await expect.poll(() => answersOf(page, pointId)).toBe(before + 1);
});

test("a malformed queued event is rejected on its own and does not block later answers", async ({ page }) => {
  await login(page);
  // An answer event without a grade (would break replay) sitting at the head of the outbox.
  await page.evaluate(() => {
    const bad = { id: "bad-event-000001", pointId: "sach.funkce-esencialita", at: new Date().toISOString(), kind: "answer" };
    localStorage.setItem("nutri.outbox.v1", JSON.stringify([bad]));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem("nutri.outbox.v1") ?? "[]") as unknown[]).length), { timeout: 20_000 }).toBe(0);
  const rejected = await page.evaluate(() => JSON.parse(localStorage.getItem("nutri.rejected.v1") ?? "[]") as { event: { id: string } }[]);
  expect(rejected.some((r) => r.event?.id === "bad-event-000001")).toBe(true);
  // And normal studying still syncs.
  const total = async () => {
    const d = (await (await page.request.get("/api/state")).json()) as { states: Record<string, { answers: number }> };
    return Object.values(d.states).reduce((n, s) => n + s.answers, 0);
  };
  const before = await total();
  await startButton(page).click();
  let answered = 0;
  for (let i = 0; i < 6 && answered < 1; i++) {
    const r = await answerCard(page);
    if (!r) break;
    if (r !== "intro") answered++;
  }
  await expect.poll(total, { timeout: 20_000 }).toBeGreaterThan(before);
});

test("reporting the current question moves the session on, records nothing and hides only that item", async ({ page }) => {
  const btn = (name: string) => page.getByRole("button", { name, exact: true });
  const state = async () =>
    (await (await page.request.get("/api/state")).json()) as {
      states: Record<string, { answers: number }>;
      reports: { pointId: string; exerciseId: string | null }[];
    };
  await login(page);
  await page.goto("/studium?tema=sacharidy");
  for (let i = 0; i < 8 && !(await btn("Potvrdit").isVisible()); i++) {
    const skip = btn("Už to znám");
    await expect(skip.or(btn("Potvrdit")).or(btn("Ukázat odpověď")).or(btn("Zkontrolovat")).or(btn("Mám hotovo — porovnat"))).toBeVisible();
    if (await skip.isVisible()) await skip.click();
    else if (!(await btn("Potvrdit").isVisible())) await answerCard(page);
  }
  await expect(btn("Potvrdit")).toBeVisible();
  const cur = (await sessionNow(page)).current!.next as { pointId: string; exerciseId: string };
  await page.locator('[role="radio"],[role="checkbox"]').first().click();
  await btn("Potvrdit").click();
  await expect(btn("Další")).toBeVisible();
  await expect.poll(async () => (await state()).states[cur.pointId]?.answers ?? 0).toBeGreaterThan(0);
  const answersBefore = (await state()).states[cur.pointId].answers;

  let reportPosts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/api/reports")) reportPosts++;
  });
  await page.getByRole("button", { name: "Nahlásit chybu" }).click();
  await btn("Odeslat a skrýt otázku").click();

  // The session moves on: another card or a done screen — never a stuck spinner.
  await expect(page.getByRole("status")).toHaveCount(0, { timeout: 5_000 });
  await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
  const after = (await sessionNow(page)).current?.next as { pointId: string; exerciseId?: string } | undefined;
  expect(after?.pointId === cur.pointId && after?.exerciseId === cur.exerciseId).toBe(false);

  // The report was sent exactly once and is stored; the answer count did not change.
  await expect
    .poll(async () => (await state()).reports.some((r) => r.pointId === cur.pointId && r.exerciseId === cur.exerciseId))
    .toBe(true);
  expect(reportPosts).toBe(1);
  expect((await state()).states[cur.pointId].answers).toBe(answersBefore);

  // After a reload the reported exercise stays hidden.
  await page.reload();
  await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
  const reloaded = (await sessionNow(page)).current?.next as { pointId: string; exerciseId?: string } | undefined;
  expect(reloaded?.pointId === cur.pointId && reloaded?.exerciseId === cur.exerciseId).toBe(false);
});
