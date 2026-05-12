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
                <div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:8px 15px;">
                    <span style="font-size:0.8rem; color:#888;">屬性: <b style="color:#ce9178;">${enemy.attribute}</b></span>
                    <span style="font-size:0.8rem; color:#888;">生命: <b style="color:#fff;">${enemy.hp.toLocaleString()}</b></span>
                    <span style="font-size:0.8rem; color:#888;">攻擊: <b style="color:#fff;">${enemy.attack.toLocaleString()}</b></span>
                    <span style="font-size:0.8rem; color:#888;">護甲: <b style="color:#fff;">${enemy.shield.toLocaleString()}</b></span>
                    <span style="font-size:0.8rem; color:#888;">命中: <b style="color:#fff;">${enemy.hit_rate}%</b></span>
                    <span style="font-size:0.8rem; color:#888;">閃避: <b style="color:#fff;">${enemy.evasion}%</b></span>
                    <span style="font-size:0.8rem; color:#888;">攻速: <b style="color:#fff;">${enemy.atk_speed}</b></span>
                    <span style="font-size:0.8rem; color:#888;">穿透: <b style="color:#fff;">${enemy.shield_pen}</b></span>
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

    // 4. 戰鬥核心模擬 (支援多人)
    function runBattle(players, enemy, verbose = false) {
        // 初始化所有玩家
        let activePlayers = players.map(p => {
            let player = { ...p };
            player.ownedSkills = [];
            const hasStrong = player['元素匯聚．強'] && player['元素匯聚．強'] > 0;

            // 攻擊技能
            if (typeof ATTACK_SKILLS_DATA !== 'undefined') {
                for (const skillName in ATTACK_SKILLS_DATA) {
                    if (skillName === '普攻') continue;
                    if (skillName === '元素匯聚' && hasStrong) continue;
                    const lv = player[skillName];
                    if (lv && lv > 0) {
                        player.ownedSkills.push({
                            name: skillName,
                            lv: lv,
                            data: ATTACK_SKILLS_DATA[skillName],
                            type: 'attack'
                        });
                    }
                }
            }

            // 治療技能
            if (typeof HEAL_SKILLS_DATA !== 'undefined') {
                for (const skillName in HEAL_SKILLS_DATA) {
                    const lv = player[skillName];
                    if (lv && lv > 0) {
                        player.ownedSkills.push({
                            name: skillName,
                            lv: lv,
                            data: HEAL_SKILLS_DATA[skillName],
                            type: 'heal'
                        });
                    }
                }
            }

            // 增益技能
            if (typeof BUFF_SKILLS_DATA !== 'undefined') {
                for (const skillName in BUFF_SKILLS_DATA) {
                    const lv = player[skillName];
                    if (lv && lv > 0) {
                        player.ownedSkills.push({
                            name: skillName,
                            lv: lv,
                            data: BUFF_SKILLS_DATA[skillName],
                            type: 'buff'
                        });
                    }
                }
            }
            player.skillCDs = {};
            player.activeDots = [];
            player.activeDebuffs = [];
            player.activeBuffs = [];
            player.pendingSkill = null;

            // 護盾減傷與生命倍化計算
            const bossShieldPen = enemy.shield_pen || 0;
            const playerShield = player.shield || 0;
            const pMitigation = Math.min(Math.max(0, (playerShield - bossShieldPen) * 0.001), 0.99);
            player.mitigation = pMitigation;
            
            const hpMulti = (1 - pMitigation) * 50;
            const finalHpMulti = pMitigation >= 0.99 ? 1 : hpMulti;
            const baseHp = player.hp || 5;
            const lv = player.level || 1;
            player.maxHp = baseHp * (20 + (lv - 1)) * finalHpMulti;
            player.hp = player.maxHp;

            // 等級差距倍率
            const eLv = enemy.level || 1;
            const diff = player.level - eLv;
            if (diff >= 7) player.lvMulti = 1.5;
            else if (diff <= -7) player.lvMulti = 0.5;
            else player.lvMulti = 1.0 + (diff * (0.5 / 7));

            return player;
        });

        let e = { ...enemy };
        e.activeDots = [];
        e.activeDebuffs = [];

        // 輔助函式：取得減益倍率
        const getDebuffMulti = (target, attr) => {
            if (!target.activeDebuffs) return 1.0;
            let multi = 1.0;
            target.activeDebuffs.forEach(d => {
                if (d.attr === attr) multi *= (1 - d.effect);
            });
            return multi;
        };

        // 輔助函式：取得增益倍率
        const getBuffMulti = (target, attr) => {
            if (!target.activeBuffs) return 1.0;
            let multi = 1.0;
            target.activeBuffs.forEach(b => {
                if (!b.pending && b.effect === attr) multi *= b.value;
            });
            return multi;
        };

        // 輔助函式：檢查是否存在特定增益
        const hasBuff = (target, attr) => {
            if (!target.activeBuffs) return false;
            return target.activeBuffs.some(b => !b.pending && b.effect === attr);
        };

        // 輔助函式：取得屬性倍率
        const getFinalAttrMulti = (atkAttrStr, defAttrStr) => {
            if (typeof window.getAttributeMultiplier !== 'function') return 1.0;
            const atkAttrs = (atkAttrStr || '無').split(/[、,]/);
            const defAttrs = (defAttrStr || '無').split(/[、,]/);
            let best = 1.0, worst = 1.0, hasAdv = false;
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
                    const prevHp = target.hp;
                    target.hp -= dot.dmg;
                    dot.dur--;
                    if (isVerbose) battleLog(`[${nameTag}] ${dot.name} 造成 ${Math.floor(dot.dmg).toLocaleString()} 持續傷害 (${Math.floor(prevHp).toLocaleString()} -> ${Math.floor(Math.max(0, target.hp)).toLocaleString()}) (剩餘 ${dot.dur} 回合)`, 'fail');
                    if (target.pendingSkill) target.pendingSkill.damageTaken += dot.dmg;
                }
            });
            target.activeDots = target.activeDots.filter(d => d.dur > 0);
        };

        // 輔助函式：執行 Debuff 結算
        const processDebuffs = (target, nameTag, isVerbose) => {
            if (!target.activeDebuffs || target.activeDebuffs.length === 0) return;
            target.activeDebuffs.forEach(d => { if (d.dur > 0) d.dur--; });
            const expired = target.activeDebuffs.filter(d => d.dur <= 0);
            if (isVerbose && expired.length > 0) {
                expired.forEach(d => battleLog(`[${nameTag}] ${d.name} 效果已消失`, 'info'));
            }
            target.activeDebuffs = target.activeDebuffs.filter(d => d.dur > 0);
        };

        // 輔助函式：執行 Buff 結算
        const processBuffs = (target, nameTag, isVerbose) => {
            if (!target.activeBuffs || target.activeBuffs.length === 0) return;
            target.activeBuffs.forEach(b => {
                if (b.pending) {
                    b.pending = false; // 下回合開始生效
                } else if (b.dur > 0) {
                    b.dur--;
                }
            });
            const expired = target.activeBuffs.filter(b => b.dur <= 0 && !b.pending);
            if (isVerbose && expired.length > 0) {
                expired.forEach(b => battleLog(`[${nameTag}] ${b.name} 效果已消失`, 'info'));
            }
            target.activeBuffs = target.activeBuffs.filter(b => b.dur > 0 || b.pending);
        };

        let round = 1;
        const maxRounds = 30;

        if (verbose) {
            battleLog(`--- 戰鬥開始 (多人副本模式: ${activePlayers.length} 人) ---`, 'info');
            activePlayers.forEach((p, idx) => {
                battleLog(`[玩家 ${idx+1}] 生命: ${Math.floor(p.hp).toLocaleString()} | 減傷: ${(p.mitigation * 100).toFixed(1)}% | 等差: ${p.lvMulti.toFixed(2)}x`, 'info');
            });
            battleLog(`--------------------------------`, 'info');
        }

        // 模擬戰鬥前處理
        if (window.PartnerSystem) {
            activePlayers.forEach(p => window.PartnerSystem.applyPreBattle(p, e));
        }

        while (activePlayers.some(p => p.hp > 0) && e.hp > 0 && round <= maxRounds) {
            if (verbose) battleLog(`第 ${round} 回合`, 'round');

            // 1. 每回合開始：計算 DOT 與 冷卻
            activePlayers.forEach((p, idx) => {
                if (p.hp > 0) {
                    processDots(p, `玩家 ${idx+1}`, verbose);
                    for (const sName in p.skillCDs) {
                        if (p.skillCDs[sName] > 0) p.skillCDs[sName]--;
                    }
                    processDebuffs(p, `玩家 ${idx+1}`, verbose);
                    processBuffs(p, `玩家 ${idx+1}`, verbose);
                    
                    // 處理待施放技能 (元素匯聚)
                    if (p.pendingSkill) {
                        p.pendingSkill.countdown--;
                        if (p.pendingSkill.countdown <= 0) {
                            const ps = p.pendingSkill;
                            if (ps.damageTaken <= p.maxHp * 0.05) {
                                const trueDmg = typeof ps.data.multi === 'function' ? ps.data.multi(ps.lv, p) : (ps.data.multi || 0);
                                const prevHp = e.hp;
                                e.hp -= trueDmg;
                                if (verbose) battleLog(`[玩家 ${idx+1}] 💥 ${ps.name} 能量爆發！造成 ${Math.floor(trueDmg).toLocaleString()} 真實傷害 (${Math.floor(prevHp).toLocaleString()} -> ${Math.floor(Math.max(0, e.hp)).toLocaleString()})`, 'success');
                                // CD 已在開始引導時設定
                            } else if (verbose) {
                                battleLog(`[玩家 ${idx+1}] ❌ ${ps.name} 蓄力失敗！`, 'fail');
                            }
                            p.pendingSkill = null;
                        }
                    }
                }
            });

            processDots(e, '敵方', verbose);
            processDebuffs(e, '敵方', verbose);

            if (!activePlayers.some(p => p.hp > 0) || e.hp <= 0) break;

            // 2. 玩家行動 (每個人動一次)
            activePlayers.forEach((p, idx) => {
                if (p.hp <= 0 || e.hp <= 0) return;

                const pAtk = p.attack * getDebuffMulti(p, 'attack') * getBuffMulti(p, 'attack');
                const eSpeed = e.atk_speed * getDebuffMulti(e, 'speed');
                const eEva = e.evasion * getDebuffMulti(e, 'evasion');

                // 針對當前玩家計算敵方減傷
                const currentEMitigation = Math.min(Math.max(0, ((e.shield || 0) - (p.shield_pen || 0)) * 0.001), 0.99);

                const available = p.ownedSkills.filter(s => (p.skillCDs[s.name] || 0) === 0);
                let skillToUse = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : { name: '普攻', lv: 1, data: ATTACK_SKILLS_DATA['普攻'], type: 'attack' };

                const pHitRate = (p.hit_rate || 100) * getBuffMulti(p, 'hit_rate');
                let p_hit = pHitRate - eEva - ((e.luck || 0) * 0.004);
                p_hit = Math.max(2, p_hit);

                if (skillToUse.type === 'heal') {
                    const sData = skillToUse.data;
                    const sLv = skillToUse.lv;
                    const healPercent = typeof sData.multi === 'function' ? sData.multi(sLv, p) : (sData.multi || 0);
                    
                    activePlayers.forEach((targetP, targetIdx) => {
                        if (targetP.hp <= 0) return;
                        const healAmt = targetP.maxHp * (healPercent / 100);
                        const prevHp = targetP.hp;
                        targetP.hp = Math.min(targetP.maxHp, targetP.hp + healAmt);
                        if (verbose) battleLog(`[玩家 ${idx+1}] 使用 ${skillToUse.name}！為 玩家 ${targetIdx+1} 恢復 ${Math.floor(healAmt).toLocaleString()} 生命 (${Math.floor(prevHp).toLocaleString()} -> ${Math.floor(targetP.hp).toLocaleString()})`, 'success');
                    });
                    p.skillCDs[skillToUse.name] = (sData.cd || 0) + 1;
                } else if (skillToUse.type === 'buff') {
                    const sData = skillToUse.data;
                    const sLv = skillToUse.lv;
                    const bValue = typeof sData.multi === 'function' ? sData.multi(sLv, p) : (sData.multi || 1.0);
                    
                    p.activeBuffs.push({
                        name: skillToUse.name,
                        effect: sData.effect,
                        value: bValue,
                        dur: sData.dur,
                        pending: true
                    });
                    
                    if (verbose) battleLog(`[玩家 ${idx+1}] 使用 ${skillToUse.name}！(將於下回合生效，持續 ${sData.dur} 回合)`, 'info');
                    p.skillCDs[skillToUse.name] = (sData.cd || 0) + 1;
                } else if (Math.random() * 100 < p_hit) {
                    const sData = skillToUse.data;
                    const sLv = skillToUse.lv;
                    
                    if (skillToUse.name === '元素匯聚' || skillToUse.name === '元素匯聚．強') {
                        p.pendingSkill = { name: skillToUse.name, lv: sLv, data: sData, countdown: 2, damageTaken: 0 };
                        p.skillCDs[skillToUse.name] = (sData.cd || 0) + 1;
                        if (verbose) battleLog(`[玩家 ${idx+1}] 開始引導 ${skillToUse.name}...`, 'info');
                    } else {
                        let sMulti = typeof sData.multi === 'function' ? sData.multi(sLv, p) : (sData.multi || 1.0);
                        const attrMulti = getFinalAttrMulti(sData.attr, e.attribute);
                        const currentPAtkMulti = Math.max(1, Math.floor((p.atk_speed * getBuffMulti(p, 'speed') * getDebuffMulti(p, 'speed')) / (eSpeed || 200)));
                        
                        let damage = pAtk * sMulti * (1 + (p.bonus_dmg || 0) / 100) * currentPAtkMulti * p.lvMulti * attrMulti * (1 - currentEMitigation);
                        const prevHp = e.hp;
                        e.hp -= damage;

                        // DOT/Debuff
                        if (sData.dotnum) {
                            const dotKey = Object.keys(DOT_SKILLS_DATA).find(k => DOT_SKILLS_DATA[k].dotnum === sData.dotnum);
                            if (dotKey) e.activeDots.push({ name: dotKey, dmg: DOT_SKILLS_DATA[dotKey].dmg(sLv), dur: DOT_SKILLS_DATA[dotKey].dur });
                        }
                        if (sData.deffnum && sData.deffnum !== 4) {
                            const debuffKey = Object.keys(DEBUFF_SKILLS_DATA).find(k => DEBUFF_SKILLS_DATA[k].debuffnum === sData.deffnum);
                            if (debuffKey && Math.random() * 100 < DEBUFF_SKILLS_DATA[debuffKey].prob) {
                                e.activeDebuffs.push({ ...DEBUFF_SKILLS_DATA[debuffKey], name: debuffKey });
                                if (verbose) battleLog(`[敵方] 受到 ${debuffKey} 影響`, 'fail');
                            }
                        }

                        
                        p.skillCDs[skillToUse.name] = (sData.cd || 0) + 1;
                        if (verbose) battleLog(`[玩家 ${idx+1}] 使用 ${skillToUse.name}！造成 ${Math.floor(damage).toLocaleString()} 傷害 (${Math.floor(prevHp).toLocaleString()} -> ${Math.floor(Math.max(0, e.hp)).toLocaleString()})`, 'player');
                    }
                } else if (verbose) {
                    battleLog(`[玩家 ${idx+1}] ${skillToUse.name} 被閃避！`, 'player');
                }
            });

            // 3. 敵方行動 (同時攻擊所有玩家)
            if (e.hp > 0) {
                const eAtk = e.attack * getDebuffMulti(e, 'attack');
                activePlayers.forEach((p, idx) => {
                    if (p.hp <= 0) return;

                    const pEva = p.evasion * getDebuffMulti(p, 'evasion') * getBuffMulti(p, 'evasion');
                    let e_hit = (e.hit_rate || 100) - pEva - ((p.luck || 0) * 0.004);
                    e_hit = Math.max(2, e_hit);

                    if (Math.random() * 100 < e_hit) {
                        const attrMulti = getFinalAttrMulti(e.attribute, '無');
                        const diff = e.level - p.level;
                        const eLvMultiForP = diff >= 7 ? 1.5 : (diff <= -7 ? 0.5 : 1.0 + (diff * (0.5 / 7)));
                        
                        const eRandomMulti = 1 + Math.random() * 2;
                        const currentPMitigation = hasBuff(p, 'invincible') ? 1.0 : p.mitigation;
                        let damage = eAtk * eLvMultiForP * attrMulti * (1 - currentPMitigation) * eRandomMulti;
                        const prevHp = p.hp;
                        p.hp -= damage;
                        if (p.pendingSkill) p.pendingSkill.damageTaken += damage;
                        
                        if (verbose) battleLog(`[敵方] 擊中 玩家 ${idx+1}！造成 ${Math.floor(damage).toLocaleString()} 傷害 (${Math.floor(prevHp).toLocaleString()} -> ${Math.floor(Math.max(0, p.hp)).toLocaleString()})`, 'enemy');
                    } else if (verbose) {
                        battleLog(`[敵方] 對 玩家 ${idx+1} 的攻擊被閃避！`, 'enemy');
                    }
                });
            }

            round++;
        }

        const win = e.hp <= 0;
        const playerStatus = activePlayers.map((p, idx) => ({
            name: `玩家 ${idx + 1}`,
            hp: Math.max(0, p.hp),
            isAlive: p.hp > 0
        }));

        if (verbose) {
            if (win) battleLog(`🏆 戰鬥勝利！於第 ${round-1} 回合擊殺。`, 'success');
            else if (round > maxRounds) battleLog(`⏳ 已達 30 回合上限，玩家落敗。`, 'fail');
            else battleLog(`💀 戰鬥失敗... 全員陣亡。`, 'fail');

            const statusLine = playerStatus.map(ps => 
                `${ps.name}: ${ps.isAlive ? `存活 (${Math.floor(ps.hp).toLocaleString()})` : '陣亡'}`
            ).join(' | ');
            battleLog(`[存活狀況] ${statusLine}`, 'info');
        }
        return { win, playerStatus };
    }

    function getMultiPlayerStats() {
        const players = [];
        for (let i = 1; i <= 3; i++) {
            const saved = localStorage.getItem(`sfl_battle_stats_${i}`);
            let stats = { ...window.CHARACTER_DEFAULT_STATS };
            if (i > 1) stats.isEnabled = false; // P2, P3 預設不加入
            
            if (saved) {
                try {
                    stats = { ...stats, ...JSON.parse(saved) };
                } catch (e) {}
            }
            
            if (stats.isEnabled) {
                players.push(stats);
            }
        }
        return players;
    }

    // 5. 事件處理
    singleBtn.onclick = () => {
        if (!currentEnemy || isRunning) return;
        logDisplay.innerHTML = '';
        const players = getMultiPlayerStats();
        runBattle(players, currentEnemy, true);
        updateStats(0, 0);
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
        const players = getMultiPlayerStats();
        const survivalCounts = players.map(() => 0);

        for (let i = 1; i <= count; i++) {
            const { win, playerStatus } = runBattle(players, currentEnemy, false);
            if (win) wins++;
            playerStatus.forEach((ps, idx) => {
                if (ps.isAlive) survivalCounts[idx]++;
            });

            if (i % 10 === 0 || i === count) {
                updateStats(wins, i);
                if (i % 100 === 0) {
                    battleLog(`已完成 ${i}/${count} 次挑戰...`, 'info');
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }
        }

        battleLog(`===============================`, 'info');
        battleLog(`挑戰結束！`, 'success');
        battleLog(`總場次：${count}`, 'info');
        battleLog(`勝場數：${wins}`, 'success');
        battleLog(`勝率：${((wins / count) * 100).toFixed(2)}%`, 'info');
        
        const survivalLines = survivalCounts.map((c, idx) => 
            `玩家 ${idx + 1} 存活率：${((c / count) * 100).toFixed(1)}% (${c}次)`
        ).join(' | ');
        battleLog(`[平均存活] ${survivalLines}`, 'info');
        
        isRunning = false;
        startBtn.disabled = false;
        singleBtn.disabled = false;
        startBtn.textContent = '開始連續挑戰';
    };

    window.initDungeon = init;
    init();
});
