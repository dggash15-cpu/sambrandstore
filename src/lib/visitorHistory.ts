export type VisitorLogKind =
  | 'visit'
  | 'view'
  | 'search'
  | 'category'
  | 'cart'
  | 'favorite'
  | 'compare'
  | 'order'
  | 'review';

export interface VisitorLogEntry {
  id: string;
  kind: VisitorLogKind;
  summary: string;
  detail?: string;
  productId?: string;
  category?: string;
  searchQuery?: string;
  timestamp: string;
}

export interface VisitorMeta {
  firstVisitAt: string;
  lastVisitAt: string;
  visitCount: number;
  lastCategory: string;
  lastSearch: string;
}

const LOG_KEY = 'sbs_visitor_log';
const META_KEY = 'sbs_visitor_meta';
const SEARCHES_KEY = 'sbs_recent_searches';
const ORDER_HISTORY_KEY = 'sbs_order_history';
const MAX_LOG_ENTRIES = 60;

export function getVisitorMeta(): VisitorMeta {
  const now = new Date().toISOString();
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<VisitorMeta>;
      return {
        firstVisitAt: parsed.firstVisitAt || now,
        lastVisitAt: parsed.lastVisitAt || now,
        visitCount: typeof parsed.visitCount === 'number' ? parsed.visitCount : 1,
        lastCategory: parsed.lastCategory || 'All',
        lastSearch: parsed.lastSearch || '',
      };
    }
  } catch {
    // Ignore storage errors
  }
  return {
    firstVisitAt: now,
    lastVisitAt: now,
    visitCount: 1,
    lastCategory: 'All',
    lastSearch: '',
  };
}

export function saveVisitorMeta(patch: Partial<VisitorMeta>): VisitorMeta {
  const current = getVisitorMeta();
  const next: VisitorMeta = { ...current, ...patch };
  try {
    localStorage.setItem(META_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
  return next;
}

export function recordBrowserSessionVisit(): { meta: VisitorMeta; entries: VisitorLogEntry[] } {
  const now = new Date().toISOString();
  let isNewVisit = false;
  try {
    if (!sessionStorage.getItem('sbs_session_recorded')) {
      isNewVisit = true;
      sessionStorage.setItem('sbs_session_recorded', now);
    }
  } catch {
    isNewVisit = true;
  }

  const existingRaw = (() => {
    try {
      return localStorage.getItem(META_KEY);
    } catch {
      return null;
    }
  })();

  let meta = getVisitorMeta();
  if (!existingRaw) {
    meta = saveVisitorMeta({
      firstVisitAt: now,
      lastVisitAt: now,
      visitCount: 1,
    });
    const entries = appendVisitorLog({
      kind: 'visit',
      summary: 'Started first visit to Sam Brand Store',
      detail: 'Browser history & shopping preferences active locally',
    });
    return { meta, entries };
  }

  if (isNewVisit) {
    const nextCount = meta.visitCount + 1;
    meta = saveVisitorMeta({
      lastVisitAt: now,
      visitCount: nextCount,
    });
    const entries = appendVisitorLog({
      kind: 'visit',
      summary: `Returned to Sam Brand Store (Visit #${nextCount})`,
      detail: `Restored preferences · Last department: ${meta.lastCategory}`,
    });
    return { meta, entries };
  }

  return { meta, entries: getVisitorLog() };
}

export function getVisitorLog(): VisitorLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as VisitorLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendVisitorLog(
  entry: Omit<VisitorLogEntry, 'id' | 'timestamp'> & { timestamp?: string }
): VisitorLogEntry[] {
  const current = getVisitorLog();
  const prevTop = current[0];
  // Avoid spamming identical consecutive events within 4 seconds
  if (
    prevTop &&
    prevTop.kind === entry.kind &&
    prevTop.summary === entry.summary &&
    Date.now() - new Date(prevTop.timestamp).getTime() < 4000
  ) {
    return current;
  }

  const nextEntry: VisitorLogEntry = {
    id: `vlog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kind: entry.kind,
    summary: entry.summary,
    detail: entry.detail,
    productId: entry.productId,
    category: entry.category,
    searchQuery: entry.searchQuery,
    timestamp: entry.timestamp || new Date().toISOString(),
  };

  const next = [nextEntry, ...current].slice(0, MAX_LOG_ENTRIES);
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function clearVisitorLog(): VisitorLogEntry[] {
  try {
    localStorage.removeItem(LOG_KEY);
    localStorage.removeItem(SEARCHES_KEY);
  } catch {
    // Ignore storage errors
  }
  return [];
}

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function recordRecentSearch(query: string): string[] {
  const clean = query.trim();
  if (clean.length < 2) return getRecentSearches();
  const current = getRecentSearches();
  const next = [clean, ...current.filter((q) => q.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
  try {
    localStorage.setItem(SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
  return next;
}

export interface LocalOrderSnapshot {
  orderNumber: string;
  email: string;
  total: number;
  createdAt: string;
}

export function getLocalOrderHistory(): LocalOrderSnapshot[] {
  try {
    const raw = localStorage.getItem(ORDER_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalOrderSnapshot[]) : [];
  } catch {
    return [];
  }
}

export function recordLocalOrder(snapshot: LocalOrderSnapshot): LocalOrderSnapshot[] {
  const current = getLocalOrderHistory();
  const next = [
    snapshot,
    ...current.filter((o) => o.orderNumber !== snapshot.orderNumber),
  ].slice(0, 10);
  try {
    localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
  return next;
}
