import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PORTFOLIO_ROOT = path.resolve(SCRIPT_DIR, "..");
const SHARED_APP_ROOT = path.resolve(PORTFOLIO_ROOT, "..", "esc-acs-living-meta");
const VALIDATION_PATH = path.join(PORTFOLIO_ROOT, "generated", "topic-validation.json");
const MANIFEST_PATH = path.join(PORTFOLIO_ROOT, "generated", "portfolio-manifest.json");
const PROJECTS_DIR = path.join(PORTFOLIO_ROOT, "projects");
const PORTFOLIO_INDEX_PATH = path.join(PORTFOLIO_ROOT, "index.html");
const PORTFOLIO_NAME = path.basename(PORTFOLIO_ROOT);

const SHARED_RELATIVE = "../../../esc-acs-living-meta";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) return "Not reported";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

function formatTitleCase(value) {
  return String(value || "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(token => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function ctgovStudyUrl(nctId) {
  return `https://clinicaltrials.gov/study/${encodeURIComponent(nctId)}`;
}

function ctgovSearchUrl(query) {
  return `https://clinicaltrials.gov/search?term=${encodeURIComponent(query)}`;
}

function pubmedSearchUrl(query) {
  return `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}`;
}

function truncateText(value, max = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "Not reported";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

function formatReasonLabel(reason) {
  return formatTitleCase(String(reason || "").replace(/_/g, " "));
}

function formatSponsor(study) {
  const sponsor = study.sponsor || {};
  if (!sponsor.name) return "Not reported";
  return sponsor.class ? `${sponsor.name} (${formatTitleCase(sponsor.class)})` : sponsor.name;
}

function formatPhases(study) {
  const phases = study.phases || [];
  return phases.length ? phases.map(phase => formatTitleCase(String(phase).replace(/phase/i, "Phase "))).join(", ") : "Not reported";
}

function formatEnrollment(study) {
  const enrollment = study.enrollment || {};
  if (!enrollment.count) return "Not reported";
  return enrollment.type ? `${enrollment.count} (${formatTitleCase(enrollment.type)})` : String(enrollment.count);
}

function formatEligibility(study) {
  const eligibility = study.eligibility || {};
  const bits = [];
  if (eligibility.sex) bits.push(`Sex: ${eligibility.sex}`);
  if (eligibility.minimumAge || eligibility.maximumAge) {
    bits.push(`Age: ${eligibility.minimumAge || "NR"} to ${eligibility.maximumAge || "NR"}`);
  }
  if (eligibility.healthyVolunteers != null) {
    bits.push(`Healthy volunteers: ${eligibility.healthyVolunteers ? "Yes" : "No"}`);
  }
  return bits.length ? bits.join(" | ") : "Not reported";
}

function formatParticipantCounts(demographics) {
  const counts = demographics?.participantCounts || [];
  if (!counts.length) return "Not reported";
  return counts
    .map(item => `${item.groupTitle}: ${item.value}${item.unit ? ` ${item.unit}` : ""}`)
    .join(" | ");
}

function formatAgeSummary(demographics) {
  const ageMean = demographics?.ageMean || [];
  if (!ageMean.length) return "Not reported";
  return ageMean
    .map(item => `${item.groupTitle}: ${item.value}${item.spread ? ` +/- ${item.spread}` : ""}${item.unit ? ` ${item.unit}` : ""}`)
    .join(" | ");
}

function formatSexSummary(demographics) {
  const rows = demographics?.sexBreakdown || [];
  if (!rows.length) return "Not reported";
  return rows
    .map(item => `${item.groupTitle}: F ${item.female ?? "NR"} / M ${item.male ?? "NR"}`)
    .join(" | ");
}

function formatDemographics(study) {
  const demographics = study.demographics;
  if (!demographics) return "Not reported";
  const bits = [];
  const counts = formatParticipantCounts(demographics);
  const age = formatAgeSummary(demographics);
  const sex = formatSexSummary(demographics);
  if (counts !== "Not reported") bits.push(`Participants ${counts}`);
  if (age !== "Not reported") bits.push(`Age ${age}`);
  if (sex !== "Not reported") bits.push(`Sex ${sex}`);
  return bits.length ? bits.join(" | ") : "Not reported";
}

function formatProtocolOutcomes(outcomes, limit = 2) {
  const items = (outcomes || []).slice(0, limit);
  if (!items.length) return "Not reported";
  return items
    .map(item => {
      const bits = [item.measure || "Untitled outcome"];
      if (item.timeFrame) bits.push(`Time frame: ${item.timeFrame}`);
      if (item.description) bits.push(item.description);
      return bits.join(" | ");
    })
    .join(" || ");
}

function renderDocumentLinks(documents) {
  const docs = documents || [];
  if (!docs.length) return '<span class="muted">No CT.gov documents listed.</span>';
  return docs
    .map(doc => {
      const label = escapeHtml(doc.label || doc.filename || "Document");
      const suffix = doc.date ? ` (${escapeHtml(formatDate(doc.date))})` : "";
      if (doc.url) {
        return `<a class="pill" href="${escapeHtml(doc.url)}" target="_blank" rel="noopener">${label}${suffix}</a>`;
      }
      return `<span class="pill">${label}${suffix}</span>`;
    })
    .join("\n");
}

function sumEnrollment(studies) {
  return studies.reduce((sum, study) => sum + (Number(study.enrollment?.count) || 0), 0);
}

function countStudiesWith(studies, predicate) {
  return studies.reduce((sum, study) => sum + (predicate(study) ? 1 : 0), 0);
}

function uniqueValues(values, limit = 6) {
  return Array.from(
    new Set(
      values
        .map(value => String(value || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
    )
  ).slice(0, limit);
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toPositiveNumber(value) {
  const numeric = toFiniteNumber(value);
  return numeric != null && numeric > 0 ? numeric : null;
}

function pickComparatorIndex(groups = []) {
  const anchors = ["control", "placebo", "standard", "usual", "conventional"];
  const idx = groups.findIndex(group =>
    anchors.some(anchor => String(group?.title || "").toLowerCase().includes(anchor))
  );
  return idx >= 0 ? idx : 0;
}

function inferGroupLabel(group, study, idx) {
  if (group?.title) return group.title;
  if (study?.arms?.[idx]?.title) return study.arms[idx].title;
  return `Arm ${idx + 1}`;
}

function computeLogRRForGenerator(e1, n1, e0, n0) {
  if (e1 === 0 && e0 === 0) return null;
  const totalN = n1 + n0;
  const needsCC = e1 === 0 || e0 === 0 || e1 === n1 || e0 === n0;
  const cc1 = needsCC ? n1 / totalN : 0;
  const cc0 = needsCC ? n0 / totalN : 0;
  const a = e1 + cc1;
  const b = n1 - e1 + cc1;
  const c = e0 + cc0;
  const d = n0 - e0 + cc0;
  const rr = (a / (a + b)) / (c / (c + d));
  return {
    effect: Math.log(rr),
    se: Math.sqrt(1 / a - 1 / (a + b) + 1 / c - 1 / (c + d))
  };
}

function computeMeanDiffForGenerator(m1, sd1, n1, m0, sd0, n0) {
  return {
    effect: m1 - m0,
    se: Math.sqrt((sd1 * sd1) / n1 + (sd0 * sd0) / n0)
  };
}

function buildTopicComparisons(topic) {
  const comparisons = [];
  for (const study of topic.includedStudies || []) {
    const groups = study.outcome?.groups || [];
    if (groups.length < 2) continue;
    const comparatorIndex = pickComparatorIndex(groups);
    const comparator = groups[comparatorIndex];
    groups.forEach((group, idx) => {
      if (idx === comparatorIndex) return;
      let result = null;
      let measure = null;
      if (group?.events != null && group?.n != null && comparator?.events != null && comparator?.n != null) {
        result = computeLogRRForGenerator(group.events, group.n, comparator.events, comparator.n);
        measure = "logRR";
      } else if (
        group?.mean != null &&
        group?.sd != null &&
        group?.n != null &&
        comparator?.mean != null &&
        comparator?.sd != null &&
        comparator?.n != null
      ) {
        result = computeMeanDiffForGenerator(group.mean, group.sd, group.n, comparator.mean, comparator.sd, comparator.n);
        measure = "MD";
      }
      if (!result) return;
      const totalN = toPositiveNumber(group.n) && toPositiveNumber(comparator.n)
        ? Number(group.n) + Number(comparator.n)
        : toPositiveNumber(study.enrollment?.count);
      comparisons.push({
        studyId: study.nctId,
        title: study.title,
        t1: inferGroupLabel(group, study, idx),
        t2: inferGroupLabel(comparator, study, comparatorIndex),
        measure,
        effect: result.effect,
        se: result.se,
        n1: toPositiveNumber(group.n),
        n0: toPositiveNumber(comparator.n),
        totalN: totalN || null,
        sampleSize: totalN || null
      });
    });
  }
  return comparisons;
}

function getStudyComparatorSummary(study) {
  const groups = study.outcome?.groups || [];
  if (groups.length >= 2) {
    const comparatorIndex = pickComparatorIndex(groups);
    const comparator = groups[comparatorIndex];
    return groups
      .filter((_, idx) => idx !== comparatorIndex)
      .slice(0, 2)
      .map(group => `${inferGroupLabel(group, study, 0)} vs ${inferGroupLabel(comparator, study, comparatorIndex)}`)
      .join(" | ");
  }
  const arms = (study.arms || []).map(arm => arm.title).filter(Boolean);
  if (arms.length >= 2) return `${arms[0]} vs ${arms[1]}`;
  return arms[0] || "Comparator not reported";
}

function getStudyOutcomeLabel(study) {
  return study.outcome?.title || (study.primaryOutcomes || []).map(item => item.measure).find(Boolean) || "Outcome not reported";
}

function buildPicoSummary(topic) {
  const studies = topic.includedStudies || [];
  return {
    population: uniqueValues(studies.flatMap(study => study.conditions || []), 6).join("; ") || "Adults captured by the registry eligibility fields below",
    interventions: uniqueValues(studies.flatMap(study => (study.outcome?.groups || []).map(group => group.title).filter(Boolean)), 8).join("; ") || topic.label,
    comparators: uniqueValues(studies.map(getStudyComparatorSummary), 6).join("; ") || "Comparator arms as posted on CT.gov",
    outcomes: uniqueValues(studies.map(getStudyOutcomeLabel), 6).join("; ") || "Primary CT.gov outcome results",
    design: "Randomized interventional ClinicalTrials.gov records with posted results, at least two arms, and extractable numeric outcomes."
  };
}

function buildPrismaFlowRows(topic) {
  return [
    { stage: "Records identified from the exact CT.gov query", count: topic.scannedRecords, detail: `${topic.pagesFetched} page(s) fetched` },
    { stage: "Records excluded by registry hard gates", count: topic.excludedCount, detail: "Not randomized, incomplete, missing results, insufficient arms, or no numeric outcome" },
    { stage: "Trials entering the quantitative snapshot", count: topic.includedCount, detail: "Included in validation.json and the live topic app" }
  ];
}

function buildSelectionWorkflowRows(topic, validationMeta) {
  return [
    { step: "Question framing", rule: "Topic slug, base query, and keyword pack frozen before generation", evidence: `${topic.slug} | ${formatDate(validationMeta.generatedAt)}` },
    { step: "Registry screening", rule: "ClinicalTrials.gov v2 API queried with the exact string shown below", evidence: `${topic.scannedRecords} candidate records screened` },
    { step: "Eligibility gate", rule: "Randomized interventional, completed, posted results, >=2 arms, numeric outcome", evidence: `${topic.includedCount} included / ${topic.excludedCount} excluded` },
    { step: "Extraction", rule: "Outcome groups, sponsor, eligibility, documents, and demographics preserved where available", evidence: `${countStudiesWith(topic.includedStudies || [], study => Boolean(study.demographics))}/${topic.includedCount} studies with demographics` },
    { step: "Reviewer validation", rule: "Benchmark ledger and topic-aware WebR runner bundled with each topic project", evidence: "validation.json + plan.html + embedded runner" }
  ];
}

function buildRunnerValidationPath(topic) {
  return `../${PORTFOLIO_NAME}/projects/${topic.slug}/validation.json`;
}

function buildRunnerHref(topic) {
  const params = new URLSearchParams({
    validation: buildRunnerValidationPath(topic),
    topic: topic.slug,
    label: topic.label
  });
  return `${SHARED_RELATIVE}/r-validation-runner.html?${params.toString()}`;
}

function buildRunnerContext(topic, validationMeta) {
  const studies = topic.includedStudies || [];
  return {
    source: "ctgov-portfolio-generator",
    topicId: topic.slug,
    label: topic.label,
    query: topic.query,
    generatedAt: validationMeta.generatedAt,
    includedCount: topic.includedCount,
    excludedCount: topic.excludedCount,
    totalEnrollment: sumEnrollment(studies),
    demographicsCoverage: countStudiesWith(studies, study => Boolean(study.demographics)),
    documentCoverage: countStudiesWith(studies, study => (study.documents || []).length > 0),
    comparisons: buildTopicComparisons(topic),
    includedStudies: studies.map(study => ({
      nctId: study.nctId,
      title: study.title,
      status: study.status,
      enrollment: toPositiveNumber(study.enrollment?.count),
      documentsCount: (study.documents || []).length,
      hasDemographics: Boolean(study.demographics),
      outcome: study.outcome ? {
        type: study.outcome.type || null,
        title: study.outcome.title || null,
        groups: (study.outcome.groups || []).map(group => ({
          title: group.title || null,
          n: toPositiveNumber(group.n),
          events: toFiniteNumber(group.events),
          mean: toFiniteNumber(group.mean),
          sd: toFiniteNumber(group.sd)
        }))
      } : null,
      primaryOutcomes: (study.primaryOutcomes || []).slice(0, 2).map(item => ({
        measure: item.measure || "",
        timeFrame: item.timeFrame || ""
      }))
    }))
  };
}

function buildRunnerBridgeScript(contextJson, iframeId = "reviewerValidationFrame") {
  return `<script>
(() => {
  const iframe = document.getElementById(${JSON.stringify(iframeId)});
  const context = ${contextJson};
  if (!iframe || !context) return;
  const sendContext = () => {
    if (!iframe.contentWindow) return;
    iframe.contentWindow.postMessage({ type: "esc-topic-validation-context", payload: context }, "*");
  };
  iframe.addEventListener("load", sendContext);
  window.addEventListener("message", event => {
    if (event.source === iframe.contentWindow && event.data?.type === "esc-topic-validation-request") {
      sendContext();
    }
  });
  window.setTimeout(sendContext, 250);
})();
</script>`;
}

function buildBenchmarkLedgerRows(studies, limit = 12) {
  return (studies || []).slice(0, limit)
    .map(study => `
      <tr>
        <td><a href="${ctgovStudyUrl(study.nctId)}" target="_blank" rel="noopener">${escapeHtml(study.nctId)}</a></td>
        <td>${escapeHtml(getStudyComparatorSummary(study))}</td>
        <td>${escapeHtml(getStudyOutcomeLabel(study))}</td>
        <td>${escapeHtml(formatEnrollment(study))}</td>
        <td>${(study.documents || []).length > 0 ? "Documents listed on CT.gov" : "Registry record only"}</td>
      </tr>`)
    .join("\n");
}

function buildBenchmarkQuery(label, mode) {
  if (mode === "meta") return `("${label}") AND (meta-analysis OR systematic review)`;
  if (mode === "rct") return `("${label}") AND (randomized OR trial)`;
  return `("${label}") AND (ClinicalTrials.gov OR registry)`;
}

function buildSearchHistoryRows(topic, validationMeta) {
  return [
    {
      step: "CT.gov candidate scan started",
      source: "ClinicalTrials.gov v2 API",
      detail: formatDate(validationMeta.startedAt || validationMeta.generatedAt)
    },
    {
      step: "Base query locked",
      source: "Project generator",
      detail: topic.baseQuery
    },
    {
      step: "Keyword expansion applied",
      source: "Project generator",
      detail: `${(topic.keywords || []).length} terms: ${(topic.keywords || []).join(", ") || "No additional keywords"}`
    },
    {
      step: "Exact query executed",
      source: "ClinicalTrials.gov",
      detail: topic.query
    },
    {
      step: "Registry records screened",
      source: "ClinicalTrials.gov",
      detail: `${topic.scannedRecords} records across ${topic.pagesFetched} page(s)`
    },
    {
      step: "Hard-gate exclusions applied",
      source: "Generator eligibility rules",
      detail: `${topic.excludedCount} records excluded before synthesis` 
    },
    {
      step: "Quantitative snapshot frozen",
      source: "validation.json",
      detail: `${topic.includedCount} randomized trials entered the reviewer pack`
    },
    {
      step: "Project package generated",
      source: "Portfolio build",
      detail: formatDate(validationMeta.generatedAt)
    }
  ];
}

function buildWrapperReviewerSections(topic, validationMeta) {
  const studies = topic.includedStudies || [];
  const pico = buildPicoSummary(topic);
  const runnerHref = buildRunnerHref(topic);
  const runnerContextJson = JSON.stringify(buildRunnerContext(topic, validationMeta)).replace(/</g, "\u003c");
  const prismaRows = buildPrismaFlowRows(topic)
    .map(row => `
        <tr>
          <td>${escapeHtml(row.stage)}</td>
          <td>${row.count}</td>
          <td>${escapeHtml(row.detail)}</td>
        </tr>`)
    .join("");
  const exclusionRows = Object.entries(topic.exclusionReasons || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([reason, count]) => `<tr><td>${escapeHtml(formatReasonLabel(reason))}</td><td>${count}</td></tr>`)
    .join("");
  const searchHistoryRows = buildSearchHistoryRows(topic, validationMeta)
    .map(
      row => `
        <tr>
          <td>${escapeHtml(row.step)}</td>
          <td>${escapeHtml(row.source)}</td>
          <td>${escapeHtml(row.detail)}</td>
        </tr>`
    )
    .join("");
  const includedRows = studies
    .map(
      study => `
        <tr>
          <td><a href="${ctgovStudyUrl(study.nctId)}" target="_blank" rel="noopener">${escapeHtml(study.nctId)}</a></td>
          <td>${escapeHtml(study.title)}</td>
          <td>${escapeHtml(formatSponsor(study))}</td>
          <td>${escapeHtml(formatPhases(study))}</td>
          <td>${escapeHtml(formatEnrollment(study))}</td>
          <td>${escapeHtml(formatEligibility(study))}</td>
          <td>${escapeHtml(formatDemographics(study))}</td>
        </tr>`
    )
    .join("");
  const excerptRows = studies
    .slice(0, 12)
    .map(
      study => `
        <tr>
          <td><a href="${ctgovStudyUrl(study.nctId)}" target="_blank" rel="noopener">${escapeHtml(study.nctId)}</a></td>
          <td>${escapeHtml(truncateText(study.briefSummary, 240))}</td>
          <td>${escapeHtml(truncateText(study.eligibility?.criteria, 220))}</td>
          <td>${escapeHtml(truncateText(formatProtocolOutcomes(study.primaryOutcomes, 1), 260))}</td>
          <td>${renderDocumentLinks(study.documents)}</td>
        </tr>`
    )
    .join("");
  const benchmarkRows = buildBenchmarkLedgerRows(studies, 10);

  return `
      <section class="panel reviewer-pack">
        <div class="panel__header">
          <h2>Reviewer Transparency Pack</h2>
          <div class="panel__meta">Built to expose source search, eligibility, excerpts, benchmarking, and topic-aware validation before the live analysis workspace.</div>
        </div>
        <div class="panel__body">
          <div class="summary-grid">
            <div class="summary-card">
              <h3>Protocol And Administrative Information</h3>
              <div class="pill">Included trials: ${studies.length}</div>
              <div class="pill">Total enrollment reported: ${sumEnrollment(studies) || "Not reported"}</div>
              <div class="pill">Sponsor coverage: ${countStudiesWith(studies, study => Boolean(study.sponsor?.name))}/${studies.length}</div>
              <div class="pill">Demographics coverage: ${countStudiesWith(studies, study => Boolean(study.demographics))}/${studies.length}</div>
              <div class="pill">CT.gov document coverage: ${countStudiesWith(studies, study => (study.documents || []).length > 0)}/${studies.length}</div>
            </div>
            <div class="summary-card">
              <h3>Reviewer Route</h3>
              <p>Use this pack to verify the search history, protocol framing, demographics capture, benchmark ledger, and topic-aware validation before reading the interactive estimates below.</p>
              <div class="topic-stats" style="flex-wrap: wrap; gap: 8px;">
                <a class="pill" href="plan.html">Full validation plan</a>
                <a class="pill" href="validation.json">validation.json</a>
                <a class="pill" href="${escapeHtml(ctgovSearchUrl(topic.query))}" target="_blank" rel="noopener">CT.gov search</a>
                <a class="pill" href="${escapeHtml(pubmedSearchUrl(buildBenchmarkQuery(topic.label, "meta")))}" target="_blank" rel="noopener">PubMed meta search</a>
                <a class="pill" href="${escapeHtml(pubmedSearchUrl(buildBenchmarkQuery(topic.label, "rct")))}" target="_blank" rel="noopener">PubMed RCT search</a>
              </div>
            </div>
            <div class="summary-card">
              <h3>Review Question And PICO</h3>
              <p><strong>Population:</strong> ${escapeHtml(pico.population)}</p>
              <p><strong>Interventions:</strong> ${escapeHtml(pico.interventions)}</p>
              <p><strong>Comparators:</strong> ${escapeHtml(pico.comparators)}</p>
              <p><strong>Outcomes:</strong> ${escapeHtml(pico.outcomes)}</p>
              <p><strong>Design:</strong> ${escapeHtml(pico.design)}</p>
            </div>
          </div>

          <div class="summary-card" style="margin-top: 16px;">
            <h3>Search History Log</h3>
            <table class="table table--small">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Source</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>${searchHistoryRows}</tbody>
            </table>
          </div>

          <div class="summary-card" style="margin-top: 16px;">
            <h3>PRISMA Flow Summary</h3>
            <table class="table table--small">
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Count</th>
                  <th>Reviewer Note</th>
                </tr>
              </thead>
              <tbody>${prismaRows}</tbody>
            </table>
          </div>

          <div class="summary-card" style="margin-top: 16px;">
            <h3>PRISMA Style Screening Summary</h3>
            <table class="table table--small">
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>${exclusionRows || '<tr><td colspan="2">No exclusions recorded.</td></tr>'}</tbody>
            </table>
          </div>

          <div class="summary-card" style="margin-top: 16px;">
            <h3>Study Eligibility And Demographics</h3>
            <table class="table table--small">
              <thead>
                <tr>
                  <th>NCT</th>
                  <th>Title</th>
                  <th>Sponsor</th>
                  <th>Phase</th>
                  <th>Enrollment</th>
                  <th>Eligibility</th>
                  <th>Demographics</th>
                </tr>
              </thead>
              <tbody>${includedRows || '<tr><td colspan="7">No included studies in snapshot.</td></tr>'}</tbody>
            </table>
          </div>

          <div class="summary-card" style="margin-top: 16px;">
            <h3>Record Excerpts</h3>
            <table class="table table--small">
              <thead>
                <tr>
                  <th>NCT</th>
                  <th>Brief Summary</th>
                  <th>Eligibility Excerpt</th>
                  <th>Primary Outcome Excerpt</th>
                  <th>Source Documents</th>
                </tr>
              </thead>
              <tbody>${excerptRows || '<tr><td colspan="5">No excerpts available.</td></tr>'}</tbody>
            </table>
          </div>

          <div class="summary-card" style="margin-top: 16px;">
            <h3>Benchmark Reconciliation Ledger</h3>
            <p>Use this registry-native ledger to check study overlap, comparator definitions, and outcome alignment against published syntheses before accepting pooled estimates as publication-ready.</p>
            <table class="table table--small">
              <thead>
                <tr>
                  <th>NCT</th>
                  <th>Registry Contrast</th>
                  <th>Outcome</th>
                  <th>Enrollment</th>
                  <th>Benchmark Use</th>
                </tr>
              </thead>
              <tbody>${benchmarkRows || '<tr><td colspan="5">No included studies available for benchmark reconciliation.</td></tr>'}</tbody>
            </table>
          </div>

          <div class="summary-card" style="margin-top: 16px;">
            <h3>Reviewer Validation</h3>
            <p>The embedded panel below now runs the shared R benchmark suites plus topic-specific checks for the current CT.gov snapshot. Reviewers should pair it with <code>validation.json</code> and the benchmark ledger above.</p>
            <div class="topic-stats" style="flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
              <a class="pill" href="${escapeHtml(runnerHref)}" target="_blank" rel="noopener">Open topic-aware WebR runner</a>
              <a class="pill" href="validation.json">Open topic validation.json</a>
            </div>
            <iframe
              id="reviewerValidationFrame"
              src="${escapeHtml(runnerHref)}"
              title="WebR reviewer validation"
              loading="lazy"
              style="width: 100%; min-height: 420px; border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 18px; background: rgba(15, 23, 42, 0.88);"
            ></iframe>
            ${buildRunnerBridgeScript(runnerContextJson)}
          </div>
        </div>
      </section>`;
}

function buildOverride(topic, validationMeta) {
  const runnerHref = buildRunnerHref(topic);
  return {
    baseQuery: topic.baseQuery,
    topics: [
      {
        id: topic.slug,
        label: topic.label,
        keywords: topic.keywords
      }
    ],
    appConfig: {
      pageTitle: `${topic.label} | CT.gov Living Meta-Analysis`,
      kicker: "Registry-Native Cardiovascular Evidence",
      title: `${topic.label} Living Meta-Analysis`,
      subtitle:
        "Only randomized comparative trials with posted ClinicalTrials.gov results and extractable numeric outcomes are eligible.",
      topicPanelTitle: `CT.gov-validated topic (${topic.includedCount} eligible RCTs in snapshot)`,
      welcomeTitle: `${topic.label} CT.gov review`,
      eligibilityTrialMinimum: 1,
      analysisStudioName: `${topic.label} CT.gov Living Meta-Analysis Studio`,
      defaultStatuses: ["COMPLETED"],
      defaultOutcomeRule: "results",
      requirePostedResults: true,
      requireNumericOutcome: true,
      requireComparatorArms: true,
      enforceConditionFilter: false,
      autoUpdateOnLoad: true,
      rValidationHref: runnerHref,
      rValidationContext: buildRunnerContext(topic, validationMeta)
    }
  };
}

function buildSnapshotSection(topic, validationMeta) {
  const runnerHref = buildRunnerHref(topic);
  const includedLinks = topic.includedStudies
    .map(
      study => `
        <a class="pill" href="${ctgovStudyUrl(study.nctId)}" target="_blank" rel="noopener">
          ${escapeHtml(study.nctId)}
        </a>`
    )
    .join("\n");

  const exclusionEntries = Object.entries(topic.exclusionReasons || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(
      ([reason, count]) => `
        <div class="pill">
          ${escapeHtml(formatTitleCase(reason))}: ${count}
        </div>`
    )
    .join("\n");

  return `
      <section class="panel validation-snapshot">
        <div class="panel__header">
          <h2>CT.gov Validation Snapshot</h2>
          <div class="panel__meta">Generated ${escapeHtml(formatDate(validationMeta.generatedAt))}</div>
        </div>
        <div class="panel__body">
          <div class="summary-grid">
            <div class="summary-card">
              <h3>Registry Gate</h3>
              <div class="pill">Included RCTs: ${topic.includedCount}</div>
              <div class="pill">Scanned records: ${topic.scannedRecords}</div>
              <div class="pill">Pages fetched: ${topic.pagesFetched}</div>
              <div class="pill">Priority tier: ${escapeHtml(formatTitleCase(topic.priorityTier))}</div>
            </div>
            <div class="summary-card">
              <h3>Eligibility Rules</h3>
              <p>Randomized interventional design, completed status, posted CT.gov results, at least two arms, and at least one extractable numeric outcome.</p>
              <p>${topic.truncated ? "The validation scan hit the configured CT.gov page cap." : "The validation scan completed within the configured CT.gov page cap."}</p>
            </div>
            <div class="summary-card">
              <h3>Audit Trail</h3>
              <div class="pill"><a href="validation.json">validation.json</a></div>
              <div class="pill"><a href="plan.html">plan.html</a></div>
              <div class="pill"><a href="${escapeHtml(ctgovSearchUrl(topic.query))}" target="_blank" rel="noopener">CT.gov search</a></div>
              <div class="pill"><a href="${escapeHtml(runnerHref)}" target="_blank" rel="noopener">Topic-aware WebR runner</a></div>
            </div>
          </div>
          <div class="summary-card" style="margin-top: 16px;">
            <h3>Exact Query</h3>
            <pre style="white-space: pre-wrap; overflow-x: auto;">${escapeHtml(topic.query)}</pre>
          </div>
          <div class="summary-card" style="margin-top: 16px;">
            <h3>Included Trial Records</h3>
            <div class="topic-stats" style="flex-wrap: wrap; gap: 8px;">
              ${includedLinks || '<span class="muted">No included studies in snapshot.</span>'}
            </div>
          </div>
          <div class="summary-card" style="margin-top: 16px;">
            <h3>Top Exclusion Reasons</h3>
            <div class="topic-stats" style="flex-wrap: wrap; gap: 8px;">
              ${exclusionEntries || '<span class="muted">No exclusions recorded.</span>'}
            </div>
          </div>
        </div>
      </section>`;
}

function buildWrapperHtml(sharedTemplate, topic, validationMeta) {
  const override = buildOverride(topic, validationMeta);
  const { appConfig } = override;
  const overrideJson = JSON.stringify(override, null, 2).replace(/</g, "\\u003c");
  const stylesReplacement = `    <meta name="description" content="${escapeHtml(
    `${topic.label} living meta-analysis built only from randomized comparative ClinicalTrials.gov records with posted results.`
  )}" />\n    <link rel="stylesheet" href="${SHARED_RELATIVE}/styles.css" />`;
  let html = sharedTemplate
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(`${topic.label} | CT.gov Living Meta-Analysis`)}</title>`)
    .replace(/<!-- PWA Support -->[\s\S]*?<link rel="stylesheet" href="styles\.css" \/>/, stylesReplacement)
    .replace(/\s*<!-- Service Worker Registration -->[\s\S]*?<\/script>\s*/m, "\n")
    .replace(/src="app\.js"/g, `src="${SHARED_RELATIVE}/app.js"`)
    .replace(/src="help-system\.js"/g, `src="${SHARED_RELATIVE}/help-system.js"`)
    .replace(
      /(<p class="kicker" id="appKicker">)[\s\S]*?(<\/p>)/,
      `$1${escapeHtml(appConfig.kicker)}$2`
    )
    .replace(/(<h1 id="appTitle">)[\s\S]*?(<\/h1>)/, `$1${escapeHtml(appConfig.title)}$2`)
    .replace(
      /(<p class="subtitle" id="appSubtitle">)[\s\S]*?(<\/p>)/,
      `$1${escapeHtml(appConfig.subtitle)}$2`
    )
    .replace(
      /(<h2 id="topicPanelTitle">)[\s\S]*?(<\/h2>)/,
      `$1${escapeHtml(appConfig.topicPanelTitle)}$2`
    )
    .replace(
      /(<h2 id="welcomeTitle">)[\s\S]*?(<\/h2>)/,
      `$1${escapeHtml(appConfig.welcomeTitle)}$2`
    )
    .replace(
      '<main class="layout">',
      `${buildSnapshotSection(topic, validationMeta)}\n${buildWrapperReviewerSections(topic, validationMeta)}\n\n      <main class="layout">`
    )
    .replace(
      `    <script type="module" src="${SHARED_RELATIVE}/app.js"></script>`,
      `    <script>\n      window.__ESC_ACS_TOPICS_OVERRIDE__ = ${overrideJson};\n    </script>\n    <script type="module" src="${SHARED_RELATIVE}/app.js"></script>`
    );
  return html;
}

function buildPlanHtml(topic, validationMeta) {
  const studies = topic.includedStudies || [];
  const pico = buildPicoSummary(topic);
  const runnerHref = buildRunnerHref(topic);
  const runnerContextJson = JSON.stringify(buildRunnerContext(topic, validationMeta)).replace(/</g, "\u003c");
  const searchHistoryRows = buildSearchHistoryRows(topic, validationMeta)
    .map(
      row => `
        <tr>
          <td>${escapeHtml(row.step)}</td>
          <td>${escapeHtml(row.source)}</td>
          <td>${escapeHtml(row.detail)}</td>
        </tr>`
    )
    .join("\n");
  const workflowRows = buildSelectionWorkflowRows(topic, validationMeta)
    .map(row => `
        <tr>
          <td>${escapeHtml(row.step)}</td>
          <td>${escapeHtml(row.rule)}</td>
          <td>${escapeHtml(row.evidence)}</td>
        </tr>`)
    .join("\n");
  const prismaRows = buildPrismaFlowRows(topic)
    .map(row => `
        <tr>
          <td>${escapeHtml(row.stage)}</td>
          <td>${row.count}</td>
          <td>${escapeHtml(row.detail)}</td>
        </tr>`)
    .join("\n");

  const includedRows = studies
    .map(
      study => `
        <tr>
          <td><a href="${ctgovStudyUrl(study.nctId)}" target="_blank" rel="noopener">${escapeHtml(study.nctId)}</a></td>
          <td>${escapeHtml(study.title)}</td>
          <td>${escapeHtml(formatSponsor(study))}</td>
          <td>${escapeHtml(formatPhases(study))}</td>
          <td>${escapeHtml(formatEnrollment(study))}</td>
          <td>${escapeHtml(study.status || "Unknown")}</td>
          <td>${escapeHtml(formatDate(study.startDate))}</td>
          <td>${escapeHtml(formatDate(study.completionDate))}</td>
          <td>${escapeHtml((study.arms || []).map(arm => arm.title).join(" | ") || "Not reported")}</td>
          <td>${escapeHtml(study.outcome?.title || "Not reported")}</td>
        </tr>`
    )
    .join("\n");

  const demographicsRows = studies
    .map(
      study => `
        <tr>
          <td><a href="${ctgovStudyUrl(study.nctId)}" target="_blank" rel="noopener">${escapeHtml(study.nctId)}</a></td>
          <td>${escapeHtml(formatEligibility(study))}</td>
          <td>${escapeHtml(formatParticipantCounts(study.demographics))}</td>
          <td>${escapeHtml(formatAgeSummary(study.demographics))}</td>
          <td>${escapeHtml(formatSexSummary(study.demographics))}</td>
        </tr>`
    )
    .join("\n");

  const excerptRows = studies
    .map(
      study => `
        <tr>
          <td><a href="${ctgovStudyUrl(study.nctId)}" target="_blank" rel="noopener">${escapeHtml(study.nctId)}</a></td>
          <td>${escapeHtml(truncateText(study.briefSummary, 320))}</td>
          <td>${escapeHtml(truncateText(study.eligibility?.criteria, 260))}</td>
          <td>${escapeHtml(truncateText(formatProtocolOutcomes(study.primaryOutcomes, 2), 320))}</td>
          <td>
            <div class="pillbar">${renderDocumentLinks(study.documents)}</div>
          </td>
        </tr>`
    )
    .join("\n");

  const exclusionRows = Object.entries(topic.exclusionReasons || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(
      ([reason, count]) => `
        <tr>
          <td>${escapeHtml(formatReasonLabel(reason))}</td>
          <td>${count}</td>
        </tr>`
    )
    .join("\n");

  const excludedSampleRows = (topic.excludedStudies || []).slice(0, 20)
    .map(
      study => `
        <tr>
          <td>${study.nctId ? `<a href="${ctgovStudyUrl(study.nctId)}" target="_blank" rel="noopener">${escapeHtml(study.nctId)}</a>` : "No NCT ID"}</td>
          <td>${escapeHtml(study.title || "Untitled record")}</td>
          <td>${escapeHtml((study.reasons || []).map(formatReasonLabel).join(", ") || "No exclusion reason")}</td>
          <td>${escapeHtml(truncateText(study.briefSummary, 260))}</td>
        </tr>`
    )
    .join("\n");

  const benchmarkRows = buildBenchmarkLedgerRows(studies, 16);
  const metaSearchUrl = pubmedSearchUrl(buildBenchmarkQuery(topic.label, "meta"));
  const rctSearchUrl = pubmedSearchUrl(buildBenchmarkQuery(topic.label, "rct"));
  const registryQueryUrl = ctgovSearchUrl(topic.query);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(topic.label)} | Validation Plan</title>
    <link rel="icon" href="data:," />
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f6fb;
        --ink: #16213e;
        --muted: #5b657a;
        --card: #ffffff;
        --line: #d8e0f0;
        --accent: #0f5c7a;
        --accent-soft: #e0f1f8;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: linear-gradient(180deg, #eef4ff 0%, var(--bg) 44%, #ffffff 100%);
        color: var(--ink);
        font: 16px/1.55 "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      }
      main {
        max-width: 1180px;
        margin: 0 auto;
        padding: 32px 20px 56px;
      }
      .hero {
        display: grid;
        gap: 16px;
        padding: 28px;
        background: radial-gradient(circle at top left, #dceefe 0%, #ffffff 55%);
        border: 1px solid var(--line);
        border-radius: 24px;
        box-shadow: 0 16px 48px rgba(15, 52, 96, 0.08);
      }
      .kicker {
        margin: 0;
        color: var(--accent);
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-size: 0.78rem;
      }
      h1, h2 { margin: 0; }
      p { margin: 0; color: var(--muted); }
      .grid {
        display: grid;
        gap: 16px;
        margin-top: 22px;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .card {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 18px;
      }
      .card strong {
        display: block;
        font-size: 1.75rem;
        color: var(--ink);
      }
      .section {
        margin-top: 24px;
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 22px;
      }
      pre {
        margin: 12px 0 0;
        white-space: pre-wrap;
        overflow-x: auto;
        background: #0d1b2a;
        color: #eff6ff;
        padding: 14px;
        border-radius: 14px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 14px;
      }
      th, td {
        border-bottom: 1px solid var(--line);
        text-align: left;
        vertical-align: top;
        padding: 10px 8px;
      }
      th {
        font-size: 0.8rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .pillbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 14px;
      }
      .pill {
        background: var(--accent-soft);
        border: 1px solid #b9d9e7;
        border-radius: 999px;
        padding: 6px 12px;
        font-size: 0.9rem;
        color: var(--ink);
      }
      iframe {
        width: 100%;
        min-height: 420px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: #111827;
      }
      a { color: var(--accent); }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="kicker">CT.gov Validation Pack</p>
        <h1>${escapeHtml(topic.label)}</h1>
        <p>Separate cardiovascular living-meta project generated from the live ClinicalTrials.gov v2 API on ${escapeHtml(
          formatDate(validationMeta.generatedAt)
        )}. Only randomized comparative records with posted results and extractable numeric outcomes are eligible.</p>
        <div class="pillbar">
          <span class="pill">Priority tier: ${escapeHtml(formatTitleCase(topic.priorityTier))}</span>
          <span class="pill">Included RCTs: ${topic.includedCount}</span>
          <span class="pill">Scanned records: ${topic.scannedRecords}</span>
          <span class="pill">Pages fetched: ${topic.pagesFetched}</span>
          <span class="pill">Domain: ${escapeHtml(topic.domain)}</span>
        </div>
      </section>

      <section class="grid">
        <article class="card"><span>Base query</span><strong>${escapeHtml(topic.baseQuery)}</strong></article>
        <article class="card"><span>Keyword pack</span><strong>${escapeHtml(topic.keywords.join(", "))}</strong></article>
        <article class="card"><span>Validation files</span><strong><a href="validation.json">validation.json</a></strong></article>
        <article class="card"><span>App entry</span><strong><a href="index.html">index.html</a></strong></article>
      </section>

      <section class="section">
        <h2>Protocol Framing And Review Question</h2>
        <p>This plan treats the registry-native topic as a living protocol artifact rather than a link collection. The PICO framing and workflow below define what enters the snapshot, how records are screened, and how benchmark reconciliation should be performed before review sign-off.</p>
        <table>
          <thead>
            <tr>
              <th>Element</th>
              <th>Definition</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Population</td><td>${escapeHtml(pico.population)}</td></tr>
            <tr><td>Interventions</td><td>${escapeHtml(pico.interventions)}</td></tr>
            <tr><td>Comparators</td><td>${escapeHtml(pico.comparators)}</td></tr>
            <tr><td>Outcomes</td><td>${escapeHtml(pico.outcomes)}</td></tr>
            <tr><td>Design</td><td>${escapeHtml(pico.design)}</td></tr>
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Exact CT.gov Search Query</h2>
        <pre>${escapeHtml(topic.query)}</pre>
      </section>

      <section class="section">
        <h2>Information Sources And Search History</h2>
        <p>The project was generated directly from the ClinicalTrials.gov v2 API using the exact query below, then checked against publication-oriented benchmark searches so reviewers can compare the registry-native set against the broader literature.</p>
        <div class="pillbar">
          <a class="pill" href="${escapeHtml(registryQueryUrl)}" target="_blank" rel="noopener">CT.gov query</a>
          <a class="pill" href="${escapeHtml(metaSearchUrl)}" target="_blank" rel="noopener">PubMed meta-analysis search</a>
          <a class="pill" href="${escapeHtml(rctSearchUrl)}" target="_blank" rel="noopener">PubMed randomized-trial search</a>
        </div>
        <table>
          <thead>
            <tr>
              <th>Step</th>
              <th>Source</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            ${searchHistoryRows}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Selection And Synthesis Workflow</h2>
        <table>
          <thead>
            <tr>
              <th>Step</th>
              <th>Rule</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            ${workflowRows}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>PRISMA Flow Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Stage</th>
              <th>Count</th>
              <th>Reviewer Note</th>
            </tr>
          </thead>
          <tbody>
            ${prismaRows}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Eligibility Rules</h2>
        <div class="pillbar">
          <span class="pill">Interventional</span>
          <span class="pill">Randomized</span>
          <span class="pill">Completed</span>
          <span class="pill">Posted CT.gov results</span>
          <span class="pill">At least 2 arms</span>
          <span class="pill">Numeric outcome extractable</span>
        </div>
      </section>

      <section class="grid">
        <article class="card">
          <span>Protocol metadata coverage</span>
          <strong>${countStudiesWith(studies, study => Boolean(study.briefSummary))}/${studies.length}</strong>
          <p>Trials with a retained CT.gov brief summary excerpt.</p>
        </article>
        <article class="card">
          <span>Demographics coverage</span>
          <strong>${countStudiesWith(studies, study => Boolean(study.demographics))}/${studies.length}</strong>
          <p>Trials with a retained baseline characteristics snapshot.</p>
        </article>
        <article class="card">
          <span>Document coverage</span>
          <strong>${countStudiesWith(studies, study => (study.documents || []).length > 0)}/${studies.length}</strong>
          <p>Trials with protocol or source documents listed on CT.gov.</p>
        </article>
        <article class="card">
          <span>Total reported enrollment</span>
          <strong>${sumEnrollment(studies) || "NR"}</strong>
          <p>Summed from the CT.gov enrollment field across included studies.</p>
        </article>
      </section>

      <section class="section">
        <h2>Included Trial Ledger</h2>
        <table>
          <thead>
            <tr>
              <th>NCT ID</th>
              <th>Title</th>
              <th>Sponsor</th>
              <th>Phase</th>
              <th>Enrollment</th>
              <th>Status</th>
              <th>Start</th>
              <th>Completion</th>
              <th>Arms</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            ${includedRows || '<tr><td colspan="10">No included studies in this snapshot.</td></tr>'}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Study Eligibility And Demographics</h2>
        <p>This table keeps the trial-level age, sex, participant-count, and registry eligibility fields next to the inclusion decision so readers can challenge the clinical comparability of the pooled set.</p>
        <table>
          <thead>
            <tr>
              <th>NCT ID</th>
              <th>Eligibility</th>
              <th>Participant Counts</th>
              <th>Age Snapshot</th>
              <th>Sex Snapshot</th>
            </tr>
          </thead>
          <tbody>
            ${demographicsRows || '<tr><td colspan="5">No demographics captured in this snapshot.</td></tr>'}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Record Excerpts</h2>
        <p>Brief summaries, eligibility text, primary outcome descriptions, and source documents are surfaced here so reviewers can verify that the extracted numerical contrast is clinically aligned with the underlying registry record.</p>
        <table>
          <thead>
            <tr>
              <th>NCT ID</th>
              <th>Brief Summary</th>
              <th>Eligibility Excerpt</th>
              <th>Primary Outcome Excerpt</th>
              <th>Source Documents</th>
            </tr>
          </thead>
          <tbody>
            ${excerptRows || '<tr><td colspan="5">No excerpts available.</td></tr>'}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Exclusion Reason Counts</h2>
        <table>
          <thead>
            <tr>
              <th>Reason</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            ${exclusionRows || '<tr><td colspan="2">No exclusions recorded.</td></tr>'}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Excluded Sample Records</h2>
        <p>The first 20 excluded records are listed here with excerpts so reviewers can quickly verify why the registry pull did not enter them into the meta-analysis snapshot.</p>
        <table>
          <thead>
            <tr>
              <th>NCT ID</th>
              <th>Title</th>
              <th>Reasons</th>
              <th>Record Excerpt</th>
            </tr>
          </thead>
          <tbody>
            ${excludedSampleRows || '<tr><td colspan="4">No excluded samples captured.</td></tr>'}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Benchmark Reconciliation Ledger</h2>
        <p>This ledger turns the benchmark step into a structured reviewer task. Use the NCT IDs, contrasts, and outcome definitions below to check study overlap, arm collapsing, and endpoint alignment against published syntheses.</p>
        <div class="pillbar">
          <a class="pill" href="${escapeHtml(metaSearchUrl)}" target="_blank" rel="noopener">Published meta-analysis search</a>
          <a class="pill" href="${escapeHtml(rctSearchUrl)}" target="_blank" rel="noopener">Randomized trial benchmark search</a>
        </div>
        <table>
          <thead>
            <tr>
              <th>NCT</th>
              <th>Registry Contrast</th>
              <th>Outcome</th>
              <th>Enrollment</th>
              <th>Benchmark Use</th>
            </tr>
          </thead>
          <tbody>
            ${benchmarkRows || '<tr><td colspan="5">No benchmark ledger available.</td></tr>'}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Reviewer Validation And Benchmarking</h2>
        <p>The embedded panel below now runs the shared R benchmark suites plus topic-specific checks for the current CT.gov snapshot. Reviewers should compare the registry-native ledger above against published syntheses, inspect <code>validation.json</code>, and then confirm that the topic-aware runner resolves with the same study universe.</p>
        <div class="pillbar">
          <a class="pill" href="validation.json">Open validation.json</a>
          <a class="pill" href="index.html">Open interactive topic app</a>
          <a class="pill" href="${escapeHtml(metaSearchUrl)}" target="_blank" rel="noopener">Published meta-analysis search</a>
          <a class="pill" href="${escapeHtml(rctSearchUrl)}" target="_blank" rel="noopener">Randomized trial benchmark search</a>
          <a class="pill" href="${escapeHtml(runnerHref)}" target="_blank" rel="noopener">Open topic-aware WebR runner</a>
        </div>
        <iframe id="reviewerValidationFrame" src="${escapeHtml(runnerHref)}" title="WebR reviewer validation" loading="lazy"></iframe>
        ${buildRunnerBridgeScript(runnerContextJson)}
      </section>
    </main>
  </body>
</html>`;
}

function buildPortfolioIndex(eligible, validationMeta) {
  const cards = eligible
    .map(
      topic => `
        <article class="topic-card" data-tier="${escapeHtml(topic.priorityTier)}" data-domain="${escapeHtml(topic.domain)}">
          <div class="topic-card__top">
            <p class="topic-tier">${escapeHtml(formatTitleCase(topic.priorityTier))}</p>
            <p class="topic-domain">${escapeHtml(topic.domain)}</p>
          </div>
          <h2>${escapeHtml(topic.label)}</h2>
          <p class="topic-query">${escapeHtml(topic.query)}</p>
          <div class="topic-stats">
            <span>Included RCTs: ${topic.includedCount}</span>
            <span>Scanned: ${topic.scannedRecords}</span>
            <span>Pages: ${topic.pagesFetched}</span>
          </div>
          <div class="topic-links">
            <a href="projects/${escapeHtml(topic.slug)}/index.html">Open project</a>
            <a href="projects/${escapeHtml(topic.slug)}/plan.html">Validation plan</a>
            <a href="projects/${escapeHtml(topic.slug)}/validation.json">JSON</a>
          </div>
        </article>`
    )
    .join("\n");

  const domainCounts = eligible.reduce((acc, topic) => {
    acc[topic.domain] = (acc[topic.domain] || 0) + 1;
    return acc;
  }, {});

  const domainPills = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([domain, count]) => `<span class="pill">${escapeHtml(domain)}: ${count}</span>`)
    .join("\n");

  const tierCounts = eligible.reduce((acc, topic) => {
    acc[topic.priorityTier] = (acc[topic.priorityTier] || 0) + 1;
    return acc;
  }, {});

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CT.gov Cardiovascular Living Meta Portfolio</title>
    <link rel="icon" href="data:," />
    <style>
      :root {
        color-scheme: light;
        --bg: #f2f5fb;
        --ink: #152238;
        --muted: #5a667b;
        --line: #d5dfef;
        --card: rgba(255,255,255,0.9);
        --accent: #144d6d;
        --accent-soft: #e1eef7;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background:
          radial-gradient(circle at top left, rgba(115, 174, 255, 0.22), transparent 32%),
          radial-gradient(circle at top right, rgba(20, 77, 109, 0.12), transparent 24%),
          linear-gradient(180deg, #eef5ff 0%, var(--bg) 52%, #ffffff 100%);
        color: var(--ink);
        font: 16px/1.6 "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      }
      main {
        max-width: 1400px;
        margin: 0 auto;
        padding: 30px 20px 56px;
      }
      .hero {
        display: grid;
        gap: 18px;
        padding: 30px;
        background: linear-gradient(145deg, rgba(255,255,255,0.96), rgba(227, 241, 250, 0.9));
        border: 1px solid var(--line);
        border-radius: 28px;
        box-shadow: 0 22px 56px rgba(21, 34, 56, 0.08);
      }
      .kicker {
        margin: 0;
        color: var(--accent);
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      h1, h2, p { margin: 0; }
      .hero p:last-of-type { color: var(--muted); max-width: 1000px; }
      .summary {
        display: grid;
        gap: 14px;
        margin-top: 24px;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .summary-card, .topic-card {
        background: var(--card);
        backdrop-filter: blur(10px);
        border: 1px solid var(--line);
        border-radius: 22px;
        box-shadow: 0 12px 36px rgba(21, 34, 56, 0.06);
      }
      .summary-card {
        padding: 20px;
      }
      .summary-card strong {
        display: block;
        font-size: 2rem;
      }
      .pillbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 12px;
      }
      .pill {
        background: var(--accent-soft);
        border: 1px solid #bfd6e7;
        border-radius: 999px;
        padding: 6px 12px;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        margin-top: 26px;
      }
      .toolbar select {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 10px 14px;
        background: white;
        color: var(--ink);
      }
      .topic-grid {
        display: grid;
        gap: 18px;
        margin-top: 24px;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      }
      .topic-card {
        padding: 20px;
        display: grid;
        gap: 14px;
      }
      .topic-card__top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        color: var(--muted);
        font-size: 0.88rem;
      }
      .topic-tier {
        color: var(--accent);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .topic-query {
        color: var(--muted);
        font-size: 0.94rem;
      }
      .topic-stats, .topic-links {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .topic-stats span {
        padding: 6px 10px;
        border-radius: 999px;
        background: #f3f7fb;
        border: 1px solid var(--line);
      }
      .topic-links a {
        color: var(--accent);
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="kicker">ClinicalTrials.gov Native Portfolio</p>
        <h1>Cardiovascular Living Meta-Analysis Projects</h1>
        <p>Separate single-topic projects generated from the live ClinicalTrials.gov v2 API on ${escapeHtml(
          formatDate(validationMeta.generatedAt)
        )}. Every included study in this portfolio met the same registry-native gate: randomized interventional design, completed status, posted results, at least two arms, and at least one extractable numeric outcome. Each topic project now includes a reviewer pack with protocol metadata, search history, record excerpts, demographics, benchmark links, and an embedded WebR validation panel.</p>
        <div class="pillbar">
          <span class="pill">Eligible topics: ${eligible.length}</span>
          <span class="pill">Build-now: ${tierCounts["build-now"] || 0}</span>
          <span class="pill">Promising: ${tierCounts.promising || 0}</span>
          <span class="pill">Early: ${tierCounts.early || 0}</span>
        </div>
        <div class="pillbar">${domainPills}</div>
      </section>

      <section class="summary">
        <article class="summary-card">
          <span>Largest evidence base</span>
          <strong>${eligible[0]?.includedCount || 0}</strong>
          <p>${escapeHtml(eligible[0]?.label || "None")}</p>
        </article>
        <article class="summary-card">
          <span>Most prolific domain</span>
          <strong>${escapeHtml(
            Object.entries(domainCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "None"
          )}</strong>
          <p>Domain counts derived from the validated portfolio manifest.</p>
        </article>
        <article class="summary-card">
          <span>Validation manifest</span>
          <strong><a href="generated/portfolio-manifest.json">portfolio-manifest.json</a></strong>
          <p>Topic-level query, count, tier, and project links.</p>
        </article>
      </section>

      <div class="toolbar">
        <label>
          Tier
          <select id="tierFilter">
            <option value="all">All</option>
            <option value="build-now">Build-now</option>
            <option value="promising">Promising</option>
            <option value="early">Early</option>
          </select>
        </label>
        <label>
          Domain
          <select id="domainFilter">
            <option value="all">All</option>
            ${Object.keys(domainCounts)
              .sort((a, b) => a.localeCompare(b))
              .map(domain => `<option value="${escapeHtml(domain)}">${escapeHtml(domain)}</option>`)
              .join("\n")}
          </select>
        </label>
      </div>

      <section class="topic-grid" id="topicGrid">
        ${cards}
      </section>
    </main>
    <script>
      const tierFilter = document.getElementById("tierFilter");
      const domainFilter = document.getElementById("domainFilter");
      const cards = Array.from(document.querySelectorAll(".topic-card"));
      function applyFilters() {
        const tier = tierFilter.value;
        const domain = domainFilter.value;
        for (const card of cards) {
          const matchesTier = tier === "all" || card.dataset.tier === tier;
          const matchesDomain = domain === "all" || card.dataset.domain === domain;
          card.hidden = !(matchesTier && matchesDomain);
        }
      }
      tierFilter.addEventListener("change", applyFilters);
      domainFilter.addEventListener("change", applyFilters);
    </script>
  </body>
</html>`;
}

async function run() {
  const validation = JSON.parse(await fs.readFile(VALIDATION_PATH, "utf8"));
  const sharedTemplate = await fs.readFile(path.join(SHARED_APP_ROOT, "index.html"), "utf8");
  const eligible = validation.topics
    .filter(topic => topic.portfolioEligible)
    .sort((a, b) => b.includedCount - a.includedCount || a.label.localeCompare(b.label));

  await fs.rm(PROJECTS_DIR, { recursive: true, force: true });
  await fs.mkdir(PROJECTS_DIR, { recursive: true });

  const manifest = {
    generatedAt: validation.generatedAt,
    sourceValidation: "generated/topic-validation.json",
    totalEligibleTopics: eligible.length,
    topics: []
  };

  for (const topic of eligible) {
    const projectDir = path.join(PROJECTS_DIR, topic.slug);
    await fs.mkdir(projectDir, { recursive: true });

    const topicValidation = {
      generatedAt: validation.generatedAt,
      sourceStartedAt: validation.startedAt,
      minIncludedTrials: validation.minIncludedTrials,
      pageSize: validation.pageSize,
      maxPages: validation.maxPages,
      topic
    };

    await fs.writeFile(path.join(projectDir, "validation.json"), JSON.stringify(topicValidation, null, 2));
    await fs.writeFile(path.join(projectDir, "plan.html"), buildPlanHtml(topic, validation));
    await fs.writeFile(path.join(projectDir, "index.html"), buildWrapperHtml(sharedTemplate, topic, validation));

    manifest.topics.push({
      slug: topic.slug,
      label: topic.label,
      domain: topic.domain,
      includedCount: topic.includedCount,
      scannedRecords: topic.scannedRecords,
      pagesFetched: topic.pagesFetched,
      priorityTier: topic.priorityTier,
      query: topic.query,
      links: {
        app: `projects/${topic.slug}/index.html`,
        plan: `projects/${topic.slug}/plan.html`,
        validation: `projects/${topic.slug}/validation.json`
      }
    });
  }

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  await fs.writeFile(PORTFOLIO_INDEX_PATH, buildPortfolioIndex(eligible, validation));

  process.stdout.write(`Generated ${eligible.length} CT.gov cardiovascular project folders in ${PROJECTS_DIR}\n`);
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
