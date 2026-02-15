export interface GasResponse<T> {
    status: 'success' | 'error';
    message?: string;
    data?: T;
}

export const GASService = {
    /**
     * Fetch all data from the Google Sheet
     * @param url The Web App URL
     */
    async fetchData(url: string) {
        if (!url) throw new Error('GAP API URL not configured');
        const cleanUrl = url.trim();

        // Append ?action=getAll to the URL
        // Handle cases where URL might already have params
        // Append ?action=getAll to the URL
        // Handle cases where URL might already have params
        const fetchUrl = new URL(cleanUrl);
        fetchUrl.searchParams.append('action', 'getAll');
        fetchUrl.searchParams.append('_t', Date.now().toString()); // Prevent caching

        const response = await fetch(fetchUrl.toString(), {
            method: 'GET',
            credentials: 'omit',
            redirect: 'follow',
        });

        const text = await response.text();
        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            if (text.includes('<!DOCTYPE html>') || text.includes('Google Accounts')) {
                throw new Error('Access Denied. Please check your Google Script deployment settings ("Who has access" must be "Anyone").');
            }
            throw new Error('Invalid response from Google Sheets');
        }
        if (result.status === 'error') {
            throw new Error(result.message || 'Unknown error from Google Sheet');
        }

        return result.data;
    },

    /**
     * Save data to the Google Sheet
     * @param url The Web App URL
     * @param action The specific save action (e.g., saveInventory, saveAll)
     * @param data The data payload
     */
    async saveData(url: string, action: string, data: any) {
        if (!url) throw new Error('GAP API URL not configured');
        const cleanUrl = url.trim();

        // We use no-cors if we just want to fire and forget? 
        // Actually, for the "Anyone" access setting, standard CORS usually works 
        // or we use opaque mode. 
        // However, Apps Script Web Apps handle CORS redirects tricky-ly.
        // The standard way is using POST with text/plain (to avoid preflight) 
        // and following redirects.

        // Note: Apps Script POST requests often need to be sent as text/plain
        // because application/json triggers preflight which GAS doesn't handle well
        // in some "Simple Trigger" contexts, though "Web App" execution should be fine.
        // To be safe and compatible with the script we wrote:

        const payload = JSON.stringify({
            action,
            data
        });

        console.log('GASService: Preparing to send payload...');
        console.log('GASService: Action:', action);
        console.log('GASService: Data Keys:', Object.keys(data));
        if (data.inventory) console.log('GASService: Inventory Count:', data.inventory.length);
        if (data.pickLists) console.log('GASService: PickLists Count:', data.pickLists.length);
        console.log('GASService: Payload Length:', payload.length);

        try {
            // Using no-cors mode to bypass CORS/401 issues common with GAS Web Apps
            // from third-party origins. This results in an opaque response, 
            // so we cannot read the result body. We assume success if the request sends without error.
            await fetch(cleanUrl, {
                method: 'POST',
                mode: 'no-cors',
                body: payload,
                credentials: 'omit',
                redirect: 'follow',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
            });

            // Return simulated success since response is opaque
            return { status: 'success', message: 'Data sent to Google Sheets (Blind Send)' };

        } catch (e: any) {
            console.error(e);

            // Handle fallback if needed, but for now just throw the network error
            throw new Error(e.message || 'Unknown error saving to Google Sheet');
        }
    },

    /**
     * Upload an image to Google Drive via GAS
     * @param url The Web App URL
     * @param file The file object to upload
     * @param folderName Optional folder name to save the image (e.g. "RTE Pick List")
     */
    async uploadImage(url: string, file: File, folderName?: string): Promise<string> {
        if (!url) throw new Error('GAP API URL not configured');

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const base64 = reader.result as string;
                    const payload = JSON.stringify({
                        action: 'uploadImage',
                        data: {
                            name: file.name,
                            type: file.type,
                            base64: base64,
                            folderName: folderName // Pass folder name if provided
                        }
                    });

                    // We surely need a CORS response here to get the URL back. 
                    // This implies the GAS script MUST return correct CORS headers 
                    // or be deployed as "Anyone" execution (usually handles CORS better).
                    const response = await fetch(url, {
                        method: 'POST',
                        body: payload,
                        // mode: 'cors', // Default is cors usually
                        headers: {
                            'Content-Type': 'text/plain;charset=utf-8',
                        },
                    });

                    const result = await response.json();
                    if (result.status === 'success') {
                        resolve(result.data);
                    } else {
                        reject(new Error(result.message || 'Upload failed'));
                    }
                } catch (e) {
                    reject(e);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    },

    /**
     * Delete an image from Google Drive
     * @param url The Web App URL
     * @param imageUrl The full image URL to delete (will extract ID)
     */
    async deleteImage(url: string, imageUrl: string): Promise<boolean> {
        if (!url || !imageUrl) return false;

        // Extract ID
        let fileId = '';
        const idMatch = imageUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) {
            fileId = idMatch[1];
        } else {
            // Fallback for /d/ID/ view links
            const pathMatch = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (pathMatch && pathMatch[1]) fileId = pathMatch[1];
        }

        if (!fileId) {
            console.error('GASService: Could not extract file ID from URL', imageUrl);
            return false;
        }

        try {
            const payload = JSON.stringify({
                action: 'deleteImage',
                data: { id: fileId }
            });

            // Using no-cors/blind send because we just want to fire the deletion
            // We don't strictly need to confirm it for the UI to proceed
            await fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                body: payload,
                credentials: 'omit',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            });
            console.log('GASService: Delete request sent for', fileId);
            return true;
        } catch (e) {
            console.error('GASService: Failed to delete image', e);
            return false;
        }
    },

    /**
     * Test the connection
     */
    async testConnection(url: string) {
        if (!url) return false;
        try {
            const fetchUrl = new URL(url);
            fetchUrl.searchParams.append('action', 'test');
            const response = await fetch(fetchUrl.toString(), {
                method: 'GET',
                credentials: 'omit',
                redirect: 'follow',
            });
            const result = await response.json();
            return result.status === 'success';
        } catch (e) {
            console.error(e);
            return false;
        }
    }
};
