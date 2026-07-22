/* ============================================
   波妞记账 — 自然语言解析引擎
   ============================================ */

class TransactionParser {
  parse(text, defaultDate = null) {
    const today = defaultDate || new Date().toISOString().split('T')[0];
    const sentences = this._split(text);
    return sentences.map(s => this._parseSentence(s, today)).filter(Boolean);
  }

  _split(text) {
    return text.split(/[，,。；;、\n]+/).map(s => s.trim()).filter(Boolean);
  }

  _parseSentence(sentence, defaultDate) {
    // 1. 提取金额
    const amtResult = this._extractAmount(sentence);
    if (!amtResult) return null;

    // 2. 提取日期
    const dateResult = this._extractDate(amtResult.remaining, defaultDate);

    // 3. 匹配分类
    const catResult = this._matchCategory(dateResult.remaining);

    // 4. 判断收支类型
    const type = catManager.isIncomeCategory(catResult.cat1) ? 'income' : 'expense';

    return {
      type,
      amount: amtResult.amount,
      category1: catResult.cat1,
      category2: catResult.cat2,
      date: dateResult.date,
      note: catResult.note || '',
    };
  }

  _extractAmount(text) {
    // 匹配: ¥15, 15元, 15.5块, 15.5块钱
    const patterns = [
      /[¥￥](\d+(?:\.\d{1,2})?)/,
      /(\d+(?:\.\d{1,2})?)\s*[元块钱]/,
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m) {
        const amount = parseFloat(m[1]);
        if (isNaN(amount) || amount <= 0) return null;
        const remaining = text.replace(m[0], '').trim();
        return { amount, remaining };
      }
    }
    return null;
  }

  _extractDate(text, defaultDate) {
    const today = defaultDate;
    const dateMap = {
      '今天': 0, '今日': 0,
      '昨天': -1, '前天': -2,
      '明天': 1,
    };
    for (const [kw, offset] of Object.entries(dateMap)) {
      if (text.includes(kw)) {
        const d = this._addDays(today, offset);
        return { date: d, remaining: text.replace(kw, '').trim() };
      }
    }
    // 匹配 "7月22日"
    const mm = text.match(/(\d{1,2})月(\d{1,2})[日号]/);
    if (mm) {
      const y = today.split('-')[0];
      const m = mm[1].padStart(2, '0');
      const d = mm[2].padStart(2, '0');
      return { date: `${y}-${m}-${d}`, remaining: text.replace(mm[0], '').trim() };
    }
    return { date: today, remaining: text };
  }

  _matchCategory(text) {
    const kw = catManager.matchKeyword(text);
    if (kw) {
      const note = text.replace(kw.keyword, '').trim();
      return { cat1: kw.match[0], cat2: kw.match[1], note: note || kw.keyword };
    }
    // 默认
    return { cat1: '其他', cat2: '自定义', note: text };
  }

  _addDays(dateStr, offset) {
    if (offset === 0) return dateStr;
    const d = new Date(dateStr);
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  }
}

const parser = new TransactionParser();
