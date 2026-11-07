# Plan

Aprendalgo (aprendalgo.com), a Spanish learning app for me, friends and family. Latin American and Caribbean Spanish: ustedes instead of vosotros, voseo optional. Add to this as we go.

## Order of work

Content shouldn't hold up everything else: the remaining verbs (about 11,400 sentences) and the other ten tenses (about 19,000) add up to dozens of sessions. Classrooms mostly use the top 150 to 200 verbs, and all 689 already have the six core tenses.

1. Run the signed-in checks in "To verify", especially a second account's progress saving and real schedule writes. The teacher features build on these.
2. Ask the teachers the questions at the end of "Teacher classes". Their answers decide which teacher steps come first.
3. Get a native speaker to spot-check a sample of a few hundred sentences across files, so any repeated mistake is caught before 30,000 more sentences are written.
4. Present perfect and -ra imperfect subjunctive for the current verbs, about 4,450 sentences, starting from the most common verbs.
5. Teacher steps 1 to 4 (classes, class stats, assignments, gradebook), with verb batches in between.
6. The rest of the verb backlog and the remaining tenses over time, with the least drilled tenses, like the future subjunctive, last.

## How spaced repetition works

**No new dependency.** `src/lib/fsrs.ts` is our own, about 80 lines of pure math, checked against the expected values in py-fsrs's test suite. `ts-fsrs` is MIT, but it now brings in a dependency of its own and needs Node 24. The formulas are short and public.

Decisions:

- **Algorithm:** FSRS-6 with its 21 default parameters and 90% target recall. No optimizer, since we won't have enough reviews to tune it. `ts-fsrs` now defaults to FSRS-7, but FSRS-6 is what I've confirmed the formulas for.
- **What gets scheduled:** the existing tracked items, so `verb:hablar:preterite` or `vocab:noun:casa:gender`. Verbs are scheduled per tense, and each review picks a person. Guide quizzes stay out at first, because their IDs are question positions that shift when a quiz is edited.
- **Grades:** correct is Good, accent slip is Hard, wrong is Again. Flashcards are the one place people grade themselves: "Knew it" is Good and "Didn't know" is Again, on the same item as the typed question. That can flatter a word, and typed drills stay the stricter test. There's no Easy.
- **Days, not minutes:** the first answer to an item each day moves its schedule, and later ones only count toward stats. This matches "only the first try counts", drops FSRS's minute-based learning steps, and means a re-sent batch can't move a schedule twice. A missed item comes back in the session as it does now, then the next day.
- **Every drill feeds the schedule:** free practice updates an item too, so Today's review stays honest.
- **Limits:** 10 new items a day by default, per person. Reviews are capped at 50 a day by default (up to 100), most overdue first, so a week away doesn't bury anyone.
- **New item order:** the most common verbs and their simplest tenses first, then words. Tally-only items from before launch start fresh at their next review.

How a day's Today's review adds up:

- **Size:** due reviews up to "Reviews per day" (default 50; 25, 50 or 100 on the account page), plus new items up to "New items per day" (default 10; 5, 10 or 20). These are separate limits, so a full day is 60 cards. Missed cards then come back 3 cards later until they're right, so the session can run past 60. Only the first try moves a schedule, and the results screen notes that retries count more than once.
- **Leaving partway through:** nothing starts over. Answers queue in localStorage and save every 10 answers and when the tab is hidden. Opening Today's review sends anything still queued (waiting up to 5 seconds), then rebuilds the session from Firestore, so answered cards are gone and the remaining limits shrink. Only the unfinished run's score and pending retries are lost. A missed card is already graded Again and comes back the next day.
- **Free practice in between** uses up the same limits, and anything due that it covers is no longer due, so Today's review gets shorter.
- **Offline:** if the save doesn't finish in time, an answered card can show up again. Answering it twice is harmless, since only the first answer each day moves a schedule.
- **Load over time:** reviews thin out as intervals grow. New items are what keep the daily load up, so lowering "New items per day" is the main way to make sessions shorter.
- **The overdue pile can grow without end.** Seen on a real account: 343 due with 50 reviews a day. A new item comes back after about 1, 3 and 7 days, so 10 new items a day ask for more than 50 reviews a day for weeks, and every extra day adds more than the cap clears. Planned fix: skip new items while more reviews are due than the day's limit allows, so the pile shrinks by about 50 a day and new items resume once it's under the limit. This needs `loadToday` to load one more due item than the maximum (to tell "more than a day's worth"), a change to `pickToday` in `schedule.ts`, a test, and a line on Today's review saying new items are paused and why. Until then, "New items per day" at 5 or "Reviews per day" at 100 slows the growth

Where things are:

- Saving reads each item's schedule first, about 10 extra reads per batch, then writes stability, difficulty and due day to its `items` doc. `firestore.rules` already covers this.
- `stats/seen` lists every scheduled item, so finding new ones takes one read. `days/{day}` counts new items and reviews against the daily limits, and `stats/settings` holds the new-item limit, set on the account page.
- `reviewCard` in `card-decks.ts` rebuilds a card from an item ID and skips IDs whose word no longer exists. Verb items alternate between conjugation and fill-in-the-blank.
- New items from free practice count toward the daily limit too, because they add the same review load.
- "Mastered" is now stability of 21+ days, not 5 correct answers. Clicking the Mastered tile on /progress lists them: verbs by tense, words by word list (`loadMastered` in `progress-store.ts`, fetched only when opened).

Cost check: a heavy day for one person is about 100 reviews, or roughly 100 reads and 120 writes. The Spark plan allows 50,000 reads and 20,000 writes a day across everyone.

## Content backlog

- [ ] Goal: about 5,000 words in all, roughly 2,300 nouns, 1,000 adjectives and 1,000 verbs, with adverbs already enough at about 250. The split is a rough estimate of how a list of the 5,000 most common words breaks down, from memory and not checked against a source. Common words come first, so regional and specialist words don't count for as much as their number suggests. Now about 4,435: 2,300 nouns, 1,001 adjectives, 282 adverbs, 159 small words, 689 verbs
- [ ] Insults and words for disabilities (idiota, estúpido, imbécil, cojo, manco, enano), left out of the word batches on purpose. Add them with a note on why they offend, per the vulgar and offensive word rules in "How content gets added"
- [ ] More verbs toward the goal: about 310 left. Slower than words, because each needs sentences for every tense. Work from `verb-backlog.md`, which lists 355 candidates in 15 batches of 25 (batch 30 is 5), already checked against `verbs.json`, including more reflexives and regional verbs. A batch takes about 900 sentences. Batch 16 crosses verb 700, so it needs `verbs-701-750.json`
- [ ] Audit English glosses for common synonyms. A typed English answer only counts if it matches a listed meaning, so `basura` = "trash" marked "garbage" wrong, and `abuelito` = "grandpa" didn't accept abuelo, since abuelo was only "grandfather". Fixed so far: basura and basurero (garbage), abuelo and abuela (grandpa, grandma), mamá and papá (mother, father). The rest of the word lists likely have more
- [ ] More phrases and regional expressions, labeled by country. Now at 162
- [ ] More regional words, and more countries in the existing entries
- [ ] More reading passages. Now at 12, with 4 each at A1, A2 and B1
- [ ] Example sentences for every person of every verb, so all conjugation cards can show one. About 19,000 remain, all in tenses drilled far less, so this needs batches and a usage check before each one. All 689 verbs are done in the six core tenses, apart from about 420 forms left out on purpose: forms with no natural sentence, like `yo naceré`, all of `nevar`, `granizar` and `lloviznar` beyond él, `suceder`, `surgir`, `bastar`, `durar`, `corresponder`, `consistir`, `florecer`, `tronar`, `helar`, `brotar` and `oscurecer` beyond él and ellos, `significar` beyond él and ellos in the future, conditional and present subjunctive, or the yo and nosotros forms of `interesar`, `encantar` and `preocupar` where they'd sound forced, and tenses marked rare, like most of `oponer`, `desoír` and `soler`. Next would be the present perfect and the -ra imperfect subjunctive, about 4,450 sentences between them, starting from the most common verbs
- [ ] Add proverb of the day

## Levels

Beginners and advanced learners used to get the same drills. A level (A1 to B2, the same as readings) now sets the drill's starting tenses and verbs. It never locks anything.

- [x] Step 1: the level question and drill defaults. Asked on /drill for everyone, and on every page for signed-in people without one (their account's saved level is checked first). "Not now" skips it for the visit. Saved in this browser (`level` in localStorage) and on the account in `users/{uid}/stats/settings` as `level`. Choosing or changing a level resets the drill's tenses and verb pool to match: A1 present, top 25 verbs; A2 adds preterite and imperfect, top 100; B1 adds present perfect, future, conditional and present subjunctive, top 300; B2 every tense, all verbs. Changed on the Drills page. Defined in `src/lib/level.ts`
- [x] Step 2a: word levels. Every noun, adjective, adverb and small word has a level in `src/data/vocab/levels.json` (A1 559, A2 701, B1 1,244, B2 1,238). A1 was picked by hand from beginner topics (family, food, home, body, clothes, time, school, town, colors, nationalities, basic pronouns and prepositions). The rest follows an OpenSubtitles frequency list (CC BY-SA, kept local in `.verify/freq/`, not committed), with words that subtitles overrate (crime, war, police dramas) moved down and everyday ones (toalla, cebolla, lavadora) moved up. Vocabulary, flashcards and Learn words only use words up to the person's level, and phrases are always included. Today's review now introduces new words easiest level first, for everyone. A word missing from the file counts as B2, and a test fails until it's given a level
- [ ] Step 2b: tag guides by hand, and limit writing and dictation sentences by their tense (they already follow the drill's tenses, which the level sets)
- [ ] Step 3: suggest the next level on /progress after about 85% right on the level's tenses over a few hundred answers, and show level-ups on the trend
- [ ] Step 4, if beginners still struggle: multiple choice before typing, or a "show the pattern" hint that counts as a miss
- A level changed on one device doesn't reach another device that already has one, since the account is only read when this browser has no level. Fine for now; sync on sign-in if it causes confusion

## Course

- [x] Framework (2026-11-05): `/course` lists the chapters by level, with the level's first unfinished chapter suggested, and `/course/[id]` walks through the steps. Chapters are defined in `src/data/course.json` (tenses, model verbs, verbs, drills, 12 to 25 words picked from the existing lists at the chapter's level, and the guide with optional sections and quiz questions by position). Steps without content are left out: no guide means no Learn or Quiz, and no model verbs means no See it. Practice is 15 questions, Write is 6 sentences both ways, and the checkpoint is 15 questions (6 verb, 5 quiz, 4 words typed in Spanish; parts without content give their share to the others) with no retries, passing at 80%. Answers count toward stats and the review schedule like any drill, and quiz questions keep their guide position, so they're the same saved item. Progress is kept in localStorage (`course-progress`, `src/lib/course-progress.ts`) and, signed in, merged into `users/{uid}/stats/course` in a transaction: steps add up, the best score and earliest finish win, and tries (last 20) are kept. It syncs on sign-in, on opening a course page or /progress, and after each step, and clears on sign-out. /progress has a Course section with each chapter's first try, best and finish date. The home page has a Course card that becomes "Continue the course", and the nav has a Course link. Tests in `course.test.ts` check the data and decks. `.verify/browser/course.mjs` runs chapter 1 from See it to a failed and then a passed checkpoint, signed out
- [x] Content (2026-11-05): seven new guides with quizzes, so every chapter now has Learn and Quiz: present regular, present stem changes and irregular yo, gustar, preterite regular, preterite irregular, imperfect, and imperfect subjunctive with si clauses. Every quiz answer with a verb hint like `(hablar, yo)` was checked against the engine, but the grammar and phrasing are my own and need the same read as the other guides (see "To verify")
- [x] The pluperfect is labeled "Pluperfect / Past perfect" and the pluperfect subjunctive "Pluperfect / Past perfect subjunctive" on tense cards and in drills. The perfect-tenses guide gives both names for each, and so does chapter 18 for the pluperfect
- [x] Two more chapters (2026-11-05), for 20 in all: nouns, articles and adjectives as chapter 2 (gender, articles, plurals, agreement and placement, possessives, demonstratives), and idioms and everyday expressions as chapter 20 (tener and hacer expressions, everyday idioms, se me olvidó, reactions, sayings), each with a new guide and a 15-question quiz. Chapters can now practice `gender` and `agreement` on their own words instead of verb forms, and list phrases as words (`phrase:...`), which are flashcards only and left out of the typed checkpoint questions. Chapter 2 has Learn, Words, Quiz, Practice and Checkpoint; chapter 20 has Learn, Words, Quiz and a checkpoint made of quiz questions. Progress is saved by chapter ID, so inserting chapter 2 renumbers the rest without losing anything
- [x] Short lessons (2026-11-05), marked `"lesson": true` in `course.json`: Learn, Quiz, and a checkpoint of quiz questions, with no words or practice. Numbers, dates and time (A1), por vs. para: the basics (end of A1, a new present-tense-only guide), comparisons (start of A2), por vs. para: more uses (end of A2, the full existing guide, which uses past tenses and adds duration, on behalf of, the passive and meaning changes), and relative pronouns (B1). The idioms chapter moved from the end of B2 to the end of B1, since most of it is everyday material. That makes 25 chapters and lessons in all
- [x] Gustar and preterite vs. imperfect practice (2026-11-05). Chapter 14 uses a new `choose` drill: fill in the blank with the tense hidden ("Preterite or imperfect?"), saying which tense the sentence takes after answering. Gustar keeps fill in the blank, which needs the sentence to choose gusta or gustan, and gustar-type verbs (gustar, encantar, interesar, importar, molestar, faltar, doler) now say "agreeing with one thing" or "agreeing with more than one thing" in place of "él / ella / usted" and "ellos / ustedes", everywhere fill in the blank is used
- [x] Quizzes everywhere (course, guide quiz pages, Grammar in Drills) no longer link to the guide, so a stray tap can't end a quiz, and the chapter page hides "All chapters" during a session. Every quiz question names its guide rule (`rule` in `guide-quizzes.json`, matched by word overlap and then checked by hand), and a wrong answer shows that rule's tile under the card, like a missed verb's tense table. The reason still shows on every answer. A test checks each named rule exists
- [x] Finishing the last chapter of a level offers that level ("Set my level to A2"), when the saved level is lower or missing. Asked, not automatic, because it also resets the drill's tenses and verbs. "Not now" hides it for the visit
- [x] English-to-Spanish word questions accept an adjective's feminine form (bonita for "pretty"), still showing the masculine
- [x] Section exams (2026-11-05): each level ends with an exam at `/course/exam/a1` and so on, listed as the last row of its level on /course. 40 questions (`EXAM_SIZE`) from the quizzes of every chapter at the level, spread evenly (5 or 6 a chapter at A1 to B1), a question two chapters share counted once. No retries, 90% passes (`EXAM_PASS_SCORE`, above the checkpoints' 80%, since it stands for the whole level), always open like chapters. B2 ends the course, so its exam is 30 questions from its two chapters plus 10 review questions from A1 to B1, each from a different chapter (`EXAM_REVIEW`). Until the B2 quizzes grow, its own part is capped at their 27 questions. Tries are kept in the course progress under `exam:A1` and so on, so they save, merge and sync like checkpoints with no rules change, and show on /progress in the Course table. The level badge now comes from passing the exam, not from finishing every chapter, and the course star needs every chapter and every exam. Badges already saved to `stats/badges` the old way stay. Finishing a level's last chapter now points to its exam, and the "Set my level" offer moved to the passed exam. `.verify/browser/exam.mjs` runs a failed and a passed A1 exam, signed out
- [x] Drawn quizzes (2026-11-05), the code half of bigger quizzes: the chapter quiz step and the guide quiz page ask 12 questions (`QUIZ_RUN`) when a quiz has more, and the quiz step, checkpoint and exams all ask the least recently asked questions first. This browser keeps each guide's asked positions in localStorage (`quiz-seen`, `src/lib/quiz-seen.ts`), noted as each card is dealt. Grammar in Drills still asks every question of the chosen guides. Most quizzes have 12 to 15 questions, so this only changes much once they grow
- [x] Practice without repeats (2026-11-07): Practice, Write and checkpoints never ask the same question twice in a run (a missed one still comes back), and a chapter with too few questions gives a shorter step instead of repeating. Before, practice picked at random, so ser and estar (10 forms and 10 sentences) and the near future (ir only, 5 and 5) repeated a lot, sometimes back to back. Ser and estar now practices with a new `chooseVerb` drill: a sentence with the verb hidden and only the person given, so you decide between ser and estar and type the form, instead of conjugating ser, which felt like the quiz again but easier. Chapters can add their own sentences in `src/data/course-sentences.json`, used only for their practice, writing and checkpoint, since the sentence bank keeps one sentence per person for verb pages and tense tables. Ser and estar have 20 each (each written to take only its verb), and the near future has 20 for ir, mostly ir a plans. A test checks each has the right form and isn't already in the bank. `.verify/browser/practice.mjs` plays both practices. A2 chapters have 90 to 144 practice questions each, so they only needed the no-repeat fix
- [x] Bigger quizzes, so a retake isn't a memory test: grow each guide quiz to about 30, and more examples where a rule has only one or two. A1 done (2026-11-05): 141 new questions across its 8 guides, which now have 30 to 35 each, and chapter 7 (near future) now uses 16 of the future guide's questions instead of 6. A2 done (2026-11-07): 146 new questions across its 8 guides, which now have 29 to 33 each. Every typed verb answer was checked against the engine, but the Spanish and the explanations are my own and need the same read as the other guides. Preterite vs. imperfect questions each have a time word or context that should rule out the other tense, but that's worth a native read too. B1 done (2026-11-07): 113 new questions across commands, the perfect tenses, relative pronouns, the subjunctive and idioms, which now have 30 to 36 each (the future guide was already at 30). Chapters that use part of a guide got the new questions for their sections: present perfect (chapter 18) now has 25, present subjunctive (21) 19 and subjunctive uses (22) 33. The perfect tenses guide's last 7 questions (pluperfect, future and conditional perfect, si clauses) are for B2's chapter 25. B2 done (2026-11-07): 20 new imperfect subjunctive questions, for 34, so the B2 exam now has a full 30 of its own questions plus 10 review. That finishes the course: 420 new questions in all, every course guide has 30 to 36, and chapter quiz pools run from 16 (near future, a part of the future guide) to 35. The one quiz left small is gender and plurals (13), which no chapter uses, only Grammar in Drills. The future guide's later questions also serve chapter 19. Question positions stay fixed, so saved items still match: only add to the end of a guide's list. Each new question names its `rule`, and a test already checks it exists. Chapters that pick questions by position (near future, present perfect, present subjunctive, subjunctive uses) need new positions added to their `quiz` list in `course.json` to use new questions

A step-by-step path through Spanish grammar, chapter by chapter, with progress saved as you go. It's modeled on the format of workbooks like *Advanced Spanish Step-by-Step*: one topic per chapter with explanation, examples, vocabulary, quizzes and writing. It doesn't use their content. The chapter order, explanations, sentences and exercises are our own, since the book's text and exercises belong to the publisher. Most of the parts already exist (guides, quizzes, sentences, levels, drills), so this mostly ties them together.

Each chapter is a short series of steps, done in order:

1. **Learn:** a short lesson. Use an existing guide where there is one, or write a new one.
2. **See it:** the conjugation pattern, plus example sentences from our sentence bank for that tense.
3. **Words:** 15 to 25 words for the chapter's theme, taken from the existing lists at the chapter's level. No new words needed.
4. **Quiz:** the guide quiz.
5. **Practice:** a conjugation drill and a fill-in-the-blank drill, locked to the chapter's tense and the level's verbs.
6. **Write:** translate 5 to 10 sentences, graded like the writing drill.
7. **Checkpoint:** a short mixed test. Passing (say 80%) marks the chapter done, and you can retake it.

The chapter list, in our own order matching most first- and second-year courses, lives in `src/data/course.json`.

Por vs. para, comparisons, relative pronouns and numbers go in as short extra lessons between chapters, or as sections inside the chapter where they fit.

How it works:

- **Where:** a new `/course` page listing chapters with progress (not started, in progress, done, checkpoint score), and a chapter page that walks through the steps. A "Continue" button on the home page goes to the next unfinished step.
- **Open order:** every chapter stays open, and the level only suggests where to start (A2 starts at chapter 6). The next chapter is highlighted, not locked. Locking frustrates people who already know some of it.
- **Saving:** progress is saved to `users/{uid}/stats/course` as `{chapterId: {steps: [...], best: score, done: day}}`. One small doc, already covered by the rules. Signed-out people keep progress in localStorage, and it moves to the account when they sign in.
- **Review:** drill and quiz answers inside chapters count toward progress and spaced repetition like any drill, so chapter work feeds Today's review.
- **Trends:** checkpoint scores and finish dates go on /progress (chapters done over time), in line with showing improvement and not just totals.
- **Teacher classes:** chapters could later be assigned like any other assignment.

Effort, roughly:

- The course framework (pages, steps, saving, checkpoint): 1 to 2 sessions.
- Content: about 7 new guides with quizzes, chapter word picks, writing sentences and checkpoint questions: 2 to 3 sessions.
- Tenses past chapter 12 need more example sentences, which ties in with the sentence backlog. The present perfect and -ra imperfect subjunctive batches come first there.

Best after levels step 3, since chapters lean on levels for words and verbs.

## Badges

Rewards for learning, not activity: no XP, leagues or global leaderboards, which reward redoing easy material and pull against spaced repetition and accuracy. Badges are private and show improvement over time.

- [x] First set (2026-11-05), 44 badges defined in `src/lib/badges.ts` and drawn by `src/components/Badge.tsx`:
  - A medal for each chapter and short lesson (25), numbered and colored by level, earned by passing its checkpoint
  - A shield for each level (A1 to B2), for passing its section exam (until 2026-11-05, for finishing every chapter at it), and a star for every chapter and exam
  - Rosettes: 7, 30 and 100 days in a row; drill streaks of 25 and 50; 25, 100, 250, 500 and 1,000 items mastered (all types together); and a comeback, a checkpoint retaken from under 80% to 90% or more
  - Where: a Badges section on /progress (earned, newest first with dates, and "Next up" with a few locked ones), the chapter's done panel (its medal, and the level shield when it finishes a level), and the chapter list (a medal on each finished chapter, and each level's shield beside its heading, gray until earned). Chapter and level badges work signed out, from the browser's course progress
  - Dates: chapter, level, course, comeback and drill-streak badges take the day from the data. All earned badges are saved to `users/{uid}/stats/badges` the first time /progress sees them, so a days streak or mastered count keeps its badge after the streak ends. The days streak only looks at the last 120 days loaded
  - Art: inline SVG, no image files. A shape per tier (medal, shield, star, rosette), colors from the `--hue` accent scale so dark mode works, and a number, level or icon (flame, bolt, arrow, star) in the middle. Locked badges are gray. Adding a badge is one entry in `BADGES`. Illustrated art, if ever wanted, would go in `public/`, served by Amplify, not S3
- [ ] Mastered milestones by type (100 words, every core tense of the top 50 verbs). Counting mastered items by type needs a count query on a range of item IDs plus stability, which may need a Firestore index, or counters kept on save
- [ ] A weak spot that's no longer weak. Needs accuracy by tense stored per week
- [ ] A small celebration when a badge is earned mid-drill (today they show up on the next visit to /progress or the chapter page)
- [ ] A longest-ever days streak, so badges past 100 days don't depend on the 120 days loaded

## Beyond B2: C1/C2 (idea, not started)

B2 already turns on every tense, every verb and every word, so the app has no grammar left to unlock. What the C levels add is nuance, register and longer, natural Spanish. One top level, "Proficient (C1/C2)", covers both. C2 is near-native, and drills alone can't get anyone there or test it, so the content aims at C1 and the label is honest about the rest being up to real use.

- [ ] The level: a "C1/C2" entry in `LEVELS` (`src/lib/level.ts`), starting like B2 with every tense and verb. `levels.json` gets a C1/C2 bucket for rarer words once the lists grow past the 5,000-word goal; until then anything unlisted still counts as B2. The level question gets a fifth choice
- [ ] Advanced chapters, using the course framework as it is:
  - Passive voice and the uses of se (impersonal, passive, accidental)
  - Sequence of tenses and reported speech (dijo que vendría, me pidió que fuera)
  - Aunque, como and mientras with the indicative or subjunctive, where the choice changes the meaning
  - Linking words for writing and argument (sin embargo, por lo tanto, no obstante, en cambio)
  - Register: tú, usted and vos across countries, formal and informal writing
  - Diminutives and augmentatives (ahorita, cafecito, grandote)
  - The future subjunctive, only to recognize it in legal language and sayings (sea lo que fuere)
- [ ] Readings at B2 and C1/C2: longer passages, opinion pieces, and dialogue with regional slang. Readings stop at B1 now, so this is the biggest gain for advanced learners. Needs B2 and C1/C2 entries in `LEVELS` in `src/lib/readings.ts`
- [ ] Dictation at natural speed with longer sentences, as an option
- At these levels most learning is writing and speaking with feedback, which the app can't give without AI at runtime. That's what "Conversation or writing practice with Claude" in "Later" would add, and the one part with a running cost
- Effort, roughly: the level and chapter changes are small; chapters take about one content session per 3 or 4 guides, and readings about one session per 4 passages. Best after the remaining verb and sentence work

## Later

- [ ] More audio, after the word lists pass the phone check in "To verify": example sentences on regional pages, then reading passages a sentence at a time. Verb page sentences and drill sentences have it already
- [ ] Better text-to-speech if the device voices aren't good enough: generate audio files once and serve them as static files, so there's no runtime API key
- [ ] Conversation or writing practice with Claude (would need an API key)
- [ ] Optional voseo in drills
- [ ] Split the word lists like the sentence files if vocabulary drills feel slow to start on a phone. Starting a vocabulary, flashcard or review drill now downloads all of them, about 140 KB gzipped (nouns 96, adjectives 35, adverbs 10), up from about 65 KB
- [ ] Verb of the day on the home page. Left out of the color pass because the home page is prerendered, so it would need to be picked in the browser
- [ ] Our own auth email link page (say `/auth/action`), so links in Firebase emails point at aprendalgo.com, not firebaseapp.com. It must handle every `mode` Firebase sends: `resetPassword` (confirmPasswordReset), `verifyEmail` (applyActionCode), `recoverEmail`, and probably `signIn` for email links (check the Firebase docs before building). Only then set it as the Custom action URL under Authentication → Templates, because that one setting applies to every email. Try it if iCloud still drops mail after the custom sender domain, since the sender, not the link, is the main fix

## Waiting on feedback

- [ ] Should the drill streak carry over between drills? Now it resets on a miss and also whenever a drill ends or changes: finishing a deck, "Change settings", switching drill type or reloading. I'm leaning towards keeping it going, because that encourages people to keep practicing. Ask: "Right now your drill streak resets when you finish or switch drills. Would you rather it kept going until you get one wrong, even across drills and days?" There are two options: carry it across drills but reset at midnight, or carry it until a miss, even across days. The second can blur into the days streak tile, and someone who rarely practices could build a big number slowly. The on-screen chip and the saved record should follow the same rule. Switching only changes when the streak resets in `DrillRunner.tsx`. The saved record keeps the higher number either way, so earlier records stay valid

## Teacher classes (idea, not started)

One teacher asked for a way to follow their students' progress, and another uses Conjuguemos. What Conjuguemos offers that we don't is the teacher side: assignments, scores under each student's name, a gradebook with export, and teacher-made lists and quizzes. On the learning side we're ahead (spaced repetition, guides, readings, audio, dictation, writing). So the plan is to add the teacher side in steps, each useful on its own. At last check Conjuguemos was free with limits (5 teacher-made activities, 25 stored grades), $45 a year for Premium, and $45 per school plus $5 per teacher a year for districts. That's the price teachers will compare against.

No server is needed for any of it, and it stays on the Spark plan at first.

1. **Classes and join codes.** A teacher (a `teacher: true` field on their invite, set by hand like `vulgar`) creates a class and gets a short join code. A student enters the code on their account page, picks the name the teacher will see (so their email isn't shown), and can leave.
2. **Class-wide stats.** Anonymous totals for the whole class, described below.
3. **Assignments.** The teacher picks something the app already has: verbs and tenses, a word list or noun topic, a guide quiz, a reading's questions, or a list or quiz of their own (steps 5 and 6). Then they set the length, a due date, and either practice or a single try for a score. Students see open assignments on the home and account pages, and the drill starts with those settings locked. The result (score, accuracy, accent slips, time spent, finished at) is saved to `classes/{id}/assignments/{aid}/results/{uid}` under the student's class name. Assignments still feed the student's own progress and review schedule like any drill.
4. **Gradebook and export.** A teacher page with a table of students against assignments: scores, late work and missing work flagged, and a click-through to one student's results for one assignment. Export to CSV is built in the browser and opens in Google Sheets and Excel. Ask teachers which gradebook they use (Google Classroom, PowerSchool, Canvas, Schoology) so the columns import cleanly. Posting grades straight into Google Classroom would come later and needs Google's API approval.
5. **Teacher word lists.** A teacher builds a list by searching the app's words and ticking them, or adds their own word with its English meaning. Lists are saved under `classes/{id}/lists` and can be used in assignments, flashcards and Learn words. A teacher's own words have no example sentences, so they get meaning drills and flashcards but not fill-in-the-blank. Tests don't check them, so show them as the teacher's own.
6. **Teacher quizzes and tests.** Multiple choice and typed questions in the guide quiz format, plus questions built from the app's data, like "conjugate tener in the preterite for nosotros", graded the same way as drills, accent slips included. Lists and quizzes can be grouped into units ("Capítulo 3"), so a teacher can lay out the term to match their textbook.
7. **Ready-made units.** More quizzes and tests by chapter-style themes and grammar (family, food, school, the preterite, the subjunctive), in the order most first- and second-year courses follow. They should match a textbook's topics and grammar without copying its lists or exercises, which belong to the publisher. Later, teachers could share their units with each other.

**Study groups**, for friends and family as well as classes. Small and opt-in, with mild competition on effort and mastery, never on raw activity. Built on the same join codes and display names as step 1, so it comes with or just after it:

- Anyone signed in can start a group and share its join code. Members pick a display name, can leave any time, and are told exactly what the group sees. Up to about 20 people
- A weekly board, reset each Monday: days practiced, chapters finished, items newly mastered, and badges earned. Nothing else: no accuracy, mistakes, history or reviews, so nobody is ranked on what they got wrong
- Each save also writes the member's weekly totals to `groups/{id}/members/{uid}`, one extra write per save per group. Rules let members read their own groups and write only their own member doc
- Totals are worked out in the browser, so they can be faked. That's fine among friends, and the board is for encouragement, not prizes
- Under-13 students and school use follow the same privacy rules as classes

Named results change the privacy picture, so:

- Only assignment results carry a name, only in classes the student joined. The teacher never reads the rest of the student's account: not their history, mistakes, reviews or free practice. Rules allow a student to write only their own result and the teacher to read results only in their own classes.
- Scores are worked out in the browser, so a determined student could fake one. That's fine for homework and practice, but teachers should be told not to count heavily on it for big tests. Grading on a server would fix this, at the cost of server routes.
- Grades are education records under FERPA. Many districts need a signed data privacy agreement before teachers can use an app, and under-13 students need the school's consent under COPPA. Sort these out before any class under 13 and before any school or district deal, along with "Before opening up" below.

Class-wide stats, anonymous by design:

- Each time a student's progress saves, the same batch also adds to the class's own totals in `classes/{id}/stats`. That's one extra write per save. The teacher only ever reads the totals, so the stats are anonymous by design, not just hidden in the page. Students are told when they join.
- The teacher's page reuses the progress page parts: accuracy by tense, weak spots, recent mistakes and a weekly trend, plus how many students practiced this week.
- Show nothing until at least 5 students have joined and practiced, since totals can still point to one person in a small class.
- Show mistakes grouped with counts, like "7 students wrote hablé for habló", and leave out mistakes only one student made.
- Leave writing and dictation mistakes out, since free text could contain anything, including names.
- Open question (2026-11-04): the user may want teachers to see each student's own mistakes, not just class totals. That reverses "the teacher never reads … mistakes" above, so it needs a decision, rule changes and student notice. Mistakes a student removed are only marked in `hiddenMistakes`, so they'd still be there to show.

Questions for the teachers first: what do they actually grade in Conjuguemos, how old are the students, how many are in a class, which textbook do they use, which gradebook do grades go into, how do students sign in (school Google accounts often block outside apps, so email link may be the way), and what would they look at each week?

## Opening sign-ups and paying for it

The app started as invite-only for friends and family. Sign-ups opened on 2026-11-04: anyone signed in with a verified email can save progress (`canSaveProgress()` in `firestore.rules`), and the request-access form is gone. Invites now only unlock extras like `vulgar`. The checklist below still applies before promoting it widely.

- **Costs are small for a long time.** A heavy day for one person is about 100 reads and 120 writes. The free tier (50,000 reads and 20,000 writes a day across everyone) covers roughly 150 heavy users a day. Past that, the Blaze plan keeps the same free tier and charges per use, around $0.18 per 100,000 writes and $0.06 per 100,000 reads at last check (confirm current prices). 1,000 heavy users a day would be under $10 a month. Hosting stays on AWS Amplify, which bills separately for build minutes, data served and server-rendered requests. Most pages are prerendered, so that should stay small too, but set an AWS Budgets alert alongside Firebase's. On Spark, going over the limit makes saves fail for the rest of the day rather than costing money.
- **What would really cost money:** conversation practice with Claude (in "Later") and generated audio. Those, not the database, are where a subscription would come in.
- **Before opening up:**
  - A privacy policy and terms.
  - A minimum age of 13, unless the school route is set up properly. Under-13 accounts need parental consent under COPPA.
  - Firebase App Check against scripted abuse.
  - Budget alerts if on Blaze.
- **Paying for it, if needed:** free for learners, with a paid teacher or class plan, is common for school tools and keeps learners unaffected. Taking payments (Stripe) would need server routes and webhooks, which Amplify can run. Not worth building until costs are real.

## To verify

- [ ] Signed in with some mastered items, click the Mastered tile on /progress and confirm the list matches the number on the tile (words count once however they're asked, so the list can show fewer entries than the tile). It runs one `stability >= 21` query ordered by stability, which shouldn't need an index, but hasn't run against real Firestore
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
- [ ] Publish the new `firestore.rules` (open sign-ups), then sign in with a second account that has no invite and confirm its progress saves straight away. Also confirm your own account still saves. The rules can't be tested here
- [ ] On /account, create an email/password account, sign out and back in, and try "Forgot password?". Password accounts save progress without verifying their email, but only verified emails can read their invite (for `vulgar`). The form hasn't been seen in a browser
- [ ] Set the Firebase Auth email templates to send from aprendalgo.com (Authentication → Templates → Customize domain, then add its DNS records). iCloud silently drops mail from the default firebaseapp.com sender
- [ ] Check Weak spots on /progress with a signed-in account: miss a verb and a question type at least 5 times each, then use "Practice this". Verb and mistake-type stats only count answers from now on, and the section hasn't been seen with real data
- [ ] Use Today's review with a signed-in account: confirm its cards still show sentences now that it loads only the sentence files for its verbs. Finish a session, check an item in `users/{uid}/items` has `stability` and `due`, and check `/progress` shows what's due the next day. Real Firestore writes of schedules haven't run yet
- [ ] Signed in, do a flashcard session with some phrases and tap "I don't know this" on a typed card. Confirm the Vocabulary numbers on /progress go up, a phrase comes back in Today's review as a flashcard, and it's due sooner after "Didn't know" than after "Knew it". None of this has run against real Firestore, and the Vocabulary section has only been seen with made-up data
- [ ] Signed in, do a writing session in each direction. Confirm the Writing section appears on /progress with the right counts, and that "Accuracy by week" looks right against your history. Neither has run against real Firestore
- [ ] Do a verb drill, then a vocabulary drill, and confirm "Accuracy by tense" stays. A save with no verb answers used to erase it. The fix is confirmed against the Firestore SDK offline, not yet against real Firestore
- [ ] Try a backlog of 25 different items at once, because Firestore rules allow 20 lookups per batch and the docs say repeated lookups are cached, but that isn't confirmed (the rules no longer look up invites, so this mostly matters if a lookup comes back)
- [ ] A save interrupted by a closed tab can be sent twice, which overcounts stats slightly. Accepted, since the alternative was losing answers
- [ ] Read the grammar guides and their quizzes for accuracy. Tests check the structure, not the grammar
- [ ] Unknown verb URLs returned 200 on first request and 404 after. Harmless so far
- [ ] Signed in, open /progress and check the practice calendar and the accuracy line against your real history, including tapping a week on a phone. They've only been seen with made-up data
- [ ] Signed in, tap a word in a reading and use "Add to my reviews". Confirm `stats/wanted` gets the item, the panel then says it's added, and the word comes up first among new items in Today's review. Only seen signed out
- [ ] Signed in, miss a few typed answers (one with "I don't know this", one in dictation), then check "Recent mistakes" on /progress and its "Practice the latest" link. Mistakes are saved on `days/{day}` under `mistakes`, and none has reached real Firestore yet. Also check the Listening section after a dictation session
- [ ] Try dictation on a real phone. On iPhone, the first sentence may not play until you tap Play once, because Safari can block speech that isn't started by a tap. Note whether it then plays on its own for the rest of the session
- [ ] Skim `src/data/vocab/levels.json`, especially A1 and A2, for words at the wrong level. They're my judgment plus subtitle frequency, not a textbook list. Moving a word is just moving it between arrays; the test checks each word appears once
- [ ] Signed in, clear `level` from localStorage (or use a new browser) and confirm the level question appears on any page, choose one, and check `users/{uid}/stats/settings` gets `level`. Then clear localStorage again and confirm it's loaded from the account without asking. Only seen signed out (`.verify/browser/level.mjs`)
- [ ] Signed in, remove a recent mistake on /progress, reload, and confirm it stays gone and `days/{day}` has it under `hiddenMistakes`. Also try Undo, and "Report a problem" on a mistake. Not run against real Firestore
- [ ] Course saving signed in: confirmed on 2026-11-05 that checkpoint tries reach `users/{uid}/stats/course` in real Firestore. Still to check: the Course section on /progress, a step done signed out moving to the account after signing in on /account, and the course list starting empty after signing out
- [ ] Writing drill, into Spanish: a near miss now underlines the words that differ from the model answer, and says when an accent makes another word (cuanto for cuánto). Only checked in code, not seen in a browser
- [ ] Preterite vs. imperfect practice (chapter 14) hides the tense, but the sentences were each written for one tense, and some may read fine in the other (llovía or llovió). Play through it and note sentences where both work; the fix is a clearer time word in the sentence
- [ ] Signed in, open /progress and check the Badges section, and that `users/{uid}/stats/badges` gets a day for each earned badge. Then reload and confirm the days don't change. Not run against real Firestore
- [ ] Signed in, take a section exam and confirm `exam:A1` (or whichever level) reaches `users/{uid}/stats/course`, the exam shows in the Course table on /progress, and passing adds the level badge there. Only run signed out
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
- Invites: no longer needed to save progress. To give someone an extra like `vulgar`, make a document in `invites` keyed by their lowercase email. Old requests with `added: false` can be deleted.

## Local checks

These live in `.verify/`, which is gitignored, so keep a copy if you change machines.

- Conjugation: `npx tsc -p tsconfig.test.json && node .verify/check.mjs`
- New verb sentences: write them in the short text format of `.verify/sentences/example.txt` (`@verb`, `#tense` or `#tense rare`, then `person Spanish | English`), then after `npx tsc -p tsconfig.test.json` run `node .verify/sentences/build.js "$PWD" verbs-351-400.json file.txt...`. It checks every form against the engine and the tense order, and `--write` adds the verbs to that sentence file without changing the rest of its layout
- Browser, with `npm run build` and `npx next start -p 3111` running: `node --experimental-websocket --no-warnings .verify/browser/flow.mjs`, also `audit.mjs`, `account.mjs`, `progress.mjs`, `report.mjs`, `reading.mjs`, `sentence-loading.mjs`, `speech.mjs`, `flashcards.mjs`, `writing.mjs`, `new-modes.mjs` (learn words, dictation, tapping words in a reading), `missed-table.mjs` (the tense table after a miss), `course.mjs`, `exam.mjs` (section exams and drawn quizzes), `practice.mjs` (ser or estar practice, no repeats) and `accents.mjs` (slips against accents that make another word, in a real conjugation drill). The browser profile isn't signed in, so none of these reach Firestore

## Completed

### App

- [x] Conjugation engine with no dependencies, 16 tenses, reflexive verbs, voseo
- [x] Verb search and full conjugation pages
- [x] Speaker on conjugation and fill-in-the-blank cards, once answered: the blanked sentence turns into the whole sentence with a speaker next to it, whether the answer was right or not. Before answering there's nothing to play, so it can't give the answer away. Cards carry the full sentence in `sentence`. Checked in headless Chrome with fake voices: 10 cards across both modes, silent before answering, and speaking the whole sentence after
- [x] Home page verb list split into Irregular, Stem-changing and Regular, with jump links and counts. `verbGroup` in `regular.ts` decides from the same marks as the colored verb tables: any irregular form wins (so conocer, construir and verbs with a participle like escrito or vuelto count as irregular), then any stem change. Spelling changes like busqué and accent changes like envío count as regular. Checked at 390 and 1280px, light and dark, in headless Chrome
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
- [x] "Report a problem" on each recent mistake on /progress, prefilled with "I think my answer was correct." Its `about` starts with `Mistake <item>:` and holds what was typed, the answer, the label and the prompt
- [x] Trash button on each recent mistake to remove it from the list, with Undo. It's added to the day's `hiddenMistakes`, and the mistake stays in `mistakes` and in every tally, so a teacher view could still show it later
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
- [x] Two accepted participles: `imprimir` shows impreso and `freír` shows frito, the forms Latin America mostly uses, and drills also accept imprimido and freído in the perfect tenses, in both conjugation and fill-in-the-blank. The verb page shows the other form as "also", and tapping either in a reading finds the verb. They live in `DOUBLE_PARTICIPLES` in `irregulars.ts`, matched by ending, so a prefixed verb like reimprimir follows
- [x] Verb backlog batch 5: 25 verbs (`identificar` to `parar`) with 938 sentences
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
