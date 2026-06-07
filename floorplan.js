const FloorPlan = (function() {
    let canvas, ctx;
    let currentMode = 'select';
    let selectedStorageId = null;
    let isDragging = false;
    let isResizing = false;
    let dragOffset = { x: 0, y: 0 };
    let resizeHandle = null;
    let currentRoomId = null;
    let highlightStorageId = null;
    let listeners = {};

    const STORAGE_COLORS = {
        cabinet: { fill: '#d4e6d4', stroke: '#5b8c5a', text: '#2c5a2c' },
        drawer: { fill: '#fde8d0', stroke: '#e07b39', text: '#8a4a1d' },
        box: { fill: '#d0e4f7', stroke: '#4a90d9', text: '#1d4a8a' }
    };

    function init(roomId) {
        canvas = document.getElementById('floorplanCanvas');
        ctx = canvas.getContext('2d');
        currentRoomId = roomId;

        setupEventListeners();
        render();
    }

    function setRoom(roomId) {
        currentRoomId = roomId;
        selectedStorageId = null;
        updateInfoPanel();
        render();
    }

    function setMode(mode) {
        currentMode = mode;
        document.querySelectorAll('.floorplan-tools .btn').forEach(btn => {
            btn.classList.remove('btn-active');
            if (btn.dataset.mode === mode) {
                btn.classList.add('btn-active');
            }
        });

        if (mode === 'select') {
            canvas.style.cursor = 'pointer';
        } else if (mode === 'delete') {
            canvas.style.cursor = 'not-allowed';
        } else {
            canvas.style.cursor = 'crosshair';
        }
    }

    function highlightStorage(storageId) {
        highlightStorageId = storageId;
        render();
        setTimeout(() => {
            highlightStorageId = null;
            render();
        }, 2000);
    }

    function setupEventListeners() {
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('mouseleave', onMouseUp);
        canvas.addEventListener('dblclick', onDoubleClick);
    }

    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    function onMouseDown(e) {
        const pos = getMousePos(e);
        const storages = Storage.getStorages(currentRoomId).filter(s => !s.parentId);

        if (currentMode === 'select') {
            const hit = hitTest(pos, storages);
            if (hit) {
                const handle = getResizeHandle(pos, hit.storage);
                if (handle) {
                    isResizing = true;
                    resizeHandle = handle;
                } else {
                    isDragging = true;
                    dragOffset.x = pos.x - hit.storage.x;
                    dragOffset.y = pos.y - hit.storage.y;
                }
                selectedStorageId = hit.storage.id;
                updateInfoPanel();
                emit('storageSelected', hit.storage);
            } else {
                selectedStorageId = null;
                updateInfoPanel();
                emit('storageSelected', null);
            }
            render();
        } else if (currentMode === 'delete') {
            const hit = hitTest(pos, storages);
            if (hit) {
                if (confirm(`确定要删除"${hit.storage.name}"及其所有子空间和物品吗？`)) {
                    Storage.deleteStorage(hit.storage.id);
                    emit('storageChanged');
                    selectedStorageId = null;
                    updateInfoPanel();
                    render();
                }
            }
        } else if (['cabinet', 'drawer', 'box'].includes(currentMode)) {
            const newStorage = Storage.addStorage({
                roomId: currentRoomId,
                parentId: null,
                name: getDefaultName(currentMode),
                type: currentMode,
                capacity: 20,
                x: pos.x - 60,
                y: pos.y - 30,
                width: 120,
                height: 60
            });
            emit('storageChanged');
            setMode('select');
            selectedStorageId = newStorage.id;
            updateInfoPanel();
            render();
        }
    }

    function onMouseMove(e) {
        if (!isDragging && !isResizing) return;

        const pos = getMousePos(e);
        const storage = Storage.getStorageById(selectedStorageId);
        if (!storage) return;

        if (isDragging) {
            const newX = Math.max(0, Math.min(canvas.width - storage.width, pos.x - dragOffset.x));
            const newY = Math.max(0, Math.min(canvas.height - storage.height, pos.y - dragOffset.y));
            Storage.updateStorage(storage.id, { x: newX, y: newY });
        } else if (isResizing) {
            let updates = {};
            const minSize = 40;
            if (resizeHandle.includes('e')) {
                updates.width = Math.max(minSize, pos.x - storage.x);
            }
            if (resizeHandle.includes('s')) {
                updates.height = Math.max(minSize, pos.y - storage.y);
            }
            if (resizeHandle.includes('w')) {
                const newWidth = storage.x + storage.width - pos.x;
                if (newWidth >= minSize) {
                    updates.width = newWidth;
                    updates.x = pos.x;
                }
            }
            if (resizeHandle.includes('n')) {
                const newHeight = storage.y + storage.height - pos.y;
                if (newHeight >= minSize) {
                    updates.height = newHeight;
                    updates.y = pos.y;
                }
            }
            Storage.updateStorage(storage.id, updates);
        }

        emit('storageChanged');
        render();
    }

    function onMouseUp() {
        isDragging = false;
        isResizing = false;
        resizeHandle = null;
    }

    function onDoubleClick(e) {
        const pos = getMousePos(e);
        const storages = Storage.getStorages(currentRoomId).filter(s => !s.parentId);
        const hit = hitTest(pos, storages);
        if (hit) {
            emit('storageEdit', hit.storage);
        }
    }

    function hitTest(pos, storages) {
        for (let i = storages.length - 1; i >= 0; i--) {
            const s = storages[i];
            if (pos.x >= s.x && pos.x <= s.x + s.width &&
                pos.y >= s.y && pos.y <= s.y + s.height) {
                return { storage: s };
            }
        }
        return null;
    }

    function getResizeHandle(pos, storage) {
        const handleSize = 8;
        const { x, y, width, height } = storage;

        if (pos.x >= x + width - handleSize && pos.x <= x + width &&
            pos.y >= y + height - handleSize && pos.y <= y + height) {
            return 'se';
        }
        if (pos.x >= x && pos.x <= x + handleSize &&
            pos.y >= y + height - handleSize && pos.y <= y + height) {
            return 'sw';
        }
        if (pos.x >= x + width - handleSize && pos.x <= x + width &&
            pos.y >= y && pos.y <= y + handleSize) {
            return 'ne';
        }
        if (pos.x >= x && pos.x <= x + handleSize &&
            pos.y >= y && pos.y <= y + handleSize) {
            return 'nw';
        }
        return null;
    }

    function getDefaultName(type) {
        const names = {
            cabinet: '新柜子',
            drawer: '新抽屉',
            box: '新收纳盒'
        };
        return names[type] || '收纳空间';
    }

    function updateInfoPanel() {
        const panel = document.getElementById('storageInfo');
        if (!selectedStorageId) {
            panel.classList.add('hidden');
            return;
        }

        const storage = Storage.getStorageById(selectedStorageId);
        if (!storage) {
            panel.classList.add('hidden');
            return;
        }

        panel.classList.remove('hidden');
        document.getElementById('infoStorageName').textContent =
            Storage.getStorageTypeIcon(storage.type) + ' ' + storage.name;
        document.getElementById('infoStorageType').textContent = Storage.getStorageTypeName(storage.type);
        document.getElementById('infoStorageCapacity').textContent = storage.capacity + ' 件';

        const allIds = [storage.id];
        function collectChildren(parentId) {
            const children = Storage.getStorages(currentRoomId).filter(s => s.parentId === parentId);
            children.forEach(c => {
                allIds.push(c.id);
                collectChildren(c.id);
            });
        }
        collectChildren(storage.id);
        const itemCount = Storage.getItems().filter(i => allIds.includes(i.locationId)).length;
        document.getElementById('infoStorageItemCount').textContent = itemCount + ' 件';
    }

    function render() {
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawGrid();
        drawRoomLabel();

        const storages = Storage.getStorages(currentRoomId).filter(s => !s.parentId);
        storages.forEach(s => drawStorage(s));
    }

    function drawGrid() {
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;
        const gridSize = 20;
        for (let x = 0; x <= canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y <= canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }

    function drawRoomLabel() {
        const rooms = Storage.getRooms();
        const room = rooms.find(r => r.id === currentRoomId);
        if (room) {
            ctx.fillStyle = '#999';
            ctx.font = '12px sans-serif';
            ctx.fillText(`${room.icon} ${room.name} - 点击工具栏选择工具后在画布上绘制收纳空间`, 10, canvas.height - 10);
        }
    }

    function drawStorage(storage) {
        const colors = STORAGE_COLORS[storage.type] || STORAGE_COLORS.cabinet;
        const { x, y, width, height } = storage;
        const isSelected = storage.id === selectedStorageId;
        const isHighlighted = storage.id === highlightStorageId;

        if (isHighlighted) {
            ctx.shadowColor = '#ff9500';
            ctx.shadowBlur = 15;
        }

        ctx.fillStyle = colors.fill;
        ctx.fillRect(x, y, width, height);

        ctx.shadowBlur = 0;

        ctx.strokeStyle = isSelected ? '#ff9500' : colors.stroke;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeRect(x, y, width, height);

        ctx.fillStyle = colors.text;
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const icon = Storage.getStorageTypeIcon(storage.type);
        ctx.fillText(`${icon} ${storage.name}`, x + 8, y + 8);

        const childCount = Storage.getStorages(currentRoomId).filter(s => s.parentId === storage.id).length;
        const itemCount = Storage.getItems(storage.id).length;
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#666';
        let infoText = `容量: ${storage.capacity}`;
        if (childCount > 0) infoText += ` | 子空间: ${childCount}`;
        if (itemCount > 0) infoText += ` | 物品: ${itemCount}`;
        ctx.fillText(infoText, x + 8, y + 28);

        if (isSelected) {
            drawResizeHandles(x, y, width, height);
        }

        if (isHighlighted) {
            ctx.strokeStyle = '#ff9500';
            ctx.lineWidth = 4;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(x - 4, y - 4, width + 8, height + 8);
            ctx.setLineDash([]);
        }
    }

    function drawResizeHandles(x, y, width, height) {
        const handleSize = 8;
        ctx.fillStyle = '#ff9500';

        ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(x + width - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(x - handleSize / 2, y + height - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(x + width - handleSize / 2, y + height - handleSize / 2, handleSize, handleSize);
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

    function refresh() {
        render();
        updateInfoPanel();
    }

    function getSelectedStorage() {
        return selectedStorageId ? Storage.getStorageById(selectedStorageId) : null;
    }

    function clearSelection() {
        selectedStorageId = null;
        updateInfoPanel();
        render();
    }

    return {
        init,
        setRoom,
        setMode,
        highlightStorage,
        refresh,
        on,
        getSelectedStorage,
        clearSelection
    };
})();
