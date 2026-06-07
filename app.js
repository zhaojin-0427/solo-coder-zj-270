const App = (function() {
    const ROOM_ICONS = ['🛏️', '🛋️', '🍳', '🚿', '📚', '🚗', '🌿', '🧺', '👶', '🏋️', '🎮', '🏠'];
    let selectedRoomIcon = '🏠';
    let editingRoomId = null;
    let editingStorageId = null;
    let currentSeason = null;

    function init() {
        currentSeason = Storage.getCurrentSeason();
        setupGlobalModalHandlers();
        setupRoomIconPicker();
        setupHeaderButtons();
        setupFloorplanTools();
        setupSearch();
        setupStorageInfoActions();
        setupAddButtons();
        setupSeasonModal();
        setupItemSave();
        setupStorageSave();
        setupRoomSave();

        StorageTree.on('storageSelected', onTreeStorageSelected);
        FloorPlan.on('storageSelected', onFloorplanStorageSelected);
        FloorPlan.on('storageChanged', refreshAll);
        FloorPlan.on('storageEdit', (storage) => openStorageEditModal(storage.id));

        Items.on('itemsChanged', refreshAll);
        Items.on('itemSelected', onItemSelected);
        Items.on('locateItem', onLocateItem);

        ExportTool.init();

        refreshAll();
    }

    function setupGlobalModalHandlers() {
        document.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.dataset.modal;
                if (modalId) hideModal(modalId);
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
            }
        });
    }

    function setupRoomIconPicker() {
        const picker = document.getElementById('roomIconPicker');
        picker.innerHTML = ROOM_ICONS.map(icon =>
            `<div class="icon-option" data-icon="${icon}">${icon}</div>`
        ).join('');

        picker.querySelectorAll('.icon-option').forEach(opt => {
            opt.addEventListener('click', () => {
                picker.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                selectedRoomIcon = opt.dataset.icon;
            });
        });
    }

    function setupHeaderButtons() {
        document.getElementById('btnExportList').addEventListener('click', () => {
            ExportTool.openExportModal();
        });

        document.getElementById('btnPrintLabels').addEventListener('click', () => {
            ExportTool.openLabelsModal();
        });

        document.getElementById('btnSeasonFilter').addEventListener('click', () => {
            openSeasonModal();
        });
    }

    function setupFloorplanTools() {
        document.querySelectorAll('.floorplan-tools .btn').forEach(btn => {
            btn.addEventListener('click', () => {
                FloorPlan.setMode(btn.dataset.mode);
            });
        });
    }

    function setupSearch() {
        const searchInput = document.getElementById('searchInput');
        const seasonFilters = document.querySelectorAll('.season-filter');

        let searchTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(doSearch, 200);
        });

        seasonFilters.forEach(cb => {
            cb.addEventListener('change', doSearch);
        });
    }

    function doSearch() {
        const keyword = document.getElementById('searchInput').value;
        const seasons = [];
        document.querySelectorAll('.season-filter:checked').forEach(cb => {
            seasons.push(cb.value);
        });

        const results = Storage.searchItems(keyword, seasons);
        const container = document.getElementById('searchResults');

        if (results.length === 0) {
            container.innerHTML = '<p style="color:#999;font-size:13px;padding:10px 0;">无匹配结果</p>';
        } else {
            container.innerHTML = results.slice(0, 20).map(item => {
                const loc = Storage.getStorageById(item.locationId);
                const locName = loc ? Storage.getStorageFullPath(item.locationId) : '-';
                return `
                    <div class="search-result-item" data-id="${item.id}">
                        <div class="search-result-name">${Items.getCategoryEmoji(item.category)} ${escapeHtml(item.name)} ×${item.quantity}</div>
                        <div class="search-result-location">📍 ${escapeHtml(locName)}</div>
                    </div>
                `;
            }).join('');

            container.querySelectorAll('.search-result-item').forEach(el => {
                el.addEventListener('click', () => {
                    const item = Storage.getItemById(el.dataset.id);
                    if (item) {
                        onItemSelected(item);
                        Items.showLocationHint(item);
                    }
                });
            });
        }

        Items.render(null, keyword, seasons);
    }

    function setupStorageInfoActions() {
        document.getElementById('btnEditStorage').addEventListener('click', () => {
            const storage = FloorPlan.getSelectedStorage();
            if (storage) openStorageEditModal(storage.id);
        });

        document.getElementById('btnViewItems').addEventListener('click', () => {
            const storage = FloorPlan.getSelectedStorage();
            if (storage) {
                Items.render(storage.id);
                showToast(`显示"${storage.name}"中的物品`, 'info');
            }
        });
    }

    function setupAddButtons() {
        document.getElementById('btnAddRoom').addEventListener('click', () => {
            openRoomAddModal();
        });

        document.getElementById('btnAddStorage').addEventListener('click', () => {
            const currentRoomId = Storage.getCurrentRoomId();
            if (!currentRoomId) {
                showToast('请先选择一个房间', 'warning');
                return;
            }
            openStorageAddModal();
        });

        document.getElementById('btnAddItem').addEventListener('click', () => {
            const storage = StorageTree.getSelectedStorage() || FloorPlan.getSelectedStorage();
            Items.openAddModal(storage ? storage.id : null);
        });
    }

    function setupSeasonModal() {
        document.querySelectorAll('.season-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.season-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderSeasonContent(tab.dataset.season);
            });
        });
    }

    function setupItemSave() {
        document.getElementById('btnSaveItem').addEventListener('click', () => {
            Items.saveItem();
        });
    }

    function setupStorageSave() {
        document.getElementById('btnSaveStorage').addEventListener('click', saveStorage);
    }

    function setupRoomSave() {
        document.getElementById('btnSaveRoom').addEventListener('click', saveRoom);
    }

    function renderRoomTabs() {
        const rooms = Storage.getRooms();
        const currentRoomId = Storage.getCurrentRoomId();
        const container = document.getElementById('roomTabs');

        if (rooms.length === 0) {
            container.innerHTML = '<p style="color:#999;font-size:13px;">请添加房间</p>';
            return;
        }

        container.innerHTML = rooms.map(room => {
            const isActive = room.id === currentRoomId ? 'active' : '';
            return `
                <div class="room-tab ${isActive}" data-id="${room.id}">
                    <span>${room.icon}</span>
                    <span>${escapeHtml(room.name)}</span>
                    <span class="room-tab-delete" data-delete="${room.id}" style="margin-left:4px;opacity:0.6;">✕</span>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.room-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                if (e.target.dataset.delete) {
                    e.stopPropagation();
                    const id = e.target.dataset.delete;
                    const room = rooms.find(r => r.id === id);
                    if (room && confirm(`确定要删除房间"${room.name}"吗？该房间的所有收纳空间和物品也将被删除。`)) {
                        Storage.deleteRoom(id);
                        refreshAll();
                        showToast('房间已删除', 'success');
                    }
                    return;
                }
                const roomId = tab.dataset.id;
                Storage.setCurrentRoomId(roomId);
                switchRoom(roomId);
            });

            tab.addEventListener('dblclick', () => {
                const id = tab.dataset.id;
                openRoomEditModal(id);
            });
        });
    }

    function switchRoom(roomId) {
        renderRoomTabs();
        FloorPlan.setRoom(roomId);
        StorageTree.setRoom(roomId);
        Items.render();
        document.getElementById('searchInput').value = '';
        document.querySelectorAll('.season-filter').forEach(cb => cb.checked = false);
        document.getElementById('searchResults').innerHTML = '';
    }

    function openRoomAddModal() {
        editingRoomId = null;
        selectedRoomIcon = ROOM_ICONS[0];
        document.getElementById('roomModalTitle').textContent = '添加房间';
        document.getElementById('roomName').value = '';

        document.querySelectorAll('#roomIconPicker .icon-option').forEach((opt, idx) => {
            opt.classList.toggle('selected', idx === 0);
        });

        showModal('roomModal');
    }

    function openRoomEditModal(roomId) {
        const room = Storage.getRooms().find(r => r.id === roomId);
        if (!room) return;

        editingRoomId = roomId;
        selectedRoomIcon = room.icon;
        document.getElementById('roomModalTitle').textContent = '编辑房间';
        document.getElementById('roomName').value = room.name;

        document.querySelectorAll('#roomIconPicker .icon-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.icon === room.icon);
        });

        showModal('roomModal');
    }

    function saveRoom() {
        const name = document.getElementById('roomName').value.trim();
        if (!name) {
            showToast('请输入房间名称', 'error');
            return;
        }

        if (editingRoomId) {
            Storage.updateRoom(editingRoomId, { name, icon: selectedRoomIcon });
            showToast('房间已更新', 'success');
        } else {
            const room = Storage.addRoom({ name, icon: selectedRoomIcon });
            Storage.setCurrentRoomId(room.id);
            showToast('房间已添加', 'success');
        }

        hideModal('roomModal');
        refreshAll();
    }

    function openStorageAddModal() {
        editingStorageId = null;
        document.getElementById('storageModalTitle').textContent = '添加收纳空间';
        document.getElementById('storageName').value = '';
        document.getElementById('storageType').value = 'cabinet';
        document.getElementById('storageCapacity').value = 20;
        document.getElementById('storageNotes').value = '';

        populateStorageParentSelect(null);

        showModal('storageModal');
    }

    function openStorageEditModal(storageId) {
        const storage = Storage.getStorageById(storageId);
        if (!storage) return;

        editingStorageId = storageId;
        document.getElementById('storageModalTitle').textContent = '编辑收纳空间';
        document.getElementById('storageName').value = storage.name;
        document.getElementById('storageType').value = storage.type;
        document.getElementById('storageCapacity').value = storage.capacity;
        document.getElementById('storageNotes').value = storage.notes || '';

        populateStorageParentSelect(storage);

        showModal('storageModal');
    }

    function populateStorageParentSelect(currentStorage) {
        const select = document.getElementById('storageParent');
        const currentRoomId = Storage.getCurrentRoomId();
        const storages = Storage.getStorages(currentRoomId);

        let html = '<option value="">-- 顶级收纳空间 --</option>';

        function addOptions(parentId, prefix, excludeId) {
            storages.filter(s => s.parentId === parentId && s.id !== excludeId).forEach(s => {
                html += `<option value="${s.id}">${prefix}${Storage.getStorageTypeIcon(s.type)} ${escapeHtml(s.name)}</option>`;
                addOptions(s.id, prefix + '　', excludeId);
            });
        }

        addOptions(null, '', currentStorage ? currentStorage.id : null);
        select.innerHTML = html;

        if (currentStorage) {
            select.value = currentStorage.parentId || '';
        }
    }

    function saveStorage() {
        const name = document.getElementById('storageName').value.trim();
        if (!name) {
            showToast('请输入收纳空间名称', 'error');
            return;
        }

        const data = {
            name,
            type: document.getElementById('storageType').value,
            capacity: parseInt(document.getElementById('storageCapacity').value) || 20,
            notes: document.getElementById('storageNotes').value.trim(),
            parentId: document.getElementById('storageParent').value || null
        };

        if (editingStorageId) {
            Storage.updateStorage(editingStorageId, data);
            showToast('收纳空间已更新', 'success');
        } else {
            const roomId = Storage.getCurrentRoomId();
            const newStorage = Storage.addStorage({ ...data, roomId });
            StorageTree.setSelectedStorage(newStorage.id);
            showToast('收纳空间已添加', 'success');
        }

        hideModal('storageModal');
        refreshAll();
    }

    function openSeasonModal() {
        showModal('seasonModal');
        renderSeasonContent(currentSeason);

        document.querySelectorAll('.season-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.season === currentSeason);
        });
    }

    function renderSeasonContent(season) {
        const container = document.getElementById('seasonContent');
        const seasonItems = Storage.getItemsBySeason(season);
        const offSeasonItems = Storage.getOffSeasonItems(season);

        let html = `
            <div class="season-section">
                <h4>✅ 当前季节可用物品 (${seasonItems.length})</h4>
        `;

        if (seasonItems.length === 0) {
            html += '<p style="color:#999;padding:10px;">暂无本季节物品</p>';
        } else {
            html += '<div class="season-item-list">';
            seasonItems.forEach(item => {
                const loc = Storage.getStorageById(item.locationId);
                const locName = loc ? Storage.getStorageFullPath(item.locationId) : '-';
                html += `
                    <div class="season-item" data-id="${item.id}">
                        <span>${Items.getCategoryEmoji(item.category)} <strong>${escapeHtml(item.name)}</strong> ×${item.quantity}</span>
                        <span style="color:#888;font-size:12px;">📍 ${escapeHtml(locName)}</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        html += `
            </div>
            <div class="season-section">
                <h4>📦 换季收纳建议 - 非当季物品 (${offSeasonItems.length})</h4>
        `;

        if (offSeasonItems.length === 0) {
            html += '<p style="color:#999;padding:10px;">所有物品都是当季或四季可用的 👍</p>';
        } else {
            html += '<div class="season-item-list">';
            offSeasonItems.forEach(item => {
                const loc = Storage.getStorageById(item.locationId);
                const locName = loc ? Storage.getStorageFullPath(item.locationId) : '-';
                const seasons = (item.seasons || []).map(s => Storage.getSeasonName(s)).join('、');
                html += `
                    <div class="season-item" data-id="${item.id}" style="background:#fff8e1;">
                        <div>
                            <div>${Items.getCategoryEmoji(item.category)} <strong>${escapeHtml(item.name)}</strong> ×${item.quantity}</div>
                            <div style="font-size:12px;color:#888;">适用季节：${seasons}</div>
                        </div>
                        <span style="color:#888;font-size:12px;">📍 ${escapeHtml(locName)}</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        html += '</div>';

        const idleItems = Storage.getIdleItems(180);
        if (idleItems.length > 0) {
            html += `
                <div class="season-section">
                    <h4>💤 闲置提醒 - 超过半年未使用 (${idleItems.length})</h4>
                    <div class="season-item-list">
            `;
            idleItems.slice(0, 10).forEach(item => {
                const loc = Storage.getStorageById(item.locationId);
                const locName = loc ? Storage.getStorageFullPath(item.locationId) : '-';
                html += `
                    <div class="season-item" data-id="${item.id}" style="background:#e8f5e9;">
                        <span>${Items.getCategoryEmoji(item.category)} <strong>${escapeHtml(item.name)}</strong> ×${item.quantity}</span>
                        <span style="color:#888;font-size:12px;">📍 ${escapeHtml(locName)}</span>
                    </div>
                `;
            });
            html += '</div></div>';
        }

        container.innerHTML = html;

        container.querySelectorAll('.season-item').forEach(el => {
            el.addEventListener('click', () => {
                const item = Storage.getItemById(el.dataset.id);
                if (item) {
                    hideModal('seasonModal');
                    onItemSelected(item);
                    Items.showLocationHint(item);
                }
            });
        });
    }

    function renderSeasonInfo() {
        document.getElementById('currentSeason').textContent = Storage.getSeasonName(currentSeason);

        const allItems = Storage.getItems();
        const counts = { spring: 0, summer: 0, autumn: 0, winter: 0, 'all-season': 0 };
        allItems.forEach(item => {
            (item.seasons || []).forEach(s => {
                if (counts[s] !== undefined) counts[s]++;
            });
        });

        const container = document.getElementById('seasonItemsSummary');
        container.innerHTML = `
            <div class="season-stat"><span>🌸 春季物品</span><strong>${counts.spring}</strong></div>
            <div class="season-stat"><span>☀️ 夏季物品</span><strong>${counts.summer}</strong></div>
            <div class="season-stat"><span>🍂 秋季物品</span><strong>${counts.autumn}</strong></div>
            <div class="season-stat"><span>❄️ 冬季物品</span><strong>${counts.winter}</strong></div>
            <div class="season-stat"><span>🌀 四季物品</span><strong>${counts['all-season']}</strong></div>
        `;
    }

    function onTreeStorageSelected(storage) {
        if (storage) {
            Items.render(storage.id);
            FloorPlan.clearSelection();
        }
    }

    function onFloorplanStorageSelected(storage) {
        if (storage) {
            Items.render(storage.id);
            StorageTree.setSelectedStorage(storage.id);
        } else {
            Items.render();
        }
    }

    function onItemSelected(item) {
        Items.showLocationHint(item);
    }

    function onLocateItem(item) {
        locateOnFloorplan(item.locationId);
    }

    function locateOnFloorplan(storageId) {
        const storage = Storage.getStorageById(storageId);
        if (!storage) return;

        let topLevel = storage;
        while (topLevel.parentId) {
            topLevel = Storage.getStorageById(topLevel.parentId);
        }

        if (topLevel.roomId !== Storage.getCurrentRoomId()) {
            Storage.setCurrentRoomId(topLevel.roomId);
            switchRoom(topLevel.roomId);
        }

        setTimeout(() => {
            FloorPlan.highlightStorage(topLevel.id);
        }, 100);

        showToast(`已在平面图上高亮显示 "${storage.name}"`, 'info');
    }

    function refreshAll() {
        const currentRoomId = Storage.getCurrentRoomId();
        if (!currentRoomId) {
            const rooms = Storage.getRooms();
            if (rooms.length > 0) {
                Storage.setCurrentRoomId(rooms[0].id);
            }
        }

        renderRoomTabs();
        FloorPlan.init(Storage.getCurrentRoomId());
        StorageTree.init(Storage.getCurrentRoomId());
        Items.init();
        Items.renderReminders();
        renderSeasonInfo();
    }

    return {
        init,
        locateOnFloorplan
    };
})();

function showModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

function hideModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
