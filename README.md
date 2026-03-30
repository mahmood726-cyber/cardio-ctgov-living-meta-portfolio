# Cardio CT.gov Living Meta Portfolio

Generated portfolio of cardiovascular ClinicalTrials.gov topic reviews backed by the shared ESC living meta app.

## What Is Here

- `scripts/scan-topics.mjs`: topic scan and validation snapshot generation
- `scripts/generate-projects.mjs`: emits the project folders and portfolio index
- `scripts/validate-generated.mjs`: structural validation of generated output
- `scripts/browser-validate.mjs`: browser-level smoke validation
- `generated/`: portfolio manifest, validation snapshot, and browser validation output
- `projects/`: generated topic apps, plans, and `validation.json` files

## Current State

This repo now includes:

- strengthened reviewer packs with PICO, workflow, and benchmark sections
- topic-aware WebR validation links and embedded reviewer panels
- regenerated output for 27 cardiovascular CT.gov topics
- saved browser validation output confirming all 27 topics passed

## Related Repo

- Shared app and synthesis engine:
  `https://github.com/mahmood726-cyber/esc-acs-living-meta`
