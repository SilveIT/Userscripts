// ==UserScript==
// @name         Ozon Optimizer
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Removes excessive elements from pages
// @author       Silve & Deepseek
// @match        https://www.ozon.ru/*
// @run-at       document-start
// @homepageURL  https://github.com/SilveIT/Userscripts
// @updateURL    https://github.com/SilveIT/Userscripts/raw/refs/heads/main/OzonOptimizer.user.js
// @downloadURL  https://github.com/SilveIT/Userscripts/raw/refs/heads/main/OzonOptimizer.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_notification
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    let HEAVY_OPTIMIZATION = GM_getValue('HEAVY_OPTIMIZATION', false);
    let currentCommandId = null;

    function updateMenuCommand() {
        // Unregister previous command if it exists
        if (currentCommandId !== null) {
            GM_unregisterMenuCommand(currentCommandId);
        }
        const stateText = HEAVY_OPTIMIZATION ? 'ON' : 'OFF';
        const menuTitle = `Heavy Optimization [${stateText}]`;
        currentCommandId = GM_registerMenuCommand(menuTitle, toggleHeavyOptimization);
    }

    function toggleHeavyOptimization() {
        HEAVY_OPTIMIZATION = !HEAVY_OPTIMIZATION;
        GM_setValue('HEAVY_OPTIMIZATION', HEAVY_OPTIMIZATION);
        const status = HEAVY_OPTIMIZATION ? 'ON' : 'OFF';
        GM_notification({
            text: `Heavy Optimization is now ${status}`,
            title: 'Ozon Optimizer',
            timeout: 2000
        });
        console.log(`[Ozon Optimizer] Heavy Optimization toggled to ${status}`);
        updateMenuCommand(); // Refresh the menu item text
    }

    // Initialize menu command
    updateMenuCommand();

    const originalFetch = unsafeWindow.fetch;

    unsafeWindow.fetch = async function(...args) {
        const request = args[0] instanceof Request ? args[0] : new Request(...args);
        const url = request.url;

        //TODO:
        //// Block useless menu
        //if (url.includes('shellHorizontalMenuGetChildV1?menuId=168')
        //    || (HEAVY_OPTIMIZATION && (url.includes('searchSuggestions')) || url.includes('widgetStateId=orderInfo'))) {
        //    try {
        //        const modifiedResponse = new Response('{"trackingInfo": null,"trackingPayloads": {},"trackingTokenAliases": null,"data": [{"id": "7","items": []}]}', {
        //            status: 200,
        //            statusText: "OK"
        //        });
        //        console.log('[Ozon Optimizer] Successfully blocked unwanted request.');
        //        return modifiedResponse;
        //    } catch (error) {
        //        console.error('[Ozon Optimizer] Error while blocking unwanted request:', error);
        //        return originalFetch.apply(this, args);
        //    }
        //}

        // Block unwanted requests
        if (url.includes('url=%2Fmy%2Forderdetails%2F') || url.includes('url=%2Fhighlight%2F') || url.includes('layout_container%3Drecommendations') || url.includes('lk_pagination_recoms')
            || (HEAVY_OPTIMIZATION && (url.includes('searchSuggestions')) || url.includes('widgetStateId=orderInfo'))) {
            try {
                const modifiedResponse = new Response('{"trackingInfo": null,"trackingPayloads": {},"trackingTokenAliases": null,"data": [{"id": "7","items": []}]}', {
                    status: 200,
                    statusText: "OK"
                });
                console.log('[Ozon Optimizer] Successfully blocked unwanted request.');
                return modifiedResponse;
            } catch (error) {
                console.error('[Ozon Optimizer] Error while blocking unwanted request:', error);
                return originalFetch.apply(this, args);
            }
        }

        // SEARCH / CATEGORY – remove shelf.userHistory & shelf.infiniteScroll
        else if (url.startsWith('https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2?url=%2Fsearch') ||
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

        // Block cookie notification
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