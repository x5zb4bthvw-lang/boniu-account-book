/* ============================================
   波妞记账 v3 — 三步记账流 + 深绿主题
   ============================================ */

const state = {
  currentTab: 'home', currentMonth: new Date(),
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
  switchTab('home');
  if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
});

// ============================================================
//  TabBar
// ============================================================
function switchTab(tab) {
  state.currentTab=tab;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-item').forEach(t=>t.classList.remove('active'));
  const p=$(`page-${tab}`); if(p)p.classList.add('active');
  const tb=document.querySelector(`.tab-item[data-tab="${tab}"]`); if(tb)tb.classList.add('active');
  if(tab==='home')renderHome();
  else if(tab==='stats')renderStats();
  else if(tab==='assets')renderAssets();
  $('fab-add').style.display=(tab==='home')?'flex':'none';
}

// ============================================================
//  FAB → 打开底部 Sheet
// ============================================================
function openSheet() {
  state.sheetType='expense'; state.sheetCat1=''; state.sheetTag=''; state.sheetAmount=0; state.sheetInput='';
  state.sheetDate=today(); state.editingTxnId=null;
  updateSheetSegment();
  renderSheetCatGrid();
  $('sheet-step1').classList.add('active'); $('sheet-step2').classList.remove('active'); $('sheet-step3').classList.remove('active');
  $('sheet-overlay').classList.remove('hidden');
}
function closeSheet() { $('sheet-overlay').classList.add('hidden'); }

function sheetSwitchType(type) {
  state.sheetType=type; state.sheetCat1='';
  updateSheetSegment();
  renderSheetCatGrid();
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

// ---- 第二步 ----
function sheetSelectCat(cat1) {
  state.sheetCat1=cat1; state.sheetInput=''; state.sheetAmount=0; state.sheetTag='';
  $('sheet-step1').classList.remove('active');
  $('sheet-step2').classList.add('active');
  $('step2-cat-label').textContent=catManager.getIcon(cat1)+' '+cat1;
  $('step2-amount').innerHTML='¥<span class="currency">0</span>';
}
function sheetBackToStep1() {
  $('sheet-step2').classList.remove('active');
  $('sheet-step1').classList.add('active');
}

// 自定义数字键盘
function nk(key) {
  if(key==='⌫') { state.sheetInput=state.sheetInput.slice(0,-1); }
  else if(key==='today') {
    state.sheetDate=today(); showToast('日期已设为今天');
    return;
  }
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
  $('step2-amount').innerHTML='¥<span class="currency">'+(state.sheetInput||'0')+'</span>';
}

// ---- 第三步 ----
async function sheetGoToStep3() {
  if(!state.sheetAmount) { showToast('请输入金额'); return; }
  $('sheet-step2').classList.remove('active');
  $('sheet-step3').classList.add('active');
  $('step3-cat-info').textContent=catManager.getIcon(state.sheetCat1)+' '+state.sheetCat1+' · ¥'+fmt(state.sheetAmount);
  await renderStep3Tags();
}
function sheetBackToStep2() {
  $('sheet-step3').classList.remove('active');
  $('sheet-step2').classList.add('active');
}

async function renderStep3Tags() {
  const tags=await catManager.getAllCat2List(state.sheetCat1, state.sheetType);
  let html=`<button class="tag-chip ${state.sheetTag===''?'selected':''}" onclick="pickSheetTag('')">无标签</button>`;
  tags.forEach(t=>{ html+=`<button class="tag-chip ${state.sheetTag===t?'selected':''}" onclick="pickSheetTag('${t}')">#${t}</button>`; });
  html+=`<button class="tag-add-btn" onclick="showStep3TagInput()">+</button>`;
  $('step3-tags').innerHTML=html;
  $('step3-tag-input-row').classList.add('hidden');
}
function pickSheetTag(tag) { state.sheetTag=tag; renderStep3Tags(); }
function showStep3TagInput() { $('step3-tag-input-row').classList.remove('hidden'); $('step3-tag-input').value=''; setTimeout(()=>$('step3-tag-input').focus(),100); }
async function confirmStep3Tag() {
  const v=$('step3-tag-input').value.trim(); if(!v) return;
  await catManager.addCat2(state.sheetCat1, v, state.sheetType);
  state.sheetTag=v; renderStep3Tags();
}

async function sheetComplete() {
  const txn={
    id: state.editingTxnId||crypto.randomUUID(),
    type: state.sheetType, amount: state.sheetAmount,
    category1: state.sheetCat1,
    category2: state.sheetTag||'自定义',
    tag: state.sheetTag||null,
    date: state.sheetDate, note: null,
    createdAt: new Date().toISOString(),
  };
  if(state.editingTxnId) await db.updateTransaction(txn);
  else await db.addTransaction(txn);
  showToast('保存成功 ✅');
  closeSheet();
  switchTab('home');
}

// ============================================================
//  首页 — 按天分组
// ============================================================
async function renderHome() {
  const {start,end}=monthRange(state.currentMonth);
  updateMonthTitle();
  const [income,expense,all]=await Promise.all([db.getSum('income',start,end),db.getSum('expense',start,end),db.getTransactions({startDate:start,endDate:end,limit:300})]);
  $('home-income').textContent='¥'+fmtInt(income);
  $('home-expense').textContent='¥'+fmtInt(expense);
  $('home-next-arrow').style.visibility=monthKey(state.currentMonth)>=monthKey(new Date())?'hidden':'visible';

  const groups=groupByDay(all);
  const c=$('home-day-groups'), e=$('home-empty');
  if(!groups.length){ c.innerHTML=''; e.classList.remove('hidden'); }
  else {
    e.classList.add('hidden');
    c.innerHTML=groups.map(g=>{
      const expSum=g.txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
      return`<div class="day-group"><div class="day-header"><span><span class="day-date">${dl(g.date)}</span><span class="day-weekday">${wd(g.date)}</span></span><span class="day-exp">${expSum>0?`<span class="amt">¥${fmtInt(expSum)}</span>`:'¥0'}</span></div><div class="day-body">${g.txns.map(t=>txnRowHTML(t)).join('')}</div></div>`;
    }).join('');
  }
}

function groupByDay(txns) {
  const m=new Map(); txns.forEach(t=>{ if(!m.has(t.date))m.set(t.date,[]); m.get(t.date).push(t); });
  return [...m.entries()].map(([d,t])=>({date:d,txns:t})).sort((a,b)=>b.date.localeCompare(a.date));
}

function txnRowHTML(t) {
  const inc=t.type==='income', icon=catManager.getIcon(t.category1);
  const label=t.tag||t.category2||t.category1;
  return`<div class="txn-row" onclick="showTxnDetail('${t.id}')"><div class="txn-icon-wrap">${icon}</div><div class="txn-info"><span class="txn-cat">${esc(t.category1)}</span>${label&&label!==t.category1?`<span class="txn-tag">#${esc(label)}</span>`:''}</div><div class="txn-amount ${inc?'income':''}">${inc?'+':'-'}¥${fmt(t.amount)}</div></div>`;
}

function homePrevMonth(){ state.currentMonth.setMonth(state.currentMonth.getMonth()-1); renderHome(); }
function homeNextMonth(){ if(monthKey(state.currentMonth)>=monthKey(new Date()))return; state.currentMonth.setMonth(state.currentMonth.getMonth()+1); renderHome(); }
function updateMonthTitle(){ $('home-month-title').textContent=`${state.currentMonth.getFullYear()}年${state.currentMonth.getMonth()+1}月`; }

// ============================================================
//  图表页
// ============================================================
async function renderStats() { await refreshStats(); }

function switchStatsType(t){
  state.statsType=t;
  document.querySelectorAll('#stats-type-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.type===t));
  refreshStats();
}
function switchStatsPeriod(p){
  state.statsPeriod=p; state.statsDate=new Date();
  document.querySelectorAll('#stats-period-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.period===p));
  document.getElementById('stats-month-picker').style.display=p==='month'?'flex':'none';
  refreshStats();
}
function statsPrevMonth(){
  if(state.statsPeriod==='month') state.statsDate.setMonth(state.statsDate.getMonth()-1);
  else state.statsDate.setFullYear(state.statsDate.getFullYear()-1);
  refreshStats();
}
function statsNextMonth(){
  const now=new Date();
  if(state.statsPeriod==='month'){
    if(monthKey(state.statsDate)>=monthKey(now))return;
    state.statsDate.setMonth(state.statsDate.getMonth()+1);
  }else{
    if(state.statsDate.getFullYear()>=now.getFullYear())return;
    state.statsDate.setFullYear(state.statsDate.getFullYear()+1);
  }
  refreshStats();
}

async function refreshStats() {
  const period=state.statsPeriod, type=state.statsType;
  const title=period==='month'?`${state.statsDate.getFullYear()}年${state.statsDate.getMonth()+1}月`:`${state.statsDate.getFullYear()}年`;
  $('stats-period-title').textContent=title;
  $('stats-next-period').style.visibility=(period==='month'?monthKey(state.statsDate)>=monthKey(new Date()):state.statsDate.getFullYear()>=new Date().getFullYear())?'hidden':'visible';

  // 数据范围
  let start,end,labels=[],labelFn;
  if(period==='month') {
    const r=monthRange(state.statsDate); start=r.start; end=r.end;
    const days=new Date(state.statsDate.getFullYear(),state.statsDate.getMonth()+1,0).getDate();
    for(let d=1;d<=days;d++) labels.push(d+'日');
    labelFn=(i)=>i+1;
  } else {
    start=`${state.statsDate.getFullYear()}-01-01`;
    end=`${state.statsDate.getFullYear()}-12-31`;
    labels=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    labelFn=(i)=>i+1;
  }

  const txns=await db.getTransactions({type,startDate:start,endDate:end});
  const data=[];
  if(period==='month'){
    const days=new Date(state.statsDate.getFullYear(),state.statsDate.getMonth()+1,0).getDate();
    for(let d=1;d<=days;d++){
      const ds=`${state.statsDate.getFullYear()}-${String(state.statsDate.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      data.push(txns.filter(t=>t.date===ds).reduce((s,t)=>s+t.amount,0));
    }
  } else {
    for(let m=1;m<=12;m++){
      const ms=`${state.statsDate.getFullYear()}-${String(m).padStart(2,'0')}`;
      data.push(txns.filter(t=>t.date.startsWith(ms)).reduce((s,t)=>s+t.amount,0));
    }
  }

  // 柱状图
  chartRenderer.renderMainBar('chart-main', labels, data, type);

  // 分类排行
  const catMap={};
  txns.forEach(t=>{ catMap[t.category1]=(catMap[t.category1]||0)+t.amount; });
  const total=data.reduce((a,b)=>a+b,0);
  const rank=Object.entries(catMap).map(([n,a])=>({name:n,amount:a,pct:total>0?(a/total*100):0})).sort((a,b)=>b.amount-a.amount);
  $('stats-rank').innerHTML=rank.map((r,i)=>`
    <div class="rank-row" onclick="showCatDetail('${r.name}','${type}','${start}','${end}')">
      <span class="rank-num ${i<3?'top':''}">${i+1}</span>
      <span class="rank-icon">${catManager.getIcon(r.name)}</span>
      <span class="rank-name">${r.name}</span>
      <div class="rank-bar-wrap"><div class="rank-bar-fill" style="width:${Math.min(r.pct,100)}%"></div></div>
      <span class="rank-amount">¥${fmtInt(r.amount)}</span>
      <span class="rank-pct">${r.pct.toFixed(1)}%</span>
    </div>`).join('')||'<div class="empty-state"><div class="empty-state-text">暂无数据</div></div>';
}

async function showCatDetail(cat1,type,start,end){
  const txns=await db.getTransactions({type,category1:cat1,startDate:start,endDate:end});
  const map={};txns.forEach(t=>{const k=t.tag||t.category2||'无标签';map[k]=(map[k]||0)+t.amount;});
  const list=Object.entries(map).map(([n,a])=>({name:n,amount:a})).sort((a,b)=>b.amount-a.amount);
  const total=list.reduce((s,c)=>s+c.amount,0);
  const html=`
    <div class="page active" id="page-cat-detail">
      <div class="nav-header"><button class="nav-icon" onclick="closeSubPage('page-cat-detail','stats')">←</button><div class="nav-title">${catManager.getIcon(cat1)} ${cat1}</div><div style="width:36px"></div></div>
      <div class="text-center mt-16"><div style="font-size:13px;color:var(--text-secondary)">总计</div><div style="font-size:30px;font-weight:800;color:${type==='income'?'var(--income)':'var(--expense)'}">¥${fmt(total)}</div></div>
      <div class="section-title">标签明细</div>
      <div class="category-rank">${list.map((c,i)=>`<div class="rank-row"><span class="rank-num ${i<3?'top':''}">${i+1}</span><span class="rank-name">${c.name}</span><span class="rank-amount">¥${fmt(c.amount)}</span><span class="rank-pct">${total>0?(c.amount/total*100).toFixed(1):0}%</span></div>`).join('')||'<div class="empty-state"><div class="empty-state-text">暂无数据</div></div>'}</div>
    </div>`;
  const old=document.querySelector('.page.active');if(old)old.classList.remove('active');
  const tmp=document.createElement('div');tmp.innerHTML=html;document.getElementById('app').appendChild(tmp.firstElementChild);
}

function closeSubPage(pageId,tab){ const el=document.getElementById(pageId);if(el)el.remove();switchTab(tab);}

// ============================================================
//  交易详情
// ============================================================
async function showTxnDetail(id){
  const t=await db.getTransaction(id);if(!t)return;
  const inc=t.type==='income',pf=inc?'+':'-',cls=inc?'income':'expense';
  $('detail-amount').textContent=`${pf}¥${fmt(t.amount)}`;
  $('detail-amount').className=`detail-amount ${cls}`;
  $('detail-cat').textContent=`${t.category1}${t.tag?' > #'+t.tag:''}`;
  $('detail-date').textContent=fmtCN(t.date);
  $('detail-note').textContent=t.note||'';
  $('detail-note-row').style.display=t.note?'':'none';
  $('detail-note-row2').style.display=t.note?'':'none';
  $('detail-id').dataset.id=id;
  $('page-txn-detail').classList.add('active');
  document.querySelector('.tab-bar').style.display='none';$('fab-add').style.display='none';
}
function closeTxnDetail(){$('page-txn-detail').classList.remove('active');document.querySelector('.tab-bar').style.display='flex';$('fab-add').style.display='flex';switchTab('home');}
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
  $('asset-total-assets').textContent='¥'+fmtInt(ta);
  $('asset-total-liabilities').textContent='¥'+fmtInt(tl);
  $('asset-networth').textContent='¥'+fmtInt(ta-tl);
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
//  搜索 / CSV / 类别设置
// ============================================================
function showSearch(){$('page-search').classList.add('active');document.querySelector('.tab-bar').style.display='none';$('fab-add').style.display='none';doSearch();}
function closeSearch(){$('page-search').classList.remove('active');document.querySelector('.tab-bar').style.display='flex';$('fab-add').style.display='flex';switchTab(state.currentTab);}
function setSearchType(t){state.searchType=t;$('sf-all').classList.toggle('active',!t);$('sf-exp').classList.toggle('active',t==='expense');$('sf-inc').classList.toggle('active',t==='income');doSearch();}
async function doSearch(){
  const text=$('search-input').value.trim();
  const txns=await db.getTransactions({type:state.searchType,startDate:state.searchStartDate,endDate:state.searchEndDate,searchText:text||undefined,limit:100});
  $('search-txn-list').innerHTML=txns.map(t=>txnRowHTML(t)).join('');
  $('search-empty').classList.toggle('hidden',txns.length>0);
}

function triggerCSVImport(){
  const i=document.createElement('input');i.type='file';i.accept='.csv';
  i.onchange=async e=>{const f=e.target.files[0];if(!f)return;const t=await f.text();const r=await csvHandler.importCSV(t);alert(`导入完成\n成功: ${r.imported} 条\n跳过: ${r.skipped} 条`);if(r.imported>0)switchTab('home');};
  i.click();
}
async function triggerCSVExport(){const c=await csvHandler.exportAll();csvHandler.downloadCSV(c,`波妞记账_${today()}.csv`);showToast('导出成功');}

async function showCatManagement(){
  state.catMgmtType='expense';$('page-cat-mgmt').classList.add('active');document.querySelector('.tab-bar').style.display='none';renderCatMgmt();
}
function closeCatManagement(){$('page-cat-mgmt').classList.remove('active');document.querySelector('.tab-bar').style.display='flex';switchTab('profile');}
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

// ---- 日期弹窗 ----
function showDatePicker(){$('txn-date-input').value=state.sheetDate;$('overlay-date-picker').classList.remove('hidden');}
function confirmDate(){state.sheetDate=$('txn-date-input').value;$('overlay-date-picker').classList.add('hidden');showToast('日期已更新');}
function closeDatePicker(){$('overlay-date-picker').classList.add('hidden');}
