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
    window.initDungeon = function() {
        if (!selectionGrid) return;
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
        const atkAttrs = (atkAttrStr || '無').split(/[、,]/).map(s => s.trim()).filter(s => s);
        const defAttrs = (defAttrStr || '無').split(/[、,]/).map(s => s.trim()).filter(s => s);
        
        let totalMultiplier = 0;
        let combinations = 0;

        for (const aa of atkAttrs) {
            for (const da of defAttrs) {
                totalMultiplier += window.getAttributeMultiplier(aa, da);
                combinations++;
            }
        }
        return combinations > 0 ? (totalMultiplier / combinations) : 1.0;
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

    // 4. 戰鬥核心模擬 (支援多人 + 攻速交錯回合制)
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
                            name: skillName, lv: lv, data: ATTACK_SKILLS_DATA[skillName], type: 'attack'
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
                            name: skillName, lv: lv, data: HEAL_SKILLS_DATA[skillName], type: 'heal'
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
                            name: skillName, lv: lv, data: BUFF_SKILLS_DATA[skillName], type: 'buff'
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
            
            const finalHpMulti = 50 - (pMitigation / 0.99) * 49;
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
        e.maxHp = e.hp;
        e.skillCDs = {};
        e.activeDots = [];
        e.activeDebuffs = [];
        e.activeBuffs = [];

        let round = 1;
        const maxRounds = 30;

        if (verbose) {
            battleLog(`--- 戰鬥開始 (多人副本模式: ${activePlayers.length} 人) ---`, 'info');
            activePlayers.forEach((p, idx) => {
                battleLog(`[玩家 ${idx+1}] 生命: ${Math.floor(p.hp).toLocaleString()} | 減傷: ${(p.mitigation * 100).toFixed(1)}% | 等差: ${p.lvMulti.toFixed(2)}x`, 'info');
            });
            battleLog(`--------------------------------`, 'info');
        }

        if (window.PartnerSystem) {
            activePlayers.forEach(p => window.PartnerSystem.applyPreBattle(p, e));
        }

        while (round <= maxRounds && e.hp > 0 && activePlayers.some(p => p.hp > 0)) {
            if (verbose) battleLog(`--- 第 ${round} 回合 ---`, 'info');

            // --- A. 回合開始統一計算所有人的 DOT ---
            activePlayers.forEach((p, idx) => {
                if (p.hp > 0) processDots(p, `玩家 ${idx + 1}`, verbose);
            });
            if (e.hp > 0) processDots(e, '敵方', verbose);

            // 檢查是否因 DOT 死亡導致戰鬥結束
            if (e.hp <= 0 || !activePlayers.some(p => p.hp > 0)) {
                round++;
                continue;
            }

            // 1. 建立當前參與者行動清單並排序
            const participants = [
                ...activePlayers.map((p, idx) => ({ type: 'player', ref: p, id: idx + 1, originalIdx: idx })),
                { type: 'enemy', ref: e, id: 'BOSS' }
            ];

            participants.sort((a, b) => {
                const speedA = a.ref.atk_speed * getBuffMulti(a.ref, 'speed') * getDebuffMulti(a.ref, 'speed');
                const speedB = b.ref.atk_speed * getBuffMulti(b.ref, 'speed') * getDebuffMulti(b.ref, 'speed');
                return speedB - speedA;
            });

            // 2. 依序執行行動
            for (const actor of participants) {
                const target = actor.ref;
                if (target.hp <= 0 || e.hp <= 0 || !activePlayers.some(p => p.hp > 0)) continue;

                const nameTag = actor.type === 'player' ? `玩家 ${actor.id}` : '敵方';

                // --- B. 每人行動前的處理 (冷卻、狀態 Tick) ---
                for (const sName in target.skillCDs) {
                    if (target.skillCDs[sName] > 0) target.skillCDs[sName]--;
                }
                processDebuffs(target, nameTag, verbose);
                processBuffs(target, nameTag, verbose);

                if (target.hp <= 0) continue;

                if (actor.type === 'player') {
                    const p = target;
                    // 引導技能判定
                    if (p.pendingSkill) {
                        p.pendingSkill.countdown--;
                        if (p.pendingSkill.countdown <= 0) {
                            const ps = p.pendingSkill;
                            if (ps.damageTaken <= p.maxHp * 0.05) {
                                const trueDmg = typeof ps.data.multi === 'function' ? ps.data.multi(ps.lv, p) : (ps.data.multi || 0);
                                const prevHp = e.hp;
                                e.hp -= trueDmg;
                                if (verbose) battleLog(`[玩家 ${actor.id}] 💥 ${ps.name} 能量爆發！造成 ${Math.floor(trueDmg).toLocaleString()} 真實傷害 (${Math.floor(prevHp).toLocaleString()} -> ${Math.floor(Math.max(0, e.hp)).toLocaleString()})`, 'success');
                            } else if (verbose) {
                                battleLog(`[玩家 ${actor.id}] ❌ ${ps.name} 蓄力失敗！`, 'fail');
                            }
                            p.pendingSkill = null;
                            continue;
                        } else {
                            continue;
                        }
                    }

                    // 玩家主動行動
                    const pAtk = p.attack * getDebuffMulti(p, 'attack') * getBuffMulti(p, 'attack');
                    const eSpeed = e.atk_speed * getDebuffMulti(e, 'speed');
                    const eEva = e.evasion * getDebuffMulti(e, 'evasion');
                    const currentEMitigation = Math.min(Math.max(0, ((e.shield || 0) - (p.shield_pen || 0)) * 0.001), 0.99);

                    const available = p.ownedSkills.filter(s => (p.skillCDs[s.name] || 0) === 0);
                    let skillToUse = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : { name: '普攻', lv: 1, data: ATTACK_SKILLS_DATA['普攻'], type: 'attack' };

                    const pHitRate = (p.hit_rate || 100) * getBuffMulti(p, 'hit_rate');
                    let p_hit = pHitRate - eEva - ((e.luck || 0) * 0.004);
                    p_hit = Math.max(2, p_hit);

                    if (skillToUse.type === 'heal') {
                        const sData = skillToUse.data;
                        const healPercent = typeof sData.multi === 'function' ? sData.multi(skillToUse.lv, p) : (sData.multi || 0);
                        activePlayers.forEach((tp, tIdx) => {
                            if (tp.hp <= 0) return;
                            const healAmt = tp.maxHp * (healPercent / 100);
                            const prevHp = tp.hp;
                            tp.hp = Math.min(tp.maxHp, tp.hp + healAmt);
                            if (verbose) battleLog(`[玩家 ${actor.id}] 使用 ${skillToUse.name}！為 玩家 ${tIdx + 1} 恢復 ${Math.floor(healAmt).toLocaleString()} 生命 (${Math.floor(prevHp).toLocaleString()} -> ${Math.floor(tp.hp).toLocaleString()})`, 'success');
                        });
                        p.skillCDs[skillToUse.name] = (sData.cd || 0) + 1;
                    } else if (skillToUse.type === 'buff') {
                        const sData = skillToUse.data;
                        const bValue = typeof sData.multi === 'function' ? sData.multi(skillToUse.lv, p) : (sData.multi || 1.0);
                        p.activeBuffs.push({ name: skillToUse.name, effect: sData.effect, value: bValue, dur: sData.dur, pending: true });
                        if (verbose) battleLog(`[玩家 ${actor.id}] 使用 ${skillToUse.name}！(將於下回合生效，持續 ${sData.dur} 回合)`, 'info');
                        p.skillCDs[skillToUse.name] = (sData.cd || 0) + 1;
                    } else if (Math.random() * 100 < p_hit) {
                        const sData = skillToUse.data;
                        if (skillToUse.name === '元素匯聚' || skillToUse.name === '元素匯聚．強') {
                            p.pendingSkill = { name: skillToUse.name, lv: skillToUse.lv, data: sData, countdown: 2, damageTaken: 0 };
                            if (verbose) battleLog(`[玩家 ${actor.id}] 開始引導 ${skillToUse.name}...`, 'info');
                        } else {
                            let sMulti = typeof sData.multi === 'function' ? sData.multi(skillToUse.lv, p) : (sData.multi || 1.0);
                            const attrMulti = getFinalAttrMulti(sData.attr, e.attribute);
                            const currentPAtkMulti = Math.max(1, Math.floor((p.atk_speed * getBuffMulti(p, 'speed') * getDebuffMulti(p, 'speed')) / (eSpeed || 1)));
                            let damage = pAtk * sMulti * (1 + (p.bonus_dmg || 0) / 100) * currentPAtkMulti * p.lvMulti * attrMulti * (1 - currentEMitigation);
                            const prevHp = e.hp;
                            e.hp -= damage;
                            if (sData.dotnum) {
                                const dotKey = Object.keys(DOT_SKILLS_DATA).find(k => DOT_SKILLS_DATA[k].dotnum === sData.dotnum);
                                if (dotKey) e.activeDots.push({ name: dotKey, dmg: DOT_SKILLS_DATA[dotKey].dmg(skillToUse.lv), dur: DOT_SKILLS_DATA[dotKey].dur });
                            }
                            if (sData.deffnum && sData.deffnum !== 4) {
                                const debuffKey = Object.keys(DEBUFF_SKILLS_DATA).find(k => DEBUFF_SKILLS_DATA[k].debuffnum === sData.deffnum);
                                if (debuffKey && Math.random() * 100 < DEBUFF_SKILLS_DATA[debuffKey].prob) {
                                    e.activeDebuffs.push({ ...DEBUFF_SKILLS_DATA[debuffKey], name: debuffKey });
                                    if (verbose) battleLog(`[敵方] 受到 ${debuffKey} 影響`, 'fail');
                                }
                            }
                            let attrText = "";
                            if (attrMulti > 1) attrText = ` <span style="color:#ffcc00">(剋制 +${Math.round((attrMulti - 1) * 100)}%)</span>`;
                            else if (attrMulti < 1) attrText = ` <span style="color:#ff4444">(被剋制 -${Math.round((1 - attrMulti) * 100)}%)</span>`;

                            if (verbose) battleLog(`[玩家 ${actor.id}] 使用 ${skillToUse.name}！造成 ${Math.floor(damage).toLocaleString()} 傷害${attrText} (${Math.floor(prevHp).toLocaleString()} -> ${Math.floor(Math.max(0, e.hp)).toLocaleString()})`, 'player');
                        }
                        p.skillCDs[skillToUse.name] = (sData.cd || 0) + 1;
                    } else {
                        if (verbose) battleLog(`[玩家 ${actor.id}] 使用 ${skillToUse.name} 但未擊中！`, 'fail');
                        p.skillCDs[skillToUse.name] = (skillToUse.data.cd || 0) + 1;
                    }
                } else {
                    // 敵方 (BOSS) 行動
                    const eAtk = e.attack * getDebuffMulti(e, 'attack') * getBuffMulti(e, 'attack');
                    const eHpPercent = (e.hp / e.maxHp) * 100;
                    const availableSkills = (e.skills || []).filter(s => eHpPercent <= (s.threshold || 100) && (e.skillCDs[s.name] || 0) === 0);
                    let selectedSkill = availableSkills.length > 0 ? availableSkills[Math.floor(Math.random() * availableSkills.length)] : { name: '普攻', multi: 1.0, type: 'single' };

                    const executeEnemyHit = (tp, pIdx, skill) => {
                        const pEva = tp.evasion * getDebuffMulti(tp, 'evasion') * getBuffMulti(tp, 'evasion');
                        let e_hit = (e.hit_rate || 100) - pEva - ((tp.luck || 0) * 0.004);
                        if (Math.random() * 100 < Math.max(2, e_hit)) {
                            const attrMulti = getFinalAttrMulti(e.attribute, '無') || 1.0;
                            const diff = e.level - tp.level;
                            const eLvMultiForP = diff >= 7 ? 1.5 : (diff <= -7 ? 0.5 : 1.0 + (diff * (0.5 / 7)));
                            const skillMulti = skill.multi || skill.damage || 1.0;
                            const currentPMitigation = hasBuff(tp, 'invincible') ? 1.0 : tp.mitigation;
                            let damage = eAtk * skillMulti * eLvMultiForP * attrMulti * (1 - currentPMitigation);
                            damage = Math.max(1, Math.floor(damage));
                            const prevHp = tp.hp;
                            tp.hp -= damage;
                            if (tp.pendingSkill) tp.pendingSkill.damageTaken += damage;
                            let attrText = "";
                            if (attrMulti > 1) attrText = ` <span style="color:#ffcc00">(剋制 +${Math.round((attrMulti - 1) * 100)}%)</span>`;
                            else if (attrMulti < 1) attrText = ` <span style="color:#ff4444">(被剋制 -${Math.round((1 - attrMulti) * 100)}%)</span>`;

                            if (verbose) battleLog(`[敵方] ${skill.name} 擊中 玩家 ${pIdx + 1}！造成 ${damage.toLocaleString()} 傷害${attrText} (${Math.floor(prevHp).toLocaleString()} -> ${Math.floor(Math.max(0, tp.hp)).toLocaleString()})`, 'enemy');
                            if (skill.dot) tp.activeDots.push({ ...skill.dot });
                            if (skill.debuff) {
                                tp.activeDebuffs.push({ 
                                    name: skill.debuff.name, 
                                    effect: 1 - (skill.debuff.value || skill.debuff.multiplier || 1), 
                                    attr: skill.debuff.effect || skill.debuff.effectType, 
                                    dur: skill.debuff.dur || skill.debuff.round 
                                });
                            }
                        } else if (verbose) {
                            battleLog(`[敵方] ${skill.name} 攻擊 玩家 ${pIdx + 1} 但未擊中！`, 'info');
                        }
                    };

                    if (selectedSkill.type === 'single') {
                        const targets = activePlayers.filter(p => p.hp > 0);
                        if (targets.length > 0) {
                            const targetP = targets[Math.floor(Math.random() * targets.length)];
                            executeEnemyHit(targetP, activePlayers.indexOf(targetP), selectedSkill);
                        }
                    } else if (selectedSkill.type === 'multi') {
                        activePlayers.forEach((tp, pIdx) => { if (tp.hp > 0) executeEnemyHit(tp, pIdx, selectedSkill); });
                    } else if (selectedSkill.type === 'self') {
                        if (selectedSkill.buff) {
                            e.activeBuffs.push({ 
                                name: selectedSkill.buff.name, value: selectedSkill.buff.value || selectedSkill.buff.multiplier, 
                                effect: selectedSkill.buff.effect || selectedSkill.buff.effectType, dur: selectedSkill.buff.dur || selectedSkill.buff.round, pending: true 
                            });
                            if (verbose) battleLog(`[敵方] 使用 ${selectedSkill.name}！獲得 ${selectedSkill.buff.name} 效果`, 'info');
                        }
                        if (selectedSkill.heal) {
                            const healAmt = e.hp * selectedSkill.heal;
                            e.hp = Math.min(e.maxHp, e.hp + healAmt);
                            if (verbose) battleLog(`[敵方] 使用 ${selectedSkill.name}！恢復 ${Math.floor(healAmt).toLocaleString()} 生命`, 'success');
                        }
                    }
                    e.skillCDs[selectedSkill.name] = (selectedSkill.cd || 0) + 1;
                }
            }
            round++;
        }

        const win = e.hp <= 0;
        const playerStatus = activePlayers.map((p, idx) => ({
            name: `玩家 ${idx + 1}`, hp: Math.max(0, p.hp), isAlive: p.hp > 0
        }));

        if (verbose) {
            if (win) battleLog(`🏆 戰鬥勝利！於第 ${round-1} 回合擊殺。`, 'success');
            else if (round > maxRounds) battleLog(`⏳ 已達 30 回合上限，玩家落敗。`, 'fail');
            else battleLog(`💀 戰鬥失敗... 全員陣亡。`, 'fail');
            const statusLine = playerStatus.map(ps => `${ps.name}: ${ps.isAlive ? `存活 (${Math.floor(ps.hp).toLocaleString()})` : '陣亡'}`).join(' | ');
            battleLog(`[存活狀況] ${statusLine}`, 'info');
        }
        return { win, playerStatus };
    }

    function getMultiPlayerStats() {
        const players = [];
        for (let i = 1; i <= 3; i++) {
            const saved = localStorage.getItem(`sfl_battle_stats_${i}`);
            let stats = { ...window.CHARACTER_DEFAULT_STATS };
            if (i > 1) stats.isEnabled = false;
            if (saved) { try { stats = { ...stats, ...JSON.parse(saved) }; } catch (e) {} }
            if (stats.isEnabled) players.push(stats);
        }
        return players;
    }

    singleBtn.onclick = () => {
        if (!currentEnemy || isRunning) return;
        logDisplay.innerHTML = '';
        runBattle(getMultiPlayerStats(), currentEnemy, true);
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
            playerStatus.forEach((ps, idx) => { if (ps.isAlive) survivalCounts[idx]++; });
            if (i % 10 === 0 || i === count) {
                updateStats(wins, i);
                if (i % 100 === 0) {
                    battleLog(`已完成 ${i}/${count} 次挑戰...`, 'info');
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }
        }
        battleLog(`===============================`, 'info');
        battleLog(`挑戰結束！ 勝率：${((wins / count) * 100).toFixed(2)}%`, 'success');
        
        // 補回每個玩家的存活狀態統計
        players.forEach((p, idx) => {
            const sRate = ((survivalCounts[idx] / count) * 100).toFixed(1);
            battleLog(`玩家 ${idx + 1} 存活率：${sRate}% (${survivalCounts[idx]}/${count})`, 'player');
        });

        isRunning = false;
        startBtn.disabled = false;
        singleBtn.disabled = false;
        startBtn.textContent = '開始連續挑戰';
    };

    window.initDungeon();
});
