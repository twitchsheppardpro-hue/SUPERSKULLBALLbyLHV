
/* Skullball V2 – minimal functional logic
 * - charge ./data/team.json
 * - génère calendrier round-robin (aller simple)
 * - onglets + sous-onglets
 * - live card : joueurs (masque "nul"), -, F, play/pause/reset, "Match terminé"
 * - classement calculé (Pts/Diff/BP/BC + BO/BD selon règles)
 * - liste "Matchs terminés" avec filtres Jx
 * - persistance localStorage (règles, résultats, calendrier)
 */
(() => {
  // --------- utils ---------
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => [...r.querySelectorAll(s)];
  const el = (tag, attrs={}) => {
    const n = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else n.setAttribute(k, v);
    }
    return n;
  };
  const fmtTime = (sec) => {
    const m = Math.floor(sec/60);
    const s = sec%60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  // --------- state ---------
  const STORAGE_KEY = 'skullball:v2';
  const state = {
    teams: [],
    rules: {
      win: 3, draw: 1, loss: 0,
      bonusEnabled: false,
      boThreshold: 3, // écart >= X pour BO
      bdThreshold: 1, // défaite par <= X pour BD
      duration: 15,
      forfeitScore: 3,
    },
    schedule: [], // [{round, matches:[{id, homeId, awayId, type:'poule'}]}]
    finals: [],
    current: {
      match: null, // {id, round, type, homeId, awayId}
      running: false,
      timerId: null,
      remainingSec: 15*60,
      aGoals: 0, bGoals: 0,
      aLog: [], bLog: [], // [{name, minute}]
      status: 'A VENIR', // A VENIR | EN DIRECT | MATCH TERMINE
    },
    results: {}, // matchId -> {homeGoals, awayGoals, round, type, aLog, bLog, forfeit: null|'A'|'B'}
  };

  // --------- storage ---------
  function save() {
    const payload = {
      rules: state.rules,
      schedule: state.schedule,
      finals: state.finals,
      results: state.results,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }
  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.rules) Object.assign(state.rules, parsed.rules);
      if (parsed.schedule) state.schedule = parsed.schedule;
      if (parsed.finals) state.finals = parsed.finals;
      if (parsed.results) state.results = parsed.results;
    } catch(e){ console.warn('loadSaved error', e); }
  }

  // --------- data ---------
  async function loadTeams() {
    const res = await fetch('./data/team.json', {cache:'no-cache'});
    if (!res.ok) throw new Error('Impossible de charger ./data/team.json');
    const data = await res.json();
    state.teams = (data.teams||[]).map(t => ({
      id: t.id,
      name: t.name,
      short: t.short || t.name,
      logo: t.logo || '',
      players: (t.players||[]).map(p => (typeof p === 'string' ? p : ''))
    }));
  }

  // --------- round-robin (circle) ---------
  function roundRobin(teams) {
    const ids = teams.map(t => t.id);
    const n = ids.length;
    const isOdd = n % 2 === 1;
    const arr = ids.slice();
    if (isOdd) arr.push(null); // bye
    const m = arr.length;
    const rounds = m-1;
    const left = arr.slice(0, m/2);
    const right = arr.slice(m/2).reverse();
    const out = [];
    for (let r=0; r<rounds; r++) {
      const matches = [];
      for (let i=0; i<m/2; i++) {
        const a = left[i], b = right[i];
        if (a !== null && b !== null) {
          matches.push({ id: `R${r+1}-${a}v${b}`, homeId:a, awayId:b, round:r+1, type:'poule' });
        }
      }
      out.push({ round: r+1, matches });
      // rotate (except first of left)
      const hold = left.splice(1,1)[0];
      left.splice(1,0, right.shift());
      right.push(hold);
    }
    return out;
  }

  // --------- standings ---------
  function computeStandings() {
    // base
    const table = new Map();
    state.teams.forEach(t => {
      table.set(t.id, { team:t, J:0,G:0,N:0,P:0,BP:0,BC:0,Diff:0,BO:0,BD:0,Pts:0 });
    });
    // accumulate only poule matches
    for (const res of Object.values(state.results)) {
      if (res.type !== 'poule') continue;
      const A = table.get(res.homeId);
      const B = table.get(res.awayId);
      if (!A || !B) continue;
      A.J++; B.J++;
      A.BP += res.homeGoals; A.BC += res.awayGoals;
      B.BP += res.awayGoals; B.BC += res.homeGoals;
      const diff = res.homeGoals - res.awayGoals;
      // outcome
      let aPts=0, bPts=0, aBO=0, bBO=0, aBD=0, bBD=0;
      if (diff > 0) { // home win
        aPts += state.rules.win; bPts += state.rules.loss; A.G++; B.P++;
      } else if (diff < 0) { // away win
        bPts += state.rules.win; aPts += state.rules.loss; B.G++; A.P++;
      } else { // draw
        aPts += state.rules.draw; bPts += state.rules.draw; A.N++; B.N++;
      }
      if (state.rules.bonusEnabled) {
        const absd = Math.abs(diff);
        if (diff > 0 && absd >= state.rules.boThreshold) { aPts++; aBO=1; }
        if (diff < 0 && absd >= state.rules.boThreshold) { bPts++; bBO=1; }
        if (diff > 0 && absd <= state.rules.bdThreshold) { bPts++; bBD=1; }
        if (diff < 0 && absd <= state.rules.bdThreshold) { aPts++; aBD=1; }
      }
      A.Pts += aPts; B.Pts += bPts;
      A.BO += aBO; B.BO += bBO;
      A.BD += aBD; B.BD += bBD;
    }
    // finalize diff
    table.forEach(v => v.Diff = v.BP - v.BC);
    // sort
    const rows = [...table.values()].sort((x,y) => {
      if (y.Pts !== x.Pts) return y.Pts - x.Pts;
      if (y.Diff !== x.Diff) return y.Diff - x.Diff;
      if (y.BP !== x.BP) return y.BP - x.BP;
      return x.team.name.localeCompare(y.team.name, 'fr', {sensitivity:'base'});
    });
    return rows;
  }
  function renderStandings() {
    const tbody = qs('#standings');
    tbody.innerHTML = '';
    const rows = computeStandings();
    rows.forEach((r, idx) => {
      const tr = el('tr');
      tr.innerHTML = `
        <td class="pos">${idx+1}</td>
        <td><div class="team"><img class="logo" src="${r.team.logo}" alt=""><span>${r.team.name}</span></div></td>
        <td>${r.J}</td><td>${r.G}</td><td>${r.N}</td><td>${r.P}</td>
        <td>${r.BP}</td><td>${r.BC}</td><td>${r.Diff}</td>
        <td>${r.BO||0}</td><td>${r.BD||0}</td><td>${r.Pts}</td>`;
      tbody.appendChild(tr);
    });
  }

  // --------- finished view ---------
  function buildFinishedFilters() {
    const sub = qs('#finished-filters');
    sub.innerHTML = '';
    const totalRounds = state.schedule.length;
    for (let r=1; r<=totalRounds; r++) {
      const b = el('button', {class:'pill sub', text:`J${r}`});
      b.dataset.filter = `J${r}`;
      b.addEventListener('click', () => {
        qsa('#finished-filters .pill').forEach(p => p.classList.remove('active'));
        b.classList.add('active');
        renderFinished(`J${r}`);
      });
      sub.appendChild(b);
    }
    // default activate J1 if exists
    if (sub.firstChild) sub.firstChild.classList.add('active');
  }
  function renderFinished(filter=null) {
    const list = qs('#finished');
    list.innerHTML = '';
    const entries = Object.entries(state.results)
      .map(([id, r]) => ({id, ...r}))
      .filter(r => r.type === 'poule'); // simple: n'affiche que poule ici
    const byRound = new Map();
    entries.forEach(r => {
      const key = `J${r.round}`;
      if (!byRound.has(key)) byRound.set(key, []);
      byRound.get(key).push(r);
    });
    const show = filter ? (byRound.get(filter)||[]) : entries;
    show.sort((a,b)=> a.round - b.round);
    for (const r of show) {
      const A = state.teams.find(t => t.id===r.homeId);
      const B = state.teams.find(t => t.id===r.awayId);
      const card = el('div', {class:'card'});
      card.innerHTML = `
        <div class="sidecell"><img src="${A.logo}" alt=""><span>${A.name}</span></div>
        <div class="center">${r.homeGoals}–${r.awayGoals}</div>
        <div class="sidecell right"><span>${B.name}</span><img src="${B.logo}" alt=""></div>
        <div class="scorers-log">
          <span class="left">${r.aLog.map(s=>`${s.name} ${s.minute}’`).join(', ')||'—'}</span>
          <span class="right">${r.bLog.map(s=>`${s.name} ${s.minute}’`).join(', ')||'—'}</span>
        </div>`;
      list.appendChild(card);
    }
  }

  // --------- RR list ---------
  function renderRRList() {
    const root = qs('#rr-list');
    root.innerHTML = '';
    state.schedule.forEach(rd => {
      const wrap = el('div', {class:'round'});
      const title = el('h4', {text:`Journée ${rd.round}`});
      wrap.appendChild(title);
      rd.matches.forEach(m => {
        const A = state.teams.find(t => t.id===m.homeId);
        const B = state.teams.find(t => t.id===m.awayId);
        const row = el('div', {class:'match'});
        const teams = el('div', {class:'teams'});
        teams.append(
          el('img', {src:A.logo, class:'logo', alt:''}),
          el('span', {text:A.name}),
          el('span', {class:'vs', text:'vs'}),
          el('span', {text:B.name}),
          el('img', {src:B.logo, class:'logo', alt:''}),
        );
        const go = el('button', {class:'go', text:'Charger'});
        go.addEventListener('click', () => loadLiveMatch(m));
        row.append(teams, go);
        wrap.appendChild(row);
      });
      root.appendChild(wrap);
    });
  }

  // --------- Live ---------
  function resetCurrent() {
    const d = state.rules.duration*60;
    Object.assign(state.current, {
      running:false, remainingSec:d, aGoals:0, bGoals:0, aLog:[], bLog:[], status:'A VENIR'
    });
    qs('#matchStatus').textContent = 'À VENIR';
    qs('#timer').textContent = fmtTime(d);
    qs('#as').textContent = '0';
    qs('#bs').textContent = '0';
  }
  function makePlayerButtons(container, players, side) {
    container.innerHTML = '';
    const valid = players.filter(p => p && String(p).toLowerCase() !== 'nul');
    valid.slice(0,6).forEach(name => {
      const b = el('button', {text:name});
      b.addEventListener('click', () => addGoal(side, name));
      container.appendChild(b);
    });
  }
  function addScorersContainers() {
    // ensure scorer containers exist once
    if (!qs('.team-side.left-side .scorers')) {
      const a = el('div', {class:'scorers small'});
      const b = el('div', {class:'scorers small'});
      a.style.cssText = 'font-size:12px;color:#9CA9BB;margin-bottom:6px;min-height:18px';
      b.style.cssText = 'font-size:12px;color:#9CA9BB;margin-bottom:6px;min-height:18px;text-align:right';
      qs('.team-side.left-side .team-info').after(a);
      qs('.team-side.right-side .team-info').after(b);
    }
  }
  function renderScorers() {
    const left = qs('.team-side.left-side .scorers');
    const right = qs('.team-side.right-side .scorers');
    left.textContent = state.current.aLog.map(s=>`${s.name} ${s.minute}’`).join(' · ') || '—';
    right.textContent = state.current.bLog.map(s=>`${s.name} ${s.minute}’`).join(' · ') || '—';
  }
  function addGoal(side, name) {
    if (!state.current.match) return;
    const elapsedMin = state.rules.duration - Math.floor(state.current.remainingSec/60);
    const entry = {name, minute: Math.max(1, elapsedMin)};
    if (side==='A') {
      state.current.aGoals++; state.current.aLog.push(entry);
      qs('#as').textContent = state.current.aGoals;
    } else {
      state.current.bGoals++; state.current.bLog.push(entry);
      qs('#bs').textContent = state.current.bGoals;
    }
    renderScorers();
  }
  function removeLast(side) {
    if (side==='A' && state.current.aLog.length) {
      state.current.aLog.pop(); state.current.aGoals = Math.max(0, state.current.aGoals-1);
      qs('#as').textContent = state.current.aGoals;
    }
    if (side==='B' && state.current.bLog.length) {
      state.current.bLog.pop(); state.current.bGoals = Math.max(0, state.current.bGoals-1);
      qs('#bs').textContent = state.current.bGoals;
    }
    renderScorers();
  }
  function setStatus(text) {
    qs('#matchStatus').textContent = text;
    state.current.status = text;
  }
  function startTimer() {
    if (!state.current.match || state.current.running) return;
    setStatus('EN DIRECT');
    state.current.running = true;
    state.current.timerId = setInterval(() => {
      state.current.remainingSec = Math.max(0, state.current.remainingSec-1);
      qs('#timer').textContent = fmtTime(state.current.remainingSec);
      if (state.current.remainingSec === 0) {
        pauseTimer();
      }
    }, 1000);
  }
  function pauseTimer() {
    state.current.running = false;
    if (state.current.timerId) clearInterval(state.current.timerId);
    state.current.timerId = null;
  }
  function resetTimer() {
    pauseTimer();
    state.current.remainingSec = state.rules.duration*60;
    qs('#timer').textContent = fmtTime(state.current.remainingSec);
    setStatus('À VENIR');
  }
  function finishMatch(reason='normal', loser=null) {
    if (!state.current.match) return;
    pauseTimer();
    setStatus('Match terminé');
    // if forfait
    if (reason==='forfeit' && loser) {
      if (loser==='A') {
        state.current.aGoals = 0;
        state.current.bGoals = state.rules.forfeitScore;
        state.current.aLog = [];
      } else {
        state.current.bGoals = 0;
        state.current.aGoals = state.rules.forfeitScore;
        state.current.bLog = [];
      }
      qs('#as').textContent = state.current.aGoals;
      qs('#bs').textContent = state.current.bGoals;
      renderScorers();
    }
    // save result
    const m = state.current.match;
    state.results[m.id] = {
      id: m.id,
      round: m.round,
      type: m.type,
      homeId: m.homeId, awayId: m.awayId,
      homeGoals: state.current.aGoals,
      awayGoals: state.current.bGoals,
      aLog: state.current.aLog.slice(),
      bLog: state.current.bLog.slice(),
      forfeit: reason==='forfeit' ? (loser==='A'?'A':'B') : null,
    };
    save();
    renderStandings();
    buildFinishedFilters();
    renderFinished(qs('#finished-filters .pill.active')?.dataset.filter || null);
  }

  function loadLiveMatch(m) {
    state.current.match = m;
    // names/logos
    const A = state.teams.find(t => t.id===m.homeId);
    const B = state.teams.find(t => t.id===m.awayId);
    qs('#aName').textContent = A.name;
    qs('#aLogo').src = A.logo;
    qs('#bName').textContent = B.name;
    qs('#bLogo').src = B.logo;
    qs('#matchType').textContent = (m.type==='poule') ? `Journée ${m.round}` : (m.type||'Match');
    // players
    makePlayerButtons(qs('#aPlayers'), A.players, 'A');
    makePlayerButtons(qs('#bPlayers'), B.players, 'B');
    addScorersContainers();
    resetCurrent();
    // switch to live tab
    activateTab('live');
  }

  // --------- tabs ---------
  function activateTab(key) {
    const map = { classement:'#tab-classement', live:'#tab-live', finished:'#tab-finished', manage:'#tab-manage' };
    qsa('main > .panel').forEach(p => p.hidden = true);
    qs(map[key]).hidden = false;
    qsa('.nav .pill').forEach(b => b.classList.toggle('active', b.dataset.tab === key));
  }
  function initTabs() {
    qsa('.nav .pill').forEach(btn => {
      btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    });
    // subnav
    const views = {
      tableau: '#view-tableau',
      bracket: '#view-bracket',
      buteurs: '#view-buteurs'
    };
    qsa('.subnav .pill').forEach(btn => {
      btn.addEventListener('click', () => {
        qsa('.subnav .pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        for (const v of Object.values(views)) qs(v).hidden = true;
        qs(views[btn.dataset.sub]).hidden = false;
      });
    });
    // defaults
    activateTab('classement');
    const firstSub = qs('.subnav .pill');
    if (firstSub) firstSub.click();
  }

  // --------- admin ---------
  function initAdmin() {
    // hydrate from saved
    qs('#winPts').value = state.rules.win;
    qs('#drawPts').value = state.rules.draw;
    qs('#lossPts').value = state.rules.loss;
    qs('#enableBonus').checked = !!state.rules.bonusEnabled;
    qs('#boThreshold').value = state.rules.boThreshold;
    qs('#bdThreshold').value = state.rules.bdThreshold;
    qs('#matchDuration').value = state.rules.duration;
    qs('#forfeitScore').value = state.rules.forfeitScore;
    // wire change
    function saveRules() {
      state.rules.win = +qs('#winPts').value;
      state.rules.draw = +qs('#drawPts').value;
      state.rules.loss = +qs('#lossPts').value;
      state.rules.bonusEnabled = qs('#enableBonus').checked;
      state.rules.boThreshold = +qs('#boThreshold').value;
      state.rules.bdThreshold = +qs('#bdThreshold').value;
      state.rules.duration = Math.max(1, +qs('#matchDuration').value);
      state.rules.forfeitScore = Math.max(0, +qs('#forfeitScore').value);
      save();
      resetCurrent();
      renderStandings();
    }
    qsa('#tab-manage input').forEach(inp => inp.addEventListener('change', saveRules));
    qs('#enableBonus').addEventListener('change', () => {
      qs('#bonusSettings').classList.toggle('hidden', !qs('#enableBonus').checked);
      saveRules();
    });
    // buttons
    qs('#generateSchedule').addEventListener('click', () => {
      state.schedule = roundRobin(state.teams);
      save();
      renderRRList();
      buildFinishedFilters();
    });
    qs('#generateBracket').addEventListener('click', () => {
      alert('Génération des phases finales : placeholder (les brackets se rempliront à la fin des poules).');
    });
    qs('#wipe').addEventListener('click', () => {
      if (!confirm('Ré-initialiser toutes les données locales ?')) return;
      localStorage.removeItem(STORAGE_KEY);
      state.results = {};
      save();
      renderStandings();
      renderFinished(null);
    });
    // admin button nav
    qs('#adminBtn').addEventListener('click', () => activateTab('manage'));
    // show bonus section correctly
    qs('#bonusSettings').classList.toggle('hidden', !state.rules.bonusEnabled);
  }

  // --------- live controls wiring ---------
  function initLiveControls() {
    qs('#play').addEventListener('click', startTimer);
    qs('#pause').addEventListener('click', pauseTimer);
    qs('#reset').addEventListener('click', resetTimer);
    qs('#finish').addEventListener('click', () => finishMatch('normal'));
    qs('#aMoins').addEventListener('click', () => removeLast('A'));
    qs('#bMoins').addEventListener('click', () => removeLast('B'));
    qs('#aForfait').addEventListener('click', () => finishMatch('forfeit','A'));
    qs('#bForfait').addEventListener('click', () => finishMatch('forfeit','B'));
  }

  // --------- boot ---------
  async function boot() {
    loadSaved();
    initTabs();
    initAdmin();
    initLiveControls();
    try {
      await loadTeams();
      // initial schedule if absent
      if (!state.schedule || state.schedule.length === 0) {
        state.schedule = roundRobin(state.teams);
      }
      renderRRList();
      renderStandings();
      buildFinishedFilters();
      renderFinished(null);
      // header logo if present
      const ev = qs('#eventLogo');
      if (ev && !ev.getAttribute('src')) ev.src = './logos/logoevent.png';
    } catch (e) {
      console.error(e);
      alert('Erreur: ' + e.message + '\nVérifie /data/team.json et les chemins.');
    }
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
