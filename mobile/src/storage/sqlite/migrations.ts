import type { SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_VERSION } from '@/storage/constants';
import { StorageError, toStorageError } from '@/storage/types';

import { applySchema, configureDatabasePragmas } from './schema';

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  try {
    // Pragmas (especially WAL) must run outside a transaction.
    await configureDatabasePragmas(db);

    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const currentVersion = row?.user_version ?? 0;

    if (currentVersion >= DATABASE_VERSION) {
      return;
    }

    if (currentVersion < 1) {
      await applySchema(db);
    }
  } catch (error) {
    throw toStorageError(error, 'Failed to migrate local database', 'DATABASE_INIT_FAILED');
  }
}

export async function assertDatabaseReady(db: SQLiteDatabase): Promise<void> {
  try {
    await db.getFirstAsync('SELECT 1');
  } catch (error) {
    throw new StorageError('Local database is not ready', 'DATABASE_NOT_READY', error);
  }
}
