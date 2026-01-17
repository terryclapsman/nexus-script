// ==UserScript==
// @name         NexusScript
// @description  Форумный скрипт для Nexus
// @namespace    http://tampermonkey.net/
// @version      1.1
// @author       TerryClapsman
// @match        https://forum.keeper-nexus.com/threads/*
// ==/UserScript==

(function() {
    'use strict';

    let db = JSON.parse(localStorage.getItem('nexus_v17_db')) || {
        folders: [{ id: 111, name: 'Общие', templates: [] }],
        activeFolderId: 111
    };

    let floatBtn = null;

    const styles = `
        .nx-float-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            background: #FFA500;
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
            background: #FF8C00;
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
            color: #FFA500;
            font-size: 20px;
        }
        .nx-header-author {
            font-size: 11px;
            color: #888;
        }
        .nx-header-author a {
            color: #FFA500;
            text-decoration: none;
            transition: color 0.2s;
        }
        .nx-header-author a:hover {
            color: #FF8C00;
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
            border-left-color: #FFA500;
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
            border-left: 4px solid #FFA500;
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
        .nx-badge.orange {
            border-color: #FFA500;
            color: #FFA500;
        }
        .nx-btn-main {
            background: #FFA500;
            color: #000;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s;
        }
        .nx-btn-main:hover {
            background: #FF8C00;
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
            border-color: #FFA500;
            color: #FFA500;
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
            border: 1px solid #FFA500;
            border-radius: 10px;
            padding: 25px;
            min-width: 300px;
            max-width: 500px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .nx-custom-dialog h3 {
            margin-top: 0;
            color: #FFA500;
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
            const input = modal.querySelector('#nx-dialog-input');

            if (input) input.focus();

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

async function getCleanTitle() {
    return new Promise(async (resolve) => {
        const threadId = getThreadId();

        if (threadId) {
            try {
                const response = await fetch(`/threads/${threadId}/edit`, {
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
            let title = titleElement.textContent.trim();

            const dataTitle = titleElement.getAttribute('data-title') ||
                            titleElement.getAttribute('data-original-title');

            if (dataTitle && dataTitle.trim()) {
                resolve(dataTitle.trim() || 'Тема');
                return;
            }

            title = title.replace(/^[✅❌🔴📌📁🛡️🏙️⏳]\s*/g, '');

            const prefixes = [
                'Одобрено', 'Отказано', 'На рассмотрении', 'Рассмотрено',
                'Актуальное', 'В архиве', 'Северный округ', 'Москва',
                'Южный округ', 'Восточный округ', 'Западный округ',
                'Приморский округ', 'Федеральный округ', 'Chandler',
                'Информация', 'Важно', 'Чёрный список', 'Черный список'
            ];

            for (const prefix of prefixes) {
                const regex = new RegExp(`^${prefix}\\s+`, 'i');
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
    async function getMessageContent() {
        return new Promise((resolve) => {
            const element = document.querySelector('.message:first-child .bbWrapper') ||
                document.querySelector('.js-post:first-child .message-content');

            resolve(element ? element.innerHTML : '<p></p>');
        });
    }

    async function changeThreadPrefix(prefixId) {
        const threadId = getThreadId();
        if (!threadId) return false;

        const csrfToken = getCsrfToken();
        if (!csrfToken) {
            return false;
        }


        const cleanTitle = await getCleanTitle();
        const messageContent = await getMessageContent();

        const formData = new FormData();
        formData.append('_xfToken', csrfToken);
        formData.append('_xfResponseType', 'json');
        formData.append('_xfRequestUri', `/threads/${threadId}/edit`);
        formData.append('prefix_id', prefixId);
        formData.append('prefix_id[]', prefixId);
        formData.append('title', cleanTitle);
        formData.append('message_html', messageContent);
        formData.append('_xfSet[message_html]', '1');
        formData.append('discussion_open', '1');
        formData.append('_xfSet[discussion_open]', '1');
        formData.append('discussion_type', 'discussion');
        formData.append('_xfSet[prefix_id]', '1');

        const url = `/threads/${threadId}/edit`;
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
                if (result.status === 'ok') {
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
            }
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
                            const result = await response.json().catch(() => ({ status: 'ok' }));
                            if (result.status === 'ok') {
                                needReload = true;
                            }
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
                            const result = await response.json().catch(() => ({ status: 'ok' }));
                            if (result.status === 'ok') {
                                needReload = true;
                            }
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

            setTimeout(() => {
                const select2Option = document.querySelector(`[data-prefix-id="${prefixId}"]`);
                if (select2Option) {
                    select2Option.click();
                }
            }, 100);

            return true;
        }

        return false;
    }

    function setupTemplateHandler() {
        let activeTemplate = null;
        let replyButtonClicked = false;

        document.addEventListener('click', async function(e) {
            const replyBtn = e.target.closest('[data-action="reply"]') ||
                            e.target.closest('.button--primary') ||
                            e.target.closest('.js-quickReply') ||
                            e.target.closest('[data-xf-click*="reply"]') ||
                            e.target.closest('[data-xf-click*="quote"]') ||
                            e.target.closest('.js-replyButton') ||
                            e.target.closest('a[href*="post-reply"]');

            if (replyBtn && activeTemplate) {
                replyButtonClicked = true;

                setTimeout(async () => {
                    if (activeTemplate && replyButtonClicked) {
                        const needReload = await applyTemplateActions(activeTemplate);

                        if (activeTemplate.prefix && activeTemplate.prefix !== "0") {
                            setTimeout(() => {
                                applyPrefixInReplyForm(activeTemplate.prefix);
                            }, 500);
                        }

                        if (needReload) {
                            setTimeout(() => {
                                window.location.reload();
                            }, 1000);
                        }

                        activeTemplate = null;
                        replyButtonClicked = false;
                    }
                }, 1000);
            }
        }, true);

        window.setActiveTemplate = (template) => {
            activeTemplate = template;
            replyButtonClicked = false;
        };

        const observer = new MutationObserver((mutations) => {
            if (activeTemplate && activeTemplate.prefix && activeTemplate.prefix !== "0") {
                for (const mutation of mutations) {
                    if (mutation.addedNodes.length) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === 1) {
                                const hasPrefixField = node.querySelector && (
                                    node.querySelector('select[name*="prefix"]') ||
                                    node.querySelector('input[name*="prefix"]') ||
                                    node.matches?.('select[name*="prefix"]') ||
                                    node.matches?.('input[name*="prefix"]')
                                );

                                if (hasPrefixField) {
                                    setTimeout(() => {
                                        applyPrefixInReplyForm(activeTemplate.prefix);
                                    }, 300);
                                }
                            }
                        }
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
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
                    <b style="color:#FFA500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.name}</b>
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
                    ${t.close !== 'none' ? `<span class="nx-badge orange">${t.close==='close'?'Закрыть':'Открыть'}</span>`:''}
                    ${t.pin !== 'none' ? `<span class="nx-badge orange">${t.pin==='pin'?'Закрепить':'Открепить'}</span>`:''}
                </div>
            `;

            card.querySelector('.btn-ins').onclick = () => {
                const editor = document.querySelector('.fr-element.fr-view') ||
                              document.querySelector('.js-editor') ||
                              document.querySelector('textarea[name="message"]');

                if (editor) {
                    if (editor.tagName === 'TEXTAREA') {
                        editor.value += t.text;
                        editor.dispatchEvent(new Event('input', { bubbles: true }));
                    } else {
                        editor.focus();
                        document.execCommand('insertHTML', false, t.text.replace(/\n/g, '<br>'));
                    }
                }

                window.setActiveTemplate(t);

                const modal = document.getElementById('nx-modal-v17');
                if (modal) modal.remove();
                createFloatButton();
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
                        <option value="5" ${prefixValue === "5" ? 'selected' : ''}>Восточный округ</option>
                        <option value="6" ${prefixValue === "6" ? 'selected' : ''}>Западный округ</option>
                        <option value="11" ${prefixValue === "11" ? 'selected' : ''}>Приморский округ</option>
                        <option value="13" ${prefixValue === "13" ? 'selected' : ''}>Федеральный округ</option>
                        <option value="18" ${prefixValue === "18" ? 'selected' : ''}>Chandler</option>
                        <option value="20" ${prefixValue === "20" ? 'selected' : ''}>Северный округ</option>
                        <option value="21" ${prefixValue === "21" ? 'selected' : ''}>Москва</option>
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
                    <div class="nx-header-title">
                        <h2 class="nx-header-main">📁 NexusScript</h2>
                        <div class="nx-header-author">by <a href="https://vk.com/tclaps" target="_blank">tclaps</a></div>
                    </div>
                    <span style="cursor:pointer; font-size:28px;color:#aaa;padding:0 10px;" id="nx-close" title="Закрыть">×</span>
                </div>
                <div class="nx-main">
                    <div class="nx-sidebar">
                        <div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center;">
                            <span style="color:#FFA500; font-size:11px; font-weight:bold;text-transform:uppercase">Папки</span>
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
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        renderFolders();
        renderTemplates();

        document.getElementById('nx-close').onclick = () => {
            overlay.remove();
            createFloatButton();
        };

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

        overlay.onkeydown = (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
                createFloatButton();
            }
        };

        overlay.focus();
    }

    function createFloatButton() {
        if (floatBtn) {
            floatBtn.remove();
        }

        if (!document.getElementById('nx-modal-v17')) {
            floatBtn = document.createElement('button');
            floatBtn.id = 'nx-float-trigger';
            floatBtn.className = 'nx-float-btn';
            floatBtn.innerHTML = '☰ NexusScript';
            floatBtn.onclick = openManager;
            document.body.appendChild(floatBtn);
        }
    }

    function init() {
        const oldBtn = document.getElementById('nx-float-trigger');
        if (oldBtn) oldBtn.remove();

        createFloatButton();
        setupTemplateHandler();

        const observer = new MutationObserver(() => {
            if (!floatBtn && !document.getElementById('nx-modal-v17')) {
                createFloatButton();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();