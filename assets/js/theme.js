lucide.createIcons();

const themeToggleBtn = document.getElementById('theme-toggle');
const htmlElement = document.documentElement;
const systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

function updateThemeIcon() {
    const iconDark = document.getElementById('theme-icon-dark');
    const iconLight = document.getElementById('theme-icon-light');

    if (htmlElement.classList.contains('dark')) {
        if (iconLight) iconLight.classList.add('hidden');
        if (iconDark) iconDark.classList.remove('hidden');
    } else {
        if (iconDark) iconDark.classList.add('hidden');
        if (iconLight) iconLight.classList.remove('hidden');
    }
}

if (localStorage.theme === 'dark' || (!('theme' in localStorage) && systemThemeMediaQuery.matches)) {
    htmlElement.classList.add('dark');
} else {
    htmlElement.classList.remove('dark');
}

updateThemeIcon();

themeToggleBtn?.addEventListener('click', () => {
    htmlElement.classList.toggle('dark');
    localStorage.theme = htmlElement.classList.contains('dark') ? 'dark' : 'light';
    updateThemeIcon();

    if (window.checkinRateChart) {
        const activePeriodBtn = document.querySelector('.stats-period-btn.bg-white, .stats-period-btn.bg-slate-700');
        if (activePeriodBtn) {
            updateStatisticsCharts(activePeriodBtn.getAttribute('data-period'));
        }
    }
});

systemThemeMediaQuery.addEventListener('change', (event) => {
    if (!('theme' in localStorage)) {
        if (event.matches) {
            htmlElement.classList.add('dark');
        } else {
            htmlElement.classList.remove('dark');
        }

        updateThemeIcon();

        if (window.checkinRateChart) {
            const activePeriodBtn = document.querySelector('.stats-period-btn.bg-white, .stats-period-btn.bg-slate-700');
            if (activePeriodBtn) {
                updateStatisticsCharts(activePeriodBtn.getAttribute('data-period'));
            }
        }
    }
});
