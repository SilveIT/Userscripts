// ==UserScript==
// @name         OZON Bonus Points Display
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  Display promo bonus points from reviews on order pages and calculate totals on promo page – with order‑level verification.
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

    // CSS styles (updated with wrapper style)
    const STYLES = {
        orderListPoints: `
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 14px;
            text-align: center;
            min-width: 120px;
        `,
        orderListWrapper: `
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 10px;
        `,
        verifyButton: `
            width: 100px;
            padding: 8px 0;
            background: #005bff;
            color: white;
            border: none;
            border-radius: 4px;
            font-weight: bold;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s;
            z-index: 1;
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
    let promoProductsByFilename = new Map(); // filename -> { itemId, name, imageName, maxReward }
    let promoProductsById = new Map(); // itemId -> maxReward (points)
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

    function parsePromoPoints(text) {
        const match = text.match(/(\d+)\s*баллов?/);
        return match ? parseInt(match[1], 10) : 0;
    }

    /**
     * Display pending reviews notice on orderlist page
     */
    function displayPendingReviewsNotice() {
        if (!pendingReviewsData.hasPendingReviews || pendingReviewsData.productCount === 0) return;

        const layoutPage = document.getElementById('layoutPage');
        if (!layoutPage) {
            setTimeout(displayPendingReviewsNotice, 500);
            return;
        }

        const existingNotice = layoutPage.querySelector('[data-pending-reviews-notice]');
        if (existingNotice) existingNotice.remove();

        const noticeLink = document.createElement('a');
        noticeLink.href = 'https://www.ozon.ru/my/reviews/promo';
        noticeLink.target = '_blank';
        noticeLink.style.cssText = STYLES.pendingNotice + 'display: block; text-decoration: none; cursor: pointer;';
        noticeLink.setAttribute('data-pending-reviews-notice', 'true');

        noticeLink.addEventListener('mouseenter', () => {
            noticeLink.style.opacity = '0.9';
            noticeLink.style.transform = 'translateY(-1px)';
        });
        noticeLink.addEventListener('mouseleave', () => {
            noticeLink.style.opacity = '1';
            noticeLink.style.transform = 'translateY(0)';
        });

        const message = document.createElement('div');
        message.textContent = `Есть ${pendingReviewsData.productCount} товаров, ожидающих отзыв, на общую сумму ${pendingReviewsData.totalPoints} баллов.`;

        noticeLink.appendChild(message);
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

    function parsePromoData(jsonData) {
        const sections = jsonData.productSections || [];
        const byFilename = new Map();
        const byId = new Map();
        const sectionTotals = [];
        const pendingData = {
            productCount: 0,
            totalPoints: 0,
            hasPendingReviews: false
        };

        sections.forEach((section, index) => {
            const sectionTitle = section.title?.text?.toLowerCase() || '';
            let totalPoints = 0;
            let productCount = 0;
            let pendingPoints = 0;
            let pendingCount = 0;

            (section.products || []).forEach(product => {
                const imageUrl = product.image?.image?.image;
                if (!imageUrl) return;
                const filename = extractFilename(imageUrl);
                if (!filename) return;

                let name = '';
                if (typeof product.title?.text === 'string') {
                    name = product.title.text;
                } else if (product.title?.text?.text) {
                    name = product.title.text.text;
                }

                let points = 0;
                let isPending = false;

                if (product.rewards && product.rewards.length > 0) {
                    const lastReward = product.rewards[product.rewards.length - 1];
                    const rewardText = lastReward.title?.text || '';
                    points = parsePromoPoints(rewardText);
                    isPending = true;
                } else if (product.receivedReward) {
                    const rewardText = product.receivedReward.text?.text || product.receivedReward.text || '';
                    points = parsePromoPoints(rewardText);
                    isPending = rewardText.includes('Начислим');
                }

                if (points > 0) {
                    const productInfo = {
                        itemId: product.itemId,
                        name: name,
                        imageName: filename,
                        maxReward: points
                    };
                    byFilename.set(filename, productInfo);
                    byId.set(product.itemId, points);

                    totalPoints += points;
                    productCount++;

                    if (sectionTitle.includes('оцените сейчас')) {
                        pendingData.productCount++;
                        pendingData.totalPoints += points;
                        pendingData.hasPendingReviews = true;
                    }

                    if (sectionTitle.includes('оценённые')) {
                        if (isPending) {
                            pendingPoints += points;
                            pendingCount++;
                        }
                    }
                }
            });

            sectionTotals[index] = { totalPoints, productCount, pendingPoints, pendingCount };
        });

        return { byFilename, byId, sectionTotals, pendingReviewsData: pendingData };
    }

    async function loadPromoProducts() {
        try {
            console.log('Fetching promo products...');
            const response = await fetch('/my/reviews/promo');
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const xpathResult = document.evaluate(
                "//div[starts-with(@data-state, '{\"productSections')]",
                doc,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
            );
            const node = xpathResult.singleNodeValue;
            if (!node) {
                console.log('Promo data not found in fetched page');
                return false;
            }

            const jsonText = node.getAttribute('data-state');
            const jsonData = JSON.parse(jsonText);
            const { byFilename, byId, pendingReviewsData: pending } = parsePromoData(jsonData);

            promoProductsByFilename = byFilename;
            promoProductsById = byId;
            pendingReviewsData = pending;
            promoDataLoaded = true;

            console.log(`Loaded ${promoProductsByFilename.size} promo products`);
            if (pendingReviewsData.hasPendingReviews) {
                console.log(`Pending reviews: ${pendingReviewsData.productCount} products for ${pendingReviewsData.totalPoints} points`);
                if (window.location.pathname.includes('/my/orderlist')) {
                    setTimeout(displayPendingReviewsNotice, 500);
                }
            }
            return true;
        } catch (error) {
            console.error('Error loading promo products:', error);
            return false;
        }
    }

    /**
     * Create points display element
     * @param {number} points - Points count
     * @param {string} style - CSS style string
     * @returns {HTMLElement} Points element
     */
    function createPointsElement(points, style, additionalText) {
        const element = document.createElement('div');
        element.style.cssText = style;
        element.setAttribute('data-promo-points', 'true');
        element.textContent = `${points} баллов`;
        if (additionalText) {
            element.textContent += additionalText;
        }
        return element;
    }

    /**
     * Get points for an image
     * @param {HTMLImageElement} img - Image element
     * @returns {number} Points count or 0
     */
    function getPointsForImage(img) {
        const filename = extractFilename(img.src);
        if (!filename) return 0;
        const product = promoProductsByFilename.get(filename);
        return product ? product.maxReward : 0;
    }

    // --- Extract order URL from order block ---
    function getOrderUrl(orderDiv) {
        const link = orderDiv.querySelector('a[href*="/my/orderdetails/?order="]');
        if (!link) return null;
        let href = link.getAttribute('href');
        if (href.startsWith('/')) {
            href = window.location.origin + href;
        }
        return href;
    }

    // --- Parse fetched order details page and sum points using product IDs ---
    function getOrderPointsFromDetailsPage(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const shipmentWidgets = doc.querySelectorAll('[data-widget="shipmentWidget"]');
        const shipmentDataNodes = doc.evaluate(
            "//div[starts-with(@data-state, '{\"shipmentId')]",
            doc,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
        );

        const shipmentItemsMap = new Map(); // shipmentId -> productIds

        for (let i = 0; i < shipmentDataNodes.snapshotLength; i++) {
            const node = shipmentDataNodes.snapshotItem(i);
            const jsonText = node.getAttribute('data-state');
            try {
                const data = JSON.parse(jsonText);
                const shipmentId = data.shipmentId;
                if (!shipmentId) continue;

                const products = new Array();
                if (data.items && Array.isArray(data.items)) {
                    data.items.forEach(item => {
                        if (item.sellers && Array.isArray(item.sellers)) {
                            item.sellers.forEach(seller => {
                                if (seller.products && Array.isArray(seller.products)) {
                                    seller.products.forEach(product => {
                                        const productId = product.title?.common?.action?.id;
                                        if (productId) {
                                            products.push(productId);
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
                shipmentItemsMap.set(shipmentId, products);
            } catch (e) {
                console.error('Failed to parse shipment data in fetched page', e);
            }
        }

        let totalPoints = 0;
        let itemsWithPoints = 0;
        let totalItems = 0;

        shipmentWidgets.forEach(widget => {
            const widgetId = widget.id;
            if (!widgetId || !widgetId.startsWith('id')) return;
            const shipmentId = widgetId.substring(2);
            const products = shipmentItemsMap.get(shipmentId);
            if (!products) return;

            const imgs = widget.querySelectorAll('img[src]');
            totalItems += imgs?.length ?? 0;

            products.forEach(product => {
                const points = promoProductsById.get(product);
                if (points) {
                    totalPoints += points;
                    itemsWithPoints++;
                }
            });
        });
        return { totalPoints, itemsWithPoints, totalItems };
    }

    // --- Verification button click handler ---
    function createVerifyButton(orderDiv, pointsElement, orderUrl, originalPoints) {
        const button = document.createElement('button');
        button.style.cssText = STYLES.verifyButton;
        button.textContent = 'Проверить';
        button.addEventListener('click', async function() {
            button.disabled = true;
            button.textContent = 'Загрузка...';
            try {
                const response = await fetch(orderUrl);
                const html = await response.text();
                const { totalPoints: actualPoints, itemsWithPoints, totalItems } = getOrderPointsFromDetailsPage(html);
                // Update text with counts
                let text = `${actualPoints} баллов`;
                if (totalItems > 1) text += ` (${itemsWithPoints} из ${totalItems})`;
                pointsElement.textContent = text;
                // Color based on total points only
                if (itemsWithPoints === totalItems) {
                    pointsElement.style.color = 'green';
                } else {
                    pointsElement.style.color = 'red';
                }
                button.style.display = 'none';
            } catch (error) {
                console.error('Verification failed', error);
                button.textContent = 'Error';
                button.disabled = false; // allow retry
            }
        });
        return button;
    }

    /**
     * Process order list page
     */
    function processOrderList() {
        const orderListWidgets = document.querySelectorAll('[data-widget="orderList"]');

        orderListWidgets.forEach(orderListWidget => {
            const orderDivs = orderListWidget.querySelectorAll(':scope > div');

            orderDivs.forEach(orderDiv => {
                // Skip if already processed with wrapper
                if (orderDiv.querySelector('[data-order-verify-wrapper]')) return;

                let totalPoints = 0;
                let totalOrders = 0;
                let totalOrdersWithPoints = 0;

                orderDiv.querySelectorAll('img').forEach(img => {
                    let imagePoints = getPointsForImage(img);
                    totalPoints += imagePoints;
                    totalOrders++;
                    if (imagePoints > 0) {
                        totalOrdersWithPoints++;
                    }
                });

                if (totalPoints > 0) {
                    // Remove any old points elements (should not exist, but clean up)
                    orderDiv.querySelectorAll('[data-promo-points]').forEach(el => el.remove());

                    const pointsElement = createPointsElement(
                        totalPoints,
                        STYLES.orderListPoints,
                        totalOrders > 1 ? ` (${totalOrdersWithPoints} из ${totalOrders})` : null
                    );
                    pointsElement.dataset.originalPoints = totalPoints; // store for comparison

                    // Get order URL for verification
                    const orderUrl = getOrderUrl(orderDiv);
                    if (!orderUrl) {
                        console.warn('Could not find order URL for verification');
                        // Still show points without button
                        let appendTarget = orderDiv.querySelector('div');
                        if (!appendTarget) appendTarget = orderDiv;
                        appendTarget.appendChild(pointsElement);
                        orderDiv.dataset.promoProcessed = 'true';
                        return;
                    }

                    // Create wrapper and button
                    const wrapper = document.createElement('div');
                    wrapper.style.cssText = STYLES.orderListWrapper;
                    wrapper.setAttribute('data-order-verify-wrapper', 'true');

                    const verifyButton = createVerifyButton(orderDiv, pointsElement, orderUrl, totalPoints);

                    wrapper.appendChild(pointsElement);
                    wrapper.appendChild(verifyButton);

                    // Append wrapper to appropriate target
                    let appendTarget = orderDiv.querySelector('div');
                    if (!appendTarget) appendTarget = orderDiv;
                    appendTarget.appendChild(wrapper);
                }

                orderDiv.dataset.promoProcessed = 'true';
            });
        });

        if (pendingReviewsData.hasPendingReviews) {
            displayPendingReviewsNotice();
        }
    }

    function processOrderDetails() {
        if (isProcessingOrderDetails) return;
        isProcessingOrderDetails = true;

        try {
            const shipmentWidgets = document.querySelectorAll('[data-widget="shipmentWidget"]');
            if (shipmentWidgets.length === 0) return;

            const shipmentDataNodes = document.evaluate(
                "//div[starts-with(@data-state, '{\"shipmentId')]",
                document,
                null,
                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                null
            );

            const shipmentItemsMap = new Map(); // shipmentId -> productIds

            for (let i = 0; i < shipmentDataNodes.snapshotLength; i++) {
                const node = shipmentDataNodes.snapshotItem(i);
                const jsonText = node.getAttribute('data-state');
                try {
                    const data = JSON.parse(jsonText);
                    const shipmentId = data.shipmentId;
                    if (!shipmentId) continue;

                    const productArray = new Array();
                    if (data.items && Array.isArray(data.items)) {
                        data.items.forEach(item => {
                            if (item.sellers && Array.isArray(item.sellers)) {
                                item.sellers.forEach(seller => {
                                    if (seller.products && Array.isArray(seller.products)) {
                                        seller.products.forEach(product => {
                                            //const cartItemId = product.itemId ?? '1';
                                            const productId = product.title?.common?.action?.id;
                                            if (productId) {
                                                productArray.push(productId);
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                    shipmentItemsMap.set(shipmentId, productArray);
                } catch (e) {
                    console.error('Failed to parse shipment data', e);
                }
            }

            shipmentWidgets.forEach(widget => {
                const widgetId = widget.id;
                if (!widgetId || !widgetId.startsWith('id')) return;
                const shipmentId = widgetId.substring(2);

                const productArray = shipmentItemsMap.get(shipmentId);
                if (!productArray) return;

                const imgs = widget.querySelectorAll('img[src]');

                for (let i = 0; i < imgs.length; i++) {
                    const img = imgs[i];

                    if (img.dataset.promoPointsAdded === 'true') continue;

                    const productId = productArray[i];
                    if (!productId) continue;

                    const points = promoProductsById.get(productId);
                    if (!points || points === 0) continue;

                    const pointsElement = document.createElement('div');
                    pointsElement.style.cssText = STYLES.orderDetailsPoints;
                    pointsElement.textContent = `${points} баллов`;
                    pointsElement.setAttribute('data-promo-points', 'true');

                    const wrapper = document.createElement('div');
                    wrapper.style.cssText = STYLES.orderDetailsWrapper;

                    const imgClone = img.cloneNode(true);

                    wrapper.appendChild(imgClone);
                    wrapper.appendChild(pointsElement);

                    if (img.parentNode) {
                        img.parentNode.replaceChild(wrapper, img);
                    }

                    img.dataset.promoPointsAdded = 'true';
                }
            });
        } catch (error) {
            console.error('Error in processOrderDetails:', error);
        } finally {
            setTimeout(() => {
                isProcessingOrderDetails = false;
            }, CONFIG.processCooldown);
        }
    }

    function processPromoPage() {
        const xpathResult = document.evaluate(
            "//div[starts-with(@data-state, '{\"productSections')]",
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        );
        const node = xpathResult.singleNodeValue;
        if (!node) {
            console.log('Promo data not found on page');
            return;
        }

        const jsonText = node.getAttribute('data-state');
        const jsonData = JSON.parse(jsonText);
        const { sectionTotals } = parsePromoData(jsonData);

        const widget = document.querySelector('[data-widget="webPromoReviewProducts"]');
        if (!widget) {
            console.log('Promo widget not found on page');
            return;
        }

        const sections = widget.querySelectorAll('section');
        console.log(`Found ${sections.length} sections on promo page`);

        sections.forEach((section, index) => {
            if (processedSections.has(section)) return;

            const headline = section.querySelector('span.tsHeadline600Medium');
            if (!headline) {
                console.log(`No headline found in section ${index}`);
                return;
            }

            const total = sectionTotals[index];
            if (!total) return;

            let text = `Всего: ${total.totalPoints}Б (${total.productCount} шт.)`;
            if (total.pendingCount > 0) {
                text += ` Начислят: ${total.pendingPoints}Б (${total.pendingCount} шт.)`;
            }

            const totalSpan = document.createElement('span');
            totalSpan.style.cssText = STYLES.promoPageTotal;
            totalSpan.textContent = text;
            totalSpan.setAttribute('data-promo-total', 'true');

            if (!headline.querySelector('[data-promo-total]')) {
                headline.appendChild(totalSpan);
            }

            processedSections.add(section);
            console.log(`Section ${index} processed: ${text}`);
        });
    }

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

    async function init() {
        const path = window.location.pathname;

        if (path.includes('/my/reviews/promo')) {
            console.log('Initializing for promo page');
            setTimeout(processPromoPage, CONFIG.initialLoadDelay);
        } else {
            for (let i = 0; i < 15; i++) {
                let loaded = await loadPromoProducts();
                if (loaded) {
                    console.log(`Promo page loaded with ${i + 1} tries.`)
                    break;
                }

                if (i < 2) {
                    console.log(`Retry ${i + 1} failed, waiting 500ms...`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            if (!promoDataLoaded || promoProductsById.size === 0) {
                console.log('No promo products found or failed to load');
                return;
            }

            if (path.includes('/my/orderlist')) {
                processOrderList();
                setupOrderListObserver();
            } else if (path.includes('/my/orderdetails/')) {
                setTimeout(processOrderDetails, CONFIG.initialLoadDelay);
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();