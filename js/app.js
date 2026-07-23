/* ============================================
   波妞记账 v3 — 三步记账流 + 深绿主题
   ============================================ */

const state = {
  currentTab: 'transactions', currentMonth: new Date(),
  // 记账 Sheet
  sheetType: 'expense', sheetCat1: '', sheetTag: '', sheetAmount: 0, sheetInput: '',
  sheetDate: '', editingTxnId: null,
  // 图表
  statsType: 'expense', statsPeriod: 'month', statsDate: new Date(),
  // 搜索
  searchText: '', searchType: null,
  searchStartDate: new Date(new Date().setMonth(new Date().getMonth()-3)).toISOString().split('T')[0],
  searchEndDate: new Date().toISOString().split('T')[0],
  // 资产
  editingAccountId: null, accName: '', accType: 'cash', accBalance: 0, accNote: '', accCustomType: '',
  catMgmtType: 'expense',
  // 日历
  calYear: new Date().getFullYear(), calMonth: new Date().getMonth()+1,
  calSelected: new Date().toISOString().split('T')[0],
  // 账单汇总
  billYear: new Date().getFullYear(), billTab: 'monthly',
  // 编辑
  editNoteId: null, editAmountId: null, editAmountInput: '', editAmountVal: 0,
  editAmountDate: '', wheelYear: 2026, wheelMonth: 7, wheelDay: 22,
};

// ---- 工具 ----
function fmt(n) { return (n||0).toFixed(2); }
function fmtInt(n) { return Math.round(n||0).toLocaleString(); }
function today() { return new Date().toISOString().split('T')[0]; }
function monthKey(d) { return `${d.getFullYear()}-${d.getMonth()+1}`; }
function monthRange(d) { const y=d.getFullYear(),m=d.getMonth(); return {start:`${y}-${String(m+1).padStart(2,'0')}-01`,end:`${y}-${String(m+1).padStart(2,'0')}-${new Date(y,m+1,0).getDate()}`}; }
function showToast(msg) { const t=$('toast');t.textContent=msg;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),1500); }
function $(id) { return document.getElementById(id); }
function esc(s) { const d=document.createElement('div');d.textContent=s;return d.innerHTML; }
function dl(ds) { if(ds===today())return'今天'; const y=new Date();y.setDate(y.getDate()-1); if(ds===y.toISOString().split('T')[0])return'昨天'; const d=new Date(ds);return`${d.getMonth()+1}月${d.getDate()}日`; }
const WDAY=['周日','周一','周二','周三','周四','周五','周六'];
function wd(ds){return WDAY[new Date(ds).getDay()];}
function fmtCN(d){const dt=new Date(d);return`${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日`;}

// ---- 初始化 ----
document.addEventListener('DOMContentLoaded',async()=>{
  await db.ready;
  state.sheetDate=today();
  updateMonthTitle();
  switchTab('transactions');
  if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
});

// ============================================================
//  TabBar
// ============================================================
function switchTab(tab) {
  if(tab==='add'){openSheet();return;}
  state.currentTab=tab;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-item').forEach(t=>t.classList.remove('active'));
  const p=$(`page-${tab}`); if(p)p.classList.add('active');
  const tb=document.querySelector(`.tab-item[data-tab="${tab}"]`); if(tb)tb.classList.add('active');
  if(tab==='transactions')renderHome();
  else if(tab==='stats')renderStats();
  else if(tab==='assets')renderAssets();
}

// ============================================================
//  FAB → 打开底部 Sheet（两步流程）
// ============================================================
function openSheet() {
  state.sheetType='expense'; state.sheetCat1=''; state.sheetTag=''; state.sheetAmount=0; state.sheetInput='';
  state.sheetDate=today(); state.editingTxnId=null;
  $('step2-note').value='';
  updateSheetSegment();
  renderSheetCatGrid();
  updateSheetOtherTotal();
  $('sheet-step1').classList.add('active'); $('sheet-step2').classList.remove('active');
  $('sheet-overlay').classList.remove('hidden');
}
function closeSheet() { $('sheet-overlay').classList.add('hidden'); }

function sheetSwitchType(type) {
  state.sheetType=type; state.sheetCat1='';
  updateSheetSegment();
  renderSheetCatGrid();
  updateSheetOtherTotal();
}
function updateSheetSegment() {
  document.querySelectorAll('#sheet-segment button').forEach(b=>{
    const act=b.dataset.type===state.sheetType;
    b.classList.toggle('active',act);
    b.classList.toggle('income',act&&state.sheetType==='income');
  });
}
function renderSheetCatGrid() {
  const cats=catManager.getCat1List(state.sheetType);
  $('sheet-cat-grid').innerHTML=cats.map(c=>`<button class="cat-grid-item" onclick="sheetSelectCat('${c}')"><div class="cat-grid-emoji">${catManager.getIcon(c)}</div><div class="cat-grid-name">${c}</div></button>`).join('');
}
async function updateSheetOtherTotal() {
  const {start,end}=monthRange(new Date());
  const sum=await db.getSum(state.sheetType,start,end);
  $('sheet-other-total').textContent=`本月${state.sheetType==='expense'?'支出':'收入'}总计：¥${fmt(sum)}`;
}

// ---- 第二步：金额 + 备注 + 标签 + 数字键盘 ----
async function sheetSelectCat(cat1) {
  state.sheetCat1=cat1; state.sheetInput=''; state.sheetAmount=0; state.sheetTag='';
  $('step2-note').value='';
  $('sheet-step1').classList.remove('active');
  $('sheet-step2').classList.add('active');
  $('step2-cat-label').textContent=catManager.getIcon(cat1)+' '+cat1;
  $('step2-amount').innerHTML='¥<span class="currency">0.00</span>';
  await renderStep2Tags();
}
function sheetBackToStep1() {
  $('sheet-step2').classList.remove('active');
  $('sheet-step1').classList.add('active');
  updateSheetOtherTotal();
}

// 自定义数字键盘（禁止系统键盘）
function nk(key) {
  if(key==='⌫') { state.sheetInput=state.sheetInput.slice(0,-1); }
  else if(key==='.') {
    if(!state.sheetInput) state.sheetInput='0.';
    else if(!state.sheetInput.includes('.')) state.sheetInput+='.';
  }
  else {
    if(state.sheetInput==='0'&&key!=='0') state.sheetInput=key;
    else if(state.sheetInput==='0'&&key==='0') {}
    else state.sheetInput+=key;
  }
  state.sheetAmount=parseFloat(state.sheetInput)||0;
  $('step2-amount').innerHTML='¥<span class="currency">'+(state.sheetInput||'0.00')+'</span>';
}

// ---- 标签区 ----
async function renderStep2Tags() {
  const tags=await catManager.getAllCat2List(state.sheetCat1, state.sheetType);
  let html='';
  tags.forEach(t=>{ html+=`<button class="tag-chip-inline" onclick="pickTag('${t}')">#${t}</button>`; });
  html+=`<button class="tag-add-inline" onclick="addTagInline()">+</button>`;
  $('step2-tags').innerHTML=html;
}

function pickTag(tag) {
  state.sheetTag=tag;
  $('step2-note').value='#'+tag;
  renderStep2Tags();
}

async function addTagInline() {
  const name=prompt('输入新标签名称');
  if(!name||!name.trim()) return;
  await catManager.addCat2(state.sheetCat1, name.trim(), state.sheetType);
  state.sheetTag=name.trim();
  $('step2-note').value='#'+name.trim();
  renderStep2Tags();
  refreshTagMgrIfOpen();
}

// 备注输入
function onNoteFocus() {}
function onNoteInput() {
  const v=$('step2-note').value;
  if(v.startsWith('#')) {
    const tag=v.slice(1).split(' ')[0];
    if(tag) state.sheetTag=tag;
  }
}

// ---- 标签管理弹窗 ----
async function openTagManager() {
  $('overlay-tag-mgr').classList.remove('hidden');
  $('tag-mgr-cat-name').textContent=catManager.getIcon(state.sheetCat1)+' '+state.sheetCat1;
  await refreshTagMgr();
}
function closeTagManager() { $('overlay-tag-mgr').classList.add('hidden'); }
async function refreshTagMgr() {
  const tags=await catManager.getAllCat2List(state.sheetCat1, state.sheetType);
  $('tag-mgr-list').innerHTML=tags.length?tags.map(t=>`<div class="tag-mgr-item"><span>🏷️ ${t}</span><button onclick="deleteTagMgr('${t}')">删除</button></div>`).join(''):'<div style="font-size:13px;color:var(--text-secondary);padding:12px 0">暂无标签</div>';
}
async function refreshTagMgrIfOpen() {
  if(!$('overlay-tag-mgr').classList.contains('hidden')) await refreshTagMgr();
}
async function deleteTagMgr(tag) {
  const cats=await catManager.getCustomCategories(state.sheetType);
  const found=cats.find(c=>c.parentName===state.sheetCat1&&c.name===tag);
  if(found) await catManager.deleteCat(found.id);
  if(state.sheetTag===tag) { state.sheetTag=''; $('step2-note').value=''; }
  refreshTagMgr(); renderStep2Tags();
}
async function addTagFromMgr() {
  const v=$('tag-mgr-input').value.trim(); if(!v) return;
  await catManager.addCat2(state.sheetCat1, v, state.sheetType);
  $('tag-mgr-input').value='';
  refreshTagMgr(); renderStep2Tags();
}

// ---- 保存（标签和备注空格分离）----
async function sheetComplete() {
  if(!state.sheetAmount) return;
  const noteRaw=$('step2-note').value.trim();
  // 解析 #标签 备注内容
  let tag=state.sheetTag||null, note=noteRaw||null;
  if(noteRaw&&noteRaw.startsWith('#')){
    const spaceIdx=noteRaw.indexOf(' ');
    if(spaceIdx>1){
      tag=noteRaw.slice(1,spaceIdx);
      note=noteRaw.slice(spaceIdx+1).trim()||null;
    } else {
      tag=noteRaw.slice(1)||null;
      note=null;
    }
  }
  const txn={
    id: state.editingTxnId||crypto.randomUUID(),
    type: state.sheetType, amount: state.sheetAmount,
    category1: state.sheetCat1,
    category2: tag||'无标签',
    tag: tag||null,
    date: state.sheetDate,
    note: note||null,
    createdAt: new Date().toISOString(),
  };
  if(state.editingTxnId) await db.updateTransaction(txn);
  else await db.addTransaction(txn);
  showToast('保存成功');
  closeSheet();
  switchTab('transactions');
}

// ============================================================
//  首页 — 按天分组
// ============================================================
async function renderHome() {
  const {start,end}=monthRange(state.currentMonth);
  updateMonthTitle();
  const y=state.currentMonth.getFullYear(), m=state.currentMonth.getMonth()+1;
  $('home-year').textContent=y+'年';
  $('home-month-big').textContent=String(m).padStart(2,'0')+'月';
  const [income,expense,all]=await Promise.all([db.getSum('income',start,end),db.getSum('expense',start,end),db.getTransactions({startDate:start,endDate:end,limit:300})]);
  $('home-income').textContent='¥'+fmt(income);
  $('home-expense').textContent='¥'+fmt(expense);
  $('home-next-arrow').style.visibility=monthKey(state.currentMonth)>=monthKey(new Date())?'hidden':'visible';

  const groups=groupByDay(all);
  const c=$('home-day-groups'), e=$('home-empty');
  if(!groups.length){ c.innerHTML=''; e.classList.remove('hidden'); }
  else {
    e.classList.add('hidden');
    c.innerHTML=groups.map(g=>{
      const expSum=g.txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
      return`<div class="day-group"><div class="day-header"><span><span class="day-date">${dl(g.date)}</span><span class="day-weekday">${wd(g.date)}</span></span><span class="day-exp">${expSum>0?`<span class="amt">¥${fmt(expSum)}</span>`:'¥0.00'}</span></div><div class="day-body">${g.txns.map(t=>txnRowHTML(t)).join('')}</div></div>`;
    }).join('');
  }
  // 绑定左滑删除事件
  bindSwipeDelete();
}

function groupByDay(txns) {
  const m=new Map(); txns.forEach(t=>{ if(!m.has(t.date))m.set(t.date,[]); m.get(t.date).push(t); });
  return [...m.entries()].map(([d,t])=>({date:d,txns:t})).sort((a,b)=>b.date.localeCompare(a.date));
}

function txnRowHTML(t) {
  const inc=t.type==='income', icon=catManager.getIcon(t.category1);
  const tag=t.tag||'';
  // 第一行：备注 > 一级科目名
  const line1=t.note||t.category1;
  // 第二行：仅标签（无标签则空）
  const line2=tag?`#${tag}`:'';
  return`<div class="swipe-row" data-id="${t.id}">
    <div class="swipe-delete" onclick="swipeDeleteTxn('${t.id}')">删除</div>
    <div class="swipe-content txn-row" ontouchstart="swipeStart(event)" ontouchmove="swipeMove(event)" ontouchend="swipeEnd(event)">
      <div class="txn-left" onclick="openEditNote('${t.id}')" style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;cursor:pointer">
        <div class="txn-icon-wrap">${icon}</div>
        <div class="txn-info">
          <span class="txn-cat">${esc(line1)}</span>
          ${line2?`<span class="txn-note" style="font-size:11px;color:var(--text-secondary)">${esc(line2)}</span>`:''}
        </div>
      </div>
      <div class="txn-amount ${inc?'income':''}" onclick="openEditAmount('${t.id}')" style="cursor:pointer;flex-shrink:0">${inc?'+':'-'}¥${fmt(t.amount)}</div>
    </div>
  </div>`;
}

// ---- 左滑删除 ----
let swipeStartX=0, swipeCurrentRow=null;
function swipeStart(e){ swipeStartX=e.touches[0].clientX; swipeCurrentRow=e.currentTarget; }
function swipeMove(e){
  if(!swipeCurrentRow) return;
  const dx=e.touches[0].clientX-swipeStartX;
  if(dx<-20) swipeCurrentRow.style.transform=`translateX(${Math.max(dx,-72)}px)`;
}
function swipeEnd(e){
  if(!swipeCurrentRow) return;
  const dx=(e.changedTouches[0]?.clientX||swipeStartX)-swipeStartX;
  if(dx<-40) swipeCurrentRow.style.transform='translateX(-72px)';
  else swipeCurrentRow.style.transform='translateX(0)';
  swipeCurrentRow=null;
}
async function swipeDeleteTxn(id){
  await db.deleteTransaction(id);
  showToast('已删除');
  // 从DOM移除
  const row=document.querySelector(`.swipe-row[data-id="${id}"]`);
  if(row) row.remove();
  // 检查是否组为空
  setTimeout(()=>{
    const groups=$('home-day-groups');
    if(groups&&!groups.querySelector('.swipe-row')) renderHome();
  },300);
}
function bindSwipeDelete(){
  // swipe事件已在HTML中绑定
}

function homePrevMonth(){ state.currentMonth.setMonth(state.currentMonth.getMonth()-1); renderHome(); }
function homeNextMonth(){ if(monthKey(state.currentMonth)>=monthKey(new Date()))return; state.currentMonth.setMonth(state.currentMonth.getMonth()+1); renderHome(); }
function updateMonthTitle(){ $('home-month-title').textContent=`${state.currentMonth.getFullYear()}年${state.currentMonth.getMonth()+1}月`; }

// ============================================================
//  图表页 - 状态
// ============================================================
function _initStats(){ return { period:'week', cursor:new Date(), catPeriod:'week', catCursor:new Date(), catName:'', catSortByAmount:true, catExpanded:false, catAllTags:[] }; }
Object.assign(state, _initStats());

function _weekRange(d){ const day=d.getDay()||7; const mon=new Date(d); mon.setDate(d.getDate()-day+1); const start=mon.toISOString().split('T')[0]; const sun=new Date(mon); sun.setDate(mon.getDate()+6); return {start,end:sun.toISOString().split('T')[0],labels:[]}; }
function _dateLabels(period,cursor){
  if(period==='week'){
    const r=_weekRange(cursor); const arr=[]; const s=new Date(r.start);
    for(let i=0;i<7;i++){ const d=new Date(s);d.setDate(s.getDate()+i); arr.push((d.getMonth()+1)+'-'+d.getDate()); }
    return {start:r.start,end:r.end,labels:arr};
  } else if(period==='month'){
    const y=cursor.getFullYear(),m=cursor.getMonth(); const start=`${y}-${String(m+1).padStart(2,'0')}-01`;
    const days=new Date(y,m+1,0).getDate(); const end=`${y}-${String(m+1).padStart(2,'0')}-${days}`;
    const labels=[]; for(let d=1;d<=days;d++) labels.push((m+1)+'-'+d); return {start,end,labels};
  } else {
    const y=cursor.getFullYear(); return {start:`${y}-01-01`,end:`${y}-12-31`,labels:['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']};
  }
}
function _periodTitle(period,cursor){
  if(period==='week'){ const r=_weekRange(cursor); return r.start+' ~ '+r.end; }
  else if(period==='month') return `${cursor.getFullYear()}年${cursor.getMonth()+1}月`;
  else return `${cursor.getFullYear()}年`;
}

// ============================================================
//  图表总览
// ============================================================
async function renderStats(){ await refreshStatsOverview(); }
function switchStatsPeriod(p){
  state.statsPeriod=p; state.statsCursor=new Date();
  document.querySelectorAll('#stats-period-bar button').forEach(b=>b.classList.toggle('active',b.dataset.p===p));
  refreshStatsOverview();
}
function statsNav(dir){
  const p=state.statsPeriod, c=new Date(state.statsCursor);
  if(p==='week') c.setDate(c.getDate()+dir*7);
  else if(p==='month') c.setMonth(c.getMonth()+dir);
  else c.setFullYear(c.getFullYear()+dir);
  const now=new Date(); if(c>now&&dir>0) return;
  state.statsCursor=c; refreshStatsOverview();
}

async function refreshStatsOverview(){
  const {period,cursor}=state;
  $('stats-date-title').textContent=_periodTitle(period,cursor);
  const {start,end,labels}=_dateLabels(period,cursor);
  const txns=await db.getTransactions({type:'expense',startDate:start,endDate:end});
  // 每日汇总
  const dailyData=labels.map(lbl=>{
    let ds; if(period==='year'){ const m=parseInt(lbl); ds=`${cursor.getFullYear()}-${String(m).padStart(2,'0')}`; return txns.filter(t=>t.date.startsWith(ds)).reduce((s,t)=>s+t.amount,0); }
    else{ const parts=lbl.split('-'); const m=parseInt(parts[0]),d=parseInt(parts[1]); ds=`${cursor.getFullYear()}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; return txns.filter(t=>t.date===ds).reduce((s,t)=>s+t.amount,0); }
  });
  const total=dailyData.reduce((a,b)=>a+b,0);
  const avg=labels.length>0?total/labels.length:0;
  // 最大单笔
  const maxTxn=txns.reduce((max,t)=>t.amount>(max?.amount||0)?t:max,null);
  $('stats-max-amount').textContent=maxTxn?`最大单笔 ¥${fmt(maxTxn.amount)}`:'';
  // 折线图
  chartRenderer.renderLine('chart-main-line',labels,dailyData,avg);
  // 分类排行
  const catMap={}; txns.forEach(t=>{ catMap[t.category1]=(catMap[t.category1]||0)+t.amount; });
  const rank=Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  $('stats-rank-list').innerHTML=rank.length?rank.map(([n,a],i)=>`<div class="rank-row" onclick="openCatStats('${n}')"><span class="rank-num ${i<3?'top':''}">${i+1}</span><span class="rank-icon">${catManager.getIcon(n)}</span><span class="rank-name">${n}</span><div class="rank-bar-wrap"><div class="rank-bar-fill" style="width:${total>0?Math.min(a/total*100,100):0}%"></div></div><span class="rank-amount">¥${fmt(a)}</span></div>`).join(''):'<div class="empty-state"><div class="empty-state-text">暂无支出数据</div></div>';
  // 点击数据点 → 弹窗
  window._statsLabels=labels; window._statsTxns=txns; window._statsPeriod=period; window._statsCursor=cursor;
}

// 弹窗：当日明细
async function openDayDetail(idx){
  const labels=window._statsLabels||[]; const lbl=labels[idx]; if(lbl===undefined) return;
  let ds; const {period,cursor}=state;
  if(period==='year'){ const m=parseInt(lbl); ds=`${cursor.getFullYear()}-${String(m).padStart(2,'0')}`; $('day-detail-title').textContent=lbl; }
  else{ const parts=lbl.split('-'); const m=parseInt(parts[0]),d=parseInt(parts[1]); ds=`${cursor.getFullYear()}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; $('day-detail-title').textContent=lbl; }
  const txns=period==='year'?(window._statsTxns||[]).filter(t=>t.date.startsWith(ds)):(window._statsTxns||[]).filter(t=>t.date===ds);
  $('day-detail-list').innerHTML=txns.length?txns.map(t=>txnRowHTML(t)).join(''):'<div class="empty-state"><div class="empty-state-text">当天无记录</div></div>';
  $('overlay-day-detail').classList.remove('hidden');
}
function closeDayDetail(){$('overlay-day-detail').classList.add('hidden');}

// ============================================================
//  科目详情页
// ============================================================
function openCatStats(cat1){
  hideAllPages();
  state.catName=cat1; state.catPeriod='week'; state.catCursor=new Date(); state.catSortByAmount=true; state.catExpanded=false;
  document.querySelectorAll('#cat-period-bar button').forEach(b=>b.classList.toggle('active',b.dataset.p==='week'));
  $('cat-sort-btn').textContent='按时间'; $('cat-sort-hint').textContent='按金额排序';
  $('cat-stats-title').textContent=catManager.getIcon(cat1)+' '+cat1;
  $('page-cat-stats').classList.add('active');
  document.querySelector('.tab-bar').style.display='none';
  refreshCatStats();
}
function closeCatStats(){ hideAllPages(); $('page-transactions').classList.add('active'); document.querySelector('.tab-bar').style.display='flex'; }
function switchCatPeriod(p){ state.catPeriod=p; state.catCursor=new Date(); document.querySelectorAll('#cat-period-bar button').forEach(b=>b.classList.toggle('active',b.dataset.p===p)); refreshCatStats(); }
function catNav(dir){ const p=state.catPeriod; const c=new Date(state.catCursor); if(p==='week')c.setDate(c.getDate()+dir*7); else if(p==='month')c.setMonth(c.getMonth()+dir); else c.setFullYear(c.getFullYear()+dir); const now=new Date(); if(c>now&&dir>0) return; state.catCursor=c; refreshCatStats(); }
function toggleCatSort(){ state.catSortByAmount=!state.catSortByAmount; $('cat-sort-btn').textContent=state.catSortByAmount?'按时间':'按金额'; $('cat-sort-hint').textContent=state.catSortByAmount?'按金额排序':'按时间排序'; renderCatRank(); }
function expandCatRank(){ state.catExpanded=true; $('cat-expand-btn').style.display='none'; renderCatRank(); }

async function refreshCatStats(){
  const {catName,catPeriod,catCursor}=state;
  $('cat-date-title').textContent=_periodTitle(catPeriod,catCursor);
  const {start,end,labels}=_dateLabels(catPeriod,catCursor);
  const txns=await db.getTransactions({type:'expense',category1:catName,startDate:start,endDate:end});
  const dailyData=labels.map(lbl=>{
    let ds; if(catPeriod==='year'){ const m=parseInt(lbl); ds=`${catCursor.getFullYear()}-${String(m).padStart(2,'0')}`; return txns.filter(t=>t.date.startsWith(ds)).reduce((s,t)=>s+t.amount,0); }
    else{ const parts=lbl.split('-'); const m=parseInt(parts[0]),d=parseInt(parts[1]); ds=`${catCursor.getFullYear()}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; return txns.filter(t=>t.date===ds).reduce((s,t)=>s+t.amount,0); }
  });
  const total=dailyData.reduce((a,b)=>a+b,0);
  const avg=total/labels.length||0;
  chartRenderer.renderLine('chart-cat-line',labels,dailyData,avg);
  // 标签汇总
  const tagMap={}; txns.forEach(t=>{ const k=t.tag||'无标签'; tagMap[k]=(tagMap[k]||0)+t.amount; });
  state.catAllTags=Object.entries(tagMap).map(([n,a])=>({name:n,amount:a,latest:txns.filter(t=>(t.tag||'无标签')===n).sort((a,b)=>b.date.localeCompare(a.date))[0]?.date||''})).sort((a,b)=>state.catSortByAmount?b.amount-a.amount:a.latest.localeCompare(b.latest));
  renderCatRank();
  // 饼图
  chartRenderer.renderPie('chart-cat-pie',state.catAllTags.map(t=>({name:t.name,amount:t.amount})));
  // 下方完整标签列表
  $('cat-full-list').innerHTML=state.catAllTags.map((t,i)=>`<div class="rank-row" style="cursor:default"><span class="rank-num ${i<3?'top':''}">${i+1}</span><span class="rank-name">🏷️ ${t.name}</span><span class="rank-amount">¥${fmt(t.amount)}</span></div>`).join('')||'<div class="empty-state"><div class="empty-state-text">暂无数据</div></div>';
}

function renderCatRank(){
  const {catAllTags,catExpanded}=state;
  const list=catExpanded?catAllTags:catAllTags.slice(0,3);
  const total=catAllTags.reduce((s,t)=>s+t.amount,0);
  $('cat-rank-list').innerHTML=list.map((t,i)=>`<div class="rank-row" style="cursor:default"><span class="rank-num ${i<3?'top':''}">${i+1}</span><span class="rank-name">🏷️ ${t.name}</span><span class="rank-amount">¥${fmt(t.amount)}</span><span class="rank-pct">${total>0?(t.amount/total*100).toFixed(1):0}%</span></div>`).join('')||'<div class="empty-state"><div class="empty-state-text">暂无数据</div></div>';
  $('cat-expand-btn').style.display=(!catExpanded&&catAllTags.length>3)?'block':'none';
}

// (旧 showCatDetail 已由 openCatStats + refreshCatStats 替代)

function closeSubPage(pageId,tab){ const el=document.getElementById(pageId);if(el)el.remove();switchTab(tab);}

// ============================================================
//  交易详情
// ============================================================
async function showTxnDetail(id){
  const t=await db.getTransaction(id);if(!t)return;
  const inc=t.type==='income',pf=inc?'+':'-',cls=inc?'income':'expense';
  $('detail-amount').textContent=`${pf}¥${fmt(t.amount)}`;
  $('detail-amount').className=`detail-amount ${cls}`;
  const detailLabel=t.note||t.category1;
  $('detail-cat').textContent=detailLabel+(t.tag?'  #'+t.tag:'');
  $('detail-date').textContent=fmtCN(t.date);
  $('detail-note').textContent=t.note||'';
  $('detail-note-row').style.display=t.note?'':'none';
  $('detail-note-row2').style.display=t.note?'':'none';
  $('detail-id').dataset.id=id;
  $('page-txn-detail').classList.add('active');
  document.querySelector('.tab-bar').style.display='none';
}
function closeTxnDetail(){hideAllPages();$('page-transactions').classList.add('active');document.querySelector('.tab-bar').style.display='flex';}
async function deleteTxnDetail(){
  const id=$('detail-id').dataset.id;if(!id||!confirm('确认删除？'))return;
  await db.deleteTransaction(id);showToast('已删除');closeTxnDetail();
}
async function editTxnDetail(){
  const id=$('detail-id').dataset.id;const t=await db.getTransaction(id);if(!t)return;
  closeTxnDetail();
  state.editingTxnId=id;state.sheetType=t.type;state.sheetCat1=t.category1;
  state.sheetTag=t.tag||'';state.sheetAmount=t.amount;state.sheetInput=fmt(t.amount);
  state.sheetDate=t.date;
  openSheet();
  // 直接跳到第二步
  $('sheet-step1').classList.remove('active');
  $('sheet-step2').classList.add('active');
  $('step2-cat-label').textContent=catManager.getIcon(t.category1)+' '+t.category1;
  $('step2-amount').innerHTML='¥<span class="currency">'+fmt(t.amount)+'</span>';
}

// ============================================================
//  资产
// ============================================================
async function renderAssets(){
  const accounts=await db.getAccounts();
  let ta=0,tl=0;
  accounts.forEach(a=>{if(a.type==='liability')tl+=a.balance;else if(a.balance<0)tl+=Math.abs(a.balance);else ta+=a.balance;});
  $('asset-total-assets').textContent='¥'+fmt(ta);
  $('asset-total-liabilities').textContent='¥'+fmt(tl);
  $('asset-networth').textContent='¥'+fmt(ta-tl);
  const types=['cash','savingsCard','creditCard','virtualAccount','liability','custom'];
  const names={cash:'💵 现金',savingsCard:'🏦 储蓄卡',creditCard:'💳 信用卡',virtualAccount:'📱 虚拟账户',liability:'📉 负债',custom:'✨ 自定义'};
  let h='';
  types.forEach(t=>{
    const list=accounts.filter(a=>a.type===t);if(!list.length)return;
    const tot=list.reduce((s,a)=>s+a.balance,0);
    h+=`<div class="asset-section"><div class="asset-section-header" onclick="toggleAsset(this)"><span class="icon">${names[t].split(' ')[0]}</span><span class="title">${names[t].split(' ').slice(1).join(' ')}</span><span style="font-size:12px;color:var(--text-secondary)">(${list.length})</span><span style="flex:1"></span><span style="font-size:13px;color:var(--text-secondary)">¥${fmt(tot)}</span><span class="arrow">›</span></div><div class="hidden">${list.map(a=>`<div class="asset-item" onclick="showAssetDetail('${a.id}')"><div class="asset-item-name">${esc(a.name)}</div><div class="asset-item-balance ${a.balance<0?'negative':''}">¥${fmt(a.balance)}</div></div>`).join('')}</div></div>`;
  });
  $('asset-sections').innerHTML=h||'<div class="empty-state mt-16"><div class="empty-state-text">还没有账户</div></div>';
}
function toggleAsset(el){ const d=el.nextElementSibling,a=el.querySelector('.arrow');d.classList.toggle('hidden');a.classList.toggle('open'); }

async function showAssetDetail(id){
  const accounts=await db.getAccounts();const a=accounts.find(x=>x.id===id);if(!a)return;
  const txns=await db.getTransactions({accountId:id});
  const html=`<div class="page active" id="page-asset-detail"><div class="nav-header"><button class="nav-icon" onclick="closeSubPage('page-asset-detail','assets')">←</button><div class="nav-title">${esc(a.name)}</div><button class="nav-icon" onclick="closeSubPage('page-asset-detail','assets');showAddAccount('${a.id}')">✎</button></div><div class="text-center mt-16"><div style="font-size:13px;color:var(--text-secondary)">余额</div><div style="font-size:30px;font-weight:800;color:${a.balance<0?'var(--expense)':'var(--text)'}">¥${fmt(a.balance)}</div></div><div class="section-title">交易记录</div><div id="asset-txn-list">${txns.map(t=>txnRowHTML(t)).join('')||'<div class="empty-state"><div class="empty-state-text">暂无</div></div>'}</div></div>`;
  const old=document.querySelector('.page.active');if(old)old.classList.remove('active');
  const tmp=document.createElement('div');tmp.innerHTML=html;document.getElementById('app').appendChild(tmp.firstElementChild);
}

function showAddAccount(id){
  if(id){db.getAccounts().then(accs=>{const a=accs.find(x=>x.id===id);if(!a)return;state.editingAccountId=id;state.accName=a.name;state.accType=a.type;state.accBalance=a.balance;state.accNote=a.note||'';state.accCustomType=a.customTypeName||'';renderAccountForm();$('page-add-account').classList.add('active');document.querySelector('.tab-bar').style.display='none';});}
  else{state.editingAccountId=null;state.accName='';state.accType='cash';state.accBalance=0;state.accNote='';state.accCustomType='';renderAccountForm();$('page-add-account').classList.add('active');document.querySelector('.tab-bar').style.display='none';}
}
function closeAddAccount(){$('page-add-account').classList.remove('active');document.querySelector('.tab-bar').style.display='flex';switchTab('assets');}
function renderAccountForm(){
  const ts=['cash','savingsCard','creditCard','virtualAccount','liability','custom'];
  const ns=['💵 现金','🏦 储蓄卡','💳 信用卡','📱 虚拟账户','📉 负债','✨ 自定义'];
  $('acc-type-grid').innerHTML=ts.map((t,i)=>`<div class="type-card ${state.accType===t?'selected':''}" onclick="state.accType='${t}';renderAccountForm()"><div class="type-card-icon">${ns[i].split(' ')[0]}</div><div class="type-card-name">${ns[i].split(' ').slice(1).join(' ')}</div></div>`).join('');
  $('acc-name-input').value=state.accName;$('acc-balance-input').value=state.accBalance||'';
  $('acc-note-input').value=state.accNote;$('acc-custom-type').style.display=state.accType==='custom'?'':'none';
  $('acc-custom-type-input').value=state.accCustomType;
  $('acc-delete-btn').style.display=state.editingAccountId?'':'none';
  $('acc-form-title').textContent=state.editingAccountId?'编辑账户':'添加账户';
}
async function saveAccount(){
  const name=$('acc-name-input').value.trim();if(!name){showToast('请输入名称');return;}
  const acc={id:state.editingAccountId||crypto.randomUUID(),name,type:state.accType,balance:parseFloat($('acc-balance-input').value)||0,note:$('acc-note-input').value.trim()||null,customTypeName:state.accType==='custom'?($('acc-custom-type-input').value.trim()||null):null,createdAt:new Date().toISOString(),sortOrder:999};
  if(state.editingAccountId)await db.updateAccount(acc);else await db.addAccount(acc);
  showToast('保存 ✅');closeAddAccount();
}
async function deleteAccountFromForm(){if(!state.editingAccountId||!confirm('确认删除？'))return;await db.deleteAccount(state.editingAccountId);showToast('已删除');closeAddAccount();}

// ============================================================
// ============================================================
//  编辑备注/标签（点击左侧）
// ============================================================
function hideAllPages(){ document.querySelectorAll('.page.active').forEach(p=>p.classList.remove('active')); }

// ---- 备注/标签编辑（标签=蓝色徽章，备注=黑色文字，🏷️选标签）----
async function openEditNote(id){
  const t=await db.getTransaction(id); if(!t) return;
  hideAllPages();
  state.editNoteId=id;
  const icon=catManager.getIcon(t.category1);
  $('edit-note-title').textContent=icon+' '+t.category1;
  // 从多个来源提取标签和备注
  let tag=t.tag||null, note=t.note||null;
  if(!tag){
    // 兜底1：从note解析 #标签
    if(note&&note.startsWith('#')){
      const si=note.indexOf(' ');
      if(si>1){ tag=note.slice(1,si); note=note.slice(si+1).trim()||null; }
      else { tag=note.slice(1)||null; note=null; }
    }
    // 兜底2：从category2提取（排除默认值）
    if(!tag&&t.category2&&t.category2!=='自定义'&&t.category2!=='无标签'){
      tag=t.category2;
    }
  }
  state._editTag=tag;
  $('edit-note-input').value=note||'';
  updateTagBadge();
  $('page-edit-note').classList.add('active');
  document.querySelector('.tab-bar').style.display='none';
}
function updateTagBadge(){
  const badge=$('edit-note-tag-badge');
  if(state._editTag){
    badge.textContent='#'+state._editTag;
    badge.style.display='inline-block';
  } else {
    badge.textContent='';
    badge.style.display='none';
  }
}
function closeEditNote(){
  hideAllPages(); $('page-transactions').classList.add('active');
  document.querySelector('.tab-bar').style.display='flex';
}

// 标签选择器
async function openTagPicker(){
  const t=await db.getTransaction(state.editNoteId);
  if(!t) return;
  const tags=await catManager.getAllCat2List(t.category1, t.type);
  let html=`<button style="width:100%;padding:12px;text-align:center;border:1px solid var(--divider);border-radius:10px;background:#fff;font-size:14px;cursor:pointer;margin-bottom:8px" onclick="pickEditTag(null)">清除标签 ✕</button>`;
  tags.forEach(tag=>{
    const sel=state._editTag===tag;
    html+=`<button style="padding:10px 16px;margin:4px;border-radius:20px;font-size:14px;cursor:pointer;border:1px solid ${sel?'var(--primary)':'var(--divider)'};background:${sel?'var(--primary)':'#fff'};color:${sel?'#fff':'var(--text)'}" onclick="pickEditTag('${tag}')">#${tag}</button>`;
  });
  if(!tags.length) html+='<div style="font-size:13px;color:var(--text-secondary);padding:8px">暂无标签，可在"我的→类别设置"中添加</div>';
  $('tag-picker-list').innerHTML=html;
  $('overlay-tag-picker').classList.remove('hidden');
}
function closeTagPicker(){$('overlay-tag-picker').classList.add('hidden');}
function pickEditTag(tag){
  state._editTag=tag||null;
  updateTagBadge();
  closeTagPicker();
}
async function saveEditNote(){
  const id=state.editNoteId; if(!id) return;
  const t=await db.getTransaction(id); if(!t) return;
  const note=$('edit-note-input').value.trim();
  t.tag=state._editTag||null;
  t.category2=state._editTag||'无标签';
  t.note=note||null;
  await db.updateTransaction(t);
  showToast('修改成功');
  closeEditNote(); renderHome();
}

// ============================================================
//  编辑金额/日期（点击右侧）
// ============================================================
async function openEditAmount(id){
  const t=await db.getTransaction(id); if(!t) return;
  hideAllPages();
  state.editAmountId=id;
  const icon=catManager.getIcon(t.category1);
  $('edit-amount-title').textContent=icon+' '+t.category1;
  state.editAmountInput=fmt(t.amount);
  state.editAmountVal=t.amount;
  state.editAmountDate=t.date;
  $('edit-amount-display').innerHTML='¥<span class="currency">'+state.editAmountInput+'</span>';
  $('edit-amount-date').textContent=state.editAmountDate.replace(/-/g,'/');
  $('page-edit-amount').classList.add('active');
  document.querySelector('.tab-bar').style.display='none';
}
function closeEditAmount(){
  hideAllPages(); $('page-transactions').classList.add('active');
  document.querySelector('.tab-bar').style.display='flex';
}
function eaNk(key){
  if(key==='⌫') state.editAmountInput=state.editAmountInput.slice(0,-1);
  else if(key==='.'){
    if(!state.editAmountInput) state.editAmountInput='0.';
    else if(!state.editAmountInput.includes('.')) state.editAmountInput+='.';
  }
  else {
    if(state.editAmountInput==='0'&&key!=='0') state.editAmountInput=key;
    else if(state.editAmountInput==='0'&&key==='0'){}
    else state.editAmountInput+=key;
  }
  state.editAmountVal=parseFloat(state.editAmountInput)||0;
  $('edit-amount-display').innerHTML='¥<span class="currency">'+(state.editAmountInput||'0.00')+'</span>';
}
async function saveEditAmount(){
  const id=state.editAmountId; if(!id) return;
  const t=await db.getTransaction(id); if(!t) return;
  if(!state.editAmountVal) return;
  t.amount=state.editAmountVal; t.date=state.editAmountDate;
  await db.updateTransaction(t);
  showToast('修改成功');
  closeEditAmount(); renderHome();
}

// iOS 滚轮日期选择器
function openWheelPicker(){
  const d=new Date(state.editAmountDate);
  state.wheelYear=d.getFullYear(); state.wheelMonth=d.getMonth()+1; state.wheelDay=d.getDate();
  renderWheels();
  $('overlay-wheel-picker').classList.remove('hidden');
  // 滚动到选中位置
  setTimeout(()=>{
    scrollWheelTo('wheel-year',state.wheelYear-2020);
    scrollWheelTo('wheel-month',state.wheelMonth-1);
    scrollWheelTo('wheel-day',state.wheelDay-1);
  },100);
}
function closeWheelPicker(){$('overlay-wheel-picker').classList.add('hidden');}
function confirmWheelPicker(){
  state.editAmountDate=`${state.wheelYear}-${String(state.wheelMonth).padStart(2,'0')}-${String(state.wheelDay).padStart(2,'0')}`;
  $('edit-amount-date').textContent=state.editAmountDate.replace(/-/g,'/');
  closeWheelPicker();
}
function renderWheels(){
  let y='',m='',d='';
  for(let i=2020;i<=2030;i++) y+=`<div class="wheel-item" data-val="${i}">${i}年</div>`;
  for(let i=1;i<=12;i++) m+=`<div class="wheel-item" data-val="${i}">${i}月</div>`;
  const maxDay=new Date(state.wheelYear,state.wheelMonth,0).getDate();
  for(let i=1;i<=maxDay;i++) d+=`<div class="wheel-item" data-val="${i}">${i}日</div>`;
  $('wheel-year').innerHTML=y; $('wheel-month').innerHTML=m; $('wheel-day').innerHTML=d;
}
function scrollWheelTo(id,idx){
  const el=$(id); if(!el) return;
  el.scrollTop=idx*40; // 每项40px高度
}
function wheelScrolled(){
  // 滚动到最近的项
  ['wheel-year','wheel-month','wheel-day'].forEach(id=>{
    const el=$(id); if(!el) return;
    const items=el.querySelectorAll('.wheel-item');
    const scrollTop=el.scrollTop;
    const idx=Math.round(scrollTop/40);
    const target=Math.max(0,Math.min(items.length-1,idx));
    el.scrollTo({top:target*40,behavior:'smooth'});
    const val=items[target]?.dataset.val;
    if(val){
      if(id==='wheel-year') state.wheelYear=parseInt(val);
      else if(id==='wheel-month'){ state.wheelMonth=parseInt(val); renderWheels(); }
      else if(id==='wheel-day') state.wheelDay=parseInt(val);
    }
  });
}
function openBill(){
  hideAllPages();
  state.billYear=new Date().getFullYear(); state.billTab='monthly';
  document.querySelectorAll('#bill-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab==='monthly'));
  $('page-bill').classList.add('active');
  document.querySelector('.tab-bar').style.display='none';
  renderBill();
}
function closeBill(){
  hideAllPages(); $('page-transactions').classList.add('active');
  document.querySelector('.tab-bar').style.display='flex';
}
function switchBillTab(tab){
  state.billTab=tab;
  document.querySelectorAll('#bill-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  renderBill();
}
function openYearPicker(){
  const cy=new Date().getFullYear();
  let h='';
  for(let y=cy-4;y<=cy+3;y++){
    h+=`<div class="year-picker-item${y===state.billYear?' selected':''}" onclick="pickBillYear(${y})">${y}年</div>`;
  }
  $('year-picker-list').innerHTML=h;
  $('overlay-year-picker').classList.remove('hidden');
}
function closeYearPicker(){$('overlay-year-picker').classList.add('hidden');}
function pickBillYear(y){state.billYear=y;closeYearPicker();renderBill();}

async function renderBill(){
  $('bill-year-label').textContent=state.billYear+'年';
  if(state.billTab==='monthly') await renderMonthlyBill();
  else await renderYearlyBill();
}

async function renderMonthlyBill(){
  let yInc=0,yExp=0,rows='';
  for(let m=1;m<=12;m++){
    const ms=`${state.billYear}-${String(m).padStart(2,'0')}-01`;
    const me=`${state.billYear}-${String(m).padStart(2,'0')}-${new Date(state.billYear,m,0).getDate()}`;
    const[inc,exp]=await Promise.all([db.getSum('income',ms,me),db.getSum('expense',ms,me)]);
    yInc+=inc; yExp+=exp;
    const bal=inc-exp;
    rows+=`<div class="swipe-row"><div class="swipe-delete" onclick="clearMonthData(${m})">清空</div><div class="swipe-content bill-table-row" ontouchstart="swipeStart(event)" ontouchmove="swipeMove(event)" ontouchend="swipeEnd(event)"><span>${m}月</span><span class="col-inc">${inc>0?'¥'+fmt(inc):'¥0.00'}</span><span class="col-exp">${exp>0?'¥'+fmt(exp):'¥0.00'}</span><span class="col-bal" style="color:${bal>=0?'var(--income)':'var(--expense)'}">${bal>=0?'+':''}¥${fmt(bal)}</span></div></div>`;
  }
  const bal=yInc-yExp;
  $('bill-content').innerHTML=`
    <div class="bill-summary-card"><div class="total-label">年结余</div><div class="total-amount" style="color:${bal>=0?'var(--income)':'var(--expense)'}">¥${fmt(bal)}</div><div class="sub-row"><span class="inc">年收入 ¥${fmt(yInc)}</span><span class="exp">年支出 ¥${fmt(yExp)}</span></div></div>
    <div class="bill-table"><div class="bill-table-header"><span>月份</span><span>月收入</span><span>月支出</span><span>月结余</span></div>${rows}</div>`;
}

async function renderYearlyBill(){
  const allTxns=await db.getTransactions({limit:5000});
  const map={};
  allTxns.forEach(t=>{
    const y=t.date.split('-')[0];
    if(!map[y]) map[y]={inc:0,exp:0};
    if(t.type==='income') map[y].inc+=t.amount;
    else map[y].exp+=t.amount;
  });
  const years=Object.keys(map).sort((a,b)=>b.localeCompare(a));
  let tInc=0,tExp=0,rows='';
  years.forEach(y=>{
    const{inc,exp}=map[y]; tInc+=inc; tExp+=exp;
    const bal=inc-exp;
    rows+=`<div class="swipe-row"><div class="swipe-delete" onclick="clearYearData(${y})">清空</div><div class="swipe-content bill-table-row" ontouchstart="swipeStart(event)" ontouchmove="swipeMove(event)" ontouchend="swipeEnd(event)"><span>${y}年</span><span class="col-inc">${inc>0?'¥'+fmt(inc):'¥0.00'}</span><span class="col-exp">${exp>0?'¥'+fmt(exp):'¥0.00'}</span><span class="col-bal" style="color:${bal>=0?'var(--income)':'var(--expense)'}">${bal>=0?'+':''}¥${fmt(bal)}</span></div></div>`;
  });
  const bal=tInc-tExp;
  $('bill-content').innerHTML=`
    <div class="bill-summary-card"><div class="total-label">总结余</div><div class="total-amount" style="color:${bal>=0?'var(--income)':'var(--expense)'}">¥${fmt(bal)}</div><div class="sub-row"><span class="inc">总收入 ¥${fmt(tInc)}</span><span class="exp">总支出 ¥${fmt(tExp)}</span></div></div>
    <div class="bill-table"><div class="bill-table-header"><span>年份</span><span>年收入</span><span>年支出</span><span>年结余</span></div>${rows}</div>
    <div class="bill-table-tip">年账单为自然年（1.1-12.31）</div>`;
}

// 清空某月数据
async function clearMonthData(month){
  const ms=`${state.billYear}-${String(month).padStart(2,'0')}-01`;
  const me=`${state.billYear}-${String(month).padStart(2,'0')}-${new Date(state.billYear,month,0).getDate()}`;
  const txns=await db.getTransactions({startDate:ms,endDate:me,limit:5000});
  for(const t of txns) await db.deleteTransaction(t.id);
  showToast(`已清空${month}月数据`);
  renderBill();
}
// 清空某年数据
async function clearYearData(year){
  const start=`${year}-01-01`, end=`${year}-12-31`;
  const txns=await db.getTransactions({startDate:start,endDate:end,limit:10000});
  for(const t of txns) await db.deleteTransaction(t.id);
  showToast(`已清空${year}年数据`);
  renderBill();
}

// ============================================================
//  日历页面
// ============================================================
function openCalendar(){
  hideAllPages();
  state.calYear=new Date().getFullYear();
  state.calMonth=new Date().getMonth()+1;
  state.calSelected=today();
  $('page-calendar').classList.add('active');
  document.querySelector('.tab-bar').style.display='none';
  renderCalendar();
}
function closeCalendar(){
  hideAllPages(); $('page-transactions').classList.add('active');
  document.querySelector('.tab-bar').style.display='flex';
}
function calPrevMonth(){
  if(state.calMonth===1){ state.calYear--; state.calMonth=12; }
  else state.calMonth--;
  renderCalendar();
}
function calNextMonth(){
  if(state.calMonth===12){ state.calYear++; state.calMonth=1; }
  else state.calMonth++;
  renderCalendar();
}
async function renderCalendar(){
  const{calYear,calMonth}=state;
  $('cal-month-title').textContent=`${calYear}年${String(calMonth).padStart(2,'0')}月`;
  const firstDay=new Date(calYear,calMonth-1,1).getDay();
  const firstDow=firstDay===0?6:firstDay-1; // 0=周一
  const daysInMonth=new Date(calYear,calMonth,0).getDate();
  const daysInPrev=new Date(calYear,calMonth-1,0).getDate();
  const ms=`${calYear}-${String(calMonth).padStart(2,'0')}-01`;
  const me=`${calYear}-${String(calMonth).padStart(2,'0')}-${daysInMonth}`;
  const txns=await db.getTransactions({startDate:ms,endDate:me});
  const hasRecord=new Set(txns.map(t=>t.date));
  const cells=[],todayStr=today();
  for(let i=firstDow-1;i>=0;i--){
    const d=daysInPrev-i;
    const ds=`${calMonth===1?calYear-1:calYear}-${String(calMonth===1?12:calMonth-1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells.push({day:d,date:ds,other:true});
  }
  for(let d=1;d<=daysInMonth;d++){
    const ds=`${calYear}-${String(calMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells.push({day:d,date:ds,other:false});
  }
  const rem=42-cells.length;
  for(let d=1;d<=rem;d++){
    const ds=`${calMonth===12?calYear+1:calYear}-${String(calMonth===12?1:calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells.push({day:d,date:ds,other:true});
  }
  $('cal-grid').innerHTML=cells.map(c=>{
    let cls='cal-cell';
    if(c.other) cls+=' other-month';
    if(c.date===todayStr) cls+=' today';
    if(c.date===state.calSelected) cls+=' selected';
    const dot=hasRecord.has(c.date)?'<div class="cal-dot"></div>':'';
    return`<div class="${cls}" onclick="calPick('${c.date}')">${c.day}${dot}</div>`;
  }).join('');
  await calShowDay(state.calSelected);
}
function calPick(ds){
  state.calSelected=ds;
  const d=new Date(ds);
  if(d.getFullYear()!==state.calYear||d.getMonth()+1!==state.calMonth){
    state.calYear=d.getFullYear();
    state.calMonth=d.getMonth()+1;
    renderCalendar();
  } else { renderCalendar(); }
}
async function calShowDay(ds){
  const d=new Date(ds);
  const wd=['日','一','二','三','四','五','六'][d.getDay()];
  $('cal-selected-title').textContent=`${d.getMonth()+1}月${d.getDate()}日 星期${wd}`;
  const txns=await db.getTransactions({startDate:ds,endDate:ds});
  const expSum=txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  if(txns.length) $('cal-selected-title').textContent+=`  支出：¥${fmt(expSum)}`;
  $('cal-selected-title').style.color=expSum>0?'var(--expense)':'var(--text)';
  $('cal-txn-list').innerHTML=txns.length?txns.map(t=>txnRowHTML(t)).join(''):'';
}

//  搜索 / CSV / 类别设置
// ============================================================
function showSearch(){$('page-search').classList.add('active');document.querySelector('.tab-bar').style.display='none';doSearch();}
function closeSearch(){$('page-search').classList.remove('active');document.querySelector('.tab-bar').style.display='flex';switchTab(state.currentTab);}
function setSearchType(t){state.searchType=t;$('sf-all').classList.toggle('active',!t);$('sf-exp').classList.toggle('active',t==='expense');$('sf-inc').classList.toggle('active',t==='income');doSearch();}
async function doSearch(){
  const text=$('search-input').value.trim();
  const txns=await db.getTransactions({type:state.searchType,startDate:state.searchStartDate,endDate:state.searchEndDate,searchText:text||undefined,limit:100});
  $('search-txn-list').innerHTML=txns.map(t=>txnRowHTML(t)).join('');
  $('search-empty').classList.toggle('hidden',txns.length>0);
}

function triggerCSVImport(){
  const i=document.createElement('input');i.type='file';i.accept='.csv';
  i.onchange=async e=>{const f=e.target.files[0];if(!f)return;const t=await f.text();const r=await csvHandler.importCSV(t);alert(`导入完成\n成功: ${r.imported} 条\n跳过: ${r.skipped} 条`);if(r.imported>0)switchTab('transactions');};
  i.click();
}
async function triggerCSVExport(){const c=await csvHandler.exportAll();csvHandler.downloadCSV(c,`波妞记账_${today()}.csv`);showToast('导出成功');}

async function showCatManagement(){
  hideAllPages();
  state.catMgmtType='expense';$('page-cat-mgmt').classList.add('active');document.querySelector('.tab-bar').style.display='none';renderCatMgmt();
}
function closeCatManagement(){hideAllPages();$('page-profile').classList.add('active');document.querySelector('.tab-bar').style.display='flex';}
function switchCatMgmtType(t){state.catMgmtType=t;document.querySelectorAll('#cat-mgmt-segment button').forEach(b=>{const a=b.dataset.type===t;b.classList.toggle('active',a);b.classList.toggle('income',a&&t==='income');});renderCatMgmt();}
async function renderCatMgmt(){
  const type=state.catMgmtType,cat1List=catManager.getCat1List(type);
  const [customCats,allCat2s]=await Promise.all([
    catManager.getCustomCategories(type),
    Promise.all(cat1List.map(async c=>({cat1:c,cat2s:await catManager.getAllCat2List(c,type)}))),
  ]);
  const customCat1=customCats.filter(c=>!c.parentName);
  const allCat1=[...cat1List,...customCat1.map(c=>c.name)];
  let h='';
  allCat1.forEach(cat1=>{
    const d=allCat2s.find(x=>x.cat1===cat1);const subs=d?d.cat2s:[];
    h+=`<div class="cat-mgmt-section"><div class="cat-mgmt-header"><span>${catManager.getIcon(cat1)} ${cat1}</span><button class="btn-sm" onclick="addCat2Prompt('${cat1}','${type}')">+ 标签</button></div>`;
    h+=subs.length?subs.map(c=>`<div class="cat-mgmt-row">🏷️ ${c}</div>`).join(''):'<div class="cat-mgmt-row" style="color:var(--text-secondary);font-size:12px">暂无标签</div>';
    h+='</div>';
  });
  h+=`<div class="cat-mgmt-section"><div class="cat-mgmt-add"><input id="new-cat1-input" placeholder="新建一级类目"><button class="btn-sm" onclick="addCat1('${type}')">添加</button></div></div>`;
  $('cat-mgmt-body').innerHTML=h;
}
function addCat2Prompt(cat1,type){const n=prompt(`为「${cat1}」添加标签`);if(n&&n.trim()){catManager.addCat2(cat1,n.trim(),type);renderCatMgmt();showToast('已添加');}}
async function addCat1(type){const inp=$('new-cat1-input');const n=inp.value.trim();if(!n)return;await catManager.addCat1(n,type);inp.value='';renderCatMgmt();showToast('已添加');}

// 批量导入标签
async function batchImportTags(){
  const raw=$('batch-tags-input').value.trim();
  if(!raw){showToast('请按模板格式输入标签');return;}
  let count=0;
  const lines=raw.split('\n');
  for(const line of lines){
    const idx=line.indexOf(':');
    if(idx<0) continue;
    const cat1=line.slice(0,idx).trim();
    if(!cat1) continue;
    const tagsStr=line.slice(idx+1).trim();
    const tags=tagsStr.split(/[,，、\s]+/).filter(Boolean);
    let type='expense';
    if(catManager.isIncome(cat1)) type='income';
    for(const tag of tags){
      if(!tag||tag.length>20) continue;
      await catManager.addCat2(cat1,tag,type);
      count++;
    }
  }
  renderCatMgmt();
  showToast(`已导入 ${count} 个标签`);
}

// CSV 导入后自动匹配标签
async function autoMatchTagsForTxns(txns){
  for(const txn of txns){
    if(txn.tag) continue;
    let candidate=null;
    if(txn.category2&&txn.category2!=='自定义'&&txn.category2!=='无标签'){
      candidate=txn.category2;
    } else if(txn.note&&txn.note.startsWith('#')){
      const si=txn.note.indexOf(' ');
      candidate=si>1?txn.note.slice(1,si):txn.note.slice(1);
    }
    if(!candidate) continue;
    const existing=await catManager.getAllCat2List(txn.category1,txn.type);
    const match=existing.find(t=>t===candidate||t.includes(candidate)||candidate.includes(t));
    if(match){
      txn.tag=match;
      txn.category2=match;
      if(txn.note&&txn.note.startsWith('#'+candidate)){
        const rest=txn.note.slice(candidate.length+1).trim();
        txn.note=rest||null;
      }
      await db.updateTransaction(txn);
    } else {
      // 自动创建新标签
      await catManager.addCat2(txn.category1,candidate,txn.type);
      txn.tag=candidate;
      txn.category2=candidate;
      await db.updateTransaction(txn);
    }
  }
}

// ---- 日期弹窗 ----
function showDatePicker(){$('txn-date-input').value=state.sheetDate;$('overlay-date-picker').classList.remove('hidden');}
function confirmDate(){state.sheetDate=$('txn-date-input').value;$('overlay-date-picker').classList.add('hidden');showToast('日期已更新');}
function closeDatePicker(){$('overlay-date-picker').classList.add('hidden');}
