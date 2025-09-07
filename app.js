// Split from Skullball_LHV_V8.20_runtime.html


  const STORAGE_KEY='tournifyOverlayV5';

  // Dedicated storage key for players (robust like teams)
  const STORAGE_KEY_PLAYERS = STORAGE_KEY + '_players';
  function savePlayersOnly(){
    try { localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(state.players||[])); return true; } catch(e) {}
    try { sessionStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(state.players||[])); return true; } catch(e) {}
    return false;
  }
  function loadPlayersOnly(){
    let raw=null;
    try{ raw = localStorage.getItem(STORAGE_KEY_PLAYERS); }catch(e){}
    if(!raw){ try{ raw = sessionStorage.getItem(STORAGE_KEY_PLAYERS); }catch(e){} }
    if(!raw) return false;
    try{
      const arr = JSON.parse(raw||'[]') || [];
      if(Array.isArray(arr) && arr.length > 0){ state.players = arr; }
      return true;
    }catch(_){ return false; }
  }

  let state={
    league:{name:'Ma Ligue',logo:'',publicMode:false},
    teams:[],
    matches:[],
    settings:{
      points:{win:3,draw:1,loss:0},
      bonus:{boPoints:1,boMargin:3,bdPoints:1,bdMargin:1,enabled:true},
      defaultDuration:15*60,
      theme:{preset:'europa',accent:'#ff5f00',bg1:'#0b0c10',bg2:'#151824'},
      },
    ui:{finishedDay:'0'}
  };

  function uid(){return Math.random().toString(36).slice(2,9)};
  function save(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }catch(e){
    try{
      // Fallback: strip heavy dataURL logos to fit quota
      const slim = JSON.parse(JSON.stringify(state));
      if(Array.isArray(slim.teams)){
        slim.teams = slim.teams.map(t=>{
          if(t && typeof t.logo==='string' && t.logo.startsWith('data:')){ return Object.assign({}, t, {logo:''}); }
          return t;
        });
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    }catch(_e){ console.warn('Save failed even after slimming:', _e); }
  }
  updateStorageNote();
}
  function load(){const r=localStorage.getItem(STORAGE_KEY);if(r){try{state=JSON.parse(r)}catch(e){}}}
  load();
  try{ loadPlayersOnly(); }catch(_){}
  if(!Array.isArray(state.players)) state.players=[];
  const isLocal = (location.protocol === 'file:');
  const urlPublic = (!isLocal) && (new URLSearchParams(location.search).get('public')==='1');
  // Force EDIT mode for local files; only honor ?public=1 over http(s)
  if(isLocal){ state.league.publicMode=false; save(); }
  else if(urlPublic){ state.league.publicMode=true; save(); }

  function applyTheme(){
    const t=state.settings.theme||{preset:'europa'};
    const root=document.documentElement;
    if(t.preset==='europa'){
      root.style.setProperty('--accent',t.accent||'#ff5f00');
      root.style.setProperty('--bg-grad',`linear-gradient(135deg, ${t.bg1||'#0b0c10'}, ${t.bg2||'#151824'} 55%, #10131c)`);
      root.style.setProperty('--header-grad','linear-gradient(90deg,rgba(255,95,0,.15),rgba(255,95,0,.05) 35%, transparent)');
      root.style.setProperty('--mid-grad','linear-gradient(180deg,#151a26,#10141f)');
    }else if(t.preset==='ucl'){
      root.style.setProperty('--accent',t.accent||'#00a3ff');
      root.style.setProperty('--bg-grad',`radial-gradient(1200px 600px at 20% -10%, rgba(0,163,255,.12), transparent 60%), linear-gradient(135deg, ${t.bg1||'#070b14'}, ${t.bg2||'#0e1422'} 55%, #0a0f1b)`);
      root.style.setProperty('--header-grad','linear-gradient(90deg,rgba(0,163,255,.18),rgba(0,163,255,.06) 35%, transparent)');
      root.style.setProperty('--mid-grad','linear-gradient(180deg,#10192a,#0b1324)');
    }else{
      root.style.setProperty('--accent',t.accent||'#ff5f00');
      root.style.setProperty('--bg-grad',`linear-gradient(135deg, ${t.bg1||'#0b0c10'}, ${t.bg2||'#151824'} 55%, #10131c)`);
      root.style.setProperty('--header-grad','linear-gradient(90deg,rgba(255,255,255,.06),rgba(255,255,255,.03) 35%, transparent)');
      root.style.setProperty('--mid-grad','linear-gradient(180deg,#151a26,#10141f)');
    }
  }

  function teamById(id){return state.teams.find(t=>t.id===id)}
  function logoTag(t,size=28){
    const src=t?.logo||'';
    return `<img src="${src}" alt="logo" width="${size}" height="${size}" style="border-radius:10px;object-fit:cover;border:1px solid #30384b;background:#0e111a">`;
  }
  function escapeHtml(s){return (s||'').replace(/[&<>\"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
  function fmtTime(sec){
    sec=Math.max(0,sec|0);
    const m=Math.floor(sec/60),s=sec%60;
    return `${m}:${s.toString().padStart(2,'0')}`
  }

  function headToHeadCompare(id1,id2){
    // Compare id1 vs id2 on head-to-head (points then goal diff)
    const {win,draw,loss}=state.settings.points;
    let p1=0,p2=0,gd1=0,gd2=0;
    for(const m of state.matches){
      if(m.stage!=='league') continue;
      if(!( (m.a===id1 && m.b===id2) || (m.a===id2 && m.b===id1) )) continue;
      if(m.ga==null || m.gb==null) continue;

      const aIs1 = (m.a===id1);
      const ga = m.ga, gb = m.gb;
      // points
      if(ga>gb){
        if(aIs1) p1+=win; else p2+=win;
        if(!aIs1) p1+=loss; else p2+=loss;
      } else if(ga<gb){
        if(aIs1) p2+=win; else p1+=win;
        if(!aIs1) p2+=loss; else p1+=loss;
      } else { // draw
        p1+=draw; p2+=draw;
      }
      // goal diff
      const d = ga-gb;
      if(aIs1){ gd1+=d; gd2-=d; } else { gd2+=d; gd1-=d; }
    }
    if(p1!==p2) return p2-p1; // higher points first
    if(gd1!==gd2) return gd2-gd1; // higher GD first
    return 0;
  }


  function statusLabel(m, context='live'){
    if(m.status==='upcoming') return 'A venir';
    if(m.status==='live') return 'En direct';
    if(m.status==='final') return context==='finished' ? 'Match terminé' : 'Fin de match';
    return '';
  }

  function ensureDefaults(m){
    if(m.ga==null)m.ga=0;
    if(m.gb==null)m.gb=0;
    if(!m.status)m.status='upcoming';
    if(!m.duration)m.duration=state.settings.defaultDuration;
    if(m.seconds==null)m.seconds=m.duration;
    if(!m.stage)m.stage='league';
  }

  function toast(msg='Action effectuée ✅'){
    const t=document.getElementById('toast');
    t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)
  }

  function updateStorageNote(){
    const note=document.getElementById('storageNote');
    if(!note)return;
    try{
      const used=new Blob([JSON.stringify(state)]).size;
      const mb=(used/1024/1024).toFixed(2);
      note.textContent=`Stockage utilisé : ${mb} Mo (limite ~5 Mo selon navigateur).`;
    }catch(e){}
  }

  function renderLeagueHead(){
    document.getElementById('leagueName').textContent=state.league.name||'Ma Ligue';
    const lg=document.getElementById('leagueLogo');
    lg.src=state.league.logo||'';
    lg.style.display=state.league.logo?'block':'none';
  }

  function computeStandings(){
    const stats=new Map();
    for(const t of state.teams){stats.set(t.id,{team:t,mp:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0,bo:0,bd:0})}
    const {win,draw,loss}=state.settings.points;
    const {boPoints,boMargin,bdPoints,bdMargin,enabled:bonusOn}=state.settings.bonus;
    for(const m of state.matches){
      if(m.stage!=='league')continue;
      if(m.status!=='final')continue; // count only finished matches
      const A=stats.get(m.a),B=stats.get(m.b);
      A.mp++;B.mp++;
      A.gf+=m.ga;A.ga+=m.gb;A.gd=A.gf-A.ga;
      B.gf+=m.gb;B.ga+=m.ga;B.gd=B.gf-B.ga;
      if(m.ga>m.gb){
        A.w++;B.l++;A.pts+=win;B.pts+=loss;
        if(bonusOn && (m.ga-m.gb)>=boMargin){A.pts+=boPoints;A.bo+=1}
        if(bonusOn && (m.ga-m.gb)<=bdMargin){B.pts+=bdPoints;B.bd+=1}
      }else if(m.ga<m.gb){
        B.w++;A.l++;B.pts+=win;A.pts+=loss;
        if(bonusOn && (m.gb-m.ga)>=boMargin){B.pts+=boPoints;B.bo+=1}
        if(bonusOn && (m.gb-m.ga)<=bdMargin){A.pts+=bdPoints;A.bd+=1}
      }else{
        A.d++;B.d++;A.pts+=draw;B.pts+=draw
      }
    }
    const rows=[...stats.values()].sort((x,y)=>{
      if(y.pts!==x.pts)return y.pts-x.pts;
      if(y.gd!==x.gd)return y.gd-x.gd;
      if(state.settings.bonus.enabled){
        if(y.bo!==x.bo)return y.bo-x.bo;
        if(y.bd!==x.bd)return y.bd-x.bd;
      }
      const h2h = headToHeadCompare(x.team.id, y.team.id);
      if(h2h!==0) return h2h;
      if(y.gf!==x.gf)return y.gf-x.gf;
      return x.team.name.localeCompare(y.team.name)
    });
    return rows
  }

  function renderStandings(){
    const subt=document.getElementById('rankSubtitle');
    if(subt){ subt.textContent = (state.settings?.bonus?.enabled)? 'Tri: Points ▶︎ Diff ▶︎ BO ▶︎ BD ▶︎ Confrontation directe.' : 'Tri: Points ▶︎ Diff ▶︎ Confrontation directe.'; }
    renderLeagueHead();
    const el=document.getElementById('standingsWrap');
    const rows=computeStandings();
    
    const withBonus = !!(state.settings?.bonus?.enabled);
    const thead = `<thead><tr>
      <th class="rank">#</th><th>Équipe</th><th>J</th><th>G</th><th>N</th><th>P</th>
      <th>BP</th><th>BC</th><th>Diff</th>${withBonus?'<th class="bo">BO</th><th class="bd">BD</th>':''}<th class="pts">Pts</th>
    </tr></thead>`;

    
    const tbody = rows.map((r,i)=>`<tr>
      <td class="rank">${i+1}</td>
      <td><div class="team-cell">${logoTag(r.team,56)} <span>${escapeHtml(r.team.name)}</span></div></td>
      <td>${r.mp}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td>
      <td>${r.gf}</td><td>${r.ga}</td><td>${r.gd}</td>
      ${withBonus?`<td>${r.bo}</td><td>${r.bd}</td>`:''}<td class="pts">${r.pts}</td>
    </tr>`).join('');

    el.innerHTML = `<table>${thead}<tbody>${tbody}</tbody></table>`;
  }

  /* ---------- LIVE + FINISHED ---------- */

  function banner(label){
    const b=document.createElement('div');
    b.className='banner'; b.textContent=label; return b;
  }

  

function makeLiveCard(m, context='live'){ // context: 'live' or 'finished'
  ensureDefaults(m); save();
  const A=teamById(m.a),B=teamById(m.b);
  const card=document.createElement('div');
  card.className='match-card';
  const rowBgLeft=A?.color||'#202532'; const rowBgRight=B?.color||'#202532';

    const meta = (m.stage==='KO') ? (()=>{
    const map = {'QF':'Barrage','Demi':'Demi-finale','Finale':'Finale'};
    const lbl = map[m.round] || 'Phase finale';
    return `<div class="meta">
      <span class="badge day">${lbl}</span>
      <span class="badge status">${statusLabel(m, context)}</span>
    </div>`;
  })() : `
    <div class="meta">
      <span class="badge day">Journée ${m.matchday||"—"}</span>
      <span class="badge status">${statusLabel(m, context)}</span>
    </div>`;

  const controls = (!state.league.publicMode && context==='live') ? `
    <div class="controls" style="margin-top:10px">
      <button class="mini" data-act="decA">–</button><button class="mini" data-act="incA">+ A</button>
      <button class="mini" data-act="incB">+ B</button><button class="mini" data-act="decB">–</button>
    </div>` : ``;

  card.innerHTML = `
    <div class="row" style="background:linear-gradient(90deg, ${rowBgLeft} 0%, #0f1220 50%, ${rowBgRight} 100%);">
      <div class="bg-half left" style="background-image:${A?.logo?`url('${A.logo}')`:'none'};"></div>
      <div class="bg-half right" style="background-image:${B?.logo?`url('${B.logo}')`:'none'};"></div>

      <div class="cell" style="text-align:center">${logoTag(A,72)}</div>
      <div class="cell">
        <div class="team"><span class="name">${escapeHtml(A?.name||'Équipe A')}</span></div>
      </div>
      <div class="cell mid">
        ${meta}
        <div class="score" id="score-${m.id}">${m.ga}<span style="color:var(--muted)"> – </span>${m.gb}</div>
        ${context==='live' ? `<span class="badge timer big" id="timer-${m.id}">${fmtTime(m.seconds)}</span>` : ``}
        ${(!state.league.publicMode && context==='finished') ? `<div class="controls"><button class="badge" data-act="reopen">Annuler le résultat</button></div>` : ``}
        ${controls}
      </div>
      <div class="cell" style="text-align:right">
        <div class="team" style="justify-content:flex-end"><span class="name">${escapeHtml(B?.name||'Équipe B')}</span></div>
      </div>
      <div class="cell" style="text-align:center">${logoTag(B,72)}</div>
    </div>
    <div class="footer">
      ${(!state.league.publicMode && context==='live') ? `
        <div class="controls">
          <button class="mini" data-act="start">▶︎</button>
          <button class="mini" data-act="pause">⏸</button>
          <button class="mini" data-act="reset">↺</button>
          <button class="mini" data-act="final">Match terminé</button>
        </div>` : `<div></div>`}
      <div class="sub">ID ${m.id}${m.stage==='KO' ? ` • ${m.round}`:''}</div>
    </div>
  `;

  if(!state.league.publicMode && (context==='live' || context==='finished')){
    card.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const act=btn.dataset.act;
        if(act==='incA'){m.ga++}
        if(act==='decA'){m.ga=Math.max(0,m.ga-1)}
        if(act==='incB'){m.gb++}
        if(act==='decB'){m.gb=Math.max(0,m.gb-1)}
        if(act==='start'){ if(m.status==='upcoming')m.status='live'; m.lastTick=Date.now(); tickers.add(m.id) }
        if(act==='pause'){ m.lastTick=null; tickers.delete(m.id) }
        if(act==='reset'){ m.seconds=m.duration; m.lastTick=null; tickers.delete(m.id) }
        if(act==='final'){
          m.status='final'; m.lastTick=null; tickers.delete(m.id);
          if(m.stage==='KO'){ updateKOProgression(); }
        }
        if(act==='reopen'){
          m.ga=0; m.gb=0;
          m.seconds=m.duration;
          m.lastTick=null;
          m.status='upcoming';
          tickers.delete(m.id);
          if(m.stage==='KO'){ updateKOProgression(); }
        }
        save();
        renderStandings();
        renderLive();
        renderFinished();
      })
    });
  }
  return card;
}

  function renderLive(){
    const host=document.getElementById('liveBanners');
    host.innerHTML='';

    // League: group by matchday
    const liveLeague = state.matches
      .filter(m=>m.stage==='league' && (m.status==='upcoming'||m.status==='live'))
      .sort((a,b)=> (a.matchday||0)-(b.matchday||0));
    const days=[...new Set(liveLeague.map(m=>m.matchday||1))].sort((a,b)=>a-b);
    for(const d of days){
      host.appendChild(banner(`Journée N° ${d}`));
      liveLeague.filter(m=> (m.matchday||1)===d).forEach(m=>host.appendChild(makeLiveCard(m,'live')));
    }

    // KO: group by round (QF, Demi, Finale)
    const labelByRound = {'QF':'Barrages','Demi':'Demi-finales','Finale':'Finale'};
    const order = ['QF','Demi','Finale'];
    for(const r of order){
      const arr = state.matches.filter(m=>m.stage==='KO' && m.round===r && (m.status==='upcoming'||m.status==='live'));
      if(arr.length>0){
        host.appendChild(banner(`Phase finale • ${labelByRound[r]}`));
        arr.forEach(m=>host.appendChild(makeLiveCard(m,'live')));
      }
    }
  }

  // Finished view
    function renderFinished(){
    const bar=document.getElementById('finishedFilter');
    const list=document.getElementById('finishedList');
    list.innerHTML='';

    // 1) Construire les filtres : Toutes + Jours + KO
    const finishedLeague = state.matches.filter(m=>m.stage==='league' && m.status==='final');
    const days=[...new Set(finishedLeague.map(m=>m.matchday||1))].sort((a,b)=>a-b);

    // KO rounds finaux disponibles
    const finishedKO = state.matches.filter(m=>m.stage==='KO' && m.status==='final');
    const koOrder = ['QF','Demi','Finale'];
    const koLabel = {'QF':'Barrage', 'Demi':'Demi-finale', 'Finale':'Finale'};
    const koPresent = koOrder.filter(r => finishedKO.some(m=>m.round===r));

    // Construit les chips
    const chips = [];
    chips.push({k:'0', lbl:'Toutes'});
    days.forEach(d => chips.push({k:String(d), lbl:`J${d}`}));
    koPresent.forEach(r => chips.push({k:`KO-${r}`, lbl:koLabel[r]}));

    bar.innerHTML = chips.map(c => {
      const sel = String(state.ui.finishedDay)===c.k ? 'aria-selected="true"' : '';
      return `<button class="chip" data-day="${c.k}" ${sel}>${c.lbl}</button>`;
    }).join('');

    bar.querySelectorAll('.chip').forEach(ch=>{
      ch.addEventListener('click',()=>{
        state.ui.finishedDay = ch.dataset.day; save(); renderFinished();
      });
    });

    // 2) Affichage selon filtre
    const target = String(state.ui.finishedDay||'0');

    // Cas KO filtré
    if(target.startsWith('KO-')){
      const code = target.replace('KO-',''); // 'QF', 'Demi', 'Finale'
      const arr = finishedKO.filter(m=>m.round===code);
      if(arr.length>0){
        list.appendChild(banner(`Phase finale • ${koLabel[code]}`));
        arr.forEach(m=>list.appendChild(makeLiveCard(m,'finished')));
      }else{
        list.appendChild(banner(`Aucun match terminé pour ${koLabel[code]}`));
      }
      return;
    }

    // Cas Toutes ou JX (saison régulière)
    const showLeague = (target==='0')
      ? finishedLeague
      : finishedLeague.filter(m=>String(m.matchday||1)===target);

    const daysToShow = [...new Set(showLeague.map(m=>m.matchday||1))].sort((a,b)=>a-b);
    for(const d of daysToShow){
      list.appendChild(banner(`Journée N° ${d}`));
      showLeague.filter(m=>(m.matchday||1)===d).forEach(m=>list.appendChild(makeLiveCard(m,'finished')));
    }

    // En mode "Toutes" seulement, on affiche aussi les KO à la fin
    if(target==='0'){
      const order = ['QF','Demi','Finale'];
      for(const r of order){
        const arr = finishedKO.filter(m=>m.round===r);
        if(arr.length>0){
          list.appendChild(banner(`Phase finale • ${koLabel[r]}`));
          arr.forEach(m=>list.appendChild(makeLiveCard(m,'finished')));
        }
      }
    }
  }

  // Tick timers
  const tickers=new Set();
  setInterval(()=>{
    if(state.league.publicMode)return;
    const now=Date.now();
    let changed=false;
    for(const id of tickers){
      const m=state.matches.find(x=>x.id===id);
      if(!m||!m.lastTick)continue;
      const dt=Math.floor((now-m.lastTick)/1000);
      if(dt>0){
        m.seconds=Math.max(0,m.seconds-dt);
        m.lastTick=now;
        const el=document.getElementById('timer-'+m.id);
        if(el)el.textContent=fmtTime(m.seconds);
        if(m.seconds===0){ m.lastTick=null; tickers.delete(m.id) }
        changed=true;
      }
    }
    if(changed){ save() }
  },1000);

  /* ---------- KO Bracket (view-only) ---------- */

  function gameNode(m){
    const A=teamById(m.a),B=teamById(m.b);
    const d=document.createElement('div');
    const extraClass = m.round==='Finale' ? 'finale' : (m.round==='Demi' ? 'semi' : '');
    d.className='game '+extraClass;
    d.innerHTML= `
      <div class="line"><div class="t">${logoTag(A,28)} <strong>${escapeHtml(A?.name||'TBD')}</strong></div>
      <div class="score-mini">${m.ga}</div></div>
      <div class="line"><div class="t">${logoTag(B,28)} <strong>${escapeHtml(B?.name||'TBD')}</strong></div>
      <div class="score-mini">${m.gb}</div></div>
    `;
    return d;
  }

  function renderKO(){
    const host=document.getElementById('bracket');
    host.innerHTML='';
    const rounds=[['QF','Barrages'],['Demi','Demi-finales'],['Finale','Finale']];
    const cols=rounds.map(([code,label],i)=>{
      const col=document.createElement('div');
      const roundClass = code==='Demi' ? 'round semi' : (code==='Finale' ? 'round finale' : 'round');
      col.className= roundClass;
      col.innerHTML=`<h4>${label}</h4><div class="games" id="r${i}"></div>`;
      host.appendChild(col);
      return col.querySelector('.games');
    });
    const ko=state.matches.filter(m=>m.stage==='KO');
    const g=(name)=>ko.filter(x=>x.round===name);
    for(const m of g('QF')){cols[0].appendChild(gameNode(m))}
    for(const m of g('Demi')){cols[1].appendChild(gameNode(m))}
    for(const m of g('Finale')){cols[2].appendChild(gameNode(m))}
  }

  function updateKOProgression(){
    // winners from QF
    const qfs = state.matches.filter(m=>m.stage==='KO' && m.round==='QF');
    const demi = state.matches.filter(m=>m.stage==='KO' && m.round==='Demi');
    const finale = state.matches.find(m=>m.stage==='KO' && m.round==='Finale');

    const winner = (m)=> (m.ga>m.gb)? m.a : (m.gb>m.ga? m.b : null);

    // Expected mapping:
    // Demi 1: a=t1, b=winner(4–5) -> that's QF where initial a was t4 vs t5
    // Demi 2: a=t2, b=winner(3–6) -> QF where initial a was t3 vs t6
    const qf45 = qfs.find(x=>{
      const A=teamById(x.a)?.name || ''; const B=teamById(x.b)?.name || '';
      return true; // fallback generic
    });
    // Safer: use creation order: first push was (3 vs 6), second was (4 vs 5)
    const qf36 = qfs[0];
    const qf45b = qfs[1];

    if(demi[0] && qf45b && qf45b.status==='final'){
      const w = winner(qf45b);
      if(w) demi[0].b = w;
    }
    if(demi[1] && qf36 && qf36.status==='final'){
      const w = winner(qf36);
      if(w) demi[1].b = w;
    }

    // Final participants after semis
    if(finale && demi[0] && demi[1]){
      if(demi[0].status==='final'){
        const w = winner(demi[0]); if(w) finale.a = w;
      }
      if(demi[1].status==='final'){
        const w = winner(demi[1]); if(w) finale.b = w;
      }
    }
    save();
    renderKO();
    renderLive();
    renderFinished();
  }

  document.getElementById('genKO').addEventListener('click',()=>{
    const rows=computeStandings();
    if(rows.length<6){alert('Il faut au moins 6 équipes classées.');return}
    // Clear existing KO
    state.matches=state.matches.filter(m=>m.stage!=='KO');
    const t1=rows[0].team.id,t2=rows[1].team.id,t3=rows[2].team.id,t4=rows[3].team.id,t5=rows[4].team.id,t6=rows[5].team.id;
    const dur=state.settings.defaultDuration;

    // QF (barrages)
    state.matches.push({id:uid(),a:t3,b:t6,ga:null,gb:null,status:'upcoming',seconds:dur,duration:dur,stage:'KO',round:'QF'});
    state.matches.push({id:uid(),a:t4,b:t5,ga:null,gb:null,status:'upcoming',seconds:dur,duration:dur,stage:'KO',round:'QF'});

    // Demies: seed 1 & 2 already placed; b will be assigned on winners
    state.matches.push({id:uid(),a:t1,b:null,ga:null,gb:null,status:'upcoming',seconds:dur,duration:dur,stage:'KO',round:'Demi'});
    state.matches.push({id:uid(),a:t2,b:null,ga:null,gb:null,status:'upcoming',seconds:dur,duration:dur,stage:'KO',round:'Demi'});

    // Finale: TBD
    state.matches.push({id:uid(),a:null,b:null,ga:null,gb:null,status:'upcoming',seconds:dur,duration:dur,stage:'KO',round:'Finale'});
    save();
    renderKO();
    renderLive();
  });

  /* ---------- Teams & Matches (admin) ---------- */
  const teamForm=document.getElementById('teamForm');
  const teamsList=document.getElementById('teamsList');
  const resetTeamBtn=document.getElementById('resetTeamForm');

  teamForm.logoFile?.addEventListener('change',async e=>{
    const f=e.target.files?.[0];
    if(!f)return;
    const dataUrl=await compressImageFile(f,96,'png');
    teamForm.logoUrl.value=dataUrl; updateStorageNote()
  });

  async function compressImageFile(file,size=96,format='png'){
    return new Promise((resolve,reject)=>{
      const img=new Image();
      const reader=new FileReader();
      reader.onload=e=>{img.src=e.target.result};
      reader.onerror=reject;
      img.onload=()=>{
        const c=document.createElement('canvas');
        c.width=size; c.height=size;
        const ctx=c.getContext('2d');
        ctx.clearRect(0,0,size,size); // keep transparency for PNG
        const ratio=Math.max(size/img.width,size/img.height);
        const w=img.width*ratio,h=img.height*ratio;
        const x=(size-w)/2,y=(size-h)/2;
        ctx.drawImage(img,x,y,w,h);
        const out=(format==='jpeg')?c.toDataURL('image/jpeg',0.82):c.toDataURL('image/png');
        resolve(out)
      };
      img.onerror=reject;
      reader.readAsDataURL(file)
    })
  }

  teamForm.addEventListener('submit',e=>{
    e.preventDefault();
    if(state.teams.length>=14 && !teamForm.editId.value){alert('Limite de 14 équipes atteinte');return}
    const data=Object.fromEntries(new FormData(teamForm).entries());
    const item={
      id:data.editId||uid(),
      name:(data.name||'').trim(),
      short:((data.name||'').substring(0,3).toUpperCase()),
      color:data.color||'#202532',
      logo:data.logoUrl||''
    };
    if(!item.name){alert('Nom requis');return}
    const idx=state.teams.findIndex(t=>t.id===item.id);
    if(idx>=0)state.teams[idx]=item;else state.teams.push(item);
    save();
    teamForm.reset(); teamForm.color.value='#202532'; teamForm.editId.value='';
    renderTeams(); fillTeamSelects(); renderStandings(); renderLive(); renderKO(); renderFinished();
  });

  resetTeamBtn.addEventListener('click',()=>{
    teamForm.reset(); teamForm.color.value='#202532'; teamForm.editId.value=''
  });

  function renderTeams(){
    teamsList.innerHTML=state.teams.map(t=>`
      <div class="item">
        ${logoTag(t,32)}
        <div>
          <div><strong>${escapeHtml(t.name)}</strong> <span class="sub">(${escapeHtml(t.short)})</span></div>
          <div class="sub">Couleur <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${t.color};border:1px solid #2b3344;vertical-align:middle"></span></div>
        </div>
        <div class="right">
          <button class="mini" data-id="${t.id}" data-act="edit">✎</button>
          <button class="mini" data-id="${t.id}" data-act="del">🗑</button>
        </div>
      </div>`).join('');
    teamsList.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click',()=>{
        const id=b.dataset.id; const act=b.dataset.act; const t=teamById(id);
        if(act==='del'){
          if(confirm('Supprimer cette équipe ?')){
            state.teams=state.teams.filter(x=>x.id!==id);
            state.matches=state.matches.filter(m=>m.a!==id&&m.b!==id);
            if(state.playersByTeam){ delete state.playersByTeam[id]; }
            save(); renderTeams(); fillTeamSelects(); renderStandings(); renderLive(); renderKO(); renderFinished();
          }
        }else if(act==='edit'&&t){
          teamForm.name.value=t.name;
          teamForm.color.value=t.color;
          teamForm.logoUrl.value=t.logo;
          teamForm.editId.value=t.id;
          window.scrollTo({top:0,behavior:'smooth'})
        }
      })
    });
    updateStorageNote()
  }

  const matchForm=document.getElementById('matchForm');
  const matchesList=document.getElementById('matchesList');

  function fillTeamSelects(){
    const opts=['<option value="" disabled selected>— choisir —</option>']
      .concat(state.teams.map(t=>`<option value="${t.id}">${escapeHtml(t.name)}</option>`)).join('');
    matchForm.teamA.innerHTML=opts; matchForm.teamB.innerHTML=opts;
  }

  matchForm.addEventListener('submit',e=>{
    e.preventDefault();
    const data=Object.fromEntries(new FormData(matchForm).entries());
    if(!data.teamA||!data.teamB||data.teamA===data.teamB){alert('Choisis deux équipes différentes');return}
    const dur=Number(data.duration||0)?Number(data.duration)*60:state.settings.defaultDuration;
    const m={id:uid(),a:data.teamA,b:data.teamB,ga:null,gb:null,matchday:Number(data.matchday||1),start:data.start||'',status:'upcoming',duration:dur,seconds:dur,stage:'league'};
    state.matches.push(m);
    save(); matchForm.reset();
    renderMatches(); renderLive(); renderFinished();
  });

  function renderMatches(){
    matchesList.innerHTML=state.matches.filter(m=>m.stage==='league').map(m=>{
      const A=teamById(m.a),B=teamById(m.b);
      return `<div class="item">
        ${logoTag(A,32)} <strong>${escapeHtml(A?.short||A?.name||'A')}</strong>
        <span class="sub">vs</span>
        ${logoTag(B,32)} <strong>${escapeHtml(B?.short||B?.name||'B')}</strong>
        <span class="sub">• Journée ${m.matchday}</span>
        <div class="right">
          <button class="mini" data-id="${m.id}" data-act="live">Live</button>
          <button class="mini" data-id="${m.id}" data-act="final">Match terminé</button>
          <button class="mini" data-id="${m.id}" data-act="del">🗑</button>
        </div>
      </div>`
    }).join('');
    matchesList.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click',()=>{
        if(state.league.publicMode)return;
        const m=state.matches.find(x=>x.id===b.dataset.id);
        if(!m)return;
        if(b.dataset.act==='del'){
          if(confirm('Supprimer ce match ?')){
            state.matches=state.matches.filter(x=>x.id!==m.id);
            save(); renderMatches(); renderLive(); renderStandings(); renderFinished();
          }
        }
        if(b.dataset.act==='live'){ m.status='live'; m.lastTick=null; save(); renderLive() }
        if(b.dataset.act==='final'){
          m.status='final'; m.lastTick=null;
          if(m.stage==='KO'){ updateKOProgression(); }
          save(); renderLive(); renderStandings(); renderFinished();
        }
      })
    })
  }

  
  /* ---------- Players (V6 from V4.7) ---------- */

  // Players manager using state.players (id, name, team) - limit 6 per team
  if(!Array.isArray(state.players)) state.players = [];
  function teamById(id){ return (state.teams||[]).find(t=>t.id===id) || null; }
  function renderPlayers(){
    const list=document.getElementById('playersList');
    if(!list) return;
    list.innerHTML=(state.players||[]).map(p=>{
      const t=teamById(p.team);
      const tName=t? escapeHtml(t.name) : '';
      return `<div class="item">
        ${ t ? logoTag(t,24) : '' }
        <div><strong>${escapeHtml(p.name)}</strong><div class="sub">${tName}</div></div>
        <div class="right">
          <button class="mini" data-id="${p.id}" data-act="edit">✎</button>
          <button class="mini" data-id="${p.id}" data-act="del">🗑</button>
        </div>
      </div>`;
    }).join('');
    list.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click',()=>{
        const id=b.dataset.id, act=b.dataset.act;
        const p=(state.players||[]).find(x=>x.id===id);
        const form=document.getElementById('playerForm');
        if(act==='del' && p){
          if(confirm('Supprimer ce joueur ?')){
            state.players=(state.players||[]).filter(x=>x.id!==id);
            save(); try{ savePlayersOnly(); }catch(_){}; renderPlayers(); renderRosters();
          }
        }else if(act==='edit' && p && form){
          form.playerName.value=p.name||'';
          form.playerTeam.value=p.team||'';
          form.editId.value=p.id;
        }
      });
    });
  }
  function refreshPlayerTeams(){
    const form=document.getElementById('playerForm');
    if(!form) return;
    const sel=form.playerTeam;
    if(!sel) return;
    sel.innerHTML=(state.teams||[]).map(t=>`<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  }
  (function initPlayers(){
    const form=document.getElementById('playerForm');
    if(!form) return;
    refreshPlayerTeams();
    renderPlayers();
    document.getElementById('resetPlayerForm')?.addEventListener('click',()=>{ form.reset(); refreshPlayerTeams(); });
    form.addEventListener('submit',(e)=>{
      e.preventDefault();
      const name=(form.playerName.value||'').trim();
      const team=form.playerTeam.value;
      if(!name||!team){ return; }
      const perTeam=(state.players||[]).filter(p=>p.team===team).length;
      if(perTeam>=6){
        alert('Max 6 joueurs par équipe.');
        return;
      }
      const id=form.editId.value||('P'+Math.random().toString(36).slice(2,9));
      const ex=(state.players||[]).find(x=>x.id===id);
      if(ex){ ex.name=name; ex.team=team; }
      else{
        if(!state.players) state.players=[];
        state.players.push({id, name, team});
      }
      save(); try{ savePlayersOnly(); }catch(_){}; form.reset(); refreshPlayerTeams(); renderPlayers(); renderRosters();
    });
  })();
/* ---------- Effectifs (V19) ---------- */
  const rosterList = document.getElementById('rosterList');
  function renderRosters(){
    if(!rosterList) return;
    const items = (state.teams||[]).map(t=>{
      const arr = (state.players||[]).filter(p=>p.team===t.id).map(p=>p.name);
      const clean = arr.map(n=>(n||'').trim()).filter(Boolean);
      const list = (clean.length>0 ? clean.map((n,i)=>`${i+1}. ${escapeHtml(n)}`).join(' • ') : '— aucun joueur —');
      return `<div class="team">${logoTag(t,32)}<div><div class="name">${escapeHtml(t.name)}</div><div class="players">${list}</div></div></div>`;
    }).join('');
    rosterList.innerHTML = items || '<div class="sub">Aucune équipe.</div>';
  }
  // Update rosters whenever teams dropdowns are refilled (hook already overridden in V18)
  const _fillPlayersTeamSelect_and_more = fillTeamSelects;
  fillTeamSelects = function(){
    _fillPlayersTeamSelect_and_more();
    renderRosters();
  };
  // Initial render
  renderRosters();
/* ---------- Rules & League form ---------- */
  const ptsWin=document.getElementById('ptsWin');
  const bonusEnabledSel=document.getElementById('bonusEnabled');
  const ptsDraw=document.getElementById('ptsDraw');
  const ptsLoss=document.getElementById('ptsLoss');
  const boPoints=document.getElementById('boPoints');
  const boMargin=document.getElementById('boMargin');
  const bdPoints=document.getElementById('bdPoints');
  const bdMargin=document.getElementById('bdMargin');
  const defaultDuration=document.getElementById('defaultDuration');
  const leagueForm=document.getElementById('leagueForm');
  const publicBadge=document.getElementById('publicBadge');
  const themePresetSel=document.getElementById('themePreset');

  leagueForm.addEventListener('submit',e=>{
    e.preventDefault();
    const data=Object.fromEntries(new FormData(leagueForm).entries());
    state.league.name=data.leagueName||'Ma Ligue';
    state.league.logo=data.leagueLogoUrl||'';
    state.league.publicMode=data.publicMode==='1';
    state.settings.theme.preset=data.themePreset||'europa';
    state.settings.theme.accent=data.accentColor||state.settings.theme.accent;
    state.settings.theme.bg1=data.bg1||state.settings.theme.bg1;
    state.settings.theme.bg2=data.bg2||state.settings.theme.bg2;
    save(); syncRulesUI(); applyTheme(); renderStandings(); renderLive(); renderKO(); renderFinished(); applyPublicMode();
  });
// Reset all local data to defaults
  document.getElementById('resetData').addEventListener('click',()=>{
    if(!confirm('Réinitialiser toutes les données locales (équipes, matchs, paramètres) ?')) return;
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
    // Minimal default state
    state={
      league:{name:'Ma Ligue',logo:'',publicMode:false},
      teams:[{id:uid(),name:'LHV',short:'LHV',color:'#202c40',logo:''},{id:uid(),name:'NOC',short:'NOC',color:'#402020',logo:''}],
      matches:[],
      settings:{points:{win:3,draw:1,loss:0},bonus:{boPoints:1,boMargin:3,bdPoints:1,bdMargin:1,enabled:true},defaultDuration:15*60,theme:{preset:'europa',accent:'#ff5f00',bg1:'#0b0c10',bg2:'#151824'},},
      ui:{finishedDay:'0'}
    };
    save();
    bootstrap();
    toast('Données réinitialisées.');
  });
document.getElementById('applyPalette').addEventListener('click',()=>{
    const preset = document.getElementById('themePreset').value;
    const sets = {
      europa: {accent:'#ff5f00', bg1:'#0b0c10', bg2:'#151824'},
      ucl: {accent:'#00a3ff', bg1:'#070b14', bg2:'#0e1422'},
      custom: {accent:'#ff5f00', bg1:'#0b0c10', bg2:'#151824'}
    }[preset];
    leagueForm.accentColor.value = sets.accent;
    leagueForm.bg1.value = sets.bg1;
    leagueForm.bg2.value = sets.bg2;
    // preview (no save)
    state.settings.theme = {preset, accent:sets.accent, bg1:sets.bg1, bg2:sets.bg2};
    applyTheme();
  });

  function syncRulesUI(){
    ptsWin.value=state.settings.points.win;
    ptsDraw.value=state.settings.points.draw;
    ptsLoss.value=state.settings.points.loss;
    boPoints.value=state.settings.bonus.boPoints;
    boMargin.value=state.settings.bonus.boMargin;
    bdPoints.value=state.settings.bonus.bdPoints;
    bdMargin.value=state.settings.bonus.bdMargin;
    if(bonusEnabledSel) bonusEnabledSel.value = state.settings.bonus.enabled ? '1':'0';
    defaultDuration.value=Math.round((state.settings.defaultDuration||900)/60);

    leagueForm.leagueName.value=state.league.name||'';
    leagueForm.leagueLogoUrl.value=state.league.logo||'';
    leagueForm.publicMode.value=state.league.publicMode?'1':'0';

    themePresetSel.value=state.settings.theme.preset||'europa';
    leagueForm.accentColor.value=state.settings.theme.accent||'#ff5f00';
    leagueForm.bg1.value=state.settings.theme.bg1||'#0b0c10';
    leagueForm.bg2.value=state.settings.theme.bg2||'#151824';
    document.getElementById('durationInput').placeholder=defaultDuration.value;
    publicBadge.classList.toggle('hide',!state.league.publicMode);
    updateStorageNote()
  }

  document.getElementById('saveRules').addEventListener('click',()=>{
    state.settings.points={win:Number(ptsWin.value||3),draw:Number(ptsDraw.value||1),loss:Number(ptsLoss.value||0)};
    state.settings.bonus={boPoints:Number(boPoints.value||1),boMargin:Number(boMargin.value||3),bdPoints:Number(bdPoints.value||1),bdMargin:Number(bdMargin.value||1),enabled:(bonusEnabledSel? bonusEnabledSel.value==='1' : true)};
    state.settings.defaultDuration=Math.max(60,Number(defaultDuration.value||15)*60);
    save(); renderStandings()
  });

  /* ---------- Export / Import ---------- */
  const exportBtn=document.getElementById('exportBtn');
  const importFile=document.getElementById('importFile');
  exportBtn.addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='tournoi.json';
    a.click()
  });
  importFile.addEventListener('change',e=>{
    const f=e.target.files?.[0]; if(!f)return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{ state=JSON.parse(reader.result); save(); bootstrap(); alert('Import OK') }
      catch(err){ alert('JSON invalide') }
    };
    reader.readAsText(f)
  });


  /* --- Enforce tab order at runtime --- */
  (function reorderTabs(){
    const container = document.querySelector('header .tabs');
    if(!container) return;
    const desired = ['standings','knockout','live','finished','admin'];
    const btns = Array.from(container.querySelectorAll('button.tab'));
    const map = Object.fromEntries(btns.map(b => [b.dataset.tab, b]));
    desired.forEach(id => {
      if(map[id]) container.insertBefore(map[id], container.querySelector('.grow'));
    });
  })();

  /* ---------- Tabs ---------- */
  const tabBtns=document.querySelectorAll('.tab');
  function showTab(name){
    document.getElementById('tab-standings').classList.toggle('hide',name!=='standings');
    document.getElementById('tab-live').classList.toggle('hide',name!=='live');
    document.getElementById('tab-finished').classList.toggle('hide',name!=='finished');
    document.getElementById('tab-knockout').classList.toggle('hide',name!=='knockout');
    document.getElementById('tab-admin').classList.toggle('hide',name!=='admin');
    tabBtns.forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===name)))
  }
  for(const b of tabBtns){ b.addEventListener('click',()=>showTab(b.dataset.tab)) }

  /* ---------- Scheduler ---------- */
  function generateRoundRobin(homeAway=false){
    const teams=[...state.teams.map(t=>t.id)];
    if(teams.length<2){alert('Ajoute au moins 2 équipes (Gestion → Équipes).');return}
    state.matches=state.matches.filter(m=>m.stage!=='league');

    const even=teams.length%2===0;
    if(!even)teams.push(null);
    const n=teams.length;
    const rounds=n-1;
    const half=n/2;
    let arr=teams.slice();
    for(let r=0;r<rounds;r++){
      for(let i=0;i<half;i++){
        const a=arr[i],b=arr[n-1-i];
        if(a!=null&&b!=null){
          const dur=state.settings.defaultDuration;
          state.matches.push({id:uid(),a,b,ga:null,gb:null,matchday:r+1,start:'',status:'upcoming',seconds:dur,duration:dur,stage:'league'})
        }
      }
      arr.splice(1,0,arr.pop())
    }
    if(homeAway){
      const extra=state.matches.filter(m=>m.stage==='league').map(m=>{
        const dur=state.settings.defaultDuration;
        return {id:uid(),a:m.b,b:m.a,ga:null,gb:null,matchday:m.matchday+rounds,start:'',status:'upcoming',seconds:dur,duration:dur,stage:'league'}
      });
      state.matches=state.matches.concat(extra)
    }
    save(); renderMatches(); renderLive(); renderFinished(); toast('Matchs générés ✔');
  }
  document.getElementById('genRR').addEventListener('click',()=>{
    const ha=document.getElementById('homeAway').checked; generateRoundRobin(ha)
  });

  function applyPublicMode(){
    const isPublic=!!state.league.publicMode;
    document.querySelector('[data-tab="admin"]').classList.toggle('hide',isPublic);
    document.querySelectorAll('#tab-admin input, #tab-admin select, #tab-admin button').forEach(el=>{el.disabled=isPublic});
    publicBadge.classList.toggle('hide',!isPublic)
  }

  function bootstrap(){
    if(state.teams.length===0){
      state.teams=[
        {id:uid(),name:'LHV',short:'LHV',color:'#202c40',logo:''},
        {id:uid(),name:'NOC',short:'NOC',color:'#402020',logo:''}
      ]
    }
    syncRulesUI();
    applyTheme();
    fillTeamSelects();
    renderTeams();
    renderMatches();
    renderStandings();
    renderLive();
    renderKO();
    renderFinished();
    applyPublicMode();
  }
  bootstrap();


;


// Safe UI masking: hide unwanted controls without breaking JS that references them
(function(){
  const onReady = (fn)=> (document.readyState!=='loading') ? fn() : document.addEventListener('DOMContentLoaded', fn);
  onReady(()=>{
    try{
      // Hide Theme selector block
      const themeSel = document.getElementById('themePreset');
      if(themeSel){ const box = themeSel.closest('div'); if(box){ box.style.display='none'; } }
      // Hide "Appliquer palette du thème" block
      const ap = document.getElementById('applyPalette');
      if(ap){ const box2 = ap.closest('div'); if(box2){ box2.style.display='none'; } }
      // Hide manual matches form (Equipe A/B/Journée/Durée)
      const mf = document.getElementById('matchForm');
      if(mf){ mf.style.display='none'; }
      // Hide manual matches list (si présent)
      const ml = document.getElementById('matchesList');
      if(ml){ ml.style.display='none'; }
    }catch(e){
      console.error('UI mask error:', e);
    }
  });
})();


;


(function(){
  const PIN = "08032020";
  let isAdmin = false; // reset each load

  function txt(el){ return (el.textContent || el.innerText || "").trim().toLowerCase(); }
  function qsa(root, sel){ return Array.from((root||document).querySelectorAll(sel)); }

  function findSectionByTitles(titles){
    const headingSel = 'h1,h2,h3,h4,h5,h6,[data-title]';
    const heads = qsa(document, headingSel).filter(h => titles.some(t => txt(h).includes(t)));
    return heads.map(h => h.closest('section, .section, .card, .panel, .block, .box') || h.parentElement || h);
  }
  function setSectionInputsEnabled(section, enabled){
    qsa(section, 'input, select, textarea, button').forEach(el => {
      if (el.closest('nav,[role=\"tablist\"],.tabs,.tabbar,.navbar,.navigation')) return;
      el.disabled = !enabled;
      if(!enabled){ el.setAttribute('aria-disabled','true'); } else { el.removeAttribute('aria-disabled'); }
    });
    qsa(section, '[contenteditable=\"true\"]').forEach(el => el.setAttribute('contenteditable', enabled ? 'true' : 'false'));
  }
  function hideButtonsByText(textList){
    const set = new Set(textList.map(t => t.toLowerCase()));
    qsa(document, 'button, [role=\"button\"], a.btn, .btn, label').forEach(el => {
      const t = txt(el);
      if(set.has(t) || Array.from(set).some(s => t.includes(s))){
        el.classList.add('disable-when-public');
      }
    });
  }

  // --- Gestion locked placeholder helpers ---
  function ensureLockedPlaceholder(sec){
    if(!sec) return;
    if(!sec.querySelector('.locked-placeholder')){
      const ph = document.createElement('div');
      ph.className = 'locked-placeholder';
      ph.textContent = 'Zone administration verrouillée (PIN requis).';
      sec.prepend(ph);
    }
    sec.classList.add('gestion-locked');
  }
  function removeLockedPlaceholder(sec){
    if(!sec) return;
    sec.classList.remove('gestion-locked');
    const ph = sec.querySelector('.locked-placeholder');
    if(ph) ph.remove();
  }

  // Gestion tab gating
  function setupGestionGate(){
    const navCandidates = qsa(document, 'nav a, nav button, .tabs a, .tabs button, a, button')
      .filter(el => /gestion/i.test(el.textContent || el.innerText || ''));

    navCandidates.forEach(el => {
      if(el.dataset.gateBound === '1') return; // avoid double binding
      el.dataset.gateBound = '1';

      el.addEventListener('click', function(e){
        if(isAdmin) return; // allow normal navigation in admin
        // Intercept click once; do not let other handlers re-fire a prompt
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Always show masked Gestion section in Public (blank page)
        const gestionSecs = findSectionByTitles(['gestion']);
        gestionSecs.forEach(ensureLockedPlaceholder);

        const p = window.prompt('Entrer le PIN admin :');
        if(p === null || p === undefined || p === ''){
          // Cancelled: stay in Public with placeholder (no controls visible)
          // If this tab uses hash navigation, try to navigate to it so user sees the blank page
          const href = (el.getAttribute('href')||'').trim();
          if(href && href.startsWith('#')){ location.hash = href; }
          return;
        }
        if(p === PIN){
          isAdmin = true;
          enterAdmin();
          // Navigate to Gestion now that we're admin, without re-triggering click
          const href = (el.getAttribute('href')||'').trim();
          if(href && href.startsWith('#')){ location.hash = href; }
          return;
        }else{
          alert('PIN incorrect.');
          const href = (el.getAttribute('href')||'').trim();
          if(href && href.startsWith('#')){ location.hash = href; } // still show the blank page
          return;
        }
      }, {capture:true});
    });
  }

  // Public/Admin modes
  function enterPublic(){
    isAdmin = false;
    document.documentElement.classList.add('readonly');

    // Disable all form controls except navigation
    qsa(document, 'input, select, textarea, button').forEach(el => {
      if (el.closest('nav,[role=\"tablist\"],.tabs,.tabbar,.navbar,.navigation')) return;
      el.disabled = true; el.setAttribute('aria-disabled','true');
    });
    qsa(document, '[contenteditable=\"true\"]').forEach(el => el.setAttribute('contenteditable','false'));
    // Re-enable sub-onglet pills (navigation) such as "Toutes", "J1", "J2", "J3", etc.
    (function reEnableSubTabs(){
      const looksLikeSubTab = (el)=>{
        const t = (el.textContent || '').trim().toLowerCase();
        if(!t) return false;
        if(t === 'toutes' || t === 'tout' || t === 'tous') return true;
        if(/^j\s*\d+$/i.test(t)) return true;              // J1, J 2, etc.
        if(/^journ[eé]e\s*\d+$/i.test(t)) return true;     // Journée 1
        return false;
      };
      const candidates = Array.from(document.querySelectorAll('a,button,label,[role="tab"]'));
      candidates.forEach(el => {
        if(looksLikeSubTab(el)){
          el.disabled = false;
          el.removeAttribute('aria-disabled');
          el.style.pointerEvents = ''; // ensure clickable
        }
      });
    })();


    // Section behaviors
    
    // In 'Match en direct', hide ALL control buttons (icons/text) in Public
    findSectionByTitles(['match en direct']).forEach(function(sec){
      const controls = sec.querySelectorAll('button, [role="button"], .btn, label, a');
      controls.forEach(function(el){
        // keep time filter pills or nav if any (heuristic: if inside nav/tabbar, skip)
        if (el.closest('nav,[role="tablist"],.tabs,.tabbar,.navbar,.navigation')) return;
        el.classList.add('disable-when-public');
      });
    
    // Extra guard: locate 'EN DIRECT' badges/cards and hide nearby control buttons (icons included)
    (function hideLiveCardControls(){
      const isCtrlLike = (el)=>{
        const raw = (el.textContent || '').replace(/\u00A0/g,' ').trim().toLowerCase();
        const aria = (el.getAttribute('aria-label')||'').toLowerCase();
        const title = (el.getAttribute('title')||'').toLowerCase();
        const hasSVG = !!el.querySelector('svg, use');
        const shortSym = /^([\-–—\+]|play|pause|restart|start|stop|reprise|match terminé|match termine)$/i.test(raw);
        const metaSym  = ['play','pause','restart','start','stop','reprise','moins','minus','plus','match terminé','match termine']
                          .some(k => aria.includes(k) || title.includes(k) || raw.includes(k));
        // Heuristic: very short text + an icon is likely a control
        const veryShort = raw.length <= 2;
        return (hasSVG && (veryShort || metaSym)) || shortSym || metaSym;
      };

      const badgeCandidates = Array.from(document.querySelectorAll('*')).filter(el => {
        const t = (el.textContent || '').trim().toLowerCase();
        return t === 'en direct' || t.includes('en direct');
      });

      badgeCandidates.forEach(badge => {
        // find a reasonable container (card/panel/section/article or climb a few divs)
        let container = badge.closest('article, section, .card, .panel, .block, .box');
        if(!container){
          // climb up to 4 parents to capture the scoreboard card
          let p = badge;
          for(let i=0;i<4 && p && p.parentElement;i++){
            p = p.parentElement;
            if(p && p.querySelector && p.querySelector('button, [role="button"], .btn, a')){ container = p; break; }
          }
        }
        if(!container) return;

        // Within this container, hide all control-like buttons (excluding nav/tabs)
        const controls = container.querySelectorAll('button, [role="button"], .btn, a, label, div[role="button"]');
        controls.forEach(el => {
          if (el.closest('nav,[role="tablist"],.tabs,.tabbar,.navbar,.navigation')) return;
          if(isCtrlLike(el)){
            el.classList.add('disable-when-public');
          }
        });
      });
    })();
});
findSectionByTitles(['classement']).forEach(sec => setSectionInputsEnabled(sec,false));
    findSectionByTitles(['phase finale']).forEach(sec => setSectionInputsEnabled(sec,false));
    hideButtonsByText(['play','pause','restart','match terminé','-','+a','+b','+ a','+ b']);
    hideButtonsByText(['annuler le résultat','annuler résultat']);

    
    // Hide any "-" style decrement buttons across the page (initial pass)
    (function hideMinusEverywhere(){
      const candidates = Array.from(document.querySelectorAll('button,[role="button"],.btn,label,a,div'));
      candidates.forEach(el => {
        const raw = (el.textContent || '').replace(/\u00A0/g,' ').trim();
        const aria = (el.getAttribute('aria-label')||'').toLowerCase();
        const title = (el.getAttribute('title')||'').toLowerCase();
        const onlyMinus = /^(-|\u2212|\u2013)$/.test(raw);
        const looksMinus = onlyMinus || aria.includes('moins') || aria.includes('minus') || title.includes('moins') || title.includes('minus');
        if(looksMinus){
          el.classList.add('disable-when-public');
        }
      });
    })();

    // Observe DOM changes to keep minus buttons hidden if UI updates dynamically
    (function observeForMinus(){
      const hideIfMinus = (node)=>{
        if(!(node instanceof Element)) return;
        const candidates = node.matches('button,[role="button"],.btn,label,a,div') ? [node] : Array.from(node.querySelectorAll('button,[role="button"],.btn,label,a,div'));
        candidates.forEach(el => {
          const raw = (el.textContent || '').replace(/\u00A0/g,' ').trim();
          const aria = (el.getAttribute('aria-label')||'').toLowerCase();
          const title = (el.getAttribute('title')||'').toLowerCase();
          const onlyMinus = /^(-|\u2212|\u2013)$/.test(raw);
          const looksMinus = onlyMinus || aria.includes('moins') || aria.includes('minus') || title.includes('moins') || title.includes('minus');
          if(looksMinus){
            el.classList.add('disable-when-public');
          }
        });
      };
      const obs = new MutationObserver((mut)=>{
        mut.forEach(m=>{
          m.addedNodes && m.addedNodes.forEach(hideIfMinus);
          if(m.type==='characterData' && m.target && m.target.parentElement) hideIfMinus(m.target.parentElement);
        });
      });
      obs.observe(document.body, {subtree:true, childList:true, characterData:true});
    })();
// Gestion: keep accessible but masked by default
    findSectionByTitles(['gestion']).forEach(sec => ensureLockedPlaceholder(sec));

    
  // Brute-force: hide any icon-only clickable (SVG + short/empty text) across the page
  ;(function hideIconOnlyClickables(){
    const candSel = 'button,[role="button"],.btn,div[role="button"],a,label,div.btn';
    const cands = Array.from(document.querySelectorAll(candSel));
    cands.forEach(el => {
      if (el.closest('nav,[role="tablist"],.tabs,.tabbar,.navbar,.navigation')) return;
      const hasSvg = !!el.querySelector('svg, use, path, polygon');
      const txt = (el.textContent||'').replace(/\s+/g,' ').trim();
      const short = txt.length <= 2;
      const aria = (el.getAttribute('aria-label')||'').toLowerCase();
      const title = (el.getAttribute('title')||'').toLowerCase();
      const isCtrlWord = /(play|pause|start|stop|restart|replay|resume|reprendre|relancer|reset|moins|minus|plus)/i.test(aria+' '+title+' '+txt);
      if(hasSvg && (short || isCtrlWord)){
        el.classList.add('disable-when-public');
      }
    });
  })();

  // Extra: around any time (MM:SS) element, also hide clickable siblings (common for live control rows)
  ;(function hideNearTimer(){
    const timeNodes = Array.from(document.querySelectorAll('*')).filter(n => /\b\d{1,2}:\d{2}\b/.test((n.textContent||'')));
    timeNodes.forEach(n => {
      let container = n.parentElement;
      for(let i=0;i<3 && container && container.parentElement;i++){
        const row = container.querySelectorAll && container.querySelectorAll('button,[role="button"],.btn,div[role="button"],a,label');
        if(row && row.length>=2){
          row.forEach(el => {
            if (el.closest('nav,[role="tablist"],.tabs,.tabbar,.navbar,.navigation')) return;
            el.classList.add('disable-when-public');
          });
          break;
        }
        container = container.parentElement;
      }
    });
  })();

  
  // Hide IDs inside "Match en direct" sections in Public
  ;(function hideIdsInLive(){
    const sections = (function findSectionByTitles(titles){
      const qsa = (sel)=>Array.from(document.querySelectorAll(sel));
      const txt = (el)=> (el.textContent||el.innerText||"").trim().toLowerCase();
      const heads = qsa('h1,h2,h3,h4,h5,h6,[data-title]').filter(h => titles.some(t => txt(h).includes(t)));
      return heads.map(h => h.closest('section, .section, .card, .panel, .block, .box') || h.parentElement || h);
    })(['match en direct','en direct']);
    const looksLikeIdText = (s)=>{
      const t = (s||'').trim();
      if(!t) return false;
      // direct labels: "ID", "ID: 1234", "Match ID: ..."
      if(/^id\b[\s:#-]*\w+/i.test(t)) return true;
      if(/\b(match|game|partie)\s*id\b[\s:#-]*\w+/i.test(t)) return true;
      if(/\bid[:#]\s*\w+/i.test(t)) return true;
      // bare UUID-like or very specific numeric id (long number) - risky, skip
      return false;
    };
    sections.forEach(sec => {
      if(!sec) return;
      const candidates = sec.querySelectorAll('*');
      candidates.forEach(el => {
        const aria = ((el.getAttribute('aria-label')||'') + ' ' + (el.getAttribute('title')||'')).toLowerCase();
        const hasIdAttr = el.hasAttribute('data-id') || el.hasAttribute('data-match-id') || el.hasAttribute('data-game-id') || /(^|\\s)(id|match-id|game-id)(\\s|$)/i.test(el.className||'');
        const texty = (el.textContent||'').trim();
        if (hasIdAttr || looksLikeIdText(texty) || /\bid\b/.test(aria)){
          el.classList.add('disable-when-public');
        }
      });
    });
  })();

  
  // Whitelist: enable ONLY sub-onglet filters inside "Matchs terminés" (Public mode)
  ;(function enableFinishedMatchesFilters(){
    // locate "Matchs terminés" section
    const qsa=(sel)=>Array.from(document.querySelectorAll(sel));
    const txt=(el)=> (el.textContent||el.innerText||"").trim().toLowerCase();
    const heads = qsa('h1,h2,h3,h4,h5,h6,[data-title]').filter(h => /matchs?\s+termin[eé]s/i.test(txt(h)));
    const sections = heads.map(h => h.closest('section, .section, .card, .panel, .block, .box') || h.parentElement || h);
    const looksLikeFilter = (el)=>{
      const t = txt(el);
      if(!t) return false;
      if (['toutes','tout','tous','barrage','demi-finale','demi finale','finale'].includes(t)) return true;
      if (/^j\s*\d+$/i.test(t)) return true;                 // J1, J 2...
      if (/^journ[eé]e\s*\d+$/i.test(t)) return true;        // Journée 6
      return false;
    };
    sections.forEach(sec => {
      if(!sec) return;
      const candidates = sec.querySelectorAll('a,button,label,[role="tab"]');
      candidates.forEach(el => {
        if (looksLikeFilter(el)){
          // re-enable & ensure visible even if previously hidden
          el.disabled = false;
          el.removeAttribute('aria-disabled');
          el.style.pointerEvents = '';
          el.classList.remove('disable-when-public');
        }
      });
    });
  })();

  setupGestionGate();
  }

  function enterAdmin(){
    document.documentElement.classList.remove('readonly');
    // Reveal Gestion content
    findSectionByTitles(['gestion']).forEach(sec => removeLockedPlaceholder(sec));
    // Show previously hidden controls
    qsa(document, '.disable-when-public').forEach(el => el.classList.remove('disable-when-public'));
    // Re-enable form controls
    qsa(document, 'input, select, textarea, button').forEach(el => {
      el.disabled = false; el.removeAttribute('aria-disabled');
    });
    qsa(document, '[contenteditable]').forEach(el => el.setAttribute('contenteditable','true'));
  }

  document.addEventListener('DOMContentLoaded', function(){
    enterPublic(); // always start in Public
  });
})();


;


(function(){
  const PIN = "08032020";
  let isAdmin = false; // reset each load

  function txt(el){ return (el.textContent || el.innerText || "").trim().toLowerCase(); }
  function qsa(root, sel){ return Array.from((root||document).querySelectorAll(sel)); }

  function findSectionByTitles(titles){
    const headingSel = 'h1,h2,h3,h4,h5,h6,[data-title]';
    const heads = qsa(document, headingSel).filter(h => titles.some(t => txt(h).includes(t)));
    return heads.map(h => h.closest('section, .section, .card, .panel, .block, .box') || h.parentElement || h);
  }
  function setSectionInputsEnabled(section, enabled){
    qsa(section, 'input, select, textarea, button').forEach(el => {
      if (el.closest('nav,[role=\"tablist\"],.tabs,.tabbar,.navbar,.navigation')) return;
      el.disabled = !enabled;
      if(!enabled){ el.setAttribute('aria-disabled','true'); } else { el.removeAttribute('aria-disabled'); }
    });
    qsa(section, '[contenteditable=\"true\"]').forEach(el => el.setAttribute('contenteditable', enabled ? 'true' : 'false'));
  }
  function hideButtonsByText(textList){
    const set = new Set(textList.map(t => t.toLowerCase()));
    qsa(document, 'button, [role=\"button\"], a.btn, .btn, label').forEach(el => {
      const t = txt(el);
      if(set.has(t) || Array.from(set).some(s => t.includes(s))){
        el.classList.add('disable-when-public');
      }
    });
  }

  // --- Gestion locked placeholder helpers ---
  function ensureLockedPlaceholder(sec){
    if(!sec) return;
    if(!sec.querySelector('.locked-placeholder')){
      const ph = document.createElement('div');
      ph.className = 'locked-placeholder';
      ph.textContent = 'Zone administration verrouillée (PIN requis).';
      sec.prepend(ph);
    }
    sec.classList.add('gestion-locked');
  }
  function removeLockedPlaceholder(sec){
    if(!sec) return;
    sec.classList.remove('gestion-locked');
    const ph = sec.querySelector('.locked-placeholder');
    if(ph) ph.remove();
  }

  // Gestion tab gating
  function setupGestionGate(){
    const navCandidates = qsa(document, 'nav a, nav button, .tabs a, .tabs button, a, button')
      .filter(el => /gestion/i.test(el.textContent || el.innerText || ''));

    navCandidates.forEach(el => {
      if(el.dataset.gateBound === '1') return; // avoid double binding
      el.dataset.gateBound = '1';

      el.addEventListener('click', function(e){
        if(isAdmin) return; // allow normal navigation in admin
        // Intercept click once; do not let other handlers re-fire a prompt
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Always show masked Gestion section in Public (blank page)
        const gestionSecs = findSectionByTitles(['gestion']);
        gestionSecs.forEach(ensureLockedPlaceholder);

        const p = window.prompt('Entrer le PIN admin :');
        if(p === null || p === undefined || p === ''){
          // Cancelled: stay in Public with placeholder (no controls visible)
          // If this tab uses hash navigation, try to navigate to it so user sees the blank page
          const href = (el.getAttribute('href')||'').trim();
          if(href && href.startsWith('#')){ location.hash = href; }
          return;
        }
        if(p === PIN){
          isAdmin = true;
          enterAdmin();
          // Navigate to Gestion now that we're admin, without re-triggering click
          const href = (el.getAttribute('href')||'').trim();
          if(href && href.startsWith('#')){ location.hash = href; }
          return;
        }else{
          alert('PIN incorrect.');
          const href = (el.getAttribute('href')||'').trim();
          if(href && href.startsWith('#')){ location.hash = href; } // still show the blank page
          return;
        }
      }, {capture:true});
    });
  }

  // Public/Admin modes
  function enterPublic(){
    isAdmin = false;
    document.documentElement.classList.add('readonly');

    // Disable all form controls except navigation
    qsa(document, 'input, select, textarea, button').forEach(el => {
      if (el.closest('nav,[role=\"tablist\"],.tabs,.tabbar,.navbar,.navigation')) return;
      el.disabled = true; el.setAttribute('aria-disabled','true');
    });
    qsa(document, '[contenteditable=\"true\"]').forEach(el => el.setAttribute('contenteditable','false'));
    // Re-enable sub-onglet pills (navigation) such as "Toutes", "J1", "J2", "J3", etc.
    (function reEnableSubTabs(){
      const looksLikeSubTab = (el)=>{
        const t = (el.textContent || '').trim().toLowerCase();
        if(!t) return false;
        if(t === 'toutes' || t === 'tout' || t === 'tous') return true;
        if(/^j\s*\d+$/i.test(t)) return true;              // J1, J 2, etc.
        if(/^journ[eé]e\s*\d+$/i.test(t)) return true;     // Journée 1
        return false;
      };
      const candidates = Array.from(document.querySelectorAll('a,button,label,[role="tab"]'));
      candidates.forEach(el => {
        if(looksLikeSubTab(el)){
          el.disabled = false;
          el.removeAttribute('aria-disabled');
          el.style.pointerEvents = ''; // ensure clickable
        }
      });
    })();


    // Section behaviors
    
    // In 'Match en direct', hide ALL control buttons (icons/text) in Public
    findSectionByTitles(['match en direct']).forEach(function(sec){
      const controls = sec.querySelectorAll('button, [role="button"], .btn, label, a');
      controls.forEach(function(el){
        // keep time filter pills or nav if any (heuristic: if inside nav/tabbar, skip)
        if (el.closest('nav,[role="tablist"],.tabs,.tabbar,.navbar,.navigation')) return;
        el.classList.add('disable-when-public');
      });
    
    // Extra guard: locate 'EN DIRECT' badges/cards and hide nearby control buttons (icons included)
    (function hideLiveCardControls(){
      const isCtrlLike = (el)=>{
        const raw = (el.textContent || '').replace(/\u00A0/g,' ').trim().toLowerCase();
        const aria = (el.getAttribute('aria-label')||'').toLowerCase();
        const title = (el.getAttribute('title')||'').toLowerCase();
        const hasSVG = !!el.querySelector('svg, use');
        const shortSym = /^([\-–—\+]|play|pause|restart|start|stop|reprise|match terminé|match termine)$/i.test(raw);
        const metaSym  = ['play','pause','restart','start','stop','reprise','moins','minus','plus','match terminé','match termine']
                          .some(k => aria.includes(k) || title.includes(k) || raw.includes(k));
        // Heuristic: very short text + an icon is likely a control
        const veryShort = raw.length <= 2;
        return (hasSVG && (veryShort || metaSym)) || shortSym || metaSym;
      };

      const badgeCandidates = Array.from(document.querySelectorAll('*')).filter(el => {
        const t = (el.textContent || '').trim().toLowerCase();
        return t === 'en direct' || t.includes('en direct');
      });

      badgeCandidates.forEach(badge => {
        // find a reasonable container (card/panel/section/article or climb a few divs)
        let container = badge.closest('article, section, .card, .panel, .block, .box');
        if(!container){
          // climb up to 4 parents to capture the scoreboard card
          let p = badge;
          for(let i=0;i<4 && p && p.parentElement;i++){
            p = p.parentElement;
            if(p && p.querySelector && p.querySelector('button, [role="button"], .btn, a')){ container = p; break; }
          }
        }
        if(!container) return;

        // Within this container, hide all control-like buttons (excluding nav/tabs)
        const controls = container.querySelectorAll('button, [role="button"], .btn, a, label, div[role="button"]');
        controls.forEach(el => {
          if (el.closest('nav,[role="tablist"],.tabs,.tabbar,.navbar,.navigation')) return;
          if(isCtrlLike(el)){
            el.classList.add('disable-when-public');
          }
        });
      });
    })();
});
findSectionByTitles(['classement']).forEach(sec => setSectionInputsEnabled(sec,false));
    findSectionByTitles(['phase finale']).forEach(sec => setSectionInputsEnabled(sec,false));
    hideButtonsByText(['play','pause','restart','match terminé','-','+a','+b','+ a','+ b']);
    hideButtonsByText(['annuler le résultat','annuler résultat']);

    
    // Hide any "-" style decrement buttons across the page (initial pass)
    (function hideMinusEverywhere(){
      const candidates = Array.from(document.querySelectorAll('button,[role="button"],.btn,label,a,div'));
      candidates.forEach(el => {
        const raw = (el.textContent || '').replace(/\u00A0/g,' ').trim();
        const aria = (el.getAttribute('aria-label')||'').toLowerCase();
        const title = (el.getAttribute('title')||'').toLowerCase();
        const onlyMinus = /^(-|\u2212|\u2013)$/.test(raw);
        const looksMinus = onlyMinus || aria.includes('moins') || aria.includes('minus') || title.includes('moins') || title.includes('minus');
        if(looksMinus){
          el.classList.add('disable-when-public');
        }
      });
    })();

    // Observe DOM changes to keep minus buttons hidden if UI updates dynamically
    (function observeForMinus(){
      const hideIfMinus = (node)=>{
        if(!(node instanceof Element)) return;
        const candidates = node.matches('button,[role="button"],.btn,label,a,div') ? [node] : Array.from(node.querySelectorAll('button,[role="button"],.btn,label,a,div'));
        candidates.forEach(el => {
          const raw = (el.textContent || '').replace(/\u00A0/g,' ').trim();
          const aria = (el.getAttribute('aria-label')||'').toLowerCase();
          const title = (el.getAttribute('title')||'').toLowerCase();
          const onlyMinus = /^(-|\u2212|\u2013)$/.test(raw);
          const looksMinus = onlyMinus || aria.includes('moins') || aria.includes('minus') || title.includes('moins') || title.includes('minus');
          if(looksMinus){
            el.classList.add('disable-when-public');
          }
        });
      };
      const obs = new MutationObserver((mut)=>{
        mut.forEach(m=>{
          m.addedNodes && m.addedNodes.forEach(hideIfMinus);
          if(m.type==='characterData' && m.target && m.target.parentElement) hideIfMinus(m.target.parentElement);
        });
      });
      obs.observe(document.body, {subtree:true, childList:true, characterData:true});
    })();
// Gestion: keep accessible but masked by default
    findSectionByTitles(['gestion']).forEach(sec => ensureLockedPlaceholder(sec));

    
  // Brute-force: hide any icon-only clickable (SVG + short/empty text) across the page
  ;(function hideIconOnlyClickables(){
    const candSel = 'button,[role="button"],.btn,div[role="button"],a,label,div.btn';
    const cands = Array.from(document.querySelectorAll(candSel));
    cands.forEach(el => {
      if (el.closest('nav,[role="tablist"],.tabs,.tabbar,.navbar,.navigation')) return;
      const hasSvg = !!el.querySelector('svg, use, path, polygon');
      const txt = (el.textContent||'').replace(/\s+/g,' ').trim();
      const short = txt.length <= 2;
      const aria = (el.getAttribute('aria-label')||'').toLowerCase();
      const title = (el.getAttribute('title')||'').toLowerCase();
      const isCtrlWord = /(play|pause|start|stop|restart|replay|resume|reprendre|relancer|reset|moins|minus|plus)/i.test(aria+' '+title+' '+txt);
      if(hasSvg && (short || isCtrlWord)){
        el.classList.add('disable-when-public');
      }
    });
  })();

  // Extra: around any time (MM:SS) element, also hide clickable siblings (common for live control rows)
  ;(function hideNearTimer(){
    const timeNodes = Array.from(document.querySelectorAll('*')).filter(n => /\b\d{1,2}:\d{2}\b/.test((n.textContent||'')));
    timeNodes.forEach(n => {
      let container = n.parentElement;
      for(let i=0;i<3 && container && container.parentElement;i++){
        const row = container.querySelectorAll && container.querySelectorAll('button,[role="button"],.btn,div[role="button"],a,label');
        if(row && row.length>=2){
          row.forEach(el => {
            if (el.closest('nav,[role="tablist"],.tabs,.tabbar,.navbar,.navigation')) return;
            el.classList.add('disable-when-public');
          });
          break;
        }
        container = container.parentElement;
      }
    });
  })();

  
  // Hide IDs inside "Match en direct" sections in Public
  ;(function hideIdsInLive(){
    const sections = (function findSectionByTitles(titles){
      const qsa = (sel)=>Array.from(document.querySelectorAll(sel));
      const txt = (el)=> (el.textContent||el.innerText||"").trim().toLowerCase();
      const heads = qsa('h1,h2,h3,h4,h5,h6,[data-title]').filter(h => titles.some(t => txt(h).includes(t)));
      return heads.map(h => h.closest('section, .section, .card, .panel, .block, .box') || h.parentElement || h);
    })(['match en direct','en direct']);
    const looksLikeIdText = (s)=>{
      const t = (s||'').trim();
      if(!t) return false;
      // direct labels: "ID", "ID: 1234", "Match ID: ..."
      if(/^id\b[\s:#-]*\w+/i.test(t)) return true;
      if(/\b(match|game|partie)\s*id\b[\s:#-]*\w+/i.test(t)) return true;
      if(/\bid[:#]\s*\w+/i.test(t)) return true;
      // bare UUID-like or very specific numeric id (long number) - risky, skip
      return false;
    };
    sections.forEach(sec => {
      if(!sec) return;
      const candidates = sec.querySelectorAll('*');
      candidates.forEach(el => {
        const aria = ((el.getAttribute('aria-label')||'') + ' ' + (el.getAttribute('title')||'')).toLowerCase();
        const hasIdAttr = el.hasAttribute('data-id') || el.hasAttribute('data-match-id') || el.hasAttribute('data-game-id') || /(^|\\s)(id|match-id|game-id)(\\s|$)/i.test(el.className||'');
        const texty = (el.textContent||'').trim();
        if (hasIdAttr || looksLikeIdText(texty) || /\bid\b/.test(aria)){
          el.classList.add('disable-when-public');
        }
      });
    });
  })();

  
  // Whitelist: enable ONLY sub-onglet filters inside "Matchs terminés" (Public mode)
  ;(function enableFinishedMatchesFilters(){
    // locate "Matchs terminés" section
    const qsa=(sel)=>Array.from(document.querySelectorAll(sel));
    const txt=(el)=> (el.textContent||el.innerText||"").trim().toLowerCase();
    const heads = qsa('h1,h2,h3,h4,h5,h6,[data-title]').filter(h => /matchs?\s+termin[eé]s/i.test(txt(h)));
    const sections = heads.map(h => h.closest('section, .section, .card, .panel, .block, .box') || h.parentElement || h);
    const looksLikeFilter = (el)=>{
      const t = txt(el);
      if(!t) return false;
      if (['toutes','tout','tous','barrage','demi-finale','demi finale','finale'].includes(t)) return true;
      if (/^j\s*\d+$/i.test(t)) return true;                 // J1, J 2...
      if (/^journ[eé]e\s*\d+$/i.test(t)) return true;        // Journée 6
      return false;
    };
    sections.forEach(sec => {
      if(!sec) return;
      const candidates = sec.querySelectorAll('a,button,label,[role="tab"]');
      candidates.forEach(el => {
        if (looksLikeFilter(el)){
          // re-enable & ensure visible even if previously hidden
          el.disabled = false;
          el.removeAttribute('aria-disabled');
          el.style.pointerEvents = '';
          el.classList.remove('disable-when-public');
        }
      });
    });
  })();

  setupGestionGate();
  }

  function enterAdmin(){
    document.documentElement.classList.remove('readonly');
    // Reveal Gestion content
    findSectionByTitles(['gestion']).forEach(sec => removeLockedPlaceholder(sec));
    // Show previously hidden controls
    qsa(document, '.disable-when-public').forEach(el => el.classList.remove('disable-when-public'));
    // Re-enable form controls
    qsa(document, 'input, select, textarea, button').forEach(el => {
      el.disabled = false; el.removeAttribute('aria-disabled');
    });
    qsa(document, '[contenteditable]').forEach(el => el.setAttribute('contenteditable','true'));
  }

  document.addEventListener('DOMContentLoaded', function(){
    enterPublic(); // always start in Public
  });
})();


;


// --- Ultra-robust live controls hider (EN DIRECT / time / score heuristics) ---
document.addEventListener('DOMContentLoaded', function(){
  if(!document.documentElement.classList.contains('readonly')) return;
  (function liveControlsKiller(){
    const isLikelyControl = (el)=>{
      if(!(el instanceof Element)) return false;
      if (el.closest('nav,[role="tablist"],.tabs,.tabbar,.navbar,.navigation')) return false;
      const tag = el.tagName.toLowerCase();
      if(!/(button|a|label|div)/.test(tag)) return false;
      const role = (el.getAttribute('role')||'').toLowerCase();
      const clickable = tag==='button' || role==='button' || el.classList.contains('btn') || el.onclick || el.getAttribute('href');
      if(!clickable) return false;
      const txt = (el.textContent||'').replace(/\s+/g,' ').trim();
      const short = txt.length <= 2;
      const hasSvg = !!el.querySelector('svg, use, path, polygon');
      return hasSvg && short;
    };

    const isScoreLike = (node)=>/(\d+)\s*[\u2013\-]\s*(\d+)/.test((node.textContent||'').trim());
    const isTimeLike  = (node)=>/\b\d{1,2}:\d{2}\b/.test((node.textContent||''));
    const hasLiveTag  = (node)=>/en\s*direct/i.test((node.textContent||''));

    const findCard = (el)=>{
      let p = el;
      for(let i=0;i<8 && p && p.parentElement;i++){
        p = p.parentElement;
        if(!p) break;
        const buttons = p.querySelectorAll('button,[role="button"],.btn,a,label');
        const btnCount = buttons.length;
        const contentText = (p.textContent||'');
        if(btnCount>=3 && (isScoreLike(p) || isTimeLike(p) || /en\s*direct/i.test(contentText))){
          return p;
        }
      }
      return null;
    };

    const hideControlsInCard = (card)=>{
      if(!card) return;
      const ctrls = card.querySelectorAll('button,[role="button"],.btn,a,label,div[role="button"]');
      ctrls.forEach(el => { if(isLikelyControl(el)){ el.classList.add('disable-when-public'); } });
    };

    const seedNodes = Array.from(document.querySelectorAll('*')).filter(n => hasLiveTag(n) || isTimeLike(n) || isScoreLike(n));
    seedNodes.forEach(n => hideControlsInCard(findCard(n)));

    const obs = new MutationObserver(muts=>{
      muts.forEach(mu=>{
        (mu.addedNodes||[]).forEach(node=>{
          if(!(node instanceof Element)) return;
          if(hasLiveTag(node) || isTimeLike(node) || isScoreLike(node)){
            hideControlsInCard(findCard(node));
          }else{
            const list = node.querySelectorAll ? node.querySelectorAll('*') : [];
            for(const el of list){
              if(hasLiveTag(el) || isTimeLike(el) || isScoreLike(el)){
                hideControlsInCard(findCard(el)); break;
              }
            }
          }
        });
      });
    });
    obs.observe(document.body, {subtree:true, childList:true, characterData:true});
  })();
});


;


// Persist & robustly restore last visited tab (Public/Admin) with retries
(function(){
  const KEY = "skullball_last_tab_v2";

  const norm = (s)=> (s||"").toString().trim().toLowerCase().replace(/\s+/g,' ');

  function getTabIdFromEl(el){
    if(!el) return null;
    const href = el.getAttribute && el.getAttribute('href');
    if(href && href.startsWith('#')) return href;
    const ac = el.getAttribute && el.getAttribute('aria-controls');
    if(ac) return '#' + ac;
    const dt = el.getAttribute && (el.getAttribute('data-target') || el.getAttribute('data-bs-target'));
    if(dt) return dt;
    return null;
  }

  function collectTabs(){
    const sel = 'nav a, nav button, .tabs a, .tabs button, [role="tab"], a[data-target], button[data-target], a[data-bs-target], button[data-bs-target]';
    return Array.from(document.querySelectorAll(sel));
  }

  function currentModeIsPublic(){
    return document.documentElement.classList.contains('readonly');
  }

  function bindSavers(){
    collectTabs().forEach(el => {
      if(el.dataset.lastTabBound === '1') return;
      el.dataset.lastTabBound = '1';
      el.addEventListener('click', () => {
        const entry = {
          id: getTabIdFromEl(el),
          text: norm(el.textContent || el.innerText || '')
        };
        try{ localStorage.setItem(KEY, JSON.stringify(entry)); }catch(e){}
      }, {capture:true});
    });
  }

  function findTabBySaved(saved){
    if(!saved) return null;
    const tabs = collectTabs();
    // Prefer match by exact hash/id
    if(saved.id){
      const sel = `a[href="${saved.id}"], button[aria-controls="${saved.id.replace('#','')}"], [data-target="${saved.id}"], [data-bs-target="${saved.id}"]`;
      const byId = document.querySelector(sel);
      if(byId) return byId;
    }
    // Fallback: match by normalized text
    if(saved.text){
      const txt = saved.text;
      const byText = tabs.find(el => norm(el.textContent || el.innerText || '') === txt);
      if(byText) return byText;
    }
    return null;
  }

  function activateTabEl(el){
    if(!el) return false;
    // If trying to go to "Gestion" while in Public, skip to avoid PIN prompt on load
    const t = norm(el.textContent || el.innerText || '');
    if(currentModeIsPublic() && /gestion/.test(t)) return false;
    el.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
    // Also update hash if we can infer it
    const id = getTabIdFromEl(el);
    if(id && id.startsWith('#') && location.hash !== id){
      location.hash = id;
    }
    return true;
  }

  function tryRestoreSaved(){
    let saved = null;
    try{ saved = JSON.parse(localStorage.getItem(KEY) || 'null'); }catch(e){ saved = null; }
    if(!saved) return false;
    const el = findTabBySaved(saved);
    if(!el) return false;
    return activateTabEl(el);
  }

  function scheduleRetries(){
    // Retry a few times to beat frameworks that initialize tabs late
    const delays = [80, 200, 500, 1000];
    delays.forEach(d => setTimeout(() => { tryRestoreSaved(); }, d));
    // Observe DOM mutations for 2s and attempt restore on changes
    const t0 = Date.now();
    const obs = new MutationObserver(() => {
      if(Date.now() - t0 > 2000){ try{obs.disconnect();}catch(e){}; return; }
      tryRestoreSaved();
      bindSavers();
    });
    obs.observe(document.body, {subtree:true, childList:true});
  }

  document.addEventListener('DOMContentLoaded', function(){
    // If URL hash is explicit, respect it (don't override user intent)
    const urlHash = (location.hash || '').trim();
    if(!urlHash){
      tryRestoreSaved();
      scheduleRetries();
    }
    bindSavers();
    // Rebind on future DOM changes (tabs added later)
    const rebinder = new MutationObserver(() => bindSavers());
    rebinder.observe(document.body, {subtree:true, childList:true});
  });
})();


;


(function(){
  function norm(s){ return (s||'').toString().trim(); }
  function looksShortCode(s){
    s = norm(s);
    return /^[A-Z]{2,4}$/.test(s);
  }
  function betterCandidate(curr, cand){
    curr = norm(curr); cand = norm(cand);
    if(!cand) return false;
    if(cand.length < curr.length) return false;
    if(cand.length >= 6) return true;
    if(/\s/.test(cand)) return true;
    return false;
  }
  function extractCandidateFrom(el){
    if(!el) return null;
    const ds = el.dataset || {};
    const keys = ['full','fullname','name','long','team','clubName','clubname','teamName','teamname'];
    for(const k of keys){
      if(betterCandidate('', ds[k])) return ds[k];
    }
    const t = el.getAttribute && (el.getAttribute('title') || el.getAttribute('aria-label'));
    if(betterCandidate('', t)) return t;
    const row = el.closest('.match, .row, .line, .card, .panel, .box, li, div');
    if(row){
      const imgs = row.querySelectorAll('img[alt], img[title]');
      for(const im of imgs){
        const alt = im.getAttribute('alt') || '';
        const ttl = im.getAttribute('title') || '';
        if(betterCandidate('', alt)) return alt;
        if(betterCandidate('', ttl)) return ttl;
      }
      const parents = [row, row.parentElement, row.closest('[data-team],[data-name],[data-fullname]')].filter(Boolean);
      for(const p of parents){
        const d = p && p.dataset || {};
        for(const k of keys){
          if(betterCandidate('', d[k])) return d[k];
        }
        const tt = p && (p.getAttribute('title') || p.getAttribute('aria-label'));
        if(betterCandidate('', tt)) return tt;
      }
    }
    return null;
  }

  function expandPhaseFinale(){
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,[data-title]'))
      .filter(h => /phase\s*finale/i.test((h.textContent||'').trim()));
    headings.forEach(h => {
      const sec = h.closest('section, .section, .card, .panel, .block, .box') || h.parentElement;
      if(!sec) return;
      sec.classList.add('phase-finale-longnames');
      const nameNodes = Array.from(sec.querySelectorAll('.team-name, .team, [class*="name"], strong, b, span, div'))
        .filter(n => looksShortCode(n.textContent));
      nameNodes.forEach(n => {
        const curr = norm(n.textContent);
        const cand = extractCandidateFrom(n);
        if(betterCandidate(curr, cand)){
          n.textContent = cand;
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    expandPhaseFinale();
    setTimeout(expandPhaseFinale, 200);
  });
})();


;


// Public hider (V3.59): hide "Annuler le résultat" and any "ID ..." labels globally, incl. Phase finale
(function(){
  function isPublic(){ return document.documentElement.classList.contains('readonly'); }

  // Utility to test if element's visible text looks like an ID label
  function looksLikeIdLabel(txt){
    if(!txt) return false;
    const t = (txt || '').replace(/\s+/g,' ').trim();
    // Patterns: "ID xxxxx", "Id: abc123", "id z1slmwv"
    return /^(id|Id|ID)\s*[:#]?\s*[A-Za-z0-9_-]{4,}$/.test(t);
  }

  function hideInScope(root){
    if(!isPublic()) return;
    const scope = root || document;

    // 1) Buttons/links "Annuler le résultat"
    Array.from(scope.querySelectorAll('button,[role="button"],a,.btn,label')).forEach(el => {
      const t = (el.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
      if (t === 'annuler le résultat' || t === 'annuler le resultat') {
        el.classList.add('disable-when-public');
      }
    });

    // 2) Generic ID labels anywhere
    const candidates = scope.querySelectorAll('span,small,p,div,em,strong');
    candidates.forEach(el => {
      if (!(el instanceof Element)) return;
      if (el.closest('nav,[role="tablist"],.tabs,.tabbar,.navbar,.navigation')) return;
      const txt = (el.textContent || '').trim();
      if (looksLikeIdLabel(txt)) {
        el.classList.add('disable-when-public');
      }
    });

    // 3) Phase finale specific: find the section and hide any node whose text begins with "ID"
    const heads = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,[data-title]'))
      .filter(h => /phase\s*finale/i.test((h.textContent||'').trim()));
    heads.forEach(h => {
      const sec = h.closest('section, .section, .card, .panel, .block, .box') || h.parentElement;
      if(!sec) return;
      sec.querySelectorAll('*').forEach(node => {
        if(!(node instanceof Element)) return;
        const t = (node.textContent || '').trim();
        if(looksLikeIdLabel(t)) node.classList.add('disable-when-public');
        // Also hide by attribute/class clues
        const cls = (node.className || '').toString();
        if(/\b(match-id|game-id|id)\b/i.test(cls)) node.classList.add('disable-when-public');
        if(node.hasAttribute && (node.hasAttribute('data-id') || node.hasAttribute('data-match-id') || node.hasAttribute('data-game-id'))) {
          node.classList.add('disable-when-public');
        }
      });
    });
  }

  function run(){
    hideInScope(document);
  }

  document.addEventListener('DOMContentLoaded', run);
  const obs = new MutationObserver(muts => {
    if(!isPublic()) return;
    muts.forEach(mu => {
      (mu.addedNodes||[]).forEach(n => { if(n instanceof Element) hideInScope(n); });
      if(mu.type==='characterData' && mu.target && mu.target.parentElement) hideInScope(mu.target.parentElement);
    });
  });
  document.addEventListener('DOMContentLoaded', function(){
    obs.observe(document.body, {subtree:true, childList:true, characterData:true});
  });
})();


;


(function(){
  const KEY='rankColors_v2';
  let __rankInitDone=false;
  function safeParse(k){ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } }
  const isPublic = ()=> document.documentElement.classList.contains('readonly');
  function hexToRgb(h){ h=(h||'').replace('#',''); if(h.length===3)h=h.split('').map(x=>x+x).join(''); const n=parseInt(h||'0',16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}; }
  const mix=(a,b,t)=>Math.round(a+(b-a)*t);
  function gradient(hex, op){ const c=hexToRgb(hex||'#2e7d32'); const lo={r:mix(c.r,255,.30),g:mix(c.g,255,.30),b:mix(c.b,255,.30)}; const hi={r:mix(c.r,255,.50),g:mix(c.g,255,.50),b:mix(c.b,255,.50)}; const o=Math.max(0,Math.min(1,(op||18)/100)); return `linear-gradient(90deg, rgba(${lo.r},${lo.g},${lo.b},${o*0.7}), rgba(${hi.r},${hi.g},${hi.b},${o}))`; }
  function solid(hex, op){ const c=hexToRgb(hex||'#2e7d32'); const o=Math.max(0,Math.min(1,(op||18)/100)); return `rgba(${c.r},${c.g},${c.b},${o})`; }
  function ensureStandingsHook(){ try{ const tbl = document.querySelector('#standingsWrap table'); if(tbl && !tbl.classList.contains('rank-table')) tbl.classList.add('rank-table'); }catch(e){} }
  function applyStyles(cfg){ ensureStandingsHook(); const id='rankColorsDynamic'; let s=document.getElementById(id); if(!s){ s=document.createElement('style'); s.id=id; s.setAttribute('data-owner','rankcolors'); document.head.appendChild(s); } const bg12 = cfg.useGrad ? gradient(cfg.c12,cfg.op) : solid(cfg.c12,cfg.op); const bg34 = cfg.useGrad ? gradient(cfg.c34,cfg.op) : solid(cfg.c34,cfg.op); const bg56 = cfg.useGrad ? gradient(cfg.c56,cfg.op) : solid(cfg.c56,cfg.op); s.textContent = `
      .rank-table tbody tr:nth-child(-n+2), #standingsWrap table tbody tr:nth-child(-n+2){ background:${bg12} !important; }
      .rank-table tbody tr:nth-child(n+3):nth-child(-n+4), #standingsWrap table tbody tr:nth-child(n+3):nth-child(-n+4){ background:${bg34} !important; }
      .rank-table tbody tr:nth-child(n+5):nth-child(-n+6), #standingsWrap table tbody tr:nth-child(n+5):nth-child(-n+6){ background:${bg56} !important; }
    `; }
  const load=()=> safeParse(KEY);
  const save=(cfg)=>{ try{ localStorage.setItem(KEY, JSON.stringify(cfg)); }catch(e){} };
  const defaults=()=>({ c12:'#2e7d32', c34:'#e68c00', c56:'#e68c00', op:18, useGrad:true });
  function movePanelUnderLeagueSettings(){ try{ if(document.getElementById('rankColorsCard')?.dataset.moved==='1') return; const hs = Array.from(document.querySelectorAll('h1,h2,h3,h4')); const norm = s=> (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); let anchor=null; for(const h of hs){ if(norm(h.textContent).includes('parametres de ligue')){ anchor=h; break; } } const card = document.getElementById('rankColorsCard'); if(anchor && card){ const container = anchor.closest('.card, .panel, .box, section, div') || anchor.parentElement; container.parentElement.insertBefore(card, container.nextSibling); card.dataset.moved='1'; } if(isPublic() && card){ card.querySelectorAll('input,button').forEach(el=> el.disabled = true); } }catch(e){} }
  function wire(){ if(__rankInitDone) return; __rankInitDone=true; const card = document.getElementById('rankColorsCard'); const cfg=load()||defaults(); const q=id=>card.querySelector('#'+id); q('rc12').value=cfg.c12; q('rc34').value=cfg.c34; q('rc56').value=cfg.c56; q('rcOp').value=cfg.op; q('rcGrad').checked=!!cfg.useGrad; q('rcSave').addEventListener('click', ()=>{ const nc={ c12:q('rc12').value, c34:q('rc34').value, c56:q('rc56').value, op:+q('rcOp').value, useGrad:q('rcGrad').checked }; save(nc); applyStyles(nc); }); q('rcReset').addEventListener('click', ()=>{ const d=defaults(); save(d); applyStyles(d); q('rc12').value=d.c12; q('rc34').value=d.c34; q('rc56').value=d.c56; q('rcOp').value=d.op; q('rcGrad').checked=d.useGrad; }); applyStyles(cfg); const reapply = ()=> requestAnimationFrame(()=> applyStyles(load()||defaults())); try{ document.querySelectorAll('a,button').forEach(el=> el.addEventListener('click', ()=> setTimeout(reapply, 80))); const obs=new MutationObserver(()=> setTimeout(reapply,40)); obs.observe(document.body,{subtree:true,childList:true}); }catch(e){} }
  document.addEventListener('DOMContentLoaded', ()=>{ movePanelUnderLeagueSettings(); wire(); let tries=0; const iv=setInterval(()=>{ tries++; movePanelUnderLeagueSettings(); if(tries>40) clearInterval(iv); }, 250); });
})();


;


// ==== Runtime patch v15 ====
(function(){
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  function addScorersTab(){
    const host = document.getElementById('standingsWrap');
    if(!host || document.getElementById('scorersWrap')) return;
    const bar = document.createElement('div'); bar.className='btn-switchbar';
    const btnC = document.createElement('button'); btnC.className='btn small'; btnC.textContent='Classement';
    const btnB = document.createElement('button'); btnB.className='btn small ghost'; btnB.textContent='Buteurs';
    host.parentNode.insertBefore(bar, host); bar.append(btnC, btnB);
    const scorersWrap = document.createElement('div'); scorersWrap.id='scorersWrap'; scorersWrap.style.display='none';
    host.parentNode.insertBefore(scorersWrap, host.nextSibling);

    function teamByIdSafe(id){ try{ return (typeof teamById==='function')?teamById(id):null }catch(e){ return null; } }
    function logoTagSafe(team, size){ try{ return (typeof logoTag==='function')?logoTag(team,size): (team?.logo?`<img src="${team.logo}" width="${size}" height="${size}"/>`:''); }catch(e){ return ''; } }

    function renderScorers(){
      const stats={};
      (state.matches||[]).forEach(m=>{
        if(m.status!=='final') return;
        (m.scorers||[]).forEach(s=>{
          const key = s.playerId || s.playerName;
          if(!stats[key]) stats[key]={name:s.playerName, goals:0, playerId:s.playerId||null};
          stats[key].goals++;
        });
      });
      const rows=Object.values(stats).sort((a,b)=>b.goals-a.goals);
      let html = '<table class="rank-table">'
        + '<colgroup>'
        + '  <col style="width:50px">'   /* # */
        + '  <col style="width:25%">'    /* Joueur */
        + '  <col style="width:20%">'    /* Club */
        + '  <col style="width:20%">'    /* Buts */
        + '  <col>'                      /* Spacer rest */
        + '</colgroup>'
        + '<thead><tr><th class="rank">#</th><th class="player">Joueur</th><th class="logo">Club</th><th class="pts">Buts</th><th class="spacerR"></th></tr></thead><tbody>';
      rows.forEach((r,i)=>{
        let team=null;
        if(r.playerId){
          const p=(state.players||[]).find(x=>x.id===r.playerId);
          team = p ? (typeof teamById==='function'?teamById(p.team):null) : null;
        }
        const logo = team ? (typeof logoTag==='function'?logoTag(team,64): (team?.logo?`<img src="${team.logo}" width="64" height="64"/>`:'')) : '';
        html += `<tr><td class="rank">${i+1}</td><td class="player"><strong>${r.name}</strong></td><td class="logo">${logo}</td><td class="pts">${r.goals}</td><td class="spacerR"></td></tr>`;
      });
      html += '</tbody></table>';
      scorersWrap.innerHTML = html;
    }
    btnC.addEventListener('click',()=>{ host.style.display='block'; scorersWrap.style.display='none'; btnC.classList.remove('ghost'); btnB.classList.add('ghost'); });
    btnB.addEventListener('click',()=>{ host.style.display='none'; scorersWrap.style.display='block'; btnB.classList.remove('ghost'); btnC.classList.add('ghost'); renderScorers(); });
  }

  ready(addScorersTab);
})();


;


(function(){
  var KEY = (typeof STORAGE_KEY!=='undefined' ? STORAGE_KEY : 'tournifyOverlayV5') + '_playersListHidden';
  var hidden = true; // default
  function readPref(){
    // Prefer localStorage, then sessionStorage; ignore errors
    try{ var v = localStorage.getItem(KEY); if(v!==null) return v==='1'; }catch(e){}
    try{ var v2 = sessionStorage.getItem(KEY); if(v2!==null) return v2==='1'; }catch(e){}
    return true; // default hidden
  }
  function writePref(val){
    // Try localStorage, then sessionStorage; ignore errors
    try{ localStorage.setItem(KEY, val ? '1' : '0'); return; }catch(e){}
    try{ sessionStorage.setItem(KEY, val ? '1' : '0'); return; }catch(e){}
    // If both fail, keep only in-memory
  }
  function apply(){
    var btn = document.getElementById('togglePlayersList');
    var list = document.getElementById('playersList');
    if(!btn || !list) return;
    list.style.display = hidden ? 'none' : '';
    btn.textContent = hidden ? 'Afficher la liste' : 'Masquer la liste';
  }
  function toggle(){
    hidden = !hidden;
    apply();
    writePref(hidden);
  }
  // Init
  hidden = readPref();
  // Delegate click to catch dynamic buttons
  document.addEventListener('click', function(ev){
    var t = ev.target;
    if(t && t.id === 'togglePlayersList'){
      ev.preventDefault();
      toggle();
    }
  });
  // Apply now & after slight delay (DOM ready)
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
  setTimeout(apply, 200);
  setTimeout(apply, 800);
  // Expose for debug
  window.__playersListToggle = {get hidden(){return hidden;}, setHidden:function(v){hidden=!!v; apply();}};
})();


;


// V6.14 - Live scorers + admin goal selectors (keeps V6.13 storage logic intact)
(function(){
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function esc(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function groupBy(m, side){
    const by={};
    (m.scorers||[]).filter(x=>x.team===side).forEach(x=>{ (by[x.playerName]=by[x.playerName]||[]).push(x.minute); });
    return Object.entries(by).map(([name,mins])=>({name, mins: mins.sort((a,b)=>a-b)}));
  }
  function chips(items){ return items.map(it=>`<span class="chip">💀 ${esc(it.name)} ${it.mins.map(n=>n+'"').join(', ')}</span>`).join(''); }
  function ensure(){ window.state=window.state||{}; state.matches=state.matches||[]; state.players=state.players||[]; }

  window.addGoal = function(m, side, playerId){
    ensure();
    if(!m.scorers) m.scorers=[];
    const p=(state.players||[]).find(x=>x.id===playerId);
    const elapsed = (m.duration||state.settings?.defaultDuration||900) - (m.seconds||0);
    const minute = Math.max(0, Math.floor(elapsed/60));
    m.scorers.push({playerId:playerId||null, playerName:p?p.name:'Inconnu', team:side, minute});
    if(side==='A') m.ga=(m.ga||0)+1; else m.gb=(m.gb||0)+1;
    try{ save(); }catch(e){}
    try{
      const A=document.querySelector('#scA-'+m.id), B=document.querySelector('#scB-'+m.id);
      if(A) A.innerHTML = chips(groupBy(m,'A'));
      if(B) B.innerHTML = chips(groupBy(m,'B'));
      const score=document.querySelector('#score-'+m.id);
      if(score) score.innerHTML = `${m.ga}<span style="color:var(--muted)"> – </span>${m.gb}`;
    }catch(e){}
  };

  function patchMake(){
    if(typeof window.makeLiveCard!=='function') return false;
    if(window.__v614_sc_patch) return true;
    const _make=window.makeLiveCard;
    window.makeLiveCard=function(m, context='live'){
      const card=_make(m, context);
      // chips under team titles
      try{
        const teams=card.querySelectorAll('.cell .team');
        if(teams.length>=2){
          if(!card.querySelector('#scA-'+m.id)){
            const holderL=document.createElement('div'); holderL.className='team-scorers left';
            holderL.innerHTML=`<div class="scorers-strip" id="scA-${m.id}">${chips(groupBy(m,'A'))}</div>`;
            teams[0].parentElement.appendChild(holderL);
          }else{
            card.querySelector('#scA-'+m.id).innerHTML = chips(groupBy(m,'A'));
          }
          if(!card.querySelector('#scB-'+m.id)){
            const holderR=document.createElement('div'); holderR.className='team-scorers right';
            holderR.innerHTML=`<div class="scorers-strip" id="scB-${m.id}">${chips(groupBy(m,'B'))}</div>`;
            teams[1].parentElement.appendChild(holderR);
          }else{
            card.querySelector('#scB-'+m.id).innerHTML = chips(groupBy(m,'B'));
          }
        }
      }catch(e){}

      // remove +/- buttons, keep play/pause/reset/final in center
      try{ card.querySelectorAll('button[data-act="incA"],button[data-act="incB"],button[data-act="decA"],button[data-act="decB"]').forEach(b=>b.remove()); }catch(e){}

      // admin-only goal selectors on far left/right
      try{
        if(!(state.league && state.league.publicMode) && context==='live'){
          if(!card.querySelector('.goal-controls-split')){
            const footer=card.querySelector('.footer')||card;
            const ctr=document.createElement('div'); ctr.className='goal-controls-split';
            const left=document.createElement('div'); left.className='side';
            const right=document.createElement('div'); right.className='side';
            const playersA=(state.players||[]).filter(p=>p.team===m.a);
            const playersB=(state.players||[]).filter(p=>p.team===m.b);
            const selA=document.createElement('select'); selA.className='input';
            const selB=document.createElement('select'); selB.className='input';
            selA.innerHTML = playersA.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('') || '<option value="">—</option>';
            selB.innerHTML = playersB.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('') || '<option value="">—</option>';
            const btnA=document.createElement('button'); btnA.className='mini'; btnA.textContent='💀 A';
            const btnB=document.createElement('button'); btnB.className='mini'; btnB.textContent='💀 B';
            btnA.addEventListener('click', ()=> addGoal(m,'A',selA.value||null));
            btnB.addEventListener('click', ()=> addGoal(m,'B',selB.value||null));
            left.append('But :', selA, btnA); right.append('But :', selB, btnB);
            ctr.append(left,right); footer.appendChild(ctr);
          }
        }
      }catch(e){}

      // hooks: when finishing or reopening, update scorers + classement buteurs
      card.addEventListener('click', (ev)=>{
        const t=ev.target;
        if(!t || !t.dataset) return;
        if(t.dataset.act==='final'){
          setTimeout(()=>{ try{ if(typeof renderScorers==='function') renderScorers(); }catch(e){} }, 0);
        }else if(t.dataset.act==='reopen'){
          const mm=(state.matches||[]).find(x=>x.id===m.id); if(mm){ mm.scorers=[]; try{ save(); }catch(e){} }
          setTimeout(()=>{ try{ if(typeof renderScorers==='function') renderScorers(); }catch(e){} }, 0);
        }
      });

      return card;
    };
    window.__v614_sc_patch=true;
    return true;
  }

  function wait(){ if(!patchMake()) return setTimeout(wait, 200); }
  ready(wait);
})();


;


// V6.15 - Fix: clear scorers on reopen everywhere + layout footer (left=A goals, center=controls, right=B goals)
(function(){
  function esc(s){return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function groupBy(m, side){
    const by={}; (m.scorers||[]).filter(x=>x.team===side).forEach(x=>{ (by[x.playerName]=by[x.playerName]||[]).push(x.minute); });
    return Object.entries(by).map(([n,mins])=>({name:n, mins: mins.sort((a,b)=>a-b)}));
  }
  function chips(items){ return items.map(it=>`<span class="chip">💀 ${esc(it.name)} ${it.mins.map(n=>n+'"').join(', ')}</span>`).join(''); }

  // --- Footer layout remap ---
  function remapFooter(card, m){
    try{
      const footer = card.querySelector('.footer'); if(!footer) return;
      footer.style.display='flex'; footer.style.alignItems='center'; footer.style.justifyContent='space-between'; footer.style.gap='12px';
      // center controls = existing .controls
      const center = footer.querySelector('.controls');
      // ID line remains below
      const sub = footer.querySelector('.sub');
      // Build left/right goal controls
      const left = document.createElement('div'); left.className='goal-side left'; left.style.display='flex'; left.style.alignItems='center'; left.style.gap='8px';
      const right = document.createElement('div'); right.className='goal-side right'; right.style.display='flex'; right.style.alignItems='center'; right.style.gap='8px';
      if(!(state.league && state.league.publicMode)){ // admin only
        const playersA=(state.players||[]).filter(p=>p.team===m.a);
        const playersB=(state.players||[]).filter(p=>p.team===m.b);
        const selA=document.createElement('select'); selA.className='input'; selA.style.minWidth='180px';
        const selB=document.createElement('select'); selB.className='input'; selB.style.minWidth='180px';
        selA.innerHTML = playersA.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('') || '<option value="">—</option>';
        selB.innerHTML = playersB.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('') || '<option value="">—</option>';
        const btnA=document.createElement('button'); btnA.className='mini'; btnA.textContent='💀 A';
        const btnB=document.createElement('button'); btnB.className='mini'; btnB.textContent='💀 B';
        btnA.addEventListener('click',()=>{ try{ addGoal(m,'A',selA.value||null); }catch(e){} });
        btnB.addEventListener('click',()=>{ try{ addGoal(m,'B',selB.value||null); }catch(e){} });
        left.append('But :', selA, btnA);
        right.append('But :', selB, btnB);
      }
      // Clear footer then append left-center-right and keep sub (ID) below as full width row
      const container = document.createElement('div'); container.style.display='flex'; container.style.alignItems='center'; container.style.justifyContent='space-between'; container.style.width='100%'; container.style.gap='12px';
      if(center){ container.append(left, center, right); } else { container.append(left, right); }
      footer.innerHTML='';
      footer.appendChild(container);
      if(sub) footer.appendChild(sub);
    }catch(e){}
  }

  // --- Document-level reopen hook: clear m.scorers and refresh UI
  document.addEventListener('click', function(ev){
    const t = ev.target;
    if(!t || !t.dataset) return;
    if(t.dataset.act === 'reopen'){ // 'Annuler le résultat'
      try{
        // Try to locate match id on this card
        let root = t.closest('.match-card');
        let id = null;
        if(root){ // try to read from 'ID xxx' text
          const sub = root.querySelector('.sub'); if(sub){ const mm = (sub.textContent||'').match(/ID\s+(\w+)/i); if(mm) id = mm[1]; }
        }
        // Fallback: grab first timer id near
        if(!id){ const tm = (root && root.querySelector('[id^=timer-]'))?.id || ''; if(tm.startsWith('timer-')) id = tm.slice(6); }
        if(id && window.state && Array.isArray(state.matches)){ const match = state.matches.find(x=>x.id===id); if(match) match.scorers = []; }
        try{ save(); }catch(_e){}
        // Refresh lists and chips if present
        setTimeout(function(){ try{ if(typeof renderFinished==='function') renderFinished(); }catch(_e){} try{ if(typeof renderLive==='function') renderLive(); }catch(_e){} try{ if(typeof renderScorers==='function') renderScorers(); }catch(_e){} }, 0);
      }catch(e){}
    }
  });

  // --- On card build, inject scorers chips and remap footer
  const _orig = window.makeLiveCard;
  if(typeof _orig === 'function' && !window.__v615_footer){
    window.makeLiveCard = function(m, context){
      const card = _orig(m, context);
      // scorers chips setup/refresh
      try{
        const teams=card.querySelectorAll('.cell .team');
        if(teams.length>=2){
          let stripA = card.querySelector('#scA-'+m.id);
          if(!stripA){ const h=document.createElement('div'); h.className='team-scorers left'; h.innerHTML=`<div class="scorers-strip" id="scA-${m.id}"></div>`; teams[0].parentElement.appendChild(h); stripA = h.firstElementChild; }
          stripA.innerHTML = chips(groupBy(m,'A'));
          let stripB = card.querySelector('#scB-'+m.id);
          if(!stripB){ const h=document.createElement('div'); h.className='team-scorers right'; h.innerHTML=`<div class="scorers-strip" id="scB-${m.id}"></div>`; teams[1].parentElement.appendChild(h); stripB = h.firstElementChild; }
          stripB.innerHTML = chips(groupBy(m,'B'));
        }
      }catch(e){}
      // footer layout
      remapFooter(card, m);
      return card;
    };
    window.__v615_footer = true;
  }
})();


;


// ===== V6.16 — de-dupe goal controls + inline ID + pause on goal =====
(function(){
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  // 1) Wrap addGoal to PAUSE the timer on each goal (stop ticker)
  ready(function(){
    try{
      if(!window.__v616_goalpause && typeof window.addGoal === 'function'){
        const _addGoal = window.addGoal;
        window.addGoal = function(m, side, playerId){
          const res = _addGoal.apply(this, arguments);
          try{
            if(m){ m.lastTick = null; }
            if(window.tickers && typeof tickers.delete === 'function' && m && m.id){ tickers.delete(m.id); }
          }catch(e){}
          try{ if(typeof save==='function') save(); }catch(e){}
          return res;
        };
        window.__v616_goalpause = true;
      }
    }catch(e){}
  });

  // 2) Re-map footer on render and remove old .goal-controls-split (the source of the duplicate)
  function applyFooter(card, m){
    try{
      const footer = card.querySelector('.footer'); if(!footer) return;
      // Remove any previous split block injected by older patch
      footer.querySelectorAll('.goal-controls-split, .goal-side, .goal-side-left, .goal-side-right').forEach(el=>el.remove());

      // Center controls
      const center = footer.querySelector('.controls');
      const sub = footer.querySelector('.sub'); // contains "ID xxxxxx"

      // Create clean container
      const container = document.createElement('div');
      container.style.display='flex';
      container.style.alignItems='center';
      container.style.justifyContent='space-between';
      container.style.gap='12px';
      container.style.width='100%';

      // Build admin-only goal selectors (A on left, B on right)
      const isPublic = !!(window.state && state.league && state.league.publicMode);
      const left = document.createElement('div');
      const right = document.createElement('div');
      left.style.display=right.style.display='flex';
      left.style.alignItems=right.style.alignItems='center';
      left.style.gap=right.style.gap='8px';

      if(!isPublic && center){ // admin live
        const esc = s => (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
        const playersA=(state.players||[]).filter(p=>p.team===m.a);
        const playersB=(state.players||[]).filter(p=>p.team===m.b);
        const selA=document.createElement('select'); selA.className='input'; selA.style.minWidth='180px';
        const selB=document.createElement('select'); selB.className='input'; selB.style.minWidth='180px';
        selA.innerHTML = playersA.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('') || '<option value="">—</option>';
        selB.innerHTML = playersB.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('') || '<option value="">—</option>';
        const btnA=document.createElement('button'); btnA.className='mini'; btnA.textContent='💀 A';
        const btnB=document.createElement('button'); btnB.className='mini'; btnB.textContent='💀 B';
        btnA.addEventListener('click',()=>{ try{ addGoal(m,'A',selA.value||null); }catch(e){} });
        btnB.addEventListener('click',()=>{ try{ addGoal(m,'B',selB.value||null); }catch(e){} });
        left.append(selA, btnA);
        right.append(selB, btnB);
      }

      // Move the ID inline to the RIGHT of the center controls
      let idSpan = null;
      if(sub){
        idSpan = document.createElement('span');
        idSpan.className = 'sub';
        idSpan.textContent = sub.textContent || '';
        idSpan.style.marginLeft = '12px';
        idSpan.style.whiteSpace = 'nowrap';
        // remove the original sub from footer
        sub.remove();
      }

      // Recompose footer
      footer.innerHTML='';
      if(center){
        const centerWrap = document.createElement('div');
        centerWrap.style.display='flex';
        centerWrap.style.alignItems='center';
        centerWrap.style.gap='10px';
        centerWrap.append(center);
        if(idSpan) centerWrap.append(idSpan);
        container.append(left, centerWrap, right);
      }else{
        container.append(left, right);
      }
      footer.appendChild(container);
    }catch(e){}
  }

  // Hook makeLiveCard to clean footer every time it's rendered
  function hook(){
    if(typeof window.makeLiveCard!=='function') return false;
    if(window.__v616_footerfix) return true;
    const _make = window.makeLiveCard;
    window.makeLiveCard = function(m, context){
      const card = _make.apply(this, arguments);
      applyFooter(card, m);
      return card;
    };
    window.__v616_footerfix = true;
    return true;
  }
  function wait(){ if(!hook()) setTimeout(wait, 150); }
  ready(wait);
})();


;


// V6.17 — Fiabilise "Match terminé" (persistant + cohérent en public), et réparation statut au chargement.
(function(){
  function getMatchIdFromCard(el){
    const card = el.closest ? el.closest('.match-card') : null;
    if(!card) return null;
    const sub = card.querySelector('.sub');
    if(sub){
      const m = (sub.textContent||'').match(/ID\s+(\w+)/i);
      if(m) return m[1];
    }
    const t = card.querySelector('[id^=timer-]');
    if(t && t.id) return t.id.replace(/^timer-/, '');
    return null;
  }
  function getMatchById(id){
    try{ return (window.state?.matches||[]).find(x=>x.id===id) || null; }catch(_){ return null; }
  }
  function hardPause(m){
    try{
      m.lastTick = null;
      if(window.tickers && typeof tickers.delete==='function') tickers.delete(m.id);
    }catch(_){}
  }
  function markFinal(m){
    if(!m) return;
    m.status = 'final';
    m.finished = true;
    m.isFinal = true;
    hardPause(m);
    if(m.seconds==null) m.seconds = 0;
    m.seconds = 0;
  }
  function reopenMatch(m){
    if(!m) return;
    m.status = 'upcoming';
    m.finished = false;
    m.isFinal = false;
    m.ga = 0; m.gb = 0;
    m.seconds = m.duration || (window.state?.settings?.defaultDuration||900);
    hardPause(m);
  }
  // Global click handler to enforce final/reopen semantics + save + rerender
  document.addEventListener('click', function(ev){
    const t = ev.target;
    if(!t || !t.dataset) return;
    const act = t.dataset.act;
    if(act!=='final' && act!=='reopen') return;
    const id = getMatchIdFromCard(t); if(!id) return;
    const m = getMatchById(id); if(!m) return;
    if(act==='final'){ markFinal(m); }
    if(act==='reopen'){ reopenMatch(m); }
    try{ if(typeof save==='function') save(); }catch(_){}
    try{ if(typeof renderStandings==='function') renderStandings(); }catch(_){}
    try{ if(typeof renderLive==='function') renderLive(); }catch(_){}
    try{ if(typeof renderFinished==='function') renderFinished(); }catch(_){}
  }, true);

  // Au chargement: réparation des statuts incohérents (évite "en cours" après F5)
  document.addEventListener('DOMContentLoaded', function(){
    try{
      (window.state?.matches||[]).forEach(m=>{
        if(m.finished && m.status!=='final') m.status='final';
        if(m.isFinal && m.status!=='final') m.status='final';
        if(m.status==='final'){ m.lastTick=null; }
      });
      if(typeof save==='function') save();
    }catch(_){}
  });
})();


;


// ===== V7.3 — Public keeps scorers updated WITHOUT showing admin controls =====
(function(){
  function isPublic(){
    try{ if (window.state && state.league && state.league.publicMode === true) return true; }catch(_){}
    var qs = String(location.search||'').toLowerCase();
    var hs = String(location.hash||'').toLowerCase();
    if (qs.includes('public=1') || qs.includes('mode=public') || hs.includes('public')) return true;
    try{
      var hasGestion = !!Array.from(document.querySelectorAll('nav,header,.topbar,.tabs')).find(el => /gestion/i.test(el.textContent||''));
      if(!hasGestion) return true;
    }catch(_){}
    return false;
  }
  function hideAdminControls(scope){
    if(!isPublic()) return;
    var root = scope || document;
    root.querySelectorAll('.goal-side, .goal-controls-split').forEach(function(n){ n.remove(); });
    root.querySelectorAll('[data-act="play"], [data-act="pause"], [data-act="incA"], [data-act="incB"], [data-act="reset"], [data-act="final"], [data-act="reopen"]').forEach(function(n){ n.remove(); });
    root.querySelectorAll('.footer .controls').forEach(function(c){ if(!c.children.length) c.remove(); });
    root.querySelectorAll('.footer *').forEach(function(el){
      Array.prototype.forEach.call(el.childNodes, function(n){
        if(n.nodeType===3 && /^\s*But\s*:?\s*$/i.test(n.textContent)) n.textContent='';
      });
    });
  }
  function wrapRenders(){
    if(window.__v73_patched) return;
    function wrap(name){
      var fn = window[name];
      if(typeof fn!=='function') return;
      window[name] = function(){
        var r = fn.apply(this, arguments);
        try{ hideAdminControls(document); }catch(_){}
        return r;
      };
    }
    ['renderLive','renderFinished','renderStandings','load'].forEach(wrap);
    window.__v73_patched = true;
  }
  window.addEventListener('storage', function(){ try{ hideAdminControls(document); }catch(_){}});
  var mo = new MutationObserver(function(){ hideAdminControls(document); });
  try{ mo.observe(document.body, {childList:true, subtree:true}); }catch(_){}
  if(document.readyState!=='loading'){
    hideAdminControls(document); wrapRenders();
  } else {
    document.addEventListener('DOMContentLoaded', function(){ hideAdminControls(document); wrapRenders(); });
  }
})();


;


// V7.4 – Post-process Classement: applique fond nom + logo fondu par ligne
(function(){
  function teamByName(name){
    name = String(name||'').trim().toLowerCase();
    if(!window.state || !Array.isArray(state.teams)) return null;
    return state.teams.find(t => String(t.name||'').trim().toLowerCase() === name) || null;
  }
  function enhanceStandings(){
    var wrap = document.getElementById('standingsWrap');
    if(!wrap) return;
    var rows = wrap.querySelectorAll('tbody tr');
    rows.forEach(function(tr){
      var cell = tr.querySelector('.team-cell'); if(!cell) return;
      // avoid duplicating
      if(cell.__v74_done) return;
      cell.__v74_done = true;

      var nameEl = cell.querySelector('span'); var name = nameEl ? nameEl.textContent.trim() : '';
      var team = teamByName(name) || {};
      var logo = team.logo || '';

      // bg name
      var bgName = document.createElement('span');
      bgName.className = 'row-bg-name';
      bgName.textContent = name;
      cell.appendChild(bgName);

      // bg logo
      if(logo){
        var bgLogo = document.createElement('span');
        bgLogo.className = 'row-bg-logo';
        bgLogo.style.backgroundImage = "url('"+logo.replace(/'/g, "\\'")+"')";
        cell.appendChild(bgLogo);
      }

      // optional: tint with team color if present
      if(team.color){
        // soften color
        var col = team.color;
        cell.style.backgroundImage = 'linear-gradient(90deg, '+col+'22 0%, transparent 70%)';
      }
    });
  }

  // Wrap renderer to re-apply after chaque rendu
  (function patchRender(){
    if(window.__v74_standings) return;
    var fn = window.renderStandings;
    if(typeof fn === 'function'){
      window.renderStandings = function(){
        var r = fn.apply(this, arguments);
        try{ enhanceStandings(); }catch(_){}
        return r;
      };
      window.__v74_standings = true;
    } else {
      // fallback: try later
      setTimeout(patchRender, 400);
    }
  })();

  // Initial pass
  if(document.readyState!=='loading') setTimeout(enhanceStandings, 0);
  else document.addEventListener('DOMContentLoaded', function(){ setTimeout(enhanceStandings, 0); });
})();


;


// V8.20: neutralize handlers touching removed/hidden league params to prevent errors
(function(){
  function byId(id){ return document.getElementById(id); }
  // If the form exists, keep it hidden and prevent default submits
  var lf = byId('leagueForm');
  if (lf) {
    lf.addEventListener('submit', function(e){ e.preventDefault(); }, {once:true});
  }
  // Guard buttons if present
  var btns = ['applyPalette','exportBtn','resetData'];
  btns.forEach(function(id){
    var el = byId(id);
    if (el) {
      el.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); }, {once:true});
    }
  });
  // Import file: cancel change
  var imp = byId('importFile');
  if (imp) {
    imp.addEventListener('change', function(e){ e.preventDefault(); e.stopPropagation(); this.value=''; }, {once:true});
  }
})();
