document.addEventListener('DOMContentLoaded', function () {
    const toggle = document.getElementById('detailed-settings-toggle');

    // Populate card selects from database with dynamic bonus text
    function populateCardSelects() {
        if (!window.SFL_CARDS_DB) return;

        for (let i = 1; i <= 5; i++) {
            const select = document.getElementById(`card-slot-${i}`);
            const level = document.getElementById(`card-lv-${i}`)?.value || 5;
            if (!select) continue;

            const currentValue = select.value;
            select.innerHTML = '<option value="">請選擇卡片</option>';
            
            window.SFL_CARDS_DB.forEach(card => {
                const option = document.createElement('option');
                option.value = card.id;
                
                // 根據當前等級生成數值提示
                let bonusParts = [];
                const bonus = card.value && card.value[level];
                if (bonus) {
                    if (bonus.hp) bonusParts.push(`血+${bonus.hp}`);
                    if (bonus.attack) bonusParts.push(`攻+${bonus.attack}`);
                    if (bonus.luck) bonusParts.push(`運+${bonus.luck}`);
                    if (bonus.atk_speed) bonusParts.push(`速+${bonus.atk_speed}`);
                    if (bonus.shield) bonusParts.push(`盾+${bonus.shield}`);
                    if (bonus.evade) bonusParts.push(`迴+${Math.round(bonus.evade * 100)}%`);
                    if (bonus.accuracy) bonusParts.push(`命+${Math.round(bonus.accuracy * 100)}%`);
                    if (bonus.penetrate) bonusParts.push(`穿+${bonus.penetrate}`);
                    if (bonus.other_bonus) bonusParts.push(`傷+${Math.round(bonus.other_bonus * 100)}%`);
                }
                const bonusStr = bonusParts.length > 0 ? ` [${bonusParts.join(', ')}]` : '';
                option.textContent = card.name + bonusStr;
                select.appendChild(option);
            });
            
            select.value = currentValue;
        }
    }

    // Wait a bit for database to load if necessary
    if (window.SFL_CARDS_DB) {
        populateCardSelects();
    } else {
        setTimeout(populateCardSelects, 500);
    }

    if (toggle) {
        toggle.addEventListener('change', function () {
            const isChecked = this.checked;
            const body = document.getElementById('detailed-settings-body');
            const statForm = document.getElementById('stats-form');
            const statInputs = statForm.querySelectorAll('input');

            if (isChecked) {
                body.style.display = 'block';
                statForm.classList.add('locked');
                statInputs.forEach(input => {
                    // 排除等級欄位 (ID 為 level)，讓它在鎖定模式下依然可以輸入
                    if (input.id !== 'level') {
                        input.disabled = true;
                    }
                });
                populateCardSelects(); // 開啟時確保文字最新
                updateFinalStatsFromDetailed(); // 切換時立即計算
            } else {
                body.style.display = 'none';
                statForm.classList.remove('locked');
                statInputs.forEach(input => input.disabled = false);
            }
        });
    }

    // 新增：細項設定自動計算邏輯
    function updateFinalStatsFromDetailed() {
        if (!toggle || !toggle.checked) return;

        const baseStats = {
            hp: 5, attack: 20, luck: 10, atk_speed: 100,
            shield: 0, evasion: 10, hit_rate: 100, shield_pen: 0, bonus_dmg: 0
        };

        // 1. 加入加點數值
        baseStats.hp += Number(document.getElementById('detail-hp')?.value || 0);
        baseStats.attack += Number(document.getElementById('detail-attack')?.value || 0);
        baseStats.luck += Number(document.getElementById('detail-luck')?.value || 0);
        baseStats.atk_speed += Number(document.getElementById('detail-atk_speed')?.value || 0);

        // 2. 加入卡片加成
        for (let i = 1; i <= 5; i++) {
            const cardId = document.getElementById(`card-slot-${i}`)?.value;
            const level = document.getElementById(`card-lv-${i}`)?.value;

            if (cardId && level && window.SFL_CARDS_DB) {
                const cardData = window.SFL_CARDS_DB.find(c => c.id === cardId);
                if (cardData && cardData.value && cardData.value[level]) {
                    const bonus = cardData.value[level];
                    
                    // 計算並累加
                    if (bonus.hp) baseStats.hp += bonus.hp;
                    if (bonus.attack) baseStats.attack += bonus.attack;
                    if (bonus.luck) baseStats.luck += bonus.luck;
                    if (bonus.atk_speed) baseStats.atk_speed += bonus.atk_speed;
                    if (bonus.shield) baseStats.shield += bonus.shield;
                    if (bonus.evade) baseStats.evasion += (bonus.evade * 100);
                    if (bonus.accuracy) baseStats.hit_rate += (bonus.accuracy * 100);
                    if (bonus.penetrate) baseStats.shield_pen += bonus.penetrate;
                    if (bonus.other_bonus) baseStats.bonus_dmg += (bonus.other_bonus * 100);
                }
            }
        }

        // 3. 更新主介面數值 (鎖定中的輸入框)
        const updateUI = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = Math.round(val);
        };

        updateUI('hp', baseStats.hp);
        updateUI('attack', baseStats.attack);
        updateUI('luck', baseStats.luck);
        updateUI('atk_speed', baseStats.atk_speed);
        updateUI('shield', baseStats.shield);
        updateUI('evasion', baseStats.evasion);
        updateUI('hit_rate', baseStats.hit_rate);
        updateUI('shield_pen', baseStats.shield_pen);
        updateUI('bonus_dmg', baseStats.bonus_dmg);
    }

    // 為所有細項輸入欄位綁定更新事件
    const detailedInputs = document.querySelectorAll('#card-detailed-settings input, #card-detailed-settings select');
    detailedInputs.forEach(input => {
        input.addEventListener('input', () => {
            // 如果是等級變更，需要重新生成卡片清單的文字
            if (input.id.includes('card-lv')) {
                populateCardSelects();
            }
            updateFinalStatsFromDetailed();
        });
        input.addEventListener('change', () => {
            if (input.id.includes('card-lv')) {
                populateCardSelects();
            }
            updateFinalStatsFromDetailed();
        });
    });

    // 暴露到全局供 loadout.js 調用
    window.populateCardSelects = populateCardSelects;
    window.updateFinalStatsFromDetailed = updateFinalStatsFromDetailed;
});
