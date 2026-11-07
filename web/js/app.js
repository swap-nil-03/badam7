
const VER='1.2.0',SY={S:'♠\uFE0E',H:'♥\uFE0E',D:'♦\uFE0E',C:'♣\uFE0E'},RK=['','A','2','3','4','5','6','7','8','9','10','J','Q','K'],ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
let gid=localStorage.gid;if(!gid){gid=[...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join('');localStorage.gid=gid}
let nick=localStorage.nick||'',S=null,view='home',rounds=5,qn=0,conn='connecting',failed=false,cd=15,cdT=null,onl=0,info=null,mute=localStorage.mute==='1',ac;
let chat=[],unread=0,ment=false,chatOpen=false,vs=null,peers={},vOn=false,vMute=false,speak={};
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const socket=io({reconnection:true,reconnectionDelay:1000,reconnectionDelayMax:4000,reconnectionAttempts:Infinity});
const toast=m=>{const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(t._t);t._t=setTimeout(()=>t.style.display='none',2500)};
const emit=(e,d,cb)=>socket.emit(e,d||{},r=>{if(r&&r.error)toast(r.error);else cb&&cb(r)});
function beep(f){if(mute)return;try{ac=ac||new AudioContext();const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=f;g.gain.value=.05;o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+.1)}catch(e){}}
// ---- connection: socket.io auto-reconnect + popup (after 2.5s grace) with 15s countdown and manual retry
let graceT=null,why='';
function modal(){const m=$('#modal');if(!failed||conn==='connected'){m.innerHTML='';return}
  m.innerHTML=`<div class="ov"><div class="box" style="text-align:center"><h2>⚠ Server Disconnected</h2><p>${conn==='connecting'?'Connecting…':`Reconnecting automatically in <b>${cd}</b>s`}</p><p style="font-size:.85rem;opacity:.8">Your seat, hand and score are kept.${why?'<br>('+esc(why)+')':''}</p><button onclick="tryNow()">Try connecting again</button></div></div>`}
function lost(r){why=r||why;if(conn==='disconnected')return;conn='disconnected';cd=15;clearTimeout(graceT);
  graceT=setTimeout(()=>{if(conn==='connected')return;failed=true;clearInterval(cdT);cdT=setInterval(()=>{if(--cd<=0){cd=15;socket.connect()}modal()},1000);modal()},2500);render()}
function tryNow(){cd=15;conn='connecting';modal();socket.disconnect();socket.connect()}
socket.on('connect',()=>{clearTimeout(graceT);clearInterval(cdT);conn='connected';failed=false;why='';modal();reg();render()});
socket.on('disconnect',r=>{console.warn('disconnected:',r);lost(r)});socket.on('connect_error',e=>{conn='x';lost(e.message)});
const reg=()=>nick&&socket.emit('register',{gid,nick},r=>{if(r.error)toast(r.error);render()});
// ---- state
socket.on('state',s=>{const p=S;if(!p||p.code!==s.code){chat=[];unread=0;ment=false}S=s;S._t0=Date.now();
  if(p&&p.turn!==s.turn&&s.turn===gid)beep(660);if(p&&s.last&&(!p.last||p.last.text!==s.last.text))beep(440);if(p&&p.phase!=s.phase&&s.phase!='playing')beep(880);
  for(const id in peers)if(!s.voice.includes(id))dropPeer(id);render()});
socket.on('left',()=>{S=null;view='home';voiceStop(true);render()});
socket.on('queue',n=>{qn=n;render()});socket.on('online',n=>{onl=n});
// ---- chat
function chatToggle(o){chatOpen=o===undefined?!chatOpen:o;$('#chat').classList.toggle('open',chatOpen);if(chatOpen){unread=0;ment=false;badge();setTimeout(()=>{$('#msgs').scrollTop=1e9},50)}}
const badge=()=>{$('#cb').textContent=unread||'';$('#cb').className=ment?'red':''};
const hl=t=>t.replace(/(@[\p{L}\p{N}_.-]+)/gu,'<span class="mt">$1</span>');
function msgs(){$('#msgs').innerHTML=chat.map(m=>`<div class="m ${m.id===gid?'mine':''} ${m.mentions.includes(gid)?'ment':''}"><small>${esc(m.avatar)} ${esc(m.nick)}</small>${hl(esc(m.text))}</div>`).join('');$('#msgs').scrollTop=1e9}
socket.on('chatHistory',h=>{chat=h;msgs()});
socket.on('chat',m=>{chat.push(m);msgs();if(m.id!==gid){const me=m.mentions.includes(gid);if(me){toast('🔔 '+m.nick+' mentioned you: '+m.text.slice(0,60));beep(990)}if(!chatOpen){unread++;if(me)ment=true;badge()}}});
function sendChat(){const i=$('#ci');if(!i.value.trim())return;emit('chat',{text:i.value});i.value=''}
$('#ci').addEventListener('keydown',e=>{if(e.key==='Enter')sendChat()});
function ins(id){const p=S.players.find(p=>p.id===id);$('#ci').value+='@'+p.nick+' ';$('#ci').focus()}
let sx=0;$('#chat').addEventListener('touchstart',e=>sx=e.touches[0].clientX,{passive:true});$('#chat').addEventListener('touchend',e=>{if(e.changedTouches[0].clientX-sx>60)chatToggle(false)});
// ---- voice (WebRTC mesh, signaling via Socket.IO, free Google STUN)
async function voiceToggle(){if(vOn)return voiceStop();
  if(!navigator.mediaDevices?.getUserMedia)return toast('Microphone needs HTTPS or localhost (browsers block it on plain http LAN addresses)');
  try{vs=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){return toast('Microphone blocked. Allow microphone access in browser/site settings, then try again.')}
  vOn=true;vMute=false;watch(vs,gid);emit('voiceJoin',{},r=>{r.peers.forEach(call)});render()}
function mk(id){const pc=new RTCPeerConnection(ICE);peers[id]=pc;vs.getTracks().forEach(t=>pc.addTrack(t,vs));
  pc.onicecandidate=e=>e.candidate&&socket.emit('rtc',{to:id,data:{c:e.candidate}});
  pc.ontrack=e=>{let a=document.getElementById('a'+id);if(!a){a=document.createElement('audio');a.id='a'+id;a.autoplay=true;a.playsInline=true;document.body.appendChild(a)}a.srcObject=e.streams[0];watch(e.streams[0],id)};return pc}
async function call(id){const pc=mk(id);await pc.setLocalDescription(await pc.createOffer());socket.emit('rtc',{to:id,data:{d:pc.localDescription}})}
socket.on('rtc',async({from,data})=>{if(!vOn)return;const pc=peers[from]||mk(from);
  if(data.d){await pc.setRemoteDescription(data.d);if(data.d.type==='offer'){await pc.setLocalDescription(await pc.createAnswer());socket.emit('rtc',{to:from,data:{d:pc.localDescription}})}}
  else if(data.c){try{await pc.addIceCandidate(data.c)}catch(e){}}});
socket.on('voiceLeft',dropPeer);
function dropPeer(id){peers[id]?.close();delete peers[id];document.getElementById('a'+id)?.remove();speak[id]=false;mark(id)}
function voiceStop(local){if(!vOn)return;vOn=false;vs?.getTracks().forEach(t=>t.stop());vs=null;Object.keys(peers).forEach(dropPeer);speak={};if(!local)socket.emit('voiceLeave',{});render()}
function voiceMute(){vMute=!vMute;vs.getAudioTracks()[0].enabled=!vMute;render()}
function mark(id){document.querySelector(`[data-p="${id}"]`)?.classList.toggle('sp',!!speak[id])}
function watch(st,id){try{ac=ac||new AudioContext();const a=ac.createAnalyser(),b=new Uint8Array(a.frequencyBinCount);ac.createMediaStreamSource(st).connect(a);
  const iv=setInterval(()=>{if(id!==gid&&!peers[id]||id===gid&&!vOn){clearInterval(iv);return}a.getByteFrequencyData(b);const v=b.reduce((x,y)=>x+y,0)/b.length>18&&!(id===gid&&vMute);if(v!==!!speak[id]){speak[id]=v;mark(id)}},200)}catch(e){}}
// ---- timer bar
setInterval(()=>{if(!S||(S.phase!=='playing'&&S.phase!=='roundEnd'))return;const r=Math.max(0,S.timeLeft-(Date.now()-S._t0)),b=$('#tbar'),t=$('#tsec');if(b){b.style.width=Math.min(100,r/200)+'%';b.style.background=r<5000?'#e33':'#3d6'}if(t)t.textContent=Math.ceil(r/1000)+'s';const n=$('#nsec');if(n)n.textContent=Math.ceil(r/1000)},250);
function copyText(t){const done=()=>toast('Copied: '+t.slice(0,40));
  const fb=()=>{const a=document.createElement('textarea');a.value=t;a.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.appendChild(a);a.focus();a.select();a.setSelectionRange(0,t.length);let ok=false;try{ok=document.execCommand('copy')}catch(e){}a.remove();ok?done():prompt('Copy this:',t)};
  if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(t).then(done,fb);else fb()} // clipboard API needs HTTPS; fallback works on http LAN
// ---- UI
const card=(c,cls='')=>`<div class="card ${'HD'.includes(c.s)?'red':''} ${cls}" data-s="${c.s}" data-r="${c.r}">${RK[c.r]}<span>${SY[c.s]}</span></div>`;
const nm=id=>esc(S.players.find(p=>p.id===id)?.nick||'?');
function render(){
  const a=$('#app');modal();$('#cbtn').style.display=S?'block':'none';
  if(!S||S.phase==='lobby'){$('#hand')?.remove()}
  if(!S&&chatOpen)chatToggle(false);
  if(!nick){a.innerHTML=`<h1>♠ BADAM 7 ♥</h1><div class="box"><p>Welcome! Pick a nickname to play as a guest.</p><input id=n maxlength=16 placeholder="Nickname"><button onclick="setNick()">Continue</button></div>`;return}
  if(S)return room(a);
  if(view==='queue'){a.innerHTML=`<h1>Searching…</h1><div class="box big">🃏</div><p style="text-align:center">${qn} player(s) waiting. Game starts when 2+ are found (max 7).</p><button class=alt onclick="emit('cancelSearch');view='home';render()">Cancel</button>`;return}
  if(view==='rules'){a.innerHTML=`<h1>Rules</h1><div class="box"><p>2–7 players, 52 cards dealt evenly (extra cards go to the first seats). The holder of 7♥ starts and must play it first. A 7 opens a suit; then extend that suit with the next lower or higher card. If you have a playable card you must play one; if you have none, press Pass. You have 20 seconds per turn, otherwise a random legal card is played for you. First to empty their hand wins the round with 0 penalty; others score the sum of remaining cards (A=1, J=11, Q=12, K=13). Lowest total after 5 or 7 rounds wins.</p></div><button onclick="view='home';render()">Back</button>`;return}
  if(view==='stats'){const s=info;a.innerHTML=`<h1>Profile</h1><div class="box">${s?`<p>${s.p.avatar} <b>${esc(s.p.nick)}</b></p><p>Games: ${s.p.games} · Wins: ${s.p.wins} (${s.winPct}%)<br>Rounds: ${s.p.rounds} · Avg penalty/round: ${s.avg}<br>Best match: ${s.p.best??'–'} · Joined ${s.p.created.slice(0,10)}</p>`:'Loading…'}</div><h2>Leaderboard</h2><div class="box" id=lb>Loading…</div><button onclick="view='home';render()">Back</button>`;
    emit('leaderboard',{},r=>{const e=$('#lb');if(e)e.innerHTML='<table><tr><th>#<th>Player<th>Games<th>Wins<th>Win%</tr>'+r.rows.map((x,i)=>`<tr><td>${i+1}<td>${x.avatar} ${esc(x.nick)}<td>${x.games}<td>${x.wins}<td>${Math.round(100*x.wins/x.games)}</tr>`).join('')+'</table>'});return}
  a.innerHTML=`<div class="bar"><span>${conn==='connected'?'🟢 Connected':'🟠 '+conn}</span><span>${onl?onl+' online':''}</span></div><h1>♠ BADAM 7 ♥</h1><p style="text-align:center">Hi, <b>${esc(nick)}</b> <a href="#" onclick="chNick();return false" style="color:var(--gold)">change</a></p>
  <p style="margin:8px 0 0;text-align:center">Rounds per match</p><div class="row">${[1,2,5,7].map(n=>`<button class="${rounds==n?'':'alt'}" onclick="rounds=${n};render()">${n}</button>`).join('')}</div>
  <button onclick="emit('findPlayers',{rounds},()=>{view='queue';render()})">▶ Play Online / Find Players</button>
  <button class=alt onclick="emit('createRoom',{rounds})">Create Private Room</button>
  <div class="row"><input id=c maxlength=6 placeholder="ROOM CODE" style="text-transform:uppercase"><button class=alt onclick="emit('joinRoom',{code:$('#c').value})">Join</button></div>
  <div class="row"><button class=alt onclick="info=null;view='stats';emit('stats',{},r=>{info=r;render()});render()">Profile & Leaderboard</button><button class=alt onclick="view='rules';render()">Rules</button></div><p style="text-align:center;font-size:.8rem;opacity:.6">v${VER}</p>`}
function setNick(){const v=$('#n').value.trim();if(!v)return toast('Enter a nickname');nick=v;localStorage.nick=v;reg();render()}
function chNick(){const v=prompt('New nickname',nick);if(v&&v.trim()){nick=v.trim();localStorage.nick=nick;reg();render()}}
function leave(){if(confirm('Leave this game?'))emit('leave')}
function topBar(){return `<div class="bar"><span>${conn==='connected'?'🟢':'🟠'} Room ${S.code} · Round ${Math.max(S.round,1)}/${S.rounds}</span><span style="display:flex;gap:6px">
  <button class="sm alt" onclick="voiceToggle()">🎤 ${vOn?'Leave voice':'Voice'}</button>${vOn?`<button class="sm alt" onclick="voiceMute()">${vMute?'🔇 Unmute':'🎙 Mute'}</button>`:''}
  <button class="sm alt" onclick="localStorage.mute=(mute=!mute)?1:'';render()">${mute?'🔇':'🔊'}</button><button class="sm" style="background:#a33;color:#fff" onclick="leave()">Leave</button></span></div>
  <div class="pl">${S.players.map(p=>`<div data-p="${p.id}" class="p ${p.id===S.turn?'t':''} ${p.online?'':'off'} ${speak[p.id]?'sp':''}">${p.avatar} ${p.id===S.host?'👑':''}${S.voice.includes(p.id)?'🎤':''}<br><b>${esc(p.nick)}</b><br><span class=dot></span> ${p.score} pts${S.round?' · '+p.cards+' cards':''}</div>`).join('')}</div>`}
function share(){const m=`Join my Badam 7 game! Room code: ${S.code} ${location.origin}`;navigator.share?navigator.share({text:m}).catch(()=>{}):copyText(m)}
function room(a){
  const amHost=S.host===gid;$('#chips').innerHTML=S.players.filter(p=>p.id!==gid).map(p=>`<span class="chipb" onclick="ins('${p.id}')">@${esc(p.nick)}</span>`).join('');
  if(S.phase==='lobby'){a.innerHTML=topBar()+`<h1>Lobby</h1><div class="box" style="text-align:center">Room code<div class="big" style="letter-spacing:6px">${S.code}</div>${S.players.length}/7 players · ${S.rounds} rounds
  <div class=row><button class=alt onclick="copyText('${S.code}')">Copy Code</button><button class=alt onclick="share()">Share</button></div></div>
  ${amHost?`<button ${S.players.length<2?'disabled':''} onclick="emit('startGame')">Start Game</button>`:'<p style="text-align:center">Waiting for the host…</p>'}`;return}
  const myTurn=S.turn===gid&&S.phase==='playing',legal=new Set(S.legal.map(c=>c.s+c.r));
  let t=topBar()+`<div class="tbl">${['S','H','D','C'].map(s=>{const b=S.board[s],r='HD'.includes(s)?'red':'';let l='';if(b)for(let i=b.lo;i<=b.hi;i++)l+=`<div class="chip ${r}">${RK[i]}</div>`;return `<div class="col"><b class="${r}">${SY[s]}</b>${l}</div>`}).join('')}</div>
  <div class="box">${S.last?esc(S.last.text):''}<br><b>${S.phase==='playing'?(myTurn?'👉 Your turn — play a highlighted card':nm(S.turn)+"'s turn"):''}</b>${S.phase==='playing'?`<div class="tb"><i id="tbar"></i></div><div style="text-align:right" id="tsec"></div>`:''}</div>
  ${myTurn&&!legal.size?`<button style="background:#e33;color:#fff;font-size:1.3rem;padding:20px" onclick="emit('pass')">PASS — no playable card</button>`:''}`;
  if(S.phase==='roundEnd'||S.phase==='final'){const fin=S.phase==='final',mn=Math.min(...S.players.map(p=>p.score)),w=S.players.filter(p=>p.score===mn);
    t+=`<div class="ov"><div class="box" style="max-height:92vh;overflow:auto">${fin?`<div class="big">🏆</div><h2 style="text-align:center">${w.map(p=>p.avatar+' '+esc(p.nick)).join(' & ')} wins!</h2>`:`<h2>Round ${S.round} winner: ${nm(S.res.winner)}</h2>`}
    <table><tr><th>Player<th>Round<th>Total</tr>${[...S.players].sort((x,y)=>x.score-y.score).map(p=>`<tr><td>${p.avatar} ${esc(p.nick)}<td>+${S.res.pen[p.id]}<td><b>${p.score}</b></tr>`).join('')}</table>
    ${fin?`<p style="font-size:.85rem">Per round: ${S.players.map(p=>esc(p.nick)+' '+S.hist.map(h=>h[S.players.indexOf(p)]).join('/')).join(' · ')}</p>`:''}
    ${fin?(amHost?`<button onclick="emit('playAgain')">Play Again</button>`:'<p>Waiting for host…</p>'):`<p style="text-align:center">Next round starts in <b id="nsec">10</b>s</p>${amHost?`<button onclick="emit('nextRound')">Start now</button>`:''}`}
    <button class=alt onclick="emit('leave')">${fin?'Return to Home':'Leave match'}</button></div></div>`}
  a.innerHTML=t;
  let h=$('#hand');if(!h){h=document.createElement('div');h.id='hand';document.body.appendChild(h);h.onclick=e=>{const c=e.target.closest('.card');if(!c)return;if(S.turn!==gid||S.phase!=='playing')return toast('Not your turn');if(!c.classList.contains('ok'))return toast('That card cannot be played');beep(520);emit('play',{s:c.dataset.s,r:+c.dataset.r})}}
  h.innerHTML=[...S.hand].sort((x,y)=>'SHDC'.indexOf(x.s)-'SHDC'.indexOf(y.s)||x.r-y.r).map(c=>card(c,legal.has(c.s+c.r)?'ok':myTurn?'dim':'')).join('')||'<span>No cards</span>'}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!socket.connected&&conn!=='connecting')tryNow()});
render();
