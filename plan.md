# Plan

Spanish learning app for me, friends and family. Latin American and Caribbean Spanish: ustedes instead of vosotros, voseo optional. Add to this as we go.

## How spaced repetition works

**No new dependency.** `src/lib/fsrs.ts` is our own, about 80 lines of pure math, checked against the expected values in py-fsrs's test suite. `ts-fsrs` is MIT, but it now brings in a dependency of its own and needs Node 24. The formulas are short and public.

Decisions:

- **Algorithm:** FSRS-6 with its 21 default parameters and 90% target recall. No optimizer, since we won't have enough reviews to tune it. `ts-fsrs` now defaults to FSRS-7, but FSRS-6 is what I've confirmed the formulas for.
- **What gets scheduled:** the existing tracked items, so `verb:hablar:preterite` or `vocab:noun:casa:gender`. Verbs are scheduled per tense, and each review picks a person. Guide quizzes stay out at first, because their IDs are question positions that shift when a quiz is edited.
- **Grades:** correct is Good, accent slip is Hard, wrong is Again. No Easy, because nobody self-rates here.
- **Days, not minutes:** the first answer to an item each day moves its schedule, and later ones only count toward stats. This matches "only the first try counts", drops FSRS's minute-based learning steps, and means a re-sent batch can't move a schedule twice. A missed item comes back in the session as it does now, then the next day.
- **Every drill feeds the schedule:** free practice updates an item too, so Today's review stays honest.
- **Limits:** 10 new items a day by default, per person. Reviews are capped at 100 a day, most overdue first, so a week away doesn't bury anyone.
- **New item order:** the most common verbs and their simplest tenses first, then words. Tally-only items from before launch start fresh at their next review.

Where things are:

- Saving reads each item's schedule first, about 10 extra reads per batch, then writes stability, difficulty and due day to its `items` doc. `firestore.rules` already covers this.
- `stats/seen` lists every scheduled item, so finding new ones takes one read. `days/{day}` counts new items and reviews against the daily limits, and `stats/settings` holds the new-item limit, set on the account page.
- `reviewCard` in `card-decks.ts` rebuilds a card from an item ID and skips IDs whose word no longer exists. Verb items alternate between conjugation and fill-in-the-blank.
- New items from free practice count toward the daily limit too, because they add the same review load.
- "Mastered" is now stability of 21+ days, not 5 correct answers.

Cost check: a heavy day for one person is about 100 reviews, or roughly 100 reads and 120 writes. The Spark plan allows 50,000 reads and 20,000 writes a day across everyone.

## Content backlog

- [ ] More words in every section. Now at 1,087 nouns, 475 adjectives, 237 adverbs
- [ ] More verbs. Now at 314, with room for more reflexives and regional verbs
- [ ] More phrases and regional expressions, labeled by country. Now at 162
- [ ] More regional words, and more countries in the existing entries
- [ ] More reading passages. Now at 12, with 4 each at A1, A2 and B1
- [ ] Better examples for verbs that are mostly "rarely used" notes (contraer, prever, errar, rogar)
- [ ] Example sentences for every person of every verb, so all conjugation cards can show one. About 14,800 remain, so this needs batches and a usage check before each one. Each batch covers the next 12 verbs in `verbs.json`, about 280 sentences. The top 110 are done in the six core tenses, apart from forms with no natural sentence, like `yo naceré`, which are left without one. Do the core tenses first: about 4,700 remain there, and the rest are in tenses drilled far less

## Later

- [ ] More audio, after the word lists pass the phone check in "To verify": drills (after answering only, so it can't give the answer away, and speaking the full sentence, not the blank), example sentences on verb and regional pages, then reading passages a sentence at a time
- [ ] Better text-to-speech if the device voices aren't good enough: generate audio files once and serve them as static files, so there's no runtime API key
- [ ] Conversation or writing practice with Claude (would need an API key)
- [ ] Optional voseo in drills

## To verify

- [ ] Spot-check reflexive forms with attached pronouns (levántate, vámonos), which the Wiktionary comparison didn't cover
- [ ] Look up individual forms in RAE when in doubt. Its robots.txt blocks Claude's crawlers, so this means web search or checking by hand, not bulk fetching
- [ ] Skim the sentence files for natural phrasing, including the per-person sentences in `src/data/sentences/`. Tests confirm the conjugated form is present, not that the sentence sounds right or the translation is accurate
- [ ] Skim the 908 new vocabulary entries (the end of each file in `src/data/vocab/`), plus all of `small-words.json` and its grammar notes, for natural phrasing, translations and regional fit. Tests only confirm each word appears in its example. These come from my own knowledge, not a source. Adverbs now include set expressions like `por si acaso`
- [ ] Skim `src/data/readings.json` for natural phrasing, translations and regional fit, especially the Chilean, Costa Rican and Venezuelan details and the retold Quetzalcóatl legend. Tests only check structure, length and that listed words appear in the passage. These come from my own knowledge, not a source
- [ ] The haber preterite sentences (hube, hubiste) are literary, and hardly anyone says these forms. Decide whether drills should skip them
- [ ] Try the app on a real phone, especially the on-screen keyboard during drills
- [ ] Listen to the speaker buttons on an iPhone, an Android phone and a computer: does sound play, does the voice sound Latin American, are single-letter words like `y` and `a` read as words and not letter names, and does the slower speed feel right? Only what gets requested has been tested, in headless Chrome with fake voices. Nobody has heard it yet
- [ ] Have a native speaker check the regional words and slang, including `src/data/vulgar.json` and the notes on offensive words. Usage varies and these come from my own knowledge, not a source
- [ ] Set `vulgar: true` on your invite and confirm the section appears on /regional. Confirm it doesn't show signed out or on an account without the field. It hasn't been seen signed in
- [ ] Publish the new `firestore.rules`, then request access with a second account, approve it, and confirm its progress saves. Also confirm your own invite still works. The rules can't be tested here
- [ ] Check Weak spots on /progress with a signed-in account: miss a verb and a question type at least 5 times each, then use "Practice this". Verb and mistake-type stats only count answers from now on, and the section hasn't been seen with real data
- [ ] Use Today's review with a signed-in account: confirm its cards still show sentences now that it loads only the sentence files for its verbs. Finish a session, check an item in `users/{uid}/items` has `stability` and `due`, and check `/progress` shows what's due the next day. Real Firestore writes of schedules haven't run yet
- [ ] Do a verb drill, then a vocabulary drill, and confirm "Accuracy by tense" stays. A save with no verb answers used to erase it. The fix is confirmed against the Firestore SDK offline, not yet against real Firestore
- [ ] Try a backlog of 25 different items at once, because Firestore rules allow 20 lookups per batch and the docs say repeated lookups are cached, but that isn't confirmed for our invite check
- [ ] A save interrupted by a closed tab can be sent twice, which overcounts stats slightly. Accepted, since the alternative was losing answers
- [ ] Read the grammar guides and their quizzes for accuracy. Tests check the structure, not the grammar
- [ ] Unknown verb URLs returned 200 on first request and 404 after. Harmless so far

## How content gets added

- Sentences and vocabulary are written in Claude Code sessions and committed as JSON, so the app needs no API key or database.
- `npm test` checks the data: every example must contain the exact word form it teaches.
- Verbs: add to the end of `src/data/verbs.json`, because a verb's position decides its sentence file. Then add its sentences to the matching `src/data/sentences/verbs-*.json` in tense order, with a list for each tense or `{"rare":true}`. `person` is 0 yo, 1 tú, 2 él, 3 nosotros, 4 ellos. After verb 350, add a new file to `sentence-data.ts` and `sentence-loader.ts`.
- Sentences for the other persons of a verb: add to the verb's tense list in the same file, after the main sentence, which stays first. Name the subject when forms look alike, like yo and él in the imperfect, because the verb is blanked out on cards.
- Sentence files hold 50 verbs each in `verbs.json` order, so a drill downloads only the files for its verbs, and adding to one file leaves the others cached.
- Words: add to the end of `src/data/vocab/*.json`, because file order sets the order new items are introduced. Noun topics must stay in step with `NOUN_TOPICS` in `src/lib/drill-settings.ts`. Give nouns shared by men and women `"article":"el"` (el dentista), which keeps them out of the gender drill. Multi-word nouns need `plural`.
- Guides: `src/data/guides.json`, with quizzes in `src/data/guide-quizzes.json`.
- Reading passages: add to `src/data/readings.json`, one paragraph at a time with its translation. Keep to the level's grammar and length in `LEVELS` in `src/lib/readings.ts` (tests check the length, not the grammar). Words in `words` must appear exactly as written in the passage. Questions stay in passage order, and each needs at least 3 choices.
- Firestore rules: edit `firestore.rules`, then paste it into the Firebase console and publish.
- Small words: add to `src/data/vocab/small-words.json`. Drills only accept the exact gloss, so make each one specific enough to pick out its word, like `you (formal)`. No commas inside brackets, because commas split glosses into answers.
- Vulgar words: add to `src/data/vulgar.json`, with a note on what each means. Never add these to the drills or the public word lists with their meaning. Words that are offensive but not vulgar go in `regional.json` under `careful`, with the reason.
- Vulgar section: in the Firebase console, add a boolean `vulgar` set to true on someone's document in `invites`. It's off by default and people can't change it themselves. It's a filter, not protection, because the file is a public download for anyone who goes looking.
- Problem reports: in the Firebase console, open `reports`. Each has what it's about, the message, the page and who sent it. Delete a report once it's fixed. There's no notification, so check it now and then.
- Access requests: in the Firebase console, open `invites`, filter for `added == false`, and set `added` to true to approve someone. Delete the document to decline. There's no notification, so check it now and then. To add someone directly, make a document keyed by their lowercase email.

## Local checks

These live in `.verify/`, which is gitignored, so keep a copy if you change machines.

- Conjugation: `npx tsc -p tsconfig.test.json && node .verify/check.mjs`
- Browser, with `npm run build` and `npx next start -p 3111` running: `node --experimental-websocket --no-warnings .verify/browser/flow.mjs`, also `audit.mjs`, `account.mjs`, `progress.mjs`, `report.mjs`, `reading.mjs`, `sentence-loading.mjs` and `speech.mjs`. The browser profile isn't signed in, so none of these reach Firestore

## Completed

### App

- [x] Conjugation engine with no dependencies, 16 tenses, reflexive verbs, voseo
- [x] Verb search and full conjugation pages
- [x] 281 verbs with a curated example sentence per tense, or a "rarely used" note
- [x] Conjugation drills with accent-aware grading and retry of missed questions
- [x] Nouns, adjectives, adverbs and phrases with browse and filter pages (310, 153, 75, 81)
- [x] Vocabulary drills (meaning in both directions, noun gender, adjective agreement)
- [x] Fill-in-the-blank drills using the example sentences
- [x] Vocabulary drill filters by word type and noun topic
- [x] Drill settings remembered between visits (per browser)
- [x] Regional words page, including words to be careful with
- [x] Grammar guides: ser vs. estar, por vs. para, preterite vs. imperfect, subjunctive, gender and plurals, reflexive verbs, object pronouns, commands, perfect tenses, comparisons, talking about the future, relative pronouns, numbers and dates
- [x] A quiz for each grammar guide, linked from the guide and available as Grammar in Drills
- [x] Bold label for the tense or question type on conjugation, fill-in-the-blank and vocabulary cards
- [x] Example sentence on conjugation cards in Spanish and English with the answer blanked out, shown only when the sentence is for the person being asked
- [x] 1,164 more sentences so the top 50 verbs have one for every person in the present, preterite, imperfect, future, conditional and present subjunctive
- [x] Mobile layout pass, checked at 320px and 390px in headless Chrome
- [x] Deployed on AWS Amplify (Next.js 16 with Cache Components is newer than Amplify's documented support, so recheck after upgrades)
- [x] Speaker buttons on word lists (nouns, adjectives, adverbs, small words, phrases) for each word and example, using the device's own voices. `src/lib/speech.ts` prefers Latin American voices, uses Spain's only as a last resort, and hides the button if there's no Spanish voice

### Accounts and saved progress

- [x] Firebase sign-in (Google and email link), with invite-only saved progress and security rules in `firestore.rules`
- [x] Save answers, tracked by verb + tense, by word + question type, and by guide question
- [x] Progress page: streak, questions answered, accuracy by tense, items mastered
- [x] Spaced repetition (FSRS) with a "Today's review" mode and a daily limit on new items. See "How spaced repetition works"
- [x] Request access form on the account page, for people signed in without an invite
- [x] Weak-spot stats by tense, verb and mistake type, each with a "Practice this" link that starts a 15-question session
- [x] "Report a problem" link on words, phrases, regional entries, verb tenses and drill answers, for invited people. Saved to `reports` in Firestore
- [x] Vulgar words section on the regional page, shown only to invites with `vulgar: true`. Offensive words stay public with the reason explained. Vulgar ones say so publicly, and only this section says what they mean

### Content

- [x] Prepositions, conjunctions, pronouns and question words: a Small words page and word type in vocabulary drills
- [x] Graded reading passages: 12 stories at A1, A2 and B1 on a Reading page, each with an English translation per paragraph, a word list and comprehension questions. Answers aren't saved to progress
- [x] 1,390 more sentences in five batches, extending every-person coverage in the six core tenses from the top 50 verbs to the top 110
- [x] Sentence data split into one file per 50 verbs, so the default drill downloads about 54 KB instead of 170 KB (gzipped). Every lookup was compared before and after, with no differences

### Verification

- [x] Compare the engine with Wiktionary for all verbs: no real differences (llover's unused persons only). Re-run with `npx tsc -p tsconfig.test.json && node .verify/check.mjs`. It lives in a gitignored folder, works offline, and fetches only verbs it hasn't seen
- [x] Play through drills and a quiz in a headless browser, including the keyboard flow, accent buttons, retries and saved settings
- [x] Publish the new `firestore.rules`, then send a report while signed in and confirm it appears in `reports`
- [x] Test real sign-in (Google and email link), the invite check, and the published Firestore rules
- [x] Saved progress up to the Firestore call: real drills in headless Chrome (what's queued, retries not counted, the save at 10 answers, answers kept when a save fails), plus unit tests for the queue
- [x] Saved progress with a signed-in account: 64 real answers reached /progress
- [x] Saving and scheduling across several days with the real Firestore SDK, network off (`node .verify/store-sim.cjs "$PWD"` after `npx tsc -p tsconfig.test.json`)
