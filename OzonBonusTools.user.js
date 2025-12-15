// ==UserScript==
// @name         Ozon Bonus Tools
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Advanced product filter and highlighting
// @author       Silve & Deepseek
// @match        *://www.ozon.ru/search/*
// @match        *://www.ozon.ru/category/*
// @match        *://www.ozon.ru/seller/*
// @match        *://www.ozon.ru/*
// @homepageURL  https://github.com/SilveIT/Userscripts
// @updateURL    https://github.com/SilveIT/Userscripts/raw/refs/heads/main/OzonBonusTools.user.js
// @downloadURL  https://github.com/SilveIT/Userscripts/raw/refs/heads/main/OzonBonusTools.user.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const saveFilterToLocalStorage = false;

    // Check if we're on a search/category/seller page
    const isFilterablePage =
        window.location.pathname.includes('/search/') ||
        window.location.pathname.includes('/category/') ||
        window.location.pathname.includes('/seller/');

    // Flag to track if filtering is active (only on search/category/seller pages)
    let isFilterActive = false;

    // Store original methods
    const originalMethods = {
        appendChild: null,
        insertBefore: null,
        innerHTML: null,
        insertAdjacentHTML: null
    };

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
        const isProductElement =
            element.classList && element.classList.contains('tile-root') ||
            element.querySelector && element.querySelector('.tile-root') ||
            (element.getAttribute && element.getAttribute('data-widget') &&
             element.getAttribute('data-widget').includes('tile'));

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
                        const products = tempDiv.querySelectorAll('.tile-root, [data-widget*="tile"]');
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
                const products = tempDiv.querySelectorAll('.tile-root, [data-widget*="tile"]');
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

    // Function to update filter checkbox state based on URL
    function updateFilterCheckboxState() {
        const hasReviewsFilter = hasPointsFromReviewsFilter();
        const filterCheckbox = document.querySelector('.dom-filter-checkbox');

        if (filterCheckbox) {
            // Disable checkbox if no reviews filter is active
            filterCheckbox.disabled = !hasReviewsFilter;

            // Also disable the parent label for better UX
            const label = filterCheckbox.closest('label');
            if (label) {
                if (!hasReviewsFilter) {
                    label.style.opacity = '0.5';
                    label.style.cursor = 'not-allowed';
                } else {
                    label.style.opacity = '1';
                    label.style.cursor = 'pointer';
                }
            }

            // If reviews filter is not active, uncheck and disable the DOM filter
            if (!hasReviewsFilter) {
                filterCheckbox.checked = false;
                // Disable filter if it was active
                if (isFilterActive) {
                    isFilterActive = false;
                    restoreFilteredProducts();
                    localStorage.setItem('ozonDOMFilterActive', 'false');
                }
            } else {
                // Enable the checkbox when reviews filter is active
                filterCheckbox.disabled = false;

                // Restore saved state
                const savedState = saveFilterToLocalStorage && localStorage.getItem('ozonDOMFilterActive');
                if (savedState === 'true') {
                    filterCheckbox.checked = true;
                    isFilterActive = true;
                    setTimeout(filterExistingProducts, 100);
                }
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
<div id="bonusFilterControls" style="display: inline-flex; align-items: center; gap: 10px; margin-left: 10px;">
  <div id="customReviewToggleButton">
    <div style="display: flex;">
      <div>
        <label>
          <input type="checkbox" class="review-toggle-checkbox">
        </label>
      </div>
      <div>
        <div>
          <span style="font-size: 16px; font-weight: 600; letter-spacing: 0; line-height: 20px;">Баллы за отзывы</span>
        </div>
      </div>
    </div>
  </div>

  <div id="domFilterButton">
    <div style="display: flex;">
      <div>
        <label>
          <input type="checkbox" class="dom-filter-checkbox">
        </label>
      </div>
      <div>
        <div>
          <span style="font-size: 16px; font-weight: 600; letter-spacing: 0; line-height: 20px;">Скрыть ≤200 баллов</span>
        </div>
      </div>
    </div>
  </div>
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

            targetDiv.parentNode.insertBefore(wrapper, targetDiv);
            wrapper.appendChild(targetDiv);
            wrapper.appendChild(buttons);

            // Get checkboxes
            const urlCheckbox = buttons.querySelector('.review-toggle-checkbox');
            const filterCheckbox = buttons.querySelector('.dom-filter-checkbox');

            // Set initial checkbox state for URL filter
            const hasReviewsFilter = hasPointsFromReviewsFilter();
            urlCheckbox.checked = hasReviewsFilter;

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

                // Save to localStorage
                localStorage.setItem('ozonDOMFilterActive', isFilterActive.toString());

                if (isFilterActive) {
                    // Apply filter to existing products
                    filterExistingProducts();
                } else {
                    // Restore all products
                    restoreFilteredProducts();
                }

                console.log(`Filter ${isFilterActive ? 'activated' : 'deactivated'}`);
            });

            // Observe URL changes to update checkbox state
            const urlObserver = new MutationObserver(() => {
                updateFilterCheckboxState();
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

        //console.log('🔍 Filtering existing products...');
        const products = document.querySelectorAll('.tile-root, [data-widget*="tile"]');
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

        //console.log(`🚫 Filtered ${filteredCount} existing products`);
    }

    // Function to restore filtered products (only on search/category pages)
    function restoreFilteredProducts() {
        if (!isFilterablePage) return;

        //console.log('🔓 Restoring filtered products...');
        const filteredProducts = document.querySelectorAll('[data-filtered-by-bonus="true"]');

        filteredProducts.forEach(product => {
            product.style.display = '';
            product.removeAttribute('data-filtered-by-bonus');
        });

        //console.log(`✅ Restored ${filteredProducts.length} products`);
    }

    // Function to highlight bonus points (works on ALL pages)
    function highlightBonusPoints() {
        // Find all elements that have text containing "баллов за отзыв"
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
                    node.classList.add('highlighted-bonus');
                }
            }
        }
    }

    // Function to start highlight observer (works on ALL pages)
    function startHighlightObserver() {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', startHighlightObserver);
            return;
        }

        const highlightObserver = new MutationObserver(() => {
            setTimeout(highlightBonusPoints, 100);
        });

        highlightObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Initial highlight
        setTimeout(highlightBonusPoints, 1500);
    }

    // Main initialization
    function init() {
        console.log('🚀 Ozon Bonus Tools loading...');
        console.log(`📄 Page type: ${isFilterablePage ? 'Filterable' : 'Other'}`);

        // Check if reviews filter is active
        const hasReviewsFilter = hasPointsFromReviewsFilter();

        // Load saved filter state (only relevant for search/category pages with reviews filter)
        if (isFilterablePage && hasReviewsFilter) {
            const savedState = saveFilterToLocalStorage && localStorage.getItem('ozonDOMFilterActive');
            if (savedState === 'true') {
                isFilterActive = true;
            }

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

        // ALWAYS run highlight functionality on all pages
        startHighlightObserver();
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export for debugging
    window.ozonBonusTools = {
        isFilterablePage: isFilterablePage,
        isFilterActive: () => isFilterActive,
        setFilterActive: (active) => {
            if (!isFilterablePage) return;
            isFilterActive = active;
            localStorage.setItem('ozonDOMFilterActive', active.toString());
            if (active) {
                filterExistingProducts();
            } else {
                restoreFilteredProducts();
            }
        },
        highlightBonusPoints: highlightBonusPoints,
        hasPointsFromReviewsFilter: hasPointsFromReviewsFilter
    };
})();