// js/index.js

// =====================
// 1) Работа с IndexedDB
// =====================
const DB_NAME = 'LocomotivesEngineersDB';
const DB_VERSION = 2;
let db;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = event => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains('columns')) {
                const store = database.createObjectStore('columns', { keyPath: 'columnId' });
                store.createIndex('by_title', 'title', { unique: false });
            }
            if (!database.objectStoreNames.contains('subcolumns')) {
                const store = database.createObjectStore('subcolumns', { keyPath: 'subId' });
                store.createIndex('by_column', 'columnId', { unique: false });
            }
            if (!database.objectStoreNames.contains('cards')) {
                const store = database.createObjectStore('cards', { keyPath: 'id' });
                store.createIndex('by_column_sub', ['columnId', 'subId'], { unique: false });
            }
        };
        request.onsuccess = event => { db = event.target.result; resolve(db); };
        request.onerror = event => { console.error('IndexedDB error:', event.target.error); reject(event.target.error); };
    });
}

// Добавление и получение колонок
function addColumnToDB(title) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('columns', 'readwrite');
        const store = tx.objectStore('columns');
        const columnId = 'col-' + Date.now();
        const newColumn = { columnId, title };
        const req = store.add(newColumn);
        req.onsuccess = () => resolve(newColumn);
        req.onerror = e => reject(e.target.error);
    });
}

function getAllColumns() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('columns', 'readonly');
        const store = tx.objectStore('columns');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = e => reject(e.target.error);
    });
}

function deleteColumnFromDB(columnId) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['columns','subcolumns','cards'], 'readwrite');
        const cols = tx.objectStore('columns');
        const subs = tx.objectStore('subcolumns');
        const cards = tx.objectStore('cards');
        cols.delete(columnId);
        const idx = subs.index('by_column');
        idx.getAll(IDBKeyRange.only(columnId)).onsuccess = e => {
            e.target.result.forEach(s => {
                subs.delete(s.subId);
                cards.index('by_column_sub').getAll([columnId,s.subId]).onsuccess = ev => {
                    ev.target.result.forEach(c => cards.delete(c.id));
                };
            });
        };
        tx.oncomplete = () => resolve();
        tx.onerror = e => reject(e.target.error);
    });
}

// Добавление и получение подколонок
function addSubcolumnToDB(columnId, title) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('subcolumns','readwrite');
        const store = tx.objectStore('subcolumns');
        const subId = 'sub-' + Date.now();
        const newSub = { subId, columnId, title };
        const req = store.add(newSub);
        req.onsuccess = () => resolve(newSub);
        req.onerror = e => reject(e.target.error);
    });
}

function getSubcolumnsByColumn(columnId) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('subcolumns','readonly');
        const store = tx.objectStore('subcolumns');
        const idx = store.index('by_column');
        const req = idx.getAll(IDBKeyRange.only(columnId));
        req.onsuccess = () => resolve(req.result);
        req.onerror = e => reject(e.target.error);
    });
}

function deleteSubcolumnFromDB(subId) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['subcolumns','cards'],'readwrite');
        const subs = tx.objectStore('subcolumns');
        const cards = tx.objectStore('cards');
        subs.delete(subId);
        cards.getAll().onsuccess = e => {
            e.target.result.forEach(c => { if(c.subId===subId) cards.delete(c.id); });
        };
        tx.oncomplete = () => resolve();
        tx.onerror = e => reject(e.target.error);
    });
}

// Добавление, обновление, удаление и получение карточек
function addCardToDB(card) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('cards','readwrite');
        const store = tx.objectStore('cards');
        const req = store.add(card);
        req.onsuccess = () => resolve();
        req.onerror = e => reject(e.target.error);
    });
}

function updateCardInDB(card) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('cards','readwrite');
        const store = tx.objectStore('cards');
        const req = store.put(card);
        req.onsuccess = () => resolve();
        req.onerror = e => reject(e.target.error);
    });
}

function deleteCardFromDB(cardId) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('cards','readwrite');
        const store = tx.objectStore('cards');
        const req = store.delete(cardId);
        req.onsuccess = () => resolve();
        req.onerror = e => reject(e.target.error);
    });
}

function getAllCards() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('cards','readonly');
        const store = tx.objectStore('cards');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = e => reject(e.target.error);
    });
}

function moveCardInDB(cardId,newColumnId,newSubId) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('cards','readwrite');
        const store = tx.objectStore('cards');
        const req = store.get(cardId);
        req.onsuccess = e => {
            const card = e.target.result;
            card.columnId=newColumnId; card.subId=newSubId;
            store.put(card).onsuccess = () => resolve();
        };
        req.onerror = e => reject(e.target.error);
    });
}

// =====================
// 2) Рендеринг DOM с Tailwind
// =====================
async function renderColumn(column) {
    const board = document.getElementById('board');
    const colDiv = document.createElement('div');
    colDiv.classList.add('bg-gray-100','border','border-gray-300','rounded-lg','flex','flex-col','mb-4','p-2','max-w-[600px]','min-w-[500px]','flex-1');
    colDiv.dataset.column = column.columnId;

    const header = document.createElement('div');
    header.classList.add('flex','items-center','justify-between','bg-gray-200','border-b','border-gray-300','px-4','py-2','rounded-t-lg');
    const h2 = document.createElement('h2'); h2.textContent = column.title;
    const delColBtn = document.createElement('button');
    delColBtn.textContent = '×';
    delColBtn.classList.add('bg-red-500','text-white','text-sm','rounded','px-2','py-1','hover:bg-red-600','transition');
    delColBtn.addEventListener('click', async () => { if(!confirm(`Удалить всю колонку "${column.title}"?`)) return; await deleteColumnFromDB(column.columnId); colDiv.remove(); });
    header.append(h2,delColBtn); colDiv.appendChild(header);

    const subsContainer = document.createElement('div');
    subsContainer.classList.add('flex','flex-wrap','gap-3','p-3','flex-1'); subsContainer.id = `subs-${column.columnId}`;
    colDiv.appendChild(subsContainer);

    const addSubBtn = document.createElement('button');
    addSubBtn.textContent = '+ Подколонку';
    addSubBtn.classList.add('bg-blue-500','text-white','text-sm','rounded','hover:bg-blue-600','px-3','py-1.5','mt-2','self-end','mr-4','transition');
    addSubBtn.addEventListener('click', async () => { const title=prompt('Название новой подколонки:'); if(!title)return; const newSub=await addSubcolumnToDB(column.columnId,title); renderSubcolumn(newSub); });
    colDiv.appendChild(addSubBtn);

    board.appendChild(colDiv);
    const subs = await getSubcolumnsByColumn(column.columnId);
    subs.forEach(renderSubcolumn);
}

function renderSubcolumn(sub) {
    const container = document.getElementById(`subs-${sub.columnId}`);
    if(!container)return;
    const subDiv = document.createElement('div');
    subDiv.classList.add('bg-white','border','border-gray-300','rounded-md','flex','flex-col','min-w-[200px]','flex-1','relative');
    subDiv.dataset.sub=sub.subId; subDiv.dataset.column=sub.columnId;

    const header = document.createElement('div');
    header.classList.add('flex','justify-between','items-center','bg-gray-100','border-b','border-gray-300','px-2','py-1');
    const titleEl=document.createElement('h3'); titleEl.textContent=sub.title;
    const delBtn=document.createElement('button'); delBtn.textContent='×';
    delBtn.classList.add('bg-red-500','text-white','text-xs','px-2','py-1','rounded','hover:bg-red-600','transition');
    delBtn.addEventListener('click', async()=>{ if(!confirm(`Удалить подколонку "${sub.title}"?`))return; await deleteSubcolumnFromDB(sub.subId); subDiv.remove(); });
    header.append(titleEl,delBtn); subDiv.appendChild(header);

    const cardsContainer=document.createElement('div');
    cardsContainer.classList.add('flex','flex-col','gap-2','p-2','min-h-[100px]','overflow-y-auto');
    cardsContainer.id=`${sub.columnId}-${sub.subId}`; subDiv.appendChild(cardsContainer);

    const addCardBtn=document.createElement('button'); addCardBtn.textContent='Добавить';
    addCardBtn.classList.add('bg-green-500','text-white','text-sm','rounded','hover:bg-green-600','px-4','py-2','mx-auto','my-2','transition');
    addCardBtn.addEventListener('click',()=>openAddCardModal(sub.columnId,sub.subId));
    subDiv.appendChild(addCardBtn);

    new Sortable(cardsContainer,{group:'cards',animation:150,ghostClass:'opacity-50 bg-gray-300',onEnd:async(evt)=>{const id=evt.item.dataset.id;const newCol=evt.to.closest('[data-column]').dataset.column;const newSub=evt.to.closest('[data-sub]')?.dataset.sub;await moveCardInDB(id,newCol,newSub);}});
    container.appendChild(subDiv);
}

function createCardElement(card) {
    const cardDiv = document.createElement('div');
    cardDiv.classList.add('border','rounded','p-2','flex','flex-col','cursor-grab');
    cardDiv.dataset.type = card.type;
    cardDiv.dataset.id = card.id;
    if(card.type === 'locomotive') {
        cardDiv.classList.add('border-l-4','border-blue-500','bg-blue-50');
    } else {
        cardDiv.classList.add('border-l-4','border-orange-400','bg-orange-50');
    }

    const h4 = document.createElement('h4');
    h4.classList.add('text-sm','font-semibold','mb-1');
    h4.textContent = card.type === 'locomotive' ? `Тепловоз: ${card.name}` : `ФИО: ${card.name}`;
    cardDiv.appendChild(h4);

    if(card.type === 'locomotive') {
        const p = document.createElement('p');
        p.innerHTML = `<strong>Код:</strong> ${card.code}`;
        cardDiv.appendChild(p);
    } else {
        const p1 = document.createElement('p');
        p1.innerHTML = `<strong>Позиция:</strong> ${card.position}`;
        const p2 = document.createElement('p');
        p2.innerHTML = `<strong>Код:</strong> ${card.code}`;
        cardDiv.append(p1, p2);
    }

    const actions = document.createElement('div');
    actions.classList.add('flex','gap-2','mt-2','justify-end');

    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️';
    editBtn.classList.add('edit-btn','bg-yellow-400','text-black','text-xs','px-2','py-1','rounded','hover:bg-yellow-500','transition');
    editBtn.addEventListener('click', async () => {
        await openEditCardModal(cardDiv);
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️';
    delBtn.classList.add('delete-btn','bg-red-500','text-white','text-xs','px-2','py-1','rounded','hover:bg-red-600','transition');
    delBtn.addEventListener('click', async () => {
        await deleteCardHandler(cardDiv);
    });

    actions.append(editBtn, delBtn);
    cardDiv.appendChild(actions);

    return cardDiv;
}

function delegateCardActions() {
    document.body.addEventListener('click',async e=>{
        if(e.target.textContent==='✏️') await openEdit(card=>{});
        if(e.target.textContent==='🗑️') await deleteCardHandler(e.target.closest('[data-id]'));
    });
}

async function openAddCardModal(columnId,subId) {
    const type=prompt('1-Тепловоз 2-Машинист','1');if(!type)return;
    if(type==='1') await createLocomotiveCard(columnId,subId);
    else if(type==='2') await createEngineerCard(columnId,subId);
}

async function createLocomotiveCard(columnId,subId) {
    const name=prompt('Название тепловоза:');if(!name)return;
    const code=prompt('Код тепловоза:');if(!code)return;
    const card={id:'loco-'+Date.now(),type:'locomotive',name,code,position:null,columnId,subId};
    await addCardToDB(card);
    document.getElementById(`${columnId}-${subId}`).appendChild(createCardElement(card));
}

async function createEngineerCard(columnId,subId) {
    const pos=prompt('Позиция:');if(!pos)return;
    const name=prompt('ФИО:');if(!name)return;
    const code=prompt('Код:');if(!code)return;
    const card={id:'eng-'+Date.now(),type:'engineer',name,code,position:pos,columnId,subId};
    await addCardToDB(card);
    document.getElementById(`${columnId}-${subId}`).appendChild(createCardElement(card));
}

async function openEdit2(card) {
    /* similar to old logic */
}

// =====================
// 4) Edit modal
// =====================
async function openEdit(cardId) {
    const tx = db.transaction('cards');
    tx.objectStore('cards').get(cardId).onsuccess = async e => {
        const card = e.target.result; if (!card) return;
        if (card.type === 'locomotive') {
            const nName = prompt('Новое название тепловоза:', card.name); if (!nName) return;
            const nCode = prompt('Новый код тепловоза:', card.code); if (!nCode) return;
            card.name = nName; card.code = nCode;
        } else {
            const nPos = prompt('Новая позиция:', card.position); if (!nPos) return;
            const nName = prompt('Новое ФИО:', card.name); if (!nName) return;
            const nCode = prompt('Новый код:', card.code); if (!nCode) return;
            card.position = nPos; card.name = nName; card.code = nCode;
        }
        await updateCardInDB(card);
        document.querySelector(`[data-id="${cardId}"]`).replaceWith(createCardElement(card));
    };
}

async function deleteCardHandler(cardElem) {
    const id=cardElem.dataset.id;
    if(!confirm('Удалить?'))return;
    await deleteCardFromDB(id);
    cardElem.remove();
}

async function renderAllCards() {
    const allCards = await getAllCards();
    allCards.forEach(card => {
        const container = document.getElementById(`${card.columnId}-${card.subId}`);
        if (!container) return;
        container.appendChild(createCardElement(card));
    });
}

// 3) Инициализация
// ====================
document.addEventListener('DOMContentLoaded',async()=>{
    await openDB();
    const columns=await getAllColumns();
    for(const c of columns) await renderColumn(c);
    await renderAllCards();
    delegateCardActions();
    document.getElementById('add-column-btn').addEventListener('click',async()=>{
        const title=prompt('Название новой колонки:');if(!title)return;
        const newCol=await addColumnToDB(title);
        await renderColumn(newCol);
    });
});