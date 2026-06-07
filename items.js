const Items = (function() {
    let currentPhotoData = null;
    let editingItemId = null;
    let listeners = {};

    function init() {
        setupPhotoUploader();
        render();
    }

    function setupPhotoUploader() {
        const preview = document.getElementById('photoPreview');
        const input = document.getElementById('itemPhoto');

        preview.addEventListener('click', () => input.click());

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 2 * 1024 * 1024) {
                showToast('图片大小不能超过 2MB', 'warning');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                currentPhotoData = event.target.result;
                preview.innerHTML = `<img src="${currentPhotoData}" alt="预览">`;
            };
            reader.readAsDataURL(file);
        });
    }

    function openAddModal(defaultLocationId) {
        if (PlanEngine.isActive()) {
            showToast('方案模式下不能直接添加物品，请先退出方案模式', 'warning');
            return;
        }
        editingItemId = null;
        currentPhotoData = null;
        document.getElementById('itemModalTitle').textContent = '添加物品';

        document.getElementById('itemName').value = '';
        document.getElementById('itemCategory').value = 'clothing';
        document.getElementById('itemQuantity').value = 1;
        document.getElementById('itemExpiry').value = '';
        document.getElementById('itemLastUsed').value = '';
        document.getElementById('itemNotes').value = '';
        document.getElementById('itemPhoto').value = '';
        document.getElementById('photoPreview').innerHTML = '<span class="photo-placeholder">📷 点击上传照片</span>';

        document.querySelectorAll('.season-tags input[type="checkbox"]').forEach(cb => {
            cb.checked = cb.value === 'all-season';
        });

        populateLocationSelect();
        if (defaultLocationId) {
            document.getElementById('itemLocation').value = defaultLocationId;
        }

        showModal('itemModal');
    }

    function openEditModal(itemId) {
        const item = Storage.getItemById(itemId);
        if (!item) return;

        editingItemId = itemId;
        currentPhotoData = item.photo;
        document.getElementById('itemModalTitle').textContent = '编辑物品';

        document.getElementById('itemName').value = item.name;
        document.getElementById('itemCategory').value = item.category;
        document.getElementById('itemQuantity').value = item.quantity;
        document.getElementById('itemExpiry').value = item.expiry || '';
        document.getElementById('itemLastUsed').value = item.lastUsed || '';
        document.getElementById('itemNotes').value = item.notes || '';

        document.querySelectorAll('.season-tags input[type="checkbox"]').forEach(cb => {
            cb.checked = item.seasons.includes(cb.value);
        });

        populateLocationSelect();
        document.getElementById('itemLocation').value = item.locationId;

        const preview = document.getElementById('photoPreview');
        if (item.photo) {
            preview.innerHTML = `<img src="${item.photo}" alt="预览">`;
        } else {
            preview.innerHTML = '<span class="photo-placeholder">📷 点击上传照片</span>';
        }

        showModal('itemModal');
    }

    function saveItem() {
        if (PlanEngine.isActive()) {
            showToast('方案模式下不能直接编辑物品', 'warning');
            return;
        }
        const name = document.getElementById('itemName').value.trim();
        if (!name) {
            showToast('请输入物品名称', 'error');
            return;
        }

        const locationId = document.getElementById('itemLocation').value;
        if (!locationId) {
            showToast('请选择存放位置', 'error');
            return;
        }

        const seasons = [];
        document.querySelectorAll('.season-tags input[type="checkbox"]:checked').forEach(cb => {
            seasons.push(cb.value);
        });
        if (seasons.length === 0) {
            seasons.push('all-season');
        }

        const itemData = {
            name,
            category: document.getElementById('itemCategory').value,
            locationId,
            quantity: parseInt(document.getElementById('itemQuantity').value) || 1,
            seasons,
            expiry: document.getElementById('itemExpiry').value || null,
            lastUsed: document.getElementById('itemLastUsed').value || null,
            photo: currentPhotoData,
            notes: document.getElementById('itemNotes').value.trim()
        };

        if (editingItemId) {
            Storage.updateItem(editingItemId, itemData);
            showToast('物品已更新', 'success');
        } else {
            Storage.addItem(itemData);
            showToast('物品已添加', 'success');
        }

        hideModal('itemModal');
        emit('itemsChanged');
        render();
    }

    function deleteItem(itemId) {
        const item = Storage.getItemById(itemId);
        if (!item) return;
        if (!confirm(`确定要删除"${item.name}"吗？`)) return;

        Storage.deleteItem(itemId);
        showToast('物品已删除', 'success');
        emit('itemsChanged');
        render();
    }

    function populateLocationSelect() {
        const select = document.getElementById('itemLocation');
        const rooms = Storage.getRooms();
        let html = '';

        rooms.forEach(room => {
            html += `<optgroup label="${room.icon} ${room.name}">`;
            const storages = Storage.getStorages(room.id);
            function addOptions(parentId, prefix) {
                storages.filter(s => s.parentId === parentId).forEach(s => {
                    const count = Storage.getItems(s.id).length;
                    const capacity = s.capacity;
                    const disabled = count >= capacity ? 'disabled' : '';
                    const suffix = count >= capacity ? ' (已满)' : ` (${count}/${capacity})`;
                    html += `<option value="${s.id}" ${disabled}>${prefix}${Storage.getStorageTypeIcon(s.type)} ${s.name}${suffix}</option>`;
                    addOptions(s.id, prefix + '　');
                });
            }
            addOptions(null, '');
            html += '</optgroup>';
        });

        if (!html) {
            html = '<option value="">请先添加收纳空间</option>';
        }

        select.innerHTML = html;
    }

    function render(storageId, keyword, seasons) {
        const grid = document.getElementById('itemsGrid');
        const empty = document.getElementById('itemsEmpty');

        let items;
        const isPlanMode = PlanEngine.isActive();

        if (isPlanMode) {
            if (storageId) {
                items = PlanEngine.getPlannedItemsWithChildren(storageId);
            } else if (keyword || (seasons && seasons.length > 0)) {
                const baseItems = PlanEngine.getPlannedItems();
                let results = baseItems;
                if (keyword && keyword.trim()) {
                    const kw = keyword.trim().toLowerCase();
                    results = results.filter(i =>
                        i.name.toLowerCase().includes(kw) ||
                        (i.notes && i.notes.toLowerCase().includes(kw))
                    );
                }
                if (seasons && seasons.length > 0) {
                    results = results.filter(i =>
                        i.seasons.some(s => seasons.includes(s)) ||
                        i.seasons.includes('all-season')
                    );
                }
                items = results;
            } else {
                items = PlanEngine.getPlannedItems();
            }
        } else {
            if (storageId) {
                items = Storage.getItemsWithChildren(storageId);
            } else {
                items = Storage.searchItems(keyword, seasons);
            }
        }

        if (items.length === 0) {
            grid.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        grid.innerHTML = items.map(item => renderItemCard(item)).join('');

        grid.querySelectorAll('.item-card').forEach(card => {
            const id = card.dataset.id;
            const checkbox = card.querySelector('.plan-checkbox');

            if (checkbox) {
                checkbox.addEventListener('click', (e) => {
                    e.stopPropagation();
                    PlanEngine.toggleItemSelection(id);
                });
            }

            card.addEventListener('click', () => {
                if (isPlanMode) {
                    PlanEngine.toggleItemSelection(id);
                } else {
                    emit('itemSelected', Storage.getItemById(id));
                }
            });
            card.querySelector('.btn-edit')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isPlanMode) {
                    showToast('方案模式下请使用批量迁移功能调整位置', 'info');
                } else {
                    openEditModal(id);
                }
            });
            card.querySelector('.btn-delete')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isPlanMode) {
                    showToast('方案模式下不能直接删除物品', 'warning');
                } else {
                    deleteItem(id);
                }
            });
            card.querySelector('.btn-locate')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isPlanMode) {
                    const plannedItem = PlanEngine.getPlannedItemById(id);
                    if (plannedItem) emit('locateItem', plannedItem);
                } else {
                    emit('locateItem', Storage.getItemById(id));
                }
            });
        });
    }

    function renderItemCard(item) {
        const isPlanMode = PlanEngine.isActive();
        const isSelected = isPlanMode && PlanEngine.getSelectedItemIds().includes(item.id);
        const isMoved = isPlanMode && PlanEngine.isItemMoved(item.id);

        let displayLocationId = item.locationId;
        if (isPlanMode && isMoved) {
            displayLocationId = PlanEngine.getItemPlannedLocation(item.id);
        }
        const location = Storage.getStorageById(displayLocationId);
        const locationPath = location ? Storage.getStorageFullPath(displayLocationId) : '未知位置';

        let photoHtml;
        if (item.photo) {
            photoHtml = `<img src="${item.photo}" alt="${escapeHtml(item.name)}">`;
        } else {
            photoHtml = getCategoryEmoji(item.category);
        }

        const tagsHtml = item.seasons.map(s => {
            return `<span class="item-tag ${s}">${Storage.getSeasonName(s)}</span>`;
        }).join('');

        const expiryBadge = item.expiry && isExpiring(item.expiry)
            ? `<span class="item-tag" style="background:#ffebee;color:#c62828;">⚠️ ${formatDate(item.expiry)}到期</span>`
            : '';

        const checkboxHtml = isPlanMode
            ? `<input type="checkbox" class="plan-checkbox" ${isSelected ? 'checked' : ''}>`
            : '';

        let cardClass = 'item-card';
        if (isPlanMode) {
            if (isSelected) cardClass += ' plan-selected';
            if (isMoved) cardClass += ' plan-moved';
        }

        let locationDiffHtml = '';
        if (isPlanMode && isMoved) {
            const origLocId = PlanEngine.getOriginalItemLocation(item.id);
            const origLoc = origLocId ? Storage.getStorageById(origLocId) : null;
            const origPath = origLoc ? Storage.getStorageFullPath(origLocId) : '未知';
            const plannedLoc = Storage.getStorageById(PlanEngine.getItemPlannedLocation(item.id));
            const plannedPath = plannedLoc ? Storage.getStorageFullPath(PlanEngine.getItemPlannedLocation(item.id)) : '未知';
            locationDiffHtml = `
                <div class="plan-location-diff">
                    <span class="diff-from">📍 ${escapeHtml(origPath)}</span>
                    <span class="diff-arrow">→</span>
                    <span class="diff-to">📍 ${escapeHtml(plannedPath)}</span>
                </div>
            `;
        }

        const locationDisplay = isPlanMode && isMoved
            ? `<span style="color:#2e7d32;font-weight:500;" title="${escapeHtml(locationPath)}">📍 ${location ? escapeHtml(location.name) : '-'}</span>`
            : `<span title="${escapeHtml(locationPath)}">📍 ${location ? escapeHtml(location.name) : '-'}</span>`;

        return `
            <div class="${cardClass}" data-id="${item.id}">
                ${checkboxHtml}
                <div class="item-photo">${photoHtml}</div>
                <div class="item-info">
                    <div class="item-name">${escapeHtml(item.name)}</div>
                    <div class="item-meta">
                        <span>×${item.quantity}</span>
                        <span>${getCategoryEmoji(item.category)}</span>
                    </div>
                    <div class="item-tags">
                        ${tagsHtml}
                        ${expiryBadge}
                    </div>
                    ${locationDiffHtml}
                    <div style="margin-top:8px;font-size:12px;color:#888;display:flex;justify-content:space-between;align-items:center;">
                        ${locationDisplay}
                        <span>
                            <button class="btn btn-sm btn-locate" title="定位">📍</button>
                            <button class="btn btn-sm btn-edit" title="编辑">✏️</button>
                            <button class="btn btn-sm btn-delete" title="删除" style="color:#d9534f;">🗑️</button>
                        </span>
                    </div>
                </div>
            </div>
        `;
    }

    function showLocationHint(item) {
        const container = document.getElementById('locationHint');
        if (!item) {
            container.innerHTML = '<p class="hint-empty">从左侧选择或搜索物品查看定位信息</p>';
            return;
        }

        const isPlanMode = PlanEngine.isActive();
        const isMoved = isPlanMode && PlanEngine.isItemMoved(item.id);

        let displayLocationId = item.locationId;
        if (isPlanMode && isMoved) {
            displayLocationId = PlanEngine.getItemPlannedLocation(item.id);
        }

        const fullPath = Storage.getStorageFullPath(displayLocationId);
        const storage = Storage.getStorageById(displayLocationId);
        const room = storage ? Storage.getRooms().find(r => {
            let s = storage;
            while (s && s.parentId) s = Storage.getStorageById(s.parentId);
            return s && s.roomId === r.id;
        }) : null;

        let html = '';
        if (isMoved) {
            const origPath = Storage.getStorageFullPath(PlanEngine.getOriginalItemLocation(item.id));
            html += `
                <div style="background:#fff8e1;border-left:3px solid #ff9500;padding:8px 12px;border-radius:4px;margin-bottom:10px;">
                    <div style="font-size:11px;color:#e65100;margin-bottom:4px;">📋 方案模式 - 位置变更</div>
                    <div style="font-size:12px;text-decoration:line-through;color:#999;">📍 ${escapeHtml(origPath)}</div>
                    <div style="font-size:13px;font-weight:500;color:#2e7d32;margin-top:2px;">📍 ${escapeHtml(fullPath)}</div>
                </div>
            `;
        } else {
            html += `<div class="location-path">📍 ${escapeHtml(fullPath)}</div>`;
        }
        html += `
            <div class="location-detail">
                <div class="location-detail-label">物品名称</div>
                <div><strong>${escapeHtml(item.name)}</strong> × ${item.quantity}</div>
            </div>
            <div class="location-detail">
                <div class="location-detail-label">分类</div>
                <div>${Storage.getCategoryName(item.category)}</div>
            </div>
        `;

        if (item.seasons && item.seasons.length > 0) {
            html += `
                <div class="location-detail">
                    <div class="location-detail-label">季节标签</div>
                    <div>${item.seasons.map(s => Storage.getSeasonName(s)).join('、')}</div>
                </div>
            `;
        }

        if (item.expiry) {
            const expiring = isExpiring(item.expiry);
            html += `
                <div class="location-detail">
                    <div class="location-detail-label">过期日期</div>
                    <div style="color:${expiring ? '#d9534f' : 'inherit'};">
                        ${expiring ? '⚠️ ' : ''}${formatDate(item.expiry)}
                    </div>
                </div>
            `;
        }

        if (item.lastUsed) {
            html += `
                <div class="location-detail">
                    <div class="location-detail-label">最后使用</div>
                    <div>${formatDate(item.lastUsed)}</div>
                </div>
            `;
        }

        if (item.notes) {
            html += `
                <div class="location-detail">
                    <div class="location-detail-label">备注</div>
                    <div style="font-size:12px;color:#666;">${escapeHtml(item.notes)}</div>
                </div>
            `;
        }

        if (room && storage) {
            html += `
                <div style="margin-top:12px;">
                    <button class="btn btn-sm btn-primary btn-block" onclick="App.locateOnFloorplan('${storage.id}')">
                        🗺️ 在平面图上定位
                    </button>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    function renderReminders() {
        const container = document.getElementById('remindersList');
        const empty = document.getElementById('remindersEmpty');

        const reminders = [];

        const expiring = Storage.getExpiringItems(30);
        expiring.forEach(item => {
            const days = getDaysUntil(item.expiry);
            reminders.push({
                type: days < 0 ? 'danger' : 'warning',
                icon: days < 0 ? '❌' : '⚠️',
                text: days < 0
                    ? `"${item.name}" 已过期 ${-days} 天`
                    : `"${item.name}" 将在 ${days} 天后过期`
            });
        });

        const idle = Storage.getIdleItems(180);
        idle.slice(0, 5).forEach(item => {
            reminders.push({
                type: 'info',
                icon: '💤',
                text: `"${item.name}" 超过半年未使用`
            });
        });

        if (reminders.length === 0) {
            container.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        container.innerHTML = reminders.map(r => `
            <div class="reminder-item ${r.type}">
                <span>${r.icon}</span>
                <span>${r.text}</span>
            </div>
        `).join('');
    }

    function on(event, callback) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
    }

    function emit(event, data) {
        if (listeners[event]) {
            listeners[event].forEach(cb => cb(data));
        }
    }

    function getCategoryEmoji(category) {
        const emojis = {
            clothing: '👕',
            document: '📄',
            kitchen: '🍳',
            electronics: '📱',
            tool: '🔧',
            decoration: '🎨',
            medicine: '💊',
            other: '📦'
        };
        return emojis[category] || '📦';
    }

    function isExpiring(dateStr) {
        if (!dateStr) return false;
        const date = new Date(dateStr);
        const now = new Date();
        const diff = (date - now) / (1000 * 60 * 60 * 24);
        return diff <= 30;
    }

    function getDaysUntil(dateStr) {
        if (!dateStr) return Infinity;
        const date = new Date(dateStr);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        return Math.round((date - now) / (1000 * 60 * 60 * 24));
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return {
        init,
        render,
        openAddModal,
        openEditModal,
        saveItem,
        deleteItem,
        showLocationHint,
        renderReminders,
        populateLocationSelect,
        on,
        formatDate,
        escapeHtml,
        getCategoryEmoji
    };
})();
