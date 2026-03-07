/**
 * Step: groups — List groups known to the bot from the database.
 * Groups are registered via the `register_group` IPC command at runtime.
 * WhatsApp group sync has been removed; Discord is the only channel.
 */
import fs from 'fs';
import path from 'path';

import Database from 'better-sqlite3';

import { STORE_DIR } from '../src/config.js';
import { emitStatus } from './status.js';

function parseArgs(args: string[]): { list: boolean; limit: number } {
  let list = false;
  let limit = 30;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--list') list = true;
    if (args[i] === '--limit' && args[i + 1]) { limit = parseInt(args[i + 1], 10); i++; }
  }
  return { list, limit };
}

export async function run(args: string[]): Promise<void> {
  const { list, limit } = parseArgs(args);

  if (list) {
    await listGroups(limit);
    return;
  }

  // No sync step needed for Discord — groups are registered via IPC at runtime.
  emitStatus('SYNC_GROUPS', {
    STATUS: 'success',
    NOTE: 'Discord groups are registered via register_group IPC command at runtime.',
  });
}

async function listGroups(limit: number): Promise<void> {
  const dbPath = path.join(STORE_DIR, 'messages.db');

  if (!fs.existsSync(dbPath)) {
    console.error('ERROR: database not found');
    process.exit(1);
  }

  const db = new Database(dbPath, { readonly: true });
  const rows = db.prepare(
    `SELECT jid, name FROM chats
     WHERE is_group = 1 AND jid <> '__group_sync__' AND name <> jid
     ORDER BY last_message_time DESC
     LIMIT ?`,
  ).all(limit) as Array<{ jid: string; name: string }>;
  db.close();

  for (const row of rows) {
    console.log(`${row.jid}|${row.name}`);
  }
}
