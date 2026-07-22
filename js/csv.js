/* ============================================
   波妞记账 — CSV 导入导出
   ============================================ */

class CSVHandler {
  // ---- 导出 ----
  async exportAll() {
    const txns = await db.getTransactions();
    return this._buildCSV(txns);
  }

  async exportByDate(startDate, endDate) {
    const txns = await db.getTransactions({ startDate, endDate });
    return this._buildCSV(txns);
  }

  _buildCSV(txns) {
    const header = '日期,类型,金额,一级分类,二级分类,备注';
    const lines = [header];
    for (const t of txns) {
      const type = t.type === 'income' ? '收入' : '支出';
      const amount = (t.amount || 0).toFixed(2);
      const cat1 = this._escape(t.category1 || '');
      const cat2 = this._escape(t.category2 || '');
      const note = this._escape(t.note || '');
      lines.push(`${t.date},${type},${amount},${cat1},${cat2},${note}`);
    }
    return lines.join('\n');
  }

  _escape(val) {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
  }

  downloadCSV(content, filename) {
    const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ---- 导入 ----
  async importCSV(content) {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return { total: 0, imported: 0, skipped: 0, errors: ['CSV 文件为空'] };

    const header = this._parseLine(lines[0]);
    const map = this._detectColumns(header);

    if (map.amountIdx === -1) return { total: 0, imported: 0, skipped: 0, errors: ['未找到金额列'] };

    let imported = 0, skipped = 0;
    const errors = [];
    const txns = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = this._parseLine(lines[i]);
      if (cols.length <= Math.max(map.amountIdx, map.dateIdx || 0)) { skipped++; continue; }

      const amount = parseFloat(cols[map.amountIdx].replace(/[¥￥,]/g, '').trim());
      if (isNaN(amount)) { skipped++; errors.push(`第${i+1}行金额格式错误`); continue; }

      const cat1 = map.cat1Idx >= 0 ? cols[map.cat1Idx]?.trim() || '其他' : '其他';
      const cat2 = map.cat2Idx >= 0 ? cols[map.cat2Idx]?.trim() || '自定义' : '自定义';

      let type = 'expense';
      if (map.typeIdx >= 0) {
        const t = cols[map.typeIdx]?.trim().toLowerCase() || '';
        type = t.includes('收入') || t.includes('income') ? 'income' : 'expense';
      } else if (catManager.isIncomeCategory(cat1)) {
        type = 'income';
      }

      const date = map.dateIdx >= 0 ? this._parseDate(cols[map.dateIdx]?.trim()) : new Date().toISOString().split('T')[0];
      const note = map.noteIdx >= 0 ? cols[map.noteIdx]?.trim() || '' : '';

      const tag=(cat2&&cat2!=='自定义'&&cat2!=='无标签')?cat2:null;
      txns.push({ type, amount, category1: cat1, category2: cat2||'无标签', tag, date, note });
      imported++;
    }

    if (txns.length > 0) await db.addTransactions(txns);

    return { total: lines.length - 1, imported, skipped, errors };
  }

  _parseLine(line) {
    const cols = [];
    let cur = '', inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return cols;
  }

  _detectColumns(header) {
    let amountIdx = -1, typeIdx = -1, dateIdx = -1, cat1Idx = -1, cat2Idx = -1, noteIdx = -1;
    header.forEach((col, i) => {
      const c = col.trim().toLowerCase();
      if (['金额','amount','price','money'].includes(c)) amountIdx = i;
      else if (['类型','type','收支类型','收支'].includes(c)) typeIdx = i;
      else if (['日期','date','时间'].includes(c)) dateIdx = i;
      else if (['一级分类','分类','category','category1','大类'].includes(c)) cat1Idx = i;
      else if (['二级分类','子分类','category2','subcategory','小类'].includes(c)) cat2Idx = i;
      else if (['备注','note','描述','说明','description','desc','内容','摘要'].includes(c)) noteIdx = i;
    });
    return { amountIdx, typeIdx, dateIdx, cat1Idx, cat2Idx, noteIdx };
  }

  _parseDate(str) {
    const fmts = [
      /^(\d{4})-(\d{2})-(\d{2})/,
      /^(\d{4})\/(\d{2})\/(\d{2})/,
      /^(\d{4})年(\d{2})月(\d{2})/,
      /^(\d{2})\/(\d{2})\/(\d{4})/,
    ];
    for (const re of fmts) {
      const m = str.match(re);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    }
    return new Date().toISOString().split('T')[0];
  }
}

const csvHandler = new CSVHandler();
