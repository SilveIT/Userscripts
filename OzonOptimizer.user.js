// ==UserScript==
// @name         Ozon Optimizer
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Removes excessive elements from pages
// @author       Silve & Deepseek
// @match        https://www.ozon.ru/*
// @run-at       document-start
// @homepageURL  https://github.com/SilveIT/Userscripts
// @updateURL    https://github.com/SilveIT/Userscripts/raw/refs/heads/main/OzonOptimizer.user.js
// @downloadURL  https://github.com/SilveIT/Userscripts/raw/refs/heads/main/OzonOptimizer.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const originalFetch = window.fetch;

    window.fetch = async function(...args) {
        const request = args[0] instanceof Request ? args[0] : new Request(...args);
        const url = request.url;

        // SEARCH / CATEGORY – remove shelf.userHistory & shelf.infiniteScroll
        if (url.startsWith('https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2?url=%2Fsearch') ||
            url.startsWith('https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2?url=%2Fcategory')) {
            try {
                const response = await originalFetch.apply(this, args);
                const clonedResponse = response.clone();
                const data = await clonedResponse.json();

                let modified = false;
                if (data && Array.isArray(data.layout)) {
                    data.layout.forEach(item => {
                        if ((item.component === 'island' || item.component === 'row') && Array.isArray(item.placeholders)) {
                            item.placeholders.forEach(placeholder => {
                                if (placeholder && Array.isArray(placeholder.widgets)) {
                                    const originalLength = placeholder.widgets.length;
                                    placeholder.widgets = placeholder.widgets.filter(widget => {
                                        const widgetName = widget.name || '';
                                        return widgetName !== 'shelf.userHistory' && widgetName !== 'shelf.infiniteScroll' && Object.values(widget).includes('search.history');
                                    });
                                    if (placeholder.widgets.length !== originalLength) {
                                        modified = true;
                                    }
                                }
                            });
                        }
                    });
                }

                if (modified) {
                    console.log('[Ozon Optimizer] Successfully removed shelf.userHistory and/or shelf.infiniteScroll widgets from search response.');
                }

                const modifiedResponse = new Response(JSON.stringify(data), {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                });

                return modifiedResponse;
            } catch (error) {
                console.error('[Ozon Optimizer] Error while processing search response:', error);
                return originalFetch.apply(this, args);
            }
        }

        // BLOCK RECOMMENDATIONS AND SEARCH HISTORY
        if (url.includes('url=%2Fmy%2Forderdetails%2F') || url.includes('url=%2Fhighlight%2F') || url.includes('layout_container%3Drecommendations') || url.includes('lk_pagination_recoms')) {
            try {
                const modifiedResponse = new Response("{}", {
                    status: 200,
                    statusText: "OK"
                });
                console.log('[Ozon Optimizer] Successfully blocked recomendations request.');
                return modifiedResponse;
            } catch (error) {
                console.error('[Ozon Optimizer] Error while blocking recomendations request:', error);
                return originalFetch.apply(this, args);
            }
        }

        // BLOCK COOKIE NOTIFICATION
        if (url.startsWith('https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2?url=https%3A%2F%2Fozon.ru%2Fnotification%2Fcookies_acceptance')) {
            try {
                const modifiedResponse = new Response('{}', {
                    status: 200,
                    statusText: "OK"
                });
                console.log('[Ozon Optimizer] Successfully blocked cookie request.');
                return modifiedResponse;
            } catch (error) {
                console.error('[Ozon Optimizer] Error while blocking cookie request: ', error);
                return originalFetch.apply(this, args);
            }
        }

        // Not a target URL – pass through
        return originalFetch.apply(this, args);
    };
})();