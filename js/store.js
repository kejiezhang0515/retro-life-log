// 單一資料來源 RL.store(文字 / 擺放資料,存 localStorage)與 RL.idb(照片、影片 Blob,存 IndexedDB)。
// 所有讀寫都包 try/catch;失敗就退回記憶體,不報錯(重新載入後就不會保留)。
(function () {
  const KEY = 'retro-life-log:v2';
  const defaults = () => ({
    todo: { items: Array.from({ length: RL.TODO.rows }, () => ({ t: '', d: false })) },
    daily: { date: null, text: '' },          // date 為 null = 自動使用當天日期
    laptop: { hasVideo: false, name: '' },
    // 自由擺放物件:每筆 { id, type: frame|sticker|text, lib, x, y(中心,佔擺放層寬高 %), w(佔寬 %), rot, z, photo, text, font, color, fs }
    calendar: { items: [] },
    clipboard: { seeded: false, items: [] },       // 第一次使用時放入 5 個預設相框(RL.clipboardSeed)
    notebook: { pages: [[], [], [], [], [], []] }  // 3 張紙共 6 面,每面一個擺放層
  });
  let data = defaults(), timer = null;
  const seed = () => { if (!data.clipboard.seeded) { data.clipboard.items = RL.clipboardSeed(); data.clipboard.seeded = true; } };
  const subs = {};

  function merge(base, saved) {                 // 以預設值為底,補上儲存的內容(型別不符就忽略)
    if (Array.isArray(base)) {
      if (!Array.isArray(saved)) return base;
      if (base.length === 0) return saved;                       // 長度不固定的清單(擺放物件)直接採用
      return saved.length === base.length ? saved.map((v, i) => merge(base[i], v)) : base;
    }
    if (base && typeof base === 'object') {
      const out = {}; for (const k in base) out[k] = merge(base[k], saved && typeof saved === 'object' ? saved[k] : undefined); return out;
    }
    return typeof saved === typeof base || (base === null && (typeof saved === 'string')) ? saved : base;
  }
  if (RL.PERSIST) { try { const raw = localStorage.getItem(KEY); if (raw) data = merge(defaults(), JSON.parse(raw)); } catch (e) { /* 讀不到就用預設值 */ } }
  else {   // 不保存模式:順手清掉先前版本留下的資料
    try { localStorage.removeItem(KEY); } catch (e) {}
    try { indexedDB.deleteDatabase('retro-life-log'); } catch (e) {}
  }
  seed();

  function save() {
    clearTimeout(timer);
    if (!RL.PERSIST) return;
    timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 空間不足或被禁用:留在記憶體 */ } }, 250);
  }
  function flush() { if (RL.PERSIST && timer) { clearTimeout(timer); timer = null; try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} } }
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

  function emit(key) {
    (subs[key] || []).slice().forEach(fn => { try { fn(data[key]); } catch (e) { console.error(e); } });
    (subs['*'] || []).slice().forEach(fn => { try { fn(key); } catch (e) { console.error(e); } });
  }
  RL.store = {
    get: key => data[key],
    // 就地修改某個 key 底下的資料,然後通知訂閱者、排程存檔
    update(key, fn) { fn(data[key]); save(); emit(key); },
    set(key, val) { data[key] = val; save(); emit(key); },
    subscribe(key, fn) { (subs[key] = subs[key] || []).push(fn); return () => { subs[key] = subs[key].filter(f => f !== fn); }; },
    reset() {
      data = defaults(); seed(); clearTimeout(timer); timer = null;
      try { localStorage.removeItem(KEY); } catch (e) {}
      Object.keys(data).forEach(emit);
    }
  };

  // ── IndexedDB(Blob)。失敗時退回記憶體 Map。 ──
  const mem = new Map();
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(resolve => {
      if (!RL.PERSIST) return resolve(null);
      try {
        const req = indexedDB.open('retro-life-log', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('blobs');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch (e) { resolve(null); }
    });
    return dbp;
  }
  function run(mode, fn) {                      // → Promise<result | undefined>,失敗時 reject
    return db().then(d => new Promise((resolve, reject) => {
      if (!d) return reject(new Error('no-idb'));
      try {
        const tx = d.transaction('blobs', mode), st = tx.objectStore('blobs'), req = fn(st);
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = tx.onabort = () => reject(tx.error || new Error('idb'));
      } catch (e) { reject(e); }
    }));
  }
  RL.idb = {
    // 回傳 true = 已寫入 IndexedDB;false = 只留在記憶體(重新載入後會消失)
    async put(key, blob) { mem.set(key, blob); try { await run('readwrite', s => s.put(blob, key)); return true; } catch (e) { return false; } },
    async get(key) { try { const v = await run('readonly', s => s.get(key)); if (v) return v; } catch (e) {} return mem.get(key) || null; },
    async del(key) { mem.delete(key); try { await run('readwrite', s => s.delete(key)); } catch (e) {} },
    async clear() { mem.clear(); try { await run('readwrite', s => s.clear()); } catch (e) {} }
  };
})();
