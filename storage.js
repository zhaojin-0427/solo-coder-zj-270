const Storage = (function() {
    const STORAGE_KEY = 'home_organizer_data';

    const defaultData = {
        rooms: [
            {
                id: 'room_default_1',
                name: '卧室',
                icon: '🛏️',
                createdAt: Date.now()
            },
            {
                id: 'room_default_2',
                name: '客厅',
                icon: '🛋️',
                createdAt: Date.now()
            },
            {
                id: 'room_default_3',
                name: '厨房',
                icon: '🍳',
                createdAt: Date.now()
            }
        ],
        storages: [
            {
                id: 'storage_default_1',
                roomId: 'room_default_1',
                parentId: null,
                name: '衣柜',
                type: 'cabinet',
                capacity: 30,
                notes: '主卧大衣柜',
                x: 100,
                y: 80,
                width: 180,
                height: 60,
                createdAt: Date.now()
            },
            {
                id: 'storage_default_2',
                roomId: 'room_default_1',
                parentId: 'storage_default_1',
                name: '上层隔板',
                type: 'cabinet',
                capacity: 10,
                notes: '换季衣物存放',
                x: 110,
                y: 90,
                width: 80,
                height: 25,
                createdAt: Date.now()
            },
            {
                id: 'storage_default_3',
                roomId: 'room_default_1',
                parentId: null,
                name: '床头柜抽屉',
                type: 'drawer',
                capacity: 15,
                notes: '',
                x: 320,
                y: 120,
                width: 80,
                height: 50,
                createdAt: Date.now()
            },
            {
                id: 'storage_default_4',
                roomId: 'room_default_2',
                parentId: null,
                name: '电视柜',
                type: 'cabinet',
                capacity: 20,
                notes: '',
                x: 300,
                y: 60,
                width: 200,
                height: 60,
                createdAt: Date.now()
            }
        ],
        items: [
            {
                id: 'item_default_1',
                name: '羽绒服',
                category: 'clothing',
                locationId: 'storage_default_2',
                quantity: 2,
                seasons: ['winter'],
                expiry: null,
                lastUsed: '2025-02-15',
                photo: null,
                notes: '两件冬季羽绒服',
                createdAt: Date.now()
            },
            {
                id: 'item_default_2',
                name: '护照证件',
                category: 'document',
                locationId: 'storage_default_3',
                quantity: 1,
                seasons: ['all-season'],
                expiry: null,
                lastUsed: '2025-05-20',
                photo: null,
                notes: '重要证件请妥善保管',
                createdAt: Date.now()
            },
            {
                id: 'item_default_3',
                name: '感冒药',
                category: 'medicine',
                locationId: 'storage_default_3',
                quantity: 1,
                seasons: ['all-season'],
                expiry: '2026-03-01',
                lastUsed: '2025-10-01',
                photo: null,
                notes: '注意保质期',
                createdAt: Date.now()
            }
        ],
        currentRoomId: 'room_default_1'
    };

    function getData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
                return JSON.parse(JSON.stringify(defaultData));
            }
            const data = JSON.parse(raw);
            if (!data.rooms) data.rooms = [];
            if (!data.storages) data.storages = [];
            if (!data.items) data.items = [];
            return data;
        } catch (e) {
            console.error('读取存储数据失败:', e);
            return JSON.parse(JSON.stringify(defaultData));
        }
    }

    function saveData(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('保存数据失败:', e);
            return false;
        }
    }

    function generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    function getRooms() {
        return getData().rooms;
    }

    function addRoom(room) {
        const data = getData();
        const newRoom = {
            id: generateId('room'),
            name: room.name,
            icon: room.icon || '🏠',
            createdAt: Date.now()
        };
        data.rooms.push(newRoom);
        saveData(data);
        return newRoom;
    }

    function updateRoom(id, updates) {
        const data = getData();
        const idx = data.rooms.findIndex(r => r.id === id);
        if (idx !== -1) {
            data.rooms[idx] = { ...data.rooms[idx], ...updates };
            saveData(data);
            return data.rooms[idx];
        }
        return null;
    }

    function deleteRoom(id) {
        const data = getData();
        data.rooms = data.rooms.filter(r => r.id !== id);
        const storageIds = data.storages.filter(s => s.roomId === id).map(s => s.id);
        data.storages = data.storages.filter(s => s.roomId !== id);
        data.items = data.items.filter(i => !storageIds.includes(i.locationId));
        if (data.currentRoomId === id && data.rooms.length > 0) {
            data.currentRoomId = data.rooms[0].id;
        }
        saveData(data);
    }

    function getCurrentRoomId() {
        return getData().currentRoomId;
    }

    function setCurrentRoomId(id) {
        const data = getData();
        data.currentRoomId = id;
        saveData(data);
    }

    function getStorages(roomId) {
        const data = getData();
        if (roomId) {
            return data.storages.filter(s => s.roomId === roomId);
        }
        return data.storages;
    }

    function getStorageById(id) {
        return getData().storages.find(s => s.id === id);
    }

    function addStorage(storage) {
        const data = getData();
        const newStorage = {
            id: generateId('storage'),
            roomId: storage.roomId,
            parentId: storage.parentId || null,
            name: storage.name,
            type: storage.type || 'cabinet',
            capacity: storage.capacity || 20,
            notes: storage.notes || '',
            x: storage.x || 50,
            y: storage.y || 50,
            width: storage.width || 120,
            height: storage.height || 60,
            createdAt: Date.now()
        };
        data.storages.push(newStorage);
        saveData(data);
        return newStorage;
    }

    function updateStorage(id, updates) {
        const data = getData();
        const idx = data.storages.findIndex(s => s.id === id);
        if (idx !== -1) {
            data.storages[idx] = { ...data.storages[idx], ...updates };
            saveData(data);
            return data.storages[idx];
        }
        return null;
    }

    function deleteStorage(id) {
        const data = getData();
        const childIds = data.storages.filter(s => s.parentId === id).map(s => s.id);
        const allIds = [id, ...childIds];
        data.storages = data.storages.filter(s => !allIds.includes(s.id));
        data.items = data.items.filter(i => !allIds.includes(i.locationId));
        saveData(data);
    }

    function getStoragePath(storageId) {
        const data = getData();
        const path = [];
        let current = data.storages.find(s => s.id === storageId);
        while (current) {
            path.unshift(current);
            current = current.parentId ? data.storages.find(s => s.id === current.parentId) : null;
        }
        const room = data.rooms.find(r => {
            const first = path[0];
            return first && r.id === first.roomId;
        });
        return { room, storages: path };
    }

    function getStorageFullPath(storageId) {
        const { room, storages } = getStoragePath(storageId);
        const parts = [];
        if (room) parts.push(room.icon + ' ' + room.name);
        storages.forEach(s => parts.push(s.name));
        return parts.join(' → ');
    }

    function getItems(storageId) {
        const data = getData();
        if (storageId) {
            return data.items.filter(i => i.locationId === storageId);
        }
        return data.items;
    }

    function getItemsWithChildren(storageId) {
        const data = getData();
        const allIds = [storageId];
        function collectChildren(parentId) {
            const children = data.storages.filter(s => s.parentId === parentId);
            children.forEach(c => {
                allIds.push(c.id);
                collectChildren(c.id);
            });
        }
        collectChildren(storageId);
        return data.items.filter(i => allIds.includes(i.locationId));
    }

    function getItemById(id) {
        return getData().items.find(i => i.id === id);
    }

    function addItem(item) {
        const data = getData();
        const newItem = {
            id: generateId('item'),
            name: item.name,
            category: item.category || 'other',
            locationId: item.locationId,
            quantity: item.quantity || 1,
            seasons: item.seasons || ['all-season'],
            expiry: item.expiry || null,
            lastUsed: item.lastUsed || null,
            photo: item.photo || null,
            notes: item.notes || '',
            createdAt: Date.now()
        };
        data.items.push(newItem);
        saveData(data);
        return newItem;
    }

    function updateItem(id, updates) {
        const data = getData();
        const idx = data.items.findIndex(i => i.id === id);
        if (idx !== -1) {
            data.items[idx] = { ...data.items[idx], ...updates };
            saveData(data);
            return data.items[idx];
        }
        return null;
    }

    function deleteItem(id) {
        const data = getData();
        data.items = data.items.filter(i => i.id !== id);
        saveData(data);
    }

    function searchItems(keyword, seasons) {
        const data = getData();
        let results = data.items;
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
        return results;
    }

    function getItemsBySeason(season) {
        const data = getData();
        return data.items.filter(i =>
            i.seasons.includes(season) || i.seasons.includes('all-season')
        );
    }

    function getOffSeasonItems(currentSeason) {
        const data = getData();
        const allSeasons = ['spring', 'summer', 'autumn', 'winter'];
        return data.items.filter(i => {
            if (i.seasons.includes('all-season')) return false;
            return !i.seasons.includes(currentSeason);
        });
    }

    function getExpiringItems(daysAhead = 30) {
        const data = getData();
        const now = new Date();
        const future = new Date();
        future.setDate(future.getDate() + daysAhead);
        return data.items.filter(i => {
            if (!i.expiry) return false;
            const expiry = new Date(i.expiry);
            return expiry <= future;
        });
    }

    function getIdleItems(daysThreshold = 180) {
        const data = getData();
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - daysThreshold);
        return data.items.filter(i => {
            if (!i.lastUsed) {
                const created = new Date(i.createdAt);
                return created <= threshold;
            }
            const lastUsed = new Date(i.lastUsed);
            return lastUsed <= threshold;
        });
    }

    function getCurrentSeason() {
        const month = new Date().getMonth();
        if (month >= 2 && month <= 4) return 'spring';
        if (month >= 5 && month <= 7) return 'summer';
        if (month >= 8 && month <= 10) return 'autumn';
        return 'winter';
    }

    function getSeasonName(season) {
        const names = {
            spring: '🌸 春季',
            summer: '☀️ 夏季',
            autumn: '🍂 秋季',
            winter: '❄️ 冬季',
            'all-season': '🌀 四季'
        };
        return names[season] || season;
    }

    function getCategoryName(category) {
        const names = {
            clothing: '👕 衣物',
            document: '📄 文件',
            kitchen: '🍳 厨房用品',
            electronics: '📱 电子设备',
            tool: '🔧 工具',
            decoration: '🎨 装饰品',
            medicine: '💊 药品',
            other: '📦 其他'
        };
        return names[category] || category;
    }

    function getStorageTypeName(type) {
        const names = {
            cabinet: '🗄️ 柜子',
            drawer: '📦 抽屉',
            box: '📋 收纳盒'
        };
        return names[type] || type;
    }

    function getStorageTypeIcon(type) {
        const icons = {
            cabinet: '🗄️',
            drawer: '📦',
            box: '📋'
        };
        return icons[type] || '📦';
    }

    function exportAllData() {
        return JSON.parse(JSON.stringify(getData()));
    }

    function importAllData(data) {
        return saveData(data);
    }

    return {
        getData,
        saveData,
        generateId,
        getRooms,
        addRoom,
        updateRoom,
        deleteRoom,
        getCurrentRoomId,
        setCurrentRoomId,
        getStorages,
        getStorageById,
        addStorage,
        updateStorage,
        deleteStorage,
        getStoragePath,
        getStorageFullPath,
        getItems,
        getItemsWithChildren,
        getItemById,
        addItem,
        updateItem,
        deleteItem,
        searchItems,
        getItemsBySeason,
        getOffSeasonItems,
        getExpiringItems,
        getIdleItems,
        getCurrentSeason,
        getSeasonName,
        getCategoryName,
        getStorageTypeName,
        getStorageTypeIcon,
        exportAllData,
        importAllData
    };
})();
