// ==UserScript==
// @name         Ozon Filter Tools
// @namespace    http://tampermonkey.net/
// @description  Advanced Ozon filters
// @version      2.9
// @author       Silve & Deepseek
// @match        *://www.ozon.ru/*
// @homepageURL  https://github.com/SilveIT/Userscripts
// @updateURL    https://github.com/SilveIT/Userscripts/raw/refs/heads/main/OzonFilterTools.user.js
// @downloadURL  https://github.com/SilveIT/Userscripts/raw/refs/heads/main/OzonFilterTools.user.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Configuration for query parsing
    const QUERY_SEPARATORS = ['\r\n', '\n', ';', '; '];

    // Check if we're on a search/category/seller page
    const isFilterablePage =
        window.location.pathname.includes('/search/') ||
        window.location.pathname.includes('/category/') ||
        window.location.pathname.includes('/seller/');

    // Check if we're on the order list page
    const isOrderListPage = window.location.pathname.includes('/my/orderlist/');

    // Flag to track if filtering is active (only on search/category/seller pages)
    let isFilterActive = false;

    // Flag to track if order filter is active
    let isOrderFilterActive = false;

    // Store original methods
    const originalMethods = {
        appendChild: null,
        insertBefore: null,
        innerHTML: null,
        insertAdjacentHTML: null
    };

    // Add global styles once
    function addGlobalStyles() {
        if (document.querySelector('#ozon-filter-styles')) return;

        const style = document.createElement('style');
        style.id = 'ozon-filter-styles';
        style.textContent = `
            .ozon-toggle {
                position: relative;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 2px 8px;
                border-radius: 6px;
                border: 1px solid #e0e0e0;
                background-color: #fff;
                color: #333;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                font-size: 13px;
                user-select: none;
                min-height: 28px;
                font-family: 'Onest', arial, sans-serif;
            }

            .ozon-toggle .checkbox-box {
                position: relative;
                display: inline-block;
                width: 18px;
                height: 18px;
                flex-shrink: 0;
            }

            .ozon-toggle .checkbox-box::before {
                content: "";
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                border-radius: 4px;
                border: 1px solid #c0c0c0;
                background: #fff;
                transition: all 0.2s;
                box-sizing: border-box;
            }

            .ozon-toggle input {
                position: absolute;
                opacity: 0;
                width: 0;
                height: 0;
            }

            .ozon-toggle input:checked + .checkbox-box::before {
                background: #005bff;
                border-color: #005bff;
            }

            .ozon-toggle input:checked + .checkbox-box::after {
                content: "";
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 16px;
                height: 16px;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='white'%3E%3Cpath fill-rule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clip-rule='evenodd'/%3E%3C/svg%3E");
                background-size: contain;
                background-repeat: no-repeat;
            }

            .ozon-toggle:hover {
                border-color: #005bff;
                background-color: #f8fafd;
            }

            .ozon-toggle.disabled {
                opacity: 0.5;
                cursor: not-allowed;
                border-color: #e0e0e0;
            }

            .ozon-toggle.disabled:hover {
                border-color: #e0e0e0;
                background-color: #fff;
            }

            .parse-queries-button {
                padding: 5px 8px;
                font-size: 12px;
                font-weight: 600;
                background: #005bff;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
                white-space: nowrap;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                min-height: 28px;
                font-family: 'Onest', arial, sans-serif;
            }

            .parse-queries-button:hover {
                background: #1669ff;
            }

            .filter-controls-container {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                margin-left: 10px;
                min-width: 700px;
                font-family: 'Onest', arial, sans-serif;
            }

            .order-filter-container {
                margin: 0 0 10px 0;
                padding: 0;
                font-family: 'Onest', arial, sans-serif;
            }
        `;
        document.head.appendChild(style);
    }

    // Function to check if current page is /search/* page
    function isSearchPage() {
        return window.location.pathname.includes('/search/');
    }

    // Function to check if current page is /category/ page
    function isCategoryPage() {
        return window.location.pathname.includes('/category/');
    }

    // Function to hide non-arrived orders
    function hideNonArrivedOrders() {
        document.querySelectorAll('section[data-widget="orderList"]').forEach(s => {
            const c = [...s.children];
            let anyArrived = false;
            c.forEach(ch => {
                if (ch.textContent.includes('забирать')) {
                    anyArrived = true;
                    ch.style.removeProperty('display');
                    ch.removeAttribute('data-hidden-by-filter')
                } else {
                    ch.setAttribute('data-original-display', ch.style.display);
                    ch.style.display = 'none';
                    ch.setAttribute('data-hidden-by-filter', 'true');
                }
            });
            if (!anyArrived) {
                s.setAttribute('data-original-display',s.style.display);
                s.style.display = 'none';
                s.setAttribute('data-section-hidden-by-filter', 'true')
            } else {
                s.style.removeProperty('display');
                s.removeAttribute('data-section-hidden-by-filter')
            }
        });
    }

    // Function to restore hidden orders
    function restoreHiddenOrders() {
        document.querySelectorAll('[data-hidden-by-filter],[data-section-hidden-by-filter]').forEach(el => {
            el.style.removeProperty('display');
            el.removeAttribute('data-hidden-by-filter');
            el.removeAttribute('data-section-hidden-by-filter');
            el.removeAttribute('data-original-display');
        });
    }

    // Function to add order filter checkbox
    function addOrderFilterCheckbox() {
        if (!isOrderListPage) return;

        console.log('Adding order filter checkbox...');

        const observer = new MutationObserver(() => {
            const paginator = document.querySelector('div[data-widget="paginator"]');
            if (!paginator || document.querySelector('.order-filter-checkbox')) return;

            observer.disconnect();

            // Create filter checkbox container
            const container = document.createElement('div');
            container.className = 'order-filter-container';

            // Create checkbox label
            const label = document.createElement('label');
            label.className = 'ozon-toggle';
            label.innerHTML = `
                <input id="orderFilterCheckbox" type="checkbox" class="order-filter-checkbox">
                <span class="checkbox-box"></span>
                <span>Только прибывшие заказы</span>
            `;

            container.appendChild(label);

            // Insert container above paginator
            paginator.parentNode.insertBefore(container, paginator);

            // Get checkbox
            const checkbox = label.querySelector('.order-filter-checkbox');

            // Add event listener
            checkbox.addEventListener('change', function() {
                isOrderFilterActive = this.checked;

                if (isOrderFilterActive) {
                    hideNonArrivedOrders();
                } else {
                    restoreHiddenOrders();
                }

                console.log(`Order filter ${isOrderFilterActive ? 'activated' : 'deactivated'}`);
            });

            // Observer for new orders loaded via AJAX
            const orderListObserver = new MutationObserver((mutations) => {
                if (isOrderFilterActive) {
                    let shouldRefilter = false;
                    for (const mutation of mutations) {
                        if (mutation.addedNodes.length > 0) {
                            for (const node of mutation.addedNodes) {
                                if (node.nodeType === 1 &&
                                    (node.matches?.('section[data-widget="orderList"]') ||
                                     node.querySelector?.('section[data-widget="orderList"]'))) {
                                    shouldRefilter = true;
                                    break;
                                }
                            }
                        }
                        if (shouldRefilter) break;
                    }
                    if (shouldRefilter) {
                        setTimeout(hideNonArrivedOrders, 100);
                    }
                }
            });

            // Start observing the order list container
            const orderListContainer = document.querySelector('[data-widget="orderList"]')?.parentElement || document.body;
            orderListObserver.observe(orderListContainer, {
                childList: true,
                subtree: true
            });
        });

        // Start observing when body is available
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                observer.observe(document.body, { childList: true, subtree: true });
            });
        }
    }

    // Function to handle "По всем категориям" checkbox action
    function handleAllCategoriesChange(isChecked) {
        const currentUrl = new URL(window.location.href);
        const currentParams = new URLSearchParams(currentUrl.search);

        if (isChecked) {
            // When checked - go to search page with parameters
            const searchUrl = new URL('https://www.ozon.ru/search/');

            // Add current parameters
            for (const [key, value] of currentParams.entries()) {
                // Don't overwrite the special parameters we're about to add
                if (key !== 'category_was_predicted' && key !== 'deny_category_prediction') {
                    searchUrl.searchParams.append(key, value);
                }
            }

            // Add required parameters
            searchUrl.searchParams.set('category_was_predicted', 'true');
            searchUrl.searchParams.set('deny_category_prediction', 'true');

            // Change location
            window.location.href = searchUrl.toString();
        } else {
            // When unchecked - remove parameters and go back
            currentParams.delete('category_was_predicted');
            currentParams.delete('deny_category_prediction');

            // Update URL
            currentUrl.search = currentParams.toString();

            // If we're on search page and removed the parameters, we might want to go back to category page
            // But the requirement says just remove parameters, so we'll stay on current page
            window.location.href = currentUrl.toString();
        }
    }

    // Function to parse queries from clipboard text
    function parseQueriesFromClipboard(text) {
        if (!text || typeof text !== 'string') {
            return [];
        }

        let normalizedText = text;

        // Replace all separators with a common separator
        for (const separator of QUERY_SEPARATORS) {
            normalizedText = normalizedText.split(separator).join('|');
        }

        // Split by the common separator and filter out empty entries
        return normalizedText.split('|')
            .map(query => query.trim())
            .filter(query => query.length > 0 && !/^\s+$/.test(query));
    }

    // Function to handle parsing queries from clipboard
    async function handleParseQueriesFromClipboard() {
        try {
            // Read text from clipboard
            const clipboardText = await navigator.clipboard.readText();

            if (!clipboardText) {
                alert('Не обнаружено скопированного текста.');
                return;
            }

            // Parse queries
            const queries = parseQueriesFromClipboard(clipboardText);

            if (queries.length === 0) {
                alert('Не обнаружено правильных запросов.\n' +
                      'Запросы должны быть разделены на строки или через \';\'.');
                return;
            }

            // Confirm with user
            const shouldProceed = confirm(
                `Найдено ${queries.length} запросов:\n\n` +
                queries.slice(0, 5).map((q, i) => `${i + 1}. ${q}`).join('\n') +
                (queries.length > 5 ? `\n... и ${queries.length - 5} ещё` : '') +
                '\n\nОткрыть в новых вкладках?'
            );

            if (!shouldProceed) {
                return;
            }

            // Get current URL parameters
            const currentUrl = new URL(window.location.href);
            const currentParams = new URLSearchParams(currentUrl.search);

            // For each query, open a new tab
            for (const query of queries) {
                const searchUrl = new URL('https://www.ozon.ru/search/');

                // Copy all current parameters
                for (const [key, value] of currentParams.entries()) {
                    searchUrl.searchParams.append(key, value);
                }

                // Replace text parameter with current query
                searchUrl.searchParams.set('text', query);

                // Open in new tab
                window.open(searchUrl.toString(), '_blank');
            }
        } catch (error) {
            console.error('Error reading clipboard:', error);
            alert('Не удалось прочитать из буфера обмена. Проверьте разрешения.');
        }
    }

    // Function to extract bonus points from element
    function getBonusPointsFromElement(element) {
        if (!element) return null;

        // Check for bonus points in title attribute
        const bonusElements = element.querySelectorAll ?
            element.querySelectorAll('[title*="баллов за отзыв"]') :
            [];

        for (const el of bonusElements) {
            const title = el.getAttribute('title');
            if (title && title.includes('баллов за отзыв')) {
                const match = title.match(/(\d+)\s*баллов за отзыв/);
                if (match && match[1]) {
                    return parseInt(match[1], 10);
                }
            }
        }

        // Check text content
        if (element.textContent && element.textContent.includes('баллов за отзыв')) {
            const match = element.textContent.match(/(\d+)\s*баллов за отзыв/);
            if (match && match[1]) {
                return parseInt(match[1], 10);
            }
        }

        return null;
    }

    // Function to check if element should be filtered
    function shouldFilterElement(element) {
        if (!isFilterActive || !isFilterablePage) return false;

        // Quick check if this might be a product element
        const isProductElement = element.classList?.contains('tile-root');

        if (!isProductElement) return false;

        // Get bonus points
        const bonusPoints = getBonusPointsFromElement(element);

        // Filter if ≤200 points or no points found
        return bonusPoints === null || bonusPoints <= 200;
    }

    // Function to patch DOM methods (only on search/category pages)
    function patchDOMMethods() {
        if (!isFilterablePage) return;

        console.log('🔧 Patching DOM methods for filtering...');

        // Patch appendChild
        originalMethods.appendChild = Node.prototype.appendChild;
        Node.prototype.appendChild = function(newChild) {
            if (shouldFilterElement(newChild)) {
                //console.log('🚫 Filtered product in appendChild');
                // Create empty comment instead of removing
                const comment = document.createComment('Filtered product with low/no bonus points');
                return originalMethods.appendChild.call(this, comment);
            }
            return originalMethods.appendChild.call(this, newChild);
        };

        // Patch insertBefore
        originalMethods.insertBefore = Node.prototype.insertBefore;
        Node.prototype.insertBefore = function(newChild, refChild) {
            if (shouldFilterElement(newChild)) {
                //console.log('🚫 Filtered product in insertBefore');
                // Create empty comment instead
                const comment = document.createComment('Filtered product with low/no bonus points');
                return originalMethods.insertBefore.call(this, comment, refChild);
            }
            return originalMethods.insertBefore.call(this, newChild, refChild);
        };

        // Patch innerHTML setter
        const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        if (originalInnerHTML && originalInnerHTML.set) {
            originalMethods.innerHTML = originalInnerHTML.set;
            Object.defineProperty(Element.prototype, 'innerHTML', {
                set: function(html) {
                    if (!isFilterActive || typeof html !== 'string') {
                        return originalMethods.innerHTML.call(this, html);
                    }

                    // Check if this HTML contains products
                    if (html.includes('tile-root') && html.includes('баллов за отзыв')) {
                        // Parse HTML and filter products
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = html;

                        // Find all product elements
                        const products = tempDiv.querySelectorAll('[data-widget^="tile"] > .tile-root');
                        let filteredCount = 0;

                        products.forEach(product => {
                            if (shouldFilterElement(product)) {
                                product.remove();
                                filteredCount++;
                            }
                        });

                        if (filteredCount > 0) {
                            //console.log(`🚫 Filtered ${filteredCount} products in innerHTML`);
                            html = tempDiv.innerHTML;
                        }
                    }

                    return originalMethods.innerHTML.call(this, html);
                },
                get: originalInnerHTML.get
            });
        }

        // Patch insertAdjacentHTML
        originalMethods.insertAdjacentHTML = Element.prototype.insertAdjacentHTML;
        Element.prototype.insertAdjacentHTML = function(position, html) {
            if (!isFilterActive || typeof html !== 'string') {
                return originalMethods.insertAdjacentHTML.call(this, position, html);
            }

            // Check if this HTML contains products
            if (html.includes('tile-root') && html.includes('баллов за отзыв')) {
                // Parse HTML and filter products
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;

                // Find all product elements
                const products = tempDiv.querySelectorAll('[data-widget^="tile"] > .tile-root');
                let filteredCount = 0;

                products.forEach(product => {
                    if (shouldFilterElement(product)) {
                        product.remove();
                        filteredCount++;
                    }
                });

                if (filteredCount > 0) {
                    //console.log(`🚫 Filtered ${filteredCount} products in insertAdjacentHTML`);
                    html = tempDiv.innerHTML;
                }
            }

            return originalMethods.insertAdjacentHTML.call(this, position, html);
        };

        console.log('✅ DOM methods patched');
    }

    // Function to check if URL has has_points_from_reviews filter
    function hasPointsFromReviewsFilter() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.has('has_points_from_reviews');
    }

    // Function to check if URL has category prediction parameters
    function hasCategoryPredictionParams() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.has('category_was_predicted') && urlParams.has('deny_category_prediction');
    }

    // Function to update filter checkbox state based on URL
    function updateFilterCheckboxState() {
        const hasReviewsFilter = hasPointsFromReviewsFilter();
        const filterCheckbox = document.querySelector('.dom-filter-checkbox');

        if (filterCheckbox) {
            const label = filterCheckbox.closest('label');

            // Disable checkbox if no reviews filter is active
            if (!hasReviewsFilter) {
                filterCheckbox.disabled = true;
                filterCheckbox.checked = false;
                if (label) {
                    label.classList.add('disabled');
                }

                // Disable filter if it was active
                if (isFilterActive) {
                    isFilterActive = false;
                    restoreFilteredProducts();
                }
            } else {
                // Enable the checkbox when reviews filter is active
                filterCheckbox.disabled = false;
                if (label) {
                    label.classList.remove('disabled');
                }
            }
        }
    }

    // Function to update all categories checkbox state
    function updateAllCategoriesCheckboxState() {
        const allCategoriesCheckbox = document.querySelector('.all-categories-checkbox');

        if (allCategoriesCheckbox) {
            if (isCategoryPage()) {
                // On category page - start state is false
                allCategoriesCheckbox.checked = false;
            } else if (isSearchPage()) {
                // On search page - check if we have the prediction parameters
                allCategoriesCheckbox.checked = hasCategoryPredictionParams();
            }
        }
    }

    // Function to add control buttons (only on search/category pages)
    function addControlButtons() {
        if (!isFilterablePage) return;

        // Wait for the sort widget to appear
        const observer = new MutationObserver(() => {
            const targetDiv = document.querySelector('div[data-widget="searchResultsSort"]');
            if (!targetDiv || document.getElementById("bonusFilterControls")) return;

            observer.disconnect();

            // Create control buttons
            const buttonHTML = `
                <div id="bonusFilterControls" class="filter-controls-container">
                    <label class="ozon-toggle">
                        <input type="checkbox" class="review-toggle-checkbox" checked>
                        <span class="checkbox-box"></span>
                        <span>Баллы за отзывы</span>
                    </label>

                    <label class="ozon-toggle">
                        <input type="checkbox" class="dom-filter-checkbox">
                        <span class="checkbox-box"></span>
                        <span>Скрыть ≤200 баллов</span>
                    </label>

                    <label class="ozon-toggle">
                        <input type="checkbox" class="all-categories-checkbox" checked>
                        <span class="checkbox-box"></span>
                        <span>По всем категориям</span>
                    </label>

                    <button type="button" class="parse-queries-button">
                        📋 Запросы из буфера
                    </button>
                </div>`;

            const temp = document.createElement('div');
            temp.innerHTML = buttonHTML.trim();
            const buttons = temp.firstChild;
            buttons.setAttribute('data-v-pre', '');

            // Wrap target div and insert buttons
            const wrapper = document.createElement('div');
            wrapper.style.display = 'inline-flex';
            wrapper.style.alignItems = 'center';
            wrapper.style.gap = '10px';

            targetDiv.parentNode.style['min-width'] = '100%';
            targetDiv.parentNode.style['margin-bottom'] = '0px';
            targetDiv.parentNode.insertBefore(wrapper, targetDiv);
            wrapper.appendChild(targetDiv);
            wrapper.appendChild(buttons);

            // Get checkboxes
            const urlCheckbox = buttons.querySelector('.review-toggle-checkbox');
            const filterCheckbox = buttons.querySelector('.dom-filter-checkbox');
            const allCategoriesCheckbox = buttons.querySelector('.all-categories-checkbox');
            const parseQueriesButton = buttons.querySelector('.parse-queries-button');

            // Set initial checkbox state for URL filter
            const hasReviewsFilter = hasPointsFromReviewsFilter();
            urlCheckbox.checked = hasReviewsFilter;

            // Set initial state for all categories checkbox
            updateAllCategoriesCheckboxState();

            // Initialize DOM filter checkbox state
            updateFilterCheckboxState();

            // Event listener for URL filter
            urlCheckbox.addEventListener('change', function() {
                const url = new URL(window.location.href);
                if (this.checked) {
                    url.searchParams.set('has_points_from_reviews', 't');
                } else {
                    url.searchParams.delete('has_points_from_reviews');
                }
                window.location.href = url.toString();
            });

            // Event listener for DOM filter
            filterCheckbox.addEventListener('change', function() {
                if (this.disabled) {
                    return; // Don't allow changes when disabled
                }

                isFilterActive = this.checked;

                if (isFilterActive) {
                    // Apply filter to existing products
                    filterExistingProducts();
                } else {
                    // Restore all products
                    restoreFilteredProducts();
                }

                console.log(`Filter ${isFilterActive ? 'activated' : 'deactivated'}`);
            });

            // Event listener for All Categories checkbox
            allCategoriesCheckbox.addEventListener('change', function() {
                handleAllCategoriesChange(this.checked);
            });

            // Event listener for Parse Queries button
            parseQueriesButton.addEventListener('click', handleParseQueriesFromClipboard);

            // Observe URL changes to update checkbox states
            const urlObserver = new MutationObserver(() => {
                updateFilterCheckboxState();
                updateAllCategoriesCheckboxState();
            });

            // Start observing URL changes when body is available
            if (document.body) {
                urlObserver.observe(document.body, { childList: true, subtree: true });
            }
        });

        // Start observing when body is available
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                observer.observe(document.body, { childList: true, subtree: true });
            });
        }
    }

    // Function to filter existing products (only on search/category pages)
    function filterExistingProducts() {
        if (!isFilterActive || !isFilterablePage) return;

        const products = document.querySelectorAll('[data-widget^="tile"] > .tile-root');
        let filteredCount = 0;

        products.forEach(product => {
            const bonusPoints = getBonusPointsFromElement(product);
            if (bonusPoints === null || bonusPoints <= 200) {
                // Hide the product
                product.style.display = 'none';
                product.setAttribute('data-filtered-by-bonus', 'true');
                filteredCount++;
            }
        });
    }

    // Function to restore filtered products (only on search/category pages)
    function restoreFilteredProducts() {
        if (!isFilterablePage) return;

        const filteredProducts = document.querySelectorAll('[data-filtered-by-bonus="true"]');

        filteredProducts.forEach(product => {
            product.style.display = '';
            product.removeAttribute('data-filtered-by-bonus');
        });
    }

    function highlightBonusPoints() {
        const xpath = "//div[contains(text(), 'баллов за отзыв')]";
        const results = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

        for (let i = 0; i < results.snapshotLength; i++) {
            const node = results.snapshotItem(i);
            if (!node || node.classList.contains('highlighted-bonus')) continue;

            const text = node.textContent.trim();
            const match = text.match(/(\d+)\s*баллов за отзыв/i);
            if (match) {
                const points = parseInt(match[1], 10);

                if (points > 200) {
                    node.style.color = 'deeppink';
                    node.style.textEmphasis = '"❤️"';
                    node.style.fontWeight = 'bold';
                    node.style['-webkit-writing-mode'] = 'vertical-lr';
                }

                node.classList.add('highlighted-bonus');
            }
        }
    }

    function addAutoHide() {
        const elements = document.querySelectorAll('#contentScrollPaginator .tsBodyControl400Small')
        for (let i = 0; i < elements.length; i++) {
            const node = elements[i].parentNode;
            if (!node || node.classList.contains('autohide') || node.parentNode?.parentNode?.nodeName !== 'SECTION') continue;

            // Make the element interactive
            node.style.pointerEvents = 'auto';

            // Use mouseover/mouseout instead of mouseenter/mouseleave
            node.addEventListener('mouseover', function() {
                const parent = this.parentElement.parentElement;
                if (parent) {
                    parent.style.transition = 'opacity 0.3s ease, visibility 0.3s ease';
                    parent.style.opacity = '0';
                    parent.style.visibility = 'hidden';
                }
            });

            node.addEventListener('mouseout', function() {
                const parent = this.parentElement.parentElement;
                if (parent) {
                    parent.style.opacity = '1';
                    parent.style.visibility = 'visible';
                }
            });

            node.classList.add('autohide');
        }
    }

    // Function to start element customizer observer (works on ALL pages)
    function startElementCustomizerObserver() {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', startElementCustomizerObserver);
            return;
        }

        const customizerObserver = new MutationObserver(() => {
            setTimeout(highlightBonusPoints, 100);
            setTimeout(addAutoHide, 100);
        });

        customizerObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Initial highlight and autohide
        setTimeout(highlightBonusPoints, 1500);
        setTimeout(addAutoHide, 1500);
    }

    // Main initialization
    function init() {
        console.log('🚀 Ozon Bonus Tools loading...');
        console.log(`📄 Page type: ${isFilterablePage ? 'Filterable' : 'Other'}`);
        console.log(`📋 Order list page: ${isOrderListPage ? 'Yes' : 'No'}`);

        // Add global styles
        addGlobalStyles();

        // Always add order filter checkbox if on order list page
        if (isOrderListPage) {
            setTimeout(addOrderFilterCheckbox, 1000);
        }

        // Check if reviews filter is active
        const hasReviewsFilter = hasPointsFromReviewsFilter();

        // Load saved filter state (only relevant for search/category pages with reviews filter)
        if (isFilterablePage && hasReviewsFilter) {
            // Patch DOM methods for filtering
            patchDOMMethods();

            // Apply filter to existing products if active
            if (isFilterActive) {
                setTimeout(filterExistingProducts, 1000);
            }
        }

        // Add control buttons (always add them, but checkbox will be disabled if no reviews filter)
        if (isFilterablePage) {
            addControlButtons();
        }

        // ALWAYS run element customizer functionality on all pages
        startElementCustomizerObserver();
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();