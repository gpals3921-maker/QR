// Local "DB" layer (localStorage 기반)
// 데이터는 같은 브라우저/프로필 안에서만 유지됩니다.

(function () {
  const KEY = "FIRE_QR_DB_V1";

  function nowIso() {
    return new Date().toISOString();
  }

  function safeParse(json, fallback) {
    try {
      return JSON.parse(json);
    } catch {
      return fallback;
    }
  }

  function loadDb() {
    const raw = localStorage.getItem(KEY);
    const base = {
      sessions: [],
      attendances: [],
      meta: { version: 1, updated_at: nowIso() },
    };
    if (!raw) return base;
    const parsed = safeParse(raw, base);
    if (!parsed || typeof parsed !== "object") return base;
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      attendances: Array.isArray(parsed.attendances) ? parsed.attendances : [],
      meta:
        parsed.meta && typeof parsed.meta === "object"
          ? parsed.meta
          : { version: 1, updated_at: nowIso() },
    };
  }

  function saveDb(db) {
    const next = {
      ...db,
      meta: { ...(db.meta || {}), version: 1, updated_at: nowIso() },
    };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }

  function randomId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizeText(s) {
    return String(s || "").trim();
  }

  function samePerson(aName, aDept, bName, bDept) {
    return (
      normalizeText(aName) === normalizeText(bName) &&
      normalizeText(aDept) === normalizeText(bDept)
    );
  }

  function listSessions({ days = 14 } = {}) {
    const db = loadDb();
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - days);
    const pastStr = past.toISOString().slice(0, 10);

    const sessions = db.sessions
      .filter((s) => (s.date || "") >= pastStr)
      .sort((a, b) => ((a.date || "") < (b.date || "") ? 1 : -1));

    return sessions.map((s) => ({
      ...s,
      attendance_count: db.attendances.filter((a) => a.session_id === s.id)
        .length,
    }));
  }

  function getSession(id) {
    const db = loadDb();
    return db.sessions.find((s) => s.id === id) || null;
  }

  function createSession({ date, title, note }) {
    const db = loadDb();
    const row = {
      id: randomId(),
      date: normalizeText(date),
      title: normalizeText(title),
      note: normalizeText(note),
      created_at: nowIso(),
    };
    db.sessions.push(row);
    saveDb(db);
    return row;
  }

  function listAttendances(sessionId) {
    const db = loadDb();
    return db.attendances
      .filter((a) => a.session_id === sessionId)
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  }

  function deptStats(sessionId) {
    const records = listAttendances(sessionId);
    const map = new Map();
    for (const r of records) {
      const key = normalizeText(r.department) || "미지정";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count);
  }

  function findDuplicateAttendance(sessionId, name, department) {
    const records = listAttendances(sessionId);
    return (
      records.find((r) => samePerson(r.name, r.department, name, department)) ||
      null
    );
  }

  function insertAttendance(sessionId, name, department) {
    const db = loadDb();
    const session = db.sessions.find((s) => s.id === sessionId);
    if (!session) return { ok: false, error: "SESSION_NOT_FOUND" };

    const dup = db.attendances.find(
      (r) =>
        r.session_id === sessionId &&
        samePerson(r.name, r.department, name, department)
    );
    if (dup) return { ok: false, error: "DUPLICATE", data: dup };

    const row = {
      id: randomId(),
      session_id: sessionId,
      name: normalizeText(name),
      department: normalizeText(department),
      created_at: nowIso(),
    };
    db.attendances.push(row);
    saveDb(db);
    return { ok: true, data: row };
  }

  window.LocalDB = {
    _KEY: KEY,
    loadDb,
    listSessions,
    getSession,
    createSession,
    listAttendances,
    deptStats,
    findDuplicateAttendance,
    insertAttendance,
  };
})();

// Local "DB" layer (localStorage 기반)
// 데이터는 같은 브라우저/프로필 안에서만 유지됩니다.

(function () {
  const KEY = "FIRE_QR_DB_V1";

  function nowIso() {
    return new Date().toISOString();
  }

  function safeParse(json, fallback) {
    try {
      return JSON.parse(json);
    } catch {
      return fallback;
    }
  }

  function loadDb() {
    const raw = localStorage.getItem(KEY);
    const base = {
      sessions: [],
      attendances: [],
      meta: { version: 1, updated_at: nowIso() },
    };
    if (!raw) return base;
    const parsed = safeParse(raw, base);
    if (!parsed || typeof parsed !== "object") return base;
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      attendances: Array.isArray(parsed.attendances) ? parsed.attendances : [],
      meta:
        parsed.meta && typeof parsed.meta === "object"
          ? parsed.meta
          : { version: 1, updated_at: nowIso() },
    };
  }

  function saveDb(db) {
    const next = {
      ...db,
      meta: { ...(db.meta || {}), version: 1, updated_at: nowIso() },
    };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }

  function randomId() {
    // uuid 대체(간단). 중복 확률 매우 낮음.
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizeText(s) {
    return String(s || "").trim();
  }

  function samePerson(aName, aDept, bName, bDept) {
    return (
      normalizeText(aName) === normalizeText(bName) &&
      normalizeText(aDept) === normalizeText(bDept)
    );
  }

  function listSessions({ days = 14 } = {}) {
    const db = loadDb();
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - days);
    const pastStr = past.toISOString().slice(0, 10);

    const sessions = db.sessions
      .filter((s) => (s.date || "") >= pastStr)
      .sort((a, b) => ((a.date || "") < (b.date || "") ? 1 : -1));

    return sessions.map((s) => ({
      ...s,
      attendance_count: db.attendances.filter((a) => a.session_id === s.id)
        .length,
    }));
  }

  function getSession(id) {
    const db = loadDb();
    return db.sessions.find((s) => s.id === id) || null;
  }

  function createSession({ date, title, note }) {
    const db = loadDb();
    const row = {
      id: randomId(),
      date: normalizeText(date),
      title: normalizeText(title),
      note: normalizeText(note),
      created_at: nowIso(),
    };
    db.sessions.push(row);
    saveDb(db);
    return row;
  }

  function listAttendances(sessionId) {
    const db = loadDb();
    return db.attendances
      .filter((a) => a.session_id === sessionId)
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  }

  function deptStats(sessionId) {
    const records = listAttendances(sessionId);
    const map = new Map();
    for (const r of records) {
      const key = normalizeText(r.department) || "미지정";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count);
  }

  function findDuplicateAttendance(sessionId, name, department) {
    const records = listAttendances(sessionId);
    return (
      records.find((r) => samePerson(r.name, r.department, name, department)) ||
      null
    );
  }

  function insertAttendance(sessionId, name, department) {
    const db = loadDb();
    const session = db.sessions.find((s) => s.id === sessionId);
    if (!session) return { ok: false, error: "SESSION_NOT_FOUND" };

    const dup = db.attendances.find(
      (r) =>
        r.session_id === sessionId &&
        samePerson(r.name, r.department, name, department)
    );
    if (dup) return { ok: false, error: "DUPLICATE", data: dup };

    const row = {
      id: randomId(),
      session_id: sessionId,
      name: normalizeText(name),
      department: normalizeText(department),
      created_at: nowIso(),
    };
    db.attendances.push(row);
    saveDb(db);
    return { ok: true, data: row };
  }

  window.LocalDB = {
    _KEY: KEY,
    loadDb,
    listSessions,
    getSession,
    createSession,
    listAttendances,
    deptStats,
    findDuplicateAttendance,
    insertAttendance,
  };
})();

