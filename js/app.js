/* ============================================
   波妞记账 — 主应用逻辑 v2
   ============================================ */

const state = {
  currentTab: 'home',
  currentMonth: new Date(),
  selectedYear: new Date().getFullYear(),

  // 记账
  txnType: 'expense',
  txnCat1: '',
  txnCat2: '',
  txnAmount: 0,
  txnInput: '',
  txnDate: today(),
  txnNote: '',
  editingTxnId: null,

  // 资产表单
  editingAccountId: null,
  accName: '', accType: 'cash', accBalance: 0, accNote: '', accCustomType: '',

  // 搜索
  searchText: '', searchType: null,
  searchStartDate: new Date(new Date().setMonth(new Date().getMonth()-3)).toISOString().split('T')[0],
  searchEndDate: today(),

  // 类别管理
  catMgmtType: 'expense',
};

// ---- 工具 ----
function fmt(n) { return (n||0).toFixed(2); }
function fmtInt(n) { return Math.round(n||0).toLocaleString(); }
function today() { return new Date().toISOString().split('T')[0]; }
function monthKey(d) { return `${d.getFullYear()}-${d.getMonth()+1}`; }
function monthRange(date) {
  const y=date.getFullYear(),m=date.getMonth();
  return {start:`${y}-${String(m+1).padStart(2,'0')}-01`,end:`${y}-${String(m+1).padStart(2,'0')}-${new Date(y,m+1,0).getDate()}`};
}
function yearRange(y) { return {start:`${y}-01-01`,end:`${y}-12-31`}; }
function monthTitle(d) { return `${d.getFullYear()}年${d.getMonth()+1}月`; }
function showToast(msg) { const t=$('toast');t.textContent=msg;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),1500); }
function $(id) { return document.getElementById(id); }
function escHtml(s) { const d=document.createElement('div');d.textContent=s;return d.innerHTML; }
function dateLabel(ds) {
  if(ds===today())return'今天';
  const y=new Date();y.setDate(y.getDate()-1);
  if(ds===y.toISOString().split('T')[0])return'昨天';
  const d=new Date(ds);return`${d.getMonth()+1}月${d.getDate()}日`;
}
function fmtDateCN(d){const dt=new Date(d);return`${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日`;}

// ---- 初始化 ----
document.addEventListener('DOMContentLoaded',async()=>{
  await db.ready;
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
  const fab=$('fab-add'); if(fab)fab.style.display=(tab==='home')?'flex':'none';
}

// ============================================================
//  首页
// ============================================================
async function renderHome() {
  const {start,end}=monthRange(state.currentMonth);
  updateMonthTitle();
  const [income,expense,txns,accounts]=await Promise.all([
    db.getSum('income',start,end),db.getSum('expense',start,end),
    db.getTransactions({startDate:start,endDate:end,limit:20}),db.getAccounts(),
  ]);
  let assets=0,liabilities=0;
  accounts.forEach(a=>{if(a.type==='liability')liabilities+=a.balance;else if(a.balance<0)liabilities+=Math.abs(a.balance);else assets+=a.balance;});
  $('home-networth').textContent='¥ '+fmt(assets-liabilities);
  $('home-assets').textContent='¥ '+fmt(assets);
  $('home-liabilities').textContent='¥ '+fmt(liabilities);
  $('home-income').textContent='¥ '+fmt(income);
  $('home-expense').textContent='¥ '+fmt(expense);
  $('home-next-arrow').style.visibility=monthKey(state.currentMonth)>=monthKey(new Date())?'hidden':'visible';
  renderTxnList('home-txn-list',txns);
  $('home-empty').classList.toggle('hidden',txns.length>0);
  $('home-txn-list').classList.toggle('hidden',txns.length===0);
}
function homePrevMonth(){state.currentMonth.setMonth(state.currentMonth.getMonth()-1);renderHome();}
function homeNextMonth(){if(monthKey(state.currentMonth)>=monthKey(new Date()))return;state.currentMonth.setMonth(state.currentMonth.getMonth()+1);renderHome();}
function updateMonthTitle(){$('home-month-title').textContent=monthTitle(state.currentMonth);}

// ---- 交易列表渲染 ----
function renderTxnList(containerId,txns){
  const c=$(containerId); if(!c)return;
  c.innerHTML=txns.length===0?'':txns.map(t=>{
    const inc=t.type==='income',icon=catManager.getIcon(t.category1);
    return`<div class="txn-item" onclick="showTxnDetail('${t.id}')">
      <div class="txn-icon ${inc?'income':'expense'}">${icon}</div>
      <div class="txn-info"><div class="txn-cat2">${escHtml(t.category2||t.category1)}</div>${t.note?`<div class="txn-note">${escHtml(t.note)}</div>`:''}</div>
      <div class="txn-amount"><div class="txn-amount-value ${inc?'income':'expense'}">${inc?'+':'-'}¥${fmt(t.amount)}</div><div class="txn-date">${dateLabel(t.date)}</div></div>
    </div>`;
  }).join('');
  c.querySelectorAll('.txn-item').forEach((item,i,all)=>{if(i<all.length-1){const d=document.createElement('div');d.className='txn-divider';item.after(d);}});
}

// ============================================================
//  记账 — 第一步：选一级分类
// ============================================================
function showAddTxn(){
  state.txnCat1='';state.txnCat2='';state.txnAmount=0;state.txnInput='';state.txnDate=today();state.txnNote='';state.editingTxnId=null;
  renderCatGrid();
  $('page-txn-step1').classList.add('active');
  document.querySelector('.tab-bar').style.display='none';
  $('fab-add').style.display='none';
}
function switchTxnType(type){
  state.txnType=type;state.txnCat1='';
  updateSegmentUI();
  renderCatGrid();
}
function updateSegmentUI(){
  document.querySelectorAll('#txn-segment .segment-btn').forEach(b=>{
    const act=b.dataset.type===state.txnType;
    b.classList.toggle('active',act);
    b.classList.toggle('income',act&&state.txnType==='income');
    b.classList.toggle('expense',act&&state.txnType==='expense');
  });
}
function renderCatGrid(){
  const cats=catManager.getCat1List(state.txnType);
  $('cat-grid').innerHTML=cats.map(c=>{
    const icon=catManager.getIcon(c);
    return`<button class="cat-grid-item" onclick="selectCat1('${c}')"><div class="cat-grid-emoji">${icon}</div><div class="cat-grid-name">${c}</div></button>`;
  }).join('');
}

// ---- 第二步：输入金额 ----
async function selectCat1(cat1){
  state.txnCat1=cat1;state.txnCat2='';state.txnInput='';state.txnAmount=0;
  $('page-txn-step1').classList.remove('active');
  $('page-txn-step2').classList.add('active');
  $('step2-title').textContent=catManager.getIcon(cat1)+' '+cat1;
  $('step2-amount').textContent='¥ 0';
  renderStep2Meta();
}
function backToStep1(){
  $('page-txn-step2').classList.remove('active');
  $('page-txn-step1').classList.add('active');
  renderCatGrid();
}
async function renderStep2Meta(){
  const cat2s=await catManager.getAllCat2List(state.txnCat1,state.txnType);
  const subLabel=state.txnCat2||'子类目';
  $('step2-meta').innerHTML=`
    <button class="txn-meta-item ${state.txnCat2?'active':''}" onclick="showSubcatPicker()">🏷️ ${subLabel}</button>
    <button class="txn-meta-item" onclick="showDatePicker()">📅 ${fmtDateCN(state.txnDate)}</button>
    <button class="txn-meta-item" onclick="editNote()">📝 ${state.txnNote||'备注'}</button>
  `;
}

// ---- 数字键盘 ----
function numKeyTap(key){
  if(key==='⌫')state.txnInput=state.txnInput.slice(0,-1);
  else if(key==='.'){if(!state.txnInput)state.txnInput='0.';else if(!state.txnInput.includes('.'))state.txnInput+='.';}
  else{if(state.txnInput==='0')state.txnInput=key;else state.txnInput+=key;}
  state.txnAmount=parseFloat(state.txnInput)||0;
  $('step2-amount').textContent='¥ '+(state.txnInput||'0');
}

// ---- 子类目选择 ----
async function showSubcatPicker(){
  const cat2s=await catManager.getAllCat2List(state.txnCat1,state.txnType);
  let html=cat2s.map(c=>`<button class="subcat-chip ${state.txnCat2===c?'selected':''}" onclick="pickSubcat('${c}')">${c}</button>`).join('');
  if(!cat2s.length)html='<div style="font-size:13px;color:var(--text-secondary);padding:8px">暂无子类目，可在"我的→类别设置"中添加</div>';
  else html+='<div class="subcat-add-row" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--divider)"><input id="new-subcat-input" placeholder="新建子类目"><button class="btn-primary" style="width:auto;height:38px;padding:0 16px;font-size:13px" onclick="addSubcat()">添加</button></div>';
  $('subcat-list').innerHTML=html;
  $('overlay-subcat').classList.remove('hidden');
}
function pickSubcat(name){state.txnCat2=name;closeSubcatPicker();renderStep2Meta();}
function closeSubcatPicker(){$('overlay-subcat').classList.add('hidden');}
async function addSubcat(){
  const inp=$('new-subcat-input');const name=inp.value.trim();
  if(!name)return;
  await catManager.addCat2(state.txnCat1,name,state.txnType);
  state.txnCat2=name;
  closeSubcatPicker();renderStep2Meta();showToast('子类目已添加');
}

// ---- 日期 & 备注 ----
function showDatePicker(){$('txn-date-input').value=state.txnDate;$('overlay-date-picker').classList.remove('hidden');}
function confirmDate(){state.txnDate=$('txn-date-input').value;renderStep2Meta();$('overlay-date-picker').classList.add('hidden');}
function closeDatePicker(){$('overlay-date-picker').classList.add('hidden');}
function editNote(){
  const note=prompt('备注（选填）',state.txnNote);
  if(note!==null){state.txnNote=note.trim();renderStep2Meta();}
}

// ---- 保存 & 关闭 ----
async function saveTxn(){
  if(!state.txnAmount||!state.txnCat1){showToast('请输入金额');return;}
  const txn={
    id:state.editingTxnId||crypto.randomUUID(),
    type:state.txnType,amount:state.txnAmount,
    category1:state.txnCat1,category2:state.txnCat2||'自定义',
    date:state.txnDate,note:state.txnNote||null,
    createdAt:new Date().toISOString(),
  };
  if(state.editingTxnId)await db.updateTransaction(txn);
  else await db.addTransaction(txn);
  showToast(state.editingTxnId?'修改成功 ✅':'保存成功 ✅');
  closeTxn();
}
function closeTxn(){
  $('page-txn-step1').classList.remove('active');
  $('page-txn-step2').classList.remove('active');
  document.querySelector('.tab-bar').style.display='flex';
  $('fab-add').style.display='flex';
  switchTab('home');
}

// ============================================================
//  交易详情 & 编辑
// ============================================================
async function showTxnDetail(id){
  const t=await db.getTransaction(id);if(!t)return;
  const inc=t.type==='income',prefix=inc?'+':'-',cls=inc?'income':'expense';
  $('detail-amount').textContent=`${prefix}¥${fmt(t.amount)}`;
  $('detail-amount').className=`detail-amount ${cls}`;
  $('detail-cat').textContent=`${t.category1} > ${t.category2}`;
  $('detail-type').textContent=inc?'收入':'支出';
  $('detail-date').textContent=fmtDateCN(t.date);
  $('detail-note').textContent=t.note||'无';
  $('detail-note-row').style.display=t.note?'':'none';
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
  const id=$('detail-id').dataset.id;
  const t=await db.getTransaction(id);if(!t)return;
  closeTxnDetail();
  state.editingTxnId=id;
  state.txnType=t.type;state.txnCat1=t.category1;state.txnCat2=t.category2;
  state.txnAmount=t.amount;state.txnInput=fmt(t.amount);
  state.txnDate=t.date;state.txnNote=t.note||'';
  updateSegmentUI();renderCatGrid();
  $('page-txn-step1').classList.add('active');
  document.querySelector('.tab-bar').style.display='none';$('fab-add').style.display='none';
}

// ============================================================
//  统计页
// ============================================================
async function renderStats(){await renderStatsOverview();}
function switchStatsTab(tab){
  document.querySelectorAll('#stats-tab-bar .segment-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  $('stats-overview').classList.toggle('hidden',tab!=='overview');
  $('stats-expense').classList.toggle('hidden',tab!=='expense');
  $('stats-income').classList.toggle('hidden',tab!=='income');
}
function statsPrevYear(){state.selectedYear--;renderStats();}
function statsNextYear(){if(state.selectedYear>=new Date().getFullYear())return;state.selectedYear++;renderStats();}

async function renderStatsOverview(){
  $('stats-year-title').textContent=`${state.selectedYear} 年`;
  const {start,end}=yearRange(state.selectedYear);
  const [yInc,yExp]=await Promise.all([db.getSum('income',start,end),db.getSum('expense',start,end)]);
  $('stats-year-income').textContent='¥ '+fmtInt(yInc);
  $('stats-year-expense').textContent='¥ '+fmtInt(yExp);
  $('stats-year-balance').textContent=(yInc-yExp>=0?'+':'')+'¥ '+fmtInt(yInc-yExp);

  const monthlyData=[];
  for(let m=1;m<=12;m++){
    const ms=`${state.selectedYear}-${String(m).padStart(2,'0')}-01`;
    const me=`${state.selectedYear}-${String(m).padStart(2,'0')}-${new Date(state.selectedYear,m,0).getDate()}`;
    const[inc,exp]=await Promise.all([db.getSum('income',ms,me),db.getSum('expense',ms,me)]);
    monthlyData.push({month:m,income:inc,expense:exp});
  }
  chartRenderer.renderMonthlyBar('chart-monthly',monthlyData);

  const active=monthlyData.filter(m=>m.income>0||m.expense>0);
  $('stats-monthly-list').innerHTML=active.map(m=>
    `<div class="txn-item" onclick="showMonthDetail(${m.month})" style="border-bottom:.5px solid var(--divider)"><span style="font-weight:500;width:36px">${m.month}月</span><div style="flex:1;text-align:right;font-size:13px">${m.income>0?`<span style="color:var(--income-green)">收 ¥${fmtInt(m.income)}</span>`:''}${m.expense>0?`<span style="color:var(--expense-red);margin-left:8px">支 ¥${fmtInt(m.expense)}</span>`:''}</div><span style="color:#ccc;font-size:11px">›</span></div>`
  ).join('')||'<div class="empty-state"><div class="empty-state-text">暂无数据</div></div>';

  const expCats=await getCatBreakdown('expense',start,end);
  renderCatList('stats-expense-list',expCats,'expense',yExp);
  chartRenderer.renderPie('chart-expense-pie',expCats.map(c=>({name:c.name,amount:c.amount})));

  const incCats=await getCatBreakdown('income',start,end);
  renderCatList('stats-income-list',incCats,'income',yInc);
  chartRenderer.renderPie('chart-income-pie',incCats.map(c=>({name:c.name,amount:c.amount})));

  $('stats-next-year').style.visibility=state.selectedYear>=new Date().getFullYear()?'hidden':'visible';
}

async function getCatBreakdown(type,start,end){
  const txns=await db.getTransactions({type,startDate:start,endDate:end});
  const map={};txns.forEach(t=>{map[t.category1]=(map[t.category1]||0)+t.amount;});
  return Object.entries(map).map(([n,a])=>({name:n,amount:a,icon:catManager.getIcon(n)})).sort((a,b)=>b.amount-a.amount);
}
function renderCatList(elId,data,type,total){
  const el=$(elId);if(!el)return;
  el.innerHTML=data.map((c,i)=>`
    <div class="txn-item" onclick="showCatDetail('${c.name}','${type}')">
      <span style="width:22px;height:22px;border-radius:50%;background:${i<3?'var(--primary)':'#ccc'};color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span>
      <span style="font-size:15px;margin-left:8px">${c.icon} ${c.name}</span>
      <div style="flex:1;text-align:right"><div style="font-size:14px;font-weight:500">¥${fmt(c.amount)}</div><div style="font-size:11px;color:var(--text-secondary)">${total>0?(c.amount/total*100).toFixed(1):0}%</div></div>
      <span style="color:#ccc;font-size:11px">›</span>
    </div>`).join('')||'<div class="empty-state"><div class="empty-state-text">暂无数据</div></div>';
}

// 分类钻取
async function showCatDetail(cat1,type){
  const{start,end}=yearRange(state.selectedYear);
  const txns=await db.getTransactions({type,category1:cat1,startDate:start,endDate:end});
  const map={};txns.forEach(t=>{map[t.category2]=(map[t.category2]||0)+t.amount;});
  const list=Object.entries(map).map(([n,a])=>({name:n,amount:a})).sort((a,b)=>b.amount-a.amount);
  const total=list.reduce((s,c)=>s+c.amount,0);

  const monthlyData=[];
  for(let m=1;m<=12;m++){
    const ms=`${state.selectedYear}-${String(m).padStart(2,'0')}-01`;
    const me=`${state.selectedYear}-${String(m).padStart(2,'0')}-${new Date(state.selectedYear,m,0).getDate()}`;
    monthlyData.push({month:m,amount:txns.filter(t=>t.date>=ms&&t.date<=me).reduce((s,t)=>s+t.amount,0)});
  }

  const html=`
    <div class="page active" id="page-cat-detail">
      <div class="nav-header"><button class="nav-icon" onclick="closeSubPage('page-cat-detail','stats')">←</button><div class="nav-title">${catManager.getIcon(cat1)} ${cat1}</div><div style="width:36px"></div></div>
      <div class="card-lg text-center"><div style="font-size:13px;color:var(--text-secondary)">${state.selectedYear}年 总计</div><div style="font-size:30px;font-weight:800;color:${type==='income'?'var(--income-green)':'var(--expense-red)'}">¥${fmt(total)}</div></div>
      <div class="section-title">二级类目明细</div>
      <div class="txn-list">${list.map((c,i)=>`<div class="txn-item" style="cursor:default"><span style="width:20px;height:20px;border-radius:50%;background:${i<3?'var(--primary)':'#ccc'};color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span><span style="font-size:14px;margin-left:8px">${c.name}</span><div style="flex:1;text-align:right"><div style="font-size:14px;font-weight:500">¥${fmt(c.amount)}</div><div style="font-size:11px;color:var(--text-secondary)">${total>0?(c.amount/total*100).toFixed(1):0}%</div></div></div>`).join('')||'<div class="empty-state"><div class="empty-state-text">暂无数据</div></div>'}</div>
      <div class="chart-container mt-16"><div class="chart-title">月度趋势</div><canvas id="chart-cat-monthly" style="height:180px"></canvas><div style="margin-top:12px">${monthlyData.filter(m=>m.amount>0).map(m=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:.5px solid var(--divider);font-size:14px"><span>${m.month}月</span><span style="font-weight:500">¥${fmt(m.amount)}</span></div>`).join('')||'<div style="color:var(--text-secondary);font-size:13px">暂无数据</div>'}</div></div>
    </div>`;
  const old=document.querySelector('.page.active');if(old)old.classList.remove('active');
  const tmp=document.createElement('div');tmp.innerHTML=html;document.getElementById('app').appendChild(tmp.firstElementChild);
  setTimeout(()=>{chartRenderer.renderMonthlyBar('chart-cat-monthly',monthlyData.map(m=>({month:m.month,income:type==='income'?m.amount:0,expense:type==='expense'?m.amount:0})));},100);
}

// 月度详情
async function showMonthDetail(month){
  const ms=`${state.selectedYear}-${String(month).padStart(2,'0')}-01`;
  const me=`${state.selectedYear}-${String(month).padStart(2,'0')}-${new Date(state.selectedYear,month,0).getDate()}`;
  const txns=await db.getTransactions({startDate:ms,endDate:me});
  const inc=txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const exp=txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const html=`
    <div class="page active" id="page-month-detail">
      <div class="nav-header"><button class="nav-icon" onclick="closeSubPage('page-month-detail','stats')">←</button><div class="nav-title">${state.selectedYear}年${month}月</div><div style="width:36px"></div></div>
      <div class="dual-cards mt-8"><div class="dual-card"><div class="dual-card-label">收入</div><div class="dual-card-amount income">¥${fmt(inc)}</div></div><div class="dual-card"><div class="dual-card-label">支出</div><div class="dual-card-amount expense">¥${fmt(exp)}</div></div><div class="dual-card"><div class="dual-card-label">结余</div><div class="dual-card-amount" style="color:${inc-exp>=0?'var(--primary)':'var(--expense-red)'}">¥${fmt(inc-exp)}</div></div></div>
      <div class="section-title mt-16">交易记录</div><div class="txn-list" id="month-detail-list"></div>
    </div>`;
  const old=document.querySelector('.page.active');if(old)old.classList.remove('active');
  const tmp=document.createElement('div');tmp.innerHTML=html;document.getElementById('app').appendChild(tmp.firstElementChild);
  renderTxnList('month-detail-list',txns);
}

function closeSubPage(pageId,tab){
  const el=document.getElementById(pageId);if(el)el.remove();
  switchTab(tab);
}

// ============================================================
//  资产管家
// ============================================================
async function renderAssets(){
  const accounts=await db.getAccounts();
  let ta=0,tl=0;
  accounts.forEach(a=>{if(a.type==='liability')tl+=a.balance;else if(a.balance<0)tl+=Math.abs(a.balance);else ta+=a.balance;});
  $('asset-total-assets').textContent='¥ '+fmt(ta);
  $('asset-total-liabilities').textContent='¥ '+fmt(tl);
  $('asset-networth').textContent='¥ '+fmt(ta-tl);

  const types=['cash','savingsCard','creditCard','virtualAccount','liability','custom'];
  const names={cash:'💵 现金',savingsCard:'🏦 储蓄卡',creditCard:'💳 信用卡',virtualAccount:'📱 虚拟账户',liability:'📉 负债',custom:'✨ 自定义资产'};
  let html='';
  types.forEach(t=>{
    const list=accounts.filter(a=>a.type===t);if(!list.length)return;
    const total=list.reduce((s,a)=>s+a.balance,0);
    html+=`<div class="asset-section"><div class="asset-section-header" onclick="toggleAssetSection(this)"><span class="icon" style="font-size:18px">${names[t].split(' ')[0]}</span><span class="title">${names[t].split(' ').slice(1).join(' ')}</span><span class="count">(${list.length})</span><span class="total">¥${fmt(total)}</span><span class="arrow">›</span></div><div class="asset-items hidden">${list.map(a=>`<div class="asset-item" onclick="showAssetDetail('${a.id}')"><div class="asset-item-name">${escHtml(a.name)}</div><div class="asset-item-balance ${a.balance<0?'negative':''}">¥${fmt(a.balance)}</div></div>`).join('')}</div></div>`;
  });
  $('asset-sections').innerHTML=html||'<div class="empty-state mt-16"><div class="empty-state-text">还没有账户，点击右上角 + 添加</div></div>';
}
function toggleAssetSection(h){const items=h.nextElementSibling,arrow=h.querySelector('.arrow');items.classList.toggle('hidden');arrow.classList.toggle('open');}

function showAddAccount(id){
  if(id){db.getAccounts().then(accounts=>{const a=accounts.find(x=>x.id===id);if(!a)return;state.editingAccountId=id;state.accName=a.name;state.accType=a.type;state.accBalance=a.balance;state.accNote=a.note||'';state.accCustomType=a.customTypeName||'';renderAccountForm();$('page-add-account').classList.add('active');document.querySelector('.tab-bar').style.display='none';});}
  else{state.editingAccountId=null;state.accName='';state.accType='cash';state.accBalance=0;state.accNote='';state.accCustomType='';renderAccountForm();$('page-add-account').classList.add('active');document.querySelector('.tab-bar').style.display='none';}
}
function closeAddAccount(){$('page-add-account').classList.remove('active');document.querySelector('.tab-bar').style.display='flex';switchTab('assets');}
function renderAccountForm(){
  const types=['cash','savingsCard','creditCard','virtualAccount','liability','custom'];
  const names=['💵 现金','🏦 储蓄卡','💳 信用卡','📱 虚拟账户','📉 负债','✨ 自定义'];
  $('acc-type-grid').innerHTML=types.map((t,i)=>`<div class="type-card ${state.accType===t?'selected':''}" onclick="state.accType='${t}';renderAccountForm()"><div class="type-card-icon">${names[i].split(' ')[0]}</div><div class="type-card-name">${names[i].split(' ').slice(1).join(' ')}</div></div>`).join('');
  $('acc-name-input').value=state.accName;$('acc-balance-input').value=state.accBalance||'';$('acc-note-input').value=state.accNote;
  $('acc-custom-type').style.display=state.accType==='custom'?'':'none';$('acc-custom-type-input').value=state.accCustomType;
  $('acc-delete-btn').style.display=state.editingAccountId?'':'none';
  $('acc-form-title').textContent=state.editingAccountId?'编辑账户':'添加账户';
}
async function saveAccount(){
  const name=$('acc-name-input').value.trim();if(!name){showToast('请输入账户名称');return;}
  const acc={id:state.editingAccountId||crypto.randomUUID(),name,type:state.accType,balance:parseFloat($('acc-balance-input').value)||0,note:$('acc-note-input').value.trim()||null,customTypeName:state.accType==='custom'?($('acc-custom-type-input').value.trim()||null):null,createdAt:new Date().toISOString(),sortOrder:999};
  if(state.editingAccountId)await db.updateAccount(acc);else await db.addAccount(acc);
  showToast(state.editingAccountId?'修改成功 ✅':'添加成功 ✅');closeAddAccount();
}
async function deleteAccountFromForm(){if(!state.editingAccountId||!confirm('确认删除？'))return;await db.deleteAccount(state.editingAccountId);showToast('已删除');closeAddAccount();}

async function showAssetDetail(id){
  const accounts=await db.getAccounts();const a=accounts.find(x=>x.id===id);if(!a)return;
  const txns=await db.getTransactions({accountId:id});
  const html=`<div class="page active" id="page-asset-detail"><div class="nav-header"><button class="nav-icon" onclick="closeSubPage('page-asset-detail','assets')">←</button><div class="nav-title">${escHtml(a.name)}</div><button class="nav-icon" onclick="closeSubPage('page-asset-detail','assets');showAddAccount('${a.id}')">✎</button></div><div class="card-lg text-center"><div style="font-size:13px;color:var(--text-secondary)">当前余额</div><div style="font-size:32px;font-weight:800;color:${a.balance<0?'var(--expense-red)':'var(--text)'}">¥${fmt(a.balance)}</div>${a.note?`<div style="font-size:13px;color:var(--text-secondary);margin-top:4px">${escHtml(a.note)}</div>`:''}</div><div class="section-title mt-16">关联交易记录</div><div class="txn-list" id="asset-txn-list"></div></div>`;
  const old=document.querySelector('.page.active');if(old)old.classList.remove('active');
  const tmp=document.createElement('div');tmp.innerHTML=html;document.getElementById('app').appendChild(tmp.firstElementChild);
  renderTxnList('asset-txn-list',txns);
}

// ============================================================
//  搜索
// ============================================================
function showSearch(){$('page-search').classList.add('active');document.querySelector('.tab-bar').style.display='none';$('fab-add').style.display='none';$('search-input').value='';updateSearchFilters();doSearch();}
function closeSearch(){$('page-search').classList.remove('active');document.querySelector('.tab-bar').style.display='flex';$('fab-add').style.display='flex';switchTab(state.currentTab);}
function setSearchType(t){state.searchType=t;updateSearchFilters();doSearch();}
function updateSearchFilters(){$('search-filter-type-all').classList.toggle('active',!state.searchType);$('search-filter-type-expense').classList.toggle('active',state.searchType==='expense');$('search-filter-type-income').classList.toggle('active',state.searchType==='income');}
async function doSearch(){
  const text=$('search-input').value.trim();
  const txns=await db.getTransactions({type:state.searchType,startDate:state.searchStartDate,endDate:state.searchEndDate,searchText:text||undefined,limit:100});
  renderTxnList('search-txn-list',txns);
  $('search-empty').classList.toggle('hidden',txns.length>0);
  $('search-txn-list').classList.toggle('hidden',txns.length===0);
}

// ============================================================
//  类别设置（我的 → 类别设置）
// ============================================================
async function showCatManagement(){
  state.catMgmtType='expense';
  $('page-cat-mgmt').classList.add('active');
  document.querySelector('.tab-bar').style.display='none';
  renderCatMgmt();
}
function closeCatManagement(){$('page-cat-mgmt').classList.remove('active');document.querySelector('.tab-bar').style.display='flex';switchTab('profile');}
function switchCatMgmtType(t){state.catMgmtType=t;$('#cat-mgmt-segment').querySelectorAll('.segment-btn').forEach(b=>{const a=b.dataset.type===t;b.classList.toggle('active',a);b.classList.toggle('income',a&&t==='income');b.classList.toggle('expense',a&&t==='expense');});renderCatMgmt();}

async function renderCatMgmt(){
  const type=state.catMgmtType;
  const cat1List=catManager.getCat1List(type);
  const [customCats,allCat2s]=await Promise.all([
    catManager.getCustomCategories(type),
    Promise.all(cat1List.map(async c=>({cat1:c,cat2s:await catManager.getAllCat2List(c,type)}))),
  ]);
  const customCat1=customCats.filter(c=>!c.parentName);

  let html='';
  // 一级类目
  const allCat1=[...cat1List,...customCat1.map(c=>c.name)];
  allCat1.forEach(cat1=>{
    const data=allCat2s.find(x=>x.cat1===cat1);
    const cat2s=data?data.cat2s:[];
    html+=`<div class="cat-mgmt-section"><div class="cat-mgmt-header"><span>${catManager.getIcon(cat1)} ${cat1}</span><button class="nav-icon" style="font-size:12px;color:var(--primary)" onclick="addCat2Prompt('${cat1}','${type}')">+ 添加子类目</button></div>`;
    if(cat2s.length)html+=cat2s.map(c=>`<div class="cat-mgmt-row">🏷️ ${c}</div>`).join('');
    else html+='<div class="cat-mgmt-row" style="color:var(--text-secondary);font-size:13px">暂无子类目</div>';
    html+='</div>';
  });
  // 添加一级类目
  html+=`<div class="cat-mgmt-section"><div class="cat-mgmt-add"><input id="new-cat1-input" placeholder="新建一级类目"><button class="btn-primary" style="width:auto;height:36px;padding:0 14px;font-size:13px" onclick="addCat1('${type}')">添加</button></div></div>`;

  $('cat-mgmt-body').innerHTML=html;
}

function addCat2Prompt(cat1,type){
  const name=prompt(`为「${cat1}」添加子类目名称`);
  if(name&&name.trim()){catManager.addCat2(cat1,name.trim(),type);renderCatMgmt();showToast('子类目已添加');}
}
async function addCat1(type){
  const inp=$('new-cat1-input');const name=inp.value.trim();
  if(!name){showToast('请输入名称');return;}
  await catManager.addCat1(name,type);
  inp.value='';renderCatMgmt();showToast('一级类目已添加');
}

// ============================================================
//  CSV & 设置
// ============================================================
function triggerCSVImport(){
  const input=document.createElement('input');input.type='file';input.accept='.csv';
  input.onchange=async e=>{const f=e.target.files[0];if(!f)return;const t=await f.text();const r=await csvHandler.importCSV(t);alert(`导入结果\n总行数: ${r.total}\n成功: ${r.imported} 条\n跳过: ${r.skipped} 条${r.errors.length?'\n\n错误:\n'+r.errors.slice(0,5).join('\n'):''}`);if(r.imported>0)switchTab('home');};
  input.click();
}
async function triggerCSVExport(){const csv=await csvHandler.exportAll();csvHandler.downloadCSV(csv,`波妞记账_${today()}.csv`);showToast('导出成功 ✅');}
