export const DB_CONFIG = {
    DB_NAME: 'SmartPickImages',
    STORE_NAME: 'images',
    VERSION: 1
};

export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_CONFIG.DB_NAME, DB_CONFIG.VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(DB_CONFIG.STORE_NAME)) {
                db.createObjectStore(DB_CONFIG.STORE_NAME);
            }
        };
    });
};

export const saveImageToDB = async (id: string, base64: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([DB_CONFIG.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(DB_CONFIG.STORE_NAME);
        const request = store.put(base64, id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
};

export const getImageFromDB = async (id: string): Promise<string | null> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([DB_CONFIG.STORE_NAME], 'readonly');
        const store = transaction.objectStore(DB_CONFIG.STORE_NAME);
        const request = store.get(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || null);
    });
};

export const deleteImageFromDB = async (id: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([DB_CONFIG.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(DB_CONFIG.STORE_NAME);
        const request = store.delete(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
};
