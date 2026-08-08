/**
 * Face Models Loader — Parallel Progressive Model Loading & WebGL Pre-warming
 */

import { FaceApiBrowserService } from './services/faceapi-browser.service';

let modelsLoaded = false;
let loadingPromise: Promise<boolean> | null = null;

export async function loadFaceModels(
  modelUrl: string = '/models',
  onProgress?: (pct: number, msg: string) => void
): Promise<boolean> {
  if (modelsLoaded) return true;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      console.time('Face Models Load');
      const ok = await FaceApiBrowserService.loadModels(onProgress);
      if (ok) {
        modelsLoaded = true;
        console.timeEnd('Face Models Load');
        return true;
      }
      loadingPromise = null;
      return false;
    } catch (error) {
      loadingPromise = null;
      console.error('[FaceModels] Loading failed:', error);
      return false;
    }
  })();

  return loadingPromise;
}

export function areModelsLoaded(): boolean {
  return modelsLoaded || FaceApiBrowserService.isReady();
}
