/**
 * 本地数据导出控制器。
 * 负责执行当前选中的导出动作和浏览器下载。
 */

function triggerFileDownload(filename, content, mimeType) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function executeSelectedExport() {
    const monthInput = document.getElementById('export-month-input');
    const profileSelect = document.getElementById('export-profile-select');
    const profile = getExportProfile(profileSelect?.value);
    const monthKey = monthInput?.value || getCurrentMonthKey();
    const descriptor = buildExportFileDescriptor(profile, monthKey);
    triggerFileDownload(descriptor.filename, descriptor.content, descriptor.mimeType);
    setExportActionMessage(`已导出 ${descriptor.filename}`);
    showToast(descriptor.toastMessage, 'success');
}
