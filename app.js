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
        setupPlanMode();

        StorageTree.on('storageSelected', onTreeStorageSelected);
        FloorPlan.on('storageSelected', onFloorplanStorageSelected);
        FloorPlan.on('storageChanged', refreshAll);
        FloorPlan.on('storageEdit', (storage) => openStorageEditModal(storage.id));

        Items.on('itemsChanged', refreshAll);
        Items.on('itemSelected', onItemSelected);
        Items.on('locateItem', onLocateItem);

        ExportTool.init();

        PlanEngine.on('planModeChanged', onPlanModeChanged);
        PlanEngine.on('planChanged', onPlanChanged);
        PlanEngine.on('selectionChanged', onPlanSelectionChanged);
        PlanEngine.on('plansListChanged', renderSavedPlansList);
        PlanEngine.on('planApplied', () => {
            showToast('方案已成功应用到正式数据', 'success');
            refreshAll();
        });
        PlanEngine.on('planSaved', () => {
            showToast('方案已保存', 'success');
        });

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
            if (PlanEngine.isActive()) {
                showToast('方案模式下不能直接添加房间', 'warning');
                return;
            }
            openRoomAddModal();
        });

        document.getElementById('btnAddStorage').addEventListener('click', () => {
            if (PlanEngine.isActive()) {
                showToast('方案模式下不能直接添加收纳空间', 'warning');
                return;
            }
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

    function setupPlanMode() {
        document.getElementById('btnPlanMode').addEventListener('click', openPlanModal);

        document.getElementById('btnPlanNew').addEventListener('click', () => {
            hideModal('planModal');
            PlanEngine.enterPlanMode();
        });

        document.getElementById('btnPlanSummary').addEventListener('click', openPlanSummaryModal);
        document.getElementById('btnPlanSave').addEventListener('click', openPlanSaveModal);
        document.getElementById('btnPlanApply').addEventListener('click', applyCurrentPlan);
        document.getElementById('btnPlanDiscard').addEventListener('click', () => {
            PlanEngine.exitPlanMode(false);
        });

        document.getElementById('btnPlanConfirmSave').addEventListener('click', () => {
            const name = document.getElementById('planSaveName').value.trim() || '未命名方案';
            const desc = document.getElementById('planSaveDesc').value.trim();
            PlanEngine.saveCurrentPlan(name, desc);
            hideModal('planSaveModal');
        });

        document.getElementById('btnPlanSelectFiltered').addEventListener('click', () => {
            PlanEngine.selectFilteredItems();
            showToast(`已选中 ${PlanEngine.getSelectedItemIds().length} 件物品`, 'info');
        });
        document.getElementById('btnPlanClearSelection').addEventListener('click', () => {
            PlanEngine.clearSelection();
        });

        document.getElementById('planFilterSeason').addEventListener('change', (e) => {
            const seasons = e.target.value ? [e.target.value] : [];
            PlanEngine.setBatchFilters({ seasons });
        });
        document.getElementById('planFilterCategory').addEventListener('change', (e) => {
            const categories = e.target.value ? [e.target.value] : [];
            PlanEngine.setBatchFilters({ categories });
        });
        document.getElementById('planFilterIdle').addEventListener('change', (e) => {
            PlanEngine.setBatchFilters({ idleOnly: e.target.checked });
        });

        document.getElementById('btnPlanBatchMove').addEventListener('click', openBatchMoveModal);
        document.getElementById('btnPlanBatchSwap').addEventListener('click', openBatchSwapModal);
        document.getElementById('btnPlanAdjustCapacity').addEventListener('click', openAdjustCapacityModal);
        document.getElementById('btnPlanResetChanges').addEventListener('click', () => {
            if (confirm('确定要重置所有方案改动吗？')) {
                PlanEngine.resetAllChanges();
                showToast('已重置所有改动', 'info');
            }
        });

        document.getElementById('btnConfirmBatchMove').addEventListener('click', confirmBatchMove);
        document.getElementById('btnConfirmBatchSwap').addEventListener('click', confirmBatchSwap);
        document.getElementById('btnConfirmAdjustCapacity').addEventListener('click', confirmAdjustCapacity);

        document.getElementById('batchMoveTarget').addEventListener('change', updateBatchMoveTargetInfo);
        document.getElementById('adjustCapacityStorage').addEventListener('change', updateAdjustCapacityInfo);

        document.getElementById('btnSwapUseSelectedA').addEventListener('click', () => {
            const ids = PlanEngine.getSelectedItemIds();
            updateSwapGroupA(ids);
        });
    }

    function onPlanModeChanged(data) {
        const appContainer = document.querySelector('.app-container');
        const toolbar = document.getElementById('planToolbar');
        const badge = document.getElementById('planModeBadge');
        const capacityPanel = document.getElementById('capacityPanel');
        const planBtn = document.getElementById('btnPlanMode');

        if (data.active) {
            appContainer.classList.add('plan-mode-active');
            toolbar.classList.remove('hidden');
            badge.classList.remove('hidden');
            capacityPanel.classList.remove('hidden');
            planBtn.textContent = '📋 退出方案模式';
            const plan = PlanEngine.getCurrentPlan();
            if (plan) {
                document.getElementById('planModePlanName').textContent = plan.name;
            }
        } else {
            appContainer.classList.remove('plan-mode-active');
            toolbar.classList.add('hidden');
            badge.classList.add('hidden');
            capacityPanel.classList.add('hidden');
            planBtn.textContent = '📋 整理方案';
        }
        refreshAll();
    }

    function onPlanChanged() {
        refreshPlanUI();
        Items.render();
        FloorPlan.refresh();
        StorageTree.refresh();
        renderCapacityPanel();
    }

    function onPlanSelectionChanged(data) {
        document.getElementById('planSelectionCount').textContent = `已选 ${data.selected.length} 件`;
        Items.render();
    }

    function refreshPlanUI() {
        const plan = PlanEngine.getCurrentPlan();
        if (!plan) return;
        const changeCount = Object.keys(plan.itemMoves).length + Object.keys(plan.storageChanges).length;
        document.getElementById('planChangeCount').textContent = `${changeCount} 项改动`;
        document.getElementById('planModePlanName').textContent = plan.name;
    }

    function openPlanModal() {
        if (PlanEngine.isActive()) {
            if (PlanEngine.hasChanges()) {
                if (confirm('方案中还有未应用的改动，确定要退出吗？')) {
                    PlanEngine.exitPlanMode(true);
                }
            } else {
                PlanEngine.exitPlanMode(false);
            }
            return;
        }
        renderSavedPlansList();
        showModal('planModal');
    }

    function renderSavedPlansList() {
        const plans = PlanEngine.getAllSavedPlans();
        const container = document.getElementById('savedPlansList');
        const empty = document.getElementById('savedPlansEmpty');

        if (plans.length === 0) {
            container.innerHTML = '';
            empty.style.display = 'block';
            return;
        }

        empty.style.display = 'none';
        container.innerHTML = plans.map(plan => {
            const moveCount = Object.keys(plan.itemMoves || {}).length;
            const storageCount = Object.keys(plan.storageChanges || {}).length;
            const dateStr = plan.appliedAt
                ? `已应用: ${new Date(plan.appliedAt).toLocaleString('zh-CN')}`
                : `更新于: ${new Date(plan.updatedAt).toLocaleString('zh-CN')}`;
            return `
                <div class="saved-plan-card" data-id="${plan.id}">
                    <div class="saved-plan-header">
                        <span class="saved-plan-name">📋 ${escapeHtml(plan.name)}</span>
                        ${plan.appliedAt ? '<span class="plan-stat-value accent" style="font-size:12px;">已应用</span>' : ''}
                    </div>
                    <div class="saved-plan-meta">${dateStr}</div>
                    ${plan.description ? `<div style="font-size:12px;color:#666;margin-bottom:8px;">${escapeHtml(plan.description)}</div>` : ''}
                    <div class="saved-plan-stats">
                        <span>📦 迁移物品: ${moveCount}</span>
                        <span>📏 调整容量: ${storageCount}</span>
                    </div>
                    <div class="saved-plan-actions">
                        <button class="btn btn-sm btn-primary" data-action="load" data-id="${plan.id}">加载方案</button>
                        ${!plan.appliedAt ? `<button class="btn btn-sm btn-accent" data-action="apply" data-id="${plan.id}">直接应用</button>` : ''}
                        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${plan.id}">删除</button>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                if (action === 'load') {
                    hideModal('planModal');
                    PlanEngine.enterPlanMode(id);
                } else if (action === 'apply') {
                    if (confirm('确定要直接应用这个保存的方案到正式数据吗？')) {
                        PlanEngine.enterPlanMode(id);
                        setTimeout(() => {
                            PlanEngine.applyPlan();
                        }, 100);
                    }
                } else if (action === 'delete') {
                    if (confirm('确定要删除这个保存的方案吗？')) {
                        PlanEngine.deleteSavedPlan(id);
                        renderSavedPlansList();
                        showToast('方案已删除', 'success');
                    }
                }
            });
        });
    }

    function openPlanSummaryModal() {
        const summary = PlanEngine.getPlanSummary();
        const diffs = PlanEngine.getDiffReport();
        if (!summary) return;

        let html = `
            <div class="plan-summary-section">
                <h4>📊 方案概览</h4>
                <div class="plan-summary-stats">
                    <div class="plan-stat-card">
                        <div class="plan-stat-value">${summary.movedItemsCount}</div>
                        <div class="plan-stat-label">📦 迁移物品</div>
                    </div>
                    <div class="plan-stat-card">
                        <div class="plan-stat-value">${summary.adjustedStoragesCount}</div>
                        <div class="plan-stat-label">📏 调整容量</div>
                    </div>
                    <div class="plan-stat-card">
                        <div class="plan-stat-value">${summary.affectedStoragesCount}</div>
                        <div class="plan-stat-label">🗄️ 受影响空间</div>
                    </div>
                    <div class="plan-stat-card ${summary.overCapacityCount > 0 ? 'danger' : ''}">
                        <div class="plan-stat-value ${summary.overCapacityCount > 0 ? 'danger' : ''}">${summary.overCapacityCount}</div>
                        <div class="plan-stat-label">⚠️ 超容空间</div>
                    </div>
                </div>
            </div>
        `;

        if (summary.overCapacityCount > 0) {
            html += `
                <div class="plan-summary-section">
                    <h4>⚠️ 超容预警</h4>
                    <div class="plan-diff-list">
                        ${summary.overCapacityStorages.map(s => `
                            <div class="plan-diff-item capacity">
                                <span>🗄️ <strong>${escapeHtml(s.name)}</strong></span>
                                <span class="plan-diff-from">容量:${s.info.planned.capacity}</span>
                                <span class="plan-diff-to">物品:${s.info.planned.count}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (diffs.length > 0) {
            html += `
                <div class="plan-summary-section">
                    <h4>📝 改动详情 (${diffs.length})</h4>
                    <div class="plan-diff-list">
                        ${diffs.map(d => {
                            if (d.type === 'move') {
                                return `
                                    <div class="plan-diff-item move">
                                        <span>📦 <strong>${escapeHtml(d.itemName)}</strong></span>
                                        <span class="plan-diff-from">${escapeHtml(d.fromPath)}</span>
                                        <span>→</span>
                                        <span class="plan-diff-to">${escapeHtml(d.toPath)}</span>
                                        <button class="btn btn-sm" onclick="PlanEngine.resetItemMove('${d.itemId}');App.refreshPlanFromOutside();" style="margin-left:auto;padding:2px 8px;font-size:11px;">↩️ 撤销</button>
                                    </div>
                                `;
                            } else {
                                return `
                                    <div class="plan-diff-item capacity">
                                        <span>📏 <strong>${escapeHtml(d.storageName)}</strong></span>
                                        <span class="plan-diff-from">容量:${d.oldCapacity}</span>
                                        <span>→</span>
                                        <span class="plan-diff-to">容量:${d.newCapacity}</span>
                                    </div>
                                `;
                            }
                        }).join('')}
                    </div>
                </div>
            `;
        } else {
            html += '<p style="color:#999;text-align:center;padding:20px;">暂无改动</p>';
        }

        document.getElementById('planSummaryContent').innerHTML = html;
        showModal('planSummaryModal');
    }

    function openPlanSaveModal() {
        const plan = PlanEngine.getCurrentPlan();
        if (!plan) return;
        document.getElementById('planSaveName').value = plan.name || '';
        document.getElementById('planSaveDesc').value = plan.description || '';
        showModal('planSaveModal');
    }

    function applyCurrentPlan() {
        const summary = PlanEngine.getPlanSummary();
        if (!summary || summary.movedItemsCount === 0 && summary.adjustedStoragesCount === 0) {
            showToast('方案中没有任何改动', 'warning');
            return;
        }
        let msg = `确定要应用方案吗？\n\n将执行:\n- 迁移 ${summary.movedItemsCount} 件物品\n- 调整 ${summary.adjustedStoragesCount} 个收纳空间`;
        if (summary.overCapacityCount > 0) {
            msg += `\n\n⚠️ 警告: 有 ${summary.overCapacityCount} 个收纳空间将超容！`;
        }
        if (confirm(msg)) {
            PlanEngine.applyPlan();
        }
    }

    function renderCapacityPanel() {
        const list = PlanEngine.getAllCapacityInfo();
        const container = document.getElementById('capacityList');
        const empty = document.getElementById('capacityEmpty');

        if (list.length === 0) {
            container.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        container.innerHTML = list.map(info => {
            const origUsage = Math.min(100, info.original.usage);
            const planUsage = Math.min(100, info.planned.usage);
            const origClass = info.original.overCapacity ? 'danger' : (origUsage > 80 ? 'warning' : 'normal');
            const planClass = info.planned.overCapacity ? 'danger' : (planUsage > 80 ? 'warning' : 'normal');
            const delta = info.delta.count;
            const deltaClass = delta > 0 ? 'plus' : 'minus';
            const deltaSign = delta > 0 ? '+' : '';

            return `
                <div class="capacity-item ${info.planned.overCapacity ? 'over-capacity' : ''}">
                    <div class="capacity-item-header">
                        <span>🗄️ ${escapeHtml(info.storageName)}</span>
                        <span class="capacity-delta ${deltaClass}">${deltaSign}${delta}</span>
                    </div>
                    <div class="capacity-legend">
                        <span class="legend-original">原 ${info.original.count}/${info.original.capacity} (${origUsage.toFixed(0)}%)</span>
                        <span class="legend-planned">方案 ${info.planned.count}/${info.planned.capacity} (${planUsage.toFixed(0)}%)</span>
                    </div>
                    <div class="capacity-bar-container" style="position:relative;">
                        <div class="capacity-bar ${origClass}" style="width:${origUsage}%;opacity:0.4;"></div>
                        <div class="capacity-bar plan-bar ${planClass}" style="width:${planUsage}%;"></div>
                    </div>
                    <div class="capacity-stats">
                        <span>空闲: ${info.original.free} → ${info.planned.free}</span>
                        ${info.planned.overCapacity ? '<span style="color:#d9534f;font-weight:600;">⚠️ 超容</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    function openBatchMoveModal() {
        const ids = PlanEngine.getSelectedItemIds();
        if (ids.length === 0) {
            showToast('请先选择要迁移的物品', 'warning');
            return;
        }
        document.getElementById('batchMoveCount').textContent = ids.length;
        populateStorageSelectForMove();
        updateBatchMoveTargetInfo();
        showModal('batchMoveModal');
    }

    function populateStorageSelectForMove() {
        const select = document.getElementById('batchMoveTarget');
        const rooms = Storage.getRooms();
        let html = '';
        rooms.forEach(room => {
            html += `<optgroup label="${room.icon} ${room.name}">`;
            const storages = Storage.getStorages(room.id);
            function addOptions(parentId, prefix) {
                storages.filter(s => s.parentId === parentId).forEach(s => {
                    const capInfo = PlanEngine.getStorageCapacityInfo(s.id);
                    const count = capInfo ? capInfo.planned.count : Storage.getItemsWithChildren(s.id).length;
                    const capacity = capInfo ? capInfo.planned.capacity : s.capacity;
                    const suffix = ` (${count}/${capacity})`;
                    html += `<option value="${s.id}">${prefix}${Storage.getStorageTypeIcon(s.type)} ${s.name}${suffix}</option>`;
                    addOptions(s.id, prefix + '　');
                });
            }
            addOptions(null, '');
            html += '</optgroup>';
        });
        select.innerHTML = html;
    }

    function updateBatchMoveTargetInfo() {
        const targetId = document.getElementById('batchMoveTarget').value;
        const infoEl = document.getElementById('batchMoveTargetInfo');
        if (!targetId) {
            infoEl.innerHTML = '';
            return;
        }
        const capInfo = PlanEngine.getStorageCapacityInfo(targetId);
        const selectedIds = PlanEngine.getSelectedItemIds();
        const moveCount = selectedIds.length;
        const plannedAfter = capInfo ? capInfo.planned.count + moveCount : 0;
        const capacity = capInfo ? capInfo.planned.capacity : 0;

        if (plannedAfter > capacity) {
            infoEl.className = 'batch-target-info over-danger';
            infoEl.innerHTML = `⚠️ 迁移后将超容！当前 ${capInfo.planned.count}/${capacity}，迁移后 ${plannedAfter}/${capacity}（超出 ${plannedAfter - capacity} 件）`;
        } else if (plannedAfter > capacity * 0.8) {
            infoEl.className = 'batch-target-info over-warning';
            infoEl.innerHTML = `⚡ 迁移后占用率较高: ${capInfo.planned.count}/${capacity} → ${plannedAfter}/${capacity}（${(plannedAfter / capacity * 100).toFixed(0)}%）`;
        } else {
            infoEl.className = 'batch-target-info';
            infoEl.innerHTML = `✅ 迁移后: ${capInfo.planned.count}/${capacity} → ${plannedAfter}/${capacity}（空闲 ${capacity - plannedAfter}）`;
        }
    }

    function confirmBatchMove() {
        const targetId = document.getElementById('batchMoveTarget').value;
        if (!targetId) {
            showToast('请选择目标收纳空间', 'error');
            return;
        }
        const ids = PlanEngine.getSelectedItemIds();
        const count = PlanEngine.batchMoveItems(ids, targetId);
        hideModal('batchMoveModal');
        PlanEngine.clearSelection();
        showToast(`已将 ${count} 件物品加入迁移方案`, 'success');
    }

    function openBatchSwapModal() {
        populateSwapGroupBSelect();
        updateSwapGroupA(PlanEngine.getSelectedItemIds());
        showModal('batchSwapModal');
    }

    function updateSwapGroupA(ids) {
        document.getElementById('swapGroupACount').textContent = ids.length;
        const container = document.getElementById('swapGroupAItems');
        if (ids.length === 0) {
            container.innerHTML = '<span style="color:#999;">未选择</span>';
            return;
        }
        container.innerHTML = ids.slice(0, 8).map(id => {
            const item = Storage.getItemById(id);
            return item ? `<span>${escapeHtml(item.name)}</span>` : '';
        }).join('、') + (ids.length > 8 ? ` 等 ${ids.length} 件` : '');
    }

    function populateSwapGroupBSelect() {
        const select = document.getElementById('swapGroupB');
        const rooms = Storage.getRooms();
        let html = '<option value="">选择收纳空间作为 B 组位置</option>';
        rooms.forEach(room => {
            html += `<optgroup label="${room.icon} ${room.name}">`;
            const storages = Storage.getStorages(room.id);
            function addOptions(parentId, prefix) {
                storages.filter(s => s.parentId === parentId).forEach(s => {
                    html += `<option value="${s.id}">${prefix}${Storage.getStorageTypeIcon(s.type)} ${s.name}</option>`;
                    addOptions(s.id, prefix + '　');
                });
            }
            addOptions(null, '');
            html += '</optgroup>';
        });
        select.innerHTML = html;
    }

    function confirmBatchSwap() {
        const groupAIds = PlanEngine.getSelectedItemIds();
        const targetB = document.getElementById('swapGroupB').value;
        if (groupAIds.length === 0) {
            showToast('请先选择 A 组物品', 'warning');
            return;
        }
        if (!targetB) {
            showToast('请选择 B 组收纳空间', 'warning');
            return;
        }
        const bItems = PlanEngine.getPlannedItemsByStorage(targetB);
        const bIds = bItems.map(i => i.id);

        const aOrigLocations = {};
        groupAIds.forEach(id => {
            aOrigLocations[id] = PlanEngine.getOriginalItemLocation(id);
        });

        let aTarget = null;
        for (const id of groupAIds) {
            const orig = PlanEngine.getItemPlannedLocation(id) || aOrigLocations[id];
            if (orig && orig !== targetB) {
                aTarget = orig;
                break;
            }
        }
        if (!aTarget && groupAIds.length > 0) {
            const firstItem = Storage.getItemById(groupAIds[0]);
            if (firstItem) aTarget = firstItem.locationId;
        }

        bIds.forEach(id => {
            if (aTarget) PlanEngine.moveItem(id, aTarget);
        });
        groupAIds.forEach(id => {
            PlanEngine.moveItem(id, targetB);
        });

        hideModal('batchSwapModal');
        PlanEngine.clearSelection();
        showToast(`已完成换位：A组 ${groupAIds.length} 件 ↔ B组 ${bIds.length} 件`, 'success');
    }

    function openAdjustCapacityModal() {
        const select = document.getElementById('adjustCapacityStorage');
        const rooms = Storage.getRooms();
        let html = '';
        rooms.forEach(room => {
            html += `<optgroup label="${room.icon} ${room.name}">`;
            const storages = Storage.getStorages(room.id);
            function addOptions(parentId, prefix) {
                storages.filter(s => s.parentId === parentId).forEach(s => {
                    html += `<option value="${s.id}">${prefix}${Storage.getStorageTypeIcon(s.type)} ${s.name}</option>`;
                    addOptions(s.id, prefix + '　');
                });
            }
            addOptions(null, '');
            html += '</optgroup>';
        });
        select.innerHTML = html;
        updateAdjustCapacityInfo();
        showModal('adjustCapacityModal');
    }

    function updateAdjustCapacityInfo() {
        const storageId = document.getElementById('adjustCapacityStorage').value;
        const infoEl = document.getElementById('adjustCapacityInfo');
        const valueInput = document.getElementById('adjustCapacityValue');
        if (!storageId) {
            infoEl.innerHTML = '';
            return;
        }
        const capInfo = PlanEngine.getStorageCapacityInfo(storageId);
        if (capInfo) {
            valueInput.value = capInfo.planned.capacity;
            infoEl.innerHTML = `
                当前物品数: <strong>${capInfo.planned.count}</strong><br>
                当前容量: <strong>${capInfo.original.capacity}</strong>
                ${capInfo.planned.overCapacity ? ' <span style="color:#d9534f;">（⚠️ 已超容）</span>' : ''}
                ${capInfo.delta.capacity !== 0 ? ` <span style="color:#ff9500;">（方案已调整为 ${capInfo.planned.capacity}）</span>` : ''}
            `;
        }
    }

    function confirmAdjustCapacity() {
        const storageId = document.getElementById('adjustCapacityStorage').value;
        const newCapacity = parseInt(document.getElementById('adjustCapacityValue').value);
        if (!storageId) {
            showToast('请选择收纳空间', 'error');
            return;
        }
        if (!newCapacity || newCapacity < 1) {
            showToast('请输入有效的容量值', 'error');
            return;
        }
        PlanEngine.adjustStorageCapacity(storageId, newCapacity);
        hideModal('adjustCapacityModal');
        showToast('容量调整已加入方案', 'success');
    }

    function refreshPlanFromOutside() {
        onPlanChanged();
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
                    if (PlanEngine.isActive()) {
                        showToast('方案模式下不能删除房间', 'warning');
                        return;
                    }
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
                if (PlanEngine.isActive()) {
                    showToast('方案模式下不能编辑房间', 'warning');
                    return;
                }
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
        if (PlanEngine.isActive()) {
            showToast('方案模式下不能编辑房间', 'warning');
            return;
        }
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
        if (PlanEngine.isActive()) {
            showToast('方案模式下不能直接编辑收纳空间，请使用工具栏的调整容量功能', 'warning');
            return;
        }
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
        locateOnFloorplan,
        refreshPlanFromOutside
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
