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
