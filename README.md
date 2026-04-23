# Cardio CT.gov Living Meta Portfolio

Generated portfolio of CT.gov-native topic reviews backed by the shared ESC living meta app.

## What Is Here

- `scripts/scan-topics.mjs`: topic scan and validation snapshot generation
- `scripts/generate-projects.mjs`: emits the project folders and portfolio index
- `scripts/validate-generated.mjs`: structural validation of generated output
- `scripts/browser-validate.mjs`: browser-level smoke validation
- `open_app.ps1`: local browser launcher with static-server support
- `stop_local_server.ps1`: stops the local launcher server
- `package_release.ps1`: creates a timestamped release zip under `release/`
- `generate_release_notes.ps1`: writes timestamped release notes under `release/`
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

1. Run `powershell -ExecutionPolicy Bypass -File .\open_app.ps1` to start the local launcher and open the portfolio. The launcher serves `C:\Projects` so generated topic apps can load shared assets from sibling repos; do not open topic `index.html` files directly from disk.
2. Run `powershell -ExecutionPolicy Bypass -File .\run_validation.ps1` for the standard validation path.
3. Run `powershell -ExecutionPolicy Bypass -File .\package_release.ps1` when you need a release snapshot and matching release notes.

## Related Repo

- Shared app and synthesis engine:
  `https://github.com/mahmood726-cyber/esc-acs-living-meta`
