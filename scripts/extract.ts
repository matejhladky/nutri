/**
 * Deterministic source extraction: PDF → one text file per page + outline from the table of contents.
 * Output goes to source/ (gitignored — it is a verbatim copy of copyrighted material).
 *
 *   pnpm extract [path/to/pdf]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PDF = process.argv[2] ?? "materials/skrpita.pdf";
const OUT = "source";
const PAGES_DIR = join(OUT, "pages");

if (!existsSync(PDF)) {
  console.error(`PDF not found: ${PDF}`);
  process.exit(1);
}

const info = execFileSync("pdfinfo", [PDF], { encoding: "utf8" });
const pageCount = Number(/Pages:\s+(\d+)/.exec(info)?.[1]);
if (!pageCount) throw new Error("Could not read page count");

mkdirSync(PAGES_DIR, { recursive: true });

const pad = (n: number) => String(n).padStart(3, "0");
let mismatchedFooters = 0;
for (let p = 1; p <= pageCount; p++) {
  const text = execFileSync("pdftotext", ["-layout", "-f", String(p), "-l", String(p), PDF, "-"], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  writeFileSync(join(PAGES_DIR, `${pad(p)}.txt`), text);
  // Sanity check: the printed page number (footer) should equal the PDF page index.
  const lastLine = text.trim().split("\n").at(-1)?.trim();
  if (p > 1 && lastLine && /^\d+$/.test(lastLine) && Number(lastLine) !== p) mismatchedFooters++;
}

// Outline from the table of contents (PDF pages 2–5). Script numbering is unreliable
// (chapters 13–20 reuse previous numbers), so we keep the raw label and the page.
const toc = execFileSync("pdftotext", ["-layout", "-f", "2", "-l", "5", PDF, "-"], { encoding: "utf8" });
const outline: { label: string; title: string; page: number; level: number }[] = [];
for (const line of toc.split("\n")) {
  const m = /^\s*((?:\d+\.)+\d*)?\s*(.+?)\s*\.{3,}\s*(\d+)\s*$/.exec(line.replace(/​/g, ""));
  if (!m) continue;
  const label = (m[1] ?? "").replace(/\.$/, "");
  outline.push({
    label,
    title: m[2].trim(),
    page: Number(m[3]),
    level: label ? label.split(".").length : 2,
  });
}
writeFileSync(join(OUT, "outline.json"), JSON.stringify({ pdf: PDF, pageCount, outline }, null, 2));

console.log(
  `Extracted ${pageCount} pages → ${PAGES_DIR}/, ${outline.length} outline entries, ` +
    `${mismatchedFooters} pages whose footer ≠ PDF index`,
);
