import { describe, expect, it } from "vitest";
import { buddyLine, type Buddy, type DaySummary } from "./buddy";

const me = (o: Partial<DaySummary> = {}): DaySummary => ({ answers: 0, extra: 0, planDone: false, days7: 0, ...o });
const danca = (o: Partial<DaySummary> = {}): Buddy => ({ label: "Danča", labelWith: "Dančou", ...me(o) });
const line = (a: Partial<DaySummary>, b: Partial<DaySummary>) => buddyLine(me(a), danca(b));

describe("comparison line", () => {
  it("covers every state in priority order, with real numbers", () => {
    expect(line({ planDone: true, answers: 30 }, { planDone: true, answers: 44, extra: 14 })).toEqual({
      tone: "behind",
      emoji: "🔥",
      line1: "Danča má dneska 14 odpovědí nad plán.",
      line2: "Je fakt locked in.",
    });
    expect(line({ planDone: true, answers: 41, extra: 11 }, { answers: 3 })).toMatchObject({ tone: "ahead", emoji: "🔥", line1: "Máš dneska 11 odpovědí nad plán.", line2: "Danča by měla zbystřit." });
    // Both over plan: nobody is ahead — a draw.
    expect(line({ planDone: true, extra: 12 }, { planDone: true, extra: 20 })).toMatchObject({ tone: "both", emoji: "🤝", line1: "Obě máte dnes hotovo. Remíza." });
    expect(line({ answers: 12 }, { planDone: true, answers: 30 })).toMatchObject({ tone: "behind", emoji: "😏", line1: "Danča už má pro dnešek hotovo.", line2: "A ty?" });
    expect(line({ planDone: true, answers: 30 }, { answers: 50 })).toMatchObject({ tone: "ahead", emoji: "😎", line1: "Máš hotovo dřív než Danča.", line2: "Klidně jí to otři o nos." });
    expect(line({}, { answers: 18 })).toMatchObject({ tone: "behind", emoji: "👀", line1: "Danča už má dneska 18 odpovědí.", line2: "Ty zatím nula. Žádný stres." });
    expect(line({ answers: 6 }, { answers: 18 })).toMatchObject({ tone: "behind", emoji: "🏃‍♀️", line1: "Danča ti dneska utíká o 12 odpovědí." });
    expect(line({ answers: 18 }, { answers: 9 })).toMatchObject({ tone: "ahead", emoji: "🏆", line1: "Dneska vedeš o 9 odpovědí.", line2: "Danča to ještě neví." });
    expect(line({ answers: 10 }, { answers: 7 })).toMatchObject({ tone: "even", emoji: "⚖️", line1: "S Dančou jste na tom dneska nastejno." });
    expect(line({ days7: 3 }, { days7: 5 })).toMatchObject({ tone: "behind", emoji: "📅", line1: "Za poslední týden: Danča 5 dní, ty 3.", line2: "Dneska by to chtělo přidat." });
    expect(line({ days7: 5 }, { days7: 2 })).toMatchObject({ tone: "even", emoji: "🐢", line1: "Danča dneska ještě nezačala.", line2: "Ideální chvíle ji předběhnout." });
  });

  it("uses the threshold rules and Czech plurals", () => {
    expect(line({ answers: 3 }, {})).toMatchObject({ emoji: "🏆", line1: "Dneska vedeš o 3 odpovědi." }); // she hasn't started: any lead counts
    expect(line({ answers: 1 }, {})).toMatchObject({ line1: "Dneska vedeš o 1 odpověď." });
    expect(line({ answers: 8 }, { answers: 4 })).toMatchObject({ emoji: "⚖️" }); // lead under 5: level
    expect(line({ answers: 4 }, { answers: 8 })).toMatchObject({ emoji: "⚖️" });
    expect(line({}, { answers: 2 })).toMatchObject({ line1: "Danča už má dneska 2 odpovědi." });
    expect(line({ planDone: true, extra: 9 }, { planDone: true })).toMatchObject({ emoji: "🤝" }); // 9 extra is not yet 🔥
    expect(line({}, { days7: 1 })).toMatchObject({ line1: "Za poslední týden: Danča 1 den, ty 0." });
  });

  it("works the other way round with Lucka's names", () => {
    const l = buddyLine(me({ answers: 0 }), { label: "Lucka", labelWith: "Luckou", ...me({ answers: 25 }) });
    expect(l.line1).toBe("Lucka už má dneska 25 odpovědí.");
    expect(buddyLine(me({ answers: 6 }), { label: "Lucka", labelWith: "Luckou", ...me({ answers: 7 }) }).line1).toBe("S Luckou jste na tom dneska nastejno.");
  });
});
