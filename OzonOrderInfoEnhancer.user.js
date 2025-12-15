// ==UserScript==
// @name         Ozon Order Info Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.9
// @description  Enhances order info page by improving tracking info
// @author       Silve & Deepseek
// @match        https://www.ozon.ru/my/orderdetails/?order=*
// @homepageURL  https://github.com/SilveIT/Userscripts
// @updateURL    https://github.com/SilveIT/Userscripts/raw/refs/heads/main/OzonOrderInfoEnhancer.user.js
// @downloadURL  https://github.com/SilveIT/Userscripts/raw/refs/heads/main/OzonOrderInfoEnhancer.user.js
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ==================== CONSTANTS ====================
    const SVG = {
        COPY: `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`,
        CHECK: `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`
    };

    // ==================== STYLES ====================
    GM_addStyle(`
        .tracking-info-container {
            background-color: var(--bgActionSecondary);
            color: var(--textAction);
            padding: 8px 12px;
            border-radius: 6px;
            margin-top: 8px;
            margin-bottom: 12px;
            border: 1px solid rgba(0, 91, 255, 0.1);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            position: relative;
            overflow: hidden;
        }

        .tracking-row {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: nowrap;
            width: 100%;
            position: relative;
            z-index: 1;
        }

        .tracking-label {
            font-size: 12px;
            font-weight: 500;
            opacity: 0.8;
            white-space: nowrap;
            flex-shrink: 0;
        }

        .tracking-number-container {
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
            position: relative;
        }

        .tracking-number {
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-family: 'SF Mono', Monaco, 'Cascadia Mono', 'Segoe UI Mono', monospace;
            background-color: rgba(255, 255, 255, 0.7);
            padding: 2px 6px;
            border-radius: 3px;
        }

        .copy-button {
            background: none;
            border: 1px solid var(--textAction);
            color: var(--textAction);
            border-radius: 4px;
            padding: 2px 6px;
            font-size: 11px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            transition: background-color 0.2s ease;
            white-space: nowrap;
            flex-shrink: 0;
            min-width: 32px;
            height: 24px;
            position: relative;
            z-index: 2;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }

        .copy-button:hover {
            background-color: rgba(0, 91, 255, 0.1);
        }

        .copy-button:active {
            background-color: rgba(0, 91, 255, 0.2);
        }

        .copy-button.copied {
            background-color: rgba(0, 200, 83, 0.1);
            border-color: #00c853;
            color: #00c853;
            min-width: 32px;
        }

        .copy-icon {
            width: 16px;
            height: 16px;
            display: block;
        }

        .copy-icon svg {
            width: 100%;
            height: 100%;
            fill: currentColor;
        }

        .copy-button.copied .copy-icon svg {
            fill: #00c853;
        }

        .tracking-link {
            display: inline-flex;
            align-items: center;
            padding: 4px 8px;
            background-color: rgba(0, 91, 255, 0.1);
            border-radius: 4px;
            text-decoration: none;
            color: var(--textAction);
            font-size: 12px;
            font-weight: 500;
            transition: background-color 0.2s ease;
            border: 1px solid rgba(0, 91, 255, 0.2);
            white-space: nowrap;
            flex-shrink: 0;
            height: 24px;
            position: relative;
            z-index: 2;
        }

        .tracking-link:hover {
            background-color: rgba(0, 91, 255, 0.15);
            text-decoration: none;
        }

        .tracking-icon {
            margin-right: 4px;
            font-size: 12px;
        }

        .loading-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: var(--textAction);
        }

        .loading-spinner {
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid rgba(0, 91, 255, 0.3);
            border-radius: 50%;
            border-top-color: var(--textAction);
            animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .duck {
            position: absolute;
            font-size: 20px;
            pointer-events: none;
            z-index: 0;
            filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.2));
            transform-origin: center;
            will-change: transform;
        }

        .hedgehog {
            position: absolute;
            font-size: 18px;
            pointer-events: none;
            z-index: 0;
            filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.2));
            transform-origin: center;
            will-change: transform;
        }

        .explosion-particle {
            position: fixed;
            font-size: 24px;
            pointer-events: none;
            z-index: 9999;
            animation: explode 1.5s ease-out forwards;
        }

        @keyframes explode {
            0% {
                transform: translate(0, 0) scale(1);
                opacity: 1;
            }
            100% {
                transform: translate(var(--tx, 0), var(--ty, 0)) scale(0);
                opacity: 0;
            }
        }

        .error-message {
            color: #ff3b30;
            font-size: 12px;
            padding: 6px 8px;
            background-color: rgba(255, 59, 48, 0.1);
            border-radius: 4px;
            margin-top: 4px;
        }
    `);

    // ==================== UTILITIES ====================
    class Utils {
        static extractOrderId() {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('order');
        }

        static extractShipmentId(widget) {
            const id = widget.id;
            return id && id.startsWith('id') ? id.substring(2) : null;
        }

        static async copyToClipboard(text, event) {
            if (event) {
                AnimationManager.createExplosion(event.clientX, event.clientY, false);
            }

            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    return document.execCommand('copy');
                } finally {
                    document.body.removeChild(textArea);
                }
            }
        }
    }

    // ==================== ANIMATION MANAGER (ORIGINAL) ====================
    class AnimationManager {
        static animationManager = null;

        static init() {
            if (!this.animationManager) {
                this.animationManager = new AnimalAnimationManager();
            }
        }

        static createAnimal(container, isHedgehog = false) {
            this.init();
            return this.animationManager.createAnimal(container, isHedgehog);
        }

        static addRunningAnimals(container) {
            this.init();
            this.animationManager.addRunningAnimals(container);
        }

        static createExplosion(x, y, isHedgehogExplosion = false) {
            return this.animationManager.createExplosion(x, y, isHedgehogExplosion);
        }

        static clearAll() {
            if (this.animationManager) {
                this.animationManager.clearAll();
            }
        }
    }

    class AnimalAnimationManager {
        constructor() {
            this.animals = new Set();
            this.animationRunning = false;
            this.lastTimestamp = 0;
            this.animationFrameId = null;
            this.lastBoundaryCheck = 0;
            this.boundaryCheckInterval = 1000;
        }

        createAnimal(container, isHedgehog = false) {
            const animal = document.createElement('div');
            animal.className = isHedgehog ? 'hedgehog' : 'duck';
            animal.textContent = isHedgehog ? '🦔' : '🦆';

            const size = 16 + Math.random() * 12;
            const speed = 0.8 + Math.random() * 0.8;
            const wiggleSpeed = 2 + Math.random() * 3;
            const wiggleAmount = 5 + Math.random() * 10;

            const containerRect = container.getBoundingClientRect();
            const buffer = size * 0.3;
            const startX = buffer + Math.random() * (containerRect.width - buffer * 2);
            const startY = buffer + Math.random() * (containerRect.height - buffer * 2);

            const angle = Math.random() * Math.PI * 2;
            const velocityX = Math.cos(angle) * speed;
            const velocityY = Math.sin(angle) * speed;

            const hue = isHedgehog ?
                30 + Math.random() * 30 :
                40 + Math.random() * 20;

            animal.style.position = 'absolute';
            animal.style.left = '0';
            animal.style.top = '0';
            animal.style.fontSize = `${size}px`;
            animal.style.filter = `drop-shadow(0 2px 3px rgba(0, 0, 0, 0.2)) hue-rotate(${hue}deg)`;
            animal.style.pointerEvents = 'none';
            animal.style.zIndex = '0';

            const animalObj = {
                element: animal,
                container: container,
                x: startX,
                y: startY,
                velocityX: velocityX,
                velocityY: velocityY,
                size: size,
                speed: speed,
                wiggleSpeed: wiggleSpeed,
                wiggleAmount: wiggleAmount,
                rotation: 0,
                wigglePhase: Math.random() * Math.PI * 2,
                bouncePhase: Math.random() * Math.PI * 2,
                bounceAmount: 3 + Math.random() * 4,
                bounceSpeed: 1 + Math.random() * 2,
                isHedgehog: isHedgehog,
                pattern: Math.floor(Math.random() * 4),
                patternTime: 0,
                trail: [],
                maxTrailLength: 5,
                containerWidth: containerRect.width,
                containerHeight: containerRect.height,
                boundaryBuffer: size * 0.3,
                turnSpeed: 0.1 + Math.random() * 0.2,
                isTurning: false,
                targetAngle: 0,
                lastBoundaryUpdate: Date.now(),
                stuckCounter: 0,
                maxStuckCount: 20,
                wanderAngle: 0,
                wanderChange: 0.1 + Math.random() * 0.2
            };

            container.appendChild(animal);
            this.animals.add(animalObj);

            if (!this.animationRunning) {
                this.startAnimation();
            }

            return animal;
        }

        updateAnimalBoundaries(animal) {
            const containerRect = animal.container.getBoundingClientRect();
            animal.containerWidth = containerRect.width;
            animal.containerHeight = containerRect.height;
            animal.lastBoundaryUpdate = Date.now();

            const buffer = animal.boundaryBuffer;
            animal.x = Math.max(buffer, Math.min(animal.x, animal.containerWidth - buffer));
            animal.y = Math.max(buffer, Math.min(animal.y, animal.containerHeight - buffer));

            animal.stuckCounter = 0;
        }

        updateAllBoundaries(timestamp) {
            const currentTime = timestamp;
            if (currentTime - this.lastBoundaryCheck > this.boundaryCheckInterval) {
                for (const animal of this.animals) {
                    this.updateAnimalBoundaries(animal);
                }
                this.lastBoundaryCheck = currentTime;
            }
        }

        startAnimation() {
            this.animationRunning = true;
            this.animate();
        }

        animate(timestamp = 0) {
            if (!this.animationRunning) return;

            this.updateAllBoundaries(timestamp);

            const deltaTime = timestamp - this.lastTimestamp || 0;
            this.lastTimestamp = timestamp;

            for (const animal of this.animals) {
                this.updateAnimal(animal, deltaTime);
            }

            this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
        }

        updateAnimal(animal, deltaTime) {
            const dt = Math.min(deltaTime, 32) / 16;

            animal.trail.unshift({ x: animal.x, y: animal.y });
            if (animal.trail.length > animal.maxTrailLength) {
                animal.trail.pop();
            }

            animal.wanderAngle += (Math.random() - 0.5) * animal.wanderChange;
            const wanderForceX = Math.cos(animal.wanderAngle) * animal.speed * 0.3;
            const wanderForceY = Math.sin(animal.wanderAngle) * animal.speed * 0.3;

            switch (animal.pattern) {
                case 0:
                    this.randomWalk(animal, dt, wanderForceX, wanderForceY);
                    break;
                case 1:
                    this.circularMotion(animal, dt);
                    break;
                case 2:
                    this.figureEight(animal, dt);
                    break;
                case 3:
                    this.zigzagMotion(animal, dt);
                    break;
            }

            animal.rotation = Math.sin(animal.wigglePhase) * animal.wiggleAmount;
            animal.wigglePhase += animal.wiggleSpeed * dt * 0.1;
            animal.bouncePhase += animal.bounceSpeed * dt * 0.1;

            this.handleBoundariesAggressive(animal, dt);

            if (animal.trail.length >= 3) {
                const recentPos = animal.trail[0];
                const oldPos = animal.trail[2];
                const distance = Math.sqrt(
                    Math.pow(recentPos.x - oldPos.x, 2) +
                    Math.pow(recentPos.y - oldPos.y, 2)
                );

                if (distance < 5) {
                    animal.stuckCounter++;
                    if (animal.stuckCounter > animal.maxStuckCount) {
                        animal.velocityX = (Math.random() - 0.5) * animal.speed * 2;
                        animal.velocityY = (Math.random() - 0.5) * animal.speed * 2;
                        animal.stuckCounter = 0;
                    }
                } else {
                    animal.stuckCounter = Math.max(0, animal.stuckCounter - 2);
                }
            }

            const bounceOffset = Math.sin(animal.bouncePhase) * animal.bounceAmount;
            animal.element.style.transform =
                `translate(${animal.x}px, ${animal.y + bounceOffset}px) rotate(${animal.rotation}deg)`;
        }

        randomWalk(animal, dt, wanderX, wanderY) {
            if (Math.random() < 0.02 * dt) {
                const angle = Math.random() * Math.PI * 2;
                animal.velocityX = Math.cos(angle) * animal.speed;
                animal.velocityY = Math.sin(angle) * animal.speed;
            }

            animal.velocityX = (animal.velocityX + wanderX) * 0.95;
            animal.velocityY = (animal.velocityY + wanderY) * 0.95;

            const currentSpeed = Math.sqrt(animal.velocityX * animal.velocityX + animal.velocityY * animal.velocityY);
            if (currentSpeed > 0) {
                animal.velocityX = (animal.velocityX / currentSpeed) * animal.speed;
                animal.velocityY = (animal.velocityY / currentSpeed) * animal.speed;
            }

            animal.x += animal.velocityX * dt;
            animal.y += animal.velocityY * dt;
            animal.patternTime += dt * 0.1;
        }

        circularMotion(animal, dt) {
            const maxRadius = Math.min(animal.containerWidth, animal.containerHeight) / 2 - animal.boundaryBuffer;
            const radius = maxRadius * 0.8 + Math.sin(animal.patternTime * 0.4) * (maxRadius * 0.2);

            const centerX = animal.containerWidth / 2 +
                           Math.sin(animal.patternTime * 0.15) * (animal.containerWidth / 2 - animal.boundaryBuffer - radius);
            const centerY = animal.containerHeight / 2 +
                           Math.cos(animal.patternTime * 0.12) * (animal.containerHeight / 2 - animal.boundaryBuffer - radius);

            animal.x = centerX + Math.cos(animal.patternTime) * radius;
            animal.y = centerY + Math.sin(animal.patternTime) * radius;
            animal.patternTime += animal.speed * dt * 0.03;
        }

        figureEight(animal, dt) {
            const scaleX = Math.max(20, (animal.containerWidth - animal.boundaryBuffer * 2) * 0.4);
            const scaleY = Math.max(20, (animal.containerHeight - animal.boundaryBuffer * 2) * 0.4);
            const speed = animal.speed * 0.02;

            const centerX = animal.containerWidth / 2 +
                           Math.sin(animal.patternTime * 0.1) * (animal.containerWidth / 2 - animal.boundaryBuffer - scaleX);
            const centerY = animal.containerHeight / 2 +
                           Math.cos(animal.patternTime * 0.08) * (animal.containerHeight / 2 - animal.boundaryBuffer - scaleY);

            animal.x = centerX + Math.sin(animal.patternTime) * scaleX;
            animal.y = centerY + Math.sin(animal.patternTime * 2) * scaleY * 0.5;
            animal.patternTime += speed * dt;
        }

        zigzagMotion(animal, dt) {
            const verticalRange = Math.max(30, (animal.containerHeight - animal.boundaryBuffer * 2) * 0.45);
            const horizontalSpeed = animal.speed * 0.8;

            animal.x += animal.velocityX * dt;

            if (animal.x >= animal.containerWidth - animal.boundaryBuffer ||
                animal.x <= animal.boundaryBuffer) {
                animal.velocityX *= -1;
                animal.x = Math.max(animal.boundaryBuffer,
                                   Math.min(animal.x, animal.containerWidth - animal.boundaryBuffer));
            }

            animal.y = animal.containerHeight / 2 +
                      Math.sin(animal.patternTime * 3) * verticalRange;
            animal.patternTime += animal.speed * dt * 0.02;
        }

        handleBoundariesAggressive(animal, dt) {
            const buffer = animal.boundaryBuffer;
            const currentSpeed = Math.sqrt(animal.velocityX * animal.velocityX + animal.velocityY * animal.velocityY);

            let turnAngle = 0;

            if (animal.x >= animal.containerWidth - buffer - 2) {
                turnAngle = Math.PI + (Math.random() * 0.5 - 0.25) * Math.PI;
                animal.x = Math.min(animal.x, animal.containerWidth - buffer);
            } else if (animal.x <= buffer + 2) {
                turnAngle = 0 + (Math.random() * 0.5 - 0.25) * Math.PI;
                animal.x = Math.max(animal.x, buffer);
            }

            if (animal.y >= animal.containerHeight - buffer - 2) {
                turnAngle = Math.PI * 1.5 + (Math.random() * 0.5 - 0.25) * Math.PI;
                animal.y = Math.min(animal.y, animal.containerHeight - buffer);
            } else if (animal.y <= buffer + 2) {
                turnAngle = Math.PI * 0.5 + (Math.random() * 0.5 - 0.25) * Math.PI;
                animal.y = Math.max(animal.y, buffer);
            }

            if (turnAngle !== 0) {
                animal.velocityX = Math.cos(turnAngle) * currentSpeed;
                animal.velocityY = Math.sin(turnAngle) * currentSpeed;
                animal.stuckCounter = 0;
            }
        }

        removeAnimal(animal) {
            if (animal.element.parentNode) {
                animal.element.parentNode.removeChild(animal.element);
            }
            this.animals.delete(animal);

            if (this.animals.size === 0 && this.animationFrameId) {
                this.stopAnimation();
            }
        }

        stopAnimation() {
            this.animationRunning = false;
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
        }

        clearAll() {
            for (const animal of this.animals) {
                if (animal.element.parentNode) {
                    animal.element.parentNode.removeChild(animal.element);
                }
            }
            this.animals.clear();
            this.stopAnimation();
        }

        addRunningAnimals(container) {
            const duckCount = Math.floor(Math.random() * 4) + 1;
            const hedgehogCount = Math.floor(Math.random() * 3) + 1;

            for (let i = 0; i < duckCount; i++) {
                setTimeout(() => {
                    this.createAnimal(container, false);
                }, i * 200);
            }

            for (let i = 0; i < hedgehogCount; i++) {
                setTimeout(() => {
                    this.createAnimal(container, true);
                }, i * 250 + 100);
            }
        }

        createExplosion(x, y, isHedgehogExplosion = false) {
            const particles = [];
            const particleCount = 15;

            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                particle.className = 'explosion-particle';

                const isHedgehog = isHedgehogExplosion ? true : (Math.random() > 0.5);
                particle.textContent = isHedgehog ? '🦔' : '🦆';

                const angle = Math.random() * Math.PI * 2;
                const distance = 80 + Math.random() * 120;
                const tx = Math.cos(angle) * distance;
                const ty = Math.sin(angle) * distance;

                const size = 16 + Math.random() * 16;
                const hue = isHedgehog ? 20 + Math.random() * 40 : 40 + Math.random() * 30;

                particle.style.left = `${x}px`;
                particle.style.top = `${y}px`;
                particle.style.setProperty('--tx', `${tx}px`);
                particle.style.setProperty('--ty', `${ty}px`);
                particle.style.fontSize = `${size}px`;
                particle.style.filter = `hue-rotate(${hue}deg) drop-shadow(0 3px 5px rgba(0, 0, 0, 0.3))`;

                const duration = 0.6 + Math.random() * 0.5;
                particle.style.animationDuration = `${duration}s`;

                document.body.appendChild(particle);
                particles.push(particle);

                setTimeout(() => {
                    if (particle.parentNode) {
                        particle.parentNode.removeChild(particle);
                    }
                }, duration * 1000);
            }

            return particles;
        }
    }

    // ==================== CACHE MANAGER ====================
    class CacheManager {
        constructor() {
            this.cache = new Map();
        }

        get(key) {
            return this.cache.get(key);
        }

        set(key, data) {
            this.cache.set(key, data);
        }

        clear() {
            this.cache.clear();
        }
    }

    // ==================== API SERVICE ====================
    class ApiService {
        constructor(cacheManager) {
            this.cacheManager = cacheManager;
        }

        async fetchTrackingInfo(orderId, shipmentId) {
            const cacheKey = `${orderId}_${shipmentId}`;
            const cached = this.cacheManager.get(cacheKey);
            if (cached) return cached;

            try {
                const url = `https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2?url=%2Fmodal%2FtrackPostingInfo%2F%3Forder%3D${orderId}%26shipmentId%3D${shipmentId}%26page_changed%3Dtrue`;

                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();

                const trackPostingKey = Object.keys(data.widgetStates).find(key => key.includes('trackPosting'));

                if (!trackPostingKey) {
                    throw new Error('Track posting widget not found');
                }

                const widgetState = JSON.parse(data.widgetStates[trackPostingKey]);

                const trackingNumber = widgetState?.cell?.common?.action?.params?.clipboardText;
                let trackingLink = widgetState?.button?.common?.action?.link;

                if (trackingLink === "https://tracking.ozon.ru/") {
                    trackingLink = `https://tracking.ozon.ru/?track=${trackingNumber}`;
                }

                const result = {
                    trackingNumber,
                    trackingLink
                };

                this.cacheManager.set(cacheKey, result);
                return result;

            } catch (error) {
                console.error('Error fetching tracking info:', error);
                throw error;
            }
        }
    }

    // ==================== UI COMPONENTS ====================
    class UIComponents {
        createTrackingElement(trackingData) {
            const container = document.createElement('div');
            container.className = 'tracking-info-container';

            setTimeout(() => {
                AnimationManager.addRunningAnimals(container);
            }, 100);

            const row = document.createElement('div');
            row.className = 'tracking-row';

            // Label
            const label = document.createElement('div');
            label.className = 'tracking-label';
            label.textContent = 'ТРЕК-НОМЕР';
            label.title = 'Трек-номер отправления';

            // Tracking number and copy button
            const numberContainer = document.createElement('div');
            numberContainer.className = 'tracking-number-container';

            const trackingNumber = document.createElement('div');
            trackingNumber.className = 'tracking-number';
            trackingNumber.textContent = trackingData.trackingNumber;
            trackingNumber.title = trackingData.trackingNumber;

            const copyButton = this.createCopyButton(trackingData.trackingNumber);
            numberContainer.appendChild(trackingNumber);
            numberContainer.appendChild(copyButton);

            // Tracking link
            const trackingLink = this.createTrackingLink(trackingData.trackingLink);

            row.appendChild(label);
            row.appendChild(numberContainer);
            row.appendChild(trackingLink);
            container.appendChild(row);

            return container;
        }

        createCopyButton(trackingNumber) {
            const button = document.createElement('button');
            button.className = 'copy-button';
            button.innerHTML = `<span class="copy-icon">${SVG.COPY}</span>`;
            button.title = 'Скопировать трек-номер';

            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const originalHTML = button.innerHTML;
                const success = await Utils.copyToClipboard(trackingNumber, e);

                if (success) {
                    button.classList.add('copied');
                    button.innerHTML = `<span class="copy-icon">${SVG.CHECK}</span>`;
                    button.title = 'Скопировано!';

                    setTimeout(() => {
                        button.classList.remove('copied');
                        button.innerHTML = `<span class="copy-icon">${SVG.COPY}</span>`;
                        button.title = 'Скопировать трек-номер';
                    }, 2000);
                }
            });

            return button;
        }

        createTrackingLink(trackingLink) {
            const link = document.createElement('a');
            link.className = 'tracking-link';
            link.href = trackingLink;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.title = 'Отследить отправление';

            const icon = document.createElement('span');
            icon.className = 'tracking-icon';
            icon.textContent = '🚚';

            const linkText = document.createElement('span');
            linkText.textContent = 'Отследить';

            link.appendChild(icon);
            link.appendChild(linkText);

            return link;
        }

        createLoadingElement() {
            const container = document.createElement('div');
            container.className = 'tracking-info-container';

            const loading = document.createElement('div');
            loading.className = 'loading-indicator';

            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner';

            const text = document.createElement('span');
            text.textContent = 'Загрузка трек-номера...';

            loading.appendChild(spinner);
            loading.appendChild(text);
            container.appendChild(loading);

            return container;
        }

        createErrorElement(error) {
            const container = document.createElement('div');
            container.className = 'tracking-info-container';

            const errorMsg = document.createElement('div');
            errorMsg.className = 'error-message';
            errorMsg.textContent = `Ошибка: ${error}`;

            container.appendChild(errorMsg);
            return container;
        }
    }

    // ==================== MAIN CONTROLLER ====================
    class OzonOrderEnhancer {
        constructor() {
            this.cacheManager = new CacheManager();
            this.apiService = new ApiService(this.cacheManager);
            this.uiComponents = new UIComponents();
            this.processedWidgets = new Set();
            this.observer = null;
        }

        init() {
            this.setupMutationObserver();
            this.processPage();
            this.setupCleanup();
        }

        setupMutationObserver() {
            this.observer = new MutationObserver(() => this.processPage());
            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        processPage() {
            const shipmentWidgets = document.querySelectorAll('div[data-widget="shipmentWidget"]');

            shipmentWidgets.forEach(widget => {
                if (!this.processedWidgets.has(widget)) {
                    this.processedWidgets.add(widget);
                    this.processShipmentWidget(widget);
                }
            });
        }

        async processShipmentWidget(widget) {
            const orderId = Utils.extractOrderId();
            const shipmentId = Utils.extractShipmentId(widget);

            if (!orderId || !shipmentId) {
                console.warn('Could not extract orderId or shipmentId');
                return;
            }

            const firstChild = widget.children[0];
            const loadingElement = this.uiComponents.createLoadingElement();

            if (firstChild) {
                firstChild.after(loadingElement);
            } else {
                widget.prepend(loadingElement);
            }

            try {
                const trackingData = await this.apiService.fetchTrackingInfo(orderId, shipmentId);
                loadingElement.remove();

                if (trackingData.trackingNumber) {
                    const trackingElement = this.uiComponents.createTrackingElement(trackingData);
                    if (firstChild) {
                        firstChild.after(trackingElement);
                    } else {
                        widget.prepend(trackingElement);
                    }
                }
            } catch (error) {
                loadingElement.remove();
                const errorElement = this.uiComponents.createErrorElement(error.message || 'Неизвестная ошибка');

                if (firstChild) {
                    firstChild.after(errorElement);
                } else {
                    widget.prepend(errorElement);
                }
            }
        }

        setupCleanup() {
            window.addEventListener('beforeunload', () => {
                AnimationManager.clearAll();
                if (this.observer) {
                    this.observer.disconnect();
                }
            });
        }
    }

    // ==================== INITIALIZATION ====================
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => new OzonOrderEnhancer().init(), 1000);
        });
    } else {
        setTimeout(() => new OzonOrderEnhancer().init(), 1000);
    }
})();