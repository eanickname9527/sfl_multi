/**
 * SFL 技能資料庫 (修正版 V2)
 */
const ATTACK_SKILLS_DATA = {
    '普攻': { attr: '無', ub: 0, cd: 0, multi: 1, cri: false },
    '斬擊': { attr: '無', ub: 0, cd: 1, multi: (lv) => 1.20 + (lv - 1) * 0.30 },
    '火球術': { attr: '火', ub: 0, cd: 2, multi: (lv) => 1.50 + (lv - 1) * 0.27 },
    '暗影突襲': { attr: '暗', ub: 0, cd: 5, multi: (lv) => 1.50 + (lv - 1) * 0.31 },
    '烈火箭': { attr: '火', ub: 0, cd: 2, multi: (lv) => 2.00 + (lv - 1) * 0.30 },
    '石破': { attr: '自然', ub: 0, cd: 3, multi: (lv) => 2.00 + (lv - 1) * 0.30 },
    '詛咒打擊': { attr: '暗', ub: 0, cd: 4, multi: (lv) => 1.80 + (lv - 1) * 0.25, deffnum: 1 },
    '毒刃': { attr: '自然', ub: 0, cd: 2, multi: (lv) => 2.00 + (lv - 1) * 0.30 },
    '烈焰劍': { attr: '火', ub: 0, cd: 4, multi: (lv) => 2.20 + (lv - 1) * 0.28, dotnum: 1 },
    '靈性冥視': { attr: '暗', ub: 0, cd: 5, multi: (lv) => 2.50 + (lv - 1) * 0.30, deffnum: 2 },
    '狂雷擊': { attr: '雷', ub: 0, cd: 2, multi: (lv) => 3.00 + (lv - 1) * 0.30 },
    '元素匯聚': { attr: '特殊', ub: 0, cd: 10, multi: (lv, stats) => (1.00 + (lv - 1) * 0.06) * 10 * (stats.luck || 0) },
    '酸液噴射': { attr: '水', ub: 0, cd: 2, multi: (lv) => 3.00 + (lv - 1) * 0.30 },
    '聖光之杖': { attr: '光', ub: 1, cd: 3, multi: (lv) => 4.00 + (lv - 1) * 0.35 },
    '終極一擊': { attr: '全', ub: 3, cd: 10, multi: (lv) => 8.00 + (lv - 1) * 0.20 },
    '曙光': { attr: '光', ub: 4, cd: 5, multi: (lv) => 6.00 + (lv - 1) * 0.30 },
    '潮汐一斬': { attr: '水', ub: 3, cd: 1, multi: (lv) => 1.50 + (lv - 1) * 0.30 },
    '侵蝕之觸': { attr: '水', ub: 2, cd: 2, multi: (lv) => 3.00 + (lv - 1) * 0.30, dotnum: 2 },
    '德魯伊風拳': { attr: '自然', ub: 1, cd: 2, multi: (lv) => 3.00 + (lv - 1) * 0.30 },
    '聖輝斬': { attr: '光', ub: 1, cd: 2, multi: (lv) => 3.00 + (lv - 1) * 0.30 },
    '元素匯聚．強': { attr: '特殊', ub: 0, cd: 10, multi: (lv, stats) => (1.00 + (lv - 1) * 0.10) * 15 * (stats.luck || 0) },
    '絕對審判': { attr: '全', ub: 4, cd: 3, multi: (lv) => 10.00 + (lv - 1) * 0.20 },
    '疾雷脈衝': { attr: '雷', ub: 3, cd: 2, multi: (lv) => 3.00 + (lv - 1) * 0.30, deffnum: 3 },
    '暗噬龍咒': { attr: '暗', ub: 5, cd: 4, multi: (lv) => 8.01 + (lv - 1) * 0.20 },
    '星火滅世陣': { attr: '火', ub: 6, cd: 4, multi: (lv) => 8.01 + (lv - 1) * 0.20 },
    '虛空侵蝕': { attr: '全', ub: 10, cd: 15, multi: (lv) => 8.02 + (lv - 1) * 0.20, dotnum: 3 },
    '星碎滅劍': { attr: '無', ub: 1, cd: 1, multi: (lv) => 5.46 + (lv - 1) * 0.16 },
    '天雷神轟鳴': { attr: '雷', ub: 8, cd: 999, multi: (lv) => 10.40 + (lv - 1) * 0.40 },
    '厄水侵蝕': { attr: '水', ub: 6, cd: 3, multi: (lv) => 3.00 + (lv - 1) * 0.35, deffnum: 4 },
    '星辰墜落': { attr: '宇', ub: 4, cd: 1, multi: (lv) => 5.00 + (lv - 1) * 0.85 },
    '宙序裁決': { attr: '宙', ub: 10, cd: 8, multi: (lv) => 8.00 + (lv - 1) * 1.00 },
    '星界終焉': { attr: '宙', ub: 8, cd: 4, multi: (lv) => 4.00 + (lv - 1) * 0.65 }
};

const OTHER_SKILLS_DATA = {
    '野蠻震盪': { attr: '控制', ub: 4, cd: 2, multi: (lv) => 0.30 + (lv - 1) * 0.30, stun: (lv) => 1 + lv / 10, bindlimit: (lv) => lv / 10 },
    '終絕爆破': { attr: '追擊', ub: 12, cd: 999, multi: (lv) => 0.40 + (lv - 1) * 0.40, extraattack: (lv) => 1 + lv / 10 },
    '艦船冷卻加成': { attr: '冷卻', ub: 0, cd: 0, multi: (lv) => lv * 1 }
};

const BUFF_SKILLS_DATA = {
    '狂戰': { attr: '增益', ub: 0, cd: 6, effect: 'attack', multi: (lv) => 1.20 + (lv - 1) * 0.03, dur: 3 },
    '閃避': { attr: '增益', ub: 1, cd: 999, effect: 'evasion', multi: (lv) => 2.00 + (lv - 1) * 0.1, dur: 1 },
    '神聖護盾': { attr: '抵禦', ub: 3, cd: 999, effect: 'invincible', multi: (lv) => 1, dur: 2 },
    '會心': { attr: '增益', ub: 0, cd: 4, effect: 'hit_rate', multi: (lv) => 1.01 + (lv - 1) * 0.01, dur: 3 },
    //'靈魂庇佑': { attr: '輔助', ub: 2, cd: 3, effect: 'resistance', prob: (lv) => 1.00 + (lv - 1) * 1.00, dur: 3 },
};

const HEAL_SKILLS_DATA = {
    '緊急治療': { attr: '治療', ub: 0, cd: 5, multi: (lv) => 1.10 + (lv - 1) * 0.15 },
    '大治療術': { attr: '治療', ub: 3, cd: 5, multi: (lv) => 2.00 + (lv - 1) * 0.15 },
    '永恆之泉': { attr: '治療', ub: 7, cd: 999, multi: (lv) => 5.10 + (lv - 1) * 0.10 },
    '不滅意志': { attr: '治療', ub: 10, cd: 1, multi: (lv) => 0.13 + (lv - 1) * 0.03 }
};

const DOT_SKILLS_DATA = {
    '燃燒': { dotnum: 1, dmg: (lv) => 25 + (lv - 1) * 4, dur: 3 },
    '侵蝕': { dotnum: 2, dmg: (lv) => 25 + (lv - 1) * 2, dur: 2 },
    '虛空侵蝕': { dotnum: 3, dmg: (lv) => 500 + (lv - 1) * 10, dur: 6 }
}

const DEBUFF_SKILLS_DATA = {
    '虛弱詛咒': { debuffnum: 1, attr: 'attack', effect: 0.1, prob: 50, dur: 2 },
    '暗氣纏繞': { debuffnum: 2, attr: 'speed', effect: 0.2, prob: 50, dur: 2 },
    '電流癱瘓': { debuffnum: 3, attr: 'evasion', effect: 0.25, prob: 25, dur: 1 },
    '厄水': { debuffnum: 4, attr: 'extra_evasion_bonus', effect: 0.4, prob: 40, dur: 3 }
}
