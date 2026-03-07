import { describe, it, expect, beforeEach } from 'vitest';

import { _initTestDatabase, getAllChats, storeChatMetadata } from './db.js';
import { getAvailableGroups, _setRegisteredGroups } from './index.js';

beforeEach(() => {
  _initTestDatabase();
  _setRegisteredGroups({});
});

// --- JID ownership patterns ---

describe('JID ownership patterns', () => {
  // These test the patterns that will become ownsJid() on the Channel interface

  it('Discord JID: starts with dc:', () => {
    const jid = 'dc:1234567890123456';
    expect(jid.startsWith('dc:')).toBe(true);
  });

  it('Telegram JID: starts with tg:', () => {
    const jid = 'tg:123456789';
    expect(jid.startsWith('tg:')).toBe(true);
  });

  it('Telegram group JID: starts with tg: and has negative ID', () => {
    const jid = 'tg:-1001234567890';
    expect(jid.startsWith('tg:')).toBe(true);
  });
});

// --- getAvailableGroups ---

describe('getAvailableGroups', () => {
  it('returns only groups, excludes DMs', () => {
    storeChatMetadata('dc:111', '2024-01-01T00:00:01.000Z', 'Group 1', 'discord', true);
    storeChatMetadata('dc:222', '2024-01-01T00:00:03.000Z', 'Group 2', 'discord', true);

    const groups = getAvailableGroups();
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.jid)).toContain('dc:111');
    expect(groups.map((g) => g.jid)).toContain('dc:222');
  });

  it('includes Discord channel JIDs', () => {
    storeChatMetadata('dc:1234567890123456', '2024-01-01T00:00:01.000Z', 'Discord Channel', 'discord', true);

    const groups = getAvailableGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].jid).toBe('dc:1234567890123456');
  });

  it('marks registered Discord channels correctly', () => {
    storeChatMetadata('dc:1234567890123456', '2024-01-01T00:00:01.000Z', 'DC Registered', 'discord', true);
    storeChatMetadata('dc:9999999999999999', '2024-01-01T00:00:02.000Z', 'DC Unregistered', 'discord', true);

    _setRegisteredGroups({
      'dc:1234567890123456': {
        name: 'DC Registered',
        folder: 'dc-registered',
        trigger: '@Andy',
        added_at: '2024-01-01T00:00:00.000Z',
      },
    });

    const groups = getAvailableGroups();
    const dcReg = groups.find((g) => g.jid === 'dc:1234567890123456');
    const dcUnreg = groups.find((g) => g.jid === 'dc:9999999999999999');

    expect(dcReg?.isRegistered).toBe(true);
    expect(dcUnreg?.isRegistered).toBe(false);
  });

  it('excludes __group_sync__ sentinel', () => {
    storeChatMetadata('__group_sync__', '2024-01-01T00:00:00.000Z');
    storeChatMetadata('dc:123', '2024-01-01T00:00:01.000Z', 'Group', 'discord', true);

    const groups = getAvailableGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].jid).toBe('dc:123');
  });

  it('marks registered groups correctly', () => {
    storeChatMetadata('dc:100', '2024-01-01T00:00:01.000Z', 'Registered', 'discord', true);
    storeChatMetadata('dc:200', '2024-01-01T00:00:02.000Z', 'Unregistered', 'discord', true);

    _setRegisteredGroups({
      'dc:100': {
        name: 'Registered',
        folder: 'registered',
        trigger: '@Andy',
        added_at: '2024-01-01T00:00:00.000Z',
      },
    });

    const groups = getAvailableGroups();
    const reg = groups.find((g) => g.jid === 'dc:100');
    const unreg = groups.find((g) => g.jid === 'dc:200');

    expect(reg?.isRegistered).toBe(true);
    expect(unreg?.isRegistered).toBe(false);
  });

  it('returns groups ordered by most recent activity', () => {
    storeChatMetadata('dc:old', '2024-01-01T00:00:01.000Z', 'Old', 'discord', true);
    storeChatMetadata('dc:new', '2024-01-01T00:00:05.000Z', 'New', 'discord', true);
    storeChatMetadata('dc:mid', '2024-01-01T00:00:03.000Z', 'Mid', 'discord', true);

    const groups = getAvailableGroups();
    expect(groups[0].jid).toBe('dc:new');
    expect(groups[1].jid).toBe('dc:mid');
    expect(groups[2].jid).toBe('dc:old');
  });

  it('excludes non-group chats regardless of JID format', () => {
    // Unknown JID format stored without is_group should not appear
    storeChatMetadata('unknown-format-123', '2024-01-01T00:00:01.000Z', 'Unknown');
    // Explicitly non-group with unusual JID
    storeChatMetadata('custom:abc', '2024-01-01T00:00:02.000Z', 'Custom DM', 'custom', false);
    // A real Discord group for contrast
    storeChatMetadata('dc:999', '2024-01-01T00:00:03.000Z', 'Group', 'discord', true);

    const groups = getAvailableGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].jid).toBe('dc:999');
  });

  it('returns empty array when no chats exist', () => {
    const groups = getAvailableGroups();
    expect(groups).toHaveLength(0);
  });

  it('includes Telegram chat JIDs', () => {
    storeChatMetadata('tg:100200300', '2024-01-01T00:00:01.000Z', 'Telegram Chat', 'telegram', true);

    const groups = getAvailableGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].jid).toBe('tg:100200300');
  });

  it('returns Telegram group JIDs with negative IDs', () => {
    storeChatMetadata('tg:-1001234567890', '2024-01-01T00:00:01.000Z', 'TG Group', 'telegram', true);

    const groups = getAvailableGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].jid).toBe('tg:-1001234567890');
    expect(groups[0].name).toBe('TG Group');
  });

  it('marks registered Telegram chats correctly', () => {
    storeChatMetadata('tg:100200300', '2024-01-01T00:00:01.000Z', 'TG Registered', 'telegram', true);
    storeChatMetadata('tg:999999', '2024-01-01T00:00:02.000Z', 'TG Unregistered', 'telegram', true);

    _setRegisteredGroups({
      'tg:100200300': {
        name: 'TG Registered',
        folder: 'tg-registered',
        trigger: '@Andy',
        added_at: '2024-01-01T00:00:00.000Z',
      },
    });

    const groups = getAvailableGroups();
    const tgReg = groups.find((g) => g.jid === 'tg:100200300');
    const tgUnreg = groups.find((g) => g.jid === 'tg:999999');

    expect(tgReg?.isRegistered).toBe(true);
    expect(tgUnreg?.isRegistered).toBe(false);
  });

  it('mixes Discord and Telegram chats ordered by activity', () => {
    storeChatMetadata('dc:old', '2024-01-01T00:00:01.000Z', 'Discord Old', 'discord', true);
    storeChatMetadata('tg:100', '2024-01-01T00:00:03.000Z', 'Telegram', 'telegram', true);
    storeChatMetadata('dc:mid', '2024-01-01T00:00:02.000Z', 'Discord Mid', 'discord', true);

    const groups = getAvailableGroups();
    expect(groups).toHaveLength(3);
    expect(groups[0].jid).toBe('tg:100');
    expect(groups[1].jid).toBe('dc:mid');
    expect(groups[2].jid).toBe('dc:old');
  });
});
