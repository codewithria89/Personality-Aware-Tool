// background.js
const OPENAI_API_HOST = 'https://api.openai.com/v1/chat/completions';

async function callOpenAI(apiKey, messages, options = {}) {
  const body = {
    model: options.model || 'gpt-4o-mini',
    messages,
    max_tokens: options.max_tokens || 400,
    temperature: options.temperature ?? 0.7
  };

  const resp = await fetch(OPENAI_API_HOST, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const text = await resp.text();
    const err = new Error(`OpenAI API error ${resp.status}: ${text}`);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      if (!request || !request.action) { sendResponse({ ok: false, error: 'No action specified' }); return; }

      if (request.action === 'saveAnalysis') {
        const data = request.data || null;
        if (!data) { sendResponse({ ok: false, error: 'No analysis data' }); return; }
        chrome.storage.local.set({ lastAnalysis: data }, () => sendResponse({ ok: true }));
        return;
      }

      if (request.action === 'setApiKey') {
        const key = (request.apiKey || '').trim();
        if (!key) { sendResponse({ ok: false, error: 'Empty API key' }); return; }
        chrome.storage.local.set({ openai_api_key: key }, () => sendResponse({ ok: true }));
        return;
      }

      if (request.action === 'clearApiKey') {
        chrome.storage.local.remove('openai_api_key', () => sendResponse({ ok: true }));
        return;
      }

      if (request.action === 'getApiKey') {
        chrome.storage.local.get(['openai_api_key'], (res) => sendResponse({ ok: true, apiKey: res.openai_api_key || null }));
        return;
      }

      if (request.action === 'callAI') {
        const summary = request.data?.summary || request.data || null;
        if (!summary) { sendResponse({ ok: false, error: 'No summary provided' }); return; }

        const inlineKey = request.apiKey || null;
        const store = await new Promise((r) => chrome.storage.local.get(['openai_api_key'], r));
        const storedKey = store?.openai_api_key || null;
        const apiKey = (storedKey && storedKey.trim()) || (inlineKey && inlineKey.trim()) || null;
        if (!apiKey) { sendResponse({ ok: false, error: 'No OpenAI API key configured.' }); return; }

        const sanitized = {
          top_domains: Array.isArray(summary.topSites) ? summary.topSites.slice(0,20).map(s=>({domain:s.domain, visits:s.visits||0})) : (summary.topDomains||[]),
          category_scores: summary.categoryScores || { social: summary.stats?.socialScore, tech: summary.stats?.techScore, privacy: summary.stats?.privacyScore },
          total_sites: summary.stats?.totalSites ?? summary.totalSites ?? null,
          total_visits: summary.stats?.totalVisits ?? summary.totalVisits ?? null,
          personality_guess: summary.personality ?? null,
          privacy_guess: summary.privacy ?? null,
          timeframe_days: summary.timeframeDays ?? summary.days ?? null
        };

        const systemMessage = { role: 'system', content: 'You are a privacy-focused assistant. Do not request raw URLs or personal identifiers.' };
        const userMessage = { role: 'user', content: `Aggregated browsing summary (no raw URLs): ${JSON.stringify(sanitized)}. Provide 3 concise insights and 3 practical actions.` };

        const openaiResponse = await callOpenAI(apiKey, [systemMessage, userMessage], { model: request.model || 'gpt-4o-mini', max_tokens: request.max_tokens || 400 });
        sendResponse({ ok: true, data: openaiResponse });
        return;
      }

      sendResponse({ ok: false, error: `Unknown action ${request.action}` });
    } catch (err) {
      console.error('background handler error', err);
      try { sendResponse({ ok: false, error: String(err) }); } catch(e){}
    }
  })();

  return true;
});
