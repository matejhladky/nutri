"use client";
/** A "Novinka" notice on Dnes: casual, visible, dismissed for good (on every device) with one tap. */
import type { NewsItem } from "@/lib/news";

export function NewsCard({ item, onDismiss }: { item: NewsItem; onDismiss: () => void }) {
  return (
    <section
      aria-labelledby="novinka"
      className="mt-5 flex flex-col gap-2 rounded-[18px] border border-clay-600/20 bg-clay-50 py-4 pr-4 pl-[18px] lg:mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-x-8 lg:px-[22px] lg:py-[18px]"
    >
      <div className="flex flex-col gap-2 lg:gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <span aria-hidden className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-clay-600 text-[14px] leading-none font-extrabold text-white">
              !
            </span>
            <span className="text-[13.5px] font-bold text-clay-600">Novinka</span>
          </span>
          <button type="button" aria-label="Zavřít" onClick={onDismiss} className="-m-1.5 flex h-8 w-8 items-center justify-center rounded-full text-clay-600 hover:bg-clay-600/10 lg:hidden">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <h2 id="novinka" className="text-[16.5px] leading-snug font-semibold lg:text-[17px]">
          {item.title}
        </h2>
        <p className="max-w-[640px] text-[14.5px] leading-relaxed text-[#3d2a2e]">{item.body}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-1 min-h-10 self-start rounded-xl bg-clay-600 px-4 text-[14.5px] font-semibold text-white hover:bg-clay-600/90 lg:mt-0 lg:min-h-11 lg:self-center lg:px-5 lg:text-[15px]"
      >
        {item.button}
      </button>
    </section>
  );
}
