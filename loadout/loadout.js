/**
 * SFL Loadout Management System
 * Handles decoding and importing .sfl loadout files
 */

(function() {
    let decodedData = null;
    let skillDatabase = {};
    const cardDatabase = {};

    const BASE_STATS = {
        hp: 5,
        attack: 20,
        luck: 10,
        atk_speed: 100,
        shield: 0,
        evasion: 10,
        hit_rate: 100,
        shield_pen: 0,
        bonus_dmg: 0
    };

    // DOM Elements
    const loadBtn = document.getElementById('load-sfl-btn');
    const importBtn = document.getElementById('import-sfl-btn');
    const exportBtn = document.getElementById('export-sfl-btn');
    const fileInput = document.getElementById('sfl-file-input');
    const filenameDisplay = document.getElementById('sfl-filename');
    const loadoutInfo = document.getElementById('loadout-info');
    const statSelect = document.getElementById('stat-slot-select');
    const skillSelect = document.getElementById('skill-slot-select');
    const cardSelect = document.getElementById('card-slot-select');

    // Reverse mapping for skills
    const reverseSkillMap = {};

    // Initialize
    function init() {
        loadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileSelect);
        importBtn.addEventListener('click', importSelectedLoadouts);
        exportBtn.addEventListener('click', exportConfiguration);

        // Load Databases from local JS source
        if (window.SFL_SKILLS_DB) {
            window.SFL_SKILLS_DB.forEach(s => {
                skillDatabase[s.id] = s.name;
                reverseSkillMap[s.name] = s.id;
            });
        }
        if (window.SFL_CARDS_DB) {
            window.SFL_CARDS_DB.forEach(c => cardDatabase[c.id] = c.name);
        }
        
        console.log('Local databases loaded:', { 
            skills: Object.keys(skillDatabase).length, 
            cards: Object.keys(cardDatabase).length 
        });
    }

    init();

    /**
     * Decode SFL data (Logic from index/index)
     */
    function decodeSFLData(raw) {
        const str = raw.trim();
        if (str.startsWith('{')) return JSON.parse(str);
        if (!str.startsWith('SFL1:')) throw new Error('格式不正確 (Missing SFL1 header)');
        
        const parts = str.split(':');
        if (parts.length < 3) throw new Error('格式不正確 (Invalid parts)');
        
        const savedChecksum = parseInt(parts[1], 10);
        const b64 = parts.slice(2).join(':');
        const jsonStr = decodeURIComponent(escape(atob(b64)));
        
        // Verify checksum
        let checksum = 0;
        for (let i = 0; i < jsonStr.length; i += 7) { 
            checksum = (checksum + jsonStr.charCodeAt(i)) % 65521; 
        }
        
        if (checksum !== savedChecksum) {
            throw new Error('資料已被修改，校驗失敗 (Checksum mismatch)');
        }
        
        return JSON.parse(jsonStr);
    }

    /**
     * Encode SFL data
     */
    function encodeExportData(data) {
        const jsonStr = JSON.stringify(data);
        const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
        let checksum = 0;
        for (let i = 0; i < jsonStr.length; i += 7) { 
            checksum = (checksum + jsonStr.charCodeAt(i)) % 65521; 
        }
        return 'SFL1:' + checksum + ':' + b64;
    }

    /**
     * Handle file selection
     */
    async function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Reset UI
        filenameDisplay.textContent = `📄 ${file.name}`;
        loadoutInfo.textContent = '提示：請選擇要導入的分頁，然後點擊「導入設定」。';
        loadoutInfo.style.color = '#888';

        try {
            const text = await file.text();
            decodedData = decodeSFLData(text);
            
            populateDropdowns();
            
            // Enable controls
            statSelect.disabled = false;
            skillSelect.disabled = false;
            cardSelect.disabled = false;
            importBtn.disabled = false;
            exportBtn.disabled = false;
        } catch (e) {
            loadoutInfo.textContent = '⚠️ 載入失敗：' + e.message;
            loadoutInfo.style.color = '#f44747';
            filenameDisplay.textContent = '';
            console.error(e);
        }
    }

    /**
     * Populate dropdown menus from decoded data
     */
    function populateDropdowns() {
        // Stat Slots
        fillSelect(statSelect, decodedData.sfl_stat_slot_names, decodedData.sfl_stat_loadouts);
        // Skill Slots
        fillSelect(skillSelect, decodedData.sfl_skill_slot_names, decodedData.sfl_skill_loadouts);
        // Card Slots
        fillSelect(cardSelect, decodedData.sfl_card_slot_names, decodedData.sfl_card_loadouts);
    }

    function fillSelect(select, names, data) {
        select.innerHTML = '<option value="">-- 請選擇分頁 --</option>';
        if (!names) return;

        Object.entries(names).forEach(([id, name]) => {
            const hasData = data && data[id] !== null && data[id] !== undefined;
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = `${id}. ${name}`;
            
            if (!hasData) {
                // 如果沒資料，讓選項變灰
                opt.style.color = '#555';
            }
            
            select.appendChild(opt);
        });
    }

    /**
     * Import selected loadouts into the UI
     */
    function importSelectedLoadouts() {
        if (!decodedData) return;

        let importCount = 0;
        let finalStats = { ...BASE_STATS };

        let importNames = [];

        // 1. Get Stat Points from sfl_stat_loadouts
        const statId = statSelect.value;
        if (statId && decodedData.sfl_stat_loadouts[statId]) {
            const statPoints = decodedData.sfl_stat_loadouts[statId].stats;
            
            // 同步至細項設定
            updateInputValue('detail-hp', statPoints.hp || 0);
            updateInputValue('detail-attack', statPoints.attack || 0);
            updateInputValue('detail-luck', statPoints.luck || 0);
            updateInputValue('detail-atk_speed', statPoints.atk_speed || 0);

            // Add points to final stats
            finalStats.hp += (statPoints.hp || 0);
            finalStats.attack += (statPoints.attack || 0);
            finalStats.luck += (statPoints.luck || 0);
            finalStats.atk_speed += (statPoints.atk_speed || 0);
            
            const name = decodedData.sfl_stat_slot_names[statId] || statId;
            importNames.push(`能力[${name}]`);
            importCount++;
        }

        // 2. Import Skills
        const skillId = skillSelect.value;
        if (skillId && decodedData.sfl_skill_loadouts[skillId]) {
            const skills = decodedData.sfl_skill_loadouts[skillId].skills;
            Object.entries(skills).forEach(([id, lvl]) => {
                const skillName = skillDatabase[id];
                if (skillName) {
                    updateInputValue(skillName, lvl);
                } else {
                    // Try direct ID match
                    updateInputValue(id, lvl);
                }
            });
            const name = decodedData.sfl_skill_slot_names[skillId] || skillId;
            importNames.push(`技能[${name}]`);
            importCount++;
        }

        // 3. Get Card Bonuses from sfl_card_loadouts (always use level 5)
        const cardId = cardSelect.value;
        if (cardId && decodedData.sfl_card_loadouts[cardId]) {
            const cards = decodedData.sfl_card_loadouts[cardId].cards;
            
            // 同步至細項設定 (SFL 卡片預設為 5 等)
            Object.entries(cards).forEach(([slot, cid]) => {
                const slotNum = parseInt(slot);
                if (slotNum >= 1 && slotNum <= 5) {
                    updateInputValue(`card-slot-${slotNum}`, cid || '');
                    updateInputValue(`card-lv-${slotNum}`, 5);
                }
            });

            // Iterate through 5 card slots
            Object.values(cards).forEach(cardId => {
                if (!cardId) return;
                
                // Find card in local database
                const cardData = window.SFL_CARDS_DB ? window.SFL_CARDS_DB.find(c => c.id === cardId) : null;
                if (cardData && cardData.value && cardData.value["5"]) {
                    const bonus = cardData.value["5"];
                    
                    // Sum up bonuses
                    if (bonus.hp) finalStats.hp += bonus.hp;
                    if (bonus.attack) finalStats.attack += bonus.attack;
                    if (bonus.luck) finalStats.luck += bonus.luck;
                    if (bonus.atk_speed) finalStats.atk_speed += bonus.atk_speed;
                    if (bonus.shield) finalStats.shield += bonus.shield;
                    
                    // Map database keys to UI keys
                    if (bonus.evade) finalStats.evasion += (bonus.evade * 100); 
                    if (bonus.accuracy) finalStats.hit_rate += (bonus.accuracy * 100); 
                    if (bonus.penetrate) finalStats.shield_pen += bonus.penetrate;
                    if (bonus.other_bonus) finalStats.bonus_dmg += (bonus.other_bonus * 100);
                }
            });
            const name = decodedData.sfl_card_slot_names[cardId] || cardId;
            importNames.push(`卡片[${name}]`);
            importCount++;
        }

        // Apply Final Stats to UI
        if (statId || cardId) {
            // 自動開啟細項設定並同步
            const detailedToggle = document.getElementById('detailed-settings-toggle');
            if (detailedToggle && !detailedToggle.checked) {
                detailedToggle.checked = true;
                detailedToggle.dispatchEvent(new Event('change'));
            }

            // 更新細項介面顯示
            if (window.populateCardSelects) window.populateCardSelects();
            if (window.updateFinalStatsFromDetailed) window.updateFinalStatsFromDetailed();

            updateInputValue('hp', Math.round(finalStats.hp));
            updateInputValue('attack', Math.round(finalStats.attack));
            updateInputValue('luck', Math.round(finalStats.luck));
            updateInputValue('atk_speed', Math.round(finalStats.atk_speed));
            updateInputValue('shield', Math.round(finalStats.shield));
            updateInputValue('evasion', Math.round(finalStats.evasion));
            updateInputValue('hit_rate', Math.round(finalStats.hit_rate));
            updateInputValue('shield_pen', Math.round(finalStats.shield_pen));
            updateInputValue('bonus_dmg', Math.round(finalStats.bonus_dmg));
        }

        if (importCount > 0) {
            loadoutInfo.textContent = `✅ 已成功導入 ${importNames.join('、')} 配置！請記得點擊「保存設定」以更新數據。`;
            loadoutInfo.style.color = '#4ec9b0';
        } else {
            loadoutInfo.textContent = '⚠️ 請至少選擇一個分頁進行導入。';
            loadoutInfo.style.color = '#fb923c';
        }
    }

    /**
     * Export current simulator settings back to a .sfl file
     */
    function exportConfiguration() {
        if (!decodedData) return;

        // 增加確認窗
        const isConfirmed = confirm('您確定要將目前的「細項設定」與「技能等級」寫回並匯出新的 SFL 檔案嗎？\n\n這將會更新您目前選中的分頁槽位。');
        if (!isConfirmed) return;

        const statId = statSelect.value;
        const skillId = skillSelect.value;
        const cardId = cardSelect.value;

        if (!statId && !skillId && !cardId) {
            alert('請至少選擇一個分頁作為匯出的目標槽位。');
            return;
        }

        const now = Date.now();

        // 1. Update Stats (Detailed Settings)
        if (statId) {
            const stats = {
                hp: Number(document.getElementById('detail-hp')?.value || 0),
                attack: Number(document.getElementById('detail-attack')?.value || 0),
                luck: Number(document.getElementById('detail-luck')?.value || 0),
                atk_speed: Number(document.getElementById('detail-atk_speed')?.value || 0)
            };
            if (!decodedData.sfl_stat_loadouts[statId]) {
                decodedData.sfl_stat_loadouts[statId] = { stats: {}, playerLevel: 429, availableStatPoints: 0 };
            }
            decodedData.sfl_stat_loadouts[statId].stats = stats;
            decodedData.sfl_stat_loadouts[statId].timestamp = now;
        }

        // 2. Update Skills (Skill Form)
        if (skillId) {
            if (!decodedData.sfl_skill_loadouts[skillId]) {
                decodedData.sfl_skill_loadouts[skillId] = { skills: {}, playerLevel: 429, totalSkillPoints: 0 };
            }
            const currentSkills = decodedData.sfl_skill_loadouts[skillId].skills;
            
            // 對原本資料中所有的技能 Key 進行更新，若 UI 沒列出則設為 0
            Object.keys(currentSkills).forEach(sId => {
                const sName = skillDatabase[sId];
                if (sName) {
                    const uiInput = document.getElementById(sName);
                    currentSkills[sId] = uiInput ? Number(uiInput.value || 0) : 0;
                } else {
                    currentSkills[sId] = 0;
                }
            });

            // 另外檢查 UI 中是否有新的技能不在原本檔案中
            Object.entries(reverseSkillMap).forEach(([sName, sId]) => {
                if (currentSkills[sId] === undefined) {
                    const uiInput = document.getElementById(sName);
                    if (uiInput) currentSkills[sId] = Number(uiInput.value || 0);
                }
            });

            decodedData.sfl_skill_loadouts[skillId].timestamp = now;
        }

        // 3. Update Cards (Card Slots)
        if (cardId) {
            if (!decodedData.sfl_card_loadouts[cardId]) {
                decodedData.sfl_card_loadouts[cardId] = { cards: {} };
            }
            const currentCards = {};
            for (let i = 1; i <= 5; i++) {
                currentCards[i.toString()] = document.getElementById(`card-slot-${i}`)?.value || null;
            }
            decodedData.sfl_card_loadouts[cardId].cards = currentCards;
            decodedData.sfl_card_loadouts[cardId].timestamp = now;
        }

        try {
            // Encode
            const encoded = encodeExportData(decodedData);
            
            // Download file
            const blob = new Blob([encoded], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const originalName = filenameDisplay.textContent.replace('📄 ', '').replace('.sfl', '') || 'export';
            a.href = url;
            a.download = `${originalName}_modified.sfl`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            loadoutInfo.textContent = '✅ 配置匯出成功！';
            loadoutInfo.style.color = '#4ec9b0';
        } catch (e) {
            console.error('Export error:', e);
            alert('匯出失敗：' + e.message);
        }
    }

    function updateInputValue(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.value = value;
            // Trigger change event if needed
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

})();
