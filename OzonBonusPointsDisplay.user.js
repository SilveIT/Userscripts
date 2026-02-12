// ==UserScript==
// @name         OZON Bonus Points Display
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Display promo bonus points from reviews on order pages and calculate totals on promo page
// @author       Silve & Deepseek
// @match        *://www.ozon.ru/my/orderlist*
// @match        *://www.ozon.ru/my/orderdetails/?order=*
// @match        *://www.ozon.ru/my/reviews/promo*
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
            top: 60%;
            left: 2%;
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
        `,
        pendingNotice: `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 20px;
            font-size: 16px;
            font-weight: 500;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            max-height: 40px;
        `,
        promoPageTotal: `
            color: #005bff;
            font-weight: bold;
            margin-left: 10px;
            padding: 2px 8px;
            background: #f0f9ff;
            border-radius: 4px;
            border: 1px solid #d0e7ff;
            white-space: nowrap;
        `
    };

    // Store promo products data
    const promoProducts = new Map();
    let promoDataLoaded = false;
    let isProcessingOrderDetails = false;

    // Store first section data for pending reviews
    let pendingReviewsData = {
        productCount: 0,
        totalPoints: 0,
        hasPendingReviews: false
    };

    // Track processed sections on promo page
    const processedSections = new Set();

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
     * Display pending reviews notice on orderlist page
     */
    function displayPendingReviewsNotice() {
        if (!pendingReviewsData.hasPendingReviews || pendingReviewsData.productCount === 0) {
            return;
        }

        const layoutPage = document.getElementById('layoutPage');
        if (!layoutPage) {
            console.log('layoutPage not found, retrying in 500ms');
            setTimeout(displayPendingReviewsNotice, 500);
            return;
        }

        // Remove existing notice if any
        const existingNotice = layoutPage.querySelector('[data-pending-reviews-notice]');
        if (existingNotice) {
            existingNotice.remove();
        }

        // Create notice container as a link
        const noticeLink = document.createElement('a');
        noticeLink.href = 'https://www.ozon.ru/my/reviews/promo';
        noticeLink.target = '_blank'; // Open in new tab
        noticeLink.style.cssText = STYLES.pendingNotice + 'display: block; text-decoration: none; cursor: pointer;';
        noticeLink.setAttribute('data-pending-reviews-notice', 'true');

        // Add hover effect
        noticeLink.addEventListener('mouseenter', () => {
            noticeLink.style.opacity = '0.9';
            noticeLink.style.transform = 'translateY(-1px)';
        });

        noticeLink.addEventListener('mouseleave', () => {
            noticeLink.style.opacity = '1';
            noticeLink.style.transform = 'translateY(0)';
        });

        // Create message
        const message = document.createElement('div');
        message.textContent = `Есть ${pendingReviewsData.productCount} товаров, ожидающих отзыв, на общую сумму ${pendingReviewsData.totalPoints} баллов.`;

        noticeLink.appendChild(message);

        // Insert as first child of layoutPage
        if (layoutPage.firstChild) {
            layoutPage.insertBefore(noticeLink, layoutPage.firstChild);
        } else {
            layoutPage.appendChild(noticeLink);
        }
    }

    /**
     * Process a product div and extract promo data
     * @param {Element} div - Product div element
     * @param {boolean} isPendingSection - Whether this is from the pending reviews section
     */
    function processProductDiv(div, isPendingSection = false) {
        const img = div.querySelector('img');
        if (!img?.src) return null;

        const filename = extractFilename(img.src);
        if (!filename) return null;

        const spans = div.querySelectorAll('span.tsBody400Small, span.tsCompact400Small');
        if (spans.length === 0) return null;

        const lastSpan = spans[spans.length - 1];
        const points = parsePromoPoints(lastSpan.textContent.trim());

        if (points > 0) {
            if (isPendingSection) {
                pendingReviewsData.productCount++;
                pendingReviewsData.totalPoints += points;
            }
            return { filename, points };
        }

        return null;
    }

    /**
     * Process a section container for promo products
     * @param {Element} container - Section container
     * @param {boolean} isPendingSection - Whether this is from the pending reviews section
     */
    function processSectionContainer(container, isPendingSection = false) {
        if (!container) return;

        const productDivs = container.querySelectorAll('div');

        productDivs.forEach(div => {
            const result = processProductDiv(div, isPendingSection);
            if (result) {
                promoProducts.set(result.filename, result.points);
            }
        });
    }

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
                return false;
            }

            const sections = widget.querySelectorAll('section');
            console.log(`Found ${sections.length} sections`);

            // Reset pending state – will be set to true if "Оцените сейчас" section is found
            pendingReviewsData.hasPendingReviews = false;

            // Process each section dynamically based on its heading text
            sections.forEach(section => {
                // Get the first meaningful text content (usually from a heading)
                const text = section.textContent.trim().toLowerCase();

                if (text.startsWith('оцените сейчас')) {
                    console.log('Found pending reviews section');
                    pendingReviewsData.hasPendingReviews = true;

                    const container = section.querySelector('div:not([style])');
                    if (container) {
                        processSectionContainer(container, true);
                    }
                }
                else if (text.startsWith('оцените после')) {
                    console.log('Found plain promo section');
                    const container = section.querySelector('div:not([style])');
                    if (container) {
                        processSectionContainer(container, false);
                    }
                }
                else if (text.startsWith('оценённые')) {
                    console.log('Ignoring reviewed section');
                    // Do nothing – not processed
                }
                else {
                    console.log('Unknown section type, skipping');
                }
            });

            promoDataLoaded = true;
            console.log(`Loaded ${promoProducts.size} promo products`);

            if (pendingReviewsData.hasPendingReviews) {
                console.log(`Pending reviews: ${pendingReviewsData.productCount} products for ${pendingReviewsData.totalPoints} points`);
                // Display notice if we're on orderlist page
                if (window.location.pathname.includes('/my/orderlist')) {
                    setTimeout(displayPendingReviewsNotice, 500);
                }
            }

        } catch (error) {
            console.error('Error loading promo products:', error);
            return false;
        }
        return true;
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
     * Get points for an image
     * @param {HTMLImageElement} img - Image element
     * @returns {number} Points count or 0
     */
    function getPointsForImage(img) {
        const filename = extractFilename(img.src);
        return filename ? (promoProducts.get(filename) || 0) : 0;
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
                    totalPoints += getPointsForImage(img);
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

        // Display pending reviews notice if needed
        if (pendingReviewsData.hasPendingReviews) {
            displayPendingReviewsNotice();
        }
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

                        const points = getPointsForImage(img);
                        if (points === 0) return;

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
     * Process promo page sections
     */
    function processPromoPage() {
        const widget = document.querySelector('[data-widget="webPromoReviewProducts"]');
        if (!widget) {
            console.log('Promo widget not found on page');
            return;
        }

        const sections = widget.querySelectorAll('section');
        console.log(`Found ${sections.length} sections on promo page`);

        sections.forEach((section, index) => {
            // Skip if already processed
            if (processedSections.has(section)) {
                return;
            }

            // Find the headline in this section
            const headline = section.querySelector('span.tsHeadline600Medium');
            if (!headline) {
                console.log(`No headline found in section ${index}`);
                return;
            }

            // Calculate total points for this section
            let totalPoints = 0;
            let totalPointsPending = 0;
            const productDivs = section.querySelector('div:not([style])').querySelectorAll('div');

            let cnt = 0;
            let cntPending = 0;
            const sectionText = section.textContent.trim().toLowerCase();
            let isReviewedSection = sectionText.startsWith('оценённые');

            productDivs.forEach(div => {
                const img = div.querySelector('img');
                if (!img?.src) return;

                const filename = extractFilename(img.src);
                if (!filename) return;

                const spans = div.querySelectorAll('span.tsBody400Small, span.tsCompact400Small');
                if (spans.length === 0) return;

                const lastSpan = spans[spans.length - 1];
                const pointsText = lastSpan.textContent.trim().toLowerCase();
                const points = parsePromoPoints(pointsText);

                if (points > 0)
                {
                    cnt++;
                    totalPoints += points;
                    if (isReviewedSection && pointsText.startsWith('начислим')) {
                        cntPending++;
                        totalPointsPending += points;
                    }
                }
            });
            console.log(`${index} section has ${cnt} products`);

            // Create total points display
            const totalSpan = document.createElement('span');
            totalSpan.style.cssText = STYLES.promoPageTotal;
            totalSpan.textContent = isReviewedSection ? `Всего: ${totalPoints}Б \(${cnt} шт.\). Начислят: ${totalPointsPending}Б \(${cntPending} шт.\)` : `Всего: ${totalPoints}Б \(${cnt} шт.\)`;

            // Add to headline if not already added
            if (!headline.querySelector('[data-promo-total]')) {
                headline.appendChild(totalSpan);
                totalSpan.setAttribute('data-promo-total', 'true');
            }

            // Mark section as processed
            processedSections.add(section);
            console.log(`Section ${index} processed: ${totalPoints} total points`);
        });
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

                    // Check if layoutPage was added
                    if (node.matches('#layoutPage') || node.querySelector('#layoutPage')) {
                        if (pendingReviewsData.hasPendingReviews) {
                            displayPendingReviewsNotice();
                        }
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
        const path = window.location.pathname;

        if (path.includes('/my/reviews/promo')) {
            // On promo page, process directly
            console.log('Initializing for promo page');
            setTimeout(processPromoPage, CONFIG.initialLoadDelay);
        } else {
            // On order pages, load promo data first
            for (let i = 0; i < 3; i++) {
                let loaded = await loadPromoProducts();
                if (loaded) {
                    console.log(`Promo page loaded with ${i + 1} tries.`)
                    break;
                }

                // Add delay before next retry
                if (i < 2) { // Don't delay after last attempt
                    console.log(`Retry ${i + 1} failed, waiting 500ms...`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            if (!promoDataLoaded || promoProducts.size === 0) {
                console.log('No promo products found or failed to load');
                return;
            }

            if (path.includes('/my/orderlist')) {
                processOrderList();
                setupOrderListObserver();
            } else if (path.includes('/my/orderdetails/')) {
                setTimeout(processOrderDetails, CONFIG.initialLoadDelay);
                setupOrderDetailsObserver();
            }
        }
    }

    // Run initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();