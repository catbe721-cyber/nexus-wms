/**
 * NEXUS-WMS Google Apps Script Backend (Merged with Image Upload)
 */

// 1. Configuration
const SHEET_NAMES = {
  INVENTORY: 'Inventory',
  PRODUCTS: 'Products',
  TRANSACTIONS: 'Transactions',
  LOCATIONS: 'Locations',
  PICKLISTS: 'PickLists'
};

// Replace with your actual folder ID
const IMAGE_FOLDER_ID = '1MDItlQ_iNshEo1I0w1GKJQuXEXIK04fC'; 

// ==========================================
// MAIN REQUES HANDLERS
// ==========================================

/**
 * Handle GET requests (Reading data)
 */
function doGet(e) {
  const params = e.parameter;
  const action = params.action || 'view';
  
  try {
    if (action === 'test') {
      return responseJSON({ status: 'success', message: 'Connection successful' });
    }
    
    if (action === 'getAll') {
      const data = {
        inventory: getSheetData(SHEET_NAMES.INVENTORY),
        products: getSheetData(SHEET_NAMES.PRODUCTS),
        transactions: getSheetData(SHEET_NAMES.TRANSACTIONS),
        locations: getSheetData(SHEET_NAMES.LOCATIONS),
        pickLists: getSheetData(SHEET_NAMES.PICKLISTS)
      };
      return responseJSON({ status: 'success', data: data });
    }
    return responseJSON({ status: 'error', message: 'Invalid action' });
    
  } catch (error) {
    return responseJSON({ status: 'error', message: error.toString() });
  }
}

/**
 * Handle POST requests (Writing data & Uploads)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  // Try to get a lock to prevent race conditions
  if (!lock.tryLock(10000)) {
    return responseJSON({ status: 'error', message: 'Server busy, try again.' });
  }

  try {
    const content = e.postData.contents;
    const request = JSON.parse(content);
    
    const action = request.action;
    const data = request.data;
    
    let result;
    
    // --- ROUTER ---
    
    if (action === 'uploadImage') {
      // 1. Handle Image Upload
      result = { status: 'success', data: uploadImage(data) };
      
    } else if (action === 'saveAll') {
      // 2. Handle Data Sync
      if (data.inventory) saveSheetData(SHEET_NAMES.INVENTORY, data.inventory);
      if (data.products) saveSheetData(SHEET_NAMES.PRODUCTS, data.products);
      if (data.transactions) saveSheetData(SHEET_NAMES.TRANSACTIONS, data.transactions);
      if (data.locations) saveSheetData(SHEET_NAMES.LOCATIONS, data.locations);
      if (data.pickLists) saveSheetData(SHEET_NAMES.PICKLISTS, data.pickLists);
      
      result = { status: 'success', message: 'All data (including PickLists) saved' };
      
    } else if (action === 'deleteImage') {
      // 3. Handle Image Deletion
      if (deleteImage(data.id)) {
        result = { status: 'success', message: 'Image deleted' };
      } else {
        result = { status: 'error', message: 'Failed to delete image (File not found or permission denied)' };
      }

    } else {
      result = { status: 'error', message: 'Unknown action: ' + action };
    }
    
    return responseJSON(result);
    
  } catch (error) {
    return responseJSON({ status: 'error', message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// CORE FUNCTIONS
// ==========================================

/**
 * Uploads a base64 image to Google Drive and sets it to public.
 * @param {Object} data - { name: string, type: string, base64: string, folderName?: string }
 */
function uploadImage(data) {
  try {
    let folderId = IMAGE_FOLDER_ID; // Default folder

    // If a specific folder name is provided, try to find or create it within the main folder
    if (data.folderName) {
      const parentFolder = DriveApp.getFolderById(IMAGE_FOLDER_ID);
      const folders = parentFolder.getFoldersByName(data.folderName);
      
      if (folders.hasNext()) {
        folderId = folders.next().getId();
      } else {
        // Create new folder
        const newFolder = parentFolder.createFolder(data.folderName);
        folderId = newFolder.getId();
      }
    }

    const folder = DriveApp.getFolderById(folderId);
    
    // Decode base64 
    // Handle potential data URI prefix if present
    const parts = data.base64.split(',');
    const base64Data = parts.length > 1 ? parts[1] : parts[0];
    
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), data.type, data.name);
    
    // Check if file with same name exists and trash it (Replace logic)
    const existingFiles = folder.getFilesByName(data.name);
    while (existingFiles.hasNext()) {
      const existingFile = existingFiles.next();
      existingFile.setTrashed(true);
    }
    
    const file = folder.createFile(blob);
    
    // Set permission to anyone with link (so it can be viewed in the app)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Return ID-based URL for reliable embedding
    return `https://drive.google.com/uc?export=view&id=${file.getId()}`;
    
  } catch (e) {
    throw new Error('Failed to upload image: ' + e.toString());
  }
}

/**
 * Deletes (trashes) a file from Google Drive
 * @param {string} fileId - The ID of the file to delete
 */
function deleteImage(fileId) {
  try {
    if (!fileId) return false;
    const file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
    return true;
  } catch (e) {
    Logger.log('Error deleting file: ' + e.toString());
    return false;
  }
}

/**
 * Helper to get data from a sheet as an array of objects
 */
function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    return [];
  }
  
  const range = sheet.getDataRange();
  const values = range.getValues();
  
  if (values.length <= 1) return [];
  
  const headers = values[0];
  const data = values.slice(1).map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      let val = row[index];
      if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
        try { val = JSON.parse(val); } catch(e) {}
      }
      obj[header] = val;
    });
    return obj;
  });
  
  return data;
}

/**
 * Helper to overwrite a sheet with new data
 */
function saveSheetData(sheetName, data) {
  if (!data || !Array.isArray(data)) return;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  sheet.clearContents();
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const values = [headers];
  
  data.forEach(item => {
    const row = headers.map(header => {
      const val = item[header];
      if (typeof val === 'object' && val !== null) {
        return JSON.stringify(val);
      }
      return val;
    });
    values.push(row);
  });
  
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
}

/**
 * Helper to return JSON response
 */
function responseJSON(content) {
  return ContentService
    .createTextOutput(JSON.stringify(content))
    .setMimeType(ContentService.MimeType.JSON);
}


// ==========================================
// TROUBLESHOOTING HELPERS
// ==========================================

/**
 * RUN THIS FUNCTION MANUALLY to Authorize Drive Permissions!
 * 1. Select 'debugPermissions' from the dropdown menu in Apps Script editor.
 * 2. Click 'Run'.
 * 3. A permission dialog will appear requesting access to Drive.
 * 4. Click 'Review Permissions', select your account, and 'Allow'.
 * 5. IGNORE the error "Folder not found" if your folder ID is wrong, 
 *    the goal is just to trigger the auth prompt.
 */
function debugPermissions() {
  console.log("Attempting to access Drive...");
  const folder = DriveApp.getFolderById(IMAGE_FOLDER_ID);
  console.log("Successfully accessed folder: " + folder.getName());
  
  console.log("Attempting to create test file to force Write permissions...");
  const file = folder.createFile("temp_permission_test.txt", "This is a test file to verify permissions.");
  console.log("File created: " + file.getId());
  
  file.setTrashed(true);
  console.log("Test file deleted. WRITE permissions are correct and Authorized!");
}
