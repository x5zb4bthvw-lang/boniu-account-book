/* ============================================
   波妞记账 — IndexedDB 数据层 (替代 Core Data)
   ============================================ */

const DB_NAME = 'BoNiuDB';
const DB_VERSION = 1;

class BoNiuDB {
  constructor() {
    this.db = null;
    this.ready = this._init();
  }

  _init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Transaction 表
        if (!db.objectStoreNames.contains('transactions')) {
          const txnStore = db.createObjectStore('transactions', { keyPath: 'id' });
          txnStore.createIndex('type', 'type', { unique: false });
          txnStore.createIndex('category1', 'category1', { unique: false });
          txnStore.createIndex('date', 'date', { unique: false });
          txnStore.createIndex('accountId', 'accountId', { unique: false });
          txnStore.createIndex('type_date', ['type', 'date'], { unique: false });
          txnStore.createIndex('cat1_date', ['category1', 'date'], { unique: false });
        }

        // Account 表
        if (!db.objectStoreNames.contains('accounts')) {
          const accStore = db.createObjectStore('accounts', { keyPath: 'id' });
          accStore.createIndex('type', 'type', { unique: false });
        }

        // UserCategory 表
        if (!db.objectStoreNames.contains('userCategories')) {
          const catStore = db.createObjectStore('userCategories', { keyPath: 'id' });
          catStore.createIndex('type', 'type', { unique: false });
        }
      };
      req.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      req.onerror = (e) => { console.error('DB init failed:', e); reject(e); };
    });
  }

  // ---- Transaction CRUD ----

  async addTransaction(txn) {
    await this.ready;
    txn.id = txn.id || crypto.randomUUID();
    txn.createdAt = txn.createdAt || new Date().toISOString();
    return this._put('transactions', txn);
  }

  async addTransactions(txns) {
    await this.ready;
    const tx = this.db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    for (const t of txns) {
      t.id = t.id || crypto.randomUUID();
      t.createdAt = t.createdAt || new Date().toISOString();
      store.put(t);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = (e) => reject(e);
    });
  }

  async updateTransaction(txn) {
    await this.ready;
    return this._put('transactions', txn);
  }

  async deleteTransaction(id) {
    await this.ready;
    return this._delete('transactions', id);
  }

  async getTransaction(id) {
    await this.ready;
    return this._get('transactions', id);
  }

  async getTransactions(opts = {}) {
    await this.ready;
    const { type, category1, startDate, endDate, searchText, limit, offset = 0 } = opts;
    const store = this.db.transaction('transactions').objectStore('transactions');

    // 优先使用复合索引
    if (type && startDate && endDate) {
      const idx = store.index('type_date');
      const range = IDBKeyRange.bound(
        [type, typeof startDate === 'string' ? startDate : startDate.toISOString().split('T')[0]],
        [type, typeof endDate === 'string' ? endDate : endDate.toISOString().split('T')[0]]
      );
      return this._getAll(idx, range, limit, offset);
    }

    if (category1 && startDate && endDate) {
      const idx = store.index('cat1_date');
      const range = IDBKeyRange.bound(
        [category1, typeof startDate === 'string' ? startDate : startDate.toISOString().split('T')[0]],
        [category1, typeof endDate === 'string' ? endDate : endDate.toISOString().split('T')[0]]
      );
      return this._getAll(idx, range, limit, offset);
    }

    // 回退到单字段索引
    let results;
    if (type) {
      results = await this._getAll(store.index('type'), type);
    } else if (category1) {
      results = await this._getAll(store.index('category1'), category1);
    } else {
      results = await this._getAll(store);
    }

    // 日期过滤
    if (startDate) {
      const sd = typeof startDate === 'string' ? startDate : startDate.toISOString().split('T')[0];
      results = results.filter(t => t.date >= sd);
    }
    if (endDate) {
      const ed = typeof endDate === 'string' ? endDate : endDate.toISOString().split('T')[0];
      results = results.filter(t => t.date <= ed);
    }

    // 关键词搜索
    if (searchText) {
      const kw = searchText.toLowerCase();
      results = results.filter(t =>
        (t.category1 || '').toLowerCase().includes(kw) ||
        (t.category2 || '').toLowerCase().includes(kw) ||
        (t.note || '').toLowerCase().includes(kw)
      );
    }

    // 排序
    results.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    if (limit) results = results.slice(offset, offset + limit);
    return results;
  }

  async getSum(type, startDate, endDate) {
    await this.ready;
    const txns = await this.getTransactions({ type, startDate, endDate });
    return txns.reduce((s, t) => s + (t.amount || 0), 0);
  }

  // ---- Account CRUD ----

  async addAccount(acc) {
    await this.ready;
    acc.id = acc.id || crypto.randomUUID();
    acc.createdAt = acc.createdAt || new Date().toISOString();
    acc.sortOrder = acc.sortOrder || 999;
    return this._put('accounts', acc);
  }

  async updateAccount(acc) {
    await this.ready;
    return this._put('accounts', acc);
  }

  async deleteAccount(id) {
    await this.ready;
    return this._delete('accounts', id);
  }

  async getAccounts(type) {
    await this.ready;
    const store = this.db.transaction('accounts').objectStore('accounts');
    let results;
    if (type) {
      results = await this._getAll(store.index('type'), type);
    } else {
      results = await this._getAll(store);
    }
    results.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    return results;
  }

  // ---- UserCategory CRUD ----

  async addUserCategory(cat) {
    await this.ready;
    cat.id = cat.id || crypto.randomUUID();
    cat.sortOrder = cat.sortOrder || 999;
    return this._put('userCategories', cat);
  }

  async getUserCategories(type) {
    await this.ready;
    const store = this.db.transaction('userCategories').objectStore('userCategories');
    const results = type
      ? await this._getAll(store.index('type'), type)
      : await this._getAll(store);
    return results;
  }

  async deleteUserCategory(id) {
    await this.ready;
    return this._delete('userCategories', id);
  }

  // ---- Internal helpers ----

  _put(storeName, obj) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(obj);
      tx.oncomplete = () => resolve(obj);
      tx.onerror = (e) => reject(e);
    });
  }

  _delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = (e) => reject(e);
    });
  }

  _get(storeName, id) {
    return new Promise((resolve) => {
      const req = this.db.transaction(storeName).objectStore(storeName).get(id);
      req.onsuccess = () => resolve(req.result || null);
    });
  }

  _getAll(source, query, limit, offset) {
    return new Promise((resolve) => {
      let results = [];
      const range = query !== undefined ? (query instanceof IDBKeyRange ? query : IDBKeyRange.only(query)) : undefined;
      const req = source.openCursor(range, 'prev');
      let skipped = 0;
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) { resolve(results); return; }
        if (offset && skipped < offset) { skipped++; cursor.continue(); return; }
        results.push(cursor.value);
        if (limit && results.length >= limit) { resolve(results); return; }
        cursor.continue();
      };
      req.onerror = () => resolve(results);
    });
  }
}

// 全局单例
const db = new BoNiuDB();
