function initNavigation() {
    const sections = ['checkin-section', 'phone-section', 'tasks-section', 'archive-section', 'leave-section', 'tavern-section', 'stats-section', 'settings-section'];
    const navButtons = ['nav-checkin', 'nav-phone', 'nav-tasks', 'nav-archive', 'nav-leave', 'nav-tavern', 'nav-stats', 'nav-settings'];

    navButtons.forEach((btnId, index) => {
        document.getElementById(btnId).addEventListener('click', function() {
            sections.forEach((sectionId) => document.getElementById(sectionId).classList.add('hidden'));
            document.getElementById(sections[index]).classList.remove('hidden');

            navButtons.forEach((id) => {
                const btn = document.getElementById(id);
                btn.className = 'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all';
            });

            const currentBtn = document.getElementById(btnId);
            currentBtn.className = 'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all bg-primary/10 text-primary dark:bg-primary/20';

            if (sections[index] === 'stats-section') {
                const activePeriod = document.querySelector('.stats-period-btn.bg-white, .stats-period-btn.bg-slate-700').getAttribute('data-period');
                updateStatisticsCharts(activePeriod);
            }

            if (sections[index] === 'archive-section') {
                renderArchive();
            }

            if (sections[index] === 'tavern-section') {
                const inputEl = document.getElementById('mood-text-input');
                const countEl = document.getElementById('mood-char-count');
                const analyzeBtn = document.getElementById('btn-start-analyze');

                ['state-input', 'state-analyzing', 'state-result', 'state-history'].forEach((id) => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    if (id === 'state-input') {
                        el.style.zIndex = '10';
                        el.classList.remove('opacity-0');
                        el.classList.add('opacity-100');
                    } else {
                        el.style.zIndex = '0';
                        el.classList.remove('opacity-100');
                        el.classList.add('opacity-0');
                    }
                });

                if (inputEl) inputEl.value = '';
                if (countEl) countEl.textContent = '0';
                if (analyzeBtn) analyzeBtn.disabled = true;
            }
        });
    });
}
