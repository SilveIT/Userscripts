// ==UserScript==
// @name         Ozon URL Cleaner
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Removes tracking parameters (at, _bctx) from Ozon URLs
// @author       Silve & Deepseek
// @match        *://www.ozon.ru/*
// @grant        none
// @run-at       document-start
// @homepageURL  https://github.com/SilveIT/Userscripts
// @updateURL    https://github.com/SilveIT/Userscripts/raw/refs/heads/main/OzonURLCleaner.user.js
// @downloadURL  https://github.com/SilveIT/Userscripts/raw/refs/heads/main/OzonURLCleaner.user.js
// ==/UserScript==

(function() {
    'use strict';

    const TRACKING_PARAMS = ['at', '_bctx', 'hs'];

    /**
     * Removes specified tracking parameters from a URL.
     * @param {string} url - The original URL (absolute or relative).
     * @returns {string} Cleaned URL without tracking parameters.
     */
    function cleanUrl(url) {
        if (!url) return url;
        try {
            const urlObj = new URL(url, window.location.href);
            let changed = false;
            for (const param of TRACKING_PARAMS) {
                if (urlObj.searchParams.has(param)) {
                    urlObj.searchParams.delete(param);
                    changed = true;
                }
            }
            return changed ? urlObj.toString() : url;
        } catch {
            return url;
        }
    }

    /**
     * Cleans a single anchor element's href if needed.
     * @param {HTMLAnchorElement} link - The anchor element.
     * @returns {boolean} True if href was changed.
     */
    function cleanLink(link) {
        if (!link.href) return false;
        const cleaned = cleanUrl(link.href);
        if (cleaned !== link.href) {
            link.href = cleaned;
            return true;
        }
        return false;
    }

    /**
     * Cleans the current page URL if it contains any tracking parameters.
     */
    function cleanCurrentUrl() {
        const cleaned = cleanUrl(window.location.href);
        if (cleaned !== window.location.href) {
            history.replaceState(null, '', cleaned);
        }
    }

    // Clean the URL immediately (runs at document-start)
    cleanCurrentUrl();

    function init() {
        // Clean all existing links
        document.querySelectorAll('a[href]').forEach(cleanLink);

        // Watch for dynamically added links or href changes
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.tagName === 'A' && node.href) cleanLink(node);
                            if (node.querySelectorAll) {
                                node.querySelectorAll('a[href]').forEach(cleanLink);
                            }
                        }
                    }
                } else if (mutation.type === 'attributes' && mutation.attributeName === 'href') {
                    const target = mutation.target;
                    if (target.tagName === 'A' && target.href) cleanLink(target);
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['href']
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();