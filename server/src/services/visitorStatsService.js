import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBufferedFileAppender } from '../utils/asyncFileWriter.js';
import { hashVisitorId, visitorHashPattern, visitorIdPattern } from './visitorTrackingPolicy.js';
export { isLikelyBot } from './visitorTrackingPolicy.js';

const directory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'data',
  'analytics',
);
const DAY = 86400000;
const GAP = 30 * 60000;
const dayKey = ts => new Date(ts + 3 * 3600000).toISOString().slice(0, 10);

export function readVisitorEvents(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const events = [];
  const seen = new Set();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      const at = Date.parse(event.ts);
      if (!Number.isFinite(at) || !visitorHashPattern.test(event.visitor || '')) continue;
      if (event.schema === 2) {
        if (!visitorHashPattern.test(event.eventId || '') || seen.has(event.eventId)) continue;
        seen.add(event.eventId);
      } else if (event.schema !== undefined) continue;
      events.push({ ...event, day: dayKey(at), at });
    } catch {
      /* Ignore incomplete or malformed individual records. */
    }
  }
  return events.sort((a, b) => a.at - b.at);
}

export function summarizeVisitorEvents(events, now = Date.now()) {
  const valid = events.filter(e => e.at <= now);
  const today = Date.parse(dayKey(now) + 'T00:00:00+03:00');
  const endMinute = Math.floor(now / 60000) * 60000;
  function period(from, to = now + 1) {
    const visitors = new Set(),
      lastSeen = new Map();
    let pageViews = 0,
      visits = 0,
      legacyPageViews = 0;
    for (const event of valid) {
      if (event.at < from - GAP || event.at >= to) continue;
      const previous = lastSeen.get(event.visitor);
      if (event.at >= from) {
        pageViews++;
        visitors.add(event.visitor);
        if (previous === undefined || event.at - previous >= GAP) visits++;
        if (event.schema !== 2) legacyPageViews++;
      }
      lastSeen.set(event.visitor, event.at);
    }
    return { visitors: visitors.size, visits, pageViews, legacyPageViews };
  }
  return {
    today: period(today),
    yesterday: period(today - DAY, today),
    last24Hours: period(endMinute - DAY, endMinute),
    last7Days: period(today - 6 * DAY),
    last30Days: period(today - 29 * DAY),
    total: period(0),
    tracking: { version: 2, filteredSince: valid.find(e => e.schema === 2)?.ts || null },
    generatedAt: new Date(now).toISOString(),
    timezone: 'Europe/Moscow',
  };
}

export function createVisitorStatsService({
  file = path.join(directory, 'visitor-events.jsonl'),
  clock = Date.now,
} = {}) {
  const writer = createBufferedFileAppender({ filePath: file, label: 'visitor-page-views' });
  const seen = new Map();
  const ttl = 2 * DAY;
  let historyAvailable = true;
  try {
    for (const event of readVisitorEvents(file))
      if (event.schema === 2 && event.at >= clock() - ttl) seen.set(event.eventId, event.at);
  } catch {
    // An unavailable analytics journal must not prevent the API from starting.
    // Keep collection closed until storage is fixed and the process restarts.
    historyAvailable = false;
  }
  let nextPrune = 0;
  return {
    record({ visitorHash, eventId }) {
      if (!historyAvailable) return false;
      if (
        !visitorHashPattern.test(visitorHash || '') ||
        typeof eventId !== 'string' ||
        !visitorIdPattern.test(eventId)
      )
        return false;
      const now = clock();
      if (now >= nextPrune) {
        for (const [key, at] of seen) if (at < now - ttl) seen.delete(key);
        nextPrune = now + 60000;
      }
      const key = hashVisitorId(visitorHash + ':' + eventId);
      if (seen.has(key)) return false;
      // Bound memory under abuse. Fail closed rather than evicting recent receipts.
      if (seen.size >= 100000) return false;
      seen.set(key, now);
      writer.append(
        JSON.stringify({
          schema: 2,
          ts: new Date(now).toISOString(),
          day: dayKey(now),
          visitor: visitorHash,
          eventId: key,
        }) + '\n',
      );
      return true;
    },
    getStats() {
      return summarizeVisitorEvents(readVisitorEvents(file), clock());
    },
    flush() {
      return writer.flush();
    },
  };
}
const service = createVisitorStatsService();
export const recordVisitorPageView = data => service.record(data);
export const getVisitorStats = () => service.getStats();
