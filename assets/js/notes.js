/**
 * 速记与归档模块。
 * 负责快速捕捉灵感、今日速记列表以及历史归档检索。
 */

const quickModal = document.getElementById('quick-capture-modal');
const quickContent = document.getElementById('quick-capture-content');
const quickInput = document.getElementById('quick-capture-input');
const quickTagSelect = document.getElementById('quick-capture-tag');
const quickCount = document.getElementById('quick-capture-count');
const quickSaveBtn = document.getElementById('quick-capture-save');

/**
 * 根据输入框内容更新字符计数和保存按钮状态。
 */
function updateQuickCaptureCount() {
    if (!quickInput || !quickCount || !quickSaveBtn) return;

    const trimmedLength = quickInput.value.trim().length;
    quickCount.textContent = String(trimmedLength);
    quickSaveBtn.disabled = trimmedLength === 0;
    quickSaveBtn.classList.toggle('opacity-60', trimmedLength === 0);
    quickSaveBtn.classList.toggle('cursor-not-allowed', trimmedLength === 0);
}

/**
 * 打开速记弹窗并聚焦输入框。
 */
function openQuickCaptureModal() {
    if (!quickModal || !quickInput) return;

    quickModal.classList.remove('hidden');
    quickContent?.classList.remove('scale-95');
    quickContent?.classList.add('scale-100');
    document.body.classList.add('overflow-hidden');
    updateQuickCaptureCount();
    setTimeout(() => quickInput.focus(), 50);
    lucide.createIcons();
}

/**
 * 关闭速记弹窗并恢复页面滚动。
 */
function closeQuickCaptureModal() {
    if (!quickModal) return;

    quickContent?.classList.remove('scale-100');
    quickContent?.classList.add('scale-95');
    quickModal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

/**
 * 把当前速记写入今日记录，并同步刷新今天列表和归档视图。
 */
function saveQuickCapture() {
    if (!quickInput || !quickTagSelect) return;

    const text = quickInput.value.trim();
    const tag = quickTagSelect.value;

    if (!text) {
        showToast('先留下一句，再继续。', 'warning');
        updateQuickCaptureCount();
        return;
    }

    const today = getTodayString();
    prependDailyEntry(quickNotesData, today, {
        time: getCurrentTimeString(),
        text,
        tag
    });

    saveData();
    quickInput.value = '';
    updateQuickCaptureCount();
    closeQuickCaptureModal();
    updateQuickNotesList();
    rerenderVisiblePanel('archive-section', () => {
        renderArchive(document.getElementById('archive-search-input').value.trim());
    });

    checkAchievements();
    lucide.createIcons();
    showToast('记录已收入捕捉池', 'success');
}

// 提供全局快捷键和弹窗层级交互，确保速记入口足够轻量。
document.addEventListener('keydown', (event) => {
    if (!quickModal || !quickInput) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (quickModal.classList.contains('hidden')) {
            openQuickCaptureModal();
        } else {
            closeQuickCaptureModal();
        }
        return;
    }

    if (event.key === 'Escape' && !quickModal.classList.contains('hidden')) {
        closeQuickCaptureModal();
    }
});

document.addEventListener('click', (event) => {
    const openBtn = event.target.closest('.open-quick-capture-btn');
    if (openBtn) {
        event.preventDefault();
        openQuickCaptureModal();
        return;
    }

    if (event.target === quickModal) {
        closeQuickCaptureModal();
    }
});

quickContent?.addEventListener('click', (event) => {
    event.stopPropagation();
});

quickInput?.addEventListener('input', updateQuickCaptureCount);

quickInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        saveQuickCapture();
    }
});

document.getElementById('quick-capture-close')?.addEventListener('click', closeQuickCaptureModal);
document.getElementById('quick-capture-cancel')?.addEventListener('click', closeQuickCaptureModal);
quickSaveBtn?.addEventListener('click', saveQuickCapture);
updateQuickCaptureCount();

/**
 * 根据关键词渲染归档列表，并按日期分组展示。
 * @param {string} filterText
 */
function renderArchive(filterText = '') {
    const container = document.getElementById('archive-list-container');
    const dates = Object.keys(quickNotesData).sort((a, b) => new Date(b) - new Date(a));

    let html = '';
    let hasResults = false;
    const searchText = filterText.toLowerCase();

    dates.forEach((date) => {
        const notes = quickNotesData[date];
        if (!notes || !notes.length) return;
        const safeDate = escapeHtml(date);

        let sectionHtml = '';
        notes.forEach((note, originalIndex) => {
            const noteText = getNoteText(note);
            if (!noteText.toLowerCase().includes(searchText)) return;

            hasResults = true;
            const tagKey = note.tag || 'idea';
            const tagCfg = noteTagConfig[tagKey] || noteTagConfig.idea;
            sectionHtml += `
                <div class="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:border-primary/30 transition-colors relative group">
                    <div class="flex flex-col gap-2 mt-1 shrink-0 w-16 items-center">
                        <span class="text-sm font-mono text-slate-400 bg-slate-200/50 dark:bg-slate-800/50 px-2 py-0.5 rounded w-full text-center">${escapeHtml(getNoteTime(note))}</span>
                        <span class="text-[10px] flex items-center justify-center gap-1 border px-1.5 py-0.5 rounded w-full ${tagCfg.color}">
                            <i data-lucide="${tagCfg.icon}" class="w-3 h-3"></i> ${tagCfg.label}
                        </span>
                    </div>
                    <div class="text-sm text-slate-700 dark:text-slate-300 md-content w-full overflow-hidden break-words pr-8">
                        ${DOMPurify.sanitize(marked.parse(noteText))}
                    </div>
                    <button class="delete-note-btn absolute top-4 right-4 text-slate-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity" data-date="${safeDate}" data-index="${originalIndex}" title="删除记录">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            `;
        });

        if (!sectionHtml) return;

        html += `
            <div class="bg-cardLight dark:bg-cardDark rounded-2xl p-6 shadow-soft border border-slate-100 dark:border-slate-800">
                <h3 class="text-lg font-bold mb-4 text-primary flex items-center gap-2">
                    <i data-lucide="calendar" class="w-5 h-5"></i> ${safeDate}
                </h3>
                <div class="space-y-4">
                    ${sectionHtml}
                </div>
            </div>
        `;
    });

    if (!hasResults) {
        container.innerHTML = `
            <div class="bg-cardLight dark:bg-cardDark rounded-2xl p-10 shadow-soft border border-slate-100 dark:border-slate-800 text-center flex flex-col items-center justify-center text-slate-400">
                <i data-lucide="inbox" class="w-12 h-12 mb-3 opacity-50"></i>
                <p>${filterText ? '没有找到这条线索' : '归档区暂时还没有记录'}</p>
            </div>
        `;
    } else {
        container.innerHTML = html;
    }

    lucide.createIcons();
}

document.getElementById('archive-search-input')?.addEventListener('input', (event) => {
    renderArchive(event.target.value.trim());
});

/**
 * 刷新今天的速记捕捉池卡片列表。
 */
function updateQuickNotesList() {
    const container = document.getElementById('quick-notes-container');
    const notes = getDailyEntries(quickNotesData, getTodayString());
    if (!notes.length) {
        container.innerHTML = `
            <div class="rounded-[1.4rem] border border-dashed border-slate-200/80 bg-slate-50/70 px-6 py-8 text-center dark:border-slate-700/70 dark:bg-slate-900/40">
                <div class="module-eyebrow mb-3">EMPTY CAPTURE POOL</div>
                <h4 class="tavern-display text-2xl font-semibold text-slate-950 dark:text-slate-50">今天的捕捉池还很安静</h4>
                <p class="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">
                    丢下一条灵感、异常或待办就够了，捕捉台会先替你记住。
                </p>
                <button class="open-quick-capture-btn quick-capture-ghost mt-5">
                    <i data-lucide="square-pen" class="w-4 h-4"></i> 现在记录一条
                </button>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    container.innerHTML = notes.map((note, index) => {
        const noteText = getNoteText(note);
        const tagKey = note.tag || 'idea';
        const tagCfg = noteTagConfig[tagKey] || noteTagConfig.idea;
        return `
            <div class="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 transition-colors relative group hover:border-primary/30 dark:border-slate-700/50 dark:bg-slate-900/50">
                <div class="flex flex-col gap-1.5 mt-1 shrink-0 w-12 items-center">
                    <span class="text-xs font-mono text-slate-400">${escapeHtml(getNoteTime(note))}</span>
                    <span class="text-[9px] border px-1 rounded w-full text-center ${tagCfg.color}">${tagCfg.label}</span>
                </div>
                <div class="text-sm text-slate-700 dark:text-slate-300 md-content w-full overflow-hidden break-words pr-6">
                    ${DOMPurify.sanitize(marked.parse(noteText))}
                </div>
                <button class="delete-note-btn absolute top-3 right-3 text-slate-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity p-1" data-date="${getTodayString()}" data-index="${index}" title="删除记录">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

/**
 * 处理归档和今日速记区共用的删除行为。
 * @param {MouseEvent} event
 */
function handleNoteDeletion(event) {
    const btn = event.target.closest('.delete-note-btn');
    if (!btn) return;

    if (confirm('警告：确定要将这条记录从存储核心中永久抹除吗？')) {
        const date = btn.getAttribute('data-date');
        const index = parseInt(btn.getAttribute('data-index'), 10);
        if (removeDailyEntry(quickNotesData, date, index)) {
            saveData();
            showToast('记录已抹除', 'success');
            updateQuickNotesList();
            rerenderVisiblePanel('archive-section', () => {
                renderArchive(document.getElementById('archive-search-input').value.trim());
            });
        }
    }
}

document.getElementById('archive-list-container')?.addEventListener('click', handleNoteDeletion);
document.getElementById('quick-notes-container')?.addEventListener('click', handleNoteDeletion);
