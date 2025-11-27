(function() {
    'use strict';
    
    // Enhanced site detection patterns
    const sitePatterns = {
        social: [
            /facebook\.com/,
            /instagram\.com/,
            /twitter\.com/,
            /snapchat\.com/,
            /pinterest\.com/,
            /linkedin\.com/,
            /tiktok\.com/,
            /reddit\.com/,
            /tumblr\.com/,
            /flickr\.com/,
            /whatsapp\.com/,
            /telegram\.org/,
            /discord\.com/,
            /twitch\.tv/,
            /youtube\.com/,
            /vimeo\.com/,
            /weibo\.com/,
            /vk\.com/,
            /line\.me/,
            /wechat\.com/
        ],
        tech: [
            /kodnest\.com/,
            /github\.com/,
            /stackoverflow\.com/,
            /dev\.to/,
            /hackernews/,
            /gitlab\.com/,
            /codepen\.io/,
            /repl\.it/,
            /jsfiddle\.net/,
            /codesandbox\.io/,
            /npmjs\.com/,
            /docker\.com/,
            /kubernetes\.io/,
            /digitalocean\.com/,
            /aws\.amazon\.com/,
            /azure\.microsoft\.com/,
            /cloud\.google\.com/,
            /heroku\.com/,
            /netlify\.com/,
            /vercel\.com/,
            /wordpress\.org/
        ],
        privacy: [
            /duckduckgo\.com/,
            /protonmail\.com/,
            /signal\.org/,
            /tor\.org/,
            /startpage\.com/,
            /brave\.com/,
            /privacytools\.io/,
            /eff\.org/,
            /privacy\.com/,
            /bitwarden\.com/,
            /lastpass\.com/,
            /1password\.com/,
            /keepass\.org/,
            /vpn\./,
            /expressvpn\.com/,
            /nordvpn\.com/,
            /mullvad\.net/,
            /torproject\.org/,
            /tails\.boum\.org/,
            /qubes-os\.org/
        ],
        professional: [
            /medium\.com/,
            /behance\.net/,
            /dribbble\.com/,
            /slideshare\.net/,
            /linkedin\.com/,
            /xing\.com/,
            /angel\.co/,
            /glassdoor\.com/,
            /indeed\.com/,
            /monster\.com/,
            /careerbuilder\.com/,
            /upwork\.com/,
            /fiverr\.com/,
            /freelancer\.com/,
            /notion\.so/,
            /trello\.com/,
            /asana\.com/,
            /slack\.com/,
            /basecamp\.com/,
            /atlassian\.net/
        ],
        news: [
            /cnn\.com/,
            /bbc\.com/,
            /reuters\.com/,
            /apnews\.com/,
            /theguardian\.com/,
            /nytimes\.com/,
            /washingtonpost\.com/,
            /wsj\.com/,
            /bloomberg\.com/,
            /aljazeera\.com/
        ],
        shopping: [
            /amazon\.com/,
            /ebay\.com/,
            /myntra\.com/,
            /blinkit\.com/,
            /bigbasket\.com/,
            /nykaa\.com/,
            /meesho\.com/,
            /zomato\.com/,
            /flipkart\.com/,
            /swiggy\.com/
        ]
    };
    
    // Detect current site category
    function detectSiteCategory() {
        const hostname = window.location.hostname.replace(/^www\./, '');
        
        for (const [category, patterns] of Object.entries(sitePatterns)) {
            if (patterns.some(pattern => pattern.test(hostname))) {
                return category;
            }
        }
        return 'other';
    }
    
    // Track user engagement metrics
    let startTime = Date.now();
    let scrollDepth = 0;
    let clicks = 0;
    
    // Scroll tracking
    window.addEventListener('scroll', () => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const currentScroll = window.pageYOffset;
        scrollDepth = Math.max(scrollDepth, (currentScroll / maxScroll) * 100);
    });
    
    // Click tracking
    document.addEventListener('click', () => {
        clicks++;
    });
    
    // Send engagement data when page unloads
    window.addEventListener('beforeunload', () => {
        const timeSpent = Date.now() - startTime;
        const category = detectSiteCategory();
        
        const engagementData = {
            hostname: window.location.hostname.replace(/^www\./, ''),
            category: category,
            timeSpent: timeSpent,
            scrollDepth: Math.round(scrollDepth),
            clicks: clicks,
            timestamp: Date.now()
        };
        
        // Send to extension background
        chrome.runtime.sendMessage({
            action: 'recordEngagement',
            data: engagementData
        }).catch(() => {
            // Ignore errors if extension context is invalid
        });
    });
    
    // Detect if user is in incognito mode
    chrome.extension.isAllowedIncognitoAccess((isAllowed) => {
        if (isAllowed && chrome.extension.inIncognitoContext) {
            // User is in incognito mode - this affects privacy scoring
            chrome.runtime.sendMessage({
                action: 'incognitoDetected',
                timestamp: Date.now()
            }).catch(() => {});
        }
    });
})();