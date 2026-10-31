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
- [x] Grammar guides: ser vs. estar, por vs. para, preterite vs. imperfect, subjunctive, gender and plurals, reflexive verbs, object pronouns, commands, perfect tenses

## After accounts and a database

Held until then so progress is saved per person instead of per browser.

- [ ] Accounts and a database
- [ ] Record answers, tracked by verb + tense and by word + question type
- [ ] Progress page: streak, questions answered, accuracy by tense, items mastered
- [ ] Spaced repetition (FSRS) with a "Today's review" mode and a daily limit on new items
- [ ] Weak-spot stats by tense, verb and mistake type, each with a "Practice this" button

## Content backlog

- [ ] More words in every section, especially nouns by topic
- [ ] More verbs, including more reflexives and everyday Caribbean verbs (parquear, chequear, fregar, barrer, planchar)
- [ ] More phrases and regional expressions, labeled by country (Cuba, Puerto Rico, Dominican Republic, Colombia, Mexico)
- [ ] More regional words, and more countries in the existing entries
- [ ] Prepositions, conjunctions, pronouns and question words
- [ ] More grammar guides: comparisons, future with ir a, relative pronouns, numbers and dates
- [ ] Short graded reading passages
- [ ] Better examples for verbs that are mostly "rarely used" notes (contraer, prever, errar, rogar)

## Later

- [ ] Audio with the browser's built-in speech, then better text-to-speech if needed
- [ ] Sample sentence per person instead of per tense, for the most common verbs
- [ ] Deploy (static hosting works until the database is added)
- [ ] "Report a problem" link on sentences and forms
- [ ] Mobile layout pass
- [ ] Conversation or writing practice with Claude (would need an API key)
- [ ] Optional voseo in drills

## To verify

- [ ] Spot-check the engine against RAE for irregular verbs. One bug (rehacer) has been found so far, so others may exist
- [ ] Skim the sentence files for natural phrasing. Tests confirm the conjugated form is present, not that the sentence sounds right or the translation is accurate
- [ ] Try drills in a browser, including the keyboard flow and accent buttons
- [ ] Have a native speaker check the regional words and slang. Usage varies and these come from my own knowledge, not a source
- [ ] Read the grammar guides for accuracy
- [ ] Unknown verb URLs returned 200 on first request and 404 after. Harmless so far

## How content gets added

- Sentences and vocabulary are written in Claude Code sessions and committed as JSON, so the app needs no API key or database.
- `npm test` checks the data: every example must contain the exact word form it teaches.
