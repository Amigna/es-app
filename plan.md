# Plan

Spanish learning app for me, friends and family. Latin American and Caribbean Spanish: ustedes instead of vosotros, voseo optional. Add to this as we go.

## Done

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
- [x] Mobile layout pass, checked at 320px and 390px in headless Chrome

## After accounts and a database

Held until then so progress is saved per person instead of per browser.

- [ ] Accounts and a database
- [ ] Record answers, tracked by verb + tense and by word + question type
- [ ] Progress page: streak, questions answered, accuracy by tense, items mastered
- [ ] Spaced repetition (FSRS) with a "Today's review" mode and a daily limit on new items
- [ ] Weak-spot stats by tense, verb and mistake type, each with a "Practice this" button

## Content backlog

- [ ] More words in every section. Now at 542 nouns, 234 adjectives, 115 adverbs
- [ ] More verbs. Now at 314, with room for more reflexives and regional verbs
- [ ] More phrases and regional expressions, labeled by country. Now at 162
- [ ] More regional words, and more countries in the existing entries
- [ ] Prepositions, conjunctions, pronouns and question words
- [ ] Short graded reading passages
- [ ] Better examples for verbs that are mostly "rarely used" notes (contraer, prever, errar, rogar)

## Later

- [ ] Audio with the browser's built-in speech, then better text-to-speech if needed
- [ ] Sample sentence per person instead of per tense, for the most common verbs
- [ ] Deploy (static hosting works until the database is added)
- [ ] "Report a problem" link on sentences and forms
- [ ] Conversation or writing practice with Claude (would need an API key)
- [ ] Optional voseo in drills

## To verify

- [x] Compare the engine with Wiktionary for all verbs: no real differences (llover's unused persons only). Re-run with `npx tsc -p tsconfig.test.json && node .verify/check.mjs`. It lives in a gitignored folder, works offline, and fetches only verbs it hasn't seen
- [ ] Spot-check reflexive forms with attached pronouns (levántate, vámonos), which the Wiktionary comparison didn't cover
- [ ] Look up individual forms in RAE when in doubt. Its robots.txt blocks Claude's crawlers, so this means web search or checking by hand, not bulk fetching
- [ ] Skim the sentence files for natural phrasing. Tests confirm the conjugated form is present, not that the sentence sounds right or the translation is accurate
- [x] Play through drills and a quiz in a headless browser, including the keyboard flow, accent buttons, retries and saved settings
- [ ] Try the app on a real phone, especially the on-screen keyboard during drills
- [ ] Have a native speaker check the regional words and slang. Usage varies and these come from my own knowledge, not a source
- [ ] Read the grammar guides and their quizzes for accuracy. Tests check the structure, not the grammar
- [ ] Unknown verb URLs returned 200 on first request and 404 after. Harmless so far

## How content gets added

- Sentences and vocabulary are written in Claude Code sessions and committed as JSON, so the app needs no API key or database.
- `npm test` checks the data: every example must contain the exact word form it teaches.
