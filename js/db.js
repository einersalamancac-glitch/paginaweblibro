// ============================================================
// db.js — toda la persistencia de la app vive en el propio
// dispositivo, con IndexedDB. Nada se envía a ningún servidor.
//
// Object stores:
//   books      : { id, title, author, mode('text'|'image'),
//                  numPages, lastPageIndex, addedAt, coverColor }
//   blocks     : { id (=bookId), data: [...bloques de texto...] }   (modo texto)
//   pages_img  : { id (autoincrement), bookId, index, blob }        (modo imagen)
//   bookmarks  : { id (autoincrement), bookId, pageIndex, label, createdAt }
//   settings   : { key, value }
// ============================================================
const DB = (function () {
  const DB_NAME = "mi_biblioteca_db";
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("books")) {
          db.createObjectStore("books", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("blocks")) {
          db.createObjectStore("blocks", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("pages_img")) {
          const s = db.createObjectStore("pages_img", { keyPath: "pid", autoIncrement: true });
          s.createIndex("byBook", "bookId", { unique: false });
        }
        if (!db.objectStoreNames.contains("bookmarks")) {
          const s = db.createObjectStore("bookmarks", { keyPath: "bid", autoIncrement: true });
          s.createIndex("byBook", "bookId", { unique: false });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function tx(storeNames, mode) {
    return open().then((db) => db.transaction(storeNames, mode));
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ---------------- libros ----------------
  async function putBook(book) {
    const t = await tx(["books"], "readwrite");
    t.objectStore("books").put(book);
    return new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
  }

  async function getBook(id) {
    const t = await tx(["books"], "readonly");
    return reqToPromise(t.objectStore("books").get(id));
  }

  async function getAllBooks() {
    const t = await tx(["books"], "readonly");
    const list = await reqToPromise(t.objectStore("books").getAll());
    list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    return list;
  }

  async function deleteBook(id) {
    const t = await tx(["books", "blocks", "pages_img", "bookmarks"], "readwrite");
    t.objectStore("books").delete(id);
    t.objectStore("blocks").delete(id);
    const imgIdx = t.objectStore("pages_img").index("byBook");
    imgIdx.openCursor(IDBKeyRange.only(id)).onsuccess = function (e) {
      const cur = e.target.result;
      if (cur) { cur.delete(); cur.continue(); }
    };
    const bmIdx = t.objectStore("bookmarks").index("byBook");
    bmIdx.openCursor(IDBKeyRange.only(id)).onsuccess = function (e) {
      const cur = e.target.result;
      if (cur) { cur.delete(); cur.continue(); }
    };
    return new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
  }

  async function updateBookProgress(id, lastPageIndex) {
    const book = await getBook(id);
    if (!book) return;
    book.lastPageIndex = lastPageIndex;
    return putBook(book);
  }

  // ---------------- bloques de texto (modo texto) ----------------
  async function putBlocks(bookId, data) {
    const t = await tx(["blocks"], "readwrite");
    t.objectStore("blocks").put({ id: bookId, data: data });
    return new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
  }

  async function getBlocks(bookId) {
    const t = await tx(["blocks"], "readonly");
    const rec = await reqToPromise(t.objectStore("blocks").get(bookId));
    return rec ? rec.data : null;
  }

  // ---------------- páginas-imagen (modo imagen) ----------------
  async function putImagePage(bookId, index, blob) {
    const t = await tx(["pages_img"], "readwrite");
    t.objectStore("pages_img").put({ bookId: bookId, index: index, blob: blob });
    return new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
  }

  async function getImagePages(bookId) {
    const t = await tx(["pages_img"], "readonly");
    const idx = t.objectStore("pages_img").index("byBook");
    const list = await reqToPromise(idx.getAll(IDBKeyRange.only(bookId)));
    list.sort((a, b) => a.index - b.index);
    return list;
  }

  // ---------------- marcadores ----------------
  async function addBookmark(bookId, pageIndex, label) {
    const t = await tx(["bookmarks"], "readwrite");
    t.objectStore("bookmarks").put({ bookId, pageIndex, label: label || "", createdAt: Date.now() });
    return new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
  }

  async function getBookmarks(bookId) {
    const t = await tx(["bookmarks"], "readonly");
    const idx = t.objectStore("bookmarks").index("byBook");
    const list = await reqToPromise(idx.getAll(IDBKeyRange.only(bookId)));
    list.sort((a, b) => a.pageIndex - b.pageIndex);
    return list;
  }

  async function deleteBookmark(bid) {
    const t = await tx(["bookmarks"], "readwrite");
    t.objectStore("bookmarks").delete(bid);
    return new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
  }

  // ---------------- ajustes globales ----------------
  async function getSetting(key, fallback) {
    const t = await tx(["settings"], "readonly");
    const rec = await reqToPromise(t.objectStore("settings").get(key));
    return rec ? rec.value : fallback;
  }

  async function setSetting(key, value) {
    const t = await tx(["settings"], "readwrite");
    t.objectStore("settings").put({ key, value });
    return new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
  }

  return {
    putBook, getBook, getAllBooks, deleteBook, updateBookProgress,
    putBlocks, getBlocks,
    putImagePage, getImagePages,
    addBookmark, getBookmarks, deleteBookmark,
    getSetting, setSetting,
  };
})();
