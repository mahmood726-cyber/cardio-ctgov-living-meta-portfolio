# Cardio CT.gov Living Meta Portfolio

Generated portfolio of CT.gov-native topic reviews backed by the shared ESC living meta app.

## What Is Here

- `scripts/scan-topics.mjs`: topic scan and validation snapshot generation
- `scripts/generate-projects.mjs`: emits the project folders and portfolio index
- `scripts/validate-generated.mjs`: structural validation of generated output
- `scripts/browser-validate.mjs`: browser-level smoke validation
- `tests/test_smoke.py`: offline smoke test of the committed portfolio structure
- `generated/`: portfolio manifest, validation snapshot, and browser validation output
- `projects/`: generated topic apps, plans, and `validation.json` files

## Current State

This repo now includes:

- strengthened reviewer packs with PICO, workflow, and benchmark sections
- topic-aware WebR validation links and embedded reviewer panels
- regenerated output for 17 CT.gov topics spanning cardiometabolic disease, hematology, and intensive care
- enforced a hard topic-curation rule that every portfolio topic must have its full randomized evidence base representable from CT.gov records with posted results
- excluded legacy or mixed-era topics even when they have some eligible CT.gov result-reporting trials
- added new full-coverage topics in immune thrombocytopenia, myelofibrosis, paroxysmal nocturnal hemoglobinuria, acquired TTP, beta-thalassemia, and vasodilatory shock

## Quick Start

Generated topic apps load shared assets from the sibling `esc-acs-living-meta`
repo via relative paths, so serve the parent directory rather than opening a
topic `index.html` directly from disk (for example
`python -m http.server` from the directory that contains both repos).

The npm scripts cover the generation and validation pipeline:

1. `npm run generate:projects` regenerates the project folders and portfolio
   index from `generated/topic-validation.json` and the sibling app template.
2. `npm run validate:generated` runs the structural validation of the generated
   output.
3. `npm run test:smoke` runs the offline structural smoke test in `tests/`.
4. `npm run validate` runs `validate:generated` followed by `test:smoke`.

## Related Repo

- Shared app and synthesis engine:
  `https://github.com/mahmood726-cyber/esc-acs-living-meta`
