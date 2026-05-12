document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('save-btn');
    const statsForm = document.getElementById('stats-form');
    const toast = document.getElementById('toast');

    const STORAGE_KEY = 'sfl_battle_stats';

    // 能力與技能預設值
    const DEFAULT_STATS = {
        level: 429,
        hp: 465,
        attack: 650,
        shield: 250,
        evasion: 10,
        hit_rate: 310,
        bonus_dmg: 130,
        luck: 110,
        atk_speed: 1050,
        shield_pen: 1050,
        star_value: 635,
        miasma_value: 100,
        // 技能列表
        '斬擊': 0, '火球術': 0, '暗影突襲': 0, '緊急治療': 0, '狂戰': 20,
        '烈火箭': 0, '石破': 0, '詛咒打擊': 0, '毒刃': 0, '烈焰劍': 0,
        '靈性冥視': 0, '狂雷擊': 0, '元素匯聚': 0, '酸液噴射': 0, '聖光之杖': 0,
        '終極一擊': 70, '神聖護盾': 0, '大治療術': 0, '曙光': 0, '潮汐一斬': 0,
        '侵蝕之觸': 0, '德魯伊風拳': 0, '聖輝斬': 0, '元素匯聚．強': 0, '絕對審判': 70,
        '疾雷脈衝': 0, '永恆之泉': 0, '會心': 0, '暗噬龍咒': 60, '星火滅世陣': 60,
        '虛空侵蝕': 70, '星碎滅劍': 0, '不滅意志': 0, '天雷神轟鳴': 70, '厄水侵蝕': 50,
        '靈魂庇佑': 0, '野蠻震盪': 0, '終絕爆破': 0, '星辰墜落': 25, '宙序裁決': 25,
        '星界終焉': 0, '艦船冷卻加成': 0
    };
    window.CHARACTER_DEFAULT_STATS = DEFAULT_STATS;

    const statKeys = Object.keys(DEFAULT_STATS);

    function loadStats() {
        const savedData = localStorage.getItem(STORAGE_KEY);
        let stats = DEFAULT_STATS;

        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                // 合併現有資料與預設值（確保新欄位也能有預設值）
                stats = { ...DEFAULT_STATS, ...parsed };
            } catch (e) {
                console.error('Error loading stats:', e);
            }
        }

        // 填入表單
        statKeys.forEach(key => {
            const input = document.getElementById(key);
            if (input) {
                // 如果是空值或 undefined，使用預設值
                input.value = (stats[key] !== undefined && stats[key] !== '') ? stats[key] : DEFAULT_STATS[key];
            }
        });
    }

    function saveStats(e) {
        if (e) e.preventDefault();
        const savedData = localStorage.getItem(STORAGE_KEY);
        let currentStats = {};
        if (savedData) {
            try { currentStats = JSON.parse(savedData); } catch (e) { }
        }

        const stats = { ...currentStats };
        statKeys.forEach(key => {
            const input = document.getElementById(key);
            if (input) {
                stats[key] = input.value !== '' ? Number(input.value) : DEFAULT_STATS[key];
            }
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
        showToast();
    }

    function showToast(message = '設定已保存！') {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function resetStats() {
        if (confirm('確定要將所有能力值恢復到預設嗎？這將會清除目前的所有設定並重新讀取系統預設值。')) {
            // 直接將系統預設值寫入 localStorage，避免需要額外點擊保存
            localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STATS));
            // 重新整理頁面以更新 UI 並讀取最新的系統邏輯 (加入時間戳強制重新載入，避免快取問題)
            window.location.href = window.location.pathname + '?t=' + Date.now();
        }
    }

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetStats);

    saveBtn.addEventListener('click', saveStats);
    statsForm.addEventListener('submit', saveStats);
    const skillsForm = document.getElementById('skills-form');
    if (skillsForm) skillsForm.addEventListener('submit', saveStats);
    loadStats();
});
