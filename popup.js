// popup.js — Combined, final version: history analysis, charts, CSV export, AI helpers

/* ----------------- Site personality map (extend as needed) ----------------- */
const sitePersonalityMap = {
  "youtube.com": { personality: "extrovert", privacy: "medium", category: "social", weight: 2 },
  "netflix.com": { personality: "extrovert", privacy: "medium", category: "social", weight: 2 },
  "vtucircle.com": { personality: "extrovert", privacy: "medium", category: "social", weight: 2 },
  "chatgpt.com": { personality: "ambivert", privacy: "medium", category: "tech", weight: 2 },
  "chat.deepseek.com": { personality: "ambivert", privacy: "medium", category: "tech", weight: 2 },
  "facebook.com": { personality: "extrovert", privacy: "low", category: "social", weight: 3 },
  "instagram.com": { personality: "extrovert", privacy: "low", category: "social", weight: 3 },
  "twitter.com": { personality: "extrovert", privacy: "low", category: "social", weight: 2 },
  "canva.com": { personality: "extrovert", privacy: "medium", category: "social", weight: 3 },
  "snapchat.com": { personality: "extrovert", privacy: "low", category: "social", weight: 2 },
  "pinterest.com": { personality: "ambivert", privacy: "medium", category: "social", weight: 1 },
  "linkedin.com": { personality: "ambivert", privacy: "medium", category: "professional", weight: 2 },
  "github.com": { personality: "introvert", privacy: "high", category: "tech", weight: 3 },
  "stackoverflow.com": { personality: "introvert", privacy: "medium", category: "tech", weight: 2 },
  "duckduckgo.com": { personality: "introvert", privacy: "high", category: "privacy", weight: 3 },
  // add more mappings as needed...
};

/* ----------------- State ----------------- */
let lastAnalysis = null;
let barChart = null;
let doughnutChart = null;

/* ----------------- DOM refs (supports multiple popup variants) ----------------- */
const analyzeBtn = document.getElementById('analyzeBtn');
const exportBtn  = document.getElementById('exportBtn');
const getAIBtn   = document.getElementById('getAI');
const historyRange= document.getElementById('historyRange');
const consentCheck = document.getElementById('consentCheck');
const apiKeyInput = document.getElementById('apiKey'); // optional

// UI output fields (two variants supported for compatibility)
const personalityBadge = document.getElementById('personalityBadge') || document.getElementById('personalityResult');
const privacyOutput = document.getElementById('privacyResult') || null;
const behaviorOutput= document.getElementById('behaviorResult') || null;

const insightText = document.getElementById('insightText');
const sitesList = document.getElementById('sitesList');
const totalSitesEl = document.getElementById('totalSites');
const totalVisitsEl = document.getElementById('totalVisits');
const privacyScoreEl = document.getElementById('privacyScore');

/* ----------------- Event listeners ----------------- */
if (analyzeBtn) analyzeBtn.addEventListener('click', startAnalysis);
if (exportBtn)  exportBtn.addEventListener('click', exportResults);
if (getAIBtn)   getAIBtn.addEventListener('click', onGetAiClicked);

/* ----------------- UI helpers ----------------- */
function setLoading(btn, state=true) { if (btn) btn.disabled = state; }
function showInsight(text) { if (insightText) insightText.textContent = text || ''; }
function setPersonalityBadge(text) { if (personalityBadge) personalityBadge.textContent = (text || '').toString().toUpperCase(); }
function safeElSet(el, value) { if (!el) return; el.textContent = value; }

/* ----------------- History fetch ----------------- */
function getHistoryData(days, maxResults = 10000) {
  return new Promise((resolve, reject) => {
    const msAgo = days * 24 * 60 * 60 * 1000;
    const startTime = Date.now() - msAgo;
    try {
      chrome.history.search({ text: '', startTime, maxResults }, (items) => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        resolve(items || []);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/* ----------------- Analysis ----------------- */
function analyzePersonality(historyData) {
  const siteFrequency = {};
  const categoryCounts = { social: 0, tech: 0, professional: 0, privacy: 0, other: 0 };
  const personalityCounts = { introvert: 0, extrovert: 0, ambivert: 0 };
  const privacyCounts = { low: 0, medium: 0, high: 0 };
  let totalVisits = 0;

  historyData.forEach(item => {
    try {
      const url = item.url || '';
      const domain = (new URL(url).hostname.replace(/^www\./,'')).toLowerCase();
      const visits = Number(item.visitCount || 1);
      if (!domain) return;
      siteFrequency[domain] = (siteFrequency[domain] || 0) + visits;
      totalVisits += visits;

      const map = sitePersonalityMap[domain];
      if (map) {
        const w = (map.weight || 1) * visits;
        personalityCounts[map.personality] = (personalityCounts[map.personality] || 0) + w;
        privacyCounts[map.privacy] = (privacyCounts[map.privacy] || 0) + w;
        if (map.category && categoryCounts.hasOwnProperty(map.category)) categoryCounts[map.category] += w;
        else categoryCounts.other += w;
      } else {
        categoryCounts.other += visits;
      }
    } catch (e) {
      // skip malformed urls
    }
  });

  const getMaxKey = (o) => Object.keys(o).reduce((a,b) => o[a] >= o[b] ? a : b, Object.keys(o)[0] || null);

  const predictedPersonality = getMaxKey(personalityCounts) || 'neutral';
  const predictedPrivacy = getMaxKey(privacyCounts) || 'unknown';
  const dominantCategory = getMaxKey(categoryCounts) || 'other';

  const totalWeight = Object.values(categoryCounts).reduce((a,b)=>a+b,0) || 1;
  const socialScore = Math.round((categoryCounts.social / totalWeight) * 100);
  const techScore = Math.round((categoryCounts.tech / totalWeight) * 100);
  const privacyScore = Math.round((categoryCounts.privacy / totalWeight) * 100);

  const topSites = Object.entries(siteFrequency)
    .sort((a,b)=>b[1]-a[1])
    .slice(0, 20)
    .map(([domain, visits]) => ({ domain, visits, category: sitePersonalityMap[domain]?.category || 'other' }));

  return {
    personality: predictedPersonality,
    privacy: predictedPrivacy,
    behavior: dominantCategory,
    stats: {
      totalSites: Object.keys(siteFrequency).length,
      totalVisits,
      socialScore,
      techScore,
      privacyScore
    },
    topSites,
    analyzedSites: topSites, // preserve naming used in CSV creation
    insight: `Your browsing shows ${predictedPersonality} tendencies with ${predictedPrivacy} privacy awareness. Dominant behavior: ${dominantCategory}.`
  };
}

/* ----------------- Display + charts ----------------- */
function displayResults(analysis) {
  if (!analysis) return;
  lastAnalysis = analysis;

  // Badge + simple fields
  setPersonalityBadge(analysis.personality);
  if (privacyOutput) privacyOutput.textContent = analysis.privacy;
  if (behaviorOutput) behaviorOutput.textContent = analysis.behavior;
  safeElSet(totalSitesEl, analysis.stats.totalSites ?? 0);
  safeElSet(totalVisitsEl, analysis.stats.totalVisits ?? 0);
  safeElSet(privacyScoreEl, (analysis.stats.privacyScore ?? 0) + '%');
  showInsight(analysis.insight);

  // top sites as pills
  if (sitesList) {
    sitesList.innerHTML = (analysis.topSites || []).slice(0, 10).map(s => {
      return `<div class="site-pill" title="${s.domain}">${s.domain} <span style="opacity:0.8">(${s.visits})</span></div>`;
    }).join(' ');
  }

  // draw charts if canvas elements exist
  try {
    if (document.getElementById('barChart')) drawBarChart((analysis.topSites || []).slice(0, 10));
    if (document.getElementById('doughnutChart')) drawDoughnutChart(analysis);
  } catch (e) {
    console.warn('Chart draw failed: ', e);
  }

  // save last analysis to storage for popup reloads
  try {
    chrome.runtime.sendMessage({ action: 'saveAnalysis', data: analysis }, () => {});
    chrome.storage.local.set({ lastAnalysis: analysis }, () => {});
  } catch (e) { /* ignore */ }
}

/* -------------- Chart drawing (Chart.js must be loaded locally as libs/chart.min.js) -------------- */
function drawBarChart(topSites) {
  const canvas = document.getElementById('barChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const labels = topSites.map(s => s.domain);
  const data = topSites.map(s => s.visits);

  if (barChart) {
    barChart.data.labels = labels;
    barChart.data.datasets[0].data = data;
    barChart.update();
    return;
  }

  // Chart configuration
  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Visits',
        data,
        backgroundColor: labels.map(() => 'rgba(91,108,255,0.85)'),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxRotation: 45, minRotation: 0 }, grid: { display: false } },
        y: { beginAtZero: true }
      }
    }
  });
}

function drawDoughnutChart(analysis) {
  const canvas = document.getElementById('doughnutChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const catCounts = {};
  (analysis.topSites || []).forEach(s => { catCounts[s.category] = (catCounts[s.category] || 0) + s.visits; });

  const labels = Object.keys(catCounts);
  const data = labels.map(k => catCounts[k]);

  if (doughnutChart) {
    doughnutChart.data.labels = labels;
    doughnutChart.data.datasets[0].data = data;
    doughnutChart.update();
    return;
  }

  doughnutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ['#5b6cff', '#7b3fe4', '#4ecdc4', '#ffb86b', '#f86b9b']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });
}

/* ----------------- CSV creation + download ----------------- */
function createCombinedCSV(historyItems = [], analysis = null, timeframeDays = null) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };

  const rows = [];

  // RAW HISTORY section
  rows.push('RAW_HISTORY');
  rows.push('ExportedAt,TimeframeDays');
  rows.push(`${esc(new Date().toISOString())},${esc(timeframeDays)}`);
  rows.push('');
  rows.push('url,title,domain,visitCount,lastVisitTime_ISO,typedCount');

  for (const it of historyItems) {
    try {
      const url = it.url || '';
      const title = it.title || '';
      let domain = '';
      try { domain = new URL(url).hostname.replace(/^www\./,''); } catch (e) { domain = ''; }
      const visitCount = Number(it.visitCount || 0);
      const lastVisitISO = it.lastVisitTime ? (new Date(it.lastVisitTime)).toISOString() : '';
      const typedCount = Number(it.typedCount || 0);
      rows.push([esc(url), esc(title), esc(domain), visitCount, esc(lastVisitISO), typedCount].join(','));
    } catch (e) { /* skip */ }
  }

  rows.push('');

  // ANALYZED_SITES section (if available)
  if (analysis && Array.isArray(analysis.analyzedSites) && analysis.analyzedSites.length) {
    rows.push('ANALYZED_SITES');
    rows.push('domain,visits,category,personality,privacy');
    for (const s of analysis.analyzedSites) {
      rows.push([esc(s.domain||''), Number(s.visits||0), esc(s.category||''), esc(s.personality||''), esc(s.privacy||'')].join(','));
    }
    rows.push('');
  }

  // TOP_SITES section
  if (analysis && Array.isArray(analysis.topSites) && analysis.topSites.length) {
    rows.push('TOP_SITES');
    rows.push('domain,visits,category');
    for (const t of analysis.topSites) {
      rows.push([esc(t.domain||''), Number(t.visits||0), esc(t.category||'')].join(','));
    }
    rows.push('');
  }

  // ANALYSIS_SUMMARY
  if (analysis && analysis.stats) {
    rows.push('ANALYSIS_SUMMARY');
    rows.push('personality,privacy,behavior,totalSites,totalVisits,socialScore,techScore,privacyScore');
    rows.push([
      esc(analysis.personality||''),
      esc(analysis.privacy||''),
      esc(analysis.behavior||''),
      Number(analysis.stats.totalSites||0),
      Number(analysis.stats.totalVisits||0),
      Number(analysis.stats.socialScore||0),
      Number(analysis.stats.techScore||0),
      Number(analysis.stats.privacyScore||0)
    ].join(','));
    rows.push('');
  }

  return rows.join('\n');
}

function downloadBlob(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ----------------- Main actions ----------------- */
async function startAnalysis() {
  const days = Number(historyRange?.value || 30);
  setLoading(analyzeBtn, true);
  try {
    const historyData = await getHistoryData(days, 20000);
    console.log('[startAnalysis] historyData length =', historyData.length);
    const analysis = analyzePersonality(historyData);
    displayResults(analysis);
  } catch (err) {
    console.error('startAnalysis error', err);
    alert('Analysis failed: ' + (err && err.message ? err.message : String(err)));
  } finally {
    setLoading(analyzeBtn, false);
  }
}

async function exportResults() {
  const days = Number(historyRange?.value || 30);
  setLoading(exportBtn, true);
  try {
    const historyData = await getHistoryData(days, 20000);
    console.log('[exportResults] history length =', historyData.length);
    if (!historyData || historyData.length === 0) {
      console.warn('[exportResults] no history returned. Check manifest permissions and testing profile.');
    }
    const csv = createCombinedCSV(historyData || [], lastAnalysis, days);
    downloadBlob(csv, `history_and_analysis_${days}days_${Date.now()}.csv`);
    console.log('✅ CSV generated and downloaded');
  } catch (err) {
    console.error('exportResults error', err);
    alert('Export failed: ' + (err && err.message ? err.message : String(err)));
  } finally {
    setLoading(exportBtn, false);
  }
}

/* ----------------- AI helpers (background-based) ----------------- */
function buildSanitizedSummary(lastAnalysisObj, daysSelected) {
  if (!lastAnalysisObj) return null;
  return {
    topSites: (lastAnalysisObj.topSites || []).slice(0, 20).map(s => ({ domain: s.domain, visits: s.visits || 0 })),
    stats: lastAnalysisObj.stats || {},
    personality: lastAnalysisObj.personality,
    privacy: lastAnalysisObj.privacy,
    timeframeDays: daysSelected || null
  };
}

function callAiUsingStoredKey(summary, onDone) {
  chrome.runtime.sendMessage({ action: 'callAI', data: summary }, (resp) => {
    if (!resp) return onDone({ ok:false, error:'No response from background' });
    return resp.ok ? onDone({ ok:true, data:resp.data }) : onDone({ ok:false, error:resp.error });
  });
}

function callAiWithInlineKey(summary, apiKey, onDone) {
  chrome.runtime.sendMessage({ action: 'callAI', data: summary, apiKey }, (resp) => {
    if (!resp) return onDone({ ok:false, error:'No response from background' });
    return resp.ok ? onDone({ ok:true, data:resp.data }) : onDone({ ok:false, error:resp.error });
  });
}

function extractOpenAiText(openaiResp) {
  try {
    if (!openaiResp) return null;
    if (openaiResp.choices && openaiResp.choices[0]) {
      const c = openaiResp.choices[0];
      if (c.message && c.message.content) return c.message.content;
      if (c.text) return c.text;
    }
    return JSON.stringify(openaiResp);
  } catch (e) {
    console.error('Failed to extract text from OpenAI response', e);
    return null;
  }
}

function onGetAiClicked() {
  if (!lastAnalysis) { alert('Run analysis first.'); return; }
  if (!consentCheck?.checked) {
    if (!confirm('Consent required: aggregated summary (no raw URLs) will be sent to AI provider. Continue?')) return;
  }
  const summary = buildSanitizedSummary(lastAnalysis, Number(historyRange.value || 30));
  if (!summary) { alert('No summary available. Run analysis.'); return; }

  const inlineKey = (apiKeyInput?.value || '').trim();
  const useInline = !!inlineKey;
  setLoading(getAIBtn, true);

  const done = (result) => {
    setLoading(getAIBtn, false);
    if (!result.ok) { alert('AI call failed: ' + (result.error || 'unknown')); return; }
    const text = extractOpenAiText(result.data);
    if (text) {
      showInsight((lastAnalysis.insight || '') + '\n\nAI:\n' + text);
      chrome.storage.local.set({ lastAiResponse: text });
    } else {
      alert('AI returned no readable text.');
    }
  };

  if (useInline) callAiWithInlineKey(summary, inlineKey, done);
  else callAiUsingStoredKey(summary, done);
}

/* ----------------- Restore saved analysis on load ----------------- */
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['lastAnalysis','openai_api_key'], (res) => {
    if (res) {
      if (res.lastAnalysis) {
        lastAnalysis = res.lastAnalysis;
        displayResults(lastAnalysis);
      }
      if (res.openai_api_key && apiKeyInput) apiKeyInput.value = res.openai_api_key;
    }
  });
});
