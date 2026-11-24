/**
 * Exactly two known learners — l1 Lucka, l2 Danča — each identified by her own passphrase (no accounts). Shared by server and client.
 * Ids are stored with every row of personal data — never rename them.
 */
export const LEARNER_IDS = ["l1", "l2"] as const;
export type LearnerId = (typeof LEARNER_IDS)[number];
export const isLearnerId = (x: unknown): x is LearnerId => (LEARNER_IDS as readonly unknown[]).includes(x);

/** What the client needs to know about the signed-in learner. `name` is the vocative used in the greeting ("Lucko"). */
export type Learner = { id: LearnerId; name: string; examDate: string };

/**
 * Every API call names the learner its page was rendered for. The server refuses (409) when the session cookie now
 * belongs to the other learner — a stale tab can then never send or read the other learner's data.
 */
export const LEARNER_HEADER = "x-nutri-learner";
