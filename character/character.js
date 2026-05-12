document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('save-btn');
    const statsForm = document.getElementById('stats-form');
    const skillsForm = document.getElementById('skills-form');
    const toast = document.getElementById('toast');
    const playerTabs = document.querySelectorAll('.player-tab');
    const joinToggleContainer = document.getElementById('join-toggle-container');
    const joinCombatToggle = document.getElementById('join-combat-toggle');

    let currentPlayer = 1;
    const getStorageKey = (p) => `sfl_battle_stats_${p}`;

    // 能力與技能預設值
    const DEFAULT_STATS = {
        isEnabled: true, // 預設 P1 是啟用的
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
    
    // P2, P3 預設不加入
    const DEFAULT_STATS_P2 = { ...DEFAULT_STATS, isEnabled: false };
    const DEFAULT_STATS_P3 = { ...DEFAULT_STATS, isEnabled: false };

    window.CHARACTER_DEFAULT_STATS = DEFAULT_STATS;

    const statKeys = Object.keys(DEFAULT_STATS).filter(k => k !== 'isEnabled');

    function loadPlayerStats(playerNum) {
        const savedData = localStorage.getItem(getStorageKey(playerNum));
        let stats = playerNum === 1 ? DEFAULT_STATS : (playerNum === 2 ? DEFAULT_STATS_P2 : DEFAULT_STATS_P3);

        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                stats = { ...stats, ...parsed };
            } catch (e) {
                console.error(`Error loading stats for P${playerNum}:`, e);
            }
        }

        // 更新 UI
        statKeys.forEach(key => {
            const input = document.getElementById(key);
            if (input) {
                input.value = (stats[key] !== undefined && stats[key] !== '') ? stats[key] : stats[key];
            }
        });

        // 處理加入開關
        if (playerNum > 1) {
            joinToggleContainer.style.display = 'flex';
            joinCombatToggle.checked = !!stats.isEnabled;
        } else {
            joinToggleContainer.style.display = 'none';
        }
    }

    function saveCurrentPlayerStats(e) {
        if (e) e.preventDefault();
        
        const savedData = localStorage.getItem(getStorageKey(currentPlayer));
        let currentStats = {};
        if (savedData) {
            try { currentStats = JSON.parse(savedData); } catch (e) { }
        }

        const stats = { ...currentStats };
        
        // 取得基本數值
        statKeys.forEach(key => {
            const input = document.getElementById(key);
            if (input) {
                stats[key] = input.value !== '' ? Number(input.value) : stats[key];
            }
        });

        // 取得開關數值
        if (currentPlayer > 1) {
            stats.isEnabled = joinCombatToggle.checked;
        } else {
            stats.isEnabled = true; // P1 總是啟用
        }

        localStorage.setItem(getStorageKey(currentPlayer), JSON.stringify(stats));
        showToast(`玩家 ${currentPlayer} 設定已保存！`);
    }

    function switchPlayer(playerNum) {
        // 先存目前的
        // saveCurrentPlayerStats(); // 不自動存，讓使用者點保存

        currentPlayer = playerNum;
        
        // 更新 Tab 樣式
        playerTabs.forEach(btn => {
            if (parseInt(btn.dataset.player) === playerNum) {
                btn.classList.add('active');
                btn.style.background = 'var(--accent-color)';
                btn.style.color = '#000';
            } else {
                btn.classList.remove('active');
                btn.style.background = 'transparent';
                btn.style.color = '#888';
            }
        });

        loadPlayerStats(playerNum);
    }

    function showToast(message = '設定已保存！') {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function resetStats() {
        if (confirm(`確定要將 玩家 ${currentPlayer} 的能力值恢復到預設嗎？`)) {
            const def = currentPlayer === 1 ? DEFAULT_STATS : (currentPlayer === 2 ? DEFAULT_STATS_P2 : DEFAULT_STATS_P3);
            localStorage.setItem(getStorageKey(currentPlayer), JSON.stringify(def));
            loadPlayerStats(currentPlayer);
            showToast(`玩家 ${currentPlayer} 已恢復預設`);
        }
    }

    // 事件監聽
    playerTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            switchPlayer(parseInt(btn.dataset.player));
        });
    });

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetStats);

    saveBtn.addEventListener('click', saveCurrentPlayerStats);
    statsForm.addEventListener('submit', saveCurrentPlayerStats);
    if (skillsForm) skillsForm.addEventListener('submit', saveCurrentPlayerStats);

    // 初始載入玩家 1
    switchPlayer(1);
});
