/* ============================================
   波妞记账 — 主应用逻辑
   ============================================ */

// ---- 全局状态 ----
const state = {
  currentTab: 'home',
  currentMonth: new Date(),
  selectedYear: new Date().getFullYear(),

  // 记账表单
  txnType: 'expense',
  txnAmount: 0,
  txnInput: '',
  txnCat1: '',
  txnCat2: '',
  txnDate: new Date().toISOString().split('T')[0],
  txnNote: '',
  txnAccountId: null,

  // 文本记账
  textInput: '',
  parsedResults: [],

  // 资产表单
  editingAccountId: null,
  accName: '',
  accType: 'cash',
  accBalance: 0,
  accNote: '',
  accCustomType: '',

  // 搜索
  searchText: '',
  searchType: null,
  searchCat1: null,
  searchStartDate: '',
  searchEndDate: '',
};

// ---- 初始化 ----
document.addEventListener('DOMContentLoaded', async () => {
  await db.ready;
  state.searchStartDate = new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0];
  state.searchEndDate = new Date().toISOString().split('T')[0];
  updateMonthTitle();
  switchTab('home');
  registerSW();
});

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ============================================================
//  TabBar 导航
// ============================================================
function switchTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));

  const page = document.getElementById(`page-${tab}`);
  if (page) page.classList.add('active');

  const tabEl = document.querySelector(`.tab-item[data-tab="${tab}"]`);
  if (tabEl) tabEl.classList.add('active');

  if (tab === 'home') renderHome();
  else if (tab === 'stats') renderStats();
  else if (tab === 'assets') renderAssets();
  else if (tab === 'profile') renderProfile();

  // 隐藏/显示 FAB
  const fab = document.getElementById('fab-add');
  if (fab) fab.style.display = tab === 'home' ? 'flex' : 'none';
}

// ============================================================
//  工具函数
// ============================================================
function fmt(n) { return (n || 0).toFixed(2); }
function fmtInt(n) { return Math.round(n || 0).toLocaleString(); }
function dateStr(d) { return d instanceof Date ? d.toISOString().split('T')[0] : d; }
function today() { return new Date().toISOString().split('T')[0]; }
function monthKey(d) { const dt = d instanceof Date ? d : new Date(d); return `${dt.getFullYear()}-${dt.getMonth()+1}`; }
function monthRange(date) {
  const y = date.getFullYear(), m = date.getMonth();
  return {
    start: `${y}-${String(m+1).padStart(2,'0')}-01`,
    end: `${y}-${String(m+1).padStart(2,'0')}-${new Date(y,m+1,0).getDate()}`,
  };
}
function yearRange(year) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}
function monthTitle(d) {
  return `${d.getFullYear()}年${d.getMonth()+1}月`;
}
function updateMonthTitle() {
  const el = document.getElementById('home-month-title');
  if (el) el.textContent = monthTitle(state.currentMonth);
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 1500);
}
function $(id) { return document.getElementById(id); }

// ============================================================
//  首页
// ============================================================
async function renderHome() {
  const { start, end } = monthRange(state.currentMonth);
  updateMonthTitle();

  const [income, expense, txns, accounts] = await Promise.all([
    db.getSum('income', start, end),
    db.getSum('expense', start, end),
    db.getTransactions({ startDate: start, endDate: end, limit: 10 }),
    db.getAccounts(),
  ]);

  // 净资产
  let assets = 0, liabilities = 0;
  accounts.forEach(a => {
    if (a.type === 'liability') liabilities += a.balance;
    else if (a.balance < 0) liabilities += Math.abs(a.balance);
    else assets += a.balance;
  });

  $('home-networth').textContent = '¥ ' + fmt(assets - liabilities);
  $('home-assets').textContent = '¥ ' + fmt(assets);
  $('home-liabilities').textContent = '¥ ' + fmt(liabilities);
  $('home-income').textContent = '¥ ' + fmt(income);
  $('home-expense').textContent = '¥ ' + fmt(expense);

  // 是否当月
  const isCurrent = monthKey(state.currentMonth) === monthKey(new Date());
  $('home-next-arrow').style.visibility = isCurrent ? 'hidden' : 'visible';

  // 最近交易
  renderTransactionList('home-txn-list', txns);

  // 空状态
  $('home-empty').classList.toggle('hidden', txns.length > 0);
  $('home-txn-list').classList.toggle('hidden', txns.length === 0);
}

function homePrevMonth() {
  state.currentMonth.setMonth(state.currentMonth.getMonth() - 1);
  renderHome();
}
function homeNextMonth() {
  if (monthKey(state.currentMonth) >= monthKey(new Date())) return;
  state.currentMonth.setMonth(state.currentMonth.getMonth() + 1);
  renderHome();
}

// ============================================================
//  交易列表渲染（复用组件）
// ============================================================
function renderTransactionList(containerId, txns) {
  const container = $(containerId);
  if (!container) return;
  container.innerHTML = txns.length === 0 ? '' : txns.map(t => {
    const isIncome = t.type === 'income';
    const icon = catManager.getIcon(t.category1);
    const prefix = isIncome ? '+' : '-';
    const cls = isIncome ? 'income' : 'expense';
    return `
      <div class="txn-item" onclick="showTxnDetail('${t.id}')">
        <div class="txn-icon ${cls}">${icon}</div>
        <div class="txn-info">
          <div class="txn-cat2">${escHtml(t.category2)}</div>
          ${t.note ? `<div class="txn-note">${escHtml(t.note)}</div>` : ''}
        </div>
        <div class="txn-amount">
          <div class="txn-amount-value ${cls}">${prefix}¥${fmt(t.amount)}</div>
          <div class="txn-date">${dateLabel(t.date)}</div>
        </div>
      </div>`;
  }).join('');
  // 添加分割线
  const items = container.querySelectorAll('.txn-item');
  items.forEach((item, i) => {
    if (i < items.length - 1) {
      const div = document.createElement('div');
      div.className = 'txn-divider';
      item.after(div);
    }
  });
}

function dateLabel(dateStr) {
  if (dateStr === today()) return '今天';
  const d = new Date(dateStr);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === yesterday.toISOString().split('T')[0]) return '昨天';
  return `${d.getMonth()+1}月${d.getDate()}日`;
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ============================================================
//  记账 — 手动模式
// ============================================================
function showAddTxn() {
  state.txnType = 'expense'; state.txnAmount = 0; state.txnInput = '';
  state.txnCat1 = ''; state.txnCat2 = ''; state.txnDate = today();
  state.txnNote = ''; state.txnAccountId = null; state.editingTxnId = null;
  updateSegmentUI();
  updateTxnForm();
  $('page-txn-form').classList.add('active');
  document.querySelector('.tab-bar').style.display = 'none';
  $('fab-add').style.display = 'none';
}

async function showEditTxn(id) {
  state.editingTxnId = id;
  const t = await db.getTransaction(id);
  if (!t) return;
  state.txnType = t.type;
  state.txnAmount = t.amount;
  state.txnInput = fmt(t.amount);
  state.txnCat1 = t.category1;
  state.txnCat2 = t.category2;
  state.txnDate = t.date;
  state.txnNote = t.note || '';
  state.txnAccountId = t.accountId || null;
  updateSegmentUI();
  updateTxnForm();
  $('page-txn-form').classList.add('active');
  document.querySelector('.tab-bar').style.display = 'none';
  $('fab-add').style.display = 'none';
}

function closeTxnForm() {
  $('page-txn-form').classList.remove('active');
  document.querySelector('.tab-bar').style.display = 'flex';
  $('fab-add').style.display = 'flex';
  switchTab(state.currentTab);
}

async function saveTxn() {
  if (!state.txnAmount || !state.txnCat1 || !state.txnCat2) {
    showToast('请填写金额和分类'); return;
  }
  const txn = {
    id: state.editingTxnId || crypto.randomUUID(),
    type: state.txnType,
    amount: state.txnAmount,
    category1: state.txnCat1,
    category2: state.txnCat2,
    date: state.txnDate,
    note: state.txnNote || null,
    accountId: state.txnAccountId,
    createdAt: new Date().toISOString(),
  };
  if (state.editingTxnId) await db.updateTransaction(txn);
  else await db.addTransaction(txn);
  showToast(state.editingTxnId ? '修改成功 ✅' : '保存成功 ✅');
  closeTxnForm();
}

function switchTxnType(type) {
  state.txnType = type; state.txnCat1 = ''; state.txnCat2 = '';
  updateSegmentUI();
  updateTxnForm();
}

function updateSegmentUI() {
  document.querySelectorAll('#txn-segment .segment-btn').forEach(b => {
    const isActive = b.dataset.type === state.txnType;
    b.classList.toggle('active', isActive);
    b.classList.toggle('income', isActive && state.txnType === 'income');
    b.classList.toggle('expense', isActive && state.txnType === 'expense');
  });
}

function updateTxnForm() {
  $('txn-amount-display').textContent = '¥ ' + (state.txnInput || '0');
  $('txn-cat-display').textContent = state.txnCat1 ? `${state.txnCat1} > ${state.txnCat2}` : '选择分类';
  $('txn-date-display').textContent = formatDateCN(state.txnDate);
  $('txn-note-input').value = state.txnNote;
}

function formatDateCN(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日`;
}

// 数字键盘
function numKeyTap(key) {
  if (key === '⌫') { state.txnInput = state.txnInput.slice(0, -1); }
  else if (key === '.') {
    if (!state.txnInput) state.txnInput = '0.';
    else if (!state.txnInput.includes('.')) state.txnInput += '.';
  }
  else {
    if (state.txnInput === '0') state.txnInput = key;
    else state.txnInput += key;
  }
  state.txnAmount = parseFloat(state.txnInput) || 0;
  $('txn-amount-display').textContent = '¥ ' + (state.txnInput || '0');
}

// 分类选择器
function showCatPicker() {
  const cats = catManager.getCat1List(state.txnType);
  const html = cats.map(c => {
    const icon = catManager.getIcon(c);
    const subs = catManager.getCat2List(c, state.txnType);
    const sel = state.txnCat1 === c ? ' selected' : '';
    return `<button class="picker-item${sel}" data-cat1="${c}" onclick="selectCat1('${c}')">${icon} ${c}</button>`;
  }).join('');

  $('picker-col-1').innerHTML = html;
  if (state.txnCat1) renderPickerCol2(state.txnCat1);

  $('overlay-cat-picker').classList.remove('hidden');

  // 滚动到选中项
  setTimeout(() => {
    const sel = $('picker-col-1').querySelector('.selected');
    if (sel) sel.scrollIntoView({ block: 'center' });
  }, 100);
}

function selectCat1(cat1) {
  state.txnCat1 = cat1;
  const subs = catManager.getCat2List(cat1, state.txnType);
  if (subs.length === 0) {
    state.txnCat2 = cat1;
    closeCatPicker();
    updateTxnForm();
    return;
  }
  renderPickerCol2(cat1);

  // 高亮左侧选中
  $('picker-col-1').querySelectorAll('.picker-item').forEach(b => {
    b.classList.toggle('selected', b.dataset.cat1 === cat1);
  });
}

function renderPickerCol2(cat1) {
  const subs = catManager.getCat2List(cat1, state.txnType);
  const html = subs.map(s => {
    const sel = state.txnCat1 === cat1 && state.txnCat2 === s ? ' selected' : '';
    const check = (state.txnCat1 === cat1 && state.txnCat2 === s) ? '<span class="check">✓</span>' : '';
    return `<button class="picker-item${sel}" onclick="selectCat2('${cat1}','${s}')">${s}${check}</button>`;
  }).join('');
  $('picker-col-2').innerHTML = html;
}

function selectCat2(cat1, cat2) {
  state.txnCat1 = cat1; state.txnCat2 = cat2;
  closeCatPicker();
  updateTxnForm();
}

function closeCatPicker() {
  $('overlay-cat-picker').classList.add('hidden');
}

// 日期选择
function showDatePicker() {
  $('txn-date-input').value = state.txnDate;
  $('overlay-date-picker').classList.remove('hidden');
}
function confirmDate() {
  state.txnDate = $('txn-date-input').value;
  updateTxnForm();
  $('overlay-date-picker').classList.add('hidden');
}
function closeDatePicker() {
  $('overlay-date-picker').classList.add('hidden');
}

// 账户选择（简化版）
function showAccountPicker() {
  db.getAccounts().then(accounts => {
    const html = '<button class="picker-item" onclick="selectAccount(null)">不选择账户</button>' +
      accounts.map(a => `<button class="picker-item${state.txnAccountId===a.id?' selected':''}" onclick="selectAccount('${a.id}')">${a.name} · ¥${fmt(a.balance)}</button>`).join('');
    $('account-picker-body').innerHTML = html;
    $('overlay-account-picker').classList.remove('hidden');
  });
}
function selectAccount(id) {
  state.txnAccountId = id;
  $('overlay-account-picker').classList.add('hidden');
}
function closeAccountPicker() {
  $('overlay-account-picker').classList.add('hidden');
}

// ============================================================
//  文本记账
// ============================================================
function showTextTxn() {
  state.textInput = '';
  state.parsedResults = [];
  $('text-txn-input').value = '';
  $('text-txn-preview').classList.add('hidden');
  $('page-text-txn').classList.add('active');
  document.querySelector('.tab-bar').style.display = 'none';
  $('fab-add').style.display = 'none';
}
function closeTextTxn() {
  $('page-text-txn').classList.remove('active');
  document.querySelector('.tab-bar').style.display = 'flex';
  $('fab-add').style.display = 'flex';
  switchTab(state.currentTab);
}
function doParseText() {
  const text = $('text-txn-input').value.trim();
  if (!text) return;
  state.parsedResults = parser.parse(text);
  renderParsedPreview();
  $('text-txn-preview').classList.toggle('hidden', state.parsedResults.length === 0);
}
function renderParsedPreview() {
  const list = $('parsed-txn-list');
  let html = '';
  state.parsedResults.forEach(p => {
    const icon = catManager.getIcon(p.category1);
    const isIncome = p.type === 'income';
    const prefix = isIncome ? '+' : '-';
    const cls = isIncome ? 'income' : 'expense';
    html += `
      <div class="txn-item" style="cursor:default">
        <div class="txn-icon ${cls}">${icon}</div>
        <div class="txn-info">
          <div class="txn-cat2">${p.category2}</div>
          <div class="txn-note">${p.category1} > ${p.category2}</div>
        </div>
        <div class="txn-amount">
          <div class="txn-amount-value ${cls}">${prefix}¥${fmt(p.amount)}</div>
        </div>
      </div>`;
  });
  const total = state.parsedResults.length;
  list.innerHTML = html;
  $('parsed-count').textContent = `共 ${total} 笔，确认保存？`;
}
async function saveParsedTxns() {
  if (state.parsedResults.length === 0) return;
  await db.addTransactions(state.parsedResults.map(p => ({
    type: p.type, amount: p.amount, category1: p.category1,
    category2: p.category2, date: p.date, note: p.note,
    accountId: state.txnAccountId,
  })));
  showToast(`已保存 ${state.parsedResults.length} 笔记录 ✅`);
  closeTextTxn();
}

// ============================================================
//  交易详情
// ============================================================
async function showTxnDetail(id) {
  const t = await db.getTransaction(id);
  if (!t) return;
  const isIncome = t.type === 'income';
  const prefix = isIncome ? '+' : '-';
  const cls = isIncome ? 'income' : 'expense';
  const icon = catManager.getIcon(t.category1);

  $('detail-amount').textContent = `${prefix}¥${fmt(t.amount)}`;
  $('detail-amount').className = `detail-amount ${cls}`;
  $('detail-cat').textContent = `${t.category1} > ${t.category2}`;
  $('detail-type').textContent = isIncome ? '收入' : '支出';
  $('detail-date').textContent = formatDateCN(t.date);
  $('detail-note').textContent = t.note || '无';
  $('detail-note-row').style.display = t.note ? '' : 'none';

  $('page-txn-detail').classList.add('active');
  document.querySelector('.tab-bar').style.display = 'none';
  $('fab-add').style.display = 'none';

  $('detail-id').dataset.id = id;
}
function closeTxnDetail() {
  $('page-txn-detail').classList.remove('active');
  document.querySelector('.tab-bar').style.display = 'flex';
  $('fab-add').style.display = 'flex';
  switchTab(state.currentTab);
}
async function deleteTxnDetail() {
  const id = $('detail-id').dataset.id;
  if (!id || !confirm('确认删除这条记录？')) return;
  await db.deleteTransaction(id);
  showToast('已删除');
  closeTxnDetail();
}
function editTxnDetail() {
  const id = $('detail-id').dataset.id;
  closeTxnDetail();
  showEditTxn(id);
}

// ============================================================
//  统计页
// ============================================================
async function renderStats() {
  await renderStatsOverview();
}

async function renderStatsOverview() {
  $('stats-year-title').textContent = `${state.selectedYear} 年`;

  const { start, end } = yearRange(state.selectedYear);
  const [yearIncome, yearExpense] = await Promise.all([
    db.getSum('income', start, end),
    db.getSum('expense', start, end),
  ]);
  const balance = yearIncome - yearExpense;

  $('stats-year-income').textContent = '¥ ' + fmtInt(yearIncome);
  $('stats-year-expense').textContent = '¥ ' + fmtInt(yearExpense);
  $('stats-year-balance').textContent = (balance >= 0 ? '+' : '') + '¥ ' + fmtInt(balance);

  // 月度数据
  const monthlyData = [];
  for (let m = 1; m <= 12; m++) {
    const ms = `${state.selectedYear}-${String(m).padStart(2,'0')}-01`;
    const me = `${state.selectedYear}-${String(m).padStart(2,'0')}-${new Date(state.selectedYear,m,0).getDate()}`;
    const [inc, exp] = await Promise.all([db.getSum('income', ms, me), db.getSum('expense', ms, me)]);
    monthlyData.push({ month: m, income: inc, expense: exp });
  }

  // 渲染月度柱状图
  chartRenderer.renderMonthlyBar('chart-monthly', monthlyData);

  // 渲染月度汇总列表
  const activeMonths = monthlyData.filter(m => m.income > 0 || m.expense > 0);
  let listHtml = '';
  activeMonths.forEach(m => {
    listHtml += `<div class="txn-item" onclick="showMonthDetail(${m.month})" style="border-bottom:.5px solid var(--divider)">
      <span style="font-weight:500;width:36px">${m.month}月</span>
      <div style="flex:1;text-align:right;font-size:13px">
        ${m.income > 0 ? `<span style="color:var(--income-green)">收 ¥${fmtInt(m.income)}</span>` : ''}
        ${m.expense > 0 ? `<span style="color:var(--expense-red);margin-left:8px">支 ¥${fmtInt(m.expense)}</span>` : ''}
      </div>
      <span style="color:#ccc;font-size:11px">›</span>
    </div>`;
  });
  $('stats-monthly-list').innerHTML = listHtml || '<div class="empty-state"><div class="empty-state-text">暂无数据</div></div>';

  // 支出分类
  const expenseCats = await getCatBreakdown('expense', start, end);
  renderCatList('stats-expense-list', expenseCats, 'expense', yearExpense);
  chartRenderer.renderPie('chart-expense-pie', expenseCats.map(c => ({ name: c.name, amount: c.amount })));

  // 收入分类
  const incomeCats = await getCatBreakdown('income', start, end);
  renderCatList('stats-income-list', incomeCats, 'income', yearIncome);
  chartRenderer.renderPie('chart-income-pie', incomeCats.map(c => ({ name: c.name, amount: c.amount })));

  $('stats-next-year').style.visibility = state.selectedYear >= new Date().getFullYear() ? 'hidden' : 'visible';
}

function switchStatsTab(tab) {
  document.querySelectorAll('#stats-tab-bar .segment-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('stats-overview').classList.toggle('hidden', tab !== 'overview');
  $('stats-expense').classList.toggle('hidden', tab !== 'expense');
  $('stats-income').classList.toggle('hidden', tab !== 'income');
}

function statsPrevYear() { state.selectedYear--; renderStats(); }
function statsNextYear() {
  if (state.selectedYear >= new Date().getFullYear()) return;
  state.selectedYear++;
  renderStats();
}

async function getCatBreakdown(type, start, end) {
  const txns = await db.getTransactions({ type, startDate: start, endDate: end });
  const map = {};
  txns.forEach(t => { map[t.category1] = (map[t.category1] || 0) + t.amount; });
  return Object.entries(map).map(([name, amount]) => ({
    name, amount, icon: catManager.getIcon(name),
  })).sort((a, b) => b.amount - a.amount);
}

function renderCatList(containerId, data, type, total) {
  const el = $(containerId);
  if (!el) return;
  el.innerHTML = data.map((c, i) => `
    <div class="txn-item" onclick="showCatDetail('${c.name}','${type}')">
      <span style="width:22px;height:22px;border-radius:50%;background:${i<3?'var(--primary)':'#ccc'};color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span>
      <span style="font-size:15px;margin-left:8px">${c.icon} ${c.name}</span>
      <div style="flex:1;text-align:right">
        <div style="font-size:14px;font-weight:500">¥${fmt(c.amount)}</div>
        <div style="font-size:11px;color:var(--text-secondary)">${total>0?(c.amount/total*100).toFixed(1):0}%</div>
      </div>
      <span style="color:#ccc;font-size:11px">›</span>
    </div>`).join('') || '<div class="empty-state"><div class="empty-state-text">暂无数据</div></div>';
}

// 分类钻取
async function showCatDetail(cat1, type) {
  const { start, end } = yearRange(state.selectedYear);
  const txns = await db.getTransactions({ type, category1: cat1, startDate: start, endDate: end });

  const cat2Map = {};
  txns.forEach(t => { cat2Map[t.category2] = (cat2Map[t.category2] || 0) + t.amount; });
  const cat2List = Object.entries(cat2Map).map(([k,v]) => ({ name: k, amount: v })).sort((a,b) => b.amount - a.amount);

  const total = cat2List.reduce((s, c) => s + c.amount, 0);

  let cat2Html = cat2List.map((c, i) => `
    <div class="txn-item" style="cursor:default">
      <span style="width:20px;height:20px;border-radius:50%;background:${i<3?'var(--primary)':'#ccc'};color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span>
      <span style="font-size:14px;margin-left:8px">${c.name}</span>
      <div style="flex:1;text-align:right">
        <div style="font-size:14px;font-weight:500">¥${fmt(c.amount)}</div>
        <div style="font-size:11px;color:var(--text-secondary)">${total>0?(c.amount/total*100).toFixed(1):0}%</div>
      </div>
    </div>`).join('') || '<div class="empty-state"><div class="empty-state-text">暂无数据</div></div>';

  // 月度分布
  const monthlyData = [];
  for (let m = 1; m <= 12; m++) {
    const ms = `${state.selectedYear}-${String(m).padStart(2,'0')}-01`;
    const me = `${state.selectedYear}-${String(m).padStart(2,'0')}-${new Date(state.selectedYear,m,0).getDate()}`;
    const amt = txns.filter(t => t.date >= ms && t.date <= me).reduce((s,t) => s + t.amount, 0);
    monthlyData.push({ month: m, amount: amt });
  }

  let monthlyHtml = monthlyData.filter(m => m.amount > 0).map(m => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:.5px solid var(--divider);font-size:14px">
      <span>${m.month}月</span>
      <span style="font-weight:500">¥${fmt(m.amount)}</span>
    </div>`).join('') || '<div style="color:var(--text-secondary);font-size:13px">暂无数据</div>';

  const html = `
    <div class="page active" id="page-cat-detail">
      <div class="nav-header">
        <button class="nav-icon" onclick="closeCatDetail()">‹</button>
        <div class="nav-title">${catManager.getIcon(cat1)} ${cat1}</div>
        <div style="width:36px"></div>
      </div>
      <div class="card-lg text-center"><div style="font-size:13px;color:var(--text-secondary)">${state.selectedYear}年 总计</div>
        <div style="font-size:30px;font-weight:800;color:${type==='income'?'var(--income-green)':'var(--expense-red)'}">¥${fmt(total)}</div>
      </div>
      <div class="section-title">二级科目明细</div>
      <div class="txn-list">${cat2Html}</div>
      <div class="chart-container mt-16"><div class="chart-title">月度趋势</div>
        <canvas id="chart-cat-monthly" style="height:180px"></canvas>
        <div style="margin-top:12px">${monthlyHtml}</div>
      </div>
    </div>`;

  // 替换当前页面
  const old = document.querySelector('.page.active');
  if (old) old.classList.remove('active');
  const container = document.createElement('div');
  container.innerHTML = html;
  document.getElementById('app').appendChild(container.firstElementChild);

  // 渲染图表
  setTimeout(() => {
    chartRenderer.renderMonthlyBar('chart-cat-monthly', monthlyData.map(m => ({
      month: m.month, income: type === 'income' ? m.amount : 0, expense: type === 'expense' ? m.amount : 0,
    })));
  }, 100);
}

function closeCatDetail() {
  const el = document.getElementById('page-cat-detail');
  if (el) el.remove();
  switchTab('stats');
}

// 月度详情
async function showMonthDetail(month) {
  const ms = `${state.selectedYear}-${String(month).padStart(2,'0')}-01`;
  const me = `${state.selectedYear}-${String(month).padStart(2,'0')}-${new Date(state.selectedYear,month,0).getDate()}`;
  const txns = await db.getTransactions({ startDate: ms, endDate: me });
  const income = txns.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
  const expense = txns.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
  const balance = income - expense;

  const html = `
    <div class="page active" id="page-month-detail">
      <div class="nav-header">
        <button class="nav-icon" onclick="closeMonthDetail()">‹</button>
        <div class="nav-title">${state.selectedYear}年${month}月</div>
        <div style="width:36px"></div>
      </div>
      <div class="dual-cards mt-8">
        <div class="dual-card"><div class="dual-card-label">收入</div><div class="dual-card-amount income">¥${fmt(income)}</div></div>
        <div class="dual-card"><div class="dual-card-label">支出</div><div class="dual-card-amount expense">¥${fmt(expense)}</div></div>
        <div class="dual-card"><div class="dual-card-label">结余</div><div class="dual-card-amount" style="color:${balance>=0?'var(--primary)':'var(--expense-red)'}">¥${fmt(balance)}</div></div>
      </div>
      <div class="section-title mt-16">交易记录</div>
      <div class="txn-list" id="month-detail-list"></div>
    </div>`;

  const old = document.querySelector('.page.active');
  if (old) old.classList.remove('active');
  const container = document.createElement('div');
  container.innerHTML = html;
  document.getElementById('app').appendChild(container.firstElementChild);
  renderTransactionList('month-detail-list', txns);
}

function closeMonthDetail() {
  const el = document.getElementById('page-month-detail');
  if (el) el.remove();
  switchTab('stats');
}

// ============================================================
//  资产管家
// ============================================================
async function renderAssets() {
  const accounts = await db.getAccounts();
  let totalAssets = 0, totalLiabilities = 0;
  accounts.forEach(a => {
    if (a.type === 'liability') totalLiabilities += a.balance;
    else if (a.balance < 0) totalLiabilities += Math.abs(a.balance);
    else totalAssets += a.balance;
  });

  $('asset-total-assets').textContent = '¥ ' + fmt(totalAssets);
  $('asset-total-liabilities').textContent = '¥ ' + fmt(totalLiabilities);
  $('asset-networth').textContent = '¥ ' + fmt(totalAssets - totalLiabilities);

  const types = ['cash','savingsCard','creditCard','virtualAccount','liability','custom'];
  const typeNames = { cash:'💵 现金', savingsCard:'🏦 储蓄卡', creditCard:'💳 信用卡', virtualAccount:'📱 虚拟账户', liability:'📉 负债', custom:'✨ 自定义资产' };

  let html = '';
  types.forEach(t => {
    const list = accounts.filter(a => a.type === t);
    if (list.length === 0) return;
    const total = list.reduce((s,a) => s + a.balance, 0);
    html += `
      <div class="asset-section">
        <div class="asset-section-header" onclick="toggleAssetSection(this)">
          <span class="icon" style="font-size:18px">${typeNames[t].split(' ')[0]}</span>
          <span class="title">${typeNames[t].split(' ').slice(1).join(' ')}</span>
          <span class="count">(${list.length})</span>
          <span class="total">¥${fmt(total)}</span>
          <span class="arrow">›</span>
        </div>
        <div class="asset-items hidden">
          ${list.map(a => `
            <div class="asset-item" onclick="showAssetDetail('${a.id}')">
              <div class="asset-item-name">${escHtml(a.name)}</div>
              <div class="asset-item-balance ${a.balance<0?'negative':''}">¥${fmt(a.balance)}</div>
            </div>`).join('')}
        </div>
      </div>`;
  });
  $('asset-sections').innerHTML = html || '<div class="empty-state mt-16"><div class="empty-state-text">还没有账户，点击右上角 + 添加</div></div>';
}

function toggleAssetSection(header) {
  const items = header.nextElementSibling;
  const arrow = header.querySelector('.arrow');
  items.classList.toggle('hidden');
  arrow.classList.toggle('open');
}

// 添加/编辑账户
function showAddAccount(id) {
  if (id) {
    db.getAccounts().then(accounts => {
      const a = accounts.find(x => x.id === id);
      if (!a) return;
      state.editingAccountId = id;
      state.accName = a.name; state.accType = a.type; state.accBalance = a.balance;
      state.accNote = a.note || ''; state.accCustomType = a.customTypeName || '';
      renderAccountForm();
      $('page-add-account').classList.add('active');
      document.querySelector('.tab-bar').style.display = 'none';
    });
  } else {
    state.editingAccountId = null;
    state.accName = ''; state.accType = 'cash'; state.accBalance = 0;
    state.accNote = ''; state.accCustomType = '';
    renderAccountForm();
    $('page-add-account').classList.add('active');
    document.querySelector('.tab-bar').style.display = 'none';
  }
}

function closeAddAccount() {
  $('page-add-account').classList.remove('active');
  document.querySelector('.tab-bar').style.display = 'flex';
  switchTab('assets');
}

function renderAccountForm() {
  const types = ['cash','savingsCard','creditCard','virtualAccount','liability','custom'];
  const names = ['💵 现金','🏦 储蓄卡','💳 信用卡','📱 虚拟账户','📉 负债','✨ 自定义'];
  $('acc-type-grid').innerHTML = types.map((t,i) => `
    <div class="type-card ${state.accType===t?'selected':''}" onclick="state.accType='${t}';renderAccountForm()">
      <div class="type-card-icon">${names[i].split(' ')[0]}</div>
      <div class="type-card-name">${names[i].split(' ').slice(1).join(' ')}</div>
    </div>`).join('');

  $('acc-name-input').value = state.accName;
  $('acc-balance-input').value = state.accBalance || '';
  $('acc-note-input').value = state.accNote;
  $('acc-custom-type').style.display = state.accType === 'custom' ? '' : 'none';
  $('acc-custom-type-input').value = state.accCustomType;
  $('acc-delete-btn').style.display = state.editingAccountId ? '' : 'none';
  $('acc-save-btn').textContent = state.editingAccountId ? '保存修改' : '添加账户';
}

async function saveAccount() {
  const name = $('acc-name-input').value.trim();
  if (!name) { showToast('请输入账户名称'); return; }
  const balance = parseFloat($('acc-balance-input').value) || 0;
  const note = $('acc-note-input').value.trim();
  const customType = $('acc-custom-type-input').value.trim();

  const acc = {
    id: state.editingAccountId || crypto.randomUUID(),
    name, type: state.accType, balance, note: note || null,
    customTypeName: state.accType === 'custom' ? (customType || null) : null,
    createdAt: new Date().toISOString(), sortOrder: 999,
  };
  if (state.editingAccountId) await db.updateAccount(acc);
  else await db.addAccount(acc);
  showToast(state.editingAccountId ? '修改成功 ✅' : '添加成功 ✅');
  closeAddAccount();
}

async function deleteAccountFromForm() {
  if (!state.editingAccountId || !confirm('确认删除此账户？')) return;
  await db.deleteAccount(state.editingAccountId);
  showToast('已删除');
  closeAddAccount();
}

// 资产详情
async function showAssetDetail(id) {
  const accounts = await db.getAccounts();
  const a = accounts.find(x => x.id === id);
  if (!a) return;
  const txns = await db.getTransactions({ accountId: id });

  const html = `
    <div class="page active" id="page-asset-detail">
      <div class="nav-header">
        <button class="nav-icon" onclick="closeAssetDetail()">‹</button>
        <div class="nav-title">${escHtml(a.name)}</div>
        <button class="nav-icon" onclick="closeAssetDetail();showAddAccount('${a.id}')">✎</button>
      </div>
      <div class="card-lg text-center">
        <div style="font-size:13px;color:var(--text-secondary)">当前余额</div>
        <div style="font-size:32px;font-weight:800;color:${a.balance<0?'var(--expense-red)':'var(--text)'}">¥${fmt(a.balance)}</div>
        ${a.note ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:4px">${escHtml(a.note)}</div>` : ''}
      </div>
      <div class="section-title mt-16">关联交易记录</div>
      <div class="txn-list" id="asset-txn-list"></div>
    </div>`;

  const old = document.querySelector('.page.active');
  if (old) old.classList.remove('active');
  const container = document.createElement('div');
  container.innerHTML = html;
  document.getElementById('app').appendChild(container.firstElementChild);
  renderTransactionList('asset-txn-list', txns);
}

function closeAssetDetail() {
  const el = document.getElementById('page-asset-detail');
  if (el) el.remove();
  switchTab('assets');
}

// ============================================================
//  搜索页
// ============================================================
function showSearch() {
  $('page-search').classList.add('active');
  document.querySelector('.tab-bar').style.display = 'none';
  $('fab-add').style.display = 'none';
  state.searchText = ''; state.searchType = null; state.searchCat1 = null;
  $('search-input').value = '';
  updateSearchFilters();
  doSearch();
}
function closeSearch() {
  $('page-search').classList.remove('active');
  document.querySelector('.tab-bar').style.display = 'flex';
  $('fab-add').style.display = 'flex';
  switchTab(state.currentTab);
}
function updateSearchFilters() {
  $('search-filter-type-all').classList.toggle('active', !state.searchType);
  $('search-filter-type-expense').classList.toggle('active', state.searchType === 'expense');
  $('search-filter-type-income').classList.toggle('active', state.searchType === 'income');
}
function setSearchType(type) { state.searchType = type; updateSearchFilters(); doSearch(); }
async function doSearch() {
  const text = $('search-input').value.trim();
  const txns = await db.getTransactions({
    type: state.searchType,
    category1: state.searchCat1,
    startDate: state.searchStartDate,
    endDate: state.searchEndDate,
    searchText: text || undefined,
    limit: 100,
  });
  renderTransactionList('search-txn-list', txns);
  $('search-empty').classList.toggle('hidden', txns.length > 0);
  $('search-txn-list').classList.toggle('hidden', txns.length === 0);
}

// ============================================================
//  个人中心
// ============================================================
function renderProfile() {
  // nothing dynamic needed on load
}

// CSV 导入
function triggerCSVImport() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.csv';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const result = await csvHandler.importCSV(text);
    alert(`导入结果\n总行数: ${result.total}\n成功: ${result.imported} 条\n跳过: ${result.skipped} 条\n${result.errors.length ? '\n错误:\n' + result.errors.slice(0,5).join('\n') : ''}`);
    if (result.imported > 0) { switchTab('home'); }
  };
  input.click();
}

// CSV 导出
async function triggerCSVExport() {
  const csv = await csvHandler.exportAll();
  csvHandler.downloadCSV(csv, `波妞记账_${today()}.csv`);
  showToast('导出成功 ✅');
}

// 分类管理
function showCatManagement() {
  const expenseCats = catManager.getCat1List('expense');
  const incomeCats = catManager.getCat1List('income');

  let html = '<div class="section-title">支出分类</div>';
  expenseCats.forEach(c => {
    const subs = catManager.getCat2List(c, 'expense');
    html += `<div class="txn-item" style="cursor:default"><span style="font-size:15px">${catManager.getIcon(c)} ${c}</span><span style="color:var(--text-secondary);font-size:13px">${subs.join('、')}</span></div>`;
  });
  html += '<div class="section-title mt-16">收入分类</div>';
  incomeCats.forEach(c => {
    const subs = catManager.getCat2List(c, 'income');
    html += `<div class="txn-item" style="cursor:default"><span style="font-size:15px">${catManager.getIcon(c)} ${c}</span><span style="color:var(--text-secondary);font-size:13px">${subs.join('、')}</span></div>`;
  });

  $('cat-management-body').innerHTML = html;
  $('page-cat-management').classList.add('active');
  document.querySelector('.tab-bar').style.display = 'none';
}
function closeCatManagement() {
  $('page-cat-management').classList.remove('active');
  document.querySelector('.tab-bar').style.display = 'flex';
  switchTab('profile');
}
