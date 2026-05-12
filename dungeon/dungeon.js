document.addEventListener('DOMContentLoaded', () => {
    const selectionGrid = document.getElementById('enemy-selection-grid');
    const detailView = document.getElementById('challenge-detail-view');
    const backBtn = document.getElementById('btn-back');
    const enemyNameTitle = document.getElementById('view-enemy-name');
    const logDisplay = document.getElementById('log-display');
    const repeatInput = document.getElementById('input-repeat-count');
    const startBtn = document.getElementById('btn-start-challenge');
    const singleBtn = document.getElementById('btn-single-test');
    
    const winRateEl = document.getElementById('stat-win-rate');
    const totalRunsEl = document.getElementById('stat-total');

    const STORAGE_KEY = 'sfl_battle_stats';
    let currentEnemy = null;
    let isRunning = false;

    // 1. 初始化列表
    function init() {
        if (typeof ENEMY_DATABASE === 'undefined') {
            selectionGrid.innerHTML = '<div style="color:#f44747; padding:40px; text-align:center;">錯誤：找不到 ENEMY_DATABASE</div>';
            return;
        }

        selectionGrid.innerHTML = '';
        ENEMY_DATABASE.forEach(enemy => {
            const card = document.createElement('div');
            card.className = 'enemy-card';
            card.innerHTML = `
                <div class="level-tag">等級 ${enemy.level}</div>
                <h3>${enemy.name}</h3>
                <div class="desc">${enemy.description || '暫無描述'}</div>
                <div style="margin-top:20px; display:flex; flex-wrap:wrap; gap:10px;">
                    <span style="font-size:0.8rem; color:#888;">生命: <b style="color:#fff;">${enemy.hp.toLocaleString()}</b></span>
                    <span style="font-size:0.8rem; color:#888;">攻擊: <b style="color:#fff;">${enemy.attack.toLocaleString()}</b></span>
                </div>
            `;
            card.onclick = () => showDetail(enemy);
            selectionGrid.appendChild(card);
        });
    }

    // 2. 顯示詳情
    function showDetail(enemy) {
        currentEnemy = enemy;
        selectionGrid.style.display = 'none';
        detailView.style.display = 'block';
        enemyNameTitle.textContent = enemy.name;
        logDisplay.innerHTML = `<div class="log-entry log-info">已載入 ${enemy.name} 的數據。準備開始模擬。</div>`;
        updateStats(0, 0);
    }

    // 3. 返回列表
    backBtn.onclick = () => {
        if (isRunning) return;
        detailView.style.display = 'none';
        selectionGrid.style.display = 'grid';
        currentEnemy = null;
    };

    function updateStats(wins, total) {
        totalRunsEl.textContent = total;
        const rate = total === 0 ? 0 : (wins / total * 100).toFixed(1);
        winRateEl.textContent = `${rate}%`;
    }

    function battleLog(msg, type = 'info') {
        const div = document.createElement('div');
        div.className = `log-entry log-${type}`;
        div.innerHTML = msg;
        logDisplay.appendChild(div);
        logDisplay.scrollTop = logDisplay.scrollHeight;
    }

    // 4. 戰鬥核心模擬
    function runBattle(player, enemy, verbose = false) {
        let p = { ...player };
        let e = { ...enemy };

        // --- 技能初始化 ---
        p.ownedSkills = [];
        if (typeof ATTACK_SKILLS_DATA !== 'undefined') {
            const hasStrong = p['元素匯聚．強'] && p['元素匯聚．強'] > 0;
            for (const skillName in ATTACK_SKILLS_DATA) {
                if (skillName === '普攻') continue;
                // 有強版則不帶弱版
                if (skillName === '元素匯聚' && hasStrong) continue;
                const lv = p[skillName];
                if (lv && lv > 0) {
                    p.ownedSkills.push({
                        name: skillName,
                        lv: lv,
                        data: ATTACK_SKILLS_DATA[skillName]
                    });
                }
            }
        }
        p.skillCDs = {};
        p.activeDots = [];
        e.activeDots = [];
        p.activeDebuffs = [];
        e.activeDebuffs = [];
        p.pendingSkill = null; // 儲蓄中的技能

        // 輔助函式：取得減益倍率
        const getDebuffMulti = (target, attr) => {
            if (!target.activeDebuffs) return 1.0;
            let multi = 1.0;
            target.activeDebuffs.forEach(d => {
                if (d.attr === attr) multi *= (1 - d.effect);
            });
            return multi;
        };



        // 輔助函式：取得屬性倍率 (處理多屬性情況)
        const getFinalAttrMulti = (atkAttrStr, defAttrStr) => {
            if (typeof window.getAttributeMultiplier !== 'function') return 1.0;
            const atkAttrs = (atkAttrStr || '無').split(/[、,]/);
            const defAttrs = (defAttrStr || '無').split(/[、,]/);
            let best = 1.0;
            let worst = 1.0;
            let hasAdv = false;
            for (const aa of atkAttrs) {
                for (const da of defAttrs) {
                    const m = window.getAttributeMultiplier(aa.trim(), da.trim());
                    if (m > 1 && m > best) { best = m; hasAdv = true; }
                    if (m < 1 && m < worst) worst = m;
                }
            }
            return hasAdv ? best : worst;
        };

        // 輔助函式：執行 DOT
        const processDots = (target, nameTag, isVerbose) => {
            if (!target.activeDots || target.activeDots.length === 0) return;
            target.activeDots.forEach(dot => {
                if (dot.dur > 0) {
                    target.hp -= dot.dmg;
                    dot.dur--;
                    if (isVerbose) battleLog(`[${nameTag}] ${dot.name} 造成 ${Math.floor(dot.dmg).toLocaleString()} 持續傷害 (剩餘 ${dot.dur} 回合)`, 'fail');
                    
                    // 紀錄蓄力期間受傷
                    if (target === p && p.pendingSkill) {
                        p.pendingSkill.damageTaken += dot.dmg;
                    }
                }
            });
            target.activeDots = target.activeDots.filter(d => d.dur > 0);
        };

        // 輔助函式：執行 Debuff 結算
        const processDebuffs = (target, nameTag, isVerbose) => {
            if (!target.activeDebuffs || target.activeDebuffs.length === 0) return;
            target.activeDebuffs.forEach(d => {
                if (d.dur > 0) d.dur--;
            });
            const expired = target.activeDebuffs.filter(d => d.dur <= 0);
            if (isVerbose && expired.length > 0) {
                expired.forEach(d => battleLog(`[${nameTag}] ${d.name} 效果已消失`, 'info'));
            }
            target.activeDebuffs = target.activeDebuffs.filter(d => d.dur > 0);
        };

        
        // 1. 護盾減傷與生命倍化計算 (玩家生存面)
        const bossShieldPen = e.shield_pen || 0;
        const playerShield = p.shield || 0;
        // 護盾減傷 = min((護盾值 - 穿透值) × 0.001, 0.99)，最低為 0
        const pMitigation = Math.min(Math.max(0, (playerShield - bossShieldPen) * 0.001), 0.99);
        
        // 未減傷部分轉換為生命倍化 (100%未減傷時倍化50倍)
        const hpMulti = (1 - pMitigation) * 50;
        const finalHpMulti = pMitigation >= 0.99 ? 1 : hpMulti; // 護盾流(99%+)不獲得加成
        
        // 實際生命值 = 生命值 * (20 + (LV - 1)) * 生命倍化
        const baseHp = p.hp || 5;
        const lv = p.level || 1;
        p.maxHp = baseHp * (20 + (lv - 1)) * finalHpMulti;
        p.hp = p.maxHp;

        // 2. 敵方護盾減傷計算 (玩家攻擊面)
        const pShieldPen = p.shield_pen || 0;
        const bossShield = e.shield || 0;
        const eMitigation = Math.min(Math.max(0, (bossShield - pShieldPen) * 0.001), 0.99);

        // 3. 攻擊倍率 (攻速闊值階梯)
        const speedRatio = p.atk_speed / (e.atk_speed || 200);
        const pAtkMulti = Math.max(1, Math.floor(speedRatio));
        
        // 4. 屬性限制
        p.evasion = Math.min(98, p.evasion || 0);
        e.evasion = Math.min(98, e.evasion || 0);
        
        // 5. 等級差距倍率 (等差傷害)
        const pLv = p.level || 1;
        const eLv = e.level || 1;
        const getLvMulti = (attackerLv, defenderLv) => {
            const diff = attackerLv - defenderLv;
            if (diff >= 7) return 1.5;
            if (diff <= -7) return 0.5;
            return 1.0 + (diff * (0.5 / 7));
        };
        const pLvMulti = getLvMulti(pLv, eLv);
        const eLvMulti = getLvMulti(eLv, pLv);

        let round = 1;
        const maxRounds = 30; // 多人副本限制 30 回合

        if (verbose) {
            battleLog(`--- 戰鬥開始 (多人副本模式) ---`, 'info');
            battleLog(`[資訊] 實際生命值: ${Math.floor(p.hp).toLocaleString()} (倍化: ${finalHpMulti.toFixed(1)}x)`, 'info');
            battleLog(`[資訊] 玩家減傷: ${(pMitigation * 100).toFixed(1)}% | 敵方減傷: ${(eMitigation * 100).toFixed(1)}%`, 'info');
            battleLog(`[資訊] 攻擊倍率: ${pAtkMulti}x | 攻速比: ${speedRatio.toFixed(2)}`, 'info');
            battleLog(`[資訊] 等差倍率: 玩家 ${pLvMulti.toFixed(2)}x | 敵方 ${eLvMulti.toFixed(2)}x`, 'info');
            battleLog(`--------------------------------`, 'info');
        }

        // 模擬戰鬥前處理 (如有 PartnerSystem)
        if (window.PartnerSystem) {
            window.PartnerSystem.applyPreBattle(p, e);
        }

        while (p.hp > 0 && e.hp > 0 && round <= maxRounds) {
            if (verbose) battleLog(`第 ${round} 回合`, 'round');

            // 1. 每回合開始：計算 DOT
            processDots(p, '玩家', verbose);
            processDots(e, '敵方', verbose);
            if (p.hp <= 0 || e.hp <= 0) break;

            // 2. 每回合開始：冷卻減少與 Debuff 減少
            for (const sName in p.skillCDs) {
                if (p.skillCDs[sName] > 0) p.skillCDs[sName]--;
            }
            processDebuffs(p, '玩家', verbose);
            processDebuffs(e, '敵方', verbose);

            // 3. 每回合開始：處理待施放技能 (元素匯聚)
            if (p.pendingSkill) {
                p.pendingSkill.countdown--;
                if (p.pendingSkill.countdown <= 0) {
                    const ps = p.pendingSkill;
                    const limit = p.maxHp * 0.05;
                    if (ps.damageTaken <= limit) {
                        // 觸發真實傷害
                        const sData = ps.data;
                        const sLv = ps.lv;
                        const trueDmg = typeof sData.multi === 'function' ? sData.multi(sLv, p) : (sData.multi || 0);
                        
                        e.hp -= trueDmg;
                        if (verbose) battleLog(`[玩家] 💥 ${ps.name} 能量爆發！造成 ${Math.floor(trueDmg).toLocaleString()} 真實傷害 (累積受傷: ${Math.floor(ps.damageTaken).toLocaleString()})`, 'success');
                    } else if (verbose) {
                        battleLog(`[玩家] ❌ ${ps.name} 蓄力失敗！受傷過多 (${Math.floor(ps.damageTaken).toLocaleString()} > 5% HP)`, 'fail');
                    }
                    p.pendingSkill = null;
                }
            }

            // 判斷手順：攻速高者先攻
            const playerFirst = (p.atk_speed || 0) >= (e.atk_speed || 0);
            const attackers = playerFirst ? ['player', 'enemy'] : ['enemy', 'player'];

            for (const type of attackers) {
                // 即時計算受 Debuff 影響的數值
                const pAtk = p.attack * getDebuffMulti(p, 'attack');
                const pSpeed = p.atk_speed * getDebuffMulti(p, 'speed');
                const pEva = p.evasion * getDebuffMulti(p, 'evasion');
                
                const eAtk = e.attack * getDebuffMulti(e, 'attack');
                const eSpeed = e.atk_speed * getDebuffMulti(e, 'speed');
                const eEva = e.evasion * getDebuffMulti(e, 'evasion');

                if (type === 'player') {
                    // 隨機選擇可用技能
                    const available = p.ownedSkills.filter(s => (p.skillCDs[s.name] || 0) === 0);
                    let skillToUse = null;
                    if (available.length > 0) {
                        skillToUse = available[Math.floor(Math.random() * available.length)];
                    } else {
                        skillToUse = { name: '普攻', lv: 1, data: ATTACK_SKILLS_DATA['普攻'] };
                    }

                    // 命中率 = 攻擊方命中 - 防守方迴避 - (防守方運氣值 × 0.004)
                    let p_hit = (p.hit_rate || 100) - eEva - ((e.luck || 0) * 0.004);
                    p_hit = Math.max(2, p_hit); // 最低命中 2%

                    if (Math.random() * 100 < p_hit) {
                        const sData = skillToUse.data;
                        const sLv = skillToUse.lv;
                        
                        // 特殊處理：元素匯聚蓄力邏輯
                        if (skillToUse.name === '元素匯聚' || skillToUse.name === '元素匯聚．強') {
                            p.pendingSkill = {
                                name: skillToUse.name,
                                lv: sLv,
                                data: sData,
                                countdown: 2,
                                damageTaken: 0
                            };
                            p.skillCDs[skillToUse.name] = sData.cd;
                            if (verbose) battleLog(`[玩家] 開始引導 ${skillToUse.name}... (等待 2 回合，期間受傷不得超過 5% HP)`, 'info');
                            continue; // 本回合不造成傷害
                        }

                        // 技能倍率
                        let sMulti = 1.0;
                        if (typeof sData.multi === 'function') {
                            sMulti = sData.multi(sLv, p);
                        } else {
                            sMulti = sData.multi || 1.0;
                        }

                        // 屬性倍率
                        const attrMulti = getFinalAttrMulti(sData.attr, e.attribute);
                        let attrInfo = "";
                        if (attrMulti > 1) {
                            attrInfo = ` <span style="color:#ffeb3b; font-size:0.8rem;">[屬性優勢 ${attrMulti.toFixed(2)}x]</span>`;
                        } else if (attrMulti < 1) {
                            attrInfo = ` <span style="color:#ff5722; font-size:0.8rem;">[屬性劣勢 ${attrMulti.toFixed(2)}x]</span>`;
                        }

                        // 攻速倍率 (依據受減益後的數值)
                        const currentSpeedRatio = pSpeed / (eSpeed || 200);
                        const currentPAtkMulti = Math.max(1, Math.floor(currentSpeedRatio));

                        const pBonusMulti = 1 + (p.bonus_dmg || 0) / 100;
                        let damage = pAtk * sMulti * pBonusMulti * currentPAtkMulti * pLvMulti * attrMulti;
                        // 套用敵方護盾減傷
                        damage = damage * (1 - eMitigation);
                        e.hp -= damage;

                        // DOT/Debuff 施加
                        if (typeof DOT_SKILLS_DATA !== 'undefined' || typeof DEBUFF_SKILLS_DATA !== 'undefined') {
                            // DOT
                            if (sData.dotnum) {
                                const dotKey = Object.keys(DOT_SKILLS_DATA).find(k => DOT_SKILLS_DATA[k].dotnum === sData.dotnum);
                                if (dotKey) {
                                    const dotData = DOT_SKILLS_DATA[dotKey];
                                    e.activeDots.push({ name: dotKey, dmg: dotData.dmg(sLv), dur: dotData.dur });
                                }
                            }
                            // Debuff (排除厄水 4)
                            if (sData.deffnum && sData.deffnum !== 4) {
                                const debuffKey = Object.keys(DEBUFF_SKILLS_DATA).find(k => DEBUFF_SKILLS_DATA[k].debuffnum === sData.deffnum);
                                if (debuffKey) {
                                    const dData = DEBUFF_SKILLS_DATA[debuffKey];
                                    if (Math.random() * 100 < dData.prob) {
                                        e.activeDebuffs.push({ 
                                            name: debuffKey, 
                                            attr: dData.attr, 
                                            effect: dData.effect, 
                                            dur: dData.dur 
                                        });
                                        if (verbose) battleLog(`[敵方] 受到 ${debuffKey} 影響！(降低 ${dData.attr} ${Math.floor(dData.effect*100)}%)`, 'fail');
                                    }
                                }
                            }
                        }

                        // 冷卻開始
                        if (skillToUse.name !== '普攻') {
                            p.skillCDs[skillToUse.name] = sData.cd;
                        }

                        if (verbose) battleLog(`[玩家] 使用 ${skillToUse.name}${attrInfo}！造成 ${Math.floor(damage).toLocaleString()} 傷害 (敵方剩餘: ${Math.max(0, e.hp).toLocaleString()})`, 'player');
                    } else if (verbose) {
                        battleLog(`[玩家] ${skillToUse.name} 被閃避！`, 'player');
                    }
                } else {

                    // 敵方攻擊命中率
                    let e_hit = (e.hit_rate || 100) - pEva - ((p.luck || 0) * 0.004);
                    e_hit = Math.max(2, e_hit); // 最低命中 2%

                    if (Math.random() * 100 < e_hit) {
                        // 敵方屬性倍率
                        const attrMulti = getFinalAttrMulti(e.attribute, '無'); // 假設玩家無屬性
                        let attrInfo = "";
                        if (attrMulti > 1) {
                            attrInfo = ` <span style="color:#ffeb3b; font-size:0.8rem;">[屬性優勢 ${attrMulti.toFixed(2)}x]</span>`;
                        } else if (attrMulti < 1) {
                            attrInfo = ` <span style="color:#ff5722; font-size:0.8rem;">[屬性劣勢 ${attrMulti.toFixed(2)}x]</span>`;
                        }

                        let rawDamage = eAtk * eLvMulti * attrMulti;
                        // 套用玩家護盾減傷
                        let damage = rawDamage * (1 - pMitigation);
                        p.hp -= damage;

                        // 紀錄蓄力期間受傷
                        if (p.pendingSkill) {
                            p.pendingSkill.damageTaken += damage;
                        }

                        if (verbose) battleLog(`[敵方] 擊中${attrInfo}！造成 ${Math.floor(damage).toLocaleString()} 傷害 (玩家剩餘: ${Math.max(0, p.hp).toLocaleString()})`, 'enemy');
                    } else if (verbose) {
                        battleLog(`[敵方] 被閃避！`, 'enemy');
                    }
                }



                if (p.hp <= 0 || e.hp <= 0) break;
            }

            round++;
        }

        const win = e.hp <= 0;
        if (verbose) {
            if (win) {
                battleLog(`🏆 戰鬥勝利！於第 ${round-1} 回合擊殺。`, 'success');
            } else if (round > maxRounds) {
                battleLog(`⏳ 已達 30 回合上限，玩家落敗。`, 'fail');
            } else {
                battleLog(`💀 戰鬥失敗... 角色死亡。`, 'fail');
            }
        }
        return win;
    }

    function getPlayerStats() {
        const saved = localStorage.getItem(STORAGE_KEY);
        let stats = window.CHARACTER_DEFAULT_STATS || { 
            level: 1, hp: 5, attack: 100, shield: 0, hit_rate: 100, evasion: 0, atk_speed: 100
        };
        
        if (saved) {
            try {
                stats = { ...stats, ...JSON.parse(saved) };
            } catch (e) {
                console.error("Error parsing player stats", e);
            }
        }
        return stats;
    }

    // 5. 事件處理
    singleBtn.onclick = () => {
        if (!currentEnemy || isRunning) return;
        logDisplay.innerHTML = '';
        const player = getPlayerStats();
        runBattle(player, currentEnemy, true);
        updateStats(0, 0); // 單次測試不計入統計
    };

    startBtn.onclick = async () => {
        if (!currentEnemy || isRunning) return;
        const count = parseInt(repeatInput.value) || 1;
        if (count <= 0) return;

        isRunning = true;
        startBtn.disabled = true;
        singleBtn.disabled = true;
        startBtn.textContent = '挑戰進行中...';
        logDisplay.innerHTML = `<div class="log-entry log-info">開始執行 ${count} 次連續挑戰...</div>`;
        
        let wins = 0;
        const player = getPlayerStats();

        for (let i = 1; i <= count; i++) {
            const result = runBattle(player, currentEnemy, false);
            if (result) wins++;

            if (i % 10 === 0 || i === count) {
                updateStats(wins, i);
                if (i % 100 === 0) {
                    battleLog(`已完成 ${i}/${count} 次挑戰...`, 'info');
                    await new Promise(resolve => setTimeout(resolve, 10)); // 防止瀏覽器當掉
                }
            }
        }

        battleLog(`===============================`, 'info');
        battleLog(`挑戰結束！`, 'success');
        battleLog(`總場次：${count}`, 'info');
        battleLog(`勝場數：${wins}`, 'success');
        battleLog(`勝率：${(wins / count * 100).toFixed(2)}%`, 'info');
        
        isRunning = false;
        startBtn.disabled = false;
        singleBtn.disabled = false;
        startBtn.textContent = '開始連續挑戰';
    };

    window.initDungeon = init;
    init();
});
