// ==UserScript==
// @name         NexusScript
// @description  Форумный скрипт для Nexus
// @namespace    http://tampermonkey.net/
// @version      1.3
// @author       TerryClapsman
// @match        https://forum.keeper-nexus.com/*
// ==/UserScript==

(function() {
    'use strict';

    let db = JSON.parse(localStorage.getItem('nexus_v17_db')) || {
        folders: [{ id: 111, name: 'Общие', templates: [] }],
        activeFolderId: 111,
        appointmentTemplates: [],
        showBadges: true
    };
    if (!db.appointmentTemplates) db.appointmentTemplates = [];
    if (db.showBadges === undefined) db.showBadges = true;

    const FirebaseService = {
        baseUrl: 'https://nexusscript-online-default-rtdb.europe-west1.firebasedatabase.app',
        
        async exportTemplate(template, type = 'appointment') {
            const path = type === 'appointment' ? 'templates' : 'regular_templates';
            const code = template.exportCode || this.generateCode(type);
            try {
                const response = await fetch(`${this.baseUrl}/${path}/${code}.json`, {
                    method: 'PUT',
                    body: JSON.stringify(template)
                });
                if (!response.ok) throw new Error('Ошибка при экспорте');
                return code;
            } catch (err) {
                throw err;
            }
        },
        
        async importTemplate(code) {
            const type = code.includes('-') && code.split('-')[0].length === 3 ? 'regular' : 'appointment';
            const path = type === 'appointment' ? 'templates' : 'regular_templates';
            try {
                const response = await fetch(`${this.baseUrl}/${path}/${code}.json`);
                if (!response.ok) throw new Error('Ошибка при импорте');
                const data = await response.json();
                if (!data) throw new Error('Шаблон не найден');
                return { data, type };
            } catch (err) {
                throw err;
            }
        },
        
        generateCode(type = 'appointment') {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            if (type === 'appointment') {
                const part = () => Array.from({length: 2}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                return `${part()}-${part()}-${part()}`;
            } else {
                const part = () => Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                return `${part()}-${part()}`;
            }
        }
    };

    let floatBtn = null;
    let activeTab = 'templates';
    let cachedHasModAccess = false;
    let hasCheckedAccess = false;
    let isCheckingAccess = false;

    const styles = `
        .nx-archive-form {
            display: flex;
            flex-direction: column;
            gap: 15px;
            padding: 25px;
            background: #1d1d1d;
            border-radius: 12px;
            border: 1px solid #333;
            max-width: 550px;
            margin: 0 auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .nx-form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        .nx-form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .nx-form-group.full {
            grid-column: span 2;
        }
        .nx-form-group label {
            font-size: 11px;
            color: #af9159;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-left: 2px;
        }
        .nx-input, .nx-select {
            background: #252525;
            border: 1px solid #383838;
            color: #efefef;
            padding: 10px 14px;
            border-radius: 6px;
            font-size: 14px;
            outline: none;
            transition: all 0.2s ease;
            width: 100%;
            box-sizing: border-box;
        }
        .nx-input:hover, .nx-select:hover {
            border-color: #444;
        }
        .nx-input:focus, .nx-select:focus {
            border-color: #af9159;
            background: #2a2a2a;
            box-shadow: 0 0 0 2px rgba(175, 145, 89, 0.1);
        }
        .nx-btn-archive {
            background: #af9159;
            color: #111;
            border: none;
            padding: 12px;
            border-radius: 6px;
            font-weight: 800;
            cursor: pointer;
            margin-top: 10px;
            transition: all 0.2s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-size: 13px;
        }
        .nx-btn-archive:hover {
            background: #c5a66d;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(175, 145, 89, 0.2);
        }
        .nx-btn-archive:active {
            transform: translateY(0);
        }
        .nx-szm-check {
            display: none;
            align-items: center;
            gap: 10px;
            margin-top: 10px;
            padding: 10px;
            background: rgba(175, 145, 89, 0.05);
            border: 1px dashed #af9159;
            border-radius: 6px;
            animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .nx-checkbox {
            cursor: pointer;
            width: 16px;
            height: 16px;
            accent-color: #af9159;
        }
        .nx-szm-label {
            font-size: 13px;
            color: #ccc;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .nx-btn-archive:disabled {
            background: #444;
            color: #888;
            cursor: not-allowed;
        }
        .nx-status-msg {
            font-size: 13px;
            padding: 8px;
            border-radius: 4px;
            margin-top: 10px;
            display: none;
        }
        .nx-status-msg.info { display: block; background: #222; color: #aaa; border: 1px solid #333; }
        .nx-status-msg.error { display: block; background: #321; color: #f55; border: 1px solid #522; }
        .nx-status-msg.success { display: block; background: #121; color: #5f5; border: 1px solid #252; }
        
        .nx-mod-menu {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 20px;
            padding: 20px;
        }
        .nx-mod-card {
            background: #1d1d1d;
            border: 1px solid #333;
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
        }
        .nx-mod-card:hover {
            border-color: #af9159;
            background: #252525;
            transform: translateY(-5px);
        }
        .nx-mod-card i {
            font-size: 32px;
            margin-bottom: 5px;
        }
        .nx-mod-card b {
            color: #af9159;
            font-size: 16px;
        }
        .nx-mod-card p {
            font-size: 12px;
            color: #888;
            margin: 0;
        }
        .nx-back-btn {
            background: transparent;
            color: #888;
            border: 1px solid #333;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            font-size: 12px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
        }
        .nx-back-btn:hover {
            color: #af9159;
            border-color: #af9159;
            background: rgba(175, 145, 89, 0.05);
        }
        .nx-form-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 25px;
            border-bottom: 1px solid #333;
            padding-bottom: 15px;
        }
        .nx-form-title {
            color: #af9159;
            font-size: 18px;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 0;
        }
        .nx-float-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            background: #af9159;
            color: #000;
            border: 2px solid #000;
            padding: 12px 20px;
            border-radius: 50px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            font-family: sans-serif;
            transition: all 0.3s ease;
        }
        .nx-float-btn:hover {
            background: #967d4c;
            transform: scale(1.05);
        }
        .nx-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.85);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-family: sans-serif;
        }
        .nx-window {
            background: #1a1a1a;
            border: 1px solid #333;
            width: 900px;
            max-width: 90vw;
            height: 650px;
            max-height: 90vh;
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .nx-header {
            padding: 15px 20px;
            border-bottom: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .nx-header-title {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .nx-header-main {
            margin: 0;
            color: #af9159;
            font-size: 20px;
        }
        .nx-header-author {
            font-size: 11px;
            color: #888;
        }
        .nx-header-author a {
            color: #af9159;
            text-decoration: none;
            transition: color 0.2s;
        }
        .nx-header-author a:hover {
            color: #967d4c;
            text-decoration: underline;
        }
        .nx-main {
            display: flex;
            flex: 1;
            overflow: hidden;
        }
        .nx-sidebar {
            width: 230px;
            min-width: 200px;
            background: #151515;
            border-right: 1px solid #333;
            padding: 15px;
            overflow-y: auto;
        }
        .nx-folder-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 5px;
            cursor: pointer;
            background: #222;
            border-left: 3px solid transparent;
            transition: all 0.2s ease;
        }
        .nx-folder-item:hover {
            background: #2a2a2a;
        }
        .nx-folder-item.active {
            border-left-color: #af9159;
            background: #2a2a2a;
        }
        .nx-content {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            background: #111;
        }
        .nx-card {
            background: #1d1d1d;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            border-left: 4px solid #af9159;
        }
        .nx-badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 3px;
            margin-right: 5px;
            background: #333;
            color: #aaa;
            border: 1px solid #444;
            display: inline-block;
        }
        .nx-badge.gold {
            border-color: #af9159;
            color: #af9159;
        }
        .nx-btn-main {
            background: #af9159;
            color: #000;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s;
        }
        .nx-btn-main:hover {
            background: #967d4c;
        }
        .nx-input {
            width: 100%;
            padding: 10px;
            background: #222;
            border: 1px solid #444;
            color: #fff;
            margin: 15px 0;
            border-radius: 4px;
            box-sizing: border-box;
        }
        .nx-tgl-group {
            display: flex;
            gap: 5px;
            margin-bottom: 15px;
        }
        .nx-tgl-btn {
            flex: 1;
            padding: 8px;
            background: #222;
            border: 1px solid #444;
            color: #777;
            border-radius: 4px;
            cursor: pointer;
            text-align: center;
            font-size: 11px;
            transition: all 0.2s;
        }
        .nx-tgl-btn:hover {
            border-color: #666;
        }
        .nx-tgl-btn.active {
            border-color: #af9159;
            color: #af9159;
            background: #2a2319;
        }
        .btn-small {
            background: #444;
            color: #fff;
            border: none;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            transition: background 0.2s;
        }
        .btn-small:hover {
            background: #555;
        }
        .nx-custom-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.85);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .nx-custom-dialog {
            background: #1a1a1a;
            border: 1px solid #af9159;
            border-radius: 10px;
            padding: 25px;
            min-width: 300px;
            max-width: 500px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .nx-custom-dialog h3 {
            margin-top: 0;
            color: #af9159;
            margin-bottom: 20px;
        }
        .nx-custom-dialog p {
            margin: 15px 0;
            color: #ccc;
        }
        .nx-dialog-buttons {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 25px;
        }
        .nx-dialog-input {
            width: 100%;
            padding: 10px;
            background: #222;
            border: 1px solid #444;
            color: #fff;
            border-radius: 4px;
            margin-bottom: 15px;
            box-sizing: border-box;
        }
        .nx-templates-dropdown {
            position: relative;
            display: inline-block;
        }
        .nx-templates-btn {
            background: #af9159;
            color: #000;
            border: 2px solid #000;
            padding: 8px 16px;
            border-radius: 30px;
            margin-right: 12px;
            font-weight: bold;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 14px;
            transition: all 0.2s;
        }
        .nx-templates-btn:hover {
            background: #967d4c;
        }
        .nx-templates-menu {
            position: absolute;
            bottom: 100%;
            right: 0;
            margin-bottom: 5px;
            background: #1a1a1a;
            border: 1px solid #af9159;
            border-radius: 8px;
            min-width: 200px;
            max-width: 300px;
            max-height: 400px;
            overflow-y: auto;
            z-index: 10002;
            display: none;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        }
        .nx-templates-menu.show {
            display: block;
        }
        .nx-template-item {
            padding: 10px 15px;
            cursor: pointer;
            color: #ccc;
            border-bottom: 1px solid #222;
            transition: background 0.2s;
            font-size: 13px;
        }
        .nx-template-item:hover {
            background: #2a2a2a;
            color: #af9159;
        }
        .nx-template-item:last-child {
            border-bottom: none;
        }
        .nx-folder-header {
            padding: 8px 15px;
            color: #af9159;
            font-weight: bold;
            font-size: 12px;
            border-bottom: 1px solid #333;
            background: #151515;
        }
        .nx-status-indicator {
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border-radius: 6px;
            margin-right: 12px;
            transition: all 0.3s ease;
            background: #222;
            border: 1px solid #333;
            color: #555;
        }
        .nx-status-indicator.active {
            background: rgba(175, 145, 89, 0.1);
            border-color: #af9159;
            color: #af9159;
            box-shadow: 0 0 12px rgba(175, 145, 89, 0.4);
        }
        .nx-status-indicator svg {
            width: 18px;
            height: 18px;
        }
        
        .nx-share-btn {
            background: transparent;
            border: 1px solid #af9159;
            color: #af9159;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            text-transform: uppercase;
            font-weight: bold;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .nx-share-btn:hover {
            background: rgba(175, 145, 89, 0.1);
        }

        .nx-nav {
            display: flex;
            justify-content: center;
            gap: 15px;
            padding: 10px;
            background: #151515;
            border-bottom: 1px solid #333;
        }
        .nx-nav-btn {
            background: transparent;
            color: #888;
            border: none;
            padding: 8px 15px;
            cursor: pointer;
            font-weight: bold;
            font-size: 14px;
            transition: all 0.2s;
            border-bottom: 2px solid transparent;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .nx-nav-btn:hover {
            color: #af9159;
        }
        .nx-nav-btn.active {
            color: #af9159;
            border-bottom-color: #af9159;
        }
        .nx-info-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            background: #af9159;
            color: #000;
            border-radius: 50%;
            font-size: 11px;
            font-weight: bold;
            cursor: help;
            margin-left: 8px;
            vertical-align: middle;
        }
        .nx-btn-appoint {
            width: 100%;
            padding: 12px;
            background: #28a745;
            color: #fff;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            font-size: 16px;
            margin-top: 20px;
            transition: background 0.2s;
        }
        .nx-btn-appoint:hover {
            background: #218838;
        }
        .nx-btn-appoint:disabled {
            background: #555;
            cursor: not-allowed;
        }
        .u-scrollButtons {
            bottom: 80px !important;
        }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    function save() {
        localStorage.setItem('nexus_v17_db', JSON.stringify(db));
    }

    function showCustomDialog(options) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'nx-custom-modal';

            let content = '';

            if (options.type === 'confirm') {
                content = `
                    <div class="nx-custom-dialog">
                        <h3>${options.title || 'Подтверждение'}</h3>
                        <p>${options.message}</p>
                        <div class="nx-dialog-buttons">
                            <button class="btn-small" id="nx-dialog-cancel">Отмена</button>
                            <button class="nx-btn-main" id="nx-dialog-ok">ОК</button>
                        </div>
                    </div>
                `;
            } else if (options.type === 'prompt') {
                content = `
                    <div class="nx-custom-dialog">
                        <h3>${options.title || 'Ввод'}</h3>
                        <p>${options.message}</p>
                        <input type="text" class="nx-dialog-input" id="nx-dialog-input"
                               value="${options.defaultValue || ''}"
                               placeholder="${options.placeholder || ''}"
                               autocomplete="off">
                        <div class="nx-dialog-buttons">
                            <button class="btn-small" id="nx-dialog-cancel">Отмена</button>
                            <button class="nx-btn-main" id="nx-dialog-ok">ОК</button>
                        </div>
                    </div>
                `;
            } else if (options.type === 'code') {
                content = `
                    <div class="nx-custom-dialog">
                        <h3>${options.title || 'Код'}</h3>
                        <p>${options.message}</p>
                        <div style="position: relative; margin-bottom: 20px; display: flex; align-items: center;">
                            <input type="text" class="nx-dialog-input" id="nx-dialog-input"
                                   value="${options.defaultValue || ''}"
                                   readonly
                                   style="width: 100%; cursor: default; background: rgba(0,0,0,0.2); padding: 12px 45px 12px 15px; border: 1px solid rgba(175, 145, 89, 0.2); border-radius: 8px; font-family: monospace; font-size: 16px; letter-spacing: 1px; color: #af9159; margin: 0;">
                            <div id="nx-dialog-copy" title="Копировать" style="
                                position: absolute;
                                right: 8px;
                                cursor: pointer;
                                width: 32px;
                                height: 32px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                border-radius: 6px;
                                transition: all 0.2s ease;
                                background: rgba(175, 145, 89, 0.1);
                            " onmouseover="this.style.background='rgba(175, 145, 89, 0.2)'" onmouseout="this.style.background='rgba(175, 145, 89, 0.1)'">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#af9159" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </div>
                        </div>
                        <div class="nx-dialog-buttons">
                            <button class="nx-btn-main" id="nx-dialog-ok">ОК</button>
                        </div>
                    </div>
                `;
            } else if (options.type === 'alert') {
                content = `
                    <div class="nx-custom-dialog">
                        <h3>${options.title || 'Сообщение'}</h3>
                        <p>${options.message}</p>
                        <div class="nx-dialog-buttons">
                            <button class="nx-btn-main" id="nx-dialog-ok">ОК</button>
                        </div>
                    </div>
                `;
            }

            modal.innerHTML = content;
            document.body.appendChild(modal);

            const okBtn = modal.querySelector('#nx-dialog-ok');
            const cancelBtn = modal.querySelector('#nx-dialog-cancel');
            const copyBtn = modal.querySelector('#nx-dialog-copy');
            const input = modal.querySelector('#nx-dialog-input');

            if (input && options.type !== 'code') input.focus();

            if (copyBtn && input) {
                copyBtn.onclick = () => {
                    input.select();
                    document.execCommand('copy');
                    
                    const svg = copyBtn.querySelector('svg');
                    const originalStroke = svg.getAttribute('stroke');
                    
                    svg.setAttribute('stroke', '#28a745');
                    copyBtn.style.background = 'rgba(40, 167, 69, 0.1)';
                    
                    setTimeout(() => {
                        svg.setAttribute('stroke', originalStroke);
                        copyBtn.style.background = '';
                    }, 2000);
                };
            }

            const close = (result) => {
                modal.remove();
                resolve(result);
            };

            okBtn.onclick = () => {
                if (options.type === 'prompt') {
                    close(input.value.trim());
                } else {
                    close(true);
                }
            };

            if (cancelBtn) {
                cancelBtn.onclick = () => close(false);
            }

            modal.onclick = (e) => {
                if (e.target === modal) close(false);
            };

            modal.onkeydown = (e) => {
                if (e.key === 'Escape') close(false);
                if (e.key === 'Enter' && okBtn) okBtn.click();
            };
        });
    }

    function getThreadId() {
        const canonical = document.querySelector('link[rel="canonical"]')?.href;
        if (canonical) {
            const match = canonical.match(/threads\/.*?\.(\d+)\//) || canonical.match(/threads\/(\d+)\//);
            if (match) return match[1];
        }

        if (window.XF?.config?.page?.contentId) return String(window.XF.config.page.contentId);

        const urlMatch = window.location.pathname.match(/threads\/.*?\.(\d+)\//) || window.location.pathname.match(/threads\/(\d+)\//);
        return urlMatch ? urlMatch[1] : null;
    }

    function getCsrfToken() {
        const tokenSelectors = [
            'input[name="_xfToken"]',
            'meta[name="csrf-token"]',
            '[data-csrf]'
        ];

        for (let selector of tokenSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                const value = element.value || element.getAttribute('content') || element.getAttribute('data-csrf');
                if (value) return value;
            }
        }

        if (window.XF && window.XF.config && window.XF.config.csrf) {
            return window.XF.config.csrf;
        }

        return null;
    }

    async function getCleanTitle(threadId = null) {
        return new Promise(async (resolve) => {
            const targetThreadId = threadId || getThreadId();

            if (targetThreadId) {
                try {
                    const response = await fetch(`/threads/${targetThreadId}/edit`, {
                        method: 'GET',
                        credentials: 'same-origin'
                    });

                    if (response.ok) {
                        const html = await response.text();
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');

                        const titleInput = doc.querySelector('input[name="title"]');
                        if (titleInput && titleInput.value) {
                            resolve(titleInput.value.trim() || 'Тема');
                            return;
                        }
                    }
                } catch (e) {
                }
            }

            const titleElement = document.querySelector('.p-title-value') ||
                                document.querySelector('.thread-title h1') ||
                                document.querySelector('h1');

            if (titleElement) {
                const dataTitle = titleElement.getAttribute('data-title') ||
                                titleElement.getAttribute('data-original-title');

                if (dataTitle && dataTitle.trim()) {
                    resolve(dataTitle.trim() || 'Тема');
                    return;
                }

                const prefixes = [
                    'Одобрено', 'Отказано', 'На рассмотрении', 'Рассмотрено',
                    'Актуальное', 'В архиве', 'Северный округ', 'Москва',
                    'Южный округ', 'Восточный округ', 'Западный округ',
                    'Приморский округ', 'Федеральный округ', 'Chandler',
                    'Информация', 'Важно', 'Чёрный список', 'Черный список'
                ];

                const clone = titleElement.cloneNode(true);
                Array.from(clone.children).forEach(child => {
                    if (prefixes.some(p => child.textContent.trim() === p)) {
                        child.remove();
                    }
                });

                let title = clone.textContent.trim();

                title = title.replace(/^[✅❌🔴📌📁🛡️🏙️⏳]\s*/g, '');

                for (const prefix of prefixes) {
                    const regex = new RegExp(`^${prefix}\\s*`, 'i');
                    title = title.replace(regex, '');
                }

                const numberMatch = title.match(/^(\d+)\s+/);
                if (numberMatch) {
                    title = numberMatch[1];
                }

                title = title.trim();

                resolve(title || 'Тема');
                return;
            }

            resolve('Тема');
        });
    }

    async function getMessageContent(threadId = null) {
        return new Promise(async (resolve) => {
            const targetThreadId = threadId || getThreadId();
            const currentThreadId = getThreadId();

            if (targetThreadId && targetThreadId !== currentThreadId) {
                try {
                    const response = await fetch(`/threads/${targetThreadId}/`, {
                        method: 'GET',
                        credentials: 'same-origin'
                    });
                    if (response.ok) {
                        const html = await response.text();
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');
                        const element = doc.querySelector('.message:first-child .bbWrapper') ||
                                      doc.querySelector('.js-post:first-child .message-content');
                        if (element) {
                            resolve(element.innerHTML);
                            return;
                        }
                    }
                } catch (e) {
                    console.error('NexusScript: Error fetching message content:', e);
                }
            }

            const element = document.querySelector('.message:first-child .bbWrapper') ||
                document.querySelector('.js-post:first-child .message-content');

            resolve(element ? element.innerHTML : '<p></p>');
        });
    }

    async function changeThreadPrefix(prefixId, threadId = null, closeThread = false) {
        const targetThreadId = threadId || getThreadId();
        if (!targetThreadId) return false;

        const csrfToken = getCsrfToken();
        if (!csrfToken) return false;

        const cleanTitle = await getCleanTitle(targetThreadId);
        const messageContent = await getMessageContent(targetThreadId);

        const formData = new FormData();
        formData.append('_xfToken', csrfToken);
        formData.append('_xfResponseType', 'json');
        formData.append('_xfRequestUri', `/threads/${targetThreadId}/edit`);
        formData.append('prefix_id', prefixId);
        formData.append('prefix_id[]', prefixId);
        formData.append('title', cleanTitle);
        formData.append('message_html', messageContent);
        formData.append('_xfSet[message_html]', '1');
        
        const discussionOpen = closeThread ? '0' : '1';
        formData.append('discussion_open', discussionOpen);
        formData.append('_xfSet[discussion_open]', '1');
        
        formData.append('discussion_type', 'discussion');
        formData.append('_xfSet[prefix_id]', '1');

        const url = `/threads/${targetThreadId}/edit`;
        const params = new URLSearchParams();
        for (let [key, value] of formData.entries()) {
            params.append(key, value);
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: params.toString(),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            });

            if (response.ok) {
                const result = await response.json().catch(() => ({}));
                return result.status === 'ok' || !result.errors;
            }
            return false;
        } catch (error) {
            console.error('Ошибка сети:', error);
            return false;
        }
    }

    function isThreadLockedXF() {
        const lockedTextElements = document.querySelectorAll('*');
        for (let el of lockedTextElements) {
            if (el.textContent &&
                (el.textContent.includes('В этой теме нельзя размещать новые ответы') ||
                 el.textContent.includes('Эта тема закрыта'))) {
                return true;
            }
        }

        if (document.querySelector('a[href*="unlock"], button[href*="unlock"], [data-xf-click*="unlock"]')) {
            return true;
        }

        const quickReply = document.querySelector('.js-quickReply, form[action*="add-reply"], .quick-reply');
        if (!quickReply) return true;

        if (document.querySelector(".structItem-status--locked, .thread-status--locked, .fa-lock, .js-threadLock")) {
            return true;
        }

        return false;
    }

    function isThreadStickyXF() {
        const stickLink = document.querySelector('a[href*="quick-stick"]');
        if (stickLink) {
            const linkText = stickLink.textContent || '';
            const linkTextLower = linkText.toLowerCase().trim();

            if (linkTextLower.includes('откр')) {
                return true;
            }
            if (linkTextLower.includes('закр')) {
                return false;
            }
        }

        return false;
    }

    async function checkThreadStatus() {
        const threadId = getThreadId();
        if (!threadId) {
            return {
                closed: isThreadLockedXF(),
                sticky: isThreadStickyXF()
            };
        }

        try {
            const response = await fetch(`/threads/${threadId}/`, {
                method: 'GET',
                credentials: 'same-origin'
            });

            if (response.ok) {
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                let isClosed = false;

                const elements = doc.querySelectorAll('*');
                for (let el of elements) {
                    if (el.textContent &&
                        (el.textContent.includes('В этой теме нельзя размещать новые ответы') ||
                         el.textContent.includes('Эта тема закрыта'))) {
                        isClosed = true;
                        break;
                    }
                }

                if (!isClosed) {
                    isClosed = doc.querySelector('a[href*="unlock"], [class*="locked"], [class*="Locked"], .fa-lock, .js-threadLock') !== null;
                }

                const stickLink = doc.querySelector('a[href*="quick-stick"]');
                let isSticky = false;

                if (stickLink) {
                    const linkText = (stickLink.textContent || '').toLowerCase().trim();
                    if (linkText.includes('откр')) {
                        isSticky = true;
                    }
                }

                return {
                    closed: isClosed,
                    sticky: isSticky
                };
            }
        } catch (e) {
            console.error('Ошибка при проверке статуса темы:', e);
        }

        return {
            closed: isThreadLockedXF(),
            sticky: isThreadStickyXF()
        };
    }

    async function applyTemplateActions(template) {
        if (!template) return false;

        const threadId = getThreadId();
        if (!threadId) return false;

        let needReload = false;

        if (template.prefix && template.prefix !== "0") {
            const prefixChanged = await changeThreadPrefix(template.prefix);
            if (prefixChanged) {
                needReload = true;
            }
        }

        if (template.close !== 'none') {
            const currentStatus = await checkThreadStatus();
            const shouldLock = template.close === 'close';

            if ((shouldLock && !currentStatus.closed) || (!shouldLock && currentStatus.closed)) {
                const xfToken = getCsrfToken();
                if (xfToken) {
                    const endpoint = `/threads/${threadId}/quick-close`;
                    const formData = new URLSearchParams();

                    formData.append('_xfToken', xfToken);
                    formData.append('_xfResponseType', 'json');
                    formData.append('_xfRequestUri', `/threads/${threadId}/`);
                    formData.append('lock', shouldLock ? '1' : '0');

                    try {
                        const response = await fetch(endpoint, {
                            method: 'POST',
                            body: formData,
                            headers: {
                                'X-Requested-With': 'XMLHttpRequest',
                                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                            },
                            credentials: 'same-origin'
                        });

                        if (response.ok) {
                            needReload = true;
                        }
                    } catch (e) {
                        console.error('Ошибка при изменении статуса темы:', e);
                    }
                }
            }
        }

        if (template.pin !== 'none') {
            const currentStatus = await checkThreadStatus();
            const shouldSticky = template.pin === 'pin';

            if ((shouldSticky && !currentStatus.sticky) || (!shouldSticky && currentStatus.sticky)) {
                const xfToken = getCsrfToken();
                if (xfToken) {
                    const endpoint = `/threads/${threadId}/quick-stick`;
                    const formData = new URLSearchParams();

                    formData.append('_xfToken', xfToken);
                    formData.append('_xfResponseType', 'json');
                    formData.append('_xfRequestUri', `/threads/${threadId}/`);
                    formData.append('sticky', shouldSticky ? '1' : '0');

                    try {
                        const response = await fetch(endpoint, {
                            method: 'POST',
                            body: formData,
                            headers: {
                                'X-Requested-With': 'XMLHttpRequest',
                                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                            },
                            credentials: 'same-origin'
                        });

                        if (response.ok) {
                            needReload = true;
                        }
                    } catch (e) {
                        console.error('Ошибка при закреплении темы:', e);
                    }
                }
            }
        }

        return needReload;
    }

    function applyPrefixInReplyForm(prefixId) {
        if (!prefixId || prefixId === "0") return false;

        const select2Element = document.querySelector('select.js-prefixSelect, select[name="prefix_id[]"], select[name="prefix_id"]');

        if (select2Element) {
            const optionExists = Array.from(select2Element.options).some(opt => opt.value === prefixId);
            if (!optionExists) return false;

            if (window.jQuery && window.jQuery(select2Element).data('select2')) {
                try {
                    const $select = window.jQuery(select2Element);
                    if (select2Element.multiple) {
                        $select.val([prefixId]).trigger('change');
                    } else {
                        $select.val(prefixId).trigger('change');
                    }
                    return true;
                } catch (e) {
                    console.error('Ошибка Select2:', e);
                }
            }

            if (select2Element.multiple) {
                Array.from(select2Element.options).forEach(opt => {
                    opt.selected = (opt.value === prefixId);
                });
            } else {
                select2Element.value = prefixId;
            }

            const events = ['change', 'input'];
            events.forEach(eventName => {
                select2Element.dispatchEvent(new Event(eventName, { bubbles: true }));
            });

            return true;
        }

        return false;
    }

    function setupTemplateHandler() {
        let activeTemplate = null;

        document.addEventListener('click', async function(e) {
            const submitBtn = e.target.closest('button[type="submit"].button--primary');

            if (submitBtn && activeTemplate) {
                e.preventDefault();
                e.stopPropagation();

                await applyTemplateActions(activeTemplate);

                const form = submitBtn.closest('form');
                if (form) {
                    form.submit();
                }

                await new Promise(resolve => setTimeout(resolve, 3000));
                window.location.reload();

                activeTemplate = null;
            }
        }, true);

        window.setActiveTemplate = (template) => {
            activeTemplate = template;
        };
    }

    function createTemplatesDropdown() {
        const replyButton = document.querySelector('button[type="submit"].button--primary.button--icon--reply');
        if (!replyButton) return;

        if (document.querySelector('.nx-templates-dropdown')) return;

        const buttonContainer = replyButton.parentElement;
        if (!buttonContainer) return;

        const dropdown = document.createElement('div');
        dropdown.className = 'nx-templates-dropdown';
        
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'nx-templates-btn';
        button.innerHTML = '<span>▼</span> <span>Шаблоны</span>';
        
        const menu = document.createElement('div');
        menu.className = 'nx-templates-menu';
        
        function renderTemplatesMenu() {
            menu.innerHTML = '';

            if (db.folders.length === 0) {
                const emptyItem = document.createElement('div');
                emptyItem.className = 'nx-template-item';
                emptyItem.textContent = 'Шаблонов нет';
                emptyItem.style.color = '#666';
                emptyItem.style.cursor = 'default';
                menu.appendChild(emptyItem);
                return;
            }

            let hasTemplates = false;
            db.folders.forEach(folder => {
                if (folder.templates.length === 0) return;

                hasTemplates = true;

                const folderHeader = document.createElement('div');
                folderHeader.className = 'nx-folder-header';
                folderHeader.textContent = folder.name;
                menu.appendChild(folderHeader);

                folder.templates.forEach(template => {
                    const item = document.createElement('div');
                    item.className = 'nx-template-item';
                    item.textContent = template.name;
                    item.onclick = () => {
                        const editor = document.querySelector('.fr-element.fr-view') ||
                                      document.querySelector('.js-editor') ||
                                      document.querySelector('textarea[name="message"]');

                        if (editor) {
                            if (editor.tagName === 'TEXTAREA') {
                                editor.value = editor.value + template.text;
                                editor.dispatchEvent(new Event('input', { bubbles: true }));
                            } else {
                                editor.focus();
                                editor.innerHTML = editor.innerHTML + template.text.replace(/\n/g, '<br>');
                            }
                        }

                        window.setActiveTemplate(template);

                        const modal = document.getElementById('nx-modal-v17');
                        if (modal) {
                            modal.remove();
                            createFloatButton();
                        }

                        menu.classList.remove('show');
                    };
                    menu.appendChild(item);
                });
            });

            if (!hasTemplates) {
                const emptyItem = document.createElement('div');
                emptyItem.className = 'nx-template-item';
                emptyItem.textContent = 'Шаблонов нет';
                emptyItem.style.color = '#666';
                emptyItem.style.cursor = 'default';
                menu.appendChild(emptyItem);
            }
        }

        renderTemplatesMenu();

        button.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            menu.classList.toggle('show');
        };

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                menu.classList.remove('show');
            }
        });

        dropdown.appendChild(button);
        dropdown.appendChild(menu);

        buttonContainer.insertBefore(dropdown, replyButton);
    }

    function renderFolders() {
        const list = document.getElementById('f-list-v17');
        if(!list) return;

        list.innerHTML = '';
        db.folders.forEach((f, idx) => {
            const item = document.createElement('div');
            item.className = `nx-folder-item ${db.activeFolderId === f.id ? 'active' : ''}`;

            let controls = '';
            if (idx !== 0) {
                controls = `
                    <div style="display:flex;gap:5px;">
                        <button class="btn-small ed-f" title="Переименовать">✏️</button>
                        <button class="btn-small de-f" title="Удалить">🗑️</button>
                    </div>
                `;
            }

            item.innerHTML = `
                <span style="display:flex;align-items:center;gap:8px;">
                    <span>📁</span>
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.name}</span>
                </span>
                ${controls}
            `;

            item.onclick = async (e) => {
                if (!e.target.closest('.btn-small')) {
                    db.activeFolderId = f.id;
                    save();
                    renderFolders();
                    renderTemplates();
                }
            };

            if (idx !== 0) {
                item.querySelector('.de-f').onclick = async (e) => {
                    e.stopPropagation();
                    const confirmed = await showCustomDialog({
                        type: 'confirm',
                        title: 'Удаление папки',
                        message: `Удалить папку "${f.name}"? Все шаблоны в ней будут потеряны.`
                    });

                    if (confirmed) {
                        db.folders = db.folders.filter(x => x.id !== f.id);
                        db.activeFolderId = db.folders[0].id;
                        save();
                        renderFolders();
                        renderTemplates();
                    }
                };

                item.querySelector('.ed-f').onclick = async (e) => {
                    e.stopPropagation();
                    const newName = await showCustomDialog({
                        type: 'prompt',
                        title: 'Переименование папки',
                        message: 'Введите новое имя папки:',
                        defaultValue: f.name,
                        placeholder: 'Новое имя папки'
                    });

                    if (newName && newName.trim()) {
                        f.name = newName.trim();
                        save();
                        renderFolders();
                    }
                };
            }

            list.appendChild(item);
        });
    }

    function getPrefixName(prefixId) {
        const prefixes = {
            "0": "Не менять",
            "2": "Рассмотрено",
            "3": "На рассмотрении",
            "4": "Южный округ",
            "5": "Восточный округ",
            "6": "Западный округ",
            "7": "Отказано",
            "8": "Информация",
            "9": "Одобрено",
            "10": "Чёрный список",
            "11": "Приморский округ",
            "13": "Федеральный округ",
            "14": "Актуальное",
            "16": "В архиве",
            "18": "Chandler",
            "19": "Важно",
            "20": "Северный округ",
            "21": "Москва"
        };
        return prefixes[prefixId] || `ID: ${prefixId}`;
    }

    function renderTemplates() {
        const list = document.getElementById('t-list-v17');
        if(!list) return;

        list.innerHTML = '';
        const folder = db.folders.find(f => f.id === db.activeFolderId);
        if(!folder) return;

        if (folder.templates.length === 0) {
            list.innerHTML = `
                <div style="text-align:center;padding:40px;color:#666;">
                    <div style="font-size:48px;margin-bottom:20px;">📝</div>
                    <h3 style="color:#888;margin-bottom:10px;">Шаблонов нет</h3>
                    <p style="color:#666;">Нажмите "Создать" чтобы добавить первый шаблон</p>
                </div>
            `;
            return;
        }

        folder.templates.forEach((t, i) => {
            const card = document.createElement('div');
            card.className = 'nx-card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <b style="color:#af9159;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.name}</b>
                    <div style="display:flex; gap:8px;flex-shrink:0;">
                        <button class="nx-btn-main btn-ins" style="padding:5px 15px; font-size:12px">ВСТАВИТЬ</button>
                        <button class="btn-small btn-edit-t" title="Редактировать шаблон">✏️</button>
                        <button class="btn-small btn-del-t" title="Удалить шаблон">🗑️</button>
                    </div>
                </div>
                <div style="margin-top:10px;font-size:12px;color:#aaa;">
                    ${t.text.length > 100 ? t.text.substring(0, 100) + '...' : t.text}
                </div>
                <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:5px;">
                    <span class="nx-badge">Префикс: ${getPrefixName(t.prefix)}</span>
                    ${t.close !== 'none' ? `<span class="nx-badge gold">${t.close==='close'?'Закрыть':'Открыть'}</span>`:''}
                    ${t.pin !== 'none' ? `<span class="nx-badge gold">${t.pin==='pin'?'Закрепить':'Открепить'}</span>`:''}
                </div>
            `;

            card.querySelector('.btn-ins').onclick = () => {
                const editor = document.querySelector('.fr-element.fr-view') ||
                              document.querySelector('.js-editor') ||
                              document.querySelector('textarea[name="message"]');

                if (editor) {
                    if (editor.tagName === 'TEXTAREA') {
                        editor.value = editor.value + t.text;
                        editor.dispatchEvent(new Event('input', { bubbles: true }));
                    } else {
                        editor.focus();
                        editor.innerHTML = editor.innerHTML + t.text.replace(/\n/g, '<br>');
                    }
                }

                window.setActiveTemplate(t);

                const modal = document.getElementById('nx-modal-v17');
                if (modal) {
                    modal.remove();
                    createFloatButton();
                }
            };

            card.querySelector('.btn-edit-t').onclick = async (e) => {
                e.stopPropagation();
                await showTemplateEditor(t, i);
            };

            card.querySelector('.btn-del-t').onclick = async (e) => {
                e.stopPropagation();
                const confirmed = await showCustomDialog({
                    type: 'confirm',
                    title: 'Удаление шаблона',
                    message: `Удалить шаблон "${t.name}"?`
                });

                if (confirmed) {
                    folder.templates.splice(i, 1);
                    save();
                    renderTemplates();
                }
            };

            list.appendChild(card);
        });
    }

    async function showTemplateEditor(template = null, index = -1) {
        const isEdit = template !== null;

        const editModal = document.createElement('div');
        editModal.className = 'nx-custom-modal';

        let closeStatus = template?.close || 'none';
        let pinStatus = template?.pin || 'none';
        let prefixValue = template?.prefix || "0";

        editModal.innerHTML = `
            <div class="nx-custom-dialog" style="width: 550px;">
                <h3>${isEdit ? 'Редактирование' : 'Новый'} шаблон</h3>

                <input type="text" id="in-n" placeholder="Название шаблона"
                       class="nx-dialog-input" value="${template?.name || ''}" autocomplete="off">

                <textarea id="in-t" placeholder="Текст шаблона..."
                          class="nx-dialog-input" style="height:150px;resize:vertical;"
                          autocomplete="off">${template?.text || ''}</textarea>

                <label style="color:#aaa;font-size:12px;margin-bottom:5px;display:block;">Префикс темы:</label>
                <select id="in-p" class="nx-dialog-input" style="margin-bottom:20px;">
                    <option value="0" ${prefixValue === "0" ? 'selected' : ''}>Не менять префикс</option>
                    <optgroup label="Для жалоб">
                        <option value="3" ${prefixValue === "3" ? 'selected' : ''}>На рассмотрении</option>
                        <option value="7" ${prefixValue === "7" ? 'selected' : ''}>Отказано</option>
                        <option value="9" ${prefixValue === "9" ? 'selected' : ''}>Одобрено</option>
                        <option value="2" ${prefixValue === "2" ? 'selected' : ''}>Рассмотрено</option>
                    </optgroup>
                    <optgroup label="Для серверов">
                        <option value="4" ${prefixValue === "4" ? 'selected' : ''}>Южный округ</option>
                        <option value="20" ${prefixValue === "20" ? 'selected' : ''}>Северный округ</option>
                        <option value="5" ${prefixValue === "5" ? 'selected' : ''}>Восточный округ</option>
                        <option value="6" ${prefixValue === "6" ? 'selected' : ''}>Западный округ</option>
                        <option value="11" ${prefixValue === "11" ? 'selected' : ''}>Приморский округ</option>
                        <option value="13" ${prefixValue === "13" ? 'selected' : ''}>Федеральный округ</option>
                        <option value="21" ${prefixValue === "21" ? 'selected' : ''}>Москва</option>
                        <option value="18" ${prefixValue === "18" ? 'selected' : ''}>Chandler</option>
                    </optgroup>
                    <optgroup label="Досье модераторов">
                        <option value="14" ${prefixValue === "14" ? 'selected' : ''}>Актуальное</option>
                        <option value="16" ${prefixValue === "16" ? 'selected' : ''}>В архиве</option>
                    </optgroup>
                    <optgroup label="Прочее">
                        <option value="8" ${prefixValue === "8" ? 'selected' : ''}>Информация</option>
                        <option value="19" ${prefixValue === "19" ? 'selected' : ''}>Важно</option>
                        <option value="10" ${prefixValue === "10" ? 'selected' : ''}>Чёрный список</option>
                    </optgroup>
                </select>

                <label style="color:#aaa;font-size:12px;margin-bottom:5px;display:block;">Статус темы:</label>
                <div class="nx-tgl-group">
                    <div class="nx-tgl-btn ${closeStatus === 'none' ? 'active' : ''}" id="ts-n">Не менять статус</div>
                    <div class="nx-tgl-btn ${closeStatus === 'close' ? 'active' : ''}" id="ts-c">Закрыть</div>
                    <div class="nx-tgl-btn ${closeStatus === 'open' ? 'active' : ''}" id="ts-o">Открыть</div>
                </div>

                <label style="color:#aaa;font-size:12px;margin-bottom:5px;display:block;">Закрепление:</label>
                <div class="nx-tgl-group">
                    <div class="nx-tgl-btn ${pinStatus === 'none' ? 'active' : ''}" id="tp-n">Не менять замок</div>
                    <div class="nx-tgl-btn ${pinStatus === 'pin' ? 'active' : ''}" id="tp-p">Закрепить</div>
                    <div class="nx-tgl-btn ${pinStatus === 'unpin' ? 'active' : ''}" id="tp-u">Открепить</div>
                </div>

                <div class="nx-dialog-buttons">
                    <button class="btn-small" id="ed-cancel">Отмена</button>
                    ${isEdit ? '<button class="btn-small" id="ed-export" style="background: rgba(175, 145, 89, 0.1); color: #af9159; border: 1px solid rgba(175, 145, 89, 0.3);">Поделиться</button>' : ''}
                    <button class="nx-btn-main" id="sv-t">${isEdit ? 'Сохранить' : 'Создать'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(editModal);

        const setupToggle = (ids, type) => {
            ids.forEach(id => {
                const btn = document.getElementById(id);
                btn.onclick = function() {
                    ids.forEach(x => document.getElementById(x).classList.remove('active'));
                    this.classList.add('active');

                    if (type === 'close') {
                        closeStatus = id.split('-')[1] === 'n' ? 'none' :
                                     (id.split('-')[1] === 'c' ? 'close' : 'open');
                    } else if (type === 'pin') {
                        pinStatus = id.split('-')[1] === 'n' ? 'none' :
                                   (id.split('-')[1] === 'p' ? 'pin' : 'unpin');
                    }
                };
            });
        };

        setupToggle(['ts-n', 'ts-c', 'ts-o'], 'close');
        setupToggle(['tp-n', 'tp-p', 'tp-u'], 'pin');

        document.getElementById('ed-cancel').onclick = () => editModal.remove();

        if (isEdit) {
            document.getElementById('ed-export').onclick = async () => {
                try {
                    const code = await FirebaseService.exportTemplate(template, 'regular');
                    if (!template.exportCode) {
                        template.exportCode = code;
                        save();
                    }
                    await showCustomDialog({
                        type: 'code',
                        title: 'Шаблон экспортирован',
                        message: 'Код для обмена (XXX-XXX):',
                        defaultValue: code
                    });
                } catch (err) {
                    showCustomDialog({
                        type: 'alert',
                        title: 'Ошибка',
                        message: 'Не удалось экспортировать шаблон.'
                    });
                }
            };
        }

        document.getElementById('sv-t').onclick = async () => {
            const name = document.getElementById('in-n').value.trim();
            const text = document.getElementById('in-t').value.trim();

            if (!name) {
                await showCustomDialog({
                    type: 'alert',
                    title: 'Ошибка',
                    message: 'Введите название шаблона'
                });
                return;
            }

            if (!text) {
                await showCustomDialog({
                    type: 'alert',
                    title: 'Ошибка',
                    message: 'Введите текст шаблона'
                });
                return;
            }

            const folder = db.folders.find(x => x.id === db.activeFolderId);
            const newTemplate = {
                id: template?.id || Date.now(),
                name: name,
                text: text,
                prefix: document.getElementById('in-p').value,
                close: closeStatus,
                pin: pinStatus
            };

            if (isEdit && index >= 0) {
                folder.templates[index] = newTemplate;
            } else {
                folder.templates.push(newTemplate);
            }

            save();
            renderTemplates();
            editModal.remove();
        };

        setTimeout(() => document.getElementById('in-n').focus(), 100);

        editModal.onkeydown = (e) => {
            if (e.key === 'Escape') editModal.remove();
        };
    }

    function canAccessModPanel() {
        if (hasCheckedAccess) {
            return cachedHasModAccess;
        }

        if (document.querySelector('.p-staffBar')) {
            cachedHasModAccess = true;
            hasCheckedAccess = true;
        } 
        else if (document.querySelector('.inlineModCheck, [data-xf-init="inline-mod"]')) {
            cachedHasModAccess = true;
            hasCheckedAccess = true;
        }
        else {
            const modNode = document.querySelector('.node--id21');
            const breadcrumbLink = document.querySelector('.p-breadcrumbs a[href*="/forums/21/"]');
            
            if (modNode) {
                const modLink = modNode.querySelector('a[href*="/forums/21/"]');
                if (modLink) {
                    const text = modLink.textContent.trim();
                    if (text === 'Главная Модерация' || text.includes('Главная Модерация')) {
                        cachedHasModAccess = true;
                        hasCheckedAccess = true;
                    }
                }
            } else if (breadcrumbLink) {
                cachedHasModAccess = true;
                hasCheckedAccess = true;
            }

            if (!hasCheckedAccess && !isCheckingAccess) {
                checkAccessBackground();
            }
        }

        return cachedHasModAccess;
    }

    async function checkAccessBackground() {
        if (isCheckingAccess) return;
        isCheckingAccess = true;

        try {
            const navAvatar = document.querySelector('.p-navgroup-link .avatar[data-user-id]');
            const userId = navAvatar ? navAvatar.getAttribute('data-user-id') : null;

            if (userId) {
                const response = await fetch(`/members/${userId}/`);
                if (response.ok) {
                    const html = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    
                    const banners = doc.querySelectorAll('.memberHeader-banners .userBanner');
                    for (const banner of banners) {
                        const strongText = banner.querySelector('strong')?.textContent.trim() || '';
                        if (strongText.includes('След. за Модерацией') || 
                            strongText.includes('Куратор модерации') || 
                            strongText.includes('СЗМ')) {
                            cachedHasModAccess = true;
                            break;
                        }
                    }
                }
            }
        } catch (e) {
            console.error('NexusScript: Ошибка фоновой проверки доступа', e);
        } finally {
            hasCheckedAccess = true;
            isCheckingAccess = false;
        }
    }

    setTimeout(canAccessModPanel, 200);

    async function openManager() {
        if (document.getElementById('nx-modal-v17')) return;

        if (floatBtn) {
            floatBtn.remove();
            floatBtn = null;
        }

        const overlay = document.createElement('div');
        overlay.className = 'nx-overlay';
        overlay.id = 'nx-modal-v17';

        overlay.innerHTML = `
            <div class="nx-window">
                <div class="nx-header">
                    <div style="display: flex; align-items: center;">
                        <div class="nx-status-indicator ${db.showBadges ? 'active' : ''}" id="nx-status-toggle" title="${db.showBadges ? 'Галочки включены' : 'Галочки выключены'}">
                             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                 <polyline points="20 6 9 17 4 12"></polyline>
                             </svg>
                         </div>
                        <div class="nx-header-title">
                            <h2 class="nx-header-main">📁 NexusScript</h2>
                            <div class="nx-header-author">by <a href="https://vk.com/tclaps" target="_blank">tclaps</a></div>
                        </div>
                    </div>
                    <span style="cursor:pointer; font-size:28px;color:#aaa;padding:0 10px;" id="nx-close" title="Закрыть">×</span>
                </div>
                <div class="nx-nav">
                    <button class="nx-nav-btn ${activeTab === 'templates' ? 'active' : ''}" data-tab="templates">📁 Папки шаблонов</button>
                    <button class="nx-nav-btn ${activeTab === 'modpanel' ? 'active' : ''}" data-tab="modpanel">🛡️ Панель гл. мод.</button>
                </div>
                <div class="nx-main"></div>
            </div>
        `;

        const renderTabContent = () => {
            const main = overlay.querySelector('.nx-main');
            main.innerHTML = '';
            
            overlay.querySelectorAll('.nx-nav-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === activeTab);
            });

            if (activeTab === 'templates') {
                main.innerHTML = `
                    <div class="nx-sidebar">
                        <div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center;">
                            <span style="color:#af9159; font-size:11px; font-weight:bold;text-transform:uppercase">
                                Папки
                                <span class="nx-info-icon" title="Список папок для группировки ваших шаблонов ответов">?</span>
                            </span>
                            <button id="add-f-btn" class="btn-small" style="font-size:16px;padding:2px 8px;" title="Добавить папку">+</button>
                        </div>
                        <div id="f-list-v17"></div>
                    </div>
                    <div class="nx-content">
                        <div style="display:flex; justify-content:flex-end; margin-bottom:20px; align-items:center;">
                            <button class="nx-btn-main" id="add-t-btn">+ Создать шаблон</button>
                        </div>
                        <div id="t-list-v17"></div>
                    </div>
                `;
                renderFolders();
                renderTemplates();
                
                document.getElementById('add-f-btn').onclick = async () => {
                    const name = await showCustomDialog({
                        type: 'prompt',
                        title: 'Новая папка',
                        message: 'Введите имя новой папки:',
                        placeholder: 'Имя папки'
                    });

                    if (name && name.trim()) {
                        db.folders.push({
                            id: Date.now(),
                            name: name.trim(),
                            templates: []
                        });
                        save();
                        renderFolders();
                    }
                };

                document.getElementById('add-t-btn').onclick = () => showTemplateEditor();
            } else {
                if (isCheckingAccess && !cachedHasModAccess) {
                    main.innerHTML = `
                        <div class="nx-content" style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:40px;">
                            <div class="nx-loading-spinner" style="width:50px; height:50px; border:3px solid #333; border-top-color:#af9159; border-radius:50%; animation:nx-spin 1s linear infinite; margin-bottom:20px;"></div>
                            <h3 style="color:#af9159;">Проверка доступа...</h3>
                        </div>
                        <style>@keyframes nx-spin { to { transform: rotate(360deg); } }</style>
                    `;
                    
                    setTimeout(renderTabContent, 500);
                    return;
                }

                if (canAccessModPanel()) {
                    const renderModMenu = () => {
                        main.innerHTML = `
                            <div class="nx-content" style="padding: 20px; overflow-y: auto;">
                                <h3 style="color:#af9159; margin-bottom:30px; text-align:center;">
                                    🛡️ Панель Главной Модерации
                                    <span class="nx-info-icon" title="Управление модераторами. В постановлениях можно использовать \${nick}, \${fa} и любые свои переменные \${Название} — для каждой автоматически создастся поле ввода. Поля ФА и Ник-нейм обязательны.">?</span>
                                </h3>
                                <div class="nx-mod-menu">
                                    <div class="nx-mod-card" id="btn-menu-appoint">
                                        <div style="font-size: 40px;">📜</div>
                                        <b>Постановление модератора</b>
                                        <p>Создание темы с досье и выдача покраса</p>
                                    </div>
                                    <div class="nx-mod-card" id="btn-menu-archive">
                                        <div style="font-size: 40px;">📦</div>
                                        <b>Снятие модератора</b>
                                        <p>Снятие модератора, сообщение и перенос темы</p>
                                    </div>
                                    <div class="nx-mod-card" style="opacity: 0.5; cursor: not-allowed;">
                                        <div style="font-size: 40px;">⌛</div>
                                        <b>В разработке...</b>
                                        <p>Скоро здесь появятся новые функции</p>
                                    </div>
                                </div>
                            </div>
                        `;

                        document.getElementById('btn-menu-archive').onclick = () => renderArchiveForm();
                        document.getElementById('btn-menu-appoint').onclick = () => renderAppointmentForm();
                    };

                    async function grantModeratorRole(mID, level, statusElement) {
                        try {
                            const promoUrl = `https://forum.keeper-nexus.com/promote/index?mID=${mID}`;
                            const response = await fetch(promoUrl);
                            if (!response.ok) throw new Error('Не удалось открыть страницу выдачи ролей');
                            
                            const html = await response.text();
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(html, 'text/html');
                            
                            const targetForm = doc.querySelector('form[action*="promote"], form.block'); 
                            if (!targetForm) throw new Error('Форма выдачи ролей не найдена');
                            
                            const action = targetForm.getAttribute('action');
                            const xfToken = doc.querySelector('input[name="_xfToken"]')?.value;
                            
                            const levelToName = {
                                '1': '(01) Младший Модератор',
                                '2': '(02) Модератор',
                                '3': '(03) Старший Модератор',
                                '4': '(04) Специальный Модератор'
                            };
                            const targetRoleName = levelToName[level];
                            if (!targetRoleName) return;

                            const formData = new URLSearchParams();
                            if (xfToken) formData.append('_xfToken', xfToken);
                            
                            targetForm.querySelectorAll('input[type="hidden"]').forEach(input => {
                                if (input.name !== '_xfToken') formData.append(input.name, input.value);
                            });

                            const choices = targetForm.querySelectorAll('.inputChoices-choice, li, label');
                            choices.forEach(el => {
                                const checkbox = el.querySelector('input[type="checkbox"]') || (el.tagName === 'INPUT' && el.type === 'checkbox' ? el : null);
                                if (!checkbox) return;

                                let roleName = '';
                                const labelEl = el.querySelector('.iconic-label') || el.querySelector('span') || (el.tagName === 'LABEL' ? el : el.closest('label'));
                                if (labelEl) roleName = labelEl.textContent.trim();
                                else roleName = el.textContent.trim();

                                if (!roleName || roleName.length < 2) return;

                                const cleanRoleName = roleName.replace(/\s+/g, ' ').toLowerCase();
                                const cleanTargetName = targetRoleName.replace(/\s+/g, ' ').toLowerCase();
                                
                                if (cleanRoleName.includes(cleanTargetName)) {
                                    formData.append(checkbox.name, checkbox.value);
                                } else if (checkbox.checked) {
                                    formData.append(checkbox.name, checkbox.value);
                                }
                            });

                            targetForm.querySelectorAll('select, input[type="text"], input[type="radio"]:checked').forEach(el => {
                                if (el.name && !formData.has(el.name)) formData.append(el.name, el.value);
                            });

                            const saveUrl = action.startsWith('http') ? action : `https://forum.keeper-nexus.com${action}`;
                            const saveResponse = await fetch(saveUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                body: formData
                            });

                            if (!saveResponse.ok) throw new Error('Ошибка при сохранении ролей');
                            if (statusElement) statusElement.textContent = 'Выдача ролей: успешно!';
                        } catch (err) {
                            console.error('NexusScript Role Granting Error:', err);
                            throw err;
                        }
                    }

                    async function removeModeratorRole(mID, level, isSZM, statusElement) {
                        try {
                            const promoUrl = `https://forum.keeper-nexus.com/promote/index?mID=${mID}`;
                            const response = await fetch(promoUrl);
                            if (!response.ok) throw new Error('Не удалось открыть страницу снятия ролей');
                            
                            const html = await response.text();
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(html, 'text/html');
                            
                            const targetForm = doc.querySelector('form[action*="promote"], form.block'); 
                            if (!targetForm) {
                                throw new Error('Форма снятия ролей не найдена');
                            }
                            
                            const action = targetForm.getAttribute('action');
                            const xfToken = doc.querySelector('input[name="_xfToken"]')?.value;
                            
                            const levelToName = {
                                '1': '(01) Младший Модератор',
                                '2': '(02) Модератор',
                                '3': '(03) Старший Модератор',
                                '4': isSZM ? '(04) Следящий за Модерацией' : '(04) Специальный Модератор',
                                '5': '(05) Куратор модерации',
                                '6': '(06) Заместитель ГМ',
                                '7': '(07) Главный Модератор'
                            };
                            const targetRoleName = levelToName[level];
                            
                            if (!targetRoleName) {
                                return;
                            }

                            const formData = new URLSearchParams();
                            if (xfToken) formData.append('_xfToken', xfToken);
                            
                            targetForm.querySelectorAll('input[type="hidden"]').forEach(input => {
                                if (input.name !== '_xfToken') {
                                    formData.append(input.name, input.value);
                                }
                            });

                            let found = false;
                            const choices = targetForm.querySelectorAll('.inputChoices-choice, li, label');
                            const allRoles = [];
                            
                            choices.forEach(el => {
                                const checkbox = el.querySelector('input[type="checkbox"]') || (el.tagName === 'INPUT' && el.type === 'checkbox' ? el : null);
                                if (!checkbox) return;

                                let roleName = '';
                                const labelEl = el.querySelector('.iconic-label') || el.querySelector('span') || (el.tagName === 'LABEL' ? el : el.closest('label'));
                                
                                if (labelEl) {
                                    roleName = labelEl.textContent.trim();
                                } else {
                                    roleName = el.textContent.trim();
                                }

                                if (!roleName || roleName.length < 2) return;

                                const cleanRoleName = roleName.replace(/\s+/g, ' ').toLowerCase();
                                const cleanTargetName = targetRoleName.replace(/\s+/g, ' ').toLowerCase();
                                const isTarget = cleanRoleName.includes(cleanTargetName);
                                
                                if (!allRoles.some(r => r.checkbox === checkbox)) {
                                    allRoles.push({ name: roleName, checkbox: checkbox, isTarget: isTarget });
                                    if (isTarget) found = true;
                                }
                            });

                            if (!found) {
                                targetForm.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                                    if (allRoles.some(r => r.checkbox === checkbox)) return;
                                    const label = targetForm.querySelector(`label[for="${checkbox.id}"]`) || checkbox.closest('label');
                                    if (label) {
                                        const roleName = label.textContent.trim();
                                        const cleanRoleName = roleName.replace(/\s+/g, ' ').toLowerCase();
                                        const cleanTargetName = targetRoleName.replace(/\s+/g, ' ').toLowerCase();
                                        if (cleanRoleName.includes(cleanTargetName)) {
                                            found = true;
                                            allRoles.push({ name: roleName, checkbox: checkbox, isTarget: true });
                                        }
                                    }
                                });
                            }

                            allRoles.forEach(role => {
                            if (role.checkbox.checked) {
                                    formData.append(role.checkbox.name, role.checkbox.value);
                                }
                            });

                            targetForm.querySelectorAll('select, input[type="text"], input[type="radio"]:checked').forEach(el => {
                                if (el.name && !formData.has(el.name)) {
                                    formData.append(el.name, el.value);
                                }
                            });

                            const saveUrl = action.startsWith('http') ? action : `https://forum.keeper-nexus.com${action}`;
                            const saveResponse = await fetch(saveUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                body: formData
                            });

                            if (!saveResponse.ok) throw new Error('Ошибка при сохранении ролей');
                            if (statusElement) statusElement.textContent = 'Снятие ролей: успешно!';
                        } catch (err) {
                            console.error('NexusScript Role Removal Error:', err);
                            throw err;
                        }
                    }

                    const renderArchiveForm = () => {
                        main.innerHTML = `
                            <div class="nx-content" style="padding: 25px; overflow-y: auto;">
                                <div class="nx-archive-form">
                                    <div class="nx-form-header">
                                        <h3 class="nx-form-title">🛡️ Снятие модератора</h3>
                                        <button class="nx-back-btn" id="btn-mod-back">← Назад</button>
                                    </div>
                                    
                                    <div class="nx-form-group full">
                                        <label>Сервер</label>
                                        <select class="nx-select" id="arch-server">
                                            <option value="37">Южный округ</option>
                                            <option value="294">Северный округ</option>
                                            <option value="366">Восточный округ</option>
                                            <option value="230">Западный округ</option>
                                            <option value="277">Приморский округ</option>
                                            <option value="143">Федеральный округ</option>
                                            <option value="361">Москва</option>
                                        </select>
                                    </div>
                                    
                                    <div class="nx-form-row">
                                        <div class="nx-form-group">
                                            <label>Никнейм игрока</label>
                                            <input type="text" class="nx-input" id="arch-nick" placeholder="Terry_Clapsman">
                                        </div>
                                        
                                        <div class="nx-form-group">
                                            <label>Уровень модерации</label>
                                            <input type="text" class="nx-input" id="arch-level" placeholder="1">
                                        </div>
                                    </div>
                                    
                                    <div class="nx-form-group full">
                                        <label>Ссылка на ФА</label>
                                        <input type="text" class="nx-input" id="arch-fa" placeholder="https://forum.keeper-nexus.com/members/1/">
                                    </div>

                                    <div class="nx-form-group full">
                                        <label>Причина снятия</label>
                                        <input type="text" class="nx-input" id="arch-reason" placeholder="СЖ">
                                    </div>

                                    <div class="nx-szm-check" id="szm-container">
                                        <input type="checkbox" class="nx-checkbox" id="is-szm">
                                        <label for="is-szm" class="nx-szm-label">❔ Модератор является СЗМом?</label>
                                    </div>

                                    <button class="nx-btn-archive" id="btn-start-arch">Запустить архивацию</button>
                                    
                                    <div id="arch-status" class="nx-status-msg"></div>
                                </div>
                            </div>
                        `;

                        document.getElementById('btn-mod-back').onclick = renderModMenu;

                        const levelInput = document.getElementById('arch-level');
                        const szmContainer = document.getElementById('szm-container');
                        
                        levelInput.oninput = () => {
                            if (levelInput.value.trim() === '4') {
                                szmContainer.style.display = 'flex';
                            } else {
                                szmContainer.style.display = 'none';
                                document.getElementById('is-szm').checked = false;
                            }
                        };

                        const btn = document.getElementById('btn-start-arch');
                        const status = document.getElementById('arch-status');

                        btn.onclick = async () => {
                            const serverId = document.getElementById('arch-server').value;
                            const nick = document.getElementById('arch-nick').value.trim();
                            const level = document.getElementById('arch-level').value.trim();
                            const fa = document.getElementById('arch-fa').value.trim();
                            const reason = document.getElementById('arch-reason').value.trim();

                            if (!nick || !level || !fa || !reason) {
                                showCustomDialog({
                                    type: 'alert',
                                    title: 'Ошибка заполнения',
                                    message: 'Пожалуйста, заполните все поля перед запуском архивации!'
                                });
                                return;
                            }

                            const lvlNum = parseInt(level);
                            if (isNaN(lvlNum) || lvlNum < 1 || lvlNum > 7) {
                                showCustomDialog({
                                    type: 'alert',
                                    title: 'Неверный уровень',
                                    message: 'Уровень модерации должен быть числом от 1 до 7!'
                                });
                                return;
                            }

                            if (!fa.includes('forum.keeper-nexus.com')) {
                                showCustomDialog({
                                    type: 'alert',
                                    title: 'Неверная ссылка',
                                    message: 'Ссылка на ФА должна вести на домен forum.keeper-nexus.com!'
                                });
                                return;
                            }

                            btn.disabled = true;
                            status.textContent = 'Процесс снятия..';
                            status.className = 'nx-status-msg info';

                            try {
                                const mIDMatch = fa.match(/members\/.*?\.(\d+)\//) || fa.match(/members\/(\d+)\//);
                                const mID = mIDMatch ? mIDMatch[1] : null;
                                
                                if (mID) {
                                    try {
                                        await removeModeratorRole(mID, level, document.getElementById('is-szm').checked, status);
                                    } catch (roleErr) {
                                        console.error('Role removal failed:', roleErr);
                                    }
                                }

                                 let targetThreadId = null;
                                 let currentPage = 1;
                                 let totalPages = 1;

                                 while (currentPage <= totalPages) {
                                     const pageUrl = currentPage === 1 
                                         ? `https://forum.keeper-nexus.com/forums/${serverId}/`
                                         : `https://forum.keeper-nexus.com/forums/${serverId}/page-${currentPage}`;
                                     
                                     const response = await fetch(pageUrl);
                                     const html = await response.text();
                                     const parser = new DOMParser();
                                     const doc = parser.parseFromString(html, 'text/html');

                                     if (currentPage === 1) {
                                         const pageInput = doc.querySelector('.js-pageJumpPage');
                                         if (pageInput) {
                                             totalPages = parseInt(pageInput.getAttribute('max')) || 1;
                                         }
                                     }

                                     const threads = doc.querySelectorAll('.structItem--thread');
                                     for (const thread of threads) {
                                         const titleEl = thread.querySelector('.structItem-title a[data-tp-primary]');
                                         if (titleEl && titleEl.textContent.includes(nick)) {
                                             const href = titleEl.getAttribute('href');
                                             const match = href.match(/threads\/.*?\.(\d+)\//) || href.match(/threads\/(\d+)\//);
                                             if (match) {
                                                 targetThreadId = match[1];
                                                 break;
                                             }
                                         }
                                     }

                                     if (targetThreadId) break;
                                     currentPage++;
                                 }

                                 if (!targetThreadId) {
                                     throw new Error('Тема с таким никнеймом не найдена в разделе.');
                                 }
                                
                                const xfToken = document.querySelector('input[name="_xfToken"]')?.value;
                                if (!xfToken) throw new Error('Не удалось получить xfToken. Попробуйте обновить страницу.');

                                const date = new Date().toLocaleDateString('ru-RU');
                                const message = `${date} | Снят по причине: ${reason}`;

                                await fetch(`https://forum.keeper-nexus.com/threads/${targetThreadId}/add-reply`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                    body: new URLSearchParams({
                                        'message': message,
                                        '_xfToken': xfToken,
                                        '_xfRequestUri': window.location.pathname,
                                        '_xfWithData': '1',
                                        '_xfResponseType': 'json'
                                    })
                                });

                                await changeThreadPrefix('16', targetThreadId, true);

                                const moveData = new URLSearchParams({
                                    'target_node_id': '21', 
                                    '_xfToken': xfToken,
                                    '_xfRequestUri': `/threads/${targetThreadId}/`,
                                    '_xfWithData': '1',
                                    '_xfResponseType': 'json',
                                    '_xfSet[target_node_id]': '1',
                                    'redirect': '0'
                                });

                                const moveResponse = await fetch(`https://forum.keeper-nexus.com/threads/${targetThreadId}/quick-move`, {
                                    method: 'POST',
                                    headers: { 
                                        'Content-Type': 'application/x-www-form-urlencoded',
                                        'X-Requested-With': 'XMLHttpRequest'
                                    },
                                    body: moveData
                                });

                                const currentStatus = await checkThreadStatus();
                                
                                if (!currentStatus.closed) {
                                    try {
                                        const lockData = new URLSearchParams({
                                            '_xfToken': xfToken,
                                            '_xfResponseType': 'json',
                                            '_xfRequestUri': `/threads/${targetThreadId}/`,
                                            'lock': '1'
                                        });

                                        await fetch(`https://forum.keeper-nexus.com/threads/${targetThreadId}/quick-close`, {
                                            method: 'POST',
                                            body: lockData,
                                            headers: {
                                                'X-Requested-With': 'XMLHttpRequest',
                                                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                                            }
                                        });
                                    } catch (lockErr) {
                                        console.error('Ошибка при закрытии темы:', lockErr);
                                    }
                                }

                                if (currentStatus.sticky) {
                                    try {
                                        const pinData = new URLSearchParams({
                                            '_xfToken': xfToken,
                                            '_xfResponseType': 'json',
                                            '_xfRequestUri': `/threads/${targetThreadId}/`,
                                            'sticky': '0'
                                        });

                                        await fetch(`https://forum.keeper-nexus.com/threads/${targetThreadId}/quick-stick`, {
                                            method: 'POST',
                                            body: pinData,
                                            headers: {
                                                'X-Requested-With': 'XMLHttpRequest',
                                                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                                            }
                                        });
                                    } catch (pinErr) {
                                        console.error('Ошибка при откреплении темы:', pinErr);
                                    }
                                }

                                status.textContent = 'Снятие модератора завершено успешно!';
                                status.className = 'nx-status-msg success';
                            } catch (err) {
                                showCustomDialog({
                                    type: 'alert',
                                    title: 'Ошибка',
                                    message: err.message
                                });
                                status.textContent = 'Ошибка: ' + err.message;
                                status.className = 'nx-status-msg error';
                            } finally {
                                btn.disabled = false;
                            }
                        };
                    };

                    const renderAppointmentForm = () => {
                        const content = main.querySelector('.nx-content');
                        content.innerHTML = `
                            <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
                                <button class="nx-back-btn" id="btn-back-mod" style="padding: 5px 15px;">← Назад</button>
                                <h3 style="color:#af9159; margin:0;">📜 Постановление модератора</h3>
                            </div>

                            <div class="nx-card" style="padding:20px;">
                                <div class="nx-form-group full">
                                    <label>Сервер</label>
                                    <select id="sel-srv-ap" class="nx-select">
                                        <option value="37">Южный округ</option>
                                        <option value="294">Северный округ</option>
                                        <option value="366">Восточный округ</option>
                                        <option value="230">Западный округ</option>
                                        <option value="277">Приморский округ</option>
                                        <option value="143">Федеральный округ</option>
                                        <option value="361">Москва</option>
                                    </select>
                                </div>

                                <div class="nx-form-group full" style="margin-top:15px;">
                                    <label>Уровень модерации</label>
                                    <input type="text" id="sel-lvl-ap" class="nx-input" placeholder="1">
                                </div>

                                <div class="nx-form-group full" style="margin-top:15px;">
                                    <label>Шаблон досье</label>
                                    <div style="display:flex; gap:10px;">
                                        <select id="sel-tpl-ap" class="nx-select" style="flex:1;">
                                            <option value="">-- Выберите шаблон --</option>
                                            ${db.appointmentTemplates.map((t, i) => `<option value="${i}">${t.name}</option>`).join('')}
                                        </select>
                                        <button class="nx-btn-main" id="btn-add-tpl-ap" title="Создать шаблон" style="padding:0 15px;">+</button>
                                        <button class="nx-btn-main" id="btn-edit-tpl-ap" title="Редактировать шаблон" style="padding:0 15px;">✏️</button>
                                        <button class="nx-btn-main" id="btn-del-tpl-ap" title="Удалить шаблон" style="padding:0 15px; background:#a72828; display:none;">🗑️</button>
                                        <button class="nx-btn-main" id="btn-import-tpl-ap" title="Импорт шаблона по коду" style="padding:0 15px; background:#444;">📥</button>
                                        <button class="nx-btn-main" id="btn-export-tpl-ap" title="Экспорт шаблона" style="padding:0 15px; background:#444; display:none;">📨</button>
                                    </div>
                                </div>

                                <div id="ap-vars-container" style="margin-top:15px;"></div>

                                <div id="ap-status" class="nx-status-msg" style="display:none; margin-top:15px;"></div>
                                <button class="nx-btn-archive" id="btn-create-ap" style="width:100%; margin-top:20px;">СОЗДАТЬ ДОСЬЕ</button>
                            </div>
                        `;

                        const selTpl = document.getElementById('sel-tpl-ap');
                        const varsContainer = document.getElementById('ap-vars-container');
                        const btnExport = document.getElementById('btn-export-tpl-ap');
                        const btnDelete = document.getElementById('btn-del-tpl-ap');

                        const updateVars = () => {
                            const tplIndex = selTpl.value;
                            varsContainer.innerHTML = '';
                            btnExport.style.display = tplIndex === "" ? 'none' : 'block';
                            btnDelete.style.display = tplIndex === "" ? 'none' : 'block';
                            
                            if (tplIndex === "") return;

                            const tpl = db.appointmentTemplates[tplIndex];
                            const allText = tpl.title + ' ' + tpl.text;
                            const matches = allText.match(/\${(.*?)}/g) || [];
                            const uniqueVars = [...new Set(matches)].map(v => v.replace(/[${}]/g, ''));

                            uniqueVars.forEach(v => {
                                const lowerV = v.toLowerCase();
                                if (lowerV === 'nick' || lowerV === 'fa') return;

                                const div = document.createElement('div');
                                div.className = 'nx-form-group full';
                                div.style.marginTop = '10px';
                                div.innerHTML = `
                                    <label>${v} <span style="color:red;">*</span></label>
                                    <input type="text" class="nx-input ap-var-input" data-var="${v}" placeholder="Введите ${v.toLowerCase()}" autocomplete="off" required>
                                `;
                                varsContainer.appendChild(div);
                            });

                            const nickDiv = document.createElement('div');
                            nickDiv.className = 'nx-form-group full';
                            nickDiv.style.marginTop = '10px';
                            nickDiv.innerHTML = `
                                <label>Ник-нейм <span style="color:red;">*</span></label>
                                <input type="text" class="nx-input ap-var-input" data-var="nick" placeholder="Nick_Name" autocomplete="off" required>
                            `;
                            varsContainer.appendChild(nickDiv);

                            const faDiv = document.createElement('div');
                            faDiv.className = 'nx-form-group full';
                            faDiv.style.marginTop = '10px';
                            faDiv.innerHTML = `
                                <label>Ссылка на ФА <span style="color:red;">*</span></label>
                                <input type="text" class="nx-input ap-var-input" data-var="fa" placeholder="https://forum.keeper-nexus.com/members/..." autocomplete="off" required>
                            `;
                            varsContainer.appendChild(faDiv);
                        };

                        selTpl.onchange = updateVars;

                        document.getElementById('btn-back-mod').onclick = renderModMenu;
                        document.getElementById('btn-add-tpl-ap').onclick = () => showAppointTemplateEditor();
                        
                        document.getElementById('btn-import-tpl-ap').onclick = async () => {
                            const code = await showCustomDialog({
                                type: 'prompt',
                                title: 'Импорт шаблона',
                                message: 'Введите код шаблона (XX-XX-XX или XXX-XXX):',
                                placeholder: 'XX-XX-XX'
                            });

                            if (code && code.trim()) {
                                try {
                                    const { data, type } = await FirebaseService.importTemplate(code.trim().toUpperCase());
                                    
                                    if (type === 'appointment') {
                                        data.exportCode = code.trim().toUpperCase();
                                        db.appointmentTemplates.push(data);
                                        save();
                                        renderAppointmentForm();
                                        showCustomDialog({
                                            type: 'alert',
                                            title: 'Успех',
                                            message: `Шаблон постановления "${data.name}" успешно импортирован!`
                                        });
                                    } else {
                                        data.exportCode = code.trim().toUpperCase();
                                        db.templates.push(data);
                                        save();
                                        if (activeTab === 'templates') renderTemplates();
                                        showCustomDialog({
                                            type: 'alert',
                                            title: 'Успех',
                                            message: `Обычный шаблон "${data.name}" успешно импортирован!`
                                        });
                                    }
                                } catch (err) {
                                    showCustomDialog({
                                        type: 'alert',
                                        title: 'Ошибка',
                                        message: 'Не удалось импортировать шаблон. Проверьте код.'
                                    });
                                }
                            }
                        };

                        btnExport.onclick = async () => {
                            const idx = selTpl.value;
                            if (idx === "") return;
                            
                            const tpl = db.appointmentTemplates[idx];
                            try {
                                const code = await FirebaseService.exportTemplate(tpl);
                                if (!tpl.exportCode) {
                                    tpl.exportCode = code;
                                    save();
                                }
                                await showCustomDialog({
                                    type: 'code',
                                    title: 'Шаблон экспортирован',
                                    message: 'Код для общего доступа (скопируйте):',
                                    defaultValue: code
                                });
                            } catch (err) {
                                showCustomDialog({
                                    type: 'alert',
                                    title: 'Ошибка',
                                    message: 'Не удалось экспортировать шаблон.'
                                });
                            }
                        };

                        btnDelete.onclick = async () => {
                            const idx = selTpl.value;
                            if (idx === "") return;
                            
                            const tpl = db.appointmentTemplates[idx];
                            const confirm = await showCustomDialog({
                                type: 'confirm',
                                title: 'Удаление шаблона',
                                message: `Вы уверены, что хотите удалить шаблон "${tpl.name}"? Это действие нельзя отменить.`
                            });

                            if (confirm) {
                                db.appointmentTemplates.splice(idx, 1);
                                save();
                                renderAppointmentForm();
                            }
                        };

                        document.getElementById('btn-edit-tpl-ap').onclick = () => {
                            const idx = selTpl.value;
                            if (idx !== "") showAppointTemplateEditor(db.appointmentTemplates[idx], parseInt(idx));
                        };

                        document.getElementById('btn-create-ap').onclick = async () => {
                            const tplIdx = selTpl.value;
                            if (tplIdx === "") {
                                showCustomDialog({ type: 'alert', title: 'Ошибка', message: 'Выберите шаблон!' });
                                return;
                            }

                            const tpl = db.appointmentTemplates[tplIdx];
                            const varInputs = varsContainer.querySelectorAll('.ap-var-input');
                            const values = {};
                            let missingVars = [];

                            varInputs.forEach(input => {
                                const val = input.value.trim();
                                values[input.dataset.var] = val;
                                if (!val) {
                                    const varName = input.dataset.var === 'nick' ? 'Ник-нейм' : (input.dataset.var === 'fa' ? 'ФА' : input.dataset.var);
                                    missingVars.push(varName);
                                }
                            });

                            if (missingVars.length > 0) {
                                showCustomDialog({ 
                                    type: 'alert', 
                                    title: 'Ошибка', 
                                    message: `Заполните обязательные поля: ${missingVars.join(', ')}!` 
                                });
                                return;
                            }

                            const modLevel = document.getElementById('sel-lvl-ap').value.trim();
                            const faLink = values['fa'] || '';

                            if (!modLevel || isNaN(parseInt(modLevel)) || parseInt(modLevel) < 1 || parseInt(modLevel) > 7) {
                                showCustomDialog({ type: 'alert', title: 'Ошибка', message: 'Уровень модерации должен быть числом от 1 до 7!' });
                                return;
                            }

                            if (faLink && !faLink.includes('forum.keeper-nexus.com')) {
                                showCustomDialog({ type: 'alert', title: 'Ошибка', message: 'Ссылка на ФА должна вести на домен forum.keeper-nexus.com!' });
                                return;
                            }

                            const btn = document.getElementById('btn-create-ap');
                            const status = document.getElementById('ap-status');
                            
                            const selectedPrefixes = tpl.prefixes || [];

                            btn.disabled = true;
                            status.style.display = 'block';
                            status.textContent = 'Создание досье...';
                            status.className = 'nx-status-msg info';

                            try {
                                let finalTitle = tpl.title;
                                let finalText = tpl.text;

                                for (const [k, v] of Object.entries(values)) {
                                    const regex = new RegExp(`\\\${${k}}`, 'g');
                                    finalTitle = finalTitle.replace(regex, v);
                                    finalText = finalText.replace(regex, v);
                                }

                                const xfToken = document.querySelector('input[name="_xfToken"]')?.value;
                                if (!xfToken) throw new Error('xfToken не найден');

                                const serverId = document.getElementById('sel-srv-ap').value;

                                const formData = new URLSearchParams();
                                formData.append('title', finalTitle);
                                formData.append('message_html', finalText.replace(/\n/g, '<br>'));
                                formData.append('_xfToken', xfToken);
                                formData.append('_xfRequestUri', `/forums/${serverId}/post-thread`);
                                formData.append('_xfWithData', '1');
                                formData.append('_xfResponseType', 'json');

                                if (selectedPrefixes.length > 0) {
                                    selectedPrefixes.forEach(id => formData.append('prefix_id[]', id));
                                } else {
                                    formData.append('prefix_id', '0');
                                }

                                const response = await fetch(`https://forum.keeper-nexus.com/forums/${serverId}/post-thread`, {
                                    method: 'POST',
                                    body: formData,
                                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                                });

                                if (!response.ok) throw new Error('Ошибка при создании темы');

                                if (faLink) {
                                    const mIDMatch = faLink.match(/members\/.*?\.(\d+)\//) || faLink.match(/members\/(\d+)\//);
                                    const mID = mIDMatch ? mIDMatch[1] : null;
                                    if (mID) {
                                        await grantModeratorRole(mID, modLevel, null);
                                    }
                                }

                                status.textContent = 'Досье успешно создано!';
                                status.className = 'nx-status-msg success';
                            } catch (err) {
                                status.textContent = 'Ошибка: ' + err.message;
                                status.className = 'nx-status-msg error';
                            } finally {
                                btn.disabled = false;
                            }
                        };
                    };

                    const showAppointTemplateEditor = (tpl = null, idx = -1) => {
                        const isEdit = tpl !== null;
                        const modal = document.createElement('div');
                        modal.className = 'nx-custom-modal';
                        modal.innerHTML = `
                            <div class="nx-custom-dialog" style="width: 500px;">
                                <h3>${isEdit ? 'Редактировать' : 'Новый'} шаблон постановления</h3>
                                <input type="text" id="ap-tpl-n" class="nx-dialog-input" placeholder="Название шаблона (напр. Постановление модератора)" value="${tpl?.name || ''}">
                                <input type="text" id="ap-tpl-h" class="nx-dialog-input" placeholder="Заголовок темы (${'${nick}'} - для никнейма)" value="${tpl?.title || ''}">
                                <textarea id="ap-tpl-t" class="nx-dialog-input" style="height:150px; resize:vertical;" placeholder="Текст досье ( ${'${nick}'} - для ника, ${'${fa}'} - для ФА, ${'${Имя перменной}'} - своя переменная)">${tpl?.text || ''}</textarea>
                                
                                <div style="margin-top:15px;">
                                    <label style="color:#af9159; font-size:11px; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 5px;">Префиксы досье (можно выбрать несколько)</label>
                                    <div id="tpl-prefix-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #252525; padding: 12px; border-radius: 6px; border: 1px solid #383838; max-height: 150px; overflow-y: auto;">
                                        <label style="display: flex; align-items: center; gap: 8px; color: #efefef; font-size: 13px; cursor: pointer; text-transform: none; font-weight: normal; grid-column: span 2; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 5px;">
                                            <input type="checkbox" class="nx-tpl-prefix-cb" value="0" ${tpl?.prefixes?.includes('0') ? 'checked' : ''}> Не менять
                                        </label>
                                        
                                        <!-- Округа -->
                                        <label style="display: flex; align-items: center; gap: 8px; color: #af9159; font-size: 11px; grid-column: span 2; margin-top: 5px; text-transform: uppercase; font-weight: bold;">Округа</label>
                                        <label style="display: flex; align-items: center; gap: 8px; color: #efefef; font-size: 13px; cursor: pointer; text-transform: none; font-weight: normal;">
                                            <input type="checkbox" class="nx-tpl-prefix-cb" value="4" ${tpl?.prefixes?.includes('4') ? 'checked' : ''}> Южный округ
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; color: #efefef; font-size: 13px; cursor: pointer; text-transform: none; font-weight: normal;">
                                            <input type="checkbox" class="nx-tpl-prefix-cb" value="20" ${tpl?.prefixes?.includes('20') ? 'checked' : ''}> Северный округ
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; color: #efefef; font-size: 13px; cursor: pointer; text-transform: none; font-weight: normal;">
                                            <input type="checkbox" class="nx-tpl-prefix-cb" value="5" ${tpl?.prefixes?.includes('5') ? 'checked' : ''}> Восточный округ
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; color: #efefef; font-size: 13px; cursor: pointer; text-transform: none; font-weight: normal;">
                                            <input type="checkbox" class="nx-tpl-prefix-cb" value="6" ${tpl?.prefixes?.includes('6') ? 'checked' : ''}> Западный округ
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; color: #efefef; font-size: 13px; cursor: pointer; text-transform: none; font-weight: normal;">
                                            <input type="checkbox" class="nx-tpl-prefix-cb" value="11" ${tpl?.prefixes?.includes('11') ? 'checked' : ''}> Приморский округ
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; color: #efefef; font-size: 13px; cursor: pointer; text-transform: none; font-weight: normal;">
                                            <input type="checkbox" class="nx-tpl-prefix-cb" value="13" ${tpl?.prefixes?.includes('13') ? 'checked' : ''}> Федеральный округ
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; color: #efefef; font-size: 13px; cursor: pointer; text-transform: none; font-weight: normal;">
                                            <input type="checkbox" class="nx-tpl-prefix-cb" value="21" ${tpl?.prefixes?.includes('21') ? 'checked' : ''}> Москва
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; color: #efefef; font-size: 13px; cursor: pointer; text-transform: none; font-weight: normal;">
                                            <input type="checkbox" class="nx-tpl-prefix-cb" value="18" ${tpl?.prefixes?.includes('18') ? 'checked' : ''}> Chandler
                                        </label>

                                        <!-- Статусы -->
                                        <label style="display: flex; align-items: center; gap: 8px; color: #af9159; font-size: 11px; grid-column: span 2; margin-top: 5px; text-transform: uppercase; font-weight: bold;">Статусы</label>
                                        <label style="display: flex; align-items: center; gap: 8px; color: #efefef; font-size: 13px; cursor: pointer; text-transform: none; font-weight: normal;">
                                            <input type="checkbox" class="nx-tpl-prefix-cb" value="9" ${tpl?.prefixes?.includes('9') ? 'checked' : ''}> Одобрено
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; color: #efefef; font-size: 13px; cursor: pointer; text-transform: none; font-weight: normal;">
                                            <input type="checkbox" class="nx-tpl-prefix-cb" value="7" ${tpl?.prefixes?.includes('7') ? 'checked' : ''}> Отказано
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; color: #efefef; font-size: 13px; cursor: pointer; text-transform: none; font-weight: normal;">
                                            <input type="checkbox" class="nx-tpl-prefix-cb" value="3" ${tpl?.prefixes?.includes('3') ? 'checked' : ''}> На рассмотрении
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; color: #efefef; font-size: 13px; cursor: pointer; text-transform: none; font-weight: normal;">
                                            <input type="checkbox" class="nx-tpl-prefix-cb" value="2" ${tpl?.prefixes?.includes('2') ? 'checked' : ''}> Рассмотрено
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; color: #efefef; font-size: 13px; cursor: pointer; text-transform: none; font-weight: normal;">
                                            <input type="checkbox" class="nx-tpl-prefix-cb" value="14" ${tpl?.prefixes?.includes('14') ? 'checked' : ''}> Актуальное
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; color: #efefef; font-size: 13px; cursor: pointer; text-transform: none; font-weight: normal;">
                                            <input type="checkbox" class="nx-tpl-prefix-cb" value="16" ${tpl?.prefixes?.includes('16') ? 'checked' : ''}> В архиве
                                        </label>

                                        <!-- Прочее -->
                                        <label style="display: flex; align-items: center; gap: 8px; color: #af9159; font-size: 11px; grid-column: span 2; margin-top: 5px; text-transform: uppercase; font-weight: bold;">Прочее</label>
                                        <label style="display: flex; align-items: center; gap: 8px; color: #efefef; font-size: 13px; cursor: pointer; text-transform: none; font-weight: normal;">
                                            <input type="checkbox" class="nx-tpl-prefix-cb" value="8" ${tpl?.prefixes?.includes('8') ? 'checked' : ''}> Информация
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; color: #efefef; font-size: 13px; cursor: pointer; text-transform: none; font-weight: normal;">
                                            <input type="checkbox" class="nx-tpl-prefix-cb" value="19" ${tpl?.prefixes?.includes('19') ? 'checked' : ''}> Важно
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; color: #efefef; font-size: 13px; cursor: pointer; text-transform: none; font-weight: normal;">
                                            <input type="checkbox" class="nx-tpl-prefix-cb" value="10" ${tpl?.prefixes?.includes('10') ? 'checked' : ''}> Чёрный список
                                        </label>
                                    </div>
                                </div>

                                <div style="display:flex; gap:10px; margin-top:20px;">
                                    <button class="nx-btn-main" id="ap-tpl-save" style="flex:1;">СОХРАНИТЬ</button>
                                    <button class="nx-btn-main" id="ap-tpl-cancel" style="flex:1; background:#444;">ОТМЕНА</button>
                                </div>
                            </div>
                        `;
                        document.body.appendChild(modal);

                        document.getElementById('ap-tpl-cancel').onclick = () => modal.remove();
                        document.getElementById('ap-tpl-save').onclick = () => {
                            const name = document.getElementById('ap-tpl-n').value.trim();
                            const title = document.getElementById('ap-tpl-h').value.trim();
                            const text = document.getElementById('ap-tpl-t').value.trim();
                            const prefixes = Array.from(document.querySelectorAll('.nx-tpl-prefix-cb:checked')).map(cb => cb.value);

                            if (!name || !title || !text) {
                                showCustomDialog({ type: 'alert', title: 'Ошибка', message: 'Заполните все поля!' });
                                return;
                            }

                            const combined = title + ' ' + text;
                            if (!combined.includes('${nick}') || !combined.includes('${fa}')) {
                                showCustomDialog({ 
                                    type: 'alert', 
                                    title: 'Ошибка', 
                                    message: 'Шаблон должен обязательно содержать переменные ${nick} и ${fa}!' 
                                });
                                return;
                            }

                            const newTpl = { name, title, text, prefixes };
                            if (isEdit) {
                                db.appointmentTemplates[idx] = newTpl;
                            } else {
                                db.appointmentTemplates.push(newTpl);
                            }
                            save();
                            modal.remove();
                            renderAppointmentForm();
                        };
                    };

                    renderModMenu();
                } else {
                    main.innerHTML = `
                        <div class="nx-content" style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:40px;">
                            <div style="font-size:64px; margin-bottom:20px;">❌</div>
                            <h2 style="color:#af9159; margin-bottom:10px;">Нет доступа</h2>
                            <p style="color:#666; font-size:16px;">Доступно с <b>СЗМ+</b></p>
                        </div>
                    `;
                }
            }
        };

        document.body.appendChild(overlay);
        renderTabContent();

        overlay.querySelectorAll('.nx-nav-btn').forEach(btn => {
            btn.onclick = () => {
                activeTab = btn.dataset.tab;
                renderTabContent();
            };
        });

        const statusToggle = document.getElementById('nx-status-toggle');
         statusToggle.onclick = () => {
             db.showBadges = !db.showBadges;
             save();
             statusToggle.classList.toggle('active', db.showBadges);
             statusToggle.title = db.showBadges ? 'Галочки включены' : 'Галочки выключены';
             
             if (!db.showBadges) {
                 document.querySelectorAll('.nx-verified-badge').forEach(b => b.remove());
                 document.querySelectorAll('.nx-badge-processed').forEach(el => el.classList.remove('nx-badge-processed'));
             }

             showCustomDialog({
                 type: 'alert',
                 title: 'Статус обновлен',
                 message: `Отображение галочек ${db.showBadges ? 'включено' : 'выключено'}.`
             });
         };

        document.getElementById('nx-close').onclick = () => {
            overlay.remove();
            createFloatButton();
        };

        overlay.onkeydown = (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
                createFloatButton();
            }
        };

        overlay.focus();
    }

    const verifiedUsers = new Set();
    const DB_URL = 'https://nexusscript-online-default-rtdb.europe-west1.firebasedatabase.app/users';

    function sanitizeUsername(username) {
        return username.replace(/[.#$/[\]]/g, '_');
    }

    function getCurrentUsername() {
        const userNavNode = document.querySelector('.p-navgroup--member .p-navgroup-link--user');
        if (userNavNode) {
            const textSpan = userNavNode.querySelector('.p-navgroup-linkText');
            if (textSpan && textSpan.textContent.trim()) {
                return textSpan.textContent.trim();
            }
            const img = userNavNode.querySelector('img');
            if (img && img.alt) {
                return img.alt.trim();
            }
        }

        const exactAccountLink = document.querySelector('a[href="/account/"]');
        if (exactAccountLink) {
            const textSpan = exactAccountLink.querySelector('.p-navgroup-linkText');
            if (textSpan && textSpan.textContent.trim()) {
                return textSpan.textContent.trim();
            }
            const img = exactAccountLink.querySelector('img');
            if (img && img.alt) {
                return img.alt.trim();
            }
            const title = exactAccountLink.getAttribute('title');
            if (title && title !== 'Ваш аккаунт' && title !== 'Account' && !title.includes('Alerts')) {
                return title.trim();
            }
        }
        
        return null;
    }

    function sendHeartbeat(retryCount = 0) {
        const rawUsername = getCurrentUsername();
        
        if (!rawUsername) {
            if (retryCount < 5) {
                setTimeout(() => sendHeartbeat(retryCount + 1), 2000);
            }
            return;
        }

        const username = sanitizeUsername(rawUsername);

        fetch(`${DB_URL}/${username}.json`, {
            method: 'PUT',
            body: JSON.stringify(Date.now())
        })
        .then(() => {
        })
        .catch(err => {
            console.error('NexusScript Heartbeat Error:', err);
        });
    }

    function fetchOnlineUsers() {
        fetch(`${DB_URL}.json`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (!data) return;

                const now = Date.now();
                const fiveMinutes = 5 * 60 * 1000;
                
                verifiedUsers.clear();
                
                const onlineNames = [];
                Object.entries(data).forEach(([username, lastSeen]) => {
                        verifiedUsers.add(username);
                        onlineNames.push(username);
                });
                
                document.querySelectorAll('.nx-verified-badge').forEach(el => el.remove());
                document.querySelectorAll('.nx-badge-processed').forEach(el => el.classList.remove('nx-badge-processed'));
                
                addNexusBadges();
            })
            .catch(err => console.error('NexusScript Fetch Error:', err));
    }

    setInterval(sendHeartbeat, 60000);
    setInterval(fetchOnlineUsers, 60000);
    
    setTimeout(() => {
        sendHeartbeat();
        fetchOnlineUsers();
    }, 2000);

    function addNexusBadges() {
        if (!db.showBadges) return;
        const usernameElements = document.querySelectorAll('a.username, a[href*="/members/"], .user-name, span[class*="username--style"]');

        usernameElements.forEach(el => {
            let targetEl = el;

            if (el.tagName === 'SPAN') {
                const parentLink = el.closest('a');
                if (parentLink) {
                    targetEl = parentLink;
                }
            }

            if (targetEl.classList.contains('nx-badge-processed')) return;
            
            if (targetEl.nextElementSibling && targetEl.nextElementSibling.classList.contains('nx-verified-badge')) {
                targetEl.classList.add('nx-badge-processed');
                return;
            }

            const rawUsername = targetEl.textContent.trim();
            const username = sanitizeUsername(rawUsername);
            
            if (!verifiedUsers.has(username)) return;

            if (targetEl.closest('.p-navgroup')) return;
            if (targetEl.getAttribute('href') === '/account/') return;

            let userColor = '#fcc603';
            
            const coloredSpan = targetEl.querySelector('[class*="username--style"]');
            const colorSource = coloredSpan || targetEl;

            const computedStyle = window.getComputedStyle(colorSource);
            if (computedStyle && computedStyle.color) {
                userColor = computedStyle.color;
            }

            const isProfileHeader = targetEl.closest('h1') || targetEl.closest('.memberHeader-name') || targetEl.closest('.p-title-value');
            const isSmallList = targetEl.closest('.listInline') || targetEl.closest('.block-body');
            
            let iconSize = '14';
            let fontSize = '0.85em';
            let marginLeft = '3px';

            if (isProfileHeader) {
                iconSize = '18';
                fontSize = '1em';
                marginLeft = '4px';
            } else if (isSmallList) {
                iconSize = '12'; 
                fontSize = '0.75em';
                marginLeft = '2px';
            }

            const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${iconSize}" height="${iconSize}"><path d="M512 256c0-37.7-23.7-69.9-57.1-82.4 14.7-32.4 8.8-71.9-17.9-98.6-26.7-26.7-66.2-32.6-98.6-17.9C325.9 23.7 293.7 0 256 0s-69.9 23.7-82.4 57.1c-32.4-14.7-71.9-8.8-98.6 17.9-26.7 26.7-32.6 66.2-17.9 98.6C23.7 186.1 0 218.3 0 256s23.7 69.9 57.1 82.4c-14.7 32.4-8.8 71.9 17.9 98.6 26.7 26.7 66.2 32.6 98.6 17.9 12.5 33.3 44.7 57.1 82.4 57.1s69.9-23.7 82.4-57.1c32.4 14.7 71.9 8.8 98.6-17.9 26.7-26.7 32.6-66.2 17.9-98.6 33.4-12.5 57.1-44.7 57.1-82.4zm-144.5-43L228.2 352.3c-5.3 5.3-13.8 5.3-19.1 0L144.5 288c-5.3-5.3-5.3-13.8 0-19.1l22.3-22.3c5.3-5.3 13.8-5.3 19.1 0l42.8 42.8L326 190.6c5.3-5.3 13.8-5.3 19.1 0l22.3 22.3c5.3 5.4 5.3 13.9 0 19.1z" fill="currentColor"/></svg>`;

            const badgeHtml = `
                <span class="nx-verified-badge" title="Пользователь NexusScript" style="color: ${userColor}; font-size: ${fontSize}; margin-left: ${marginLeft}; vertical-align: middle; display: inline-flex; align-items: center; cursor: help;">
                    ${svgContent}
                </span>
            `;

            targetEl.insertAdjacentHTML('afterend', badgeHtml);
            targetEl.classList.add('nx-badge-processed');
            
        });
    }

    function createFloatButton() {
        if (document.getElementById('nx-float-trigger')) return;

        if (document.getElementById('nx-modal-v17') || document.querySelector('.nx-overlay')) return;

        floatBtn = document.createElement('button');
        floatBtn.id = 'nx-float-trigger';
        floatBtn.className = 'nx-float-btn';
        floatBtn.innerHTML = '⚙️ NexusScript';
        floatBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            openManager();
        };
        
        if (document.body) {
            document.body.appendChild(floatBtn);
        } else {
            setTimeout(createFloatButton, 100);
        }
    }

    function init() {
        createFloatButton();
        setupTemplateHandler();
        addNexusBadges();

        const observer = new MutationObserver(() => {
            addNexusBadges();
            
            if (!document.getElementById('nx-float-trigger') && !document.getElementById('nx-modal-v17')) {
                createFloatButton();
            }
            
            if (!document.querySelector('.nx-templates-dropdown')) {
                createTemplatesDropdown();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        
        setTimeout(() => {
            createTemplatesDropdown();
        }, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'openManager') {
            openManager();
            sendResponse({ success: true });
        } else if (request.action === 'getStats') {
            const foldersCount = db.folders ? db.folders.length : 0;
            let templatesCount = 0;
            if (db.folders) {
                templatesCount = db.folders.reduce((total, folder) => {
                    return total + (folder.templates ? folder.templates.length : 0);
                }, 0);
            }
            
            sendResponse({ 
                success: true, 
                folders: foldersCount, 
                templates: templatesCount
            });
        }
        return true;
    });
})();
