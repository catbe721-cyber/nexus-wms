/**
 * smartSearch
 * 
 * Performs a multi-keyword search where EVERY term in the query must match
 * at least one of the specified fields in the item.
 * 
 * @param item The object to search
 * @param fields The list of fields in the object to search against (e.g. ['name', 'code'])
 * @param query The search query string
 * @returns true if the item matches the query
 */
export const smartSearch = <T>(item: T, fields: (keyof T)[], query: string): boolean => {
    if (!query) return true;

    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    if (terms.length === 0) return true;

    // Every term must be found in at least one of the fields
    return terms.every(term => {
        return fields.some(field => {
            const value = item[field];
            if (typeof value === 'string') {
                return value.toLowerCase().includes(term);
            }
            if (typeof value === 'number') {
                return value.toString().includes(term);
            }
            return false;
        });
    });
};
