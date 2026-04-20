/**
 * 首页标签与环境文案层。
 * 负责状态徽章、班次标签和航行情绪文案映射。
 */

function getStatusChipClass(level) {
    const levelMap = {
        success: 'status-chip status-chip-success',
        warning: 'status-chip status-chip-warning',
        danger: 'status-chip status-chip-danger',
        info: 'status-chip status-chip-info'
    };

    return levelMap[level] || levelMap.info;
}

function getPeriodLabel(period) {
    const labelMap = {
        morning: 'Alpha 班次',
        afternoon: 'Beta 班次',
        evening: 'Gamma 班次'
    };

    return labelMap[period] || period;
}

function getVoyageAmbientPresentation(ambient) {
    const activeTask = runtimeSelectors.currentTask();
    const map = {
        steady: {
            pillText: '稳态巡航',
            chipLevel: 'success',
            copy: '环境平稳，可直接推进。'
        },
        alert: {
            pillText: '异常预警',
            chipLevel: ambient.issues ? 'danger' : 'warning',
            copy: ambient.issues
                ? '有异常，先收口。'
                : '有波动，先处理。'
        },
        recovery: {
            pillText: '恢复推进',
            chipLevel: 'info',
            copy: activeTask
                ? '继续当前任务。'
                : '适合推进主线。'
        },
        nightwatch: {
            pillText: '夜航值守',
            chipLevel: 'info',
            copy: '夜航时段，适合收尾。'
        }
    };

    return map[ambient.state] || map.steady;
}
