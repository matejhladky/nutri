/** Czech plural: plural(1,"den","dny","dní") → "1 den", 3 → "3 dny", 5 → "5 dní". */
export function plural(n: number, one: string, few: string, many: string, withNumber = true): string {
  const word = n === 1 ? one : n >= 2 && n <= 4 ? few : many;
  return withNumber ? `${n} ${word}` : word;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Dobrou noc";
  if (h < 10) return "Dobré ráno";
  if (h < 18) return "Dobrý den";
  return "Dobrý večer";
}

const WEEKDAY_IN = ["v neděli", "v pondělí", "v úterý", "ve středu", "ve čtvrtek", "v pátek", "v sobotu"];

/** "v pátek 4. 12." */
export function czDayWithWeekday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${WEEKDAY_IN[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}. ${m}.`;
}

/** "6. 12. 2026" */
export function czDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${m}. ${y}`;
}
