---
title: "tep, the command line"
status: live
summary: "The same passwords in a terminal: tep g generates, tep config writes a config file, tep uninstall removes the link."
sources: [package.json, 'src/cli/{args.ts,bin.ts,clipboard.ts,clipboardTools.ts,config.ts,configCommand.ts,configModel.ts,configText.ts,constraints.ts,errors.ts,fields.ts,flagList.ts,flags.ts,generate.ts,help.ts,io.ts,main.ts,messages.ts,output.ts,prompter.ts,report.ts,resolve.ts,sources.ts,tepLink.ts,uninstall.ts,wizard.ts,wrap.ts}', 'src/lib/{appModes.ts,budget.ts,checks.ts,choices.ts,common.ts,commonPasswords.ts,consistency.ts,difficulty.ts,ease.ts,engine.ts,explain.ts,fluff.ts,fromSentence.ts,generate.ts,grammar.ts,keyboard.ts,lengthModel.ts,mappingSettings.ts,modeProfiles.ts,pipeline.ts,random.ts,readings.ts,requirements.ts,ruleText.ts,score.ts,sitePresets.ts,sort.ts,strength.ts,text.ts,twists.ts,validation.ts,words.ts}', 'src/lib/config/{check.ts,fields.ts,model.ts,names.ts,text.ts,version.ts,yaml.ts}']
tests: [src/cli/bundle.test.ts, src/cli/walk.test.ts, scripts/linkCli.test.mjs]
---

Reached from a terminal on Linux or macOS: `pnpm link:cli` builds `dist-cli/tep.mjs` and links it as `tep`; `pnpm tep` runs it from the checkout. It has no route in the web app.

## What it does

- `tep g` makes passwords from the defaults, a config file (`./tep.yml` or `-c`) and flags, through the same core as the web app, as a table, plain lines or JSON, with `--explain` and `--copy`.
- `tep config` asks the typing mode, the site's rules, the options and the output, then writes the config file.
- `tep uninstall` removes the links to a built `tep`.

## Edges

Settings that contradict each other make no passwords (exit 3); every message names where each value came from. A sentence is read from stdin or a hidden prompt, never an argument.
