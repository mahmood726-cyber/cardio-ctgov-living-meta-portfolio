import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PORTFOLIO_ROOT = path.resolve(SCRIPT_DIR, "..");
const MANIFEST_PATH = path.join(PORTFOLIO_ROOT, "generated", "portfolio-manifest.json");
const OUTPUT_PATH = path.join(PORTFOLIO_ROOT, "generated", "browser-validation.json");
const BASE_URL =
  process.env.PORTFOLIO_BASE_URL || "http://127.0.0.1:8767/cardio-ctgov-living-meta-portfolio";

async function validateIndex(page) {
  const errors = [];
  page.on("console", msg => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(() => ({
    title: document.title,
    cardCount: document.querySelectorAll(".topic-card").length,
    summaryExists: Boolean(document.querySelector(".summary")),
    heroExists: Boolean(document.querySelector(".hero"))
  }));
  return {
    ...result,
    consoleErrors: errors,
    pass:
      result.title.includes("CT.gov Cardiovascular Living Meta Portfolio") &&
      result.cardCount > 0 &&
      result.summaryExists &&
      result.heroExists &&
      errors.length === 0
  };
}

async function validateTopic(page, topic) {
  const errors = [];
  page.removeAllListeners("console");
  page.removeAllListeners("pageerror");
  page.on("console", msg => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));

  const url = `${BASE_URL}/${topic.links.app.replace(/\\/g, "/")}`;
  const startedAt = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".validation-snapshot", { timeout: 15000 });

  let updateResolved = false;
  let trialsResolved = false;
  try {
    await page.waitForFunction(
      () => document.getElementById("lastUpdate")?.textContent?.trim() !== "Never",
      { timeout: 25000 }
    );
    updateResolved = true;
  } catch {}

  try {
    await page.waitForFunction(
      () => Number(document.getElementById("trialCount")?.textContent || "0") > 0,
      { timeout: 25000 }
    );
    trialsResolved = true;
  } catch {}

  try {
    await page.waitForFunction(
      () => !document.getElementById("topicMeta")?.innerText?.includes("Query pending"),
      { timeout: 12000 }
    );
  } catch {}

  const details = await page.evaluate(() => ({
    title: document.title,
    appTitle: document.getElementById("appTitle")?.textContent?.trim() || "",
    topicPanelTitle: document.getElementById("topicPanelTitle")?.textContent?.trim() || "",
    topicCount: Number(document.getElementById("topicCount")?.textContent || "0"),
    trialCount: Number(document.getElementById("trialCount")?.textContent || "0"),
    activeTopicTitle: document.getElementById("topicTitle")?.textContent?.trim() || "",
    topicMeta: document.getElementById("topicMeta")?.innerText?.trim() || "",
    lastUpdate: document.getElementById("lastUpdate")?.textContent?.trim() || "",
    hasSnapshot: Boolean(document.querySelector(".validation-snapshot")),
    hasReviewerPack: Boolean(document.querySelector(".reviewer-pack")),
    hasReviewerIframe: Boolean(document.querySelector('.reviewer-pack iframe')),
    hasSearchHistory: document.body.innerText.includes("Search History Log"),
    hasDemographicsSection: document.body.innerText.includes("Study Eligibility And Demographics"),
    hasRecordExcerpts: document.body.innerText.includes("Record Excerpts"),
    hasPicoSection: document.body.innerText.includes("Review Question And PICO"),
    hasBenchmarkLedger: document.body.innerText.includes("Benchmark Reconciliation Ledger"),
    reviewerIframeSrc: document.querySelector('.reviewer-pack iframe')?.getAttribute('src') || '',
    updateLogTop: document.getElementById("logStream")?.innerText?.split("\n").slice(0, 4) || []
  }));

  const elapsedMs = Date.now() - startedAt;
  return {
    slug: topic.slug,
    url,
    expectedIncludedCount: topic.includedCount,
    updateResolved,
    trialsResolved,
    elapsedMs,
    consoleErrors: errors,
    ...details,
    pass:
      details.hasSnapshot &&
      details.hasReviewerPack &&
      details.hasReviewerIframe &&
      details.hasSearchHistory &&
      details.hasDemographicsSection &&
      details.hasRecordExcerpts &&
      details.hasPicoSection &&
      details.hasBenchmarkLedger &&
      details.reviewerIframeSrc.includes('validation=') &&
      details.title.includes(topic.label) &&
      details.appTitle.includes(topic.label) &&
      details.topicCount >= 1 &&
      details.trialCount >= 1 &&
      !details.topicMeta.includes("Query pending") &&
      errors.length === 0
  };
}

async function run() {
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const index = await validateIndex(page);
  const topics = [];
  for (const topic of manifest.topics) {
    const result = await validateTopic(page, topic);
    topics.push(result);
  }

  await browser.close();

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    totalTopics: topics.length,
    passedTopics: topics.filter(topic => topic.pass).length,
    failedTopics: topics.filter(topic => !topic.pass).length,
    indexPass: index.pass
  };

  const payload = { summary, index, topics };
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2));

  console.log(JSON.stringify(summary, null, 2));

  if (!index.pass || summary.failedTopics > 0) {
    process.exitCode = 1;
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
