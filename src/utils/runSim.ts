/**
 * Browser-runnable simulation entry point.
 * Exposes three simulation functions:
 *   __runSim()        — 100-day college student (original)
 *   __runNewSemSim()  — 30-day freshman new semester
 *   __runKidSim()     — 60-day 7-year-old boy
 */
import { runSimulation, runNewSemesterSim, runKidSim } from './simulate100days';

function injectData(simFn: () => { data: any; log: string[] }): Promise<string[]> {
  const { data, log } = simFn();

  return new Promise((resolve, reject) => {
    const req = indexedDB.open('nousai-companion', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('appdata'); };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('appdata', 'readwrite');
      tx.objectStore('appdata').put(data, 'main');
      tx.oncomplete = () => {
        log.push('\n✅ Data injected into IndexedDB. Reload the page to see results.');
        resolve(log);
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

export const runSimAndInject = () => injectData(runSimulation);
export const runNewSemSimAndInject = () => injectData(runNewSemesterSim);
export const runKidSimAndInject = () => injectData(runKidSim);

// Expose globally for console access
(window as any).__runSim = runSimAndInject;
(window as any).__runNewSemSim = runNewSemSimAndInject;
(window as any).__runKidSim = runKidSimAndInject;
