/* ============================================
   波妞记账 — 分类管理 (仅一级大类，二级由用户自定义)
   ============================================ */

const CATEGORY_ICONS = {
  '餐饮': '🍽️', '交通': '🚗', '购物': '🛍️', '居住': '🏠',
  '娱乐': '🎮', '医疗': '🏥', '教育': '📚', '通讯': '📱',
  '人情': '🎁', '宠物': '🐾', '美容': '💄',
  '工资': '💼', '兼职': '💻', '投资': '📈', '转账': '💳',
  '红包': '🧧', '奖金': '🎉', '其他': '📌',
};

// 预置一级分类（无二级子类目）
const PRESET_CATEGORIES = {
  expense: ['餐饮','交通','购物','居住','娱乐','医疗','教育','通讯','人情','宠物','美容','其他'],
  income: ['工资','兼职','投资','转账','红包','奖金','其他'],
};

const INCOME_CAT1 = new Set(PRESET_CATEGORIES.income);

class CategoryManager {
  getCat1List(type) {
    return [...PRESET_CATEGORIES[type] || []];
  }

  // 获取自定义二级类目
  async getCat2List(cat1, type) {
    const cats = await db.getUserCategories(type);
    return cats.filter(c => c.parentName === cat1).map(c => c.name);
  }

  async getAllCat2List(cat1, type) {
    const custom = await this.getCat2List(cat1, type);
    return custom;
  }

  getIcon(cat1) {
    return CATEGORY_ICONS[cat1] || '📌';
  }

  isIncome(cat1) {
    return INCOME_CAT1.has(cat1);
  }

  // 添加自定义二级类目
  async addCat2(cat1, name, type) {
    await db.addUserCategory({ name, parentName: cat1, type });
  }

  // 添加自定义一级类目
  async addCat1(name, type) {
    await db.addUserCategory({ name, parentName: null, type });
  }

  // 删除自定义类目
  async deleteCat(id) {
    await db.deleteUserCategory(id);
  }

  // 获取所有自定义类目
  async getCustomCategories(type) {
    return await db.getUserCategories(type);
  }
}

const catManager = new CategoryManager();
