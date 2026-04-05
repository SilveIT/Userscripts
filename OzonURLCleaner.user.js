// ==UserScript==
// @name         Ozon URL Cleaner
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Removes weird parameters
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

    /**
     * Removes the 'at' parameter from a given URL string.
     * @param {string} url - The original URL (absolute or relative).
     * @returns {string} The cleaned URL without the 'at' parameter.
     */
    function removeAtParam(url) {
        if (!url) return url;
        try {
            // Resolve relative URLs against the current page
            const urlObj = new URL(url, window.location.href);
            if (urlObj.searchParams.has('at')) {
                urlObj.searchParams.delete('at');
                return urlObj.toString();
            }
        } catch (e) {
            // Invalid URL – return unchanged
        }
        return url;
    }

    /**
     * Processes a single anchor element: removes 'at' from its href.
     * @param {HTMLAnchorElement} link - The anchor element.
     * @returns {boolean} True if the href was changed.
     */
    function processLink(link) {
        if (!link.href) return false;
        const cleaned = removeAtParam(link.href);
        if (cleaned !== link.href) {
            link.href = cleaned;
            return true;
        }
        return false;
    }

    /**
     * Cleans the current page URL if it contains 'at='.
     */
    function fixCurrentUrl() {
        if (window.location.search.includes('at=')) {
            const cleaned = removeAtParam(window.location.href);
            if (cleaned !== window.location.href) {
                history.replaceState(null, '', cleaned);
            }
        }
    }

    // Clean the current URL immediately (runs at document-start)
    fixCurrentUrl();

    // Wait for DOM to be ready before scanning existing links and setting up observers
    function init() {
        // Clean all existing links
        const links = document.querySelectorAll('a[href]');
        for (const link of links) {
            processLink(link);
        }

        // MutationObserver to handle both new links and href changes
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    // New nodes added to the DOM
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // If the added node is an anchor, process it
                            if (node.tagName === 'A' && node.href) {
                                processLink(node);
                            }
                            // If it contains links, process all of them
                            if (node.querySelectorAll) {
                                const nestedLinks = node.querySelectorAll('a[href]');
                                for (const link of nestedLinks) {
                                    processLink(link);
                                }
                            }
                        }
                    }
                } else if (mutation.type === 'attributes' && mutation.attributeName === 'href') {
                    // An existing element had its href attribute changed
                    const target = mutation.target;
                    if (target.tagName === 'A' && target.href) {
                        processLink(target);
                    }
                }
            }
        });

        // Observe the whole document for new links and href changes
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