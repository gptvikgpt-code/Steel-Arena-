
import {createGraphics} from './graphics.js';
const $=id=>document.getElementById(id);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const classes={
 ronin:{id:'ronin',name:'РОНИН',color:0x8a3548,trim:0xf4b865,skin:0xeab28c,speed:5.1,power:1.06,range:2.4,special:'Лунный разрез'},
 knight:{id:'knight',name:'СТРАЖ',color:0x406ab1,trim:0xe4c17b,skin:0xf4c49c,metal:0xcad4dc,speed:4.3,power:1.0,range:2.25,special:'Железный натиск'},
 ninja:{id:'ninja',name:'ТЕНЬ',color:0x393d62,trim:0x6be0d8,skin:0xe2b397,speed:6.8,power:.82,range:1.9,special:'Теневой рывок'},
 mage:{id:'mage',name:'АРКАНИСТ',color:0x653c9c,trim:0x7be4ff,skin:0xeac69d,speed:4.5,power:.93,range:2.1,special:'Звёздный импульс'},
 brute:{id:'brute',name:'ТИТАН',color:0x9b4c36,trim:0xf9cf78,skin:0xc98e70,speed:3.6,power:1.35,range:1.95,special:'Землетрясение'},
 lancer:{id:'lancer',name:'КОПЕЙЩИК',color:0x2d827a,trim:0xc2e899,skin:0xedb48b,speed:4.8,power:.98,range:3.45,special:'Прокол небес'}
};
const gfx=createGraphics($('scene'));
const controls=['left','right','jump','light','heavy','block','dash','special','super'];
const input=Object.fromEntries(controls.map(x=>[x,false]));
let role='menu',peer=null,connection=null,remoteInput={},networkTick=0;
let choice='ronin',arena='temple',mode='duel',players=[],match=null,lastFx=0,noticeDeadline=0,worldTime=0;
const MAX_ROUND_TIME=90;
const copyState=()=>Object.fromEntries(controls.map(k=>[k,!!input[k]]));
const names={left:'A / ←',right:'D / →',jump:'W / ↑',light:'J',heavy:'K',block:'S',dash:'Shift',special:'L',super:'P'};
function select(which,value){
 if(which==='hero')choice=value;
 if(which==='mode')mode=value;
 if(which==='arena')arena=value;
 document.querySelectorAll('[data-pick]').forEach(el=>el.classList.toggle('selected',el.dataset.pick===which&&el.dataset.value===value||el.dataset.pick!==which&&el.classList.contains('selected')));
 if(role==='menu'){gfx.setStage(arena,mode,[classes[choice],classes.knight]);}
}
for(const b of document.querySelectorAll('[data-pick]')){
 b.addEventListener('click',()=>select(b.dataset.pick,b.dataset.value));
}
function freshFighter(id,style,x,dir){
 return {id,style,x,y:0,vx:0,vy:0,dir,hp:100,chi:0,grounded:true,jumps:0,prevJump:false,block:false,parry:0,
 hitstun:0,invuln:0,dashTimer:0,dashCool:0,attack:null,attackCool:0,specialCool:0,superCool:0,combo:0,comboClock:0,prevBlock:false};
}
function announce(text,seconds=1.2){const el=$('announce');el.textContent=text;el.classList.add('visible');noticeDeadline=performance.now()+seconds*1000;}
function flash(intensity=.3){const f=$('flash');f.style.opacity=String(intensity);setTimeout(()=>f.style.opacity='0',80)}
function currentStyles(){return [classes[players[0]?.style]||classes.ronin,classes[players[1]?.style]||classes.knight]}
function enterFight(){
 $('menu').classList.add('hidden');$('result-screen').classList.add('hidden');document.body.classList.add('fight');
 $('hint').textContent=role==='solo'?'ТРЕНИРОВКА ПРОТИВ БОТА':role==='host'?'ОНЛАЙН • ВЫ ХОЗЯИН КОМНАТЫ':'ОНЛАЙН • ВЫ ГОСТЬ';
 gfx.setStage(arena,mode,currentStyles());
}
function newMatch(p1=choice,p2='knight'){
 players=[freshFighter(0,p1,-3.5,1),freshFighter(1,p2,3.5,-1)];
 match={phase:'intro',delay:1.65,round:1,time:MAX_ROUND_TIME,scores:[0,0],winner:null,event:null,eventId:0};
 lastFx=0;enterFight();updateHUD();announce('ПРИГОТОВИТЬСЯ',1.3);
}
function nextRound(){
 const s1=players[0].style,s2=players[1].style;
 players=[freshFighter(0,s1,-3.5,1),freshFighter(1,s2,3.5,-1)];
 match.round++;match.time=MAX_ROUND_TIME;match.phase='intro';match.delay=1.4;
 announce('РАУНД '+match.round,1.1);
}
function endRound(winner){
 if(match.phase!=='fight')return;
 match.scores[winner]++;match.winner=winner;
 announce(winner===0?'ПЕРВЫЙ ПОБЕДИЛ':'ВТОРОЙ ПОБЕДИЛ',1.6);
 match.phase=match.scores[winner]>=2?'finished':'intermission';match.delay=2.6;
 if(match.phase==='finished')setTimeout(()=>{if(match?.phase==='finished')showResult()},1250);
}
function showResult(){
 const won=match.winner;
 $('winner-text').textContent=role==='solo'?(won===0?'ПОБЕДА!':'ПОРАЖЕНИЕ'):(role==='guest'?(won===1?'ПОБЕДА!':'ПОРАЖЕНИЕ'):(won===0?'ПОБЕДА!':'ПОРАЖЕНИЕ'));
 $('score-text').textContent='Счёт по раундам: '+match.scores.join(' : ');
 $('result-screen').classList.remove('hidden');
}
function damageMove(kind,c){
 if(kind==='light')return {kind,duration:.38,start:.09,active:.14,dmg:8*c.power,range:c.range,knock:3.2,cost:0};
 if(kind==='heavy')return {kind,duration:.69,start:.26,active:.14,dmg:15*c.power,range:c.range+.16,knock:6.3,cost:0};
 if(kind==='special')return {kind,duration:.82,start:.2,active:.27,dmg:16*c.power,range:c.id==='mage'?5:c.id==='lancer'?4.5:c.range+1.3,knock:7.4,cost:24};
 return {kind:'super',duration:1.1,start:.29,active:.26,dmg:33*c.power,range:5.4,knock:11,cost:65};
}
function performAttack(f,kind){
 const c=classes[f.style];if(f.attack||f.hitstun>0||f.attackCool>0)return;
 if(kind==='special'&&(f.chi<24||f.specialCool>0))return;
 if(kind==='super'&&(f.chi<65||f.superCool>0))return;
 f.attack={...damageMove(kind,c),remaining:damageMove(kind,c).duration,hit:false};
 f.attackCool=kind==='light'?.13:kind==='heavy'?.32:kind==='special'?.45:.8;
 if(kind==='special'){f.specialCool=1.9;f.chi-=24;if(c.id==='ninja')f.x=clamp(f.x+f.dir*1.4,-9,9)}
 if(kind==='super'){f.superCool=3.8;f.chi-=65;announce(c.name+' • СУПЕР!',.75);flash(.3)}
}
function impact(f,other,attack,blocked,parried){
 const isSuper=attack.kind==='super';
 const guarded=blocked&&!parried;
 let dmg=parried?0:guarded?Math.max(1,Math.round(attack.dmg*.18)):Math.round(attack.dmg);
 const back=other.x<f.x?-1:1;
 other.hp=clamp(other.hp-dmg,0,100);
 if(parried){
  f.hitstun=.56;other.chi=clamp(other.chi+19,0,100);
 }else{
  other.hitstun=guarded?.12:isSuper?.56:.28;
  other.vx=back*attack.knock*(guarded?.27:1);
  if(!guarded){other.vy=isSuper?5.8:attack.kind==='heavy'?3:1.9;other.grounded=false}
 }
 f.chi=clamp(f.chi+(parried?1:attack.kind==='light'?12:17),0,100);
 other.chi=clamp(other.chi+(parried?0:5),0,100);
 if(!parried){f.combo=f.comboClock>0?f.combo+1:1;f.comboClock=1.5}
 else f.combo=0;
 const x=(f.x+other.x)/2,y=(f.y+other.y)/2+.8;
 gfx.impact(x,y,isSuper,parried);
 match.event={id:++match.eventId,x,y,sup:isSuper,parry:parried};
 if(isSuper||parried)flash(parried?.28:.45);
}
function handleAttack(attacker,defender){
 const a=attacker.attack;if(!a||a.hit)return;
 const elapsed=a.duration-a.remaining;
 if(elapsed<a.start||elapsed>a.start+a.active)return;
 const distance=(defender.x-attacker.x)*attacker.dir;
 const tolerance=a.kind==='super'?2.7:1.8;
 if(distance>-.45 && distance<a.range && Math.abs(attacker.y-defender.y)<tolerance){
  a.hit=true;
  const blocked=defender.block&&defender.dir===-attacker.dir;
  const parried=blocked&&defender.parry>0;
  impact(attacker,defender,a,blocked,parried);
 }
}
function botControl(f,target,delta){
 const dst=target.x-f.x,abs=Math.abs(dst);
 const brave=classes[f.style].range+.1;const r={
 left:dst<0&&abs>brave*.75,right:dst>0&&abs>brave*.75,
 jump:mode==='platform'&&abs>3&&Math.random()<delta*.5,block:false,
 dash:abs>5&&Math.random()<delta*.22,light:false,heavy:false,special:false,super:false
 };
 if(abs<brave+.45&&f.attackCool<=0&&f.hitstun<=0){
  const prob=Math.random();
  r.block=target.attack!==null&&prob<.6;
  r.light=!r.block&&prob<.56;
  r.heavy=!r.block&&prob>=.56&&prob<.83;
  r.special=!r.block&&f.chi>=24&&prob>.85;
  r.super=!r.block&&f.chi>=65&&prob>.97;
 } else if(f.chi>=24&&abs<5&&Math.random()<delta*.55)r.special=true;
 return r;
}
function fighterStep(f,enemy,inp,dt){
 const style=classes[f.style];
 f.hitstun=Math.max(0,f.hitstun-dt);f.invuln=Math.max(0,f.invuln-dt);
 f.attackCool=Math.max(0,f.attackCool-dt);f.specialCool=Math.max(0,f.specialCool-dt);
 f.superCool=Math.max(0,f.superCool-dt);f.dashCool=Math.max(0,f.dashCool-dt);
 f.comboClock=Math.max(0,f.comboClock-dt);
 if(f.comboClock<=0)f.combo=0;
 f.dir=enemy.x>=f.x?1:-1;
 const canMove=f.hitstun<=0;
 if(inp.block&&!f.prevBlock){f.parry=.16}
 f.prevBlock=!!inp.block;f.parry=Math.max(0,f.parry-dt);
 f.block=canMove&&!!inp.block&&!f.attack;
 if(canMove){
  if(inp.dash&&f.dashCool<=0&&!f.block){f.dashCool=1.05;f.dashTimer=.15;f.vx=(inp.left?-1:inp.right?1:f.dir)*style.speed*2.45}
  if(f.dashTimer>0){f.dashTimer-=dt}else{
   const axis=(inp.right?1:0)-(inp.left?1:0);
   f.vx=axis*style.speed*(f.block?.3:f.attack?.4:1);
  }
  const jumpNow=!!inp.jump&&!f.prevJump;f.prevJump=!!inp.jump;
  if(jumpNow&&(f.grounded||(f.style==='ninja'&&f.jumps<2))){
   f.vy=mode==='platform'?12.2:8.4;f.grounded=false;f.jumps++;
  }
  if(!f.block){
   if(inp.super)performAttack(f,'super');
   else if(inp.special)performAttack(f,'special');
   else if(inp.heavy)performAttack(f,'heavy');
   else if(inp.light)performAttack(f,'light');
  }
 }
 f.x=clamp(f.x+f.vx*dt,-9.4,9.4);
 const oldY=f.y;f.vy-=23*dt;f.y+=f.vy*dt;f.grounded=false;
 let landing=0;
 if(mode==='platform'&&f.vy<=0){
  const platforms=[[-5.2,2.05,1.54],[0,3.05,1.72],[5.1,2.1,1.54]];
  for(const [px,py,pw]of platforms){if(Math.abs(f.x-px)<pw&&oldY>=py-.1&&f.y<=py)landing=Math.max(landing,py)}
 }
 if(f.y<=landing&&f.vy<=0){f.y=landing;f.vy=0;f.grounded=true;f.jumps=0}
 if(f.attack){
  f.attack.remaining-=dt;
  if(f.attack.remaining<=0)f.attack=null;
 }
}
function logic(dt){
 if(!match)return;
 if(match.phase==='intro'||match.phase==='intermission'){
  match.delay-=dt;
  if(match.delay<=0){
   if(match.phase==='intro'){match.phase='fight';announce('В БОЙ!',.65)}
   else nextRound();
  }
  return;
 }
 if(match.phase!=='fight')return;
 const a=players[0],b=players[1],ctrl1=copyState(),ctrl2=role==='solo'?botControl(b,a,dt):remoteInput;
 fighterStep(a,b,ctrl1,dt);fighterStep(b,a,ctrl2||{},dt);
 handleAttack(a,b);handleAttack(b,a);
 match.time=Math.max(0,match.time-dt);
 if(a.hp<=0||b.hp<=0||match.time<=0){
  let win=a.hp===b.hp?(Math.random()<.5?0:1):(a.hp>b.hp?0:1);
  endRound(win);
 }
}
function updateHUD(){
 if(!match||players.length<2)return;
 $('name1').textContent=classes[players[0].style]?.name||'БОЕЦ 1';
 $('name2').textContent=classes[players[1].style]?.name||'БОЕЦ 2';
 $('hp1').style.width=clamp(players[0].hp,0,100)+'%';
 $('hp2').style.width=clamp(players[1].hp,0,100)+'%';
 $('chi1').style.width=clamp(players[0].chi,0,100)+'%';
 $('chi2').style.width=clamp(players[1].chi,0,100)+'%';
 $('time').textContent=String(Math.ceil(match.time)).padStart(2,'0');
 $('rounds').textContent=match.scores.map(x=>'●'.repeat(x)+'○'.repeat(2-x)).join('  ·  ');
}
function send(obj){
 if(connection&&connection.open)try{connection.send(obj)}catch(err){console.warn('send failed',err)}
}
function liveFrame(ms){
 const dt=Math.min(.045,Math.max(0,(ms-(liveFrame.previous||ms))/1000));liveFrame.previous=ms;worldTime+=dt;
 if(role==='solo'||role==='host'){
  logic(dt);if(match)updateHUD();
  if(role==='host'&&match){networkTick+=dt;if(networkTick>.055){networkTick=0;send({t:'state',players,match})}}
 }else if(role==='guest'&&match){networkTick+=dt;if(networkTick>.045){networkTick=0;send({t:'input',input:copyState()})}updateHUD()}
 const preview1=freshFighter(0,choice,-3.6,1),preview2=freshFighter(1,'knight',3.6,-1);
 gfx.sync(role==='menu'?[preview1,preview2]:players,dt,ms);
 if(noticeDeadline&&ms>noticeDeadline){$('announce').classList.remove('visible');noticeDeadline=0}
 requestAnimationFrame(liveFrame);
}
function shutdown(){
 if(connection){try{connection.close()}catch(e){}connection=null}
 if(peer){try{peer.destroy()}catch(e){}peer=null}
 remoteInput={};networkTick=0;
}
function toMenu(){
 shutdown();role='menu';match=null;players=[];document.body.classList.remove('fight');
 $('menu').classList.remove('hidden');$('result-screen').classList.add('hidden');$('room-block').classList.add('hidden');
 $('net-status').textContent='';$('announce').classList.remove('visible');noticeDeadline=0;
 gfx.setStage(arena,mode,[classes[choice],classes.knight]);
}
function setNet(s){$('net-status').textContent=s}
function launchBot(){shutdown();role='solo';newMatch(choice,'knight')}
function makeCode(){
 const buf=new Uint8Array(6);crypto.getRandomValues(buf);
 return [...buf].map(v=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v%32]).join('');
}
function usePeer(){
 if(typeof window.Peer!=='function'){setNet('Не удалось загрузить сетевой модуль. Проверь интернет и блокировщик рекламы.');return null}
 const p=new window.Peer(undefined,{debug:0});
 return p;
}
function setHandlers(c,isHost){
 connection=c;
 c.on('open',()=>{
  if(!isHost){setNet('Связь установлена, ждём начала боя…');send({t:'hello',style:choice})}
 });
 c.on('data',msg=>{
  if(!msg||typeof msg!=='object')return;
  if(isHost){
   if(msg.t==='hello'){
    const guest=classes[msg.style]?msg.style:'ninja';
    newMatch(choice,guest);
    send({t:'start',mode,arena,first:choice,second:guest});
    setNet('Друг подключён. Бой начался!');
   }
   if(msg.t==='input'&&msg.input){
    remoteInput=Object.fromEntries(controls.map(k=>[k,!!msg.input[k]]));
   }
   if(msg.t==='rematch'&&match?.phase==='finished'){newMatch(players[0].style,players[1].style);send({t:'start',mode,arena,first:players[0].style,second:players[1].style})}
  }else{
   if(msg.t==='start'){
    mode=msg.mode==='platform'?'platform':'duel';
    arena=['temple','grove','city'].includes(msg.arena)?msg.arena:'temple';
    role='guest';newMatch(classes[msg.first]?msg.first:'ronin',classes[msg.second]?msg.second:'knight');
   }
   if(msg.t==='state'&&Array.isArray(msg.players)&&msg.players.length===2&&msg.match){
    const oldId=lastFx;players=msg.players;match=msg.match;
    if(match.event?.id>oldId){lastFx=match.event.id;gfx.impact(match.event.x,match.event.y,match.event.sup,match.event.parry)}
    if(match.phase==='finished'&&$('result-screen').classList.contains('hidden'))showResult();
   }
  }
 });
 c.on('close',()=>{setNet('Связь с другим игроком потеряна.');if(role!=='menu'&&match){announce('СОЕДИНЕНИЕ ПОТЕРЯНО',4)}});
 c.on('error',e=>setNet('Ошибка связи: '+(e?.message||'неизвестная')));
}
function createRoom(){
 shutdown();role='host';const code=makeCode();$('room-block').classList.remove('hidden');$('room-code').textContent=code;
 setNet('Создаём комнату…');$('invite-link').value=location.origin+location.pathname+'?join='+code;
 if(typeof window.Peer!=='function'){setNet('Сетевой модуль недоступен. Обнови страницу.');role='menu';return}
 peer=new window.Peer('steel-arena-'+code.toLowerCase(),{debug:0});
 peer.on('open',()=>setNet('Комната создана. Передай код другу и ожидай подключение.'));
 peer.on('connection',c=>{if(connection?.open){c.close();return}setHandlers(c,true)});
 peer.on('error',e=>setNet('Ошибка создания комнаты: '+(e.type||e.message)+'. Попробуй ещё раз.'));
}
function joinRoom(){
 const code=$('join-code').value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);
 if(code.length!==6){$('room-block').classList.remove('hidden');setNet('Введи 6 символов кода комнаты.');return}
 shutdown();role='guest';$('room-block').classList.remove('hidden');setNet('Подключаемся к '+code+'…');
 if(typeof window.Peer!=='function'){setNet('Сетевой модуль недоступен.');role='menu';return}
 peer=new window.Peer(undefined,{debug:0});
 peer.on('open',()=>{
  const c=peer.connect('steel-arena-'+code.toLowerCase(),{reliable:true,serialization:'json'});
  setHandlers(c,false);
  setTimeout(()=>{if(role==='guest'&&!match&&!c.open)setNet('Друг не отвечает. Проверь код или сеть.')},9000);
 });
 peer.on('error',e=>setNet('Ошибка соединения: '+(e.type||e.message)));
}
function bindTouch(){
 document.querySelectorAll('[data-key]').forEach(b=>{
  const key=b.dataset.key;
  const down=e=>{e.preventDefault();input[key]=true;b.classList.add('pressed');try{b.setPointerCapture(e.pointerId)}catch(e){}};
  const up=e=>{e.preventDefault();input[key]=false;b.classList.remove('pressed')};
  b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);
 });
 const keyMapping={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyW:'jump',ArrowUp:'jump',
 KeyJ:'light',KeyK:'heavy',KeyS:'block',ArrowDown:'block',ShiftLeft:'dash',ShiftRight:'dash',KeyL:'special',KeyP:'super',Space:'jump'};
 window.addEventListener('keydown',e=>{const k=keyMapping[e.code];if(k){if(e.target?.tagName==='INPUT')return;e.preventDefault();input[k]=true}});
 window.addEventListener('keyup',e=>{const k=keyMapping[e.code];if(k){e.preventDefault();input[k]=false}});
 window.addEventListener('blur',()=>controls.forEach(k=>input[k]=false));
}
$('start-bot').addEventListener('click',launchBot);
$('create-room').addEventListener('click',createRoom);
$('join-room').addEventListener('click',joinRoom);
$('back-menu').addEventListener('click',toMenu);
$('menu-return').addEventListener('click',toMenu);
$('play-again').addEventListener('click',()=>{
 $('result-screen').classList.add('hidden');
 if(role==='solo')newMatch(choice,'knight');
 else if(role==='host'){const p0=players[0].style,p1=players[1].style;newMatch(p0,p1);send({t:'start',mode,arena,first:p0,second:p1})}
 else if(role==='guest')send({t:'rematch'});
});
$('copy-invite').addEventListener('click',async()=>{
 const code=$('room-code').textContent;const link=$('invite-link').value||location.origin+location.pathname+'?join='+code;
 try{await navigator.clipboard.writeText(link);setNet('Ссылка приглашения скопирована.')}catch(e){$('invite-link').focus();$('invite-link').select();setNet('Выделена ссылка — скопируй вручную.')}
});
bindTouch();
const query=new URLSearchParams(location.search);const invite=query.get('join');
if(invite){$('join-code').value=invite.replace(/[^A-Za-z2-9]/g,'').slice(0,6).toUpperCase()}
gfx.setStage(arena,mode,[classes[choice],classes.knight]);requestAnimationFrame(liveFrame);
