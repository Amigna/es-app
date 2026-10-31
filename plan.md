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

## Next

- [ ] Limit vocabulary drills by topic or word type
- [ ] Remember drill settings between visits
- [ ] Optional voseo in drills
- [ ] Spaced repetition (FSRS) so review focuses on what I keep missing
- [ ] Progress and weak-spot stats, by tense and by verb

## Content backlog

- [ ] More words in every section, especially nouns by topic
- [ ] More verbs, including more reflexives and everyday Caribbean verbs (parquear, chequear, fregar, barrer, planchar)
- [ ] More phrases and regional expressions, labeled by country (Cuba, Puerto Rico, Dominican Republic, Colombia, Mexico)
- [ ] A vocabulary notes section for words that differ by country (guagua, carro, coger)
- [ ] Prepositions, conjunctions, pronouns and question words
- [ ] Grammar guides: ser vs. estar, por vs. para, preterite vs. imperfect, when to use the subjunctive
- [ ] Gender and plural rules, with the common exceptions
- [ ] Short graded reading passages
- [ ] Better examples for verbs that are mostly "rarely used" notes (contraer, prever, errar, rogar)

## Later

- [ ] Audio with the browser's built-in speech, then better text-to-speech if needed
- [ ] Sample sentence per person instead of per tense, for the most common verbs
- [ ] Accounts and shared progress for friends and family
- [ ] Deploy (static hosting works while there is no database)
- [ ] "Report a problem" link on sentences and forms
- [ ] Mobile layout pass
- [ ] Conversation or writing practice with Claude (would need an API key)

## To verify

- [ ] Spot-check the engine against RAE for irregular verbs. One bug (rehacer) has been found so far, so others may exist
- [ ] Skim the sentence files for natural phrasing. Tests confirm the conjugated form is present, not that the sentence sounds right or the translation is accurate
- [ ] Try drills in a browser, including the keyboard flow and accent buttons
- [ ] Unknown verb URLs returned 200 on first request and 404 after. Harmless so far

## How content gets added

- Sentences and vocabulary are written in Claude Code sessions and committed as JSON, so the app needs no API key or database.
- `npm test` checks the data: every example must contain the exact word form it teaches.
