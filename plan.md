# Plan

Aprendalgo (aprendalgo.com), a Spanish learning app for me, friends and family. Latin American and Caribbean Spanish: ustedes instead of vosotros, voseo optional. Add to this as we go.

## How spaced repetition works

**No new dependency.** `src/lib/fsrs.ts` is our own, about 80 lines of pure math, checked against the expected values in py-fsrs's test suite. `ts-fsrs` is MIT, but it now brings in a dependency of its own and needs Node 24. The formulas are short and public.

Decisions:

- **Algorithm:** FSRS-6 with its 21 default parameters and 90% target recall. No optimizer, since we won't have enough reviews to tune it. `ts-fsrs` now defaults to FSRS-7, but FSRS-6 is what I've confirmed the formulas for.
- **What gets scheduled:** the existing tracked items, so `verb:hablar:preterite` or `vocab:noun:casa:gender`. Verbs are scheduled per tense, and each review picks a person. Guide quizzes stay out at first, because their IDs are question positions that shift when a quiz is edited.
- **Grades:** correct is Good, accent slip is Hard, wrong is Again. Flashcards are the one place people grade themselves: "Knew it" is Good and "Didn't know" is Again, on the same item as the typed question. That can flatter a word, and typed drills stay the stricter test. There's no Easy.
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

- [ ] Goal: about 5,000 words in all, roughly 2,300 nouns, 1,000 adjectives and 1,000 verbs, with adverbs already enough at about 250. The split is a rough estimate of how a list of the 5,000 most common words breaks down, from memory and not checked against a source. Common words come first, so regional and specialist words don't count for as much as their number suggests. Now about 4,160: 2,300 nouns, 1,001 adjectives, 282 adverbs, 159 small words, 414 verbs
- [ ] Insults and words for disabilities (idiota, estúpido, imbécil, cojo, manco, enano), left out of the word batches on purpose. Add them with a note on why they offend, per the vulgar and offensive word rules in "How content gets added"
- [ ] More verbs toward the goal: about 590 left. Slower than words, because each needs sentences for every tense. Work from `verb-backlog.md`, which lists 630 candidates in 26 batches of 25, already checked against `verbs.json`, including more reflexives and regional verbs. A batch takes about 900 sentences. Batch 5 goes into `verbs-401-450.json`, and batch 6 crosses verb 450
- [ ] More phrases and regional expressions, labeled by country. Now at 162
- [ ] More regional words, and more countries in the existing entries
- [ ] More reading passages. Now at 12, with 4 each at A1, A2 and B1
- [ ] Example sentences for every person of every verb, so all conjugation cards can show one. About 13,200 remain, all in tenses drilled far less, so this needs batches and a usage check before each one. All 414 verbs are done in the six core tenses, apart from about 411 forms left out on purpose: forms with no natural sentence, like `yo naceré`, all of `nevar` beyond él, `suceder`, `surgir`, `bastar`, `durar` and `corresponder` beyond él and ellos, or the yo and nosotros forms of `interesar`, `encantar` and `preocupar` where they'd sound forced, and tenses marked rare, like most of `oponer` and `desoír`. Next would be the present perfect and the -ra imperfect subjunctive, about 2,470 sentences between them, starting from the most common verbs
- [ ] Add proverb of the day

## Later

- [ ] More audio, after the word lists pass the phone check in "To verify": drills (after answering only, so it can't give the answer away, and speaking the full sentence, not the blank), example sentences on verb and regional pages, then reading passages a sentence at a time
- [ ] Better text-to-speech if the device voices aren't good enough: generate audio files once and serve them as static files, so there's no runtime API key
- [ ] Conversation or writing practice with Claude (would need an API key)
- [ ] Optional voseo in drills
- [ ] Split the word lists like the sentence files if vocabulary drills feel slow to start on a phone. Starting a vocabulary, flashcard or review drill now downloads all of them, about 140 KB gzipped (nouns 96, adjectives 35, adverbs 10), up from about 65 KB
- [ ] Verb of the day on the home page. Left out of the color pass because the home page is prerendered, so it would need to be picked in the browser

## Waiting on feedback

- [ ] Should the drill streak carry over between drills? Now it resets on a miss and also whenever a drill ends or changes: finishing a deck, "Change settings", switching drill type or reloading. I'm leaning towards keeping it going, because that encourages people to keep practicing. Ask: "Right now your drill streak resets when you finish or switch drills. Would you rather it kept going until you get one wrong, even across drills and days?" There are two options: carry it across drills but reset at midnight, or carry it until a miss, even across days. The second can blur into the days streak tile, and someone who rarely practices could build a big number slowly. The on-screen chip and the saved record should follow the same rule. Switching only changes when the streak resets in `DrillRunner.tsx`. The saved record keeps the higher number either way, so earlier records stay valid

## Teacher classes (idea, not started)

A teacher asked for a way to follow their students' progress. The plan is class-wide stats only, with no student named: accuracy by tense, weak spots and recent mistakes for the class as a whole.

How it would work, with no server and still on the Spark plan:

- A teacher (a `teacher: true` field on their invite, set by hand like `vulgar`) creates a class and gets a short join code.
- A student enters the code on their account page. It's opt-in, they're told their answers count toward anonymous class stats, and they can leave.
- Each time a student's progress saves, the same batch also adds to the class's own totals in `classes/{id}/stats`. That's one extra write per save. The teacher only ever reads the class totals and never gets access to students' own data. That makes it anonymous by design, not just hidden in the page.
- The teacher's page reuses the progress page parts: accuracy by tense, weak spots, recent mistakes and a weekly trend, plus how many students practiced this week.

Safeguards, because anonymous totals can still point to one person in a small class:

- Show nothing until at least 5 students have joined and practiced.
- Show mistakes grouped with counts, like "7 students wrote hablé for habló", and leave out mistakes only one student made.
- Leave writing and dictation mistakes out, since free text could contain anything, including names.
- Rules can check that a student only adds to classes they joined, but not that the numbers are honest. That's fine for a class tool.

Trade-off: the teacher can't spot one struggling student or check homework. If teachers ask for that later, it would be a separate opt-in per student.

Questions for the teacher first: how old are the students, how many are in a class, how do they sign in (school Google accounts often block outside apps, so email link may be the way), and what would they look at each week?

## Opening sign-ups and paying for it

The app started as invite-only for friends and family. Classes and wider use would mean opening sign-ups. The rules already have the switch: `canSaveProgress()` in `firestore.rules`.

- **Costs are small for a long time.** A heavy day for one person is about 100 reads and 120 writes. The free tier (50,000 reads and 20,000 writes a day across everyone) covers roughly 150 heavy users a day. Past that, the Blaze plan keeps the same free tier and charges per use, around $0.18 per 100,000 writes and $0.06 per 100,000 reads at last check (confirm current prices). 1,000 heavy users a day would be under $10 a month. Hosting stays on AWS Amplify, which bills separately for build minutes, data served and server-rendered requests. Most pages are prerendered, so that should stay small too, but set an AWS Budgets alert alongside Firebase's. On Spark, going over the limit makes saves fail for the rest of the day rather than costing money.
- **What would really cost money:** conversation practice with Claude (in "Later") and generated audio. Those, not the database, are where a subscription would come in.
- **Before opening up:**
  - A privacy policy and terms.
  - A minimum age of 13, unless the school route is set up properly. Under-13 accounts need parental consent under COPPA.
  - Firebase App Check against scripted abuse.
  - Budget alerts if on Blaze.
- **Paying for it, if needed:** free for learners, with a paid teacher or class plan, is common for school tools and keeps learners unaffected. Taking payments (Stripe) would need server routes and webhooks, which Amplify can run. Not worth building until costs are real.

## To verify

- [ ] Signed in, get a streak going in a drill, end it, and check "Longest drill streak" on /progress shows it with today's date. Then do a shorter streak and confirm the record doesn't drop. It's saved to `stats/records` with a transaction that keeps the higher number, and that hasn't run against real Firestore

- [ ] Spot-check reflexive forms with attached pronouns (levántate, vámonos), which the Wiktionary comparison didn't cover
- [ ] Look up individual forms in RAE when in doubt. Its robots.txt blocks Claude's crawlers, so this means web search or checking by hand, not bulk fetching
- [ ] Skim the sentence files for natural phrasing, including the per-person sentences in `src/data/sentences/`. Tests confirm the conjugated form is present, not that the sentence sounds right or the translation is accurate
- [ ] Skim the 2,688 new vocabulary entries (the end of each file in `src/data/vocab/`), plus all of `small-words.json` and its grammar notes, for natural phrasing, translations and regional fit. Tests only confirm each word appears in its example. These come from my own knowledge, not a source. Adverbs now include set expressions like `por si acaso`. The latest 1,780 include regional words worth a native check: `chévere`, `friolento`, `adolorido`, `chaparro`, `necio`, `habichuela`, `bizcocho`, `aventón`, `colmado`, `resaca`, `botana`, `tinto`, `chamarra`, `colectivo`, `coche` and `maletero` (the last eleven with notes), `quincena`, `hoja de vida`, `posada`, `parranda`
- [ ] Skim `src/data/readings.json` for natural phrasing, translations and regional fit, especially the Chilean, Costa Rican and Venezuelan details and the retold Quetzalcóatl legend. Tests only check structure, length and that listed words appear in the passage. These come from my own knowledge, not a source
- [ ] The haber preterite sentences (hube, hubiste) are literary, and hardly anyone says these forms. Decide whether drills should skip them
- [ ] Try the app on a real phone, especially the on-screen keyboard during drills
- [ ] Listen to the speaker buttons on an iPhone, an Android phone and a computer: does sound play, does the voice sound Latin American, are single-letter words like `y` and `a` read as words and not letter names, and does the slower speed feel right? Only what gets requested has been tested, in headless Chrome with fake voices. Nobody has heard it yet
- [ ] Have a native speaker check the regional words and slang, including `src/data/vulgar.json` and the notes on offensive words. Usage varies and these come from my own knowledge, not a source
- [ ] Set `vulgar: true` on your invite and confirm the section appears on /regional. Confirm it doesn't show signed out or on an account without the field. It hasn't been seen signed in
- [ ] Publish the new `firestore.rules`, then request access with a second account, approve it, and confirm its progress saves. Also confirm your own invite still works. The rules can't be tested here
- [ ] Check Weak spots on /progress with a signed-in account: miss a verb and a question type at least 5 times each, then use "Practice this". Verb and mistake-type stats only count answers from now on, and the section hasn't been seen with real data
- [ ] Use Today's review with a signed-in account: confirm its cards still show sentences now that it loads only the sentence files for its verbs. Finish a session, check an item in `users/{uid}/items` has `stability` and `due`, and check `/progress` shows what's due the next day. Real Firestore writes of schedules haven't run yet
- [ ] Signed in, do a flashcard session with some phrases and tap "I don't know this" on a typed card. Confirm the Vocabulary numbers on /progress go up, a phrase comes back in Today's review as a flashcard, and it's due sooner after "Didn't know" than after "Knew it". None of this has run against real Firestore, and the Vocabulary section has only been seen with made-up data
- [ ] Signed in, do a writing session in each direction. Confirm the Writing section appears on /progress with the right counts, and that "Accuracy by week" looks right against your history. Neither has run against real Firestore
- [ ] Do a verb drill, then a vocabulary drill, and confirm "Accuracy by tense" stays. A save with no verb answers used to erase it. The fix is confirmed against the Firestore SDK offline, not yet against real Firestore
- [ ] Try a backlog of 25 different items at once, because Firestore rules allow 20 lookups per batch and the docs say repeated lookups are cached, but that isn't confirmed for our invite check
- [ ] A save interrupted by a closed tab can be sent twice, which overcounts stats slightly. Accepted, since the alternative was losing answers
- [ ] Read the grammar guides and their quizzes for accuracy. Tests check the structure, not the grammar
- [ ] Unknown verb URLs returned 200 on first request and 404 after. Harmless so far
- [ ] Signed in, open /progress and check the practice calendar and the accuracy line against your real history, including tapping a week on a phone. They've only been seen with made-up data
- [ ] Signed in, tap a word in a reading and use "Add to my reviews". Confirm `stats/wanted` gets the item, the panel then says it's added, and the word comes up first among new items in Today's review. Only seen signed out
- [ ] Signed in, miss a few typed answers (one with "I don't know this", one in dictation), then check "Recent mistakes" on /progress and its "Practice the latest" link. Mistakes are saved on `days/{day}` under `mistakes`, and none has reached real Firestore yet. Also check the Listening section after a dictation session
- [ ] Try dictation on a real phone. On iPhone, the first sentence may not play until you tap Play once, because Safari can block speech that isn't started by a tap. Note whether it then plays on its own for the rest of the session
- [ ] Dictation counts a word spelled differently but sounding the same (tuvo and tubo, haber and a ver) as wrong. That's the point of dictation, but decide whether it feels unfair in practice

## How content gets added

- Sentences and vocabulary are written in Claude Code sessions and committed as JSON, so the app needs no API key or database.
- `npm test` checks the data: every example must contain the exact word form it teaches.
- Verbs: take the next batch from `verb-backlog.md` and delete it there once added. Add to the end of `src/data/verbs.json`, because a verb's position decides its sentence file. Then add its sentences to the matching `src/data/sentences/verbs-*.json` in tense order, with a list for each tense or `{"rare":true}`. `person` is 0 yo, 1 tú, 2 él, 3 nosotros, 4 ellos. After verb 450, add `verbs-451-500.json` to `sentence-data.ts` and `sentence-loader.ts`, starting it as `{}`.
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
- New verb sentences: write them in the short text format of `.verify/sentences/example.txt` (`@verb`, `#tense` or `#tense rare`, then `person Spanish | English`), then after `npx tsc -p tsconfig.test.json` run `node .verify/sentences/build.js "$PWD" verbs-351-400.json file.txt...`. It checks every form against the engine and the tense order, and `--write` adds the verbs to that sentence file without changing the rest of its layout
- Browser, with `npm run build` and `npx next start -p 3111` running: `node --experimental-websocket --no-warnings .verify/browser/flow.mjs`, also `audit.mjs`, `account.mjs`, `progress.mjs`, `report.mjs`, `reading.mjs`, `sentence-loading.mjs`, `speech.mjs`, `flashcards.mjs`, `writing.mjs`, `new-modes.mjs` (learn words, dictation, tapping words in a reading), `missed-table.mjs` (the tense table after a miss) and `accents.mjs` (slips against accents that make another word, in a real conjugation drill). The browser profile isn't signed in, so none of these reach Firestore

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
- [x] Renamed from Conjugar to Aprendalgo, on aprendalgo.com through Amplify's custom domains. The name is set once in `layout.tsx`, where a title template adds it to every page's title, plus the header in `SiteShell.tsx`. Shared links preview with the name and a description. A new domain must also be added to Firebase's authorized domains, or sign-in fails there
- [x] Color pass: a warm background and stone grays, and a hue per section that colors its nav link, header, page title, buttons and focus rings. The accent-\* colors in `globals.css` are built from `--hue`, set by `SiteShell.tsx`. Green still means correct in drills. Checked at 390 to 1280px, light and dark, in headless Chrome
- [x] Second color pass:
  - Verb tables color each regular ending and mark the rest as a stem change (blue), irregular (gold) or spelling change (dotted underline). `src/lib/conjugation/regular.ts` compares each form with hablar, comer or vivir, ignoring written accents. Spelling changes are the sound-keeping ones (busqué, llegue, cojo, sigo, leyó). Stem changes come from the verb's `boot`, or its irregular root's, so tener's tienes counts. A form with both, like empiece, shows as a stem change. Yo forms in -zco and -uir verbs' y (construyo) stay irregular
  - A color per mood on verb pages, an edge color per -ar, -er and -ir verb on the home page, and a gender color on noun articles
  - Drills: a pop or shake on feedback, a streak chip and confetti with a score when you finish. All CSS, and turned off for people who ask for reduced motion
  - Progress: a practice calendar and a weekly accuracy line. Only seen with made-up data on a temporary page, since the real page needs sign-in
  - Fraunces for titles, and a new home page header with shortcuts
- [x] A missed conjugation or fill-in-the-blank answer shows that tense's table under the card, as on the verb page, with the person asked marked. Drill feedback no longer links to the verb page, because it was easy to tap by mistake and leave the drill. Example sentences on tense tables have a speaker button, on verb pages too
- [x] Speaker buttons on word lists (nouns, adjectives, adverbs, small words, phrases) for each word and example, using the device's own voices. `src/lib/speech.ts` prefers Latin American voices, uses Spain's only as a last resort, and hides the button if there's no Spanish voice

### Accounts and saved progress

- [x] Firebase sign-in (Google and email link), with invite-only saved progress and security rules in `firestore.rules`
- [x] Save answers, tracked by verb + tense, by word + question type, and by guide question
- [x] Progress page: streak, questions answered, accuracy by tense, items mastered
- [x] Spaced repetition (FSRS) with a "Today's review" mode and a daily limit on new items. See "How spaced repetition works"
- [x] Request access form on the account page, for people signed in without an invite
- [x] "Longest drill streak" tile on /progress: the best on-screen drill streak, with the day it was set. Queued in the browser like answers and saved to `stats/records`, where the higher number wins. Only drills that save progress count
- [x] Weak-spot stats by tense, verb and mistake type, each with a "Practice this" link that starts a 15-question session
- [x] "Report a problem" link on words, phrases, regional entries, verb tenses and drill answers, for invited people. Saved to `reports` in Firestore
- [x] Vulgar words section on the regional page, shown only to invites with `vulgar: true`. Offensive words stay public with the reason explained. Vulgar ones say so publicly, and only this section says what they mean

### Content

- [x] Core nouns and adjectives toward the 5,000-word goal: 1,213 nouns, 526 adjectives and 45 adverbs in ten batches, reaching 2,300 nouns, 1,001 adjectives and 282 adverbs. Common words first, picked by checking candidate lists against the files
- [x] Prepositions, conjunctions, pronouns and question words: a Small words page and word type in vocabulary drills
- [x] Graded reading passages: 12 stories at A1, A2 and B1 on a Reading page, each with an English translation per paragraph, a word list and comprehension questions. Answers aren't saved to progress
- [x] 1,390 more sentences in five batches, extending every-person coverage in the six core tenses from the top 50 verbs to the top 110
- [x] 1,059 more sentences in four batches, extending that coverage to the top 158 verbs
- [x] 1,097 more sentences in four batches, extending that coverage to the top 206 verbs
- [x] 1,676 more sentences in six batches, extending that coverage to the top 278 verbs
- [x] 856 more sentences in three batches, finishing that coverage for all 314 verbs
- [x] Verb backlog batch 4: 25 verbs (`controlar` to `grabar`) with 893 sentences. Verbs 401 on go in the new `verbs-401-450.json`
- [x] Verb backlog batch 3: 25 verbs (`aguantar` to `contratar`) with 906 sentences
- [x] Verb backlog batch 2: 25 verbs (`sufrir` to `acudir`) with 902 sentences, including the gustar-type verbs `faltar`, `importar`, `interesar`, `encantar`, `molestar` and `preocupar`. Verbs 351 on go in the new `verbs-351-400.json`
- [x] Verb backlog batch 1: 25 common verbs (`desarrollar` to `avanzar`) with 904 sentences, every person in the six core tenses and one sentence or a "rarely used" note for the rest
- [x] 62 sentences replacing "rarely used" notes that were too cautious: the preterite of `odiar` and `parecerse`, the future of `merecer` and `rogar`, the present of `nacer` (no yo) and the conditional of `graduar`, plus better coverage for `errar`, `prever`, `contraer` and `rogar`. Their remaining rare tenses and persons are left out on purpose
- [x] Harder-to-miss request step on the account page: a "one more step" notice on the form, the two steps explained before signing in, and an explanation on the confirm-email screen
- [x] Vocabulary section on /progress: words started per list, from `stats/seen`, so it adds one read. Mastered per list would need reading every item or new counters, so it's left out
- [x] Flashcards: a drill mode of 20 cards at a time, in either direction, for all word lists and phrases, with noun topics. They count toward the schedule
- [x] Phrases are tracked as `vocab:phrase:<es>:<kind>`. They're flashcards only, even in Today's review, and only enter the schedule once you've seen them on a card, so Today's review never introduces one
- [x] "I don't know this" on typed vocabulary cards, gender and agreement included. It counts as a wrong answer and the word comes back
- [x] Speaker button on vocabulary cards: right away when the Spanish is already on screen, and only after answering when it's the answer
- [x] Writing drill: translate 10 sentences from the verb sentence files, either way, using the usual verb and tense choices. A match grades itself, ignoring punctuation and case. Anything else shows a model answer and the learner decides, because many translations can be right and there's no AI at runtime. Answers count toward totals and the streak, with one saved item per direction. They aren't scheduled
- [x] Improvement on /progress: "Accuracy by week" for all questions, from the day totals already loaded, and a Writing section with accuracy by direction and by week. Writing is saved per day in `days/{day}`, under `writing`, so neither adds a read. Rolling seven-day stretches from today, last six shown. Mix affects the overall figure: a week of harder drills can look like a dip
- [x] Dictation drill: hear a sentence from the verb sentence files and type it, with Play and Slower buttons. It plays on arrival, which is the one place speech comes before the answer, because the audio is the question. Punctuation and capitals don't count, accents do, and afterwards the missed words are underlined next to the translation. Sentences with digits are left out. Saved like writing, under `listening:dictation`, per day under `listening`, and not scheduled. Needs a Spanish voice, and the setup says so when there isn't one
- [x] Tap any word in a reading passage to look it up: the noun, adjective, adverb, small word or verb form it could be (every match, so "como" shows both), the story's own gloss, and a speaker. Verb forms name the tense and persons, and forms with attached pronouns (dime, decirlo) are found too. Invited people can add a match to their reviews: it goes in `stats/wanted` and comes first among new items in Today's review, still within the daily new-item limit. Verbs add the tense seen, and infinitives and gerunds add the present. The lookup loads on the first tap, not with the page
- [x] Recent mistakes on /progress: what you typed next to the answer, newest first, with "Missed N times" for repeats and a link to practice the latest 15. Kept on the day documents already loaded there, so it adds no reads. Only first tries and typed answers count, and long text is cut to 300 characters
- [x] Accent slips: right letters with a missing, extra or wrong accent (continues for continúes, fuéra for fuera) still show the correction, but don't come back, don't end the streak, and are left out of every correct percentage, in the session score and on /progress. They're counted on their own: an "Accent slips" tile and a weekly column under "Accuracy by week". When the accent turns the answer into another real word, it's wrong and says so: another form of the same verb (hablo for habló, hable for hablé), another word in the lists (papa for papá), or a common pair like tu/tú, el/él, que/qué, donde/dónde and esta/está. Dictation and writing check this word by word. The review schedule still treats a slip as Hard. Changing `accuracy()` applies to saved history too, so past percentages go up a little where slips were counted against them
- [x] Learn words: an ungraded flashcard mode next to Flashcards. Spanish first, English first or mixed, with the same word and topic choices. Back, Flip and Next, rounds of 20 with the option to carry on, and nothing saved. One face is shown at a time, because the first version stacked both faces in some browsers. The back has a speaker for the example sentence, and so does the back of a graded flashcard now
- [x] Sentence data split into one file per 50 verbs, so the default drill downloads about 54 KB instead of 170 KB (gzipped). Every lookup was compared before and after, with no differences

### Verification

- [x] Compare the engine with Wiktionary for all verbs: no real differences (llover's unused persons only). Re-run with `npx tsc -p tsconfig.test.json && node .verify/check.mjs`. It lives in a gitignored folder, works offline, and fetches only verbs it hasn't seen
- [x] Play through drills and a quiz in a headless browser, including the keyboard flow, accent buttons, retries and saved settings
- [x] Publish the new `firestore.rules`, then send a report while signed in and confirm it appears in `reports`
- [x] Test real sign-in (Google and email link), the invite check, and the published Firestore rules
- [x] Saved progress up to the Firestore call: real drills in headless Chrome (what's queued, retries not counted, the save at 10 answers, answers kept when a save fails), plus unit tests for the queue
- [x] Saved progress with a signed-in account: 64 real answers reached /progress
- [x] Saving and scheduling across several days with the real Firestore SDK, network off (`node .verify/store-sim.cjs "$PWD"` after `npx tsc -p tsconfig.test.json`)
