/**
 * Kiosk Face IndexedDB Helper (using 'idb' package)
 *
 * Implements structured storage for employee face vectors, sync metadata, and offline face matching.
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";

export interface EmployeeFace {
  id: string;                 // employee_id / profile_id
  fullName: string;
  employeeCode?: string;
  avatarUrl?: string | null;
  embedding: number[];        // 128-dimensional vector
  faceQualityScore?: number;
  updatedAt: number;          // timestamp
}

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
    await tx.store.put({
      ...emp,
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
  console.log(`[idb FaceDB] Successfully saved ${employees.length} employees (${enrolledCount} enrolled vectors) to IndexedDB.`);
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
export interface MatchResult {
  isMatch: boolean;
  employee: EmployeeFace | null;
  similarity: number;
  message: string;
}

export async function matchFaceOffline(
  queryEmbedding: number[],
  threshold: number = 0.60
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

  let bestMatch: EmployeeFace | null = null;
  let bestScore = -1;

  for (const emp of employees) {
    if (!emp.embedding || emp.embedding.length === 0) continue;

    const score = cosineSimilarity(queryEmbedding, emp.embedding);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = emp;
    }
  }

  if (bestMatch && bestScore >= threshold) {
    return {
      isMatch: true,
      employee: bestMatch,
      similarity: bestScore,
      message: "Face matched successfully",
    };
  }

  return {
    isMatch: false,
    employee: null,
    similarity: bestScore,
    message: "No matching employee found",
  };
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
