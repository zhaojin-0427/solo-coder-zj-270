const StorageTree = (function() {
    let container;
    let currentRoomId = null;
    let selectedStorageId = null;
    let expandedIds = new Set();
    let listeners = {};

    function init(roomId) {
        container = document.getElementById('storageTree');
        currentRoomId = roomId;
        render();
    }

    function setRoom(roomId) {
        currentRoomId = roomId;
        selectedStorageId = null;
        render();
    }

    function render() {
        if (!container) return;

        const storages = Storage.getStorages(currentRoomId);
        const topLevel = storages.filter(s => !s.parentId);

        if (topLevel.length === 0) {
            container.innerHTML = '<p style="color:#999;font-size:13px;padding:8px 0;">暂无收纳空间，点击下方按钮添加</p>';
            return;
        }

        let html = '';
        topLevel.forEach(s => {
            html += renderNode(s, storages, 0);
        });
        container.innerHTML = html;

        bindEvents();
    }

    function renderNode(storage, allStorages, depth) {
        const children = allStorages.filter(s => s.parentId === storage.id);
        const hasChildren = children.length > 0;
        const isExpanded = expandedIds.has(storage.id) || depth < 1;
        if (depth < 1) expandedIds.add(storage.id);

        const itemCount = countItems(storage.id, allStorages);
        const isSelected = storage.id === selectedStorageId;
        const icon = Storage.getStorageTypeIcon(storage.type);

        let html = `
            <div class="tree-node" data-id="${storage.id}">
                <div class="tree-node-content ${isSelected ? 'active' : ''}">
                    <span class="tree-toggle" data-toggle="${storage.id}">
                        ${hasChildren ? (isExpanded ? '▼' : '▶') : ''}
                    </span>
                    <span class="tree-icon">${icon}</span>
                    <span class="tree-name">${escapeHtml(storage.name)}</span>
                    <span class="tree-badge">${itemCount}</span>
                </div>
        `;

        if (hasChildren && isExpanded) {
            html += '<div class="tree-children">';
            children.forEach(child => {
                html += renderNode(child, allStorages, depth + 1);
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    function countItems(storageId, allStorages) {
        let count = Storage.getItems(storageId).length;
        const children = allStorages.filter(s => s.parentId === storageId);
        children.forEach(child => {
            count += countItems(child.id, allStorages);
        });
        return count;
    }

    function bindEvents() {
        container.querySelectorAll('.tree-toggle').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = el.dataset.toggle;
                if (expandedIds.has(id)) {
                    expandedIds.delete(id);
                } else {
                    expandedIds.add(id);
                }
                render();
            });
        });

        container.querySelectorAll('.tree-node-content').forEach(el => {
            el.addEventListener('click', () => {
                const node = el.closest('.tree-node');
                const id = node.dataset.id;
                selectedStorageId = id;
                emit('storageSelected', Storage.getStorageById(id));
                render();
            });
        });
    }

    function getSelectedStorage() {
        return selectedStorageId ? Storage.getStorageById(selectedStorageId) : null;
    }

    function setSelectedStorage(id) {
        selectedStorageId = id;
        const storage = Storage.getStorageById(id);
        if (storage) {
            ensurePathExpanded(storage);
        }
        render();
    }

    function ensurePathExpanded(storage) {
        if (!storage || !storage.parentId) return;
        expandedIds.add(storage.parentId);
        const parent = Storage.getStorageById(storage.parentId);
        ensurePathExpanded(parent);
    }

    function clearSelection() {
        selectedStorageId = null;
        render();
    }

    function refresh() {
        render();
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

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return {
        init,
        setRoom,
        render,
        refresh,
        getSelectedStorage,
        setSelectedStorage,
        clearSelection,
        on
    };
})();
