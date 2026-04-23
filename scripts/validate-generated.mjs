import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PORTFOLIO_ROOT = path.resolve(SCRIPT_DIR, "..");
const MANIFEST_PATH = path.join(PORTFOLIO_ROOT, "generated", "portfolio-manifest.json");
const PROJECTS_DIR = path.join(PORTFOLIO_ROOT, "projects");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function run() {
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
  const failures = [];

  for (const topic of manifest.topics) {
    const projectDir = path.join(PROJECTS_DIR, topic.slug);
    const indexPath = path.join(projectDir, "index.html");
    const planPath = path.join(projectDir, "plan.html");
    const validationPath = path.join(projectDir, "validation.json");

    try {
      assert(await exists(indexPath), `${topic.slug}: missing index.html`);
      assert(await exists(planPath), `${topic.slug}: missing plan.html`);
      assert(await exists(validationPath), `${topic.slug}: missing validation.json`);

      const [indexHtml, planHtml, validationRaw] = await Promise.all([
        fs.readFile(indexPath, "utf8"),
        fs.readFile(planPath, "utf8"),
        fs.readFile(validationPath, "utf8")
      ]);

      const validation = JSON.parse(validationRaw);
      assert(validation.topic?.slug === topic.slug, `${topic.slug}: validation slug mismatch`);
      assert(indexHtml.includes("window.__ESC_ACS_TOPICS_OVERRIDE__"), `${topic.slug}: missing override block`);
      assert(indexHtml.includes(topic.slug), `${topic.slug}: slug not embedded in wrapper`);
      assert(indexHtml.includes("CT.gov Validation Snapshot"), `${topic.slug}: missing validation snapshot section`);
      assert(indexHtml.includes("Reviewer Transparency Pack"), `${topic.slug}: missing reviewer transparency pack`);
      assert(indexHtml.includes("Search History Log"), `${topic.slug}: wrapper missing search history log`);
      assert(indexHtml.includes("Study Eligibility And Demographics"), `${topic.slug}: wrapper missing demographics section`);
      assert(indexHtml.includes("Record Excerpts"), `${topic.slug}: wrapper missing record excerpts section`);
      assert(indexHtml.includes("Reviewer Validation"), `${topic.slug}: wrapper missing reviewer validation section`);
      assert(indexHtml.includes("Review Question And PICO"), `${topic.slug}: wrapper missing PICO section`);
      assert(indexHtml.includes("Benchmark Reconciliation Ledger"), `${topic.slug}: wrapper missing benchmark ledger`);
      const snapshotCountVariants = [
        `${topic.includedCount} eligible RCTs in snapshot`,
        `${topic.includedCount} eligible RCT in snapshot`
      ];
      assert(snapshotCountVariants.some(value => indexHtml.includes(value)), `${topic.slug}: missing snapshot count`);
      assert(indexHtml.includes(escapeHtml(topic.query)), `${topic.slug}: missing exact query`);
      assert(indexHtml.includes("../../../esc-acs-living-meta/styles.css"), `${topic.slug}: missing shared stylesheet ref`);
      assert(indexHtml.includes("../../../esc-acs-living-meta/app.js"), `${topic.slug}: missing shared app ref`);
      assert(indexHtml.includes("../../../esc-acs-living-meta/help-system.js"), `${topic.slug}: missing shared help-system ref`);
      assert(planHtml.includes(escapeHtml(topic.query)), `${topic.slug}: plan missing exact query`);
      assert(planHtml.includes("Included Trial Ledger"), `${topic.slug}: plan missing ledger section`);
      assert(planHtml.includes("Information Sources And Search History"), `${topic.slug}: plan missing search history section`);
      assert(planHtml.includes("Protocol Framing And Review Question"), `${topic.slug}: plan missing protocol framing section`);
      assert(planHtml.includes("Selection And Synthesis Workflow"), `${topic.slug}: plan missing workflow section`);
      assert(planHtml.includes("Benchmark Reconciliation Ledger"), `${topic.slug}: plan missing benchmark ledger`);
      assert(planHtml.includes("Study Eligibility And Demographics"), `${topic.slug}: plan missing demographics section`);
      assert(planHtml.includes("Record Excerpts"), `${topic.slug}: plan missing record excerpts section`);
      assert(planHtml.includes("Reviewer Validation And Benchmarking"), `${topic.slug}: plan missing reviewer validation section`);
      assert(indexHtml.includes("Full CT.gov results coverage"), `${topic.slug}: wrapper missing CT.gov coverage label`);
      assert(planHtml.includes("Full CT.gov results coverage"), `${topic.slug}: plan missing CT.gov coverage label`);
      assert(Array.isArray(validation.topic?.includedStudies), `${topic.slug}: validation missing included studies`);
      assert(validation.topic.includedStudies.length === topic.includedCount, `${topic.slug}: included count mismatch`);
      assert(validation.topic.analysisEligibleCount === (topic.analysisEligibleCount ?? validation.topic.analysisEligibleCount), `${topic.slug}: analysis-ready count mismatch`);
      assert(validation.topic.comparisonReadyStudyCount === (topic.comparisonReadyStudyCount ?? validation.topic.comparisonReadyStudyCount), `${topic.slug}: comparison-ready study count mismatch`);
      assert(validation.topic.comparisonCount === (topic.comparisonCount ?? validation.topic.comparisonCount), `${topic.slug}: comparison count mismatch`);
      assert(validation.topic.ctgovFullCoverage === true, `${topic.slug}: validation missing full CT.gov coverage flag`);
      assert(typeof validation.topic.ctgovCoverageNote === "string" && validation.topic.ctgovCoverageNote.length > 0, `${topic.slug}: validation missing CT.gov coverage note`);
      assert(
        validation.topic.includedStudies.every(study => "briefSummary" in study && "eligibility" in study && "sponsor" in study),
        `${topic.slug}: validation missing enriched transparency fields`
      );
      assert(
        validation.topic.includedStudies.every(study => !/\bNON_RANDOMIZED\b/.test(String(study.allocation || "").toUpperCase())),
        `${topic.slug}: included NON_RANDOMIZED study detected`
      );

      for (const study of validation.topic.includedStudies) {
        if (!study.outcome) continue;
        assert(typeof study.outcome.analysisEligible === "boolean", `${topic.slug}: ${study.nctId}: outcome missing analysisEligible flag`);
        assert(typeof study.outcome.analysisReason === "string" && study.outcome.analysisReason.length > 0, `${topic.slug}: ${study.nctId}: outcome missing analysisReason`);
        for (const group of study.outcome.groups || []) {
          if (group.events == null) continue;
          assert(Number.isFinite(group.events), `${topic.slug}: ${study.nctId}: non-finite event count`);
          assert(Number.isInteger(group.events), `${topic.slug}: ${study.nctId}: non-integer study event count`);
          if (group.n != null) {
            assert(group.events >= 0, `${topic.slug}: ${study.nctId}: negative event count`);
            assert(group.events <= group.n, `${topic.slug}: ${study.nctId}: event count exceeds denominator`);
          }
        }
      }
    } catch (error) {
      failures.push(error.message);
    }
  }

  if (failures.length) {
    for (const failure of failures) {
      process.stderr.write(`${failure}\n`);
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`Validated ${manifest.topics.length} generated project folders.\n`);
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
