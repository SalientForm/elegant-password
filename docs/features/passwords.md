---
title: Passwords
status: live
summary: "The main page: a site's rules in, passwords that read as a sentence out, with a typing test and a saved list."
routes: [/]
sources: ['src/{App.tsx,frameGuard.ts,main.tsx,styles.css}', src/assets/header-bg.webp, 'src/components/{ApplyBar.tsx,CopyButton.tsx,Difficulty.tsx,ErrorBoundary.tsx,InstantTip.tsx,KeyboardMap.tsx,ListEntry.tsx,NumberField.tsx,PasswordText.tsx,RequirementsForm.tsx,SelectedList.tsx,SentenceMode.tsx,SessionControls.tsx,SiteRules.tsx,SlowNotice.tsx,StrengthPanel.tsx,SuggestionCard.tsx,Tabs.tsx,TwistsPanel.tsx,TypingMode.tsx,TypingTest.tsx,clipboard.ts,columnScroll.ts,icons.tsx,resize.ts,scrollbars.ts,useMediaQuery.ts,useShownProblems.ts,useZxcvbn.ts}', 'src/lib/{budget.ts,checks.ts,choices.ts,common.ts,commonPasswords.ts,difficulty.ts,ease.ts,engine.ts,explain.ts,fluff.ts,fromSentence.ts,generate.ts,grammar.ts,keyboard.ts,lengthModel.ts,mappingSettings.ts,modeProfiles.ts,pipeline.ts,random.ts,readings.ts,requirements.ts,ruleText.ts,score.ts,sitePresets.ts,sort.ts,strength.ts,text.ts,twists.ts,typingTest.ts,validation.ts,words.ts,zxcvbnReading.ts}', 'src/state/{PasswordsProvider.tsx,mappingStore.ts,origin.ts,selectedStore.ts,sessionStore.ts,settingsStore.ts,slow.ts,storage.ts,zxcvbnCheck.ts}']
tests: [e2e/smoke.spec.ts, e2e/mobile.spec.ts, src/App.renders.test.tsx, src/lib/generate.modes.test.ts, src/lib/reduceTo12.test.ts]
platformDoc: docs/platform/10-passwords.md
---

Reached at the app's root (`#/`), the first item of the header. It is the whole of the generator: three columns, Options, Suggestions and Testing, which become tabs on a phone.

## What it does

- **Options:** site presets, the site's rules as fields or pasted wording, the typing mode, the requirement options and the swaps. Edits are a draft until "Submit changes" (the apply bar).
- **Suggestions:** the sentence (made up, or the user's own in "Use my sentence"), and the password cards with their Strength, Raw, Difficulty, Memorability and zxcvbn badges and their "Why?".
- **Testing:** the typing test, My list and the session card.

State, persistence and generation are owned by one provider (`src/state/PasswordsProvider.tsx`); generation runs through the shared core in `src/lib/`.

## Edges

- Secrets (My list, the current batch) are stored only on the app's own origin (`src/state/origin.ts`); on the shared GitHub Pages origin they stay in memory for the visit.
- Framed by another page, the built app mounts nothing and shows a notice (`src/frameGuard.ts`).
