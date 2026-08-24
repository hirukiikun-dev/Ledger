/* =====================================================================
   Ledger — Trading Journal System
   Single-file web app. Data layer is pluggable:
     - default: localStorage (works offline, no setup)
     - optional: Firebase (Auth + Firestore) — see CLOUD block below
   ===================================================================== */

/* ---------------------------------------------------------------------
   CLOUD / FIREBASE HOOK
   assets/firebase.js pulls the public Firebase config from /api/config
   (populated by .env.local locally, or Vercel env vars in production).
   When the config is filled in it sets
     window.LEDGER_CLOUD = { signIn, signUp, signOut, load, save, onUser }
   and fires the "ledger-cloud-ready" event.
   With no config the app just stays in offline localStorage mode.
--------------------------------------------------------------------- */
const Cloud = () => (window.LEDGER_CLOUD || null);

/* ---------------------------- state ---------------------------- */
const KEY = "ledger.v1";
const DEFAULT_STATE = {
  session: { mode: "local", email: "", name: "Guest trader" },
  settings: { currency: "USD", startBalance: 5000, aiMode: "proxy", aiKey: "", aiModel: "gpt-4o-mini" },
  trades: [],
  journals: {},   // "YYYY-MM-DD" -> { q1,q2,q3, updatedAt }
  seeded: false
};
let state = load();
let route = location.hash.replace("#","") || "dashboard";
let ui = { month: null, aiOpen:false, aiLog:[], aiBusy:false, editing:null, sort:"new" };

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return seed(structuredClone(DEFAULT_STATE));
    const s = JSON.parse(raw);
    return Object.assign(structuredClone(DEFAULT_STATE), s);
  }catch(e){ return seed(structuredClone(DEFAULT_STATE)); }
}
let saveTimer=null;
function save(quiet){
  try{ localStorage.setItem(KEY, JSON.stringify(state)); }
  catch(e){ toast("Storage full — remove some screenshots"); }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{ const c=Cloud(); if(c && state.session.mode==="cloud") c.save(state); }, 900);
  if(!quiet) flashSaved();
}

/* ---------------------------- helpers ---------------------------- */
const CUR = { USD:"$", EUR:"€", PHP:"₱", GBP:"£", JPY:"¥" };
const sym = () => CUR[state.settings.currency] || "$";
const nf = (n,d=2) => Number(n||0).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
function money(n,opts={}){
  const v = Number(n||0), s = v>0?"+":v<0?"-":"";
  const body = sym()+nf(Math.abs(v), Math.abs(v)>=1000?0:2);
  return (opts.signed===false? "" : s) + body;
}
const cls = n => Number(n)>0?"pos":Number(n)<0?"neg":"neu";
const pct = n => (Number(n)||0).toFixed(1)+"%";
const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const todayISO = () => new Date().toLocaleDateString("en-CA");
function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); }
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function dLabel(iso){
  const [y,m,d] = iso.split("-").map(Number);
  return MON[m-1]+" "+d+", "+y;
}
function dShort(iso){ const [y,m,d]=iso.split("-").map(Number); return MON[m-1]+" "+d; }
function weekday(iso){ const dt=new Date(iso+"T00:00:00"); return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][dt.getDay()]; }
function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("on");
  clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove("on"), 2100);
}
function flashSaved(){
  document.querySelectorAll("[data-saved]").forEach(el=>{
    el.innerHTML = ICON.check+" Saved";
    clearTimeout(el._t); el._t=setTimeout(()=>{ el.innerHTML=""; }, 1600);
  });
}

/* ---------------------------- icons ---------------------------- */
const I = (p,extra="") => '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" '+extra+'>'+p+'</svg>';
const ICON = {
  dash: I('<path d="M4 19V10M9.5 19V5M15 19v-6M20.5 19v-9"/>'),
  daily: I('<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3v3M16 3v3M8 14h6M8 17h4"/>'),
  trades: I('<path d="M4 15l4.5-5 3.5 3L20 6"/><path d="M15 6h5v5"/><path d="M4 20h16"/>'),
  set: I('<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  x: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  check: I('<path d="M20 6L9 17l-5-5"/>','width="13" height="13"'),
  spark: I('<path d="M12 3l1.6 4.6L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.4z"/><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'),
  send: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  img: I('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4.5 17l4.7-4.2 3.4 3 2.6-2.3 4.3 3.8"/>'),
  cloud: I('<path d="M7.5 18h9.2A3.3 3.3 0 0 0 17 11.4 5.2 5.2 0 0 0 7.2 10.6A3.7 3.7 0 0 0 7.5 18z"/>'),
  trash: I('<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>','width="15" height="15"'),
  out: I('<path d="M15 4h4v16h-4M11 16l-4-4 4-4M7 12h9"/>','width="15" height="15"'),
  edit: I('<path d="M5 19h3l9.5-9.5a2 2 0 0 0-3-3L5 16v3z"/>','width="15" height="15"')
};
const LOGO = '<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#19212E" stroke="#2C374B"/><rect x="9" y="11" width="4" height="12" rx="1.5" fill="#72BC8F"/><rect x="10.5" y="7.5" width="1" height="17" fill="#72BC8F"/><rect x="19" y="9" width="4" height="9" rx="1.5" fill="#5E9FE8"/><rect x="20.5" y="6" width="1" height="18" fill="#5E9FE8"/></svg>';

/* ---------------------------- stats ---------------------------- */
function stats(list){
  const t = list.slice();
  const wins = t.filter(x=>x.pnl>0), losses = t.filter(x=>x.pnl<0), be = t.filter(x=>x.pnl===0);
  const gp = wins.reduce((a,b)=>a+b.pnl,0), gl = Math.abs(losses.reduce((a,b)=>a+b.pnl,0));
  const net = t.reduce((a,b)=>a+b.pnl,0);
  const avgW = wins.length? gp/wins.length : 0;
  const avgL = losses.length? gl/losses.length : 0;
  const wr = t.length? wins.length/t.length*100 : 0;
  const rs = t.filter(x=>typeof x.rr==="number" && !isNaN(x.rr)).map(x=>x.rr);
  const sorted = t.slice().sort((a,b)=> a.date===b.date ? (a.created||0)-(b.created||0) : a.date.localeCompare(b.date));
  let eq=0, peak=0, dd=0, streak=0, best=0, worst=0, cur=0;
  sorted.forEach(x=>{
    eq+=x.pnl; peak=Math.max(peak,eq); dd=Math.min(dd, eq-peak);
    if(x.pnl>0) cur = cur>0? cur+1 : 1; else if(x.pnl<0) cur = cur<0? cur-1 : -1;
    best=Math.max(best,cur); worst=Math.min(worst,cur);
  });
  streak = cur;
  return {
    n:t.length, wins:wins.length, losses:losses.length, be:be.length, net, gp, gl,
    wr, avgW, avgL,
    pf: gl? gp/gl : (gp? Infinity : 0),
    expectancy: t.length? net/t.length : 0,
    avgR: rs.length? rs.reduce((a,b)=>a+b,0)/rs.length : null,
    bestTrade: t.length? Math.max(...t.map(x=>x.pnl)) : 0,
    worstTrade: t.length? Math.min(...t.map(x=>x.pnl)) : 0,
    maxDD: dd, streak, bestStreak:best, worstStreak:worst,
    equity: sorted.reduce((acc,x)=>{ const last = acc.length? acc[acc.length-1].v : 0; acc.push({date:x.date, v:last+x.pnl}); return acc; },[])
  };
}
function monthKey(iso){ return iso.slice(0,7); }
function monthsOf(list){
  const set = [...new Set(list.map(t=>monthKey(t.date)))].sort();
  return set;
}
function monthLabel(mk){ const [y,m]=mk.split("-"); return MON[Number(m)-1]+" "+y; }

/* ---------------------------- seed demo ---------------------------- */
function seed(s){
  let x = 20260825;
  const rnd = () => { x = (1103515245*x + 12345) % 2147483648; return x/2147483648; };
  const pairs = ["BTC/USDT","ETH/USDT","SOL/USDT","LINK/USDT","ARB/USDT","DOGE/USDT","AVAX/USDT","SUI/USDT"];
  const setups = ["Range deviation reclaim","HTF trend continuation","Liquidity sweep + FVG","Breakout retest","Failed auction reversal","News momentum"];
  const notesWin = ["Waited for the reclaim candle to close before entering. Size was planned, no add-ons.","Followed the plan: entry at the level, stop under the sweep, target previous high.","Took partials at 1R and let the runner work into the daily level."];
  const notesLoss = ["Entered before confirmation because I was afraid of missing the move.","Widened the stop mid-trade. Broke my own rule.","Traded a low-conviction setup right after a loss — revenge entry."];
  const trades = [];
  const base = new Date("2026-08-25T00:00:00");
  for(let d=0; d<95; d++){
    const day = new Date(base); day.setDate(base.getDate()-d);
    const dow = day.getDay();
    if(dow===0 && rnd()<0.7) continue;
    if(rnd()<0.42) continue;
    const iso = day.toLocaleDateString("en-CA");
    const count = 1 + Math.floor(rnd()*3);
    for(let k=0;k<count;k++){
      const win = rnd() < 0.54;
      const rr = win ? 0.8 + rnd()*2.6 : -(0.6 + rnd()*1.1);
      const risk = 55 + Math.floor(rnd()*70);
      const pnl = Math.round(rr*risk*100)/100;
      const dir = rnd()<0.58 ? "long" : "short";
      const pair = pairs[Math.floor(rnd()*pairs.length)];
      const entry = Math.round((10+rnd()*220)*100)/100;
      const exitP = Math.round((entry * (1 + (dir==="long"?1:-1)*(win?1:-1)*(0.004+rnd()*0.05)))*100)/100;
      trades.push({
        id: uid(), date: iso, created: day.getTime()+k*3600000,
        pair, dir, setup: setups[Math.floor(rnd()*setups.length)],
        entry, exit: exitP, size: Math.round((risk*3)/entry*1000)/1000,
        pnl, rr: Math.round(rr*100)/100, fees: Math.round(rnd()*4*100)/100,
        q1: win ? "The narrative worked because higher-timeframe structure agreed with the intraday level — buyers defended it twice before I entered." 
                : "The narrative failed because I only had the intraday level; higher timeframe was still in a downtrend so the level never held.",
        q2: win ? notesWin[Math.floor(rnd()*notesWin.length)] : notesLoss[Math.floor(rnd()*notesLoss.length)],
        q3: win ? "Repeatable. Next time size a little larger when HTF and LTF agree." : "Wait for the confirmation close and keep the original stop. No re-entry after the first loss.",
        shots: { entry:null, exit:null }
      });
    }
  }
  s.trades = trades;
  const days = [...new Set(trades.map(t=>t.date))].sort().slice(-6);
  days.forEach((iso,i)=>{
    s.journals[iso] = {
      q1: i%2 ? "I over-traded the afternoon session. Two of the entries were not on my plan sheet." : "Nothing structural — I hesitated on the A+ setup and got a worse fill.",
      q2: i%2 ? "Fear of missing the continuation after the London move. I was watching PnL instead of levels." : "They were pre-marked levels from my morning prep, so conviction was genuine.",
      q3: "Cap the day at three trades, journal each one before opening the next, and stop trading after two losses.",
      updatedAt: Date.now()
    };
  });
  s.seeded = true;
  try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch(e){}
  return s;
}

/* ---------------------------- charts ---------------------------- */
function barChart(rows, opts={}){
  // rows: [{label, value}]
  const W = 640, H = opts.height||210, pl=48, pr=8, pt=12, pb=26;
  if(!rows.length) return '<div class="empty">No closed trades yet</div>';
  const vals = rows.map(r=>Number(r.value)||0);
  let top = Math.max(0, ...vals), bot = Math.min(0, ...vals);
  const pad = ((top-bot)||1)*0.14;
  if(top>0) top += pad;
  if(bot<0) bot -= pad;
  if(top===bot){ top = 1; bot = 0; }
  const span = top-bot;
  const iw = W-pl-pr, ih = H-pt-pb;
  const Y = v => pt + ih*(1-(v-bot)/span);
  const zero = Y(0);
  const bw = Math.min(46, iw/rows.length*0.62);
  let g = "";
  [top, (top+bot)/2, bot].forEach(v=>{
    const y = Y(v);
    g += '<line class="grid-line" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'"/>';
    g += '<text x="'+(pl-8)+'" y="'+(y+3.5).toFixed(1)+'" text-anchor="end">'+(v>0?"+":v<0?"-":"")+sym()+nf(Math.abs(v),0)+'</text>';
  });
  g += '<line class="axis-line" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+zero.toFixed(1)+'" y2="'+zero.toFixed(1)+'"/>';
  rows.forEach((r,i)=>{
    const cx = pl + iw*((i+0.5)/rows.length);
    const h = Math.abs(Y(r.value)-zero);
    const y = r.value>=0 ? zero-h : zero;
    const c = r.value>=0 ? "#72BC8F" : "#E97366";
    g += '<rect x="'+(cx-bw/2).toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(2,h).toFixed(1)+'" rx="3" fill="'+c+'" opacity="'+(r.dim?0.45:0.92)+'"><title>'+esc(r.label)+": "+money(r.value)+'</title></rect>';
    g += '<text x="'+cx.toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle">'+esc(r.label)+'</text>';
  });
  return '<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(opts.aria||"Performance bar chart")+'">'+g+'</svg>';
}
function lineChart(points, opts={}){
  const W=470, H=opts.height||250, pl=52, pr=12, pt=16, pb=26;
  if(points.length<2) return '<div class="empty">Not enough trades to plot an equity curve</div>';
  const vals = points.map(p=>p.v);
  const min = Math.min(0,...vals), max = Math.max(...vals);
  const span = (max-min)||1, iw=W-pl-pr, ih=H-pt-pb;
  const X = i => pl + iw*(i/(points.length-1));
  const Y = v => pt + ih*(1-(v-min)/span);
  let g="";
  [max,(max+min)/2,min].forEach(v=>{
    const y=Y(v);
    g += '<line class="grid-line" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'"/>';
    g += '<text x="'+(pl-8)+'" y="'+(y+3.5).toFixed(1)+'" text-anchor="end">'+sym()+nf(v,0)+'</text>';
  });
  if(min<0 && max>0) g += '<line class="axis-line" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(0).toFixed(1)+'" y2="'+Y(0).toFixed(1)+'"/>';
  const d = points.map((p,i)=> (i?"L":"M")+X(i).toFixed(1)+" "+Y(p.v).toFixed(1)).join(" ");
  const area = d+" L"+X(points.length-1).toFixed(1)+" "+Y(min).toFixed(1)+" L"+X(0).toFixed(1)+" "+Y(min).toFixed(1)+" Z";
  const up = vals[vals.length-1] >= 0;
  const col = up? "#5E9FE8" : "#E97366";
  g = '<defs><linearGradient id="eqg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="'+col+'" stop-opacity=".28"/><stop offset="1" stop-color="'+col+'" stop-opacity="0"/></linearGradient></defs>'
    + g + '<path d="'+area+'" fill="url(#eqg)"/><path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linejoin="round"/>'
    + '<circle cx="'+X(points.length-1).toFixed(1)+'" cy="'+Y(vals[vals.length-1]).toFixed(1)+'" r="3.4" fill="'+col+'"/>'
    + '<text x="'+pl+'" y="'+(H-6)+'">'+esc(dShort(points[0].date))+'</text>'
    + '<text x="'+(W-pr)+'" y="'+(H-6)+'" text-anchor="end">'+esc(dShort(points[points.length-1].date))+'</text>';
  return '<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Equity curve">'+g+'</svg>';
}

/* ---------------------------- views ---------------------------- */
function viewDashboard(){
  const all = state.trades;
  const mks = monthsOf(all);
  const mk = ui.month && mks.includes(ui.month) ? ui.month : (mks[mks.length-1] || todayISO().slice(0,7));
  const monthTrades = all.filter(t=>monthKey(t.date)===mk);
  const m = stats(monthTrades), a = stats(all);
  const rows = mks.slice(-12).map(k=>({ label: MON[Number(k.split("-")[1])-1], value: all.filter(t=>monthKey(t.date)===k).reduce((s,t)=>s+t.pnl,0), dim: k!==mk }));
  const days = [...new Set(monthTrades.map(t=>t.date))].sort();
  const dayRows = days.map(d=>{ const l=monthTrades.filter(t=>t.date===d); return { date:d, n:l.length, pnl:l.reduce((s,t)=>s+t.pnl,0) }; });
  const green = dayRows.filter(d=>d.pnl>0).length, red = dayRows.filter(d=>d.pnl<0).length;

  return `
  <div class="topbar">
    <div>
      <h1 class="page-title">Dashboard</h1>
      <p class="page-sub">${monthLabel(mk)} · ${m.n} trades · ${days.length} trading days</p>
    </div>
    <div class="actions">
      <select id="monthSel" style="width:auto;min-width:150px" aria-label="Select month">
        ${mks.slice().reverse().map(k=>`<option value="${k}" ${k===mk?"selected":""}>${monthLabel(k)}</option>`).join("")}
      </select>
      <button class="btn btn-primary" data-act="new-trade">${ICON.plus} Log trade</button>
    </div>
  </div>

  <section class="grid stat-grid" style="margin-bottom:14px">
    ${stat("Net P&L — month", money(m.net), cls(m.net), `${m.wins}W · ${m.losses}L · ${m.be}BE`)}
    ${stat("Win rate", pct(m.wr), m.wr>=50?"pos":"neu", `${m.wins} of ${m.n} closed`)}
    ${stat("Profit factor", m.pf===Infinity?"∞":nf(m.pf,2), m.pf>=1?"pos":"neg", `${money(m.gp)} / ${money(-m.gl)}`)}
    ${stat("Expectancy / trade", money(m.expectancy), cls(m.expectancy), m.avgR!=null?`Avg ${nf(m.avgR,2)}R`:"—")}
  </section>

  <div class="grid" style="grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);align-items:start">
    <div class="card">
      <div class="card-head">
        <h2 class="card-title">Monthly performance</h2>
        <span class="card-note">Net P&L, last ${rows.length} months</span>
      </div>
      ${barChart(rows,{aria:"Monthly net profit and loss"})}
    </div>
    <div class="card">
      <div class="card-head">
        <h2 class="card-title">Equity curve</h2>
        <span class="card-note">All time · ${a.n} trades</span>
      </div>
      ${lineChart(a.equity)}
    </div>
  </div>

  <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start;margin-top:14px">
    <div class="card">
      <div class="card-head">
        <h2 class="card-title">Statistical summary</h2>
        <span class="card-note">${monthLabel(mk)}</span>
      </div>
      <div class="table-wrap">
        <table>
          <tbody>
            ${srow("Average win", money(m.avgW), "pos")}
            ${srow("Average loss", money(-m.avgL), "neg")}
            ${srow("Largest win", money(m.bestTrade), "pos")}
            ${srow("Largest loss", money(m.worstTrade), "neg")}
            ${srow("Max drawdown", money(m.maxDD), "neg")}
            ${srow("Green / red days", green+" / "+red, "neu")}
            ${srow("Current streak", (m.streak>0? m.streak+"W" : m.streak<0? Math.abs(m.streak)+"L" : "—"), m.streak>0?"pos":m.streak<0?"neg":"neu")}
            ${srow("All-time net", money(a.net), cls(a.net))}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-head">
        <h2 class="card-title">Daily breakdown</h2>
        <span class="card-note">${monthLabel(mk)}</span>
      </div>
      <div class="table-wrap" style="max-height:264px;overflow-y:auto">
        <table>
          <thead><tr><th>Day</th><th>Trades</th><th>Net P&L</th></tr></thead>
          <tbody>
            ${dayRows.length? dayRows.slice().reverse().map(d=>`<tr><td>${dShort(d.date)}</td><td>${d.n}</td><td class="${cls(d.pnl)}">${money(d.pnl)}</td></tr>`).join("") : '<tr><td colspan="3" style="text-align:center;color:var(--txt3)">No trades this month</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}
function stat(label,value,c,meta){
  return `<div class="stat"><div class="label">${esc(label)}</div><div class="stat-v ${c}">${value}</div><div class="stat-m">${esc(meta)}</div></div>`;
}
function srow(k,v,c){ return `<tr><td style="color:var(--txt2)">${esc(k)}</td><td class="${c}">${v}</td></tr>`; }

function viewDaily(){
  const dates = [...new Set(state.trades.map(t=>t.date))].sort().reverse();
  const d = ui.day || dates[0] || todayISO();
  const list = state.trades.filter(t=>t.date===d).sort((a,b)=>(a.created||0)-(b.created||0));
  const s = stats(list);
  const j = state.journals[d] || {q1:"",q2:"",q3:""};
  const Q = [
    "What did I do wrong today, and what caused it?",
    "Why did I take those trades?",
    "How can I improve tomorrow?"
  ];
  return `
  <div class="topbar">
    <div>
      <h1 class="page-title">Daily journal</h1>
      <p class="page-sub">${weekday(d)}, ${dLabel(d)}</p>
    </div>
    <div class="actions">
      <input type="date" id="dayPick" value="${d}" style="width:auto" aria-label="Journal date" />
      <button class="btn btn-primary" data-act="new-trade">${ICON.plus} Log trade</button>
    </div>
  </div>

  <section class="grid stat-grid" style="margin-bottom:14px">
    ${stat("Net P&L", money(s.net), cls(s.net), `${s.n} trade${s.n===1?"":"s"} closed`)}
    ${stat("Win rate", s.n? pct(s.wr):"—", s.wr>=50&&s.n?"pos":"neu", `${s.wins}W · ${s.losses}L`)}
    ${stat("Best trade", s.n? money(s.bestTrade):"—", "pos", s.n? "Worst "+money(s.worstTrade) : "—")}
    ${stat("Avg R multiple", s.avgR!=null? nf(s.avgR,2)+"R" : "—", s.avgR>0?"pos":s.avgR<0?"neg":"neu", s.n? "Expectancy "+money(s.expectancy) : "—")}
  </section>

  <div class="card" style="margin-bottom:14px">
    <div class="card-head">
      <h2 class="card-title">Trades on this day</h2>
      <span class="card-note">${s.n} logged</span>
    </div>
    ${list.length? '<div class="tlist">'+list.map(tradeRow).join("")+'</div>' : '<div class="empty">No trades logged for this day yet.</div>'}
  </div>

  <div class="card-head" style="margin-bottom:10px">
    <h2 class="card-title">Reflection · 3 questions</h2>
    <span class="card-note" data-saved></span>
  </div>
  <div class="grid" style="grid-template-columns:1fr">
    ${Q.map((q,i)=>`
      <div class="qcard">
        <div class="qhead"><span class="qnum">${i+1}</span><span class="qtext">${esc(q)}</span></div>
        <textarea data-journal="q${i+1}" data-date="${d}" placeholder="Write honestly — this is the part that compounds.">${esc(j["q"+(i+1)]||"")}</textarea>
      </div>`).join("")}
  </div>
  <p class="hint" style="margin-top:10px">Autosaves as you type${state.session.mode==="cloud"?" and syncs to your account":" to this device"}.</p>`;
}

function tradeRow(t){
  const r = t.pnl>0?"win":t.pnl<0?"loss":"be";
  const shots = (t.shots&&(t.shots.entry||t.shots.exit))? 1 : 0;
  return `<button class="trow" data-trade="${t.id}">
    <span class="d">${dShort(t.date)}</span>
    <span>
      <span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="pair">${esc(t.pair)}</span>
        <span class="chip chip-${t.dir==='long'?'long':'short'}">${t.dir.toUpperCase()}</span>
        <span class="chip chip-${r}">${r==="win"?"WIN":r==="loss"?"LOSS":"BE"}</span>
        ${shots?`<span class="chip chip-flat">${ICON.img}</span>`:""}
      </span>
      <span class="meta">${esc(t.setup||"No setup tagged")}</span>
    </span>
    <span>
      <span class="pnl ${cls(t.pnl)}">${money(t.pnl)}</span>
      <span class="rr">${typeof t.rr==="number"? nf(t.rr,2)+"R" : "—"}</span>
    </span>
  </button>`;
}

function viewTrades(){
  const list = state.trades.slice().sort((a,b)=> ui.sort==="new"
    ? (b.date+"").localeCompare(a.date) || (b.created||0)-(a.created||0)
    : Math.abs(b.pnl)-Math.abs(a.pnl));
  const groups = {};
  list.forEach(t=>{ (groups[t.date] = groups[t.date]||[]).push(t); });
  const keys = Object.keys(groups).sort().reverse();
  const s = stats(state.trades);
  return `
  <div class="topbar">
    <div>
      <h1 class="page-title">Per-trade journal</h1>
      <p class="page-sub">${s.n} trades · net ${money(s.net)} · ${pct(s.wr)} win rate</p>
    </div>
    <div class="actions">
      <div class="seg" role="group" aria-label="Sort trades">
        <button data-sort="new" aria-pressed="${ui.sort==="new"}">Newest</button>
        <button data-sort="size" aria-pressed="${ui.sort==="size"}">Biggest</button>
      </div>
      <button class="btn btn-primary" data-act="new-trade">${ICON.plus} Log trade</button>
    </div>
  </div>
  ${keys.length? keys.map(k=>{
    const g = groups[k], net = g.reduce((a,b)=>a+b.pnl,0);
    return `<section class="daygroup">
      <div class="dayhead">
        <h3>${dLabel(k)} · ${weekday(k)}</h3>
        <span class="${cls(net)}" style="font-weight:640;font-variant-numeric:tabular-nums">${money(net)}</span>
      </div>
      <div class="tlist">${g.map(tradeRow).join("")}</div>
    </section>`;
  }).join("") : '<div class="empty">No trades yet. Hit “Log trade” to add your first one — screenshots, P&L and the three questions.</div>'}`;
}

function viewSettings(){
  const cloudReady = !!Cloud();
  const st = state.settings;
  const bytes = new Blob([JSON.stringify(state)]).size;
  return `
  <div class="topbar">
    <div><h1 class="page-title">Settings</h1><p class="page-sub">Account, sync, AI assistant and data</p></div>
  </div>
  <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:stretch">
    <div class="card">
      <div class="card-head"><h2 class="card-title">Account &amp; sync</h2><span class="card-note">${cloudReady?"Firebase configured":"Local mode"}</span></div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <span class="avatar">${esc((state.session.name||"G").slice(0,1).toUpperCase())}</span>
        <div>
          <div style="font-weight:600">${esc(state.session.name||"Guest trader")}</div>
          <div class="hint">${esc(state.session.email || "Not signed in — data stays on this device")}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${state.session.mode==="cloud"
          ? '<button class="btn" data-act="signout">'+ICON.out+' Sign out</button>'
          : '<button class="btn" data-act="goto-signin">'+ICON.cloud+' Sign in to sync</button>'}
        <button class="btn btn-ghost" data-act="export">Export JSON backup</button>
      </div>
      <p class="hint" style="margin-top:12px">Sync uses Firebase Auth + Firestore. Fill in the Firebase keys in <code>.env.local</code> (or your Vercel env vars) and every save mirrors to <code>users/{uid}/journal</code> automatically. Until then the app runs fully offline on localStorage.</p>
    </div>

    <div class="card">
      <div class="card-head"><h2 class="card-title">AI assistant</h2><span class="card-note">${st.aiMode==="proxy"?"Vercel route":"Direct key"}</span></div>
      <div class="field" style="margin-bottom:12px">
        <span class="label">Connection</span>
        <div class="seg" role="group" aria-label="AI connection mode">
          <button data-ai-mode="proxy" aria-pressed="${st.aiMode==="proxy"}">/api/ai proxy</button>
          <button data-ai-mode="direct" aria-pressed="${st.aiMode==="direct"}">Browser key</button>
        </div>
      </div>
      ${st.aiMode==="direct" ? `
        <div class="field" style="margin-bottom:12px">
          <span class="label">API key</span>
          <input type="password" data-set="aiKey" value="${esc(st.aiKey)}" placeholder="sk-…" autocomplete="off" />
          <span class="hint">Stored only in this browser. Fine for personal use, but a key in the browser is visible to anyone using the device.</span>
        </div>` : `
        <p class="hint" style="margin:0 0 12px">Recommended. Create <code>api/ai.js</code> in your Vercel project, read <code>process.env.OPENAI_API_KEY</code> there, and the app will POST <code>{ messages, context }</code> to <code>/api/ai</code>. Your key never reaches the browser.</p>`}
      <div class="field">
        <span class="label">Model</span>
        <input type="text" data-set="aiModel" value="${esc(st.aiModel)}" placeholder="gpt-4o-mini" />
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2 class="card-title">Journal preferences</h2><span class="card-note" data-saved></span></div>
      <div class="row-2">
        <div class="field">
          <span class="label">Currency</span>
          <select data-set="currency">${Object.keys(CUR).map(c=>`<option ${c===st.currency?"selected":""}>${c}</option>`).join("")}</select>
        </div>
        <div class="field">
          <span class="label">Starting balance</span>
          <input type="number" data-set="startBalance" value="${st.startBalance}" step="100" />
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2 class="card-title">Data</h2><span class="card-note">${(bytes/1024).toFixed(0)} KB stored</span></div>
      <p class="hint" style="margin:0 0 12px">Screenshots are compressed to ~1200px JPEG before saving. Browser storage caps out near 5 MB, so connect Firebase Storage if you plan to keep every chart.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost" data-act="export">Export</button>
        <button class="btn btn-danger" data-act="wipe">${ICON.trash} Clear all data</button>
      </div>
    </div>
  </div>`;
}

function viewSignin(){
  return `<div class="signin">
    <div class="signin-card">
      ${LOGO}
      <h1>Welcome back</h1>
      <p class="sub">Sign in to sync your journal across devices.</p>
      <form id="signinForm" style="display:flex;flex-direction:column;gap:12px">
        <div class="field"><span class="label">Email</span><input type="email" name="email" required placeholder="you@email.com" autocomplete="email" /></div>
        <div class="field"><span class="label">Password</span><input type="password" name="password" required placeholder="••••••••" autocomplete="current-password" /></div>
        <button class="btn btn-primary" type="submit" style="width:100%">Sign in</button>
      </form>
      <div class="divider">or</div>
      <button class="btn" style="width:100%" data-act="local-mode">Continue on this device</button>
      <p class="hint" style="margin-top:14px;text-align:center">Firebase Auth handles sign-in once you add your config. Local mode keeps everything in this browser.</p>
    </div>
  </div>`;
}

/* ---------------------------- trade modal ---------------------------- */
function tradeModal(t){
  const isNew = !t.id;
  const Q = [
    "Why did the narrative for this trade work or fail?",
    "Why did I win / lose on this coin?",
    "What can I do better next time?"
  ];
  return `<div class="scrim" data-close="1">
    <div class="modal" role="dialog" aria-modal="true" aria-label="${isNew?"Log a trade":"Edit trade"}">
      <div class="modal-head">
        <h2>${isNew?"Log a trade":esc(t.pair)+" · "+dLabel(t.date)}</h2>
        <button class="btn btn-ghost icon-btn" data-close="1" aria-label="Close">${ICON.x}</button>
      </div>
      <form class="modal-body" id="tradeForm">
        <div class="row-3">
          <div class="field"><span class="label">Date</span><input type="date" name="date" value="${t.date||todayISO()}" required /></div>
          <div class="field"><span class="label">Coin / pair</span><input type="text" name="pair" value="${esc(t.pair||"")}" placeholder="BTC/USDT" required /></div>
          <div class="field"><span class="label">Direction</span>
            <select name="dir"><option value="long" ${t.dir!=="short"?"selected":""}>Long</option><option value="short" ${t.dir==="short"?"selected":""}>Short</option></select>
          </div>
        </div>
        <div class="field"><span class="label">Setup / narrative</span><input type="text" name="setup" value="${esc(t.setup||"")}" placeholder="e.g. liquidity sweep + FVG reclaim" /></div>
        <div class="row-3">
          <div class="field"><span class="label">Entry</span><input type="number" name="entry" step="any" value="${t.entry??""}" /></div>
          <div class="field"><span class="label">Exit</span><input type="number" name="exit" step="any" value="${t.exit??""}" /></div>
          <div class="field"><span class="label">Size</span><input type="number" name="size" step="any" value="${t.size??""}" /></div>
        </div>
        <div class="row-3">
          <div class="field"><span class="label">P&L (${sym()})</span><input type="number" name="pnl" step="any" value="${t.pnl??""}" required /></div>
          <div class="field"><span class="label">R multiple</span><input type="number" name="rr" step="any" value="${t.rr??""}" placeholder="1.8" /></div>
          <div class="field"><span class="label">Fees</span><input type="number" name="fees" step="any" value="${t.fees??""}" /></div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-act="calc-pnl" style="align-self:flex-start">Auto-calc P&L from entry / exit / size</button>

        <div>
          <span class="label">Screenshots</span>
          <div class="shots" style="margin-top:8px">
            ${dropzone("entry", t.shots&&t.shots.entry, "Entry chart")}
            ${dropzone("exit", t.shots&&t.shots.exit, "Exit chart")}
          </div>
          <p class="hint" style="margin-top:8px">Click or drop an image. Paste works too (⌘/Ctrl+V).</p>
        </div>

        ${Q.map((q,i)=>`
          <div class="qcard" style="padding:14px">
            <div class="qhead"><span class="qnum">${i+1}</span><span class="qtext">${esc(q)}</span></div>
            <textarea name="q${i+1}" placeholder="Be specific — process, not outcome.">${esc(t["q"+(i+1)]||"")}</textarea>
          </div>`).join("")}
      </form>
      <div class="modal-foot">
        ${isNew?"":'<button class="btn btn-danger" data-act="delete-trade">'+ICON.trash+' Delete</button>'}
        <button class="btn btn-ghost" data-close="1">Cancel</button>
        <button class="btn btn-primary" data-act="save-trade">${isNew?"Save trade":"Save changes"}</button>
      </div>
    </div>
  </div>`;
}
function dropzone(kind, src, label){
  return `<div class="drop ${src?"has":""}" data-drop="${kind}" tabindex="0" role="button" aria-label="Add ${label}">
    <span class="shot-tag">${label}</span>
    ${src? `<img src="${src}" alt="${label} screenshot" /><button type="button" class="btn btn-ghost shot-x" data-act="rm-shot" data-kind="${kind}" aria-label="Remove ${label}">${ICON.x}</button>`
         : `<span><span style="display:block;color:var(--txt3);margin-bottom:6px">${ICON.img}</span><span class="dz-t">Add ${label.toLowerCase()}</span><span class="dz-s">PNG or JPG</span></span>`}
  </div>`;
}

/* ---------------------------- AI panel ---------------------------- */
function aiPanel(){
  if(!ui.aiOpen) return "";
  const log = ui.aiLog.length? ui.aiLog.map(m=>`<div class="bub ${m.role==="user"?"me":"ai"}">${esc(m.text)}</div>`).join("")
    : `<div class="bub ai">I can read your journal — stats, streaks, setups and your written answers. Ask me what's actually costing you money.</div>`;
  return `<aside class="ai-panel" role="dialog" aria-label="AI assistant">
    <div class="ai-head">
      <strong style="font-size:14.5px;display:flex;align-items:center;gap:7px">${ICON.spark} Journal coach</strong>
      <button class="btn btn-ghost icon-btn btn-sm" data-act="ai-close" aria-label="Close assistant">${ICON.x}</button>
    </div>
    <div class="ai-log" id="aiLog">${log}${ui.aiBusy?'<div class="bub ai" style="color:var(--txt3)">Thinking…</div>':""}</div>
    <div class="sugg">
      <button data-ask="Review my last 20 trades and name my single biggest leak.">Biggest leak</button>
      <button data-ask="Which setup has the best expectancy in my journal?">Best setup</button>
      <button data-ask="Summarise the patterns in my daily reflections this month.">Reflection patterns</button>
    </div>
    <form class="ai-in" id="aiForm">
      <textarea id="aiText" rows="1" placeholder="Ask about your trading…" aria-label="Message"></textarea>
      <button class="btn btn-primary icon-btn" type="submit" aria-label="Send">${ICON.send}</button>
    </form>
  </aside>`;
}
function aiContext(){
  const a = stats(state.trades);
  const bySetup = {};
  state.trades.forEach(t=>{ const k=t.setup||"Untagged"; (bySetup[k]=bySetup[k]||[]).push(t.pnl); });
  return {
    currency: state.settings.currency,
    allTime: { trades:a.n, net:+a.net.toFixed(2), winRate:+a.wr.toFixed(1), profitFactor: a.pf===Infinity?null:+a.pf.toFixed(2), expectancy:+a.expectancy.toFixed(2), maxDrawdown:+a.maxDD.toFixed(2), avgR: a.avgR },
    setups: Object.entries(bySetup).map(([k,v])=>({ setup:k, trades:v.length, net:+v.reduce((x,y)=>x+y,0).toFixed(2) })),
    recentTrades: state.trades.slice().sort((x,y)=>y.date.localeCompare(x.date)).slice(0,20)
      .map(t=>({ date:t.date, pair:t.pair, dir:t.dir, setup:t.setup, pnl:t.pnl, r:t.rr, why:t.q1, lesson:t.q3 })),
    recentReflections: Object.entries(state.journals).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,7)
      .map(([d,j])=>({ date:d, wrong:j.q1, why:j.q2, improve:j.q3 }))
  };
}
async function askAI(text){
  ui.aiLog.push({role:"user",text}); ui.aiBusy=true; render();
  const sys = "You are a disciplined trading-performance coach. Use only the journal data provided. Be concrete, quantitative and short (max 180 words). Point at process errors, not predictions. Never give financial advice or price targets.";
  const body = { model: state.settings.aiModel || "gpt-4o-mini", messages:[
      {role:"system", content: sys},
      {role:"system", content: "JOURNAL DATA:\n"+JSON.stringify(aiContext())},
      ...ui.aiLog.slice(-8).map(m=>({role: m.role==="user"?"user":"assistant", content:m.text}))
  ]};
  try{
    let res, out;
    if(state.settings.aiMode==="direct"){
      if(!state.settings.aiKey) throw new Error("Add your API key in Settings, or switch to the /api/ai proxy.");
      res = await fetch("https://api.openai.com/v1/chat/completions",{ method:"POST",
        headers:{ "Content-Type":"application/json", Authorization:"Bearer "+state.settings.aiKey }, body: JSON.stringify(body) });
    } else {
      res = await fetch("/api/ai",{ method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
    }
    if(!res.ok) throw new Error("Assistant endpoint returned "+res.status+". "+(state.settings.aiMode==="proxy"?"Is /api/ai deployed?":"Check your key."));
    const j = await res.json();
    out = j.reply || (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "No response.";
    ui.aiLog.push({role:"ai", text: out.trim()});
  }catch(e){
    ui.aiLog.push({role:"ai", text:"⚠️ "+e.message});
  }
  ui.aiBusy=false; render();
}

/* ---------------------------- render ---------------------------- */
const NAV = [
  {id:"dashboard", label:"Dashboard", icon:ICON.dash},
  {id:"daily", label:"Daily journal", icon:ICON.daily},
  {id:"trades", label:"Trades", icon:ICON.trades},
  {id:"settings", label:"Settings", icon:ICON.set}
];
function render(){
  const root = document.getElementById("root");
  if(route==="signin"){ root.innerHTML = viewSignin(); wire(); return; }
  const body = route==="daily" ? viewDaily() : route==="trades" ? viewTrades() : route==="settings" ? viewSettings() : viewDashboard();
  root.innerHTML = `
  <div class="app">
    <aside class="sidebar">
      <div class="brand">${LOGO}<div><div class="brand-name">Ledger</div><div class="brand-sub">Trading journal</div></div></div>
      <nav class="nav" aria-label="Main">
        ${NAV.map(n=>`<button class="nav-btn" data-nav="${n.id}" aria-current="${route===n.id}">${n.icon}<span>${n.label}</span></button>`).join("")}
      </nav>
      <div class="side-foot">
        <button class="nav-btn" data-act="ai-open">${ICON.spark}<span>Ask AI</span></button>
        <button class="btn btn-primary" data-act="new-trade" style="width:100%">${ICON.plus} Log trade</button>
        <div class="acct">
          <span class="avatar">${esc((state.session.name||"G").slice(0,1).toUpperCase())}</span>
          <div style="min-width:0">
            <div class="acct-name">${esc(state.session.name||"Guest trader")}</div>
            <div class="acct-mode">${state.session.mode==="cloud"?"Synced":"Local device"}</div>
          </div>
        </div>
      </div>
    </aside>
    <main>
      <div class="mobile-top">
        <div class="brand" style="padding:0">${LOGO}<div class="brand-name">Ledger</div></div>
        <span style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" data-act="ai-open" aria-label="Ask AI">${ICON.spark}</button>
          <button class="btn btn-ghost btn-sm" data-nav="settings" aria-label="Settings">${ICON.set}</button>
        </span>
      </div>
      ${body}
    </main>
  </div>
  <nav class="tabbar" aria-label="Sections">
    ${NAV.map(n=>`<button data-nav="${n.id}" aria-current="${route===n.id}">${n.icon}<span>${n.label.split(" ")[0]}</span></button>`).join("")}
  </nav>
  ${aiPanel()}
  ${ui.editing? tradeModal(ui.editing) : ""}`;
  wire();
}

/* ---------------------------- events ---------------------------- */
function wire(){
  document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>{ route=b.dataset.nav; location.hash=route; window.scrollTo(0,0); render(); });
  const ms = document.getElementById("monthSel"); if(ms) ms.onchange = e => { ui.month = e.target.value; render(); };
  const dp = document.getElementById("dayPick"); if(dp) dp.onchange = e => { ui.day = e.target.value; render(); };
  document.querySelectorAll("[data-sort]").forEach(b=>b.onclick=()=>{ ui.sort=b.dataset.sort; render(); });
  document.querySelectorAll("[data-trade]").forEach(b=>b.onclick=()=>{ ui.editing = structuredClone(state.trades.find(t=>t.id===b.dataset.trade)); render(); });

  document.querySelectorAll("[data-journal]").forEach(el=>{
    el.oninput = () => {
      const d = el.dataset.date;
      const j = state.journals[d] = state.journals[d] || {q1:"",q2:"",q3:""};
      j[el.dataset.journal] = el.value; j.updatedAt = Date.now();
      clearTimeout(el._t); el._t = setTimeout(()=>save(), 600);
    };
  });
  document.querySelectorAll("[data-set]").forEach(el=>{
    el.onchange = () => {
      const k = el.dataset.set;
      state.settings[k] = el.type==="number" ? Number(el.value) : el.value;
      save(); render();
    };
  });
  document.querySelectorAll("[data-ai-mode]").forEach(b=>b.onclick=()=>{ state.settings.aiMode=b.dataset.aiMode; save(true); render(); });
  document.querySelectorAll("[data-ask]").forEach(b=>b.onclick=()=>askAI(b.dataset.ask));

  const af = document.getElementById("aiForm");
  if(af) af.onsubmit = e => { e.preventDefault(); const t=document.getElementById("aiText"); const v=t.value.trim(); if(!v) return; t.value=""; askAI(v); };
  const log = document.getElementById("aiLog"); if(log) log.scrollTop = log.scrollHeight;

  const sf = document.getElementById("signinForm");
  if(sf) sf.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(sf), email = fd.get("email");
    const c = Cloud();
    if(c){ try{ const u = await c.signIn(email, fd.get("password")); state.session={mode:"cloud",email:u.email,name:u.displayName||email.split("@")[0]};
            const remote = await c.load(); if(remote){ state.trades=remote.trades||state.trades; state.journals=remote.journals||state.journals; } }
          catch(err){ toast(err.message||"Sign-in failed"); return; } }
    else { state.session = {mode:"local", email, name:String(email).split("@")[0]}; toast("Firebase not configured — running locally"); }
    save(true); route="dashboard"; location.hash=route; render();
  };

  document.querySelectorAll("[data-drop]").forEach(z=>{
    const kind = z.dataset.drop;
    const pick = () => {
      const inp = document.createElement("input"); inp.type="file"; inp.accept="image/*";
      inp.onchange = () => inp.files[0] && addShot(kind, inp.files[0]);
      inp.click();
    };
    z.onclick = e => { if(e.target.closest('[data-act="rm-shot"]')) return; pick(); };
    z.onkeydown = e => { if(e.key==="Enter"||e.key===" "){ e.preventDefault(); pick(); } };
    z.ondragover = e => { e.preventDefault(); z.classList.add("over"); };
    z.ondragleave = () => z.classList.remove("over");
    z.ondrop = e => { e.preventDefault(); z.classList.remove("over"); const f=e.dataTransfer.files[0]; if(f) addShot(kind,f); };
  });

  document.querySelectorAll("[data-act]").forEach(b=>{ b.onclick = e => act(b.dataset.act, b, e); });
  document.querySelectorAll("[data-close]").forEach(el=>{
    el.onclick = e => { if(e.target!==el) return; ui.editing=null; render(); };
  });
}

function act(a, el, ev){
  if(ev) ev.preventDefault();
  switch(a){
    case "new-trade": ui.editing = { date: ui.day || todayISO(), dir:"long", shots:{entry:null,exit:null} }; render(); break;
    case "ai-open": ui.aiOpen=true; render(); break;
    case "ai-close": ui.aiOpen=false; render(); break;
    case "goto-signin": route="signin"; location.hash=route; render(); break;
    case "local-mode": state.session={mode:"local",email:"",name:"Guest trader"}; save(true); route="dashboard"; location.hash=route; render(); break;
    case "signout": { const c=Cloud(); if(c) c.signOut(); state.session={mode:"local",email:"",name:"Guest trader"}; save(true); render(); toast("Signed out"); break; }
    case "calc-pnl": {
      const f = document.getElementById("tradeForm"); if(!f) break;
      const en=+f.entry.value, ex=+f.exit.value, sz=+f.size.value, dir=f.dir.value;
      if(!en||!ex||!sz){ toast("Fill entry, exit and size first"); break; }
      const pnl = (dir==="long" ? (ex-en) : (en-ex)) * sz - (+f.fees.value||0);
      f.pnl.value = Math.round(pnl*100)/100; toast("P&L calculated"); break;
    }
    case "rm-shot": { const k=el.dataset.kind; ui.editing.shots[k]=null; render(); break; }
    case "save-trade": saveTrade(); break;
    case "delete-trade": {
      if(!confirm("Delete this trade permanently?")) break;
      state.trades = state.trades.filter(t=>t.id!==ui.editing.id); ui.editing=null; save(true); render(); toast("Trade deleted"); break;
    }
    case "export": {
      const blob = new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
      const url = URL.createObjectURL(blob), a2=document.createElement("a");
      a2.href=url; a2.download="ledger-backup-"+todayISO()+".json"; a2.click(); URL.revokeObjectURL(url); break;
    }
    case "wipe": {
      if(!confirm("This clears every trade, journal entry and screenshot on this device. Continue?")) break;
      localStorage.removeItem(KEY); state = structuredClone(DEFAULT_STATE); state.seeded=true; save(true); render(); toast("All data cleared"); break;
    }
  }
}

function saveTrade(){
  const f = document.getElementById("tradeForm"); if(!f) return;
  if(!f.pair.value.trim() || f.pnl.value===""){ toast("Pair and P&L are required"); return; }
  const t = ui.editing;
  const rec = {
    id: t.id || uid(),
    created: t.created || Date.now(),
    date: f.date.value || todayISO(),
    pair: f.pair.value.trim().toUpperCase(),
    dir: f.dir.value,
    setup: f.setup.value.trim(),
    entry: f.entry.value===""?null:+f.entry.value,
    exit: f.exit.value===""?null:+f.exit.value,
    size: f.size.value===""?null:+f.size.value,
    pnl: +f.pnl.value,
    rr: f.rr.value===""?null:+f.rr.value,
    fees: f.fees.value===""?null:+f.fees.value,
    q1: f.q1.value, q2: f.q2.value, q3: f.q3.value,
    shots: t.shots || {entry:null,exit:null}
  };
  const i = state.trades.findIndex(x=>x.id===rec.id);
  if(i>=0) state.trades[i]=rec; else state.trades.push(rec);
  ui.day = rec.date; ui.month = monthKey(rec.date); ui.editing=null;
  save(true); render(); toast(i>=0?"Trade updated":"Trade logged");
}

function addShot(kind, file){
  if(!file.type.startsWith("image/")){ toast("Images only"); return; }
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 1200, sc = Math.min(1, max/Math.max(img.width,img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width*sc); c.height = Math.round(img.height*sc);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      ui.editing.shots = ui.editing.shots || {entry:null,exit:null};
      ui.editing.shots[kind] = c.toDataURL("image/jpeg", 0.72);
      render();
    };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}

/* paste screenshots straight into the open modal */
document.addEventListener("paste", e => {
  if(!ui.editing) return;
  const it = [...(e.clipboardData?.items||[])].find(i=>i.type.startsWith("image/"));
  if(!it) return;
  const target = ui.editing.shots && ui.editing.shots.entry ? "exit" : "entry";
  addShot(target, it.getAsFile());
  toast("Screenshot added as "+target);
});
document.addEventListener("keydown", e => {
  if(e.key==="Escape"){ if(ui.editing){ ui.editing=null; render(); } else if(ui.aiOpen){ ui.aiOpen=false; render(); } }
  if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==="k"){ e.preventDefault(); act("new-trade"); }
});
window.addEventListener("hashchange", ()=>{ const r=location.hash.replace("#","")||"dashboard"; if(r!==route){ route=r; render(); } });
let rt=null;
window.addEventListener("resize", ()=>{ clearTimeout(rt); rt=setTimeout(()=>{}, 200); });

/* cloud user listener, if a Firebase adapter is present */
function initCloud(){
  const c = Cloud();
  if(!c || !c.onUser) return;
  c.onUser(async u => {
    if(!u){ state.session={mode:"local",email:"",name:"Guest trader"}; render(); return; }
    state.session={mode:"cloud", email:u.email, name:u.displayName||u.email.split("@")[0]};
    try{ const remote = await c.load(); if(remote){ state.trades=remote.trades||state.trades; state.journals=remote.journals||state.journals; } }catch(e){}
    save(true); render();
  });
}
initCloud();
window.addEventListener("ledger-cloud-ready", initCloud);

render();
