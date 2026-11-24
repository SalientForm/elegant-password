---
title: Scoring
status: live
summary: "The rubric behind every badge: Strength, Raw, bits, zxcvbn, Difficulty and Memorability."
routes: [/scoring]
sources: ['src/components/{Difficulty.tsx,ModeOptionsTable.tsx,ScoringPage.tsx}', 'src/lib/{checks.ts,choices.ts,common.ts,commonPasswords.ts,difficulty.ts,ease.ts,fluff.ts,fromSentence.ts,generate.ts,grammar.ts,keyboard.ts,lengthModel.ts,modeProfiles.ts,random.ts,readings.ts,requirements.ts,score.ts,sitePresets.ts,sort.ts,strength.ts,text.ts,twists.ts,validation.ts,words.ts,zxcvbnReading.ts}']
platformDoc: docs/platform/20-scoring.md
---

Reached at `#/scoring`, the header's second item; the page loads when first visited.

## What it does

Explains each figure a password card shows, with tables built from the core's own values: the three attackers (Raw, Strength, bits), zxcvbn's second opinion, the Difficulty rubric with the options each typing mode fills in and their measurements, and the Memorability rubric.
