/**
 * Kiosk Face IndexedDB Helper (using 'idb' package)
 *
 * Implements structured storage for employee face vectors, sync metadata, and offline face matching.
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";
import { l2Normalize, matchFaceFast, EmployeeFace, MatchResult } from "./face-threshold";

export type { EmployeeFace, MatchResult };


export interface SyncInfo {
  key: string;
  lastSyncedAt: number;
  tenantId: string;
  totalEmployees: number;
  enrolledEmployees: number;
}

interface FaceDB extends DBSchema {
  employees: {
    key: string;
    value: EmployeeFace;
    indexes: { "by-updated": number };
  };
  meta: {
    key: string;
    value: SyncInfo;
  };
}

const DB_NAME = "kiosk-face-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<FaceDB>> | null = null;

function getDB() {
  if (typeof window === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB<FaceDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Employees store
        if (!db.objectStoreNames.contains("employees")) {
          const employeeStore = db.createObjectStore("employees", {
            keyPath: "id",
          });
          employeeStore.createIndex("by-updated", "updatedAt");
        }

        // Meta store (for last sync info)
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

// ======================
// Save / Sync Embeddings
// ======================
export async function saveEmployeeFaces(
  employees: EmployeeFace[],
  tenantId: string
) {
  const db = await getDB();
  if (!db) return;
  const tx = db.transaction("employees", "readwrite");

  // Clear old cached employees
  await tx.store.clear();

  const enrolledCount = employees.filter(e => e.embedding && e.embedding.length === 128).length;

  for (const emp of employees) {
    const normalizedVector = emp.embedding && emp.embedding.length === 128 ? l2Normalize(emp.embedding) : emp.embedding;
    await tx.store.put({
      ...emp,
      embedding: normalizedVector,
      updatedAt: Date.now(),
    });
  }

  // Save meta
  await db.put("meta", {
    key: "sync-info",
    lastSyncedAt: Date.now(),
    tenantId,
    totalEmployees: employees.length,
    enrolledEmployees: enrolledCount
  });

  await tx.done;
  console.log(`[idb FaceDB] Successfully saved ${employees.length} employees (${enrolledCount} enrolled vectors, L2-normalized) to IndexedDB.`);
}

/**
 * Pull 128-d embeddings from Supabase → parse stringified vector format → L2-normalize → IndexedDB
 */
export async function syncFacesFromSupabase(tenantId: string, supabaseClient?: any) {
  if (!supabaseClient || typeof window === 'undefined') return { count: 0 };

  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('id, full_name, mobile_no, avatar_url, face_embedding')
      .eq('tenant_id', tenantId)
      .not('face_embedding', 'is', null);

    if (error) {
      console.warn('[FaceDB] Supabase face sync warning:', error.message);
      return { count: 0 };
    }

    if (!data || data.length === 0) return { count: 0 };

    const mappedEmployees: EmployeeFace[] = [];

    for (const row of data) {
      let embedding = row.face_embedding as number[] | string | null;

      if (typeof embedding === 'string') {
        try {
          embedding = JSON.parse(embedding.replace(/^\[/, '[').replace(/\]$/, ']'));
        } catch (e) {
          console.warn('[FaceDB] Failed to parse stringified vector for:', row.id);
          continue;
        }
      }

      if (!Array.isArray(embedding) || embedding.length !== 128) continue;

      mappedEmployees.push({
        id: row.id,
        fullName: row.full_name || 'Employee',
        employeeCode: row.mobile_no || undefined,
        avatarUrl: row.avatar_url,
        embedding: l2Normalize(embedding),
        updatedAt: Date.now(),
      });
    }

    await saveEmployeeFaces(mappedEmployees, tenantId);
    return { count: mappedEmployees.length };
  } catch (err) {
    console.warn('[FaceDB] Sync error:', err);
    return { count: 0 };
  }
}



// ======================
// Get all employees
// ======================
export async function getAllEmployeeFaces(): Promise<EmployeeFace[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAll("employees");
}

// ======================
// Clear database
// ======================
export async function clearFaceDB() {
  const db = await getDB();
  if (!db) return;
  await db.clear("employees");
  await db.clear("meta");
}

// ======================
// Cosine Similarity
// ======================
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dot / denominator;
}

// ======================
// Offline Face Match
// ======================


export async function matchFaceOffline(
  queryEmbedding: number[],
  threshold: number = 0.42
): Promise<MatchResult> {
  const db = await getDB();
  if (!db) {
    return {
      isMatch: false,
      employee: null,
      similarity: 0,
      message: "IndexedDB not ready",
    };
  }

  const employees = await db.getAll("employees");

  if (employees.length === 0) {
    return {
      isMatch: false,
      employee: null,
      similarity: 0,
      message: "No employee faces found in local storage. Please sync first.",
    };
  }

  // Use fast L2-normalized dot-product matching with Top-2 gap check
  return matchFaceFast(queryEmbedding, employees, threshold);
}


// ======================
// Get Sync Info
// ======================
export async function getSyncInfo(): Promise<SyncInfo | null> {
  const db = await getDB();
  if (!db) return null;
  const info = await db.get("meta", "sync-info");
  return info || null;
}
