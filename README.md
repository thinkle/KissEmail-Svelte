# KISS Mail Merge Svelte

Svelte 5 frontend and Google Apps Script backend for the KISS Mail Merge app.

This repo is no longer a generic starter. It is the dedicated codebase for porting the legacy `KissEmail` spreadsheet mail merge workflow onto a Svelte frontend while preserving the existing sheet-based configuration model.

## Current Shape

- `src/gas/` contains the Apps Script backend, including the imported KISS mail merge logic.
- `src/svelte/` contains one Svelte app that renders either the sidebar UI or the editor dialog depending on Apps Script context.
- `src/shared/` contains types shared between the GAS and Svelte layers.

## Commands

- `npm run dev`: local mock-mode frontend development
- `npm run build`: generate client bindings, build Svelte, build GAS, and copy `appsscript.json` into `dist/`
- `npm run check`: run `svelte-check`
- `npm run create-clasp-project`: create a new clasp project for this repo
- `npm run create-clasp-project -- --type standalone`: create a standalone Apps Script project instead of the default sheet-bound project
- `npm run push-to-clasp`: build and push `dist/` to the linked clasp project

## Notes

- The default `create-clasp-project` behavior is `--type sheets`, since KISS Mail Merge is sheet-centric.
- No clasp project should be created in the old starter repo; this repo is the target.
- The legacy `KissEmail` project is source material only.
