const PlanEngine = (function() {
    const PLANS_KEY = 'home_organizer_plans';
    let isPlanMode = false;
    let currentPlan = null;
    let originalSnapshot = null;
    let selectedItemIds = new Set();
    let batchFilters = { seasons: [], categories: [], idleOnly: false };
    let listeners = {};

    function createEmptyPlan(name) {
        return {
            id: 'plan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: name || ('整理方案 ' + new Date().toLocaleString('zh-CN')),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            description: '',
            itemMoves: {},
            storageChanges: {}
        };
    }

    function enterPlanMode(planId) {
        if (isPlanMode) return false;

        originalSnapshot = JSON.parse(JSON.stringify(Storage.exportAllData()));

        if (planId) {
            const saved = loadSavedPlan(planId);
            currentPlan = saved ? JSON.parse(JSON.stringify(saved)) : createEmptyPlan();
        } else {
            currentPlan = createEmptyPlan();
        }

        isPlanMode = true;
        selectedItemIds.clear();
        batchFilters = { seasons: [], categories: [], idleOnly: false };
        emit('planModeChanged', { active: true, plan: currentPlan });
        emit('planChanged', currentPlan);
        return true;
    }

    function exitPlanMode(discardChanges) {
        if (!isPlanMode) return false;

        if (!discardChanges && hasChanges()) {
            if (!confirm('方案中还有未应用的改动，确定要放弃吗？')) return false;
        }

        isPlanMode = false;
        currentPlan = null;
        originalSnapshot = null;
        selectedItemIds.clear();
        batchFilters = { seasons: [], categories: [], idleOnly: false };
        emit('planModeChanged', { active: false });
        return true;
    }

    function isActive() {
        return isPlanMode;
    }

    function getCurrentPlan() {
        return currentPlan;
    }

    function getOriginalData() {
        return originalSnapshot;
    }

    function hasChanges() {
        if (!currentPlan) return false;
        const moveCount = Object.keys(currentPlan.itemMoves).length;
        const storageCount = Object.keys(currentPlan.storageChanges).length;
        return moveCount > 0 || storageCount > 0;
    }

    function getPlannedItems() {
        if (!isPlanMode || !originalSnapshot) return Storage.getItems();
        const items = JSON.parse(JSON.stringify(originalSnapshot.items));
        if (currentPlan) {
            items.forEach(item => {
                if (currentPlan.itemMoves[item.id]) {
                    item.locationId = currentPlan.itemMoves[item.id];
                }
            });
        }
        return items;
    }

    function getPlannedItemById(id) {
        const items = getPlannedItems();
        return items.find(i => i.id === id) || null;
    }

    function getPlannedItemsByStorage(storageId) {
        return getPlannedItems().filter(i => i.locationId === storageId);
    }

    function getPlannedItemsWithChildren(storageId) {
        const allIds = [storageId];
        const rooms = Storage.getRooms();
        let allStorages = [];
        rooms.forEach(r => allStorages = allStorages.concat(Storage.getStorages(r.id)));
        function collectChildren(parentId) {
            const children = allStorages.filter(s => s.parentId === parentId);
            children.forEach(c => {
                allIds.push(c.id);
                collectChildren(c.id);
            });
        }
        collectChildren(storageId);
        return getPlannedItems().filter(i => allIds.includes(i.locationId));
    }

    function getOriginalItemLocation(itemId) {
        if (!originalSnapshot) return null;
        const item = originalSnapshot.items.find(i => i.id === itemId);
        return item ? item.locationId : null;
    }

    function getItemPlannedLocation(itemId) {
        if (!currentPlan || !currentPlan.itemMoves[itemId]) return null;
        return currentPlan.itemMoves[itemId];
    }

    function isItemMoved(itemId) {
        return currentPlan && currentPlan.itemMoves[itemId] !== undefined;
    }

    function moveItem(itemId, targetStorageId) {
        if (!isPlanMode) return false;
        const original = getOriginalItemLocation(itemId);
        if (original === targetStorageId) {
            delete currentPlan.itemMoves[itemId];
        } else {
            currentPlan.itemMoves[itemId] = targetStorageId;
        }
        currentPlan.updatedAt = Date.now();
        emit('planChanged', currentPlan);
        return true;
    }

    function batchMoveItems(itemIds, targetStorageId) {
        if (!isPlanMode) return 0;
        let count = 0;
        itemIds.forEach(id => {
            if (moveItem(id, targetStorageId)) count++;
        });
        return count;
    }

    function swapItems(itemIdA, itemIdB) {
        if (!isPlanMode) return false;
        const locA = getItemPlannedLocation(itemIdA) || getOriginalItemLocation(itemIdA);
        const locB = getItemPlannedLocation(itemIdB) || getOriginalItemLocation(itemIdB);
        if (!locA || !locB) return false;
        moveItem(itemIdA, locB);
        moveItem(itemIdB, locA);
        return true;
    }

    function adjustStorageCapacity(storageId, newCapacity) {
        if (!isPlanMode) return false;
        const original = Storage.getStorageById(storageId);
        if (!original) return false;
        if (original.capacity === newCapacity) {
            delete currentPlan.storageChanges[storageId];
        } else {
            if (!currentPlan.storageChanges[storageId]) {
                currentPlan.storageChanges[storageId] = {};
            }
            currentPlan.storageChanges[storageId].capacity = newCapacity;
        }
        currentPlan.updatedAt = Date.now();
        emit('planChanged', currentPlan);
        return true;
    }

    function getPlannedStorage(id) {
        const storage = Storage.getStorageById(id);
        if (!storage) return null;
        if (currentPlan && currentPlan.storageChanges[id]) {
            return { ...storage, ...currentPlan.storageChanges[id] };
        }
        return { ...storage };
    }

    function getStorageCapacityInfo(storageId) {
        const storage = getPlannedStorage(storageId);
        if (!storage) return null;

        const originalStorage = Storage.getStorageById(storageId);
        const originalItems = Storage.getItemsWithChildren(storageId);
        const plannedItems = getPlannedItemsWithChildren(storageId);

        const originalCount = originalItems.reduce((sum, i) => sum + (i.quantity || 1), 0);
        const plannedCount = plannedItems.reduce((sum, i) => sum + (i.quantity || 1), 0);
        const originalCapacity = originalStorage.capacity;
        const plannedCapacity = storage.capacity;

        const originalUsage = originalCapacity > 0 ? (originalCount / originalCapacity) * 100 : 0;
        const plannedUsage = plannedCapacity > 0 ? (plannedCount / plannedCapacity) * 100 : 0;

        return {
            storageId,
            storageName: storage.name,
            original: {
                count: originalCount,
                capacity: originalCapacity,
                usage: originalUsage,
                free: Math.max(0, originalCapacity - originalCount),
                overCapacity: originalCount > originalCapacity
            },
            planned: {
                count: plannedCount,
                capacity: plannedCapacity,
                usage: plannedUsage,
                free: Math.max(0, plannedCapacity - plannedCount),
                overCapacity: plannedCount > plannedCapacity
            },
            delta: {
                count: plannedCount - originalCount,
                capacity: plannedCapacity - originalCapacity,
                usage: plannedUsage - originalUsage,
                free: (Math.max(0, plannedCapacity - plannedCount)) - (Math.max(0, originalCapacity - originalCount))
            }
        };
    }

    function getAllCapacityInfo() {
        const rooms = Storage.getRooms();
        let allStorages = [];
        rooms.forEach(r => allStorages = allStorages.concat(Storage.getStorages(r.id)));
        return allStorages
            .map(s => getStorageCapacityInfo(s.id))
            .filter(info => info && (info.delta.count !== 0 || info.delta.capacity !== 0 || info.planned.overCapacity || info.original.overCapacity));
    }

    function getPlanSummary() {
        if (!currentPlan) return null;

        const movedItemIds = Object.keys(currentPlan.itemMoves);
        const affectedStorageIds = new Set();

        movedItemIds.forEach(id => {
            const orig = getOriginalItemLocation(id);
            const planned = currentPlan.itemMoves[id];
            if (orig) affectedStorageIds.add(orig);
            if (planned) affectedStorageIds.add(planned);
        });

        Object.keys(currentPlan.storageChanges).forEach(id => affectedStorageIds.add(id));

        const overCapacityStorages = [];
        const rooms = Storage.getRooms();
        let allStorages = [];
        rooms.forEach(r => allStorages = allStorages.concat(Storage.getStorages(r.id)));
        allStorages.forEach(s => {
            const info = getStorageCapacityInfo(s.id);
            if (info && info.planned.overCapacity) {
                overCapacityStorages.push({
                    id: s.id,
                    name: s.name,
                    info
                });
            }
        });

        let freedCapacity = 0;
        let usedCapacityDelta = 0;
        allStorages.forEach(s => {
            const info = getStorageCapacityInfo(s.id);
            if (info) {
                freedCapacity += Math.max(0, info.delta.free);
                usedCapacityDelta += info.delta.count;
            }
        });

        return {
            planName: currentPlan.name,
            createdAt: currentPlan.createdAt,
            updatedAt: currentPlan.updatedAt,
            movedItemsCount: movedItemIds.length,
            adjustedStoragesCount: Object.keys(currentPlan.storageChanges).length,
            affectedStoragesCount: affectedStorageIds.size,
            overCapacityCount: overCapacityStorages.length,
            overCapacityStorages,
            freedCapacity,
            usedCapacityDelta
        };
    }

    function getDiffReport() {
        if (!currentPlan) return [];

        const changes = [];
        Object.keys(currentPlan.itemMoves).forEach(itemId => {
            const item = Storage.getItemById(itemId);
            const origLoc = getOriginalItemLocation(itemId);
            const newLoc = currentPlan.itemMoves[itemId];
            if (item) {
                changes.push({
                    type: 'move',
                    itemId,
                    itemName: item.name,
                    from: origLoc,
                    to: newLoc,
                    fromPath: origLoc ? Storage.getStorageFullPath(origLoc) : '未知',
                    toPath: newLoc ? Storage.getStorageFullPath(newLoc) : '未知'
                });
            }
        });

        Object.keys(currentPlan.storageChanges).forEach(storageId => {
            const storage = Storage.getStorageById(storageId);
            const changesObj = currentPlan.storageChanges[storageId];
            if (storage && changesObj.capacity !== undefined) {
                changes.push({
                    type: 'capacity',
                    storageId,
                    storageName: storage.name,
                    oldCapacity: storage.capacity,
                    newCapacity: changesObj.capacity
                });
            }
        });

        return changes;
    }

    function applyPlan() {
        if (!isPlanMode || !currentPlan) return false;

        Object.keys(currentPlan.itemMoves).forEach(itemId => {
            Storage.updateItem(itemId, { locationId: currentPlan.itemMoves[itemId] });
        });

        Object.keys(currentPlan.storageChanges).forEach(storageId => {
            Storage.updateStorage(storageId, currentPlan.storageChanges[storageId]);
        });

        const planToSave = JSON.parse(JSON.stringify(currentPlan));
        planToSave.appliedAt = Date.now();
        savePlanToStorage(planToSave);

        const wasActive = isPlanMode;
        isPlanMode = false;
        currentPlan = null;
        originalSnapshot = null;
        selectedItemIds.clear();

        if (wasActive) {
            emit('planModeChanged', { active: false });
            emit('planApplied', planToSave);
        }

        return true;
    }

    function saveCurrentPlan(name, description) {
        if (!currentPlan) return false;
        if (name) currentPlan.name = name;
        if (description !== undefined) currentPlan.description = description;
        currentPlan.updatedAt = Date.now();
        savePlanToStorage(JSON.parse(JSON.stringify(currentPlan)));
        emit('planSaved', currentPlan);
        return true;
    }

    function savePlanToStorage(plan) {
        const plans = getAllSavedPlans();
        const idx = plans.findIndex(p => p.id === plan.id);
        if (idx !== -1) {
            plans[idx] = plan;
        } else {
            plans.push(plan);
        }
        localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
    }

    function loadSavedPlan(planId) {
        const plans = getAllSavedPlans();
        return plans.find(p => p.id === planId) || null;
    }

    function getAllSavedPlans() {
        try {
            const raw = localStorage.getItem(PLANS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function deleteSavedPlan(planId) {
        const plans = getAllSavedPlans().filter(p => p.id !== planId);
        localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
        emit('plansListChanged');
    }

    function setSelectedItemIds(ids) {
        selectedItemIds = new Set(ids);
        emit('selectionChanged', { selected: Array.from(selectedItemIds) });
    }

    function toggleItemSelection(itemId) {
        if (selectedItemIds.has(itemId)) {
            selectedItemIds.delete(itemId);
        } else {
            selectedItemIds.add(itemId);
        }
        emit('selectionChanged', { selected: Array.from(selectedItemIds) });
    }

    function clearSelection() {
        selectedItemIds.clear();
        emit('selectionChanged', { selected: [] });
    }

    function getSelectedItemIds() {
        return Array.from(selectedItemIds);
    }

    function setBatchFilters(filters) {
        batchFilters = { ...batchFilters, ...filters };
        emit('filtersChanged', batchFilters);
    }

    function getBatchFilters() {
        return { ...batchFilters };
    }

    function getFilteredItems() {
        let items = getPlannedItems();

        if (batchFilters.seasons && batchFilters.seasons.length > 0) {
            items = items.filter(i =>
                i.seasons.some(s => batchFilters.seasons.includes(s)) ||
                i.seasons.includes('all-season')
            );
        }

        if (batchFilters.categories && batchFilters.categories.length > 0) {
            items = items.filter(i => batchFilters.categories.includes(i.category));
        }

        if (batchFilters.idleOnly) {
            const idleIds = Storage.getIdleItems(180).map(i => i.id);
            items = items.filter(i => idleIds.includes(i.id));
        }

        return items;
    }

    function selectFilteredItems() {
        const filtered = getFilteredItems();
        selectedItemIds = new Set(filtered.map(i => i.id));
        emit('selectionChanged', { selected: Array.from(selectedItemIds) });
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

    function resetItemMove(itemId) {
        if (!isPlanMode || !currentPlan) return false;
        if (currentPlan.itemMoves[itemId] !== undefined) {
            delete currentPlan.itemMoves[itemId];
            currentPlan.updatedAt = Date.now();
            emit('planChanged', currentPlan);
            return true;
        }
        return false;
    }

    function resetAllChanges() {
        if (!isPlanMode || !currentPlan) return false;
        currentPlan.itemMoves = {};
        currentPlan.storageChanges = {};
        currentPlan.updatedAt = Date.now();
        emit('planChanged', currentPlan);
        return true;
    }

    return {
        enterPlanMode,
        exitPlanMode,
        isActive,
        getCurrentPlan,
        getOriginalData,
        hasChanges,
        getPlannedItems,
        getPlannedItemById,
        getPlannedItemsByStorage,
        getPlannedItemsWithChildren,
        getOriginalItemLocation,
        getItemPlannedLocation,
        isItemMoved,
        moveItem,
        batchMoveItems,
        swapItems,
        adjustStorageCapacity,
        getPlannedStorage,
        getStorageCapacityInfo,
        getAllCapacityInfo,
        getPlanSummary,
        getDiffReport,
        applyPlan,
        saveCurrentPlan,
        getAllSavedPlans,
        loadSavedPlan,
        deleteSavedPlan,
        setSelectedItemIds,
        toggleItemSelection,
        clearSelection,
        getSelectedItemIds,
        setBatchFilters,
        getBatchFilters,
        getFilteredItems,
        selectFilteredItems,
        resetItemMove,
        resetAllChanges,
        on
    };
})();
