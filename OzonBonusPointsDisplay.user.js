// ==UserScript==
// @name         OZON Bonus Points Display
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Display promo bonus points from reviews on order pages
// @author       Silve & Deepseek
// @match        *://www.ozon.ru/my/orderlist*
// @match        *://www.ozon.ru/my/orderdetails/?order=*
// @homepageURL  https://github.com/SilveIT/Userscripts
// @updateURL    https://github.com/SilveIT/Userscripts/raw/refs/heads/main/OzonBonusPointsDisplay.user.js
// @downloadURL  https://github.com/SilveIT/Userscripts/raw/refs/heads/main/OzonBonusPointsDisplay.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        observerDebounceDelay: 300,
        initialLoadDelay: 1000,
        processCooldown: 100
    };

    // CSS styles
    const STYLES = {
        orderListPoints: `
            position: absolute;
            top: 50%;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 14px;
            pointer-events: none;
            text-align: center;
            min-width: 100px;
        `,
        orderDetailsWrapper: `
            display: unset;
            position: relative;
            margin-right: 10px;
            vertical-align: top;
        `,
        orderDetailsPoints: `
            position: absolute;
            top: 0;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 1px 4px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 12px;
            z-index: 1000;
            pointer-events: none;
            min-width: 40px;
            text-align: center;
            white-space: nowrap;
        `
    };

    // Store promo products data
    const promoProducts = new Map();
    let promoDataLoaded = false;
    let isProcessingOrderDetails = false;

    /**
     * Extract filename from URL
     * @param {string} url - Image URL
     * @returns {string|null} Filename or null
     */
    function extractFilename(url) {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            return pathParts[pathParts.length - 1];
        } catch (e) {
            const match = url.match(/\/([^\/?#]+\.(jpg|jpeg|png|webp))(?:\?|$|#)/i);
            return match ? match[1] : null;
        }
    }

    /**
     * Parse promo points from text
     * @param {string} text - Text containing points info
     * @returns {number} Points count
     */
    function parsePromoPoints(text) {
        const match = text.match(/(\d+)\s*баллов?/);
        return match ? parseInt(match[1], 10) : 0;
    }

    /**
     * Fetch and parse promo products data
     */
    async function loadPromoProducts() {
        try {
            console.log('Fetching promo products...');
            const response = await fetch('/my/reviews/promo');
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const widget = doc.querySelector('[data-widget="webPromoReviewProducts"]');
            if (!widget) {
                console.log('Promo widget not found');
                return;
            }

            const sections = widget.querySelectorAll('section');
            if (sections.length === 0) return;

            for (let i = 0; i < 2; i++) {
                if (i === 1 && sections.length === 2) {
                    break;
                }
                const section = sections[i];
                const container = section.querySelector('div:not([style])');
                if (!container) return;

                const productDivs = container.querySelectorAll('div');

                productDivs.forEach(div => {
                    const img = div.querySelector('img');
                    if (!img?.src) return;

                    const filename = extractFilename(img.src);
                    if (!filename) return;

                    const spans = div.querySelectorAll('span.tsBody400Small');
                    if (spans.length === 0) return;

                    const lastSpan = spans[spans.length - 1];
                    const points = parsePromoPoints(lastSpan.textContent.trim());

                    if (points > 0) {
                        promoProducts.set(filename, points);
                    }
                });
            }

            promoDataLoaded = true;
            console.log(`Loaded ${promoProducts.size} promo products`);

        } catch (error) {
            console.error('Error loading promo products:', error);
        }
    }

    /**
     * Create points display element
     * @param {number} points - Points count
     * @param {string} style - CSS style string
     * @returns {HTMLElement} Points element
     */
    function createPointsElement(points, style) {
        const element = document.createElement('div');
        element.style.cssText = style;
        element.setAttribute('data-promo-points', 'true');
        element.textContent = `${points} баллов`;
        return element;
    }

    /**
     * Process order list page
     */
    function processOrderList() {
        const orderListWidgets = document.querySelectorAll('[data-widget="orderList"]');

        orderListWidgets.forEach(orderListWidget => {
            const orderDivs = orderListWidget.querySelectorAll(':scope > div');

            orderDivs.forEach(orderDiv => {
                if (orderDiv.dataset.promoProcessed === 'true') return;

                let totalPoints = 0;

                orderDiv.querySelectorAll('img').forEach(img => {
                    if (!img.src) return;

                    const filename = extractFilename(img.src);
                    if (filename && promoProducts.has(filename)) {
                        totalPoints += promoProducts.get(filename);
                    }
                });

                if (totalPoints > 0) {
                    // Remove existing points elements
                    orderDiv.querySelectorAll('[data-promo-points]').forEach(el => el.remove());

                    const pointsElement = createPointsElement(totalPoints, STYLES.orderListPoints);

                    if (getComputedStyle(orderDiv).position === 'static') {
                        orderDiv.style.position = 'relative';
                    }

                    orderDiv.appendChild(pointsElement);
                }

                orderDiv.dataset.promoProcessed = 'true';
            });
        });
    }

    /**
     * Process order details page
     */
    function processOrderDetails() {
        if (isProcessingOrderDetails) return;
        isProcessingOrderDetails = true;

        try {
            const shipmentWidgets = document.querySelectorAll('[data-widget="shipmentWidget"]');
            if (shipmentWidgets.length === 0) return;

            shipmentWidgets.forEach((shipmentWidget, index) => {
                try {
                    shipmentWidget.querySelectorAll('img[src]').forEach(img => {
                        if (img.dataset.promoPointsAdded === 'true') return;
                        img.dataset.promoPointsAdded = 'true';

                        const filename = extractFilename(img.src);
                        if (!filename || !promoProducts.has(filename)) return;

                        const points = promoProducts.get(filename);
                        const wrapper = document.createElement('div');
                        wrapper.style.cssText = STYLES.orderDetailsWrapper;

                        const imgClone = img.cloneNode(true);
                        const pointsElement = createPointsElement(points, STYLES.orderDetailsPoints);

                        wrapper.appendChild(imgClone);
                        wrapper.appendChild(pointsElement);

                        if (img.parentNode) {
                            img.parentNode.replaceChild(wrapper, img);
                        }
                    });
                } catch (error) {
                    console.error(`Error processing shipment widget ${index + 1}:`, error);
                }
            });
        } finally {
            setTimeout(() => {
                isProcessingOrderDetails = false;
            }, CONFIG.processCooldown);
        }
    }

    /**
     * Setup MutationObserver for order list page
     */
    function setupOrderListObserver() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length === 0) continue;

                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;

                    if (node.matches('[data-widget="orderList"]') || 
                        node.querySelector('[data-widget="orderList"]')) {
                        processOrderList();
                    }
                });
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        return observer;
    }

    /**
     * Setup MutationObserver for order details page
     */
    function setupOrderDetailsObserver() {
        const observer = new MutationObserver((mutations) => {
            let hasNewImages = false;

            for (const mutation of mutations) {
                if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) {
                    continue;
                }

                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE &&
                        (node.tagName === 'IMG' || node.querySelector?.('img'))) {
                        hasNewImages = true;
                        break;
                    }
                }

                if (hasNewImages) break;
            }

            if (hasNewImages) {
                clearTimeout(window.orderDetailsTimeout);
                window.orderDetailsTimeout = setTimeout(() => {
                    if (!isProcessingOrderDetails) {
                        processOrderDetails();
                    }
                }, CONFIG.observerDebounceDelay);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });

        return observer;
    }

    /**
     * Main initialization function
     */
    async function init() {
        await loadPromoProducts();

        if (!promoDataLoaded || promoProducts.size === 0) {
            console.log('No promo products found or failed to load');
            return;
        }

        const path = window.location.pathname;

        if (path.includes('/my/orderlist')) {
            processOrderList();
            setupOrderListObserver();
        } else if (path.includes('/my/orderdetails/')) {
            setTimeout(processOrderDetails, CONFIG.initialLoadDelay);
            setupOrderDetailsObserver();
        }
    }

    // Run initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();