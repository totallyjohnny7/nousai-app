/**
 * Storage health monitoring — detects quota exhaustion, IDB unavailability,
 * and provides usage summaries for the Settings "Data Safety" section.
 */

export interface StorageSummary {
  idbAvailable: boolean;
  lsUsedBytes: number;
  lsQuotaEstimate: number; // 5MB typical
  lsUsagePercent: number;
  idbEstimateBytes: number | null; // null if StorageManager API unavailable
  warning: string | null;
}

/**
 * Get a comprehensive storage health summary.
 */
export async function getStorageSummary(): Promise<StorageSummary> {
  const lsUsed = checkLocalStorageUsage();
  const lsQuota = 5 * 1024 * 1024; // 5MB typical limit
  const idbAvailable = await checkIDBAvailable();
  const idbEstimate = await getIDBEstimate();

  let warning: string | null = null;
  if (!idbAvailable) warning = 'IndexedDB unavailable (private browsing?)';
  else if (lsUsed / lsQuota > 0.8) warning = `localStorage is ${Math.round(lsUsed / lsQuota * 100)}% full`;

  return {
    idbAvailable,
    lsUsedBytes: lsUsed,
    lsQuotaEstimate: lsQuota,
    lsUsagePercent: Math.round(lsUsed / lsQuota * 100),
    idbEstimateBytes: idbEstimate,
    warning,
  };
}

/**
 * Estimate localStorage usage in bytes.
 */
function checkLocalStorageUsage(): number {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        total += key.length + (localStorage.getItem(key)?.length ?? 0);
      }
    }
    return total * 2; // JS strings are UTF-16 (2 bytes per char)
  } catch {
    return 0;
  }
}

/**
 * Check if IndexedDB is available (may be blocked in private browsing).
 */
async function checkIDBAvailable(): Promise<boolean> {
  try {
    const testName = '__nousai_idb_test__';
    const req = indexedDB.open(testName, 1);
    return await new Promise<boolean>((resolve) => {
      req.onsuccess = () => {
        req.result.close();
        indexedDB.deleteDatabase(testName);
        resolve(true);
      };
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Get IDB storage estimate via StorageManager API (Chrome/Edge/Firefox).
 */
async function getIDBEstimate(): Promise<number | null> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return estimate.usage ?? null;
    }
  } catch { /* not available */ }
  return null;
}

/**
 * Export critical data as a URL-safe base64 string for clipboard emergency backup.
 */
export function emergencyClipboardExport(data: unknown): string {
  try {
    const json = JSON.stringify(data);
    return btoa(unescape(encodeURIComponent(json)));
  } catch {
    return '';
  }
}
