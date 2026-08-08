/* ================================================================
   Amina Workbench - Application Logic v6
   Changes: Multi-device sync (server backend), responsive mobile UI,
   login auth, localStorage interceptor for auto-push sync
   ================================================================ */

// ====== Constants ======
const STORAGE_KEY = 'amina_workbench_data';
const CAT_STORAGE_KEY = 'amina_categories';
const SAVINGS_KEY = 'amina_savings';
const HEALTH_KEY = 'amina_health';
const FILM_REVIEW_KEY = 'amina_film_reviews';
const CAL_ANNO_KEY = 'amina_cal_annotations';

const DEFAULT_CATEGORIES = [
  { id: 'food', name: '餐饮', icon: '🍽️', color: '#FF6384', subcategories: [
    { id: 'breakfast', name: '早餐' }, { id: 'lunch', name: '午餐' }, { id: 'dinner', name: '晚餐' },
    { id: 'lateNight', name: '宵夜' }, { id: 'gathering', name: '聚餐' },
    { id: 'coffee', name: '咖啡奶茶' }, { id: 'snacks', name: '零食' },
  ]},
  { id: 'housing', name: '住房', icon: '🏠', color: '#36A2EB', subcategories: [
    { id: 'electricity', name: '电费' }, { id: 'water', name: '水费' }, { id: 'rent', name: '房租' },
  ]},
  { id: 'living', name: '生活消费', icon: '🛒', color: '#FFCE56', subcategories: [
    { id: 'daily', name: '日用品' }, { id: 'clothes', name: '衣服' }, { id: 'skincare', name: '护肤品' },
    { id: 'cosmetics', name: '化妆品' }, { id: 'phone', name: '话费网费' },
  ]},
  { id: 'transport', name: '交通', icon: '🚗', color: '#4BC0C0', subcategories: [
    { id: 'hsr', name: '高铁' }, { id: 'taxi', name: '打车' }, { id: 'public', name: '公共交通' },
  ]},
  { id: 'education', name: '教育', icon: '📚', color: '#9966FF', subcategories: [
    { id: 'books', name: '书本费' }, { id: 'tuition', name: '学费' }, { id: 'printing', name: '打印费' },
  ]},
  { id: 'medical', name: '医药费', icon: '💊', color: '#FF9F40', subcategories: [] },
  { id: 'entertainment', name: '娱乐', icon: '🎬', color: '#FF6B6B', subcategories: [
    { id: 'online', name: '线上' }, { id: 'offline', name: '线下' },
  ]},
];

const DEFAULT_INCOME_CATEGORIES = [
  { id: 'salary', name: '工资', icon: '💰' },
  { id: 'bonus', name: '奖金', icon: '🎁' },
  { id: 'investment', name: '投资收益', icon: '📈' },
  { id: 'parttime', name: '兼职', icon: '💼' },
  { id: 'redpacket', name: '红包', icon: '🧧' },
  { id: 'other_income', name: '其他收入', icon: '📦' },
];

const MORANDI_COLORS = ['#E8D5C4','#C4D5C4','#C4CBD5','#D5C4CB','#D5CBC4','#C4D5CC','#D5C4C4','#CBC4D5','#CCD5C4','#D5D0C4'];
const BRIGHT_COLORS = ['#FF6384','#36A2EB','#FFCE56','#4BC0C0','#9966FF','#FF9F40','#FF6B6B','#2ECC71','#E74C3C','#F39C12','#9B59B6','#1ABC9C'];
const ANNO_COLORS = ['#FF6B6B','#4ECDC4','#FFD93D','#6BCB77','#4D96FF','#FF6FD8','#9D50BB','#FF8C42'];
const LUNAR_MONTH_NAMES = ['正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','冬月','腊月'];
const TL_CAT_ICONS = { work: '💼', health: '💪', study: '📚', life: '🏠', social: '👥', rest: '😴' };
const WEEKDAYS = ['周日','周一','周二','周三','周四','周五','周六'];
const WEEKDAYS_SHORT = ['日','一','二','三','四','五','六'];
const PLANNER_START_HOUR = 6;
const PLANNER_END_HOUR = 24;
const HOUR_HEIGHT = 48;

// ====== State ======
let state = {
  selectedDate: new Date(),
  selectedWeekRef: new Date(),
  selectedMonthRef: new Date(),
  selectedBillMonth: new Date(),
  reviewDate: new Date(),
  reviewWeekRef: new Date(),
  reviewMonthRef: new Date(),
  reviewYearRef: new Date(),
  selectedCalMonth: new Date(),
  activeView: 'daily',
  activeBillTab: 'expense',
  activeReviewTab: 'daily',
  activeHealthTab: 'weight',
  activeReviewsTab: 'my',
  rvStarRating: 0,
  charts: {},
  selectedBillCat: null,
  catModalMode: null,
  catModalParentId: null,
  catModalType: null,
};

// ====== Sync Manager ======
const SYNC_DATA_KEYS = [
  STORAGE_KEY, CAT_STORAGE_KEY, CAT_STORAGE_KEY + '_income',
  SAVINGS_KEY, HEALTH_KEY, FILM_REVIEW_KEY, CAL_ANNO_KEY
];

const SyncManager = {
  supabaseUrl: localStorage.getItem('amina_supabase_url') || '',
  supabaseKey: localStorage.getItem('amina_supabase_key') || '',
  isOnline: false,
  isLoggedIn: false,
  syncTimer: null,

  restUrl(path) { return this.supabaseUrl + '/rest/v1' + path; },

  headers(json) {
    const h = { 'apikey': this.supabaseKey, 'Authorization': 'Bearer ' + this.supabaseKey };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  },

  async sha256(text) {
    const buf = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  async checkServer() {
    if (!this.supabaseUrl || !this.supabaseKey) return null;
    try {
      const res = await fetch(this.restUrl('/workbench_config?select=password_hash'), { headers: this.headers() });
      if (!res.ok) { this.isOnline = false; return null; }
      this.isOnline = true;
      return await res.json();
    } catch { this.isOnline = false; return null; }
  },

  async login(password) {
    const config = await this.checkServer();
    if (config === null) throw new Error('无法连接云端');
    const hashHex = await this.sha256(password);
    if (config.length === 0) {
      await fetch(this.restUrl('/workbench_config'), {
        method: 'POST',
        headers: { ...this.headers(true), 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ id: 'main', password_hash: hashHex })
      });
      this.isLoggedIn = true;
      return { firstRun: true };
    } else {
      if (config[0].password_hash === hashHex) { this.isLoggedIn = true; return { firstRun: false }; }
      throw new Error('密码错误');
    }
  },

  async pull() {
    if (!this.isLoggedIn) return false;
    this.setSyncStatus('syncing');
    try {
      const res = await fetch(this.restUrl('/workbench_data?select=*'), { headers: this.headers() });
      if (!res.ok) throw new Error('Sync failed');
      const rows = await res.json();
      let changed = false;
      for (const row of rows) {
        if (SYNC_DATA_KEYS.includes(row.key)) {
          const localTs = parseInt(localStorage.getItem(row.key + '_ts') || '0');
          if (row.updated_at > localTs) {
            localStorage.setItem(row.key, row.value);
            localStorage.setItem(row.key + '_ts', String(row.updated_at));
            changed = true;
          }
        }
      }
      this.setSyncStatus('synced');
      if (changed) refreshCurrentView();
      return true;
    } catch { this.setSyncStatus('error'); return false; }
  },

  async push(key, value) {
    if (!this.isLoggedIn || !this.isOnline) return;
    const ts = Date.now();
    localStorage.setItem(key + '_ts', String(ts));
    try {
      await fetch(this.restUrl('/workbench_data'), {
        method: 'POST',
        headers: { ...this.headers(true), 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ key, value, updated_at: ts })
      });
    } catch { /* silent fail */ }
  },

  setSyncStatus(status) {
    const el = document.getElementById('sync-status');
    const text = document.getElementById('sync-text');
    if (!el || !text) return;
    el.classList.remove('syncing', 'synced', 'error');
    if (status === 'syncing') { el.classList.add('syncing'); text.textContent = '同步中'; }
    else if (status === 'synced') { el.classList.add('synced'); text.textContent = '已同步'; }
    else if (status === 'error') { el.classList.add('error'); text.textContent = '同步失败'; }
    else if (status === 'offline') { el.classList.add('error'); text.textContent = '离线'; }
  },

  handleAuthFail() {
    this.isLoggedIn = false;
    this.showLogin();
  },

  showLogin() {
    const el = document.getElementById('login-overlay');
    if (el) el.classList.remove('hidden');
  },

  hideLogin() {
    const el = document.getElementById('login-overlay');
    if (el) el.classList.add('hidden');
  },

  startPeriodicSync() {
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = setInterval(() => this.pull(), 30000);
  },

  setupInterceptor() {
    const _originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
      _originalSetItem(key, value);
      if (SYNC_DATA_KEYS.includes(key) && SyncManager.isLoggedIn) {
        SyncManager.push(key, value);
      }
    };
  },

  async init() {
    this.setupInterceptor();
    if (!this.supabaseUrl || !this.supabaseKey) {
      this.setSyncStatus('offline');
      this.showLogin();
      this.showSupabaseSetup();
      return false;
    }
    const config = await this.checkServer();
    if (!config) {
      this.setSyncStatus('offline');
      this.showLogin();
      this.showSupabaseSetup();
      return false;
    }
    this.showLogin();
    this.showPasswordInput(config.length > 0);
    return false;
  },

  showSupabaseSetup() {
    const setup = document.getElementById('supabase-setup');
    const pwdInput = document.getElementById('login-password');
    const btn = document.getElementById('login-btn');
    const sub = document.getElementById('login-sub');
    const hint = document.getElementById('login-hint');
    if (setup) setup.style.display = 'block';
    if (pwdInput) pwdInput.style.display = 'block';
    if (btn) btn.style.display = 'block';
    if (sub) sub.textContent = '请填写 Supabase 配置';
    if (hint) hint.innerHTML = '没有账号？前往 <a href="https://supabase.com" target="_blank">supabase.com</a> 免费注册';
  },

  showPasswordInput(hasPassword) {
    const setup = document.getElementById('supabase-setup');
    const pwdInput = document.getElementById('login-password');
    const btn = document.getElementById('login-btn');
    const sub = document.getElementById('login-sub');
    const hint = document.getElementById('login-hint');
    if (setup) setup.style.display = 'none';
    if (pwdInput) { pwdInput.style.display = 'block'; pwdInput.focus(); }
    if (btn) btn.style.display = 'block';
    if (sub) sub.textContent = hasPassword ? '请输入密码登录' : '首次使用，请设置密码';
    if (hint) hint.textContent = hasPassword ? '' : '密码至少4位，请妥善保管';
  }
};

function refreshCurrentView() {
  const v = state.activeView;
  if (v === 'daily') renderDaily();
  else if (v === 'weekly') renderWeekly();
  else if (v === 'monthly') renderMonthly();
  else if (v === 'bills') renderBills();
  else if (v === 'savings') renderSavings();
  else if (v === 'review') renderReview();
  else if (v === 'health') renderHealth();
  else if (v === 'reviews') renderReviewsView();
  else if (v === 'calendar') renderCalendarView();
}

// ====== Category Management ======
function getCategories() {
  try {
    const raw = localStorage.getItem(CAT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
}
function saveCategories(cats) { localStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(cats)); }
function getCatById(catId) { return getCategories().find(c => c.id === catId); }
function getSubCatName(catId, subId) {
  const cat = getCatById(catId);
  if (!cat || !subId) return '';
  const sub = cat.subcategories.find(s => s.id === subId);
  return sub ? sub.name : '';
}
function addMainCategory(name) {
  const cats = getCategories();
  const id = 'cat_' + Date.now().toString(36);
  cats.push({ id, name, icon: '📦', color: BRIGHT_COLORS[cats.length % BRIGHT_COLORS.length], subcategories: [] });
  saveCategories(cats);
}
function addSubCategory(parentId, name) {
  const cats = getCategories();
  const cat = cats.find(c => c.id === parentId);
  if (cat) {
    cat.subcategories.push({ id: 'sub_' + Date.now().toString(36), name });
    saveCategories(cats);
  }
}

// ====== Income Category Management ======
function getIncomeCategories() {
  try {
    const raw = localStorage.getItem(CAT_STORAGE_KEY + '_income');
    if (raw) return JSON.parse(raw);
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_INCOME_CATEGORIES));
}
function saveIncomeCategories(cats) { localStorage.setItem(CAT_STORAGE_KEY + '_income', JSON.stringify(cats)); }
function addIncomeCategory(name) {
  const cats = getIncomeCategories();
  cats.push({ id: 'inc_' + Date.now().toString(36), name, icon: '📦' });
  saveIncomeCategories(cats);
}

// ====== Data Layer ======
function loadData() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
}
function saveData(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function getWeekKey(date) {
  const d = new Date(date); const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getMonthKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; }
function getDayData(dateKey) {
  const data = loadData();
  return {
    timeline: data[dateKey]?.timeline || [],
    todos: data[dateKey]?.todos || [],
    expenses: data[dateKey]?.expenses || [],
    income: data[dateKey]?.income || [],
    review: data[dateKey]?.review || null,
  };
}
function saveDayData(dateKey, dayData) {
  const data = loadData();
  if (!data[dateKey]) data[dateKey] = {};
  data[dateKey].timeline = dayData.timeline;
  data[dateKey].todos = dayData.todos;
  data[dateKey].expenses = dayData.expenses;
  if (dayData.income !== undefined) data[dateKey].income = dayData.income;
  if (dayData.review !== undefined) data[dateKey].review = dayData.review;
  saveData(data);
}
function getWeekGoals(weekKey) { return loadData()[`week_${weekKey}`]?.goals || []; }
function saveWeekGoals(weekKey, goals) { const d = loadData(); if (!d[`week_${weekKey}`]) d[`week_${weekKey}`] = {}; d[`week_${weekKey}`].goals = goals; saveData(d); }
function getMonthGoals(monthKey) { return loadData()[`month_${monthKey}`]?.goals || []; }
function saveMonthGoals(monthKey, goals) { const d = loadData(); if (!d[`month_${monthKey}`]) d[`month_${monthKey}`] = {}; d[`month_${monthKey}`].goals = goals; saveData(d); }

// ====== Savings Data ======
function getSavingsData() {
  try { const raw = localStorage.getItem(SAVINGS_KEY); return raw ? JSON.parse(raw) : { transactions: [], goals: [], pouch: [] }; }
  catch { return { transactions: [], goals: [], pouch: [] }; }
}
function saveSavingsData(data) { localStorage.setItem(SAVINGS_KEY, JSON.stringify(data)); }

// ====== Health Data ======
function getHealthData() {
  try { const raw = localStorage.getItem(HEALTH_KEY); return raw ? JSON.parse(raw) : { weights: [], cycles: [] }; }
  catch { return { weights: [], cycles: [] }; }
}
function saveHealthData(data) { localStorage.setItem(HEALTH_KEY, JSON.stringify(data)); }

// ====== Film Reviews Data ======
function getFilmReviews() {
  try { const raw = localStorage.getItem(FILM_REVIEW_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
function saveFilmReviews(reviews) { localStorage.setItem(FILM_REVIEW_KEY, JSON.stringify(reviews)); }

// ====== Calendar Annotations Data ======
function getCalAnnotations() {
  try { const raw = localStorage.getItem(CAL_ANNO_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
function saveCalAnnotations(annos) { localStorage.setItem(CAL_ANNO_KEY, JSON.stringify(annos)); }

// ====== Classic Films Data ======
const CLASSIC_FILMS = [
  {title:'霸王别姬',orig:'Farewell My Concubine',year:1993,director:'陈凯歌',genre:'剧情',rating:9.6,lang:'中文',type:'movie',desc:'两位京剧演员半个世纪的悲欢离合，呈现了中国历史变迁下的人性光辉与悲剧。'},
  {title:'肖申克的救赎',orig:'The Shawshank Redemption',year:1994,director:'弗兰克·德拉邦特',genre:'剧情',rating:9.7,lang:'英语',type:'movie',desc:'银行家安迪被冤入狱，在绝望中坚守希望，用二十多年时间挖出一条通往自由的路。'},
  {title:'阿甘正传',orig:'Forrest Gump',year:1994,director:'罗伯特·泽米吉斯',genre:'剧情',rating:9.5,lang:'英语',type:'movie',desc:'智商只有75的阿甘，凭着一颗纯真的心，跑过了美国几十年的历史风云。'},
  {title:'泰坦尼克号',orig:'Titanic',year:1997,director:'詹姆斯·卡梅隆',genre:'爱情',rating:9.4,lang:'英语',type:'movie',desc:'穷小子杰克和贵族少女露丝在沉船前夕相遇相爱，一段永恒的海上爱情传奇。'},
  {title:'活着',orig:'To Live',year:1994,director:'张艺谋',genre:'剧情',rating:9.3,lang:'中文',type:'movie',desc:'福贵一生经历大起大落，从富家少爷到普通百姓，在苦难中坚韧地活着。'},
  {title:'大话西游',orig:'A Chinese Odyssey',year:1995,director:'刘镇伟',genre:'喜剧',rating:9.2,lang:'中文',type:'movie',desc:'至尊宝穿越时空爱上紫霞仙子，在责任与爱情之间做出抉择，笑中带泪的经典。'},
  {title:'花样年华',orig:'In the Mood for Love',year:2000,director:'王家卫',genre:'爱情',rating:8.8,lang:'中文',type:'movie',desc:'六十年代香港，两个被伴侣背叛的人相遇，暧昧情愫在旗袍和窄巷中悄然生长。'},
  {title:'无间道',orig:'Infernal Affairs',year:2002,director:'刘伟强/麦兆辉',genre:'犯罪',rating:9.3,lang:'中文',type:'movie',desc:'警察卧底黑帮，黑帮卧底警队，双线交织的猫鼠游戏，港片巅峰之作。'},
  {title:'盗梦空间',orig:'Inception',year:2010,director:'克里斯托弗·诺兰',genre:'科幻',rating:9.4,lang:'英语',type:'movie',desc:'柯布带领团队潜入梦境深处植入想法，层层嵌套的梦境世界令人叹为观止。'},
  {title:'星际穿越',orig:'Interstellar',year:2014,director:'克里斯托弗·诺兰',genre:'科幻',rating:9.4,lang:'英语',type:'movie',desc:'宇航员穿越虫洞寻找人类新家园，在时间膨胀中跨越星际的父女之爱。'},
  {title:'辛德勒的名单',orig:"Schindler's List",year:1993,director:'史蒂文·斯皮尔伯格',genre:'战争',rating:9.5,lang:'英语',type:'movie',desc:'德国商人辛德勒在二战中倾尽所有拯救一千余名犹太人，黑暗中的人性光芒。'},
  {title:'这个杀手不太冷',orig:'Léon: The Professional',year:1994,director:'吕克·贝松',genre:'犯罪',rating:9.4,lang:'英语',type:'movie',desc:'职业杀手莱昂收留了邻家少女玛蒂尔达，一段温暖而悲壮的忘年交。'},
  {title:'千与千寻',orig:'Spirited Away',year:2001,director:'宫崎骏',genre:'动画',rating:9.4,lang:'日语',type:'anime',desc:'少女千寻误入神灵世界，在汤屋打工拯救变成猪的父母，一场奇幻成长之旅。'},
  {title:'你的名字',orig:'Your Name',year:2016,director:'新海诚',genre:'动画',rating:8.5,lang:'日语',type:'anime',desc:'东京少年和乡间少女在梦中交换身体，跨越时空寻找彼此的浪漫故事。'},
  {title:'美丽人生',orig:'Life is Beautiful',year:1997,director:'罗伯托·贝尼尼',genre:'战争',rating:9.5,lang:'意大利语',type:'movie',desc:'犹太父亲在集中营中用游戏和谎言保护儿子的童心，笑着流泪的伟大父爱。'},
  {title:'教父',orig:'The Godfather',year:1972,director:'弗朗西斯·科波拉',genre:'犯罪',rating:9.3,lang:'英语',type:'movie',desc:'柯里昂家族三代教父的权力传承，黑帮史诗的开山之作。'},
  {title:'让子弹飞',orig:'Let the Bullets Fly',year:2010,director:'姜文',genre:'喜剧',rating:8.9,lang:'中文',type:'movie',desc:'张麻子冒充县长来到鹅城，与黄四郎斗智斗勇，荒诞中藏着锋利的隐喻。'},
  {title:'飞屋环游记',orig:'Up',year:2009,director:'彼特·道格特',genre:'动画',rating:9.1,lang:'英语',type:'anime',desc:'老人卡尔用气球带着屋子飞向南美，一段关于梦想、爱情和放手的冒险。'},
  {title:'寻梦环游记',orig:'Coco',year:2017,director:'李·昂克里奇',genre:'动画',rating:9.1,lang:'英语',type:'anime',desc:'墨西哥男孩米格在亡灵世界寻找音乐梦想，关于家族记忆与遗忘的温暖故事。'},
  {title:'疯狂动物城',orig:'Zootopia',year:2016,director:'拜伦·霍华德',genre:'动画',rating:8.3,lang:'英语',type:'anime',desc:'兔子警官朱迪和狐狸尼克联手破案，在动物乌托邦中打破偏见。'},
  {title:'头脑特工队',orig:'Inside Out',year:2015,director:'彼特·道格特',genre:'动画',rating:8.2,lang:'英语',type:'anime',desc:'小女孩莱莉脑中的五种情绪在她搬家时经历冒险，创意十足的心理学动画。'},
  {title:'当幸福来敲门',orig:'The Pursuit of Happyness',year:2006,director:'加布里尔·穆奇诺',genre:'剧情',rating:9.1,lang:'英语',type:'movie',desc:'克里斯·加德纳带着儿子从无家可归到金融精英，真实故事改编的励志经典。'},
  {title:'忠犬八公的故事',orig:'Hachi: A Dog\'s Tale',year:2009,director:'拉斯·霍尔斯道姆',genre:'剧情',rating:9.4,lang:'英语',type:'movie',desc:'忠犬八公每天在车站等待已故主人，一等就是九年，催人泪下的真实故事。'},
  {title:'控方证人',orig:'Witness for the Prosecution',year:1957,director:'比利·怀尔德',genre:'悬疑',rating:9.6,lang:'英语',type:'movie',desc:'阿加莎·克里斯蒂经典法庭悬疑，反转再反转的精彩对决，结局令人拍案叫绝。'},
  {title:'12怒汉',orig:'12 Angry Men',year:1957,director:'西德尼·吕美特',genre:'剧情',rating:9.4,lang:'英语',type:'movie',desc:'十二个陪审员在一间房间里辩论少年是否有罪，密闭空间的群戏巅峰。'},
  {title:'低俗小说',orig:'Pulp Fiction',year:1994,director:'昆汀·塔伦蒂诺',genre:'犯罪',rating:8.8,lang:'英语',type:'movie',desc:'多条故事线非线性交织，昆汀式的暴力美学和对话风格影响了整整一代电影。'},
  {title:'少年的你',orig:'Better Days',year:2019,director:'曾国祥',genre:'剧情',rating:8.2,lang:'中文',type:'movie',desc:'高考前夕，小北和陈念在校园霸凌中相互守护，少年的勇气与牺牲。'},
  {title:'流浪地球',orig:'The Wandering Earth',year:2019,director:'郭帆',genre:'科幻',rating:7.9,lang:'中文',type:'movie',desc:'太阳即将毁灭，人类带着地球一起逃离太阳系，中国科幻电影的里程碑。'},
  {title:'你好，李焕英',orig:'Hi, Mom',year:2021,director:'贾玲',genre:'喜剧',rating:8.0,lang:'中文',type:'movie',desc:'贾晓玲穿越回1981年与年轻时的母亲成为闺蜜，笑着笑着就哭了的亲情故事。'},
  {title:'隐秘的角落',orig:'The Bad Kids',year:2020,director:'辛爽',genre:'悬疑',rating:8.9,lang:'中文',type:'tv',desc:'三个小孩在山上拍到谋杀案，与凶手展开心理博弈，国产悬疑剧标杆。'},
  {title:'漫长的季节',orig:'The Long Season',year:2023,director:'辛爽',genre:'悬疑',rating:9.4,lang:'中文',type:'tv',desc:'东北老工业基地的碎尸案，跨越二十年的命运交响曲，后劲极大的年代剧。'},
  {title:'甄嬛传',orig:'Empresses in the Palace',year:2011,director:'郑晓龙',genre:'古装',rating:9.2,lang:'中文',type:'tv',desc:'甄嬛从入宫到成为太后的传奇一生，宫斗剧的天花板，常看常新。'},
  {title:'琅琊榜',orig:'Nirvana in Fire',year:2015,director:'孔笙/李雪',genre:'古装',rating:9.3,lang:'中文',type:'tv',desc:'梅长苏以病弱之躯为赤焰军洗冤，权谋与情义并存的古装经典。'},
  {title:'请回答1988',orig:'Reply 1988',year:2015,director:'申源浩',genre:'生活',rating:9.7,lang:'韩语',type:'tv',desc:'1988年首尔双门洞五家人的生活点滴，温暖治愈的青春记忆。'},
  {title:'老友记',orig:'Friends',year:1994,director:'Kevin Bright',genre:'喜剧',rating:9.5,lang:'英语',type:'tv',desc:'六个好友在纽约的十年生活，美剧喜剧的天花板，永远的Friends。'},
  {title:'绝命毒师',orig:'Breaking Bad',year:2008,director:'Vince Gilligan',genre:'犯罪',rating:9.5,lang:'英语',type:'tv',desc:'化学老师沃尔特·怀特被诊断癌症后制毒，从普通男人到毒枭的堕落之路。'},
  {title:'权力的游戏',orig:'Game of Thrones',year:2011,director:'David Benioff',genre:'奇幻',rating:9.2,lang:'英语',type:'tv',desc:'七大家族争夺铁王座，龙、异鬼和权谋交织的史诗奇幻巨制。'},
  {title:'我们与恶的距离',orig:'The World Between Us',year:2019,director:'林君阳',genre:'社会',rating:9.4,lang:'中文',type:'tv',desc:'随机杀人案后，凶手家属、受害者家属和媒体的纠葛，深刻的社会议题剧。'},
  {title:'舌尖上的中国',orig:'A Bite of China',year:2012,director:'陈晓卿',genre:'纪录',rating:9.0,lang:'中文',type:'doc',desc:'中国各地美食背后的故事与文化，看得人馋又感动的美食纪录片。'},
  {title:'地球脉动',orig:'Planet Earth',year:2006,director:'Alastair Fothergill',genre:'纪录',rating:9.7,lang:'英语',type:'doc',desc:'BBC出品，从高山到深海，展现地球壮美自然的巅峰自然纪录片。'},
  {title:'蓝色星球II',orig:'The Blue Planet II',year:2017,director:'James Honeyborne',genre:'纪录',rating:9.8,lang:'英语',type:'doc',desc:'深入海洋深处，揭示海洋生物的奇妙与脆弱，配乐与画面都堪称完美。'},
  {title:'春光乍泄',orig:'Happy Together',year:1997,director:'王家卫',genre:'爱情',rating:8.8,lang:'中文',type:'movie',desc:'黎耀辉与何宝荣在布宜诺斯艾利斯的分分合合，异乡人的孤独与爱情。'},
];

// ====== Review Data (weekly/monthly/yearly) ======
function getReviewData(key) {
  const data = loadData();
  return data[key]?.review || null;
}
function saveReviewData(key, review) {
  const data = loadData();
  if (!data[key]) data[key] = {};
  data[key].review = review;
  saveData(data);
}

// ====== Data Migration ======
function migrateOldData() {
  const data = loadData();
  let migrated = false;
  Object.keys(data).forEach(key => {
    if (key.startsWith('week_') || key.startsWith('month_')) return;
    const day = data[key];
    if (!day || typeof day !== 'object') return;
    if (day.expenses) {
      day.expenses.forEach(e => {
        if (e.mainCat === undefined) {
          const oldMap = { food:'food', transport:'transport', shopping:'living', entertainment:'entertainment', health:'medical', study:'education', other:'other' };
          e.mainCat = oldMap[e.category] || 'other';
          e.subCat = '';
          delete e.category;
          migrated = true;
        }
      });
    }
    if (day.timeline) {
      day.timeline.forEach(t => {
        if (t.startTime === undefined && t.time) {
          t.startTime = t.time;
          const [h, m] = t.time.split(':').map(Number);
          const endMin = h * 60 + m + (t.duration || 60);
          t.endTime = `${String(Math.floor(endMin/60)).padStart(2,'0')}:${String(endMin%60).padStart(2,'0')}`;
          delete t.duration;
          delete t.time;
          migrated = true;
        }
      });
    }
  });
  // Migrate savings to include pouch
  const sd = getSavingsData();
  if (!sd.pouch) { sd.pouch = []; saveSavingsData(sd); }
  if (migrated) saveData(data);
}

// ====== LUNAR_INFO Table (1900-2100) ======
const LUNAR_INFO = [
0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16557,0x056a0,0x09ad0,0x055d2,
0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
0x04970,0x0a4b0,0x0b4a0,0x0ba50,0x15d57,0x056a0,0x0a5d0,0x0a950,0x09550,0x14b50,
0x049b0,0x0a4a0,0x0b350,0x0b650,0x15657,0x04ad0,0x049d0,0x0a4b0,0x0a4a0,0x0aa50,
0x0b550,0x15657,0x052a0,0x09ad0,0x0aa50,0x0ad50,0x14d50,0x1b250,0x04b50,0x0a570,
0x054d5,0x0d260,0x0d950,0x16557,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,
0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,0x04970,0x0a4b0,0x0b4a0,
0x0ba50,0x15d57,0x056a0,0x0a5d0,0x0a950,0x09550,0x14b50,0x049b0,0x0a4a0,0x0b350,
0x0b650,0x15657,0x04ad0,0x049d0,0x0a4b0,0x0a4a0,0x0aa50,0x0b550,0x15657,0x052a0,
0x09ad0,0x0aa50,0x0ad50,0x14d50,0x1b250,0x04b50,0x0a570,0x054d5,0x0d260,0x0d950,
0x16557,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,
0x0d6a0,0x0ada2,0x095b0,0x14977,0x04970,0x0a4b0,0x0b4a0,0x0ba50,0x15d57,0x056a0,
0x0a5d0,0x09550,0x14b50,0x049b0,0x0a4a0,0x0b350,0x0b650,0x15657,0x04ad0,0x049d0,
0x0a4b0,0x0a4a0,0x0aa50,0x0b550,0x15657,0x052a0,0x09ad0,0x0aa50,0x0ad50,0x14d50,
0x1b250,0x04b50,0x0a570,0x054d5,0x0d260,0x0d950,0x16557,0x056a0,0x09ad0,0x055d2,
0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
0x04970,0x0a4b0,0x0b4a0,0x0ba50,0x15d57,0x056a0,0x0a5d0,0x0a950,0x09550,0x14b50,
0x049b0,0x0a4a0,0x0b350,0x0b650,0x15657,0x04ad0,0x049d0,0x0a4b0,0x0a4a0,0x0aa50,
0x0b550,0x15657,0x052a0,0x09ad0,0x0aa50,0x0ad50,0x14d50,0x1b250,0x04b50,0x0a570,
0x054d5,0x0d260,0x0d950,0x16557,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,
0x0d250,0x1d255
];

// ====== Lunar Conversion Functions ======
function lunarYearDays(year) {
  var i, sum = 348;
  for (i = 0x8000; i > 0x8; i >>= 1) sum += (LUNAR_INFO[year - 1900] & i) ? 1 : 0;
  return sum + leapDays(year);
}
function leapMonth(year) { return LUNAR_INFO[year - 1900] & 0xf; }
function leapDays(year) { return leapMonth(year) ? ((LUNAR_INFO[year - 1900] & 0x10000) ? 30 : 29) : 0; }
function monthDays(year, month) { return (LUNAR_INFO[year - 1900] & (0x10000 >> month)) ? 30 : 29; }

function solarToLunar(date) {
  var baseDate = new Date(1900, 0, 31);
  var offset = Math.floor((date.getTime() - baseDate.getTime()) / 86400000);
  var i, temp = 0;
  for (i = 1900; i < 2101 && offset > 0; i++) { temp = lunarYearDays(i); offset -= temp; }
  if (offset < 0) { offset += temp; i--; }
  var year = i;
  var leap = leapMonth(year);
  var isLeap = false;
  for (i = 1; i < 13 && offset > 0; i++) {
    if (leap > 0 && i === (leap + 1) && !isLeap) { --i; isLeap = true; temp = leapDays(year); }
    else { temp = monthDays(year, i); }
    if (isLeap && i === (leap + 1)) isLeap = false;
    offset -= temp;
  }
  if (offset === 0 && leap > 0 && i === leap + 1) {
    if (isLeap) { isLeap = false; } else { isLeap = true; --i; }
  }
  if (offset < 0) { offset += temp; --i; }
  return { year: year, month: i, day: offset + 1, isLeap: isLeap };
}

function getLunarDayName(day) {
  var nums = ['一','二','三','四','五','六','七','八','九','十'];
  if (day === 10) return '初十';
  if (day === 20) return '二十';
  if (day === 30) return '三十';
  if (day < 10) return '初' + nums[day - 1];
  if (day < 20) return '十' + nums[day - 11];
  if (day < 30) return '廿' + nums[day - 21];
  return '';
}

function getSolarTerm(month, day) {
  var m = month + '-' + day;
  var terms = {
    '1-5':'小寒','1-6':'小寒','1-20':'大寒','1-21':'大寒',
    '2-4':'立春','2-5':'立春','2-19':'雨水','2-20':'雨水',
    '3-5':'惊蛰','3-6':'惊蛰','3-20':'春分','3-21':'春分',
    '4-4':'清明','4-5':'清明','4-20':'谷雨','4-21':'谷雨',
    '5-5':'立夏','5-6':'立夏','5-21':'小满','5-22':'小满',
    '6-5':'芒种','6-6':'芒种','6-7':'芒种','6-21':'夏至','6-22':'夏至',
    '7-7':'小暑','7-8':'小暑','7-23':'大暑','7-24':'大暑',
    '8-7':'立秋','8-8':'立秋','8-23':'处暑','8-24':'处暑',
    '9-7':'白露','9-8':'白露','9-23':'秋分','9-24':'秋分',
    '10-8':'寒露','10-9':'寒露','10-23':'霜降','10-24':'霜降',
    '11-7':'立冬','11-8':'立冬','11-22':'小雪','11-23':'小雪',
    '12-7':'大雪','12-8':'大雪','12-22':'冬至','12-23':'冬至',
  };
  return terms[m] || '';
}

function getHolidayName(date, lunar) {
  var m = date.getMonth() + 1, d = date.getDate();
  var solarHolidays = {
    '1-1':'元旦','2-14':'情人节','3-8':'妇女节','3-12':'植树节',
    '5-1':'劳动节','5-4':'青年节','6-1':'儿童节',
    '7-1':'建党节','8-1':'建军节','9-10':'教师节',
    '10-1':'国庆节','10-2':'国庆节','10-3':'国庆节',
    '12-24':'平安夜','12-25':'圣诞节',
  };
  var s = solarHolidays[m + '-' + d];
  if (s) return s;
  var term = getSolarTerm(m, d);
  if (term) return term;
  if (lunar) {
    var lm = lunar.month, ld = lunar.day;
    var lunarHolidays = {
      '1-1':'春节','1-15':'元宵节','5-5':'端午节',
      '7-7':'七夕','8-15':'中秋节','9-9':'重阳节',
      '12-8':'腊八节','12-23':'小年','12-24':'小年',
    };
    var l = lunarHolidays[lm + '-' + ld];
    if (l) return l;
  }
  return '';
}

// ====== Date Utilities ======
function isSameDay(d1, d2) { return d1.getFullYear()===d2.getFullYear() && d1.getMonth()===d2.getMonth() && d1.getDate()===d2.getDate(); }
function isToday(date) { return isSameDay(date, new Date()); }
function formatDateDisplay(date) { return `${date.getMonth()+1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`; }
function formatDateShort(date) { return `${date.getMonth()+1}/${date.getDate()}`; }
function getWeekStart(date) { const d = new Date(date); const day = d.getDay() || 7; d.setDate(d.getDate()-day+1); d.setHours(0,0,0,0); return d; }
function getWeekEnd(date) { const d = getWeekStart(date); d.setDate(d.getDate()+6); return d; }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate()+days); return d; }
function genId() { return Date.now().toString(36) + Math.random().toString(36).substring(2,7); }
function timeToMinutes(timeStr) { const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; }

// ====== View Navigation ======
function switchView(viewName) {
  state.activeView = viewName;
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
  document.querySelectorAll('.mnav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${viewName}`));
  if (viewName === 'daily') renderDaily();
  else if (viewName === 'weekly') renderWeekly();
  else if (viewName === 'monthly') renderMonthly();
  else if (viewName === 'bills') renderBills();
  else if (viewName === 'savings') renderSavings();
  else if (viewName === 'review') renderReview();
  else if (viewName === 'health') renderHealth();
  else if (viewName === 'reviews') renderReviewsView();
  else if (viewName === 'calendar') renderCalendarView();
}

// ====== Toast ======
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ====== Daily View ======
function renderDaily() {
  const dateKey = getDateKey(state.selectedDate);
  const dayData = getDayData(dateKey);
  document.getElementById('daily-date-label').textContent = isToday(state.selectedDate) ? '今天' : formatDateDisplay(state.selectedDate);
  document.getElementById('daily-date-display').textContent = formatDateShort(state.selectedDate);
  const allTasks = [...dayData.timeline, ...dayData.todos];
  const completed = allTasks.filter(t => t.completed).length;
  const total = allTasks.length;
  const rate = total > 0 ? Math.round((completed/total)*100) : 0;
  const expTotal = dayData.expenses.reduce((s,e) => s+e.amount, 0);
  document.getElementById('daily-completed').textContent = completed;
  document.getElementById('daily-pending').textContent = total - completed;
  document.getElementById('daily-completion-rate').textContent = rate + '%';
  document.getElementById('daily-expense-total').textContent = '¥' + expTotal.toFixed(2);
  updateMiniStats(rate, expTotal);
  renderPlanner(dayData.timeline);
  renderTodoList(dayData.todos);
  renderExpenses(dayData.expenses);
}

function updateMiniStats(rate, expTotal) {
  document.getElementById('mini-completion').textContent = rate + '%';
  document.getElementById('mini-expense').textContent = '¥' + expTotal.toFixed(0);
  const circ = 2 * Math.PI * 18;
  document.getElementById('mini-ring-fg').style.strokeDashoffset = circ - (rate/100)*circ;
}

// ====== Planner Timeline ======
function renderPlanner(timeline) {
  const axis = document.getElementById('planner-axis');
  let axisHtml = '';
  for (let h = PLANNER_START_HOUR; h < PLANNER_END_HOUR; h++) {
    axisHtml += `<div class="axis-hour">${String(h).padStart(2,'0')}:00</div>`;
  }
  axis.innerHTML = axisHtml;
  const container = document.getElementById('planner-tasks');
  const totalHeight = (PLANNER_END_HOUR - PLANNER_START_HOUR) * HOUR_HEIGHT;
  container.style.minHeight = totalHeight + 'px';
  if (timeline.length === 0) {
    container.innerHTML = '<div class="planner-empty"><p>在上方输入开始/结束时间和任务<br>时间轴上会自动显示</p></div>';
    return;
  }
  const sorted = [...timeline].sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  let lastColorIdx = -1;
  sorted.forEach((task, i) => {
    let colorIdx = i % MORANDI_COLORS.length;
    if (colorIdx === lastColorIdx) colorIdx = (colorIdx + 1) % MORANDI_COLORS.length;
    task._colorIdx = colorIdx;
    lastColorIdx = colorIdx;
  });
  let html = '';
  if (isToday(state.selectedDate)) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin >= PLANNER_START_HOUR * 60 && nowMin <= PLANNER_END_HOUR * 60) {
      const top = ((nowMin - PLANNER_START_HOUR * 60) / 60) * HOUR_HEIGHT;
      html += `<div class="planner-now-line" style="top:${top}px"></div>`;
    }
  }
  sorted.forEach(task => {
    const startMin = timeToMinutes(task.startTime);
    const endMin = timeToMinutes(task.endTime);
    const top = ((startMin - PLANNER_START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = Math.max(20, ((endMin - startMin) / 60) * HOUR_HEIGHT - 4);
    const color = MORANDI_COLORS[task._colorIdx];
    const icon = TL_CAT_ICONS[task.category] || '';
    html += `
      <div class="planner-task-block ${task.completed ? 'done' : ''}" data-id="${task.id}"
           style="top:${top}px;height:${height}px;background:${color};border-left-color:${color}">
        <div class="ptb-time">${task.startTime} - ${task.endTime}</div>
        <div class="ptb-title">${icon} ${escapeHtml(task.title)}</div>
        <div class="ptb-actions">
          <button class="ptb-btn tl-check" data-id="${task.id}" title="完成/取消">${task.completed ? '↩' : '✓'}</button>
          <button class="ptb-btn tl-del" data-id="${task.id}" title="删除">✕</button>
        </div>
      </div>`;
  });
  container.innerHTML = html;
  container.querySelectorAll('.tl-check').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); toggleTimeline(btn.dataset.id); }));
  container.querySelectorAll('.tl-del').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); deleteTimeline(btn.dataset.id); }));
}
function addTimelineItem(startTime, endTime, title, category) {
  const dateKey = getDateKey(state.selectedDate);
  const dayData = getDayData(dateKey);
  dayData.timeline.push({ id: genId(), startTime, endTime, title, category, completed: false });
  saveDayData(dateKey, dayData);
  renderDaily();
  showToast('已添加到时间轴');
}
function toggleTimeline(id) { const dk = getDateKey(state.selectedDate); const dd = getDayData(dk); const t = dd.timeline.find(t => t.id === id); if (t) { t.completed = !t.completed; saveDayData(dk, dd); renderDaily(); } }
function deleteTimeline(id) { const dk = getDateKey(state.selectedDate); const dd = getDayData(dk); dd.timeline = dd.timeline.filter(t => t.id !== id); saveDayData(dk, dd); renderDaily(); }

// ====== Todo List (with priority coloring + sort) ======
function renderTodoList(todos) {
  const container = document.getElementById('todo-list');
  const empty = document.getElementById('todo-empty');
  if (todos.length === 0) { container.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  // Sort: incomplete first, then by priority high > medium > low
  const order = { high: 0, medium: 1, low: 2 };
  todos.sort((a,b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (order[a.priority]||1) - (order[b.priority]||1);
  });
  container.innerHTML = todos.map(t => `
    <div class="todo-item priority-${t.priority}" data-id="${t.id}">
      <div class="todo-checkbox ${t.completed?'checked':''}" data-id="${t.id}">✓</div>
      <span class="todo-text ${t.completed?'done':''}">${escapeHtml(t.text)}</span>
      <span class="todo-priority ${t.priority}">${t.priority==='high'?'高':t.priority==='low'?'低':'中'}</span>
      <button class="todo-delete" data-id="${t.id}">✕</button>
    </div>`).join('');
  container.querySelectorAll('.todo-checkbox').forEach(b => b.addEventListener('click', () => toggleTodo(b.dataset.id)));
  container.querySelectorAll('.todo-delete').forEach(b => b.addEventListener('click', () => deleteTodo(b.dataset.id)));
}
function addTodo(text, priority) {
  const dk = getDateKey(state.selectedDate);
  const dd = getDayData(dk);
  dd.todos.push({ id: genId(), text, priority, completed: false });
  saveDayData(dk, dd);
  renderDaily();
}
function toggleTodo(id) { const dk = getDateKey(state.selectedDate); const dd = getDayData(dk); const t = dd.todos.find(t=>t.id===id); if(t){t.completed=!t.completed; saveDayData(dk,dd); renderDaily();} }
function deleteTodo(id) { const dk = getDateKey(state.selectedDate); const dd = getDayData(dk); dd.todos = dd.todos.filter(t=>t.id!==id); saveDayData(dk,dd); renderDaily(); }

// ====== Expense (two-level categories) ======
function populateExpenseCategoryDropdowns() {
  const cats = getCategories();
  const mainSel = document.getElementById('exp-main-cat');
  const subSel = document.getElementById('exp-sub-cat');
  mainSel.innerHTML = cats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  // Add "add new" option
  mainSel.innerHTML += `<option value="__add_new__">+ 添加新大项...</option>`;
  updateSubCatDropdown();
  mainSel.onchange = () => {
    if (mainSel.value === '__add_new__') {
      mainSel.selectedIndex = 0;
      openCatModal('main');
    } else {
      updateSubCatDropdown();
    }
  };
}
function updateSubCatDropdown() {
  const cats = getCategories();
  const mainId = document.getElementById('exp-main-cat').value;
  const cat = cats.find(c => c.id === mainId);
  const subSel = document.getElementById('exp-sub-cat');
  if (cat && cat.subcategories.length > 0) {
    subSel.innerHTML = cat.subcategories.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    subSel.innerHTML += `<option value="__add_new__">+ 添加小项...</option>`;
    subSel.disabled = false;
    subSel.onchange = () => {
      if (subSel.value === '__add_new__') {
        const prevVal = subSel.selectedIndex > 0 ? subSel.options[subSel.selectedIndex - 1].value : '';
        subSel.selectedIndex = 0;
        openCatModal('sub', mainId);
      }
    };
  } else {
    subSel.innerHTML = '<option value="">无小项</option>';
    subSel.innerHTML += `<option value="__add_new__">+ 添加小项...</option>`;
    subSel.disabled = false;
    subSel.onchange = () => {
      if (subSel.value === '__add_new__') {
        subSel.selectedIndex = 0;
        openCatModal('sub', mainId);
      }
    };
  }
}
function renderExpenses(expenses) {
  const container = document.getElementById('expense-list');
  const empty = document.getElementById('expense-empty');
  if (expenses.length === 0) { container.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  const cats = getCategories();
  expenses.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  container.innerHTML = expenses.map(e => {
    const cat = cats.find(c => c.id === e.mainCat) || { icon: '📦', name: '其他' };
    const subName = getSubCatName(e.mainCat, e.subCat);
    const noteDisplay = e.note ? escapeHtml(e.note) : (subName || cat.name);
    const catText = subName ? `${cat.name} · ${subName}` : cat.name;
    return `
      <div class="expense-item" data-id="${e.id}">
        <span class="expense-cat-icon">${cat.icon}</span>
        <div class="expense-info">
          <div class="expense-note-text">${noteDisplay}</div>
          <div class="expense-cat-text">${catText} · ${e.time || ''}</div>
        </div>
        <span class="expense-amount-text">¥${e.amount.toFixed(2)}</span>
        <button class="expense-delete" data-id="${e.id}">✕</button>
      </div>`;
  }).join('');
  container.querySelectorAll('.expense-delete').forEach(b => b.addEventListener('click', () => deleteExpense(b.dataset.id)));
}
function addExpense(amount, mainCat, subCat, note) {
  const dk = getDateKey(state.selectedDate);
  const dd = getDayData(dk);
  const now = new Date();
  dd.expenses.push({ id: genId(), amount: parseFloat(amount), mainCat, subCat: subCat || '', note, time: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`, createdAt: Date.now() });
  saveDayData(dk, dd);
  renderDaily();
  showToast('已记录开支');
}
function deleteExpense(id) { const dk = getDateKey(state.selectedDate); const dd = getDayData(dk); dd.expenses = dd.expenses.filter(e=>e.id!==id); saveDayData(dk,dd); renderDaily(); }

// ====== Income ======
function populateIncomeCategoryDropdown() {
  const cats = getIncomeCategories();
  const sel = document.getElementById('inc-cat');
  sel.innerHTML = cats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  sel.innerHTML += `<option value="__add_new__">+ 添加收入类型...</option>`;
  sel.onchange = () => {
    if (sel.value === '__add_new__') {
      sel.selectedIndex = 0;
      state.catModalType = 'income';
      openCatModal('main');
      // Override modal behavior for income
      document.getElementById('cat-modal-title').textContent = '添加收入类型';
      document.getElementById('cat-modal-label').textContent = '收入类型名称';
    }
  };
}
function addIncomeRecord(amount, catId, note) {
  const dk = getDateKey(state.selectedBillMonth);
  const dd = getDayData(dk);
  if (!dd.income) dd.income = [];
  const now = new Date();
  dd.income.push({ id: genId(), amount: parseFloat(amount), catId, note, time: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`, createdAt: Date.now() });
  saveDayData(dk, dd);
  showToast('已记录收入');
  renderBills();
}
function deleteIncomeRecord(id, dateKey) {
  const dd = getDayData(dateKey);
  if (dd.income) {
    dd.income = dd.income.filter(i => i.id !== id);
    saveDayData(dateKey, dd);
    renderBills();
  }
}
function getMonthIncome(year, month) {
  const data = loadData();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const all = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dk = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (data[dk] && data[dk].income) {
      data[dk].income.forEach(i => all.push({ ...i, date: dk }));
    }
  }
  return all;
}

// ====== Get All Expenses for a Month ======
function getMonthExpenses(year, month) {
  const data = loadData();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const all = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dk = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (data[dk] && data[dk].expenses) {
      data[dk].expenses.forEach(e => all.push({ ...e, date: dk }));
    }
  }
  return all;
}

// ====== Bills View ======
function renderBills() {
  const ref = state.selectedBillMonth;
  const year = ref.getFullYear();
  const month = ref.getMonth();
  document.getElementById('bills-label').textContent = `${year}年${month+1}月`;

  const expenses = getMonthExpenses(year, month);
  const incomes = getMonthIncome(year, month);
  const expTotal = expenses.reduce((s,e) => s+e.amount, 0);
  const incTotal = incomes.reduce((s,i) => s+i.amount, 0);
  const surplus = incTotal - expTotal;

  document.getElementById('bills-total').textContent = '¥' + expTotal.toFixed(2);
  document.getElementById('bills-income').textContent = '¥' + incTotal.toFixed(2);
  document.getElementById('bills-surplus').textContent = '¥' + surplus.toFixed(2);
  document.getElementById('bills-surplus').style.color = surplus >= 0 ? '' : '#ef4444';
  document.getElementById('bills-count').textContent = expenses.length + incomes.length;

  // Tab switching
  const expensePanel = document.getElementById('expense-panel');
  const incomeCard = document.getElementById('income-input-card');
  if (state.activeBillTab === 'expense') {
    expensePanel.style.display = 'block';
    incomeCard.style.display = 'none';
  } else {
    expensePanel.style.display = 'none';
    incomeCard.style.display = 'block';
    populateIncomeCategoryDropdown();
    renderIncomeList(incomes);
  }

  // Only render expense charts if expense tab
  if (state.activeBillTab === 'expense') {
    renderBillsExpense(expenses, expTotal);
  }
}

function renderIncomeList(incomes) {
  const container = document.getElementById('income-list');
  const empty = document.getElementById('income-empty');
  if (incomes.length === 0) { container.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  const cats = getIncomeCategories();
  incomes.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  container.innerHTML = incomes.map(i => {
    const cat = cats.find(c => c.id === i.catId) || { icon: '📦', name: '其他' };
    const noteDisplay = i.note ? escapeHtml(i.note) : cat.name;
    return `
      <div class="income-item" data-id="${i.id}" data-date="${i.date}">
        <span class="income-cat-icon">${cat.icon}</span>
        <div class="income-info">
          <div class="income-note-text">${noteDisplay}</div>
          <div class="income-cat-text">${cat.name} · ${i.date}</div>
        </div>
        <span class="income-amount-text">+¥${i.amount.toFixed(2)}</span>
        <button class="expense-delete inc-del" data-id="${i.id}" data-date="${i.date}">✕</button>
      </div>`;
  }).join('');
  container.querySelectorAll('.inc-del').forEach(b => b.addEventListener('click', () => deleteIncomeRecord(b.dataset.id, b.dataset.date)));
}

function renderBillsExpense(expenses, total) {
  const cats = getCategories();
  const usedCats = new Set(expenses.map(e => e.mainCat));
  const catTotals = {};
  expenses.forEach(e => { catTotals[e.mainCat] = (catTotals[e.mainCat] || 0) + e.amount; });
  const mainLabels = [], mainData = [], mainColors = [];
  cats.forEach(c => {
    if (catTotals[c.id]) { mainLabels.push(c.name); mainData.push(catTotals[c.id]); mainColors.push(c.color); }
  });
  renderPieChart('bills-main-pie', mainLabels, mainData, mainColors, total);

  const listEl = document.getElementById('bill-cat-list');
  const empty = document.getElementById('bill-empty');
  if (expenses.length === 0) {
    listEl.innerHTML = '';
    empty.style.display = 'block';
    document.getElementById('bill-sub-detail-card').style.display = 'none';
  } else {
    empty.style.display = 'none';
    listEl.innerHTML = cats.filter(c => catTotals[c.id]).map(c => {
      const amt = catTotals[c.id];
      const pct = total > 0 ? (amt/total*100) : 0;
      return `
        <div class="bill-cat-row ${state.selectedBillCat === c.id ? 'active' : ''}" data-cat="${c.id}">
          <div class="bill-cat-icon" style="background:${c.color}22">${c.icon}</div>
          <div class="bill-cat-info">
            <div class="bill-cat-name">${c.name}</div>
            <div class="bill-cat-bar"><div class="bill-cat-bar-fill" style="width:${pct}%;background:${c.color}"></div></div>
          </div>
          <div style="text-align:right">
            <div class="bill-cat-amount">¥${amt.toFixed(2)}</div>
            <div class="bill-cat-percent">${pct.toFixed(1)}%</div>
          </div>
        </div>`;
    }).join('');
    listEl.querySelectorAll('.bill-cat-row').forEach(row => {
      row.addEventListener('click', () => { state.selectedBillCat = row.dataset.cat; renderBills(); });
    });
    if (!state.selectedBillCat || !catTotals[state.selectedBillCat]) {
      state.selectedBillCat = cats.find(c => catTotals[c.id])?.id || null;
    }
    renderBillSubDetail(expenses, total);
  }

  if (state.selectedBillCat && catTotals[state.selectedBillCat]) {
    const selCat = cats.find(c => c.id === state.selectedBillCat);
    document.getElementById('bills-sub-title').textContent = `小项占比 - ${selCat.name}`;
    const subExpenses = expenses.filter(e => e.mainCat === state.selectedBillCat);
    const subTotals = {};
    subExpenses.forEach(e => {
      const key = e.subCat || '_none';
      subTotals[key] = (subTotals[key] || 0) + e.amount;
    });
    const subLabels = [], subData = [], subColors = [];
    let colorI = 0;
    Object.keys(subTotals).forEach(key => {
      if (key === '_none') subLabels.push('未分类');
      else subLabels.push(getSubCatName(state.selectedBillCat, key) || '其他');
      subData.push(subTotals[key]);
      subColors.push(BRIGHT_COLORS[colorI % BRIGHT_COLORS.length]);
      colorI++;
    });
    const subTotal = subExpenses.reduce((s,e)=>s+e.amount, 0);
    renderPieChart('bills-sub-pie', subLabels, subData, subColors, subTotal);
  } else {
    renderPieChart('bills-sub-pie', ['暂无数据'], [1], ['#e2e8f0'], 1);
  }
}

function renderBillSubDetail(expenses, monthTotal) {
  const card = document.getElementById('bill-sub-detail-card');
  if (!state.selectedBillCat) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  const cats = getCategories();
  const cat = cats.find(c => c.id === state.selectedBillCat);
  if (!cat) { card.style.display = 'none'; return; }
  document.getElementById('bill-sub-detail-title').textContent = `${cat.icon} ${cat.name} - 小项明细`;
  const subExpenses = expenses.filter(e => e.mainCat === state.selectedBillCat);
  const catTotal = subExpenses.reduce((s,e) => s+e.amount, 0);
  const subGroups = {};
  subExpenses.forEach(e => {
    const key = e.subCat || '_none';
    if (!subGroups[key]) subGroups[key] = { items: [], total: 0 };
    subGroups[key].items.push(e);
    subGroups[key].total += e.amount;
  });
  let colorI = 0;
  const listEl = document.getElementById('bill-sub-list');
  let html = '';
  Object.keys(subGroups).forEach(key => {
    const grp = subGroups[key];
    const name = key === '_none' ? '未分类' : (getSubCatName(state.selectedBillCat, key) || '其他');
    const pct = catTotal > 0 ? (grp.total / catTotal * 100) : 0;
    const dotColor = BRIGHT_COLORS[colorI % BRIGHT_COLORS.length];
    colorI++;
    grp.items.forEach((item, i) => {
      html += `
        <div class="bill-sub-row">
          <span class="bill-sub-dot" style="background:${dotColor}"></span>
          <div class="bill-sub-name">${name}${grp.items.length > 1 ? ` #${i+1}` : ''}</div>
          ${item.note ? `<span class="bill-sub-note">"${escapeHtml(item.note)}"</span>` : ''}
          <span class="bill-sub-amount">¥${item.amount.toFixed(2)}</span>
          <span class="bill-sub-percent">${pct.toFixed(0)}%</span>
        </div>`;
    });
  });
  listEl.innerHTML = html;
}

function renderPieChart(canvasId, labels, data, colors, total) {
  const ctx = document.getElementById(canvasId);
  if (state.charts[canvasId]) state.charts[canvasId].destroy();
  if (data.length === 0 || (data.length === 1 && data[0] === 1 && labels[0] === '暂无数据')) {
    state.charts[canvasId] = new Chart(ctx, {
      type: 'doughnut', data: { labels: ['暂无数据'], datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 12 } } } } }
    });
    return;
  }
  state.charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 12, usePointStyle: true } },
        tooltip: { callbacks: { label: (c) => {
          const pct = total > 0 ? (c.parsed/total*100).toFixed(1) : 0;
          return `${c.label}: ¥${c.parsed.toFixed(2)} (${pct}%)`;
        }}}
      }
    }
  });
}

// ====== Savings/Assets View ======
function renderSavings() {
  const sd = getSavingsData();
  const total = sd.transactions.reduce((s,t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
  const pouchTotal = (sd.pouch || []).reduce((s,t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  // Calculate monthly income from bills data
  const monthIncome = getMonthIncome(now.getFullYear(), now.getMonth());
  const monthInTotal = monthIncome.reduce((s,i) => s+i.amount, 0);
  const monthExpenses = getMonthExpenses(now.getFullYear(), now.getMonth());
  const monthExpTotal = monthExpenses.reduce((s,e) => s+e.amount, 0);
  const monthSurplus = monthInTotal - monthExpTotal;

  // Also count manual savings transactions
  const savMonthIn = sd.transactions.filter(t => t.type === 'in' && t.date.startsWith(monthPrefix)).reduce((s,t) => s+t.amount, 0);
  const savMonthOut = sd.transactions.filter(t => t.type === 'out' && t.date.startsWith(monthPrefix)).reduce((s,t) => s+t.amount, 0);

  document.getElementById('savings-total').textContent = '¥' + (total + pouchTotal).toFixed(2);
  document.getElementById('savings-month-in').textContent = '¥' + savMonthIn.toFixed(2);
  document.getElementById('savings-month-out').textContent = '¥' + savMonthOut.toFixed(2);
  document.getElementById('savings-month-surplus').textContent = '¥' + monthSurplus.toFixed(2);
  document.getElementById('savings-month-surplus').style.color = monthSurplus >= 0 ? '#86efac' : '#fca5a5';
  document.getElementById('pouch-total').textContent = '¥' + pouchTotal.toFixed(2);

  const goalTotal = sd.goals.reduce((s,g) => s+g.target, 0);
  // Goals
  const goalList = document.getElementById('savings-goal-list');
  const goalEmpty = document.getElementById('savings-goal-empty');
  if (sd.goals.length === 0) {
    goalList.innerHTML = '';
    goalEmpty.style.display = 'block';
  } else {
    goalEmpty.style.display = 'none';
    const totalAssets = total + pouchTotal;
    goalList.innerHTML = sd.goals.map(g => {
      const pct = g.target > 0 ? Math.min(100, (totalAssets / g.target * 100)) : 0;
      return `
        <div class="savings-goal-item" data-id="${g.id}">
          <div class="savings-goal-header">
            <span class="savings-goal-name">${escapeHtml(g.name)}</span>
            <span class="savings-goal-amounts"><strong>¥${totalAssets.toFixed(2)}</strong> / ¥${g.target.toFixed(2)}</span>
          </div>
          <div class="savings-goal-progress"><div class="savings-goal-fill" style="width:${pct}%"></div></div>
          <div class="savings-goal-percent">${pct.toFixed(1)}% ${pct >= 100 ? '🎉 已达成！' : ''}</div>
          <div class="savings-goal-actions">
            <button class="btn-sm goal-deposit" data-id="${g.id}" data-amount="${Math.max(0, g.target - totalAssets)}">存入差额</button>
            <button class="btn-sm goal-delete" data-id="${g.id}">删除</button>
          </div>
        </div>`;
    }).join('');
    goalList.querySelectorAll('.goal-delete').forEach(b => b.addEventListener('click', () => deleteSavingsGoal(b.dataset.id)));
    goalList.querySelectorAll('.goal-deposit').forEach(b => b.addEventListener('click', () => {
      const amt = parseFloat(b.dataset.amount);
      if (amt > 0) { addSavingsTx('存入差额 - 目标', amt, 'in'); renderSavings(); }
    }));
  }

  // Pouch
  renderPouch(sd.pouch || []);

  // Charts: monthly income + expense trends
  renderAssetIncomeChart();
  renderAssetExpenseChart();
  renderSavingsTrend(sd.transactions, sd.pouch || []);
}

function renderPouch(pouchTx) {
  const total = pouchTx.reduce((s,t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
  document.getElementById('pouch-balance-display').textContent = '¥' + total.toFixed(2);
  const listEl = document.getElementById('pouch-tx-list');
  const empty = document.getElementById('pouch-empty');
  if (pouchTx.length === 0) {
    listEl.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  const sorted = [...pouchTx].sort((a,b) => b.createdAt - a.createdAt);
  listEl.innerHTML = sorted.map(t => `
    <div class="pouch-tx-item">
      <div class="pouch-tx-icon ${t.type}">${t.type === 'in' ? '↓' : '↑'}</div>
      <div class="pouch-tx-info">
        <div class="pouch-tx-label">${escapeHtml(t.label || (t.type === 'in' ? '存入' : '取出'))}</div>
        <div class="pouch-tx-date">${t.date}</div>
      </div>
      <span class="pouch-tx-amount ${t.type}">${t.type === 'in' ? '+' : '-'}¥${t.amount.toFixed(2)}</span>
      <button class="expense-delete pouch-del" data-id="${t.id}" style="opacity:0.5">✕</button>
    </div>`).join('');
  listEl.querySelectorAll('.pouch-del').forEach(b => b.addEventListener('click', () => deletePouchTx(b.dataset.id)));
}

function addSavingsTx(label, amount, type) {
  const sd = getSavingsData();
  const now = new Date();
  sd.transactions.push({ id: genId(), label, amount: parseFloat(amount), type, date: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`, createdAt: Date.now() });
  saveSavingsData(sd);
}
function deleteSavingsTx(id) { const sd = getSavingsData(); sd.transactions = sd.transactions.filter(t => t.id !== id); saveSavingsData(sd); renderSavings(); }
function addSavingsGoal(name, target) { const sd = getSavingsData(); sd.goals.push({ id: genId(), name, target: parseFloat(target) }); saveSavingsData(sd); }
function deleteSavingsGoal(id) { const sd = getSavingsData(); sd.goals = sd.goals.filter(g => g.id !== id); saveSavingsData(sd); renderSavings(); }

function addPouchTx(label, amount, type) {
  const sd = getSavingsData();
  if (!sd.pouch) sd.pouch = [];
  const now = new Date();
  sd.pouch.push({ id: genId(), label, amount: parseFloat(amount), type, date: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`, createdAt: Date.now() });
  saveSavingsData(sd);
}
function deletePouchTx(id) { const sd = getSavingsData(); sd.pouch = (sd.pouch||[]).filter(t => t.id !== id); saveSavingsData(sd); renderSavings(); }

function renderAssetIncomeChart() {
  const ctx = document.getElementById('asset-income-chart');
  if (state.charts.assetIncome) state.charts.assetIncome.destroy();
  const now = new Date();
  const labels = [], data = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const inc = getMonthIncome(d.getFullYear(), d.getMonth());
    labels.push(`${d.getMonth()+1}月`);
    data.push(inc.reduce((s,i) => s+i.amount, 0));
  }
  state.charts.assetIncome = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: '月度收入', data, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.15)', fill: true, tension: 0.3, pointRadius: 5, pointBackgroundColor: '#22c55e' }] },
    options: chartBaseOptions({ yPrefix: '¥' })
  });
}

function renderAssetExpenseChart() {
  const ctx = document.getElementById('asset-expense-chart');
  if (state.charts.assetExpense) state.charts.assetExpense.destroy();
  const now = new Date();
  const labels = [], data = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const exp = getMonthExpenses(d.getFullYear(), d.getMonth());
    labels.push(`${d.getMonth()+1}月`);
    data.push(exp.reduce((s,e) => s+e.amount, 0));
  }
  state.charts.assetExpense = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: '月度消费', data, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.15)', fill: true, tension: 0.3, pointRadius: 5, pointBackgroundColor: '#ef4444' }] },
    options: chartBaseOptions({ yPrefix: '¥' })
  });
}

function renderSavingsTrend(transactions, pouch) {
  const ctx = document.getElementById('savings-trend-chart');
  if (state.charts.savingsTrend) state.charts.savingsTrend.destroy();
  const labels = [], data = [];
  const now = new Date();
  let runningTotal = 0;
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const sixMonthsAgoStr = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth()+1).padStart(2,'0')}`;
  const allTx = [...transactions, ...(pouch || [])];
  allTx.forEach(t => {
    if (t.date < sixMonthsAgoStr) runningTotal += t.type === 'in' ? t.amount : -t.amount;
  });
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    labels.push(`${d.getMonth()+1}月`);
    allTx.forEach(t => {
      if (t.date.startsWith(prefix)) runningTotal += t.type === 'in' ? t.amount : -t.amount;
    });
    data.push(runningTotal);
  }
  state.charts.savingsTrend = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: '资产余额', data, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.15)', fill: true, tension: 0.3, pointRadius: 5, pointBackgroundColor: '#6366f1' }] },
    options: chartBaseOptions({ yPrefix: '¥' })
  });
}

// ====== Weekly View ======
function renderWeekly() {
  const ws = getWeekStart(state.selectedWeekRef);
  const we = getWeekEnd(state.selectedWeekRef);
  document.getElementById('weekly-range-label').textContent = `${ws.getMonth()+1}月${ws.getDate()}日 - ${we.getMonth()+1}月${we.getDate()}日`;
  let totalT=0, doneT=0, totalE=0;
  const dayStats = [];
  for (let i=0; i<7; i++) {
    const date = addDays(ws, i);
    const dd = getDayData(getDateKey(date));
    const all = [...dd.timeline, ...dd.todos];
    const done = all.filter(t=>t.completed).length;
    totalT += all.length; doneT += done;
    totalE += dd.expenses.reduce((s,e)=>s+e.amount, 0);
    dayStats.push({ date, total: all.length, done });
  }
  document.getElementById('weekly-completion').textContent = (totalT>0?Math.round(doneT/totalT*100):0) + '%';
  document.getElementById('weekly-tasks').textContent = totalT;
  document.getElementById('weekly-expense').textContent = '¥' + totalE.toFixed(2);
  renderWeekGoals(getWeekKey(state.selectedWeekRef));
  renderWeekGrid(dayStats, ws);
  renderWeeklyChart(dayStats);
}
function renderWeekGoals(weekKey) {
  const goals = getWeekGoals(weekKey);
  const c = document.getElementById('weekly-goal-list');
  const e = document.getElementById('weekly-goal-empty');
  if (goals.length===0) { c.innerHTML=''; e.style.display='block'; return; }
  e.style.display='none';
  c.innerHTML = goals.map(g=>`<div class="goal-item"><div class="goal-checkbox ${g.completed?'checked':''}" data-id="${g.id}">✓</div><span class="goal-text ${g.completed?'done':''}">${escapeHtml(g.text)}</span><button class="goal-delete" data-id="${g.id}">✕</button></div>`).join('');
  c.querySelectorAll('.goal-checkbox').forEach(b=>b.addEventListener('click',()=>{const gs=getWeekGoals(weekKey);const g=gs.find(g=>g.id===b.dataset.id);if(g){g.completed=!g.completed;saveWeekGoals(weekKey,gs);renderWeekGoals(weekKey);}}));
  c.querySelectorAll('.goal-delete').forEach(b=>b.addEventListener('click',()=>{let gs=getWeekGoals(weekKey);gs=gs.filter(g=>g.id!==b.dataset.id);saveWeekGoals(weekKey,gs);renderWeekGoals(weekKey);}));
}
function renderWeekGrid(dayStats, ws) {
  const c = document.getElementById('week-grid');
  c.innerHTML = dayStats.map(s => {
    const r = s.total>0?Math.round(s.done/s.total*100):0;
    return `<div class="week-day ${isSameDay(s.date,new Date())?'today':''}" data-date="${getDateKey(s.date)}"><div class="week-day-name">${WEEKDAYS_SHORT[s.date.getDay()]}</div><div class="week-day-date">${s.date.getDate()}</div><div class="week-day-tasks">${s.done}/${s.total}</div><div class="week-day-completion"><div class="week-day-completion-fill" style="width:${r}%"></div></div></div>`;
  }).join('');
  c.querySelectorAll('.week-day').forEach(el => el.addEventListener('click', () => { const p=el.dataset.date.split('-'); state.selectedDate=new Date(p[0],p[1]-1,p[2]); switchView('daily'); }));
}
function renderWeeklyChart(dayStats) {
  const ctx = document.getElementById('weekly-chart');
  if (state.charts.weekly) state.charts.weekly.destroy();
  state.charts.weekly = new Chart(ctx, { type:'bar', data:{ labels:dayStats.map(s=>`${s.date.getMonth()+1}/${s.date.getDate()}`), datasets:[{label:'已完成',data:dayStats.map(s=>s.done),backgroundColor:'#22c55e',borderRadius:6},{label:'总任务',data:dayStats.map(s=>s.total),backgroundColor:'#e2e8f0',borderRadius:6}] }, options: chartBaseOptions({ yStepSize: 1 }) });
}

// ====== Monthly View ======
function renderMonthly() {
  const ref = state.selectedMonthRef;
  const y = ref.getFullYear(), m = ref.getMonth();
  document.getElementById('monthly-label').textContent = `${y}年${m+1}月`;
  const dim = new Date(y, m+1, 0).getDate();
  let tT=0, dT=0, tE=0, rD=0;
  const daily = [];
  for (let d=1; d<=dim; d++) {
    const date=new Date(y,m,d); const dd=getDayData(getDateKey(date));
    const all=[...dd.timeline,...dd.todos]; const done=all.filter(t=>t.completed).length;
    const exp=dd.expenses.reduce((s,e)=>s+e.amount,0);
    if (all.length>0||dd.expenses.length>0||dd.review) rD++;
    tT+=all.length; dT+=done; tE+=exp;
    daily.push({date,total:all.length,done,expense:exp});
  }
  document.getElementById('monthly-completion').textContent = (tT>0?Math.round(dT/tT*100):0)+'%';
  document.getElementById('monthly-expense').textContent = '¥'+tE.toFixed(2);
  document.getElementById('monthly-days').textContent = rD;
  renderCalendar(y, m, daily);
  renderMonthGoals(getMonthKey(ref));
  renderMonthlyCompletionChart(daily);
  renderMonthlyExpenseChart(y, m);
}
function renderCalendar(y, m, daily) {
  const c = document.getElementById('calendar');
  const fd = new Date(y, m, 1).getDay();
  const dim = new Date(y, m+1, 0).getDate();
  let html = '';
  WEEKDAYS_SHORT.forEach(d => html += `<div class="calendar-header">${d}</div>`);
  for (let i=0; i<fd; i++) html += '<div class="calendar-day empty"></div>';
  for (let d=1; d<=dim; d++) {
    const date = new Date(y,m,d);
    const dd = daily[d-1];
    const has = dd && (dd.total>0||dd.expense>0);
    html += `<div class="calendar-day ${isSameDay(date,new Date())?'today':''} ${has?'has-data':''}" data-date="${getDateKey(date)}"><span class="calendar-day-num">${d}</span>${has?'<span class="calendar-day-dot"></span>':''}</div>`;
  }
  c.innerHTML = html;
  c.querySelectorAll('.calendar-day:not(.empty)').forEach(el => el.addEventListener('click', () => { const p=el.dataset.date.split('-'); state.selectedDate=new Date(p[0],p[1]-1,p[2]); switchView('daily'); }));
}
function renderMonthGoals(mk) {
  const goals = getMonthGoals(mk);
  const c = document.getElementById('monthly-goal-list');
  const e = document.getElementById('monthly-goal-empty');
  if (goals.length===0) { c.innerHTML=''; e.style.display='block'; return; }
  e.style.display='none';
  c.innerHTML = goals.map(g=>`<div class="goal-item"><div class="goal-checkbox ${g.completed?'checked':''}" data-id="${g.id}">✓</div><span class="goal-text ${g.completed?'done':''}">${escapeHtml(g.text)}</span><button class="goal-delete" data-id="${g.id}">✕</button></div>`).join('');
  c.querySelectorAll('.goal-checkbox').forEach(b=>b.addEventListener('click',()=>{const gs=getMonthGoals(mk);const g=gs.find(g=>g.id===b.dataset.id);if(g){g.completed=!g.completed;saveMonthGoals(mk,gs);renderMonthGoals(mk);}}));
  c.querySelectorAll('.goal-delete').forEach(b=>b.addEventListener('click',()=>{let gs=getMonthGoals(mk);gs=gs.filter(g=>g.id!==b.dataset.id);saveMonthGoals(mk,gs);renderMonthGoals(mk);}));
}
function renderMonthlyCompletionChart(daily) {
  const ctx = document.getElementById('monthly-completion-chart');
  if (state.charts.mc) state.charts.mc.destroy();
  state.charts.mc = new Chart(ctx, { type:'line', data:{ labels:daily.map(d=>d.date.getDate()), datasets:[{label:'完成率',data:daily.map(d=>d.total>0?Math.round(d.done/d.total*100):0),borderColor:'#6366f1',backgroundColor:'rgba(99,102,241,0.1)',fill:true,tension:0.3,pointRadius:3,pointBackgroundColor:'#6366f1'}]}, options: chartBaseOptions({ yMax:100, ySuffix:'%' }) });
}
function renderMonthlyExpenseChart(y, m) {
  const ctx = document.getElementById('monthly-expense-chart');
  if (state.charts.me) state.charts.me.destroy();
  const expenses = getMonthExpenses(y, m);
  const cats = getCategories();
  const catTotals = {};
  expenses.forEach(e => { catTotals[e.mainCat] = (catTotals[e.mainCat]||0) + e.amount; });
  const labels=[],data=[],colors=[];
  cats.forEach(c => { if (catTotals[c.id]) { labels.push(c.name); data.push(catTotals[c.id]); colors.push(c.color); } });
  if (data.length===0) { state.charts.me = new Chart(ctx,{type:'doughnut',data:{labels:['暂无数据'],datasets:[{data:[1],backgroundColor:['#e2e8f0']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}}); return; }
  state.charts.me = new Chart(ctx,{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:12},padding:12,usePointStyle:true}}}}});
}

// ====== Review View ======
function renderReview() {
  if (state.activeReviewTab === 'daily') renderDailyReview();
  else if (state.activeReviewTab === 'weekly') renderWeeklyReview();
  else if (state.activeReviewTab === 'monthly') renderMonthlyReview();
  else if (state.activeReviewTab === 'yearly') renderYearlyReview();
}

function renderDailyReview() {
  const date = state.reviewDate;
  const dk = getDateKey(date);
  const dd = getDayData(dk);
  document.getElementById('review-date-display').textContent = formatDateShort(date);
  const all = [...dd.timeline, ...dd.todos];
  const done = all.filter(t=>t.completed).length;
  const total = all.length;
  const rate = total>0?Math.round(done/total*100):0;
  const expT = dd.expenses.reduce((s,e)=>s+e.amount,0);
  document.getElementById('review-completion-percent').textContent = rate+'%';
  document.getElementById('review-tasks-done').textContent = `${done} / ${total}`;
  document.getElementById('review-expense').textContent = '¥'+expT.toFixed(2);
  document.getElementById('review-timeline-count').textContent = dd.timeline.length;
  const circ = 2*Math.PI*60;
  const ring = document.getElementById('review-ring-fg');
  ring.style.strokeDashoffset = circ - (rate/100)*circ;
  ring.style.stroke = rate>=80?'#22c55e':rate>=50?'#f59e0b':rate>0?'#ef4444':'#e2e8f0';
  const rv = dd.review || {};
  document.querySelectorAll('#rating-row .rating-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.rating)===rv.rating));
  document.getElementById('review-went-well').value = rv.wentWell || '';
  document.getElementById('review-improve').value = rv.improve || '';
  document.getElementById('review-tomorrow').value = rv.tomorrow || '';
  renderReviewTrendChart();
}

function renderWeeklyReview() {
  const ws = getWeekStart(state.reviewWeekRef);
  const we = getWeekEnd(state.reviewWeekRef);
  document.getElementById('review-week-display').textContent = `${ws.getMonth()+1}/${ws.getDate()} - ${we.getMonth()+1}/${we.getDate()}`;
  const wk = getWeekKey(state.reviewWeekRef);
  const rv = getReviewData(`week_${wk}`) || {};
  document.querySelectorAll('#weekly-rating-row .rating-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.rating)===rv.rating));
  document.getElementById('weekly-review-went-well').value = rv.wentWell || '';
  document.getElementById('weekly-review-improve').value = rv.improve || '';
  document.getElementById('weekly-review-next').value = rv.next || '';
}

function renderMonthlyReview() {
  const ref = state.reviewMonthRef;
  document.getElementById('review-month-display').textContent = `${ref.getFullYear()}年${ref.getMonth()+1}月`;
  const mk = getMonthKey(ref);
  const rv = getReviewData(`month_${mk}`) || {};
  document.querySelectorAll('#monthly-rating-row .rating-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.rating)===rv.rating));
  document.getElementById('monthly-review-went-well').value = rv.wentWell || '';
  document.getElementById('monthly-review-improve').value = rv.improve || '';
  document.getElementById('monthly-review-next').value = rv.next || '';
}

function renderYearlyReview() {
  const ref = state.reviewYearRef;
  document.getElementById('review-year-display').textContent = `${ref.getFullYear()}年`;
  const yk = `year_${ref.getFullYear()}`;
  const rv = getReviewData(yk) || {};
  document.querySelectorAll('#yearly-rating-row .rating-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.rating)===rv.rating));
  document.getElementById('yearly-review-went-well').value = rv.wentWell || '';
  document.getElementById('yearly-review-improve').value = rv.improve || '';
  document.getElementById('yearly-review-next').value = rv.next || '';
}

function renderReviewTrendChart() {
  const ctx = document.getElementById('review-trend-chart');
  if (state.charts.rt) state.charts.rt.destroy();
  const labels=[],data=[];
  for (let i=6; i>=0; i--) {
    const date = addDays(state.reviewDate, -i);
    const dd = getDayData(getDateKey(date));
    const all = [...dd.timeline, ...dd.todos];
    const done = all.filter(t=>t.completed).length;
    labels.push(`${date.getMonth()+1}/${date.getDate()}`);
    data.push(all.length>0?Math.round(done/all.length*100):0);
  }
  state.charts.rt = new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'完成率',data,borderColor:'#6366f1',backgroundColor:'rgba(99,102,241,0.15)',fill:true,tension:0.3,pointRadius:5,pointBackgroundColor:data.map(v=>v>=80?'#22c55e':v>=50?'#f59e0b':'#ef4444'),pointBorderColor:'#fff',pointBorderWidth:2}]},options:chartBaseOptions({yMax:100,ySuffix:'%'})});
}

function saveDailyReview() {
  const dk = getDateKey(state.reviewDate);
  const dd = getDayData(dk);
  const rating = document.querySelector('#rating-row .rating-btn.active')?.dataset.rating;
  dd.review = { rating: rating?parseInt(rating):0, wentWell: document.getElementById('review-went-well').value, improve: document.getElementById('review-improve').value, tomorrow: document.getElementById('review-tomorrow').value };
  saveDayData(dk, dd);
  showSaveStatus('save-status');
}
function saveWeeklyReview() {
  const wk = getWeekKey(state.reviewWeekRef);
  const rating = document.querySelector('#weekly-rating-row .rating-btn.active')?.dataset.rating;
  const rv = { rating: rating?parseInt(rating):0, wentWell: document.getElementById('weekly-review-went-well').value, improve: document.getElementById('weekly-review-improve').value, next: document.getElementById('weekly-review-next').value };
  saveReviewData(`week_${wk}`, rv);
  showSaveStatus('weekly-save-status');
}
function saveMonthlyReview() {
  const mk = getMonthKey(state.reviewMonthRef);
  const rating = document.querySelector('#monthly-rating-row .rating-btn.active')?.dataset.rating;
  const rv = { rating: rating?parseInt(rating):0, wentWell: document.getElementById('monthly-review-went-well').value, improve: document.getElementById('monthly-review-improve').value, next: document.getElementById('monthly-review-next').value };
  saveReviewData(`month_${mk}`, rv);
  showSaveStatus('monthly-save-status');
}
function saveYearlyReview() {
  const yk = `year_${state.reviewYearRef.getFullYear()}`;
  const rating = document.querySelector('#yearly-rating-row .rating-btn.active')?.dataset.rating;
  const rv = { rating: rating?parseInt(rating):0, wentWell: document.getElementById('yearly-review-went-well').value, improve: document.getElementById('yearly-review-improve').value, next: document.getElementById('yearly-review-next').value };
  saveReviewData(yk, rv);
  showSaveStatus('yearly-save-status');
}
function showSaveStatus(id) {
  const s = document.getElementById(id);
  s.textContent = '✓ 已保存'; s.classList.add('show');
  setTimeout(() => s.classList.remove('show'), 2000);
}

// ====== Health View ======
function renderHealth() {
  if (state.activeHealthTab === 'weight') renderWeightPanel();
  else if (state.activeHealthTab === 'cycle') renderCyclePanel();
}

function renderWeightPanel() {
  const hd = getHealthData();
  const weights = hd.weights || [];
  // Sort by date descending for display
  const sorted = [...weights].sort((a,b) => b.date.localeCompare(a.date));
  const recent7 = sorted.slice(0, 7);
  const values = recent7.map(w => w.value);
  document.getElementById('weight-current').textContent = values.length > 0 ? values[0].toFixed(1) : '--';
  if (values.length > 0) {
    document.getElementById('weight-avg').textContent = (values.reduce((s,v) => s+v, 0) / values.length).toFixed(1);
    document.getElementById('weight-max').textContent = Math.max(...values).toFixed(1);
    document.getElementById('weight-min').textContent = Math.min(...values).toFixed(1);
  } else {
    document.getElementById('weight-avg').textContent = '--';
    document.getElementById('weight-max').textContent = '--';
    document.getElementById('weight-min').textContent = '--';
  }
  // Set default date
  const today = new Date();
  document.getElementById('weight-date').value = getDateKey(today);
  // History list
  const listEl = document.getElementById('weight-history-list');
  const empty = document.getElementById('weight-empty');
  if (weights.length === 0) {
    listEl.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    listEl.innerHTML = sorted.map(w => `
      <div class="weight-history-item">
        <span class="weight-history-date">${w.date}</span>
        <span class="weight-history-value">${w.value.toFixed(1)} kg</span>
        <span class="weight-history-note">${escapeHtml(w.note || '')}</span>
        <button class="weight-history-delete" data-id="${w.id}">✕</button>
      </div>`).join('');
    listEl.querySelectorAll('.weight-history-delete').forEach(b => b.addEventListener('click', () => deleteWeight(b.dataset.id)));
  }
  // Chart
  renderWeightChart(weights);
}

function renderWeightChart(weights) {
  const ctx = document.getElementById('weight-chart');
  if (state.charts.weight) state.charts.weight.destroy();
  if (weights.length === 0) {
    state.charts.weight = new Chart(ctx, { type: 'line', data: { labels: ['暂无数据'], datasets: [{ data: [0], borderColor: '#e2e8f0' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    return;
  }
  const sorted = [...weights].sort((a,b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-30);
  state.charts.weight = new Chart(ctx, {
    type: 'line',
    data: { labels: recent.map(w => w.date.slice(5)), datasets: [{ label: '体重(kg)', data: recent.map(w => w.value), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.15)', fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: '#6366f1' }] },
    options: chartBaseOptions({ ySuffix: ' kg' })
  });
}

function addWeightRecord(date, value, note) {
  const hd = getHealthData();
  if (!hd.weights) hd.weights = [];
  hd.weights.push({ id: genId(), date, value: parseFloat(value), note, createdAt: Date.now() });
  saveHealthData(hd);
  showToast('已记录体重');
  renderWeightPanel();
}
function deleteWeight(id) {
  const hd = getHealthData();
  hd.weights = (hd.weights||[]).filter(w => w.id !== id);
  saveHealthData(hd);
  renderWeightPanel();
}

function renderCyclePanel() {
  const hd = getHealthData();
  const cycles = hd.cycles || [];
  const sorted = [...cycles].sort((a,b) => b.startDate.localeCompare(a.startDate));
  const today = new Date(); today.setHours(0,0,0,0);

  // Default date
  document.getElementById('cycle-start').value = getDateKey(new Date());

  if (sorted.length === 0) {
    document.getElementById('apple-cycle-day').textContent = '--';
    document.getElementById('apple-cycle-sub').textContent = '未开始记录';
    document.getElementById('apple-status-icon').textContent = '🌸';
    document.getElementById('apple-status-text').textContent = '记录月经开始日期后开始追踪';
    document.getElementById('cycle-last-start').textContent = '--';
    document.getElementById('cycle-length').textContent = '--';
    document.getElementById('cycle-period').textContent = '--';
    document.getElementById('cycle-next').textContent = '--';
    document.getElementById('apple-timeline-title').textContent = '周期时间线';
    document.getElementById('apple-timeline').innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-light);font-size:13px;">记录月经开始日期后，时间线会自动显示周期</div>';
  } else {
    const latest = sorted[0];
    const periodDays = latest.days || 5;
    const cycleLen = sorted.length >= 2
      ? Math.round((new Date(sorted[0].startDate) - new Date(sorted[1].startDate)) / 86400000)
      : 28;
    const lastStart = new Date(latest.startDate); lastStart.setHours(0,0,0,0);
    const nextStart = new Date(lastStart); nextStart.setDate(nextStart.getDate() + cycleLen);
    const daysSince = Math.round((today - lastStart) / 86400000);

    // Stats cards
    document.getElementById('cycle-last-start').textContent = latest.startDate.slice(5);
    document.getElementById('cycle-length').textContent = cycleLen + '天';
    document.getElementById('cycle-period').textContent = periodDays + '天';
    document.getElementById('cycle-next').textContent = `${nextStart.getMonth()+1}/${nextStart.getDate()}`;

    // Ring rendering
    var C = 2 * Math.PI * 85;
    var periodRing = document.getElementById('apple-ring-period');
    var fertileRing = document.getElementById('apple-ring-fertile');

    if (daysSince >= 0 && daysSince <= cycleLen) {
      // Current cycle day
      var currentDay = daysSince + 1;
      document.getElementById('apple-cycle-day').textContent = currentDay;
      document.getElementById('apple-cycle-sub').textContent = '第' + currentDay + '天';

      // Determine phase and status
      var fertileStart = cycleLen - 17;
      var fertileEnd = cycleLen - 11;
      var isPeriod = currentDay <= periodDays;
      var isFertile = currentDay >= fertileStart && currentDay <= fertileEnd;
      var daysToNext = cycleLen - daysSince;

      if (isPeriod) {
        document.getElementById('apple-cycle-day').textContent = currentDay;
        document.getElementById('apple-cycle-sub').textContent = '经期第' + currentDay + '天';
        document.getElementById('apple-status-icon').textContent = '🩸';
        document.getElementById('apple-status-text').textContent = '经期中 · 注意保暖休息';
        periodRing.style.stroke = '#FF6B6B';
      } else if (isFertile) {
        document.getElementById('apple-status-icon').textContent = '🔥';
        document.getElementById('apple-status-text').textContent = '易孕期 · 受孕概率较高';
        periodRing.style.stroke = '#4ECDC4';
      } else if (daysToNext <= 3) {
        document.getElementById('apple-status-icon').textContent = '⏳';
        document.getElementById('apple-status-text').textContent = '预计' + daysToNext + '天后开始下次月经';
        periodRing.style.stroke = '#FFAEC0';
      } else {
        document.getElementById('apple-status-icon').textContent = '✨';
        document.getElementById('apple-status-text').textContent = '安全期 · 距下次月经还有' + daysToNext + '天';
        periodRing.style.stroke = '#6366f1';
      }

      // Period arc (days 1 to periodDays)
      var periodFraction = periodDays / cycleLen;
      var periodArc = periodFraction * C;
      periodRing.style.strokeDasharray = periodArc + ' ' + (C - periodArc);
      periodRing.style.strokeDashoffset = '0';

      // Fertile arc
      var fertileStartFraction = fertileStart / cycleLen;
      var fertileLengthFraction = (fertileEnd - fertileStart + 1) / cycleLen;
      var fertileArc = fertileLengthFraction * C;
      fertileRing.style.strokeDasharray = fertileArc + ' ' + (C - fertileArc);
      fertileRing.style.strokeDashoffset = (-fertileStartFraction * C).toString();

      // Horizontal timeline
      renderAppleTimeline(cycleLen, currentDay, periodDays, fertileStart, fertileEnd, nextStart);
      document.getElementById('apple-timeline-title').textContent = '周期时间线 · ' + cycleLen + '天';
    } else if (daysSince < 0) {
      document.getElementById('apple-cycle-day').textContent = '待开始';
      document.getElementById('apple-cycle-sub').textContent = '还有' + (-daysSince) + '天';
      document.getElementById('apple-status-icon').textContent = '🌸';
      document.getElementById('apple-status-text').textContent = '预计' + (-daysSince) + '天后开始';
      periodRing.style.strokeDasharray = '0 ' + C;
      periodRing.style.strokeDashoffset = '0';
      fertileRing.style.strokeDasharray = '0 ' + C;
      fertileRing.style.strokeDashoffset = '0';
      renderAppleTimeline(cycleLen, 0, periodDays, cycleLen - 17, cycleLen - 11, nextStart);
      document.getElementById('apple-timeline-title').textContent = '周期时间线 · ' + cycleLen + '天';
    } else {
      // Past predicted next period
      var daysOver = daysSince - cycleLen + 1;
      document.getElementById('apple-cycle-day').textContent = daysOver;
      document.getElementById('apple-cycle-sub').textContent = '已推迟' + daysOver + '天';
      document.getElementById('apple-status-icon').textContent = '⏰';
      document.getElementById('apple-status-text').textContent = '月经已推迟' + daysOver + '天';
      periodRing.style.stroke = '#FF6B6B';
      var overFraction = Math.min(1, daysOver / 7);
      periodRing.style.strokeDasharray = (overFraction * C) + ' ' + (C - overFraction * C);
      periodRing.style.strokeDashoffset = '0';
      fertileRing.style.strokeDasharray = '0 ' + C;
      renderAppleTimeline(cycleLen + daysOver, cycleLen + daysOver, periodDays, cycleLen - 17, cycleLen - 11, nextStart);
      document.getElementById('apple-timeline-title').textContent = '周期时间线 · 已推迟' + daysOver + '天';
    }
  }

  // History list
  const listEl = document.getElementById('cycle-history-list');
  const empty = document.getElementById('cycle-empty');
  if (cycles.length === 0) {
    listEl.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    listEl.innerHTML = sorted.map(c => `
      <div class="cycle-history-item">
        <span class="cycle-history-date">${c.startDate}</span>
        <span class="cycle-history-days">${c.days}天</span>
        <span class="cycle-history-note">${escapeHtml(c.note || '')}</span>
        <button class="cycle-history-delete" data-id="${c.id}">✕</button>
      </div>`).join('');
    listEl.querySelectorAll('.cycle-history-delete').forEach(b => b.addEventListener('click', () => deleteCycle(b.dataset.id)));
  }
}

function renderAppleTimeline(cycleLen, currentDay, periodDays, fertileStart, fertileEnd, nextStart) {
  const container = document.getElementById('apple-timeline');
  let html = '';
  for (let d = 1; d <= cycleLen; d++) {
    var barColor = '#E8E8E8'; // safe/default
    var label = '';
    if (d <= periodDays) { barColor = '#FF6B6B'; label = '经期'; }
    else if (d >= fertileStart && d <= fertileEnd) { barColor = '#4ECDC4'; label = '易孕'; }
    else if (d > cycleLen - 3 && d <= cycleLen) { barColor = '#FFAEC0'; label = '临经'; }
    var isToday = (d === currentDay);
    html += `<div class="apple-tl-day${isToday ? ' today' : ''}">
      <div class="apple-tl-bar" style="background:${barColor}"></div>
      <div class="apple-tl-day-label">${d}</div>
    </div>`;
  }
  container.innerHTML = html;
}

function addCycleRecord(startDate, days, note) {
  const hd = getHealthData();
  if (!hd.cycles) hd.cycles = [];
  hd.cycles.push({ id: genId(), startDate, days: parseInt(days), note, createdAt: Date.now() });
  saveHealthData(hd);
  showToast('已记录月经周期');
  renderCyclePanel();
}
function deleteCycle(id) {
  const hd = getHealthData();
  hd.cycles = (hd.cycles||[]).filter(c => c.id !== id);
  saveHealthData(hd);
  renderCyclePanel();
}

// ====== Reviews (Film) View ======
function renderReviewsView() {
  if (state.activeReviewsTab === 'my') renderMyReviewsPanel();
  else renderDiscoverPanel();
}

function renderMyReviewsPanel() {
  const reviews = getFilmReviews();
  const sorted = [...reviews].sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  const listEl = document.getElementById('review-list');
  const empty = document.getElementById('review-empty');
  const typeLabels = { movie: '电影', tv: '剧集', doc: '纪录片', anime: '动画' };
  if (reviews.length === 0) {
    listEl.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    listEl.innerHTML = sorted.map(r => {
      const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
      return `<div class="review-card-item" data-id="${r.id}">
        <div class="review-card-header">
          <div class="review-card-title-row">
            <span class="review-card-title">${escapeHtml(r.title)}</span>
            <span class="review-card-type">${typeLabels[r.type] || '电影'}</span>
          </div>
          <button class="review-card-delete" data-id="${r.id}">✕</button>
        </div>
        <div class="review-card-stars">${stars}</div>
        <div class="review-card-meta">
          <span>${r.date || ''}</span>
          ${r.tags ? `<span class="review-card-tags">${escapeHtml(r.tags)}</span>` : ''}
        </div>
        ${r.content ? `<div class="review-card-content">${escapeHtml(r.content)}</div>` : ''}
      </div>`;
    }).join('');
    listEl.querySelectorAll('.review-card-delete').forEach(b => b.addEventListener('click', () => deleteFilmReview(b.dataset.id)));
  }
  // Reset star rating
  state.rvStarRating = 0;
  updateStarDisplay(0);
  document.getElementById('rv-date').value = getDateKey(new Date());
}

function updateStarDisplay(rating) {
  document.querySelectorAll('#rv-stars .star-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.v) <= rating);
  });
}

function addFilmReview(title, type, date, rating, tags, content) {
  const reviews = getFilmReviews();
  reviews.push({ id: genId(), title, type, date, rating, tags, content, createdAt: Date.now() });
  saveFilmReviews(reviews);
  showToast('影评已发布');
  renderMyReviewsPanel();
}

function deleteFilmReview(id) {
  const reviews = getFilmReviews();
  saveFilmReviews(reviews.filter(r => r.id !== id));
  renderMyReviewsPanel();
}

function renderDiscoverPanel() {
  const searchQuery = document.getElementById('rv-search').value.toLowerCase().trim();
  const filterType = document.getElementById('rv-filter').value;
  const sortBy = document.getElementById('rv-sort').value;

  let films = [...CLASSIC_FILMS];
  // Filter by type
  if (filterType) films = films.filter(f => f.type === filterType);
  // Filter by search
  if (searchQuery) {
    films = films.filter(f =>
      f.title.toLowerCase().includes(searchQuery) ||
      (f.orig && f.orig.toLowerCase().includes(searchQuery)) ||
      f.director.toLowerCase().includes(searchQuery) ||
      f.genre.toLowerCase().includes(searchQuery)
    );
  }
  // Sort
  if (sortBy === 'rating') films.sort((a,b) => b.rating - a.rating);
  else if (sortBy === 'year-new') films.sort((a,b) => b.year - a.year);
  else if (sortBy === 'year-old') films.sort((a,b) => a.year - b.year);

  const grid = document.getElementById('discover-grid');
  const typeLabels = { movie: '电影', tv: '剧集', doc: '纪录片', anime: '动画' };
  if (films.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-light);"><p>没有找到匹配的影视作品</p></div>';
    return;
  }
  grid.innerHTML = films.map((f, i) => {
    const color = ANNO_COLORS[i % ANNO_COLORS.length];
    return `<div class="film-card" data-title="${escapeHtml(f.title)}">
      <div class="film-card-title">${escapeHtml(f.title)}</div>
      <div class="film-card-orig">${escapeHtml(f.orig)} (${f.year})</div>
      <div class="film-card-meta">
        <span class="film-card-badge">${typeLabels[f.type] || '电影'}</span>
        <span class="film-card-badge">${escapeHtml(f.genre)}</span>
        <span class="film-card-badge">${escapeHtml(f.director)}</span>
        <span class="film-card-badge rating">★ ${f.rating}</span>
      </div>
      <div class="film-card-desc">${escapeHtml(f.desc)}</div>
      <div class="film-card-action">
        <button class="btn-sm btn-primary rv-write-btn" data-title="${escapeHtml(f.title)}">写影评</button>
      </div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.rv-write-btn').forEach(btn => btn.addEventListener('click', () => {
    document.getElementById('rv-title').value = btn.dataset.title;
    state.activeReviewsTab = 'my';
    document.querySelectorAll('.review-tab[data-vtab]').forEach(b => b.classList.toggle('active', b.dataset.vtab === 'my'));
    document.getElementById('reviews-panel-discover').classList.remove('active');
    document.getElementById('reviews-panel-my').classList.add('active');
    renderMyReviewsPanel();
    document.getElementById('rv-title').focus();
    showToast('已填入片名，写下你的观影感受吧');
  }));
}

// ====== Calendar View ======
function renderCalendarView() {
  const ref = state.selectedCalMonth;
  const y = ref.getFullYear(), m = ref.getMonth();

  // Lunar month label
  const midDate = new Date(y, m, 15);
  const lunar = solarToLunar(midDate);
  document.getElementById('cal-lunar-month').textContent =
    `${y}年${m+1}月 · ${(lunar.isLeap ? '闰' : '')}${LUNAR_MONTH_NAMES[lunar.month - 1] || (lunar.month + '月')}`;

  // Build calendar grid
  const grid = document.getElementById('cal-grid');
  const firstDay = new Date(y, m, 1);
  const fd = firstDay.getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  // Week headers
  let html = '<div class="cal-week-header">';
  ['日','一','二','三','四','五','六'].forEach((d, i) => {
    html += `<div${i === 0 || i === 6 ? ' class="weekend"' : ''}>${d}</div>`;
  });
  html += '</div>';

  const totalCells = fd + dim;
  const numWeeks = Math.ceil(totalCells / 7);

  let dayCounter = 1;
  for (let w = 0; w < numWeeks; w++) {
    html += '<div class="cal-week-row">';
    for (let dow = 0; dow < 7; dow++) {
      const cellIdx = w * 7 + dow;
      if (cellIdx < fd || dayCounter > dim) {
        html += '<div class="cal-day-cell empty"></div>';
      } else {
        const date = new Date(y, m, dayCounter);
        const lunarInfo = solarToLunar(date);
        const isToday = isSameDay(date, today);
        const isWeekend = dow === 0 || dow === 6;

        // Determine lunar display text
        let lunarText = '';
        let lunarClass = '';
        const holiday = getHolidayName(date, lunarInfo);
        if (holiday) {
          lunarText = holiday;
          lunarClass = 'holiday';
        } else if (lunarInfo.day === 1) {
          lunarText = (lunarInfo.isLeap ? '闰' : '') + (LUNAR_MONTH_NAMES[lunarInfo.month - 1] || (lunarInfo.month + '月'));
        } else {
          lunarText = getLunarDayName(lunarInfo.day);
        }

        html += `<div class="cal-day-cell${isToday ? ' today' : ''}${isWeekend ? ' weekend' : ''}" data-date="${getDateKey(date)}">
          <div class="cal-day-num">${dayCounter}</div>
          <div class="cal-day-lunar${lunarClass ? ' ' + lunarClass : ''}">${lunarText}</div>
        </div>`;
        dayCounter++;
      }
    }
    html += '<div class="cal-anno-layer"></div>';
    html += '</div>';
  }
  grid.innerHTML = html;

  // Render annotation bars
  renderCalAnnoBars(y, m, fd, dim);

  // Render annotation list
  renderCalAnnoList();
}

function renderCalAnnoBars(year, month, fd, dim) {
  const annotations = getCalAnnotations();
  if (annotations.length === 0) return;

  const weekRows = document.querySelectorAll('#cal-grid .cal-week-row');
  if (weekRows.length === 0) return;

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month, dim);
  const numWeeks = weekRows.length;

  // Calculate track assignments for stacking
  const tracks = []; // tracks[annoIdx] = track number

  annotations.forEach((anno, idx) => {
    const aStart = new Date(anno.startDate); aStart.setHours(0,0,0,0);
    const aEnd = new Date(anno.endDate); aEnd.setHours(0,0,0,0);
    if (aEnd < monthStart || aStart > monthEnd) { tracks[idx] = -1; return; }

    // Find first available track
    let trackNum = 0;
    let found = false;
    while (!found) {
      let conflict = false;
      for (let i = 0; i < idx; i++) {
        if (tracks[i] !== trackNum) continue;
        const other = annotations[i];
        const oStart = new Date(other.startDate); oStart.setHours(0,0,0,0);
        const oEnd = new Date(other.endDate); oEnd.setHours(0,0,0,0);
        if (aStart <= oEnd && aEnd >= oStart) { conflict = true; break; }
      }
      if (!conflict) found = true;
      else trackNum++;
    }
    tracks[idx] = trackNum;
  });

  annotations.forEach((anno, idx) => {
    if (tracks[idx] < 0) return;

    const aStart = new Date(anno.startDate); aStart.setHours(0,0,0,0);
    const aEnd = new Date(anno.endDate); aEnd.setHours(0,0,0,0);
    const effStart = aStart < monthStart ? monthStart : aStart;
    const effEnd = aEnd > monthEnd ? monthEnd : aEnd;

    const startDayIdx = Math.floor((effStart - new Date(year, month, 1)) / 86400000) + fd;
    const endDayIdx = Math.floor((effEnd - new Date(year, month, 1)) / 86400000) + fd;
    const startWeek = Math.floor(startDayIdx / 7);
    const endWeek = Math.floor(endDayIdx / 7);

    const color = ANNO_COLORS[idx % ANNO_COLORS.length];
    const trackNum = tracks[idx];

    for (let w = startWeek; w <= endWeek && w < numWeeks; w++) {
      if (w < 0) continue;
      const weekStartCol = w * 7;
      const weekEndCol = weekStartCol + 6;
      const barStartCol = Math.max(startDayIdx, weekStartCol);
      const barEndCol = Math.min(endDayIdx, weekEndCol);
      const leftPct = (barStartCol - weekStartCol) / 7 * 100;
      const widthPct = (barEndCol - barStartCol + 1) / 7 * 100;
      const isSingleDay = barStartCol === barEndCol;

      const weekRow = weekRows[w];
      if (!weekRow) continue;
      const annoLayer = weekRow.querySelector('.cal-anno-layer');
      if (!annoLayer) continue;

      const bar = document.createElement('div');
      bar.className = 'cal-anno-bar' + (isSingleDay ? ' single' : '');
      bar.style.left = leftPct + '%';
      bar.style.width = 'calc(' + widthPct + '% - 4px)';
      bar.style.top = (2 + trackNum * 24) + 'px';
      bar.style.background = color;
      bar.textContent = anno.text;
      bar.title = anno.startDate + ' ~ ' + anno.endDate + ': ' + anno.text;
      bar.dataset.id = anno.id;
      bar.addEventListener('click', () => {
        if (confirm('删除标注「' + anno.text + '」？')) {
          deleteCalAnnotation(anno.id);
        }
      });
      annoLayer.appendChild(bar);
    }
  });
}

function renderCalAnnoList() {
  const annotations = getCalAnnotations();
  const listEl = document.getElementById('cal-anno-list');
  const empty = document.getElementById('cal-anno-empty');
  if (annotations.length === 0) {
    listEl.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  const sorted = [...annotations].sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  listEl.innerHTML = sorted.map(a => {
    const idx = annotations.indexOf(a);
    const color = ANNO_COLORS[idx % ANNO_COLORS.length];
    const dateRange = a.startDate === a.endDate ? a.startDate : a.startDate + ' ~ ' + a.endDate;
    return `<div class="cal-anno-list-item">
      <span class="cal-anno-color-dot" style="background:${color}"></span>
      <span class="cal-anno-list-text">${escapeHtml(a.text)}</span>
      <span class="cal-anno-list-date">${dateRange}</span>
      <button class="cal-anno-list-delete" data-id="${a.id}">✕</button>
    </div>`;
  }).join('');
  listEl.querySelectorAll('.cal-anno-list-delete').forEach(b => b.addEventListener('click', () => deleteCalAnnotation(b.dataset.id)));
}

function addCalAnnotation(text, startDate, endDate) {
  const annos = getCalAnnotations();
  annos.push({ id: genId(), text, startDate, endDate, createdAt: Date.now() });
  saveCalAnnotations(annos);
  renderCalendarView();
}

function deleteCalAnnotation(id) {
  const annos = getCalAnnotations();
  saveCalAnnotations(annos.filter(a => a.id !== id));
  renderCalendarView();
}

// ====== Chart Base Options ======
function chartBaseOptions(opts = {}) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'top', labels: { font: { size: 12 }, usePointStyle: true, padding: 16 } } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#94a3b8' } },
      y: { beginAtZero: true, max: opts.yMax, grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 }, color: '#94a3b8', stepSize: opts.yStepSize, callback: (v) => opts.yPrefix ? opts.yPrefix+v : (opts.ySuffix ? v+opts.ySuffix : v) } }
    }
  };
}

// ====== Clock ======
function updateClock() {
  const now = new Date();
  document.getElementById('sidebar-date').textContent = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${WEEKDAYS[now.getDay()]}`;
  document.getElementById('sidebar-time').textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
}

// ====== Category Modal ======
function openCatModal(mode, parentId) {
  state.catModalMode = mode;
  state.catModalParentId = parentId;
  state.catModalType = state.catModalType || 'expense';
  const modal = document.getElementById('cat-modal');
  const title = document.getElementById('cat-modal-title');
  const label = document.getElementById('cat-modal-label');
  const input = document.getElementById('cat-modal-input');
  const parentRow = document.getElementById('cat-modal-parent-row');
  const parentSel = document.getElementById('cat-modal-parent');
  input.value = '';
  if (state.catModalType === 'income') {
    title.textContent = '添加收入类型';
    label.textContent = '收入类型名称';
    parentRow.style.display = 'none';
  } else if (mode === 'main') {
    title.textContent = '添加大项';
    label.textContent = '大项名称';
    parentRow.style.display = 'none';
  } else {
    title.textContent = '添加小项';
    label.textContent = '小项名称';
    parentRow.style.display = 'block';
    const cats = getCategories();
    parentSel.innerHTML = cats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
    if (parentId) parentSel.value = parentId;
  }
  modal.classList.add('show');
  setTimeout(() => input.focus(), 100);
}

// ====== Event Bindings ======
function bindEvents() {
  // Nav
  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));

  // Daily date nav
  document.getElementById('prev-day').addEventListener('click', () => { state.selectedDate = addDays(state.selectedDate, -1); renderDaily(); });
  document.getElementById('next-day').addEventListener('click', () => { state.selectedDate = addDays(state.selectedDate, 1); renderDaily(); });
  document.getElementById('today-btn').addEventListener('click', () => { state.selectedDate = new Date(); renderDaily(); });

  // Timeline
  document.getElementById('tl-add').addEventListener('click', () => {
    const st = document.getElementById('tl-start').value;
    const et = document.getElementById('tl-end').value;
    const title = document.getElementById('tl-title').value.trim();
    const cat = document.getElementById('tl-category').value;
    if (!title) { showToast('请输入任务名称'); return; }
    if (!st || !et) { showToast('请选择开始和结束时间'); return; }
    if (timeToMinutes(et) <= timeToMinutes(st)) { showToast('结束时间需晚于开始时间'); return; }
    addTimelineItem(st, et, title, cat);
    document.getElementById('tl-title').value = '';
    document.getElementById('tl-title').focus();
  });
  document.getElementById('tl-title').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('tl-add').click(); });

  // Todo
  document.getElementById('add-todo-btn').addEventListener('click', () => { const r = document.getElementById('todo-input-row'); const i = document.getElementById('todo-input'); r.style.display = r.style.display === 'none' ? 'flex' : 'none'; if (r.style.display === 'flex') i.focus(); });
  document.getElementById('todo-add-confirm').addEventListener('click', () => { const t = document.getElementById('todo-input').value.trim(); const p = document.getElementById('todo-priority').value; if (!t) { showToast('请输入待办内容'); return; } addTodo(t, p); document.getElementById('todo-input').value = ''; document.getElementById('todo-input').focus(); });
  document.getElementById('todo-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('todo-add-confirm').click(); });

  // Expense
  document.getElementById('add-expense-btn').addEventListener('click', () => { const r = document.getElementById('expense-input-row'); r.style.display = r.style.display === 'none' ? 'flex' : 'none'; if (r.style.display === 'flex') document.getElementById('exp-amount').focus(); });
  document.getElementById('exp-confirm').addEventListener('click', () => {
    const amt = document.getElementById('exp-amount').value;
    const mc = document.getElementById('exp-main-cat').value;
    const sc = document.getElementById('exp-sub-cat').value;
    const note = document.getElementById('exp-note').value.trim();
    if (!amt || parseFloat(amt) <= 0) { showToast('请输入有效金额'); return; }
    if (mc === '__add_new__') { showToast('请先选择有效大项'); return; }
    addExpense(amt, mc, sc === '_none' || sc === '' || sc === '__add_new__' ? '' : sc, note);
    document.getElementById('exp-amount').value = ''; document.getElementById('exp-note').value = '';
    document.getElementById('exp-amount').focus();
  });
  document.getElementById('exp-note').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('exp-confirm').click(); });

  // Weekly
  document.getElementById('prev-week').addEventListener('click', () => { state.selectedWeekRef = addDays(state.selectedWeekRef, -7); renderWeekly(); });
  document.getElementById('next-week').addEventListener('click', () => { state.selectedWeekRef = addDays(state.selectedWeekRef, 7); renderWeekly(); });
  document.getElementById('this-week-btn').addEventListener('click', () => { state.selectedWeekRef = new Date(); renderWeekly(); });
  document.getElementById('add-weekly-goal-btn').addEventListener('click', () => { const r = document.getElementById('weekly-goal-input-row'); const i = document.getElementById('weekly-goal-input'); r.style.display = r.style.display === 'none' ? 'flex' : 'none'; if (r.style.display === 'flex') i.focus(); });
  document.getElementById('weekly-goal-confirm').addEventListener('click', () => { const t = document.getElementById('weekly-goal-input').value.trim(); if (!t) { showToast('请输入目标'); return; } const wk = getWeekKey(state.selectedWeekRef); const gs = getWeekGoals(wk); gs.push({ id: genId(), text: t, completed: false }); saveWeekGoals(wk, gs); renderWeekGoals(wk); document.getElementById('weekly-goal-input').value = ''; document.getElementById('weekly-goal-input').focus(); });
  document.getElementById('weekly-goal-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('weekly-goal-confirm').click(); });

  // Monthly
  document.getElementById('prev-month').addEventListener('click', () => { state.selectedMonthRef = new Date(state.selectedMonthRef.getFullYear(), state.selectedMonthRef.getMonth()-1, 1); renderMonthly(); });
  document.getElementById('next-month').addEventListener('click', () => { state.selectedMonthRef = new Date(state.selectedMonthRef.getFullYear(), state.selectedMonthRef.getMonth()+1, 1); renderMonthly(); });
  document.getElementById('this-month-btn').addEventListener('click', () => { state.selectedMonthRef = new Date(); renderMonthly(); });
  document.getElementById('add-monthly-goal-btn').addEventListener('click', () => { const r = document.getElementById('monthly-goal-input-row'); const i = document.getElementById('monthly-goal-input'); r.style.display = r.style.display === 'none' ? 'flex' : 'none'; if (r.style.display === 'flex') i.focus(); });
  document.getElementById('monthly-goal-confirm').addEventListener('click', () => { const t = document.getElementById('monthly-goal-input').value.trim(); if (!t) { showToast('请输入目标'); return; } const mk = getMonthKey(state.selectedMonthRef); const gs = getMonthGoals(mk); gs.push({ id: genId(), text: t, completed: false }); saveMonthGoals(mk, gs); renderMonthGoals(mk); document.getElementById('monthly-goal-input').value = ''; document.getElementById('monthly-goal-input').focus(); });
  document.getElementById('monthly-goal-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('monthly-goal-confirm').click(); });

  // Bills
  document.getElementById('prev-bill-month').addEventListener('click', () => { state.selectedBillMonth = new Date(state.selectedBillMonth.getFullYear(), state.selectedBillMonth.getMonth()-1, 1); state.selectedBillCat = null; renderBills(); });
  document.getElementById('next-bill-month').addEventListener('click', () => { state.selectedBillMonth = new Date(state.selectedBillMonth.getFullYear(), state.selectedBillMonth.getMonth()+1, 1); state.selectedBillCat = null; renderBills(); });
  document.getElementById('this-bill-month-btn').addEventListener('click', () => { state.selectedBillMonth = new Date(); state.selectedBillCat = null; renderBills(); });
  document.getElementById('add-main-cat-btn').addEventListener('click', () => { state.catModalType = 'expense'; openCatModal('main'); });
  document.getElementById('add-sub-cat-btn').addEventListener('click', () => { state.catModalType = 'expense'; openCatModal('sub', state.selectedBillCat); });

  // Bill tabs
  document.querySelectorAll('.bill-tab').forEach(btn => btn.addEventListener('click', () => {
    state.activeBillTab = btn.dataset.tab;
    document.querySelectorAll('.bill-tab').forEach(b => b.classList.toggle('active', b === btn));
    renderBills();
  }));

  // Income
  document.getElementById('add-income-cat-btn').addEventListener('click', () => { state.catModalType = 'income'; openCatModal('main'); });
  document.getElementById('inc-confirm').addEventListener('click', () => {
    const amt = document.getElementById('inc-amount').value;
    const catId = document.getElementById('inc-cat').value;
    const note = document.getElementById('inc-note').value.trim();
    if (!amt || parseFloat(amt) <= 0) { showToast('请输入有效金额'); return; }
    if (catId === '__add_new__') { showToast('请先选择有效收入类型'); return; }
    addIncomeRecord(amt, catId, note);
    document.getElementById('inc-amount').value = ''; document.getElementById('inc-note').value = '';
    document.getElementById('inc-amount').focus();
  });
  document.getElementById('inc-note').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('inc-confirm').click(); });

  // Category modal
  document.getElementById('cat-modal-close').addEventListener('click', () => { document.getElementById('cat-modal').classList.remove('show'); state.catModalType = 'expense'; });
  document.getElementById('cat-modal-cancel').addEventListener('click', () => { document.getElementById('cat-modal').classList.remove('show'); state.catModalType = 'expense'; });
  document.getElementById('cat-modal-confirm').addEventListener('click', () => {
    const name = document.getElementById('cat-modal-input').value.trim();
    if (!name) { showToast('请输入名称'); return; }
    if (state.catModalType === 'income') {
      addIncomeCategory(name);
      showToast('已添加收入类型');
      populateIncomeCategoryDropdown();
    } else if (state.catModalMode === 'main') {
      addMainCategory(name);
      showToast('已添加大项');
      populateExpenseCategoryDropdowns();
    } else {
      const parentId = document.getElementById('cat-modal-parent').value;
      addSubCategory(parentId, name);
      showToast('已添加小项');
      populateExpenseCategoryDropdowns();
    }
    document.getElementById('cat-modal').classList.remove('show');
    state.catModalType = 'expense';
    if (state.activeView === 'bills') renderBills();
  });
  document.getElementById('cat-modal').addEventListener('click', e => { if (e.target.id === 'cat-modal') { document.getElementById('cat-modal').classList.remove('show'); state.catModalType = 'expense'; } });
  document.getElementById('cat-modal-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('cat-modal-confirm').click(); });

  // Savings
  document.getElementById('sav-add').addEventListener('click', () => {
    const label = document.getElementById('sav-label').value.trim();
    const amt = document.getElementById('sav-amount').value;
    const type = document.getElementById('sav-type').value;
    if (!amt || parseFloat(amt) <= 0) { showToast('请输入有效金额'); return; }
    addSavingsTx(label || (type === 'in' ? '存入' : '取出'), amt, type);
    document.getElementById('sav-label').value = ''; document.getElementById('sav-amount').value = '';
    showToast(type === 'in' ? '已记录存入' : '已记录取出');
    renderSavings();
  });
  document.getElementById('sav-amount').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('sav-add').click(); });
  document.getElementById('add-savings-goal-btn').addEventListener('click', () => { const r = document.getElementById('savings-goal-input-row'); r.style.display = r.style.display === 'none' ? 'flex' : 'none'; if (r.style.display === 'flex') document.getElementById('savings-goal-name').focus(); });
  document.getElementById('savings-goal-confirm').addEventListener('click', () => {
    const name = document.getElementById('savings-goal-name').value.trim();
    const amt = document.getElementById('savings-goal-amount').value;
    if (!name) { showToast('请输入目标名称'); return; }
    if (!amt || parseFloat(amt) <= 0) { showToast('请输入目标金额'); return; }
    addSavingsGoal(name, amt);
    document.getElementById('savings-goal-name').value = ''; document.getElementById('savings-goal-amount').value = '';
    renderSavings();
  });
  document.getElementById('savings-goal-name').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('savings-goal-amount').focus(); });
  document.getElementById('savings-goal-amount').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('savings-goal-confirm').click(); });

  // Pouch
  document.getElementById('pouch-add-btn').addEventListener('click', () => { const r = document.getElementById('pouch-input-row'); r.style.display = r.style.display === 'none' ? 'flex' : 'none'; if (r.style.display === 'flex') document.getElementById('pouch-amount').focus(); });
  document.getElementById('pouch-confirm').addEventListener('click', () => {
    const label = document.getElementById('pouch-label').value.trim();
    const amt = document.getElementById('pouch-amount').value;
    const type = document.getElementById('pouch-type').value;
    if (!amt || parseFloat(amt) <= 0) { showToast('请输入有效金额'); return; }
    addPouchTx(label || (type === 'in' ? '存入小荷包' : '从小荷包取出'), amt, type);
    document.getElementById('pouch-label').value = ''; document.getElementById('pouch-amount').value = '';
    showToast(type === 'in' ? '已存入小荷包' : '已从小荷包取出');
    renderSavings();
  });
  document.getElementById('pouch-amount').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('pouch-confirm').click(); });

  // Review tabs
  document.querySelectorAll('.review-tab[data-rtab]').forEach(btn => btn.addEventListener('click', () => {
    state.activeReviewTab = btn.dataset.rtab;
    document.querySelectorAll('.review-tab[data-rtab]').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.review-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`review-panel-${state.activeReviewTab}`).classList.add('active');
    renderReview();
  }));

  // Daily review date nav
  document.getElementById('prev-review-day').addEventListener('click', () => { state.reviewDate = addDays(state.reviewDate, -1); renderDailyReview(); });
  document.getElementById('next-review-day').addEventListener('click', () => { state.reviewDate = addDays(state.reviewDate, 1); renderDailyReview(); });
  document.querySelectorAll('#rating-row .rating-btn').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('#rating-row .rating-btn').forEach(x => x.classList.remove('active')); b.classList.add('active'); }));
  document.getElementById('save-review-btn').addEventListener('click', saveDailyReview);

  // Weekly review nav
  document.getElementById('prev-review-week').addEventListener('click', () => { state.reviewWeekRef = addDays(state.reviewWeekRef, -7); renderWeeklyReview(); });
  document.getElementById('next-review-week').addEventListener('click', () => { state.reviewWeekRef = addDays(state.reviewWeekRef, 7); renderWeeklyReview(); });
  document.querySelectorAll('#weekly-rating-row .rating-btn').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('#weekly-rating-row .rating-btn').forEach(x => x.classList.remove('active')); b.classList.add('active'); }));
  document.getElementById('save-weekly-review-btn').addEventListener('click', saveWeeklyReview);

  // Monthly review nav
  document.getElementById('prev-review-month').addEventListener('click', () => { state.reviewMonthRef = new Date(state.reviewMonthRef.getFullYear(), state.reviewMonthRef.getMonth()-1, 1); renderMonthlyReview(); });
  document.getElementById('next-review-month').addEventListener('click', () => { state.reviewMonthRef = new Date(state.reviewMonthRef.getFullYear(), state.reviewMonthRef.getMonth()+1, 1); renderMonthlyReview(); });
  document.querySelectorAll('#monthly-rating-row .rating-btn').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('#monthly-rating-row .rating-btn').forEach(x => x.classList.remove('active')); b.classList.add('active'); }));
  document.getElementById('save-monthly-review-btn').addEventListener('click', saveMonthlyReview);

  // Yearly review nav
  document.getElementById('prev-review-year').addEventListener('click', () => { state.reviewYearRef = new Date(state.reviewYearRef.getFullYear()-1, 0, 1); renderYearlyReview(); });
  document.getElementById('next-review-year').addEventListener('click', () => { state.reviewYearRef = new Date(state.reviewYearRef.getFullYear()+1, 0, 1); renderYearlyReview(); });
  document.querySelectorAll('#yearly-rating-row .rating-btn').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('#yearly-rating-row .rating-btn').forEach(x => x.classList.remove('active')); b.classList.add('active'); }));
  document.getElementById('save-yearly-review-btn').addEventListener('click', saveYearlyReview);

  // Health tabs
  document.querySelectorAll('.review-tab[data-htab]').forEach(btn => btn.addEventListener('click', () => {
    state.activeHealthTab = btn.dataset.htab;
    document.querySelectorAll('.review-tab[data-htab]').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.review-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(`health-panel-${state.activeHealthTab}`);
    if (panel) panel.classList.add('active');
    renderHealth();
  }));

  // Weight
  document.getElementById('weight-add').addEventListener('click', () => {
    const date = document.getElementById('weight-date').value;
    const value = document.getElementById('weight-value').value;
    const note = document.getElementById('weight-note').value.trim();
    if (!date) { showToast('请选择日期'); return; }
    if (!value || parseFloat(value) <= 0) { showToast('请输入有效体重'); return; }
    addWeightRecord(date, value, note);
    document.getElementById('weight-value').value = ''; document.getElementById('weight-note').value = '';
    document.getElementById('weight-value').focus();
  });
  document.getElementById('weight-value').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('weight-add').click(); });

  // Cycle
  document.getElementById('cycle-add').addEventListener('click', () => {
    const startDate = document.getElementById('cycle-start').value;
    const days = document.getElementById('cycle-days').value;
    const note = document.getElementById('cycle-note').value.trim();
    if (!startDate) { showToast('请选择开始日期'); return; }
    addCycleRecord(startDate, days, note);
    document.getElementById('cycle-note').value = '';
    document.getElementById('cycle-start').focus();
  });

  // Reviews (film) tabs
  document.querySelectorAll('.review-tab[data-vtab]').forEach(btn => btn.addEventListener('click', () => {
    state.activeReviewsTab = btn.dataset.vtab;
    document.querySelectorAll('.review-tab[data-vtab]').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('#view-reviews .review-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('reviews-panel-' + state.activeReviewsTab);
    if (panel) panel.classList.add('active');
    if (state.activeReviewsTab === 'discover') renderDiscoverPanel();
  }));

  // Star rating
  document.querySelectorAll('#rv-stars .star-btn').forEach(btn => btn.addEventListener('click', () => {
    state.rvStarRating = parseInt(btn.dataset.v);
    updateStarDisplay(state.rvStarRating);
  }));

  // Review submit
  document.getElementById('rv-submit').addEventListener('click', () => {
    const title = document.getElementById('rv-title').value.trim();
    const type = document.getElementById('rv-type').value;
    const date = document.getElementById('rv-date').value;
    const tags = document.getElementById('rv-tags').value.trim();
    const content = document.getElementById('rv-content').value.trim();
    if (!title) { showToast('请输入影视名称'); return; }
    if (state.rvStarRating === 0) { showToast('请选择评分'); return; }
    addFilmReview(title, type, date, state.rvStarRating, tags, content);
    document.getElementById('rv-title').value = '';
    document.getElementById('rv-tags').value = '';
    document.getElementById('rv-content').value = '';
    state.rvStarRating = 0;
    updateStarDisplay(0);
  });
  document.getElementById('rv-content').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) document.getElementById('rv-submit').click(); });

  // Discover search/sort/filter
  document.getElementById('rv-search').addEventListener('input', renderDiscoverPanel);
  document.getElementById('rv-filter').addEventListener('change', renderDiscoverPanel);
  document.getElementById('rv-sort').addEventListener('change', renderDiscoverPanel);

  // Calendar month navigation
  document.getElementById('prev-cal-month').addEventListener('click', () => { state.selectedCalMonth = new Date(state.selectedCalMonth.getFullYear(), state.selectedCalMonth.getMonth()-1, 1); renderCalendarView(); });
  document.getElementById('next-cal-month').addEventListener('click', () => { state.selectedCalMonth = new Date(state.selectedCalMonth.getFullYear(), state.selectedCalMonth.getMonth()+1, 1); renderCalendarView(); });
  document.getElementById('this-cal-month-btn').addEventListener('click', () => { state.selectedCalMonth = new Date(); renderCalendarView(); });

  // Calendar annotation
  document.getElementById('cal-anno-btn').addEventListener('click', () => {
    const r = document.getElementById('cal-anno-row');
    r.style.display = r.style.display === 'none' ? 'flex' : 'none';
    if (r.style.display === 'flex') {
      document.getElementById('cal-anno-text').focus();
      document.getElementById('cal-anno-start').value = getDateKey(new Date());
      document.getElementById('cal-anno-end').value = getDateKey(new Date());
    }
  });
  document.getElementById('cal-anno-confirm').addEventListener('click', () => {
    const text = document.getElementById('cal-anno-text').value.trim();
    const start = document.getElementById('cal-anno-start').value;
    const end = document.getElementById('cal-anno-end').value;
    if (!text) { showToast('请输入标注内容'); return; }
    if (!start || !end) { showToast('请选择日期'); return; }
    if (new Date(end) < new Date(start)) { showToast('结束日期不能早于开始日期'); return; }
    addCalAnnotation(text, start, end);
    document.getElementById('cal-anno-text').value = '';
    showToast('标注已添加');
  });
  document.getElementById('cal-anno-text').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('cal-anno-confirm').click(); });

  // Keyboard shortcuts (1-9 for 9 views)
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    const views = ['daily','weekly','monthly','bills','savings','review','health','reviews','calendar'];
    const key = parseInt(e.key);
    if (key >= 1 && key <= 9) switchView(views[key-1]);
  });
}

// ====== Init ======
function bindMobileNav() {
  document.querySelectorAll('.mnav-item').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}

function setupLoginUI() {
  const btn = document.getElementById('login-btn');
  const input = document.getElementById('login-password');
  const error = document.getElementById('login-error');
  const sub = document.getElementById('login-sub');
  const urlInput = document.getElementById('supabase-url');
  const keyInput = document.getElementById('supabase-key');
  const setupDiv = document.getElementById('supabase-setup');

  if (urlInput) urlInput.value = SyncManager.supabaseUrl;
  if (keyInput) keyInput.value = SyncManager.supabaseKey;

  async function doLogin() {
    const password = input.value;
    error.textContent = '';

    // If Supabase setup is visible, save config first
    if (setupDiv && setupDiv.style.display !== 'none') {
      const url = urlInput.value.trim().replace(/\/+$/, '');
      const key = keyInput.value.trim();
      if (!url || !key) { error.textContent = '请填写完整的 Supabase 地址和 Key'; return; }
      btn.textContent = '连接中...'; btn.disabled = true;
      SyncManager.supabaseUrl = url;
      SyncManager.supabaseKey = key;
      const config = await SyncManager.checkServer();
      if (config === null) {
        error.textContent = '连接失败，请检查地址和 Key';
        btn.textContent = '进入'; btn.disabled = false;
        return;
      }
      localStorage.setItem('amina_supabase_url', url);
      localStorage.setItem('amina_supabase_key', key);
      SyncManager.showPasswordInput(config.length > 0);
      btn.textContent = '进入'; btn.disabled = false;
      if (input) input.focus();
      return;
    }

    // Password login / setup
    if (!password || password.length < 4) { error.textContent = '密码至少4位'; return; }
    btn.textContent = '请稍候...'; btn.disabled = true;
    try {
      const result = await SyncManager.login(password);
      SyncManager.hideLogin();
      await SyncManager.pull();
      SyncManager.startPeriodicSync();
      startApp();
    } catch (err) {
      error.textContent = err.message;
      btn.textContent = '进入'; btn.disabled = false;
    }
  }

  btn.onclick = doLogin;
  input.onkeydown = (e) => { if (e.key === 'Enter') doLogin(); };
  if (urlInput) urlInput.onkeydown = (e) => { if (e.key === 'Enter') doLogin(); };
  if (keyInput) keyInput.onkeydown = (e) => { if (e.key === 'Enter') doLogin(); };
}

function startApp() {
  migrateOldData();
  populateExpenseCategoryDropdowns();
  bindEvents();
  bindMobileNav();
  updateClock();
  setInterval(updateClock, 1000);
  renderDaily();
}

async function init() {
  await SyncManager.init();
  setupLoginUI();
}
document.addEventListener('DOMContentLoaded', init);
