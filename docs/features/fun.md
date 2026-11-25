---
title: Fun
status: live
summary: "Two prompts, generated from the app's own settings, that rebuild the web app and then tep with an AI coding assistant."
routes: [/fun]
sources: ['src/cli/{clipboard.ts,clipboardTools.ts,configModel.ts,configText.ts,constraints.ts,errors.ts,fields.ts,flagList.ts,help.ts,io.ts,messages.ts,output.ts,report.ts,resolve.ts,sources.ts,wizard.ts,wrap.ts}', 'src/components/{CopyButton.tsx,FunPage.tsx,Tabs.tsx,clipboard.ts,icons.tsx}', 'src/lib/{appModes.ts,budget.ts,checks.ts,choices.ts,common.ts,commonPasswords.ts,consistency.ts,devStats.json,devStats.ts,difficulty.ts,ease.ts,engine.ts,explain.ts,fluff.ts,fromSentence.ts,generate.ts,grammar.ts,keyboard.ts,lengthModel.ts,mappingSettings.ts,modeProfiles.ts,pipeline.ts,random.ts,readings.ts,requirements.ts,ruleText.ts,score.ts,sitePresets.ts,sort.ts,strength.ts,testTitles.json,text.ts,twists.ts,validation.ts,words.ts,zxcvbnReading.ts}', 'src/lib/config/{fields.ts,model.ts,names.ts,text.ts,version.ts}', 'src/prompts/{cliPrompt.ts,specPrompt.ts}', 'src/state/{mappingStore.ts,selectedStore.ts,sessionStore.ts,settingsStore.ts,storage.ts}']
tests: [src/lib/testTitles.test.ts]
platformDoc: docs/platform/30-fun.md
---

Reached at `#/fun`, the header's third item; the page loads when first visited.

## What it does

Shows two prompts, the web app's (`src/prompts/specPrompt.ts`) and the command line's (`src/prompts/cliPrompt.ts`), each generated from the core's and the CLI's own tables so it always matches the code, with Copy and "Download .md". A panel shows how the app was made (`src/lib/devStats.ts`).
