import { expect, test, type Page } from "@playwright/test";

const PASS = process.env.E2E_PASSPHRASE ?? "e2e-heslo";
const PASS_2 = process.env.E2E_PASSPHRASE_2 ?? "e2e-heslo-2";
/** API calls name the learner their page belongs to (see LEARNER_HEADER). */
const AS_L1 = { headers: { "x-nutri-learner": "l1" } };
const AS_L2 = { headers: { "x-nutri-learner": "l2" } };

async function login(page: Page, pass = PASS) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Heslo").fill(pass);
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
      await reviewKeyPoints(page);
      await btn("Pokračovat").click();
    } else if (await btn("Ukázat odpověď").isVisible()) {
      await btn("Ukázat odpověď").click();
      await btn("Věděla").click();
    }
  }
  await expect(btn("Další")).toBeVisible();
}

/** Self-check after an oral answer: key points come one at a time; say "Řekla jsem" to the first, "Neřekla" to the rest. */
async function reviewKeyPoints(page: Page) {
  const btn = (name: string) => page.getByRole("button", { name, exact: true });
  const total = Number((await page.getByText(/^Bod 1 z \d+$/).textContent())?.match(/z (\d+)/)?.[1]);
  expect(total).toBeGreaterThan(1);
  await btn("Řekla jsem").click();
  for (let i = 1; i < total; i++) {
    await expect(page.getByText(`Bod ${i + 1} z ${total}`)).toBeVisible();
    await btn("Neřekla").click();
  }
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
    await reviewKeyPoints(page);
    // Not every point was said, so the feedback shows what was missing and the model answer before moving on.
    await expect(page.getByText(/^\d+ z \d+ bodů$/)).toBeVisible();
    await expect(page.getByText("Příště nezapomeň")).toBeVisible();
    await btn("Další").click();
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
      const res = await page.request.get("/api/state", AS_L1);
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
  // Recent activity: 14 days, one entry per day (empty days included).
  await expect(page.getByRole("list", { name: "Odpovědi za posledních 14 dní" }).getByRole("listitem")).toHaveCount(14);
});

test("answers given offline are kept and sent when the connection returns", async ({ page, context }) => {
  await login(page);
  const answered = async () => {
    const res = await page.request.get("/api/state", AS_L1);
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
    const res = await page.request.get("/api/state", AS_L1);
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
const sessionNow = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("nutri.session.v1.l1") ?? "null") as Sess);
const answersOf = async (page: Page, pointId: string) => {
  const res = await page.request.get("/api/state", AS_L1);
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
    localStorage.setItem("nutri.outbox.v1.l1", JSON.stringify([bad]));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem("nutri.outbox.v1.l1") ?? "[]") as unknown[]).length), { timeout: 20_000 }).toBe(0);
  const rejected = await page.evaluate(() => JSON.parse(localStorage.getItem("nutri.rejected.v1") ?? "[]") as { event: { id: string } }[]);
  expect(rejected.some((r) => r.event?.id === "bad-event-000001")).toBe(true);
  // And normal studying still syncs.
  const total = async () => {
    const d = (await (await page.request.get("/api/state", AS_L1)).json()) as { states: Record<string, { answers: number }> };
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
    (await (await page.request.get("/api/state", AS_L1)).json()) as {
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
  await expect
    .poll(async () => {
      const after = (await sessionNow(page)).current?.next as { pointId: string; exerciseId?: string } | undefined;
      return after?.pointId === cur.pointId && after?.exerciseId === cur.exerciseId;
    })
    .toBe(false);

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

test("a report that fails to send keeps the card on screen, says so, and can be retried", async ({ page }) => {
  const btn = (name: string) => page.getByRole("button", { name, exact: true });
  await login(page);
  await page.goto("/studium?tema=tuky");
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

  let fail = true;
  await page.route("**/api/reports", (route) => (fail ? route.fulfill({ status: 500, body: "{}" }) : route.continue()));
  await btn("Nahlásit chybu").click();
  await btn("Odeslat a skrýt otázku").click();
  await expect(page.getByText("Hlášení se neodeslalo")).toBeVisible();
  // Still the same card; nothing hidden.
  await expect(btn("Další")).toBeVisible();
  expect((await sessionNow(page)).current?.next).toMatchObject({ pointId: cur.pointId, exerciseId: cur.exerciseId });

  fail = false;
  await btn("Odeslat a skrýt otázku").click();
  await expect.poll(async () => {
    const n = (await sessionNow(page)).current?.next as { pointId: string; exerciseId?: string } | undefined;
    return n?.pointId === cur.pointId && n?.exerciseId === cur.exerciseId;
  }).toBe(false);
});

test("today's answer count comes from the server, so another device sees it", async ({ page, browser }) => {
  await login(page);
  const count = async (p: Page) => {
    const d = (await (await p.request.get("/api/state", AS_L1)).json()) as { todayAnswers: number };
    return d.todayAnswers;
  };
  const before = await count(page);
  await startButton(page).click();
  let answered = 0;
  for (let i = 0; i < 6 && answered < 2; i++) {
    const r = await answerCard(page);
    if (!r) break;
    if (r !== "intro") answered++;
  }
  await expect.poll(() => count(page)).toBe(before + answered);
  // A fresh browser context (another device) shows the same count on Dnes.
  const other = await browser.newPage();
  await login(other);
  await expect(other.getByText(new RegExp(`Probráno`))).toBeVisible();
  expect(await count(other)).toBe(before + answered);
  if (before + answered > 0) await expect(other.getByText(/Dnes máš za sebou \d+ odpověd/)).toBeVisible();
  await other.close();
});

test("explain self-check: key points one at a time, then what was missed and the model answer", async ({ page }) => {
  await login(page);
  // Put a known explain card on screen through the persisted session (planner order is not deterministic here).
  await page.evaluate(() => {
    const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(new Date(Date.now() - 4 * 3600e3));
    const current = { next: { kind: "exercise", pointId: "uv.poradce-temata", exerciseId: "temata", reason: "review" }, seed: 1, shownAt: new Date().toISOString() };
    localStorage.setItem("nutri.session.v1.l1", JSON.stringify({ day, mode: { kind: "topic", topicId: "uvod" }, history: [], beyondGoal: false, current }));
  });
  await page.goto("/studium?tema=uvod");
  const btn = (name: string) => page.getByRole("button", { name, exact: true });
  await expect(page.getByText(/Zkus zmínit 5 hlavních bodů/)).toBeVisible();
  await btn("Mám hotovo — porovnat").click();

  // Only the current point is shown; later ones stay hidden until judged.
  await expect(page.getByText("Bod 1 z 5")).toBeVisible();
  await expect(page.getByText("Bod 2 z 5")).toHaveCount(0);
  await btn("Řekla jsem").click();
  await expect(page.getByText("Bod 2 z 5")).toBeVisible();
  await btn("Neřekla").click();
  for (let i = 3; i <= 5; i++) {
    await expect(page.getByText(`Bod ${i} z 5`)).toBeVisible();
    await btn("Řekla jsem").click();
  }

  // 4 of 5: the missed point and the model answer are shown before moving on (grading unchanged: ≥ ½ → partial).
  await expect(page.getByText("4 z 5 bodů")).toBeVisible();
  await expect(page.getByText("Příště nezapomeň")).toBeVisible();
  await expect(page.getByText("Vzorová odpověď")).toBeVisible();
  await expect(btn("Další")).toBeVisible();
});

// ---------- Two learners ----------

type ServerState = {
  states: Record<string, { answers: number }>;
  todayAnswers: number;
  answersByDay: Record<string, number>;
  settings: { dailyMinutes: number };
};
const stateAs = async (page: Page, as: typeof AS_L1) => (await (await page.request.get("/api/state", as)).json()) as ServerState;
const totalAnswers = (s: ServerState) => Object.values(s.states).reduce((n, x) => n + x.answers, 0);
const stored = (page: Page, key: string) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null") as unknown, key);
const queued = async (page: Page, learner: string) => ((await stored(page, `nutri.outbox.v1.${learner}`)) as unknown[] | null)?.length ?? 0;

/** Answer up to `n` questions (intros don't count). Returns how many answers were given. */
async function answerSome(page: Page, n: number) {
  let answered = 0;
  for (let i = 0; i < n + 4 && answered < n; i++) {
    const r = await answerCard(page);
    if (!r) break;
    if (r !== "intro") answered++;
  }
  return answered;
}

test("each learner has her own greeting, exam date, settings and progress", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage(); // learner 1's phone
  const b = await (await browser.newContext()).newPage(); // learner 2's phone
  await login(a);
  await login(b, PASS_2);
  await expect(a.getByRole("heading", { name: "Ahoj Lucko ☀️" })).toBeVisible();
  await expect(b.getByRole("heading", { name: "Ahoj Dančo ☀️" })).toBeVisible();
  // Each sees her own exam at the end of her path to the exam.
  await expect(a.getByText("Cesta ke zkoušce")).toBeVisible();
  await expect(a.getByText(/^pá 4\. 12\.$/)).toBeVisible();
  await expect(b.getByText(/^čt 10\. 12\.$/)).toBeVisible();

  const b0 = await stateAs(b, AS_L2);
  const a0 = await stateAs(a, AS_L1);
  await a.goto("/studium?navic=1"); // beyond the daily goal: the shared test DB may have used today's plan up
  const answered = await answerSome(a, 2);
  expect(answered).toBeGreaterThan(0);
  await expect.poll(async () => totalAnswers(await stateAs(a, AS_L1))).toBe(totalAnswers(a0) + answered);
  // Learner 2's account is untouched: same states, same count for today.
  expect(await stateAs(b, AS_L2)).toMatchObject({ states: b0.states, todayAnswers: b0.todayAnswers, answersByDay: b0.answersByDay });

  // Settings are per learner.
  const res = await b.request.post("/api/settings", { ...AS_L2, data: { dailyMinutes: b0.settings.dailyMinutes === 90 ? 60 : 90 } });
  expect(res.ok()).toBe(true);
  expect((await stateAs(a, AS_L1)).settings).toEqual(a0.settings);

  // A request that names the other learner, or none, is refused: no reading or writing across accounts.
  expect((await a.request.get("/api/state", AS_L2)).status()).toBe(409);
  expect((await a.request.get("/api/state")).status()).toBe(409);
  const forged = { id: "forged-0000001", pointId: "sach.funkce-esencialita", at: new Date().toISOString(), kind: "intro" };
  expect((await a.request.post("/api/events", { ...AS_L2, data: { events: [forged] } })).status()).toBe(409);
  expect((await stateAs(b, AS_L2)).states).toEqual(b0.states);
});

test("switching learners on one device keeps study sessions and queued answers apart", async ({ page, browser }) => {
  const watcher = await (await browser.newContext()).newPage();
  await login(watcher, PASS_2);
  const l2Before = totalAnswers(await stateAs(watcher, AS_L2));

  // Learner 1 studies while her answers cannot reach the server: they stay queued on this device.
  await login(page);
  const l1Before = totalAnswers(await stateAs(page, AS_L1));
  await page.route("**/api/events", (r) => r.fulfill({ status: 503, body: "{}" }));
  await page.goto("/studium?navic=1");
  const l1Answered = await answerSome(page, 2);
  expect(l1Answered).toBeGreaterThan(0);
  const l1Queued = await queued(page, "l1");
  expect(l1Queued).toBeGreaterThan(0);
  const l1Session = JSON.stringify(await stored(page, "nutri.session.v1.l1"));

  // She logs out; learner 2 logs in on the same device, with the connection back.
  await page.goto("/nastaveni");
  await page.getByRole("button", { name: "Odhlásit se na tomto zařízení" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.unroute("**/api/events");
  await login(page, PASS_2);
  await expect(page.getByRole("heading", { name: "Ahoj Dančo ☀️" })).toBeVisible();
  await page.goto("/studium?navic=1");
  const l2Answered = await answerSome(page, 1);
  await expect.poll(() => queued(page, "l2")).toBe(0);

  // Learner 2's account got exactly her own answers; learner 1's queue and session wait untouched for her.
  await expect.poll(async () => totalAnswers(await stateAs(watcher, AS_L2))).toBe(l2Before + l2Answered);
  expect(await queued(page, "l1")).toBe(l1Queued);
  expect(JSON.stringify(await stored(page, "nutri.session.v1.l1"))).toBe(l1Session);

  // Back as learner 1: her queued answers are delivered to her account.
  await page.goto("/nastaveni");
  await page.getByRole("button", { name: "Odhlásit se na tomto zařízení" }).click();
  await expect(page).toHaveURL(/\/login/);
  await login(page);
  await expect.poll(() => queued(page, "l1"), { timeout: 20_000 }).toBe(0);
  await expect.poll(async () => totalAnswers(await stateAs(page, AS_L1))).toBe(l1Before + l1Answered);
  expect(totalAnswers(await stateAs(watcher, AS_L2))).toBe(l2Before + l2Answered);
});

test("a tab left open for one learner cannot write into the other learner's account", async ({ browser }) => {
  const watcher = await (await browser.newContext()).newPage();
  await login(watcher, PASS_2);
  const l2Before = await stateAs(watcher, AS_L2);

  const ctx = await browser.newContext();
  const tab1 = await ctx.newPage();
  await login(tab1);
  await tab1.goto("/studium?navic=1");
  await expect(tab1).toHaveURL(/\/studium/);
  // Meanwhile learner 2 signs in in another tab of the same browser: the shared cookie now belongs to her.
  const tab2 = await ctx.newPage();
  expect((await tab2.request.post("/api/login", { data: { passphrase: PASS_2 } })).ok()).toBe(true);

  // The stale tab (still showing learner 1) records something; the server refuses it and the tab reloads as learner 2.
  await answerCard(tab1).catch(() => null); // the reload may interrupt the helper mid-card
  await expect(tab1.getByRole("heading", { name: "Ahoj Dančo ☀️" })).toBeVisible({ timeout: 20_000 });
  expect(await queued(tab1, "l1")).toBeGreaterThan(0);
  expect((await stateAs(watcher, AS_L2)).states).toEqual(l2Before.states);

  // When learner 1 is back on this browser, the held event is delivered to her.
  expect((await tab2.request.post("/api/login", { data: { passphrase: PASS } })).ok()).toBe(true);
  await tab1.goto("/");
  await expect(tab1.getByRole("heading", { name: "Ahoj Lucko ☀️" })).toBeVisible();
  await expect.poll(() => queued(tab1, "l1"), { timeout: 20_000 }).toBe(0);
  expect((await stateAs(watcher, AS_L2)).states).toEqual(l2Before.states);
});

// ---------- Admin ----------

const ADMIN = process.env.E2E_ADMIN_PASSPHRASE ?? "e2e-admin";

async function adminLogin(page: Page) {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("Heslo").fill(ADMIN);
  await page.getByRole("button", { name: "Vstoupit" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Lucka" })).toBeVisible();
}

/** Answers per day → total of the last 7 study days (04:00 Prague boundary), as the overview sentence counts them. */
const lastWeek = (byDay: Record<string, number>) => {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(new Date(Date.now() - 4 * 3600e3));
  const t = Date.parse(`${today}T12:00:00Z`);
  const keys = Array.from({ length: 7 }, (_, i) => new Date(t - i * 86400e3).toISOString().slice(0, 10));
  return keys.reduce((n, k) => n + (byDay[k] ?? 0), 0);
};

test("admin access is separate from both learners, in both directions", async ({ browser }) => {
  // A learner session does not open the admin area, and a learner passphrase does not log in there.
  const learner = await (await browser.newContext()).newPage();
  await login(learner);
  await learner.goto("/admin/l1");
  await expect(learner).toHaveURL(/\/admin\/login/);
  await learner.getByLabel("Heslo").fill(PASS);
  await learner.getByRole("button", { name: "Vstoupit" }).click();
  await expect(learner.getByText("Heslo nesedí.")).toBeVisible();

  // The admin passphrase is not a learner login.
  const anon = await (await browser.newContext()).newPage();
  await anon.goto("/login");
  await anon.getByLabel("Heslo").fill(ADMIN);
  await anon.getByRole("button", { name: "Vstoupit" }).click();
  await expect(anon.getByText("Heslo nesedí.")).toBeVisible();

  // An admin session opens neither a learner's app nor her API — reading or writing.
  const admin = await (await browser.newContext()).newPage();
  await adminLogin(admin);
  await admin.goto("/");
  await expect(admin).toHaveURL(/\/login$/);
  const ev = { id: "admin-forged-01", pointId: "sach.funkce-esencialita", at: new Date().toISOString(), kind: "intro" };
  for (const as of [AS_L1, AS_L2]) {
    expect((await admin.request.get("/api/state", as)).status()).toBe(401);
    expect((await admin.request.post("/api/events", { ...as, data: { events: [ev] } })).status()).toBe(401);
    expect((await admin.request.post("/api/settings", { ...as, data: { dailyMinutes: 20 } })).status()).toBe(401);
    expect((await admin.request.post("/api/reports", { ...as, data: { pointId: ev.pointId, exerciseId: null, message: "x" } })).status()).toBe(401);
  }

  // Admin and learner sessions live side by side in one browser without affecting each other.
  await adminLogin(learner);
  await learner.goto("/");
  await expect(learner.getByRole("heading", { name: "Ahoj Lucko ☀️" })).toBeVisible();
  expect((await learner.request.get("/api/state", AS_L1)).status()).toBe(200);
});

test("admin overview switches between the learners and shows each one's own data", async ({ browser }) => {
  const l1 = await (await browser.newContext()).newPage();
  const l2 = await (await browser.newContext()).newPage();
  await login(l1);
  await login(l2, PASS_2);
  // Learner 1 reports something (an exercise id that hides nothing real); learner 2 reports nothing.
  const msg = `admin-test ${Date.now()}`;
  expect((await l1.request.post("/api/reports", { ...AS_L1, data: { pointId: "sach.funkce-esencialita", exerciseId: "admin-test", message: msg } })).ok()).toBe(true);
  const [s1, s2] = [await stateAs(l1, AS_L1), await stateAs(l2, AS_L2)];

  const admin = await (await browser.newContext()).newPage();
  await adminLogin(admin);
  const week = (n: number) => (n ? new RegExp(`odpověděla na ${n} otáz`) : /bez odpovědí|Tady uvidíš/);
  await expect(admin.getByText(week(lastWeek(s1.answersByDay)))).toBeVisible();
  await expect(admin.getByText("Zkouška v pátek 4. 12.")).toBeVisible();
  await expect(admin.getByText(`„${msg}“`)).toBeVisible();
  await expect(admin.getByText("Zatím nic nenahlásila.")).toHaveCount(0);

  await admin.getByRole("link", { name: "Danča", exact: true }).click();
  await expect(admin.getByRole("heading", { level: 1, name: "Danča" })).toBeVisible();
  await expect(admin.getByText(week(lastWeek(s2.answersByDay)))).toBeVisible();
  await expect(admin.getByText("Zkouška ve čtvrtek 10. 12.")).toBeVisible();
  await expect(admin.getByText("Zatím nic nenahlásila.")).toBeVisible();
  await expect(admin.getByText(`„${msg}“`)).toHaveCount(0);
});

test("content explorer preview is a sandbox: no requests, no events, no state changes", async ({ browser }) => {
  const l1 = await (await browser.newContext()).newPage();
  const l2 = await (await browser.newContext()).newPage();
  await login(l1);
  await login(l2, PASS_2);
  const before = [await stateAs(l1, AS_L1), await stateAs(l2, AS_L2)];

  const admin = await (await browser.newContext()).newPage();
  await adminLogin(admin);
  await admin.getByRole("link", { name: "Obsah", exact: true }).click();
  await admin.getByRole("link", { name: /Sacharidy/ }).first().click();
  await admin.locator("details summary").first().click();
  // The answer key is visible in the explorer.
  await expect(admin.locator("details[open]").getByText(/Vzorová odpověď|Odpověď|Výsledek|správně/).first()).toBeAttached();
  const api: string[] = [];
  admin.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) api.push(`${r.method()} ${r.url()}`);
  });
  await admin.locator("details[open]").getByRole("link", { name: "Vyzkoušet" }).first().click();
  await expect(admin.getByText(/Náhled: .*nic se neukládá/)).toBeVisible();

  // Answer several questions (the helper moves on with "Další"), look at a Výklad, retry one.
  let answered = 0;
  for (let i = 0; i < 4; i++) if ((await answerCard(admin)) !== null) answered++;
  expect(answered).toBeGreaterThan(0);
  await expect(admin.getByText("Nahlásit chybu")).toHaveCount(0);
  await admin.getByRole("button", { name: "Výklad" }).click();
  await admin.getByRole("button", { name: "Rozumím" }).click();
  await admin.getByRole("button", { name: "Znovu" }).click();

  expect(api).toEqual([]);
  // Everything learner-related is exactly as before (serverTime aside).
  const data = ({ states, answersByDay, todayAnswers, settings }: ServerState) => ({ states, answersByDay, todayAnswers, settings });
  expect(data(await stateAs(l1, AS_L1))).toEqual(data(before[0]));
  expect(data(await stateAs(l2, AS_L2))).toEqual(data(before[1]));
});
