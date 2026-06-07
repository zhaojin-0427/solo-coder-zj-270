const ExportTool = (function() {
    let selectedLabelIds = new Set();

    function init() {
        document.getElementById('btnConfirmExport').addEventListener('click', doExport);
        document.getElementById('btnPrintLabels').addEventListener('click', printLabels);
    }

    function openExportModal() {
        showModal('exportModal');
    }

    function openLabelsModal() {
        selectedLabelIds.clear();
        renderLabelsItemList();
        renderLabelsPreview();
        showModal('labelsModal');
    }

    function doExport() {
        const format = document.getElementById('exportFormat').value;
        const includeRooms = document.getElementById('exportRooms').checked;
        const includeItems = document.getElementById('exportItems').checked;
        const includePhotos = document.getElementById('exportPhotos').checked;

        const data = Storage.exportAllData();
        let exportData = {};

        if (includeRooms) {
            exportData.rooms = data.rooms;
            exportData.storages = data.storages;
        }
        if (includeItems) {
            exportData.items = data.items.map(item => {
                if (!includePhotos) {
                    return { ...item, photo: null };
                }
                return item;
            });
        }

        let content, filename, mimeType;

        switch (format) {
            case 'json':
                content = JSON.stringify(exportData, null, 2);
                filename = `收纳清单_${getDateStr()}.json`;
                mimeType = 'application/json';
                break;
            case 'csv':
                content = generateCSV(exportData);
                filename = `收纳清单_${getDateStr()}.csv`;
                mimeType = 'text/csv;charset=utf-8';
                break;
            case 'html':
                content = generateHTML(exportData);
                filename = `收纳清单_${getDateStr()}.html`;
                mimeType = 'text/html;charset=utf-8';
                break;
            default:
                return;
        }

        downloadFile(content, filename, mimeType);
        hideModal('exportModal');
        showToast('导出成功', 'success');
    }

    function generateCSV(data) {
        let csv = '\ufeff';

        if (data.rooms && data.rooms.length > 0) {
            csv += '=== 房间 ===\n';
            csv += 'ID,名称,图标,创建时间\n';
            data.rooms.forEach(r => {
                csv += `${r.id},"${r.name}","${r.icon}",${formatTimestamp(r.createdAt)}\n`;
            });
            csv += '\n';
        }

        if (data.storages && data.storages.length > 0) {
            csv += '=== 收纳空间 ===\n';
            csv += 'ID,房间ID,父级ID,名称,类型,容量,备注,位置X,位置Y,宽度,高度\n';
            data.storages.forEach(s => {
                csv += `${s.id},${s.roomId},${s.parentId || ''},"${s.name}",${s.type},${s.capacity},"${s.notes || ''}",${s.x},${s.y},${s.width},${s.height}\n`;
            });
            csv += '\n';
        }

        if (data.items && data.items.length > 0) {
            csv += '=== 物品清单 ===\n';
            csv += 'ID,名称,分类,位置ID,数量,季节标签,过期日期,最后使用,备注,创建时间\n';
            data.items.forEach(item => {
                const seasons = (item.seasons || []).join('|');
                csv += `${item.id},"${item.name}",${item.category},${item.locationId},${item.quantity},${seasons},${item.expiry || ''},${item.lastUsed || ''},"${(item.notes || '').replace(/"/g, '""')}",${formatTimestamp(item.createdAt)}\n`;
            });
        }

        return csv;
    }

    function generateHTML(data) {
        let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>收纳清单</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; padding: 30px; color: #333; }
        h1 { color: #5b8c5a; border-bottom: 2px solid #5b8c5a; padding-bottom: 10px; }
        h2 { color: #e07b39; margin-top: 30px; border-left: 4px solid #e07b39; padding-left: 10px; }
        h3 { color: #555; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 14px; }
        th { background: #f5f3ef; font-weight: 600; }
        tr:nth-child(even) { background: #fafafa; }
        .item-photo { width: 60px; height: 60px; object-fit: cover; border-radius: 4px; }
        .meta { color: #888; font-size: 13px; margin-bottom: 20px; }
        .season-tag { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; margin-right: 4px; }
        .spring { background: #e8f5e9; color: #2e7d32; }
        .summer { background: #fff3e0; color: #e65100; }
        .autumn { background: #fbe9e7; color: #bf360c; }
        .winter { background: #e3f2fd; color: #1565c0; }
        .all-season { background: #f3e5f5; color: #6a1b9a; }
    </style>
</head>
<body>
    <h1>🏠 家居收纳清单</h1>
    <p class="meta">导出时间：${new Date().toLocaleString('zh-CN')}</p>
`;

        if (data.rooms && data.rooms.length > 0) {
            html += '<h2>🗂️ 房间与收纳空间</h2>';
            data.rooms.forEach(room => {
                html += `<h3>${room.icon} ${room.name}</h3>`;
                const roomStorages = (data.storages || []).filter(s => s.roomId === room.id && !s.parentId);
                if (roomStorages.length > 0) {
                    html += renderStorageTreeHTML(roomStorages, data.storages || [], data.items || []);
                } else {
                    html += '<p style="color:#999;">暂无收纳空间</p>';
                }
            });
        }

        if (data.items && data.items.length > 0) {
            html += '<h2>📦 物品清单</h2>';
            html += `
                <table>
                    <thead>
                        <tr>
                            <th>照片</th>
                            <th>名称</th>
                            <th>分类</th>
                            <th>数量</th>
                            <th>存放位置</th>
                            <th>季节标签</th>
                            <th>过期日期</th>
                            <th>备注</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            data.items.forEach(item => {
                const photo = item.photo
                    ? `<img src="${item.photo}" class="item-photo">`
                    : getCategoryEmoji(item.category);
                const seasons = (item.seasons || []).map(s =>
                    `<span class="season-tag ${s}">${Storage.getSeasonName(s)}</span>`
                ).join('');
                const location = Storage.getStorageById(item.locationId);
                const locationName = location ? Storage.getStorageFullPath(item.locationId) : '-';
                html += `
                    <tr>
                        <td>${photo}</td>
                        <td><strong>${escapeHtml(item.name)}</strong></td>
                        <td>${Storage.getCategoryName(item.category)}</td>
                        <td>${item.quantity}</td>
                        <td>${escapeHtml(locationName)}</td>
                        <td>${seasons}</td>
                        <td>${item.expiry || '-'}</td>
                        <td>${escapeHtml(item.notes || '')}</td>
                    </tr>
                `;
            });
            html += '</tbody></table>';
        }

        html += '</body></html>';
        return html;
    }

    function renderStorageTreeHTML(storages, allStorages, allItems, level = 0) {
        let html = '<ul style="list-style:none;padding-left:0;">';
        storages.forEach(s => {
            const children = allStorages.filter(c => c.parentId === s.id);
            const items = allItems.filter(i => i.locationId === s.id);
            const indent = level * 20;
            html += `
                <li style="margin:8px 0;padding-left:${indent}px;">
                    <strong>${Storage.getStorageTypeIcon(s.type)} ${escapeHtml(s.name)}</strong>
                    <span style="color:#888;font-size:13px;">（容量: ${s.capacity}）</span>
            `;
            if (items.length > 0) {
                html += '<ul style="list-style:none;padding-left:20px;margin:6px 0;">';
                items.forEach(item => {
                    html += `<li style="font-size:14px;padding:2px 0;">📦 ${escapeHtml(item.name)} × ${item.quantity}</li>`;
                });
                html += '</ul>';
            }
            if (children.length > 0) {
                html += renderStorageTreeHTML(children, allStorages, allItems, level + 1);
            }
            html += '</li>';
        });
        html += '</ul>';
        return html;
    }

    function renderLabelsItemList() {
        const container = document.getElementById('labelsItemList');
        const items = Storage.getItems();

        if (items.length === 0) {
            container.innerHTML = '<p style="color:#999;padding:10px;">暂无可打印标签的物品</p>';
            return;
        }

        container.innerHTML = items.map(item => {
            const location = Storage.getStorageById(item.locationId);
            const locName = location ? Storage.getStorageFullPath(item.locationId) : '-';
            const checked = selectedLabelIds.has(item.id) ? 'checked' : '';
            return `
                <label class="labels-item-checkbox">
                    <input type="checkbox" value="${item.id}" ${checked} class="label-item-cb">
                    <span><strong>${escapeHtml(item.name)}</strong> - ${escapeHtml(locName)}</span>
                </label>
            `;
        }).join('');

        container.querySelectorAll('.label-item-cb').forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked) {
                    selectedLabelIds.add(cb.value);
                } else {
                    selectedLabelIds.delete(cb.value);
                }
                renderLabelsPreview();
            });
        });
    }

    function renderLabelsPreview() {
        const container = document.getElementById('labelsPreview');
        const items = [];
        selectedLabelIds.forEach(id => {
            const item = Storage.getItemById(id);
            if (item) items.push(item);
        });

        if (items.length === 0) {
            container.innerHTML = '<p style="color:#999;padding:20px;grid-column:1/-1;text-align:center;">请选择要打印标签的物品</p>';
            return;
        }

        container.innerHTML = items.map(item => renderLabelCard(item)).join('');
    }

    function renderLabelCard(item) {
        const location = Storage.getStorageById(item.locationId);
        const locName = location ? Storage.getStorageFullPath(item.locationId) : '-';
        const seasons = (item.seasons || []).map(s => Storage.getSeasonName(s)).join(' ');

        return `
            <div class="label-card">
                <div class="label-card-name">${escapeHtml(item.name)} ${item.quantity > 1 ? `×${item.quantity}` : ''}</div>
                <div class="label-card-location">📍 ${escapeHtml(locName)}</div>
                ${seasons ? `<div style="font-size:11px;color:#666;">${seasons}</div>` : ''}
                ${item.expiry ? `<div style="font-size:11px;color:#d9534f;">⚠️ ${item.expiry}到期</div>` : ''}
                <div class="label-card-qr">[ ${item.id.slice(-8).toUpperCase()} ]</div>
            </div>
        `;
    }

    function printLabels() {
        if (selectedLabelIds.size === 0) {
            showToast('请至少选择一个物品', 'warning');
            return;
        }

        const items = [];
        selectedLabelIds.forEach(id => {
            const item = Storage.getItemById(id);
            if (item) items.push(item);
        });

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>打印标签</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; padding: 20px; }
        .labels-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; }
        .label-card { border: 1px solid #000; border-radius: 4px; padding: 10px; break-inside: avoid; page-break-inside: avoid; }
        .label-card-name { font-weight: bold; font-size: 14px; margin-bottom: 4px; }
        .label-card-location { font-size: 12px; color: #666; margin-bottom: 4px; }
        .label-card-qr { margin-top: 6px; padding: 8px; background: #f5f5f5; text-align: center; font-family: monospace; font-size: 11px; border-radius: 2px; }
        @media print {
            body { padding: 0; }
            .labels-grid { gap: 5mm; }
        }
    </style>
</head>
<body>
    <div class="labels-grid">
        ${items.map(item => renderLabelCardForPrint(item)).join('')}
    </div>
    <script>
        window.onload = function() {
            setTimeout(() => {
                window.print();
                window.close();
            }, 300);
        };
    <\/script>
</body>
</html>
        `);
        printWindow.document.close();
    }

    function renderLabelCardForPrint(item) {
        const location = Storage.getStorageById(item.locationId);
        const locName = location ? Storage.getStorageFullPath(item.locationId) : '-';
        const seasons = (item.seasons || []).map(s => Storage.getSeasonName(s)).join(' ');

        return `
            <div class="label-card">
                <div class="label-card-name">${escapeHtml(item.name)} ${item.quantity > 1 ? `×${item.quantity}` : ''}</div>
                <div class="label-card-location">📍 ${escapeHtml(locName)}</div>
                ${seasons ? `<div style="font-size:11px;">${seasons}</div>` : ''}
                ${item.expiry ? `<div style="font-size:11px;color:#d9534f;">⚠️ ${item.expiry}到期</div>` : ''}
                <div class="label-card-qr">${item.id.slice(-8).toUpperCase()}</div>
            </div>
        `;
    }

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function getDateStr() {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    }

    function formatTimestamp(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleString('zh-CN');
    }

    function getCategoryEmoji(category) {
        const emojis = {
            clothing: '👕', document: '📄', kitchen: '🍳', electronics: '📱',
            tool: '🔧', decoration: '🎨', medicine: '💊', other: '📦'
        };
        return emojis[category] || '📦';
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return {
        init,
        openExportModal,
        openLabelsModal
    };
})();
