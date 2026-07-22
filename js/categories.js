/* ============================================
   波妞记账 — 分类管理
   ============================================ */

const CATEGORY_ICONS = {
  '餐饮': '🍽️', '购物': '🛍️', '日用': '🧴', '交通': '🚗',
  '娱乐': '🎮', '通讯': '📱', '服饰': '👗', '美容': '💄',
  '住房': '🏠', '孩子': '👶', '长辈': '👴', '社交': '💬',
  '数码': '📱', '医疗': '🏥', '礼金': '🧧', '礼物': '🎁',
  '办公': '💼', '亲友': '🤝', '快递': '📦', '旅行': '✈️',
  '工资': '💰', '兼职': '💻', '投资': '📈', '转账': '💳',
  '红包': '🧧', '奖金': '🎉', '其他': '📌',
};

const PRESET_CATEGORIES = {
  expense: ['餐饮','购物','日用','交通','娱乐','通讯','服饰','美容','住房','孩子','长辈','社交','数码','医疗','礼金','礼物','办公','亲友','快递','旅行'],
  income: ['工资','兼职','投资','转账','红包','奖金','其他'],
};

const INCOME_CAT1 = new Set(PRESET_CATEGORIES.income);

class CategoryManager {
  getCat1List(type) { return [...PRESET_CATEGORIES[type] || []]; }
  async getCat2List(cat1, type) {
    const cats = await db.getUserCategories(type);
    return cats.filter(c => c.parentName === cat1).map(c => c.name);
  }
  async getAllCat2List(cat1, type) { return await this.getCat2List(cat1, type); }
  getIcon(cat1) { return CATEGORY_ICONS[cat1] || '📌'; }
  isIncome(cat1) { return INCOME_CAT1.has(cat1); }
  async addCat2(cat1, name, type) { await db.addUserCategory({ name, parentName: cat1, type }); }
  async addCat1(name, type) { await db.addUserCategory({ name, parentName: null, type }); }
  async deleteCat(id) { await db.deleteUserCategory(id); }
  async getCustomCategories(type) { return await db.getUserCategories(type); }
}

const catManager = new CategoryManager();
