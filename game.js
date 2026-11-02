
import {createGraphics} from './graphics.js?v=20261102n';
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
const weapons={
 sword:{id:'sword',name:'МЕЧ',range:2.42,power:1,speed:1,move:1},
 axe:{id:'axe',name:'ТОПОР',range:2.13,power:1.28,speed:.84,move:.95},
 spear:{id:'spear',name:'КОПЬЁ',range:3.5,power:.88,speed:.93,move:.97},
 staff:{id:'staff',name:'ПОСОХ',range:3.05,power:.92,speed:1.06,move:1},
 daggers:{id:'daggers',name:'КИНЖАЛЫ',range:1.74,power:.75,speed:1.4,move:1.12},
 hammer:{id:'hammer',name:'МОЛОТ',range:2.02,power:1.44,speed:.72,move:.88}
};
const defaultWeapons={ronin:'sword',knight:'hammer',ninja:'daggers',mage:'staff',brute:'axe',lancer:'spear'};
const equipped=id=>weapons[id]||weapons.sword;
const gfx=createGraphics($('scene'));
const controls=['left','right','up','down','jump','light','heavy','block','dash','special','super','shoot'];
const input=Object.fromEntries(controls.map(x=>[x,false]));
let role='menu',peer=null,connection=null,remoteInput={},networkTick=0;
const botLearning={shots:0,attacks:0,blocks:0,frames:0};
let choice='ronin',weaponChoice='sword',arena='temple',mode='endless',players=[],match=null,lastFx=0,noticeDeadline=0,worldTime=0;
const MAX_ROUND_TIME=90;
const copyState=()=>Object.fromEntries(controls.map(k=>[k,!!input[k]]));
const names={left:'A / ←',right:'D / →',up:'↑',down:'↓',jump:'Space',light:'J',heavy:'K',block:'B',dash:'Shift',special:'L',super:'P',shoot:'F'};
function previewStyles(){return [{...classes[choice],weapon:weaponChoice},{...classes.knight,weapon:'hammer'}]}
function select(which,value){
 if(which==='hero')choice=value;
 if(which==='weapon')weaponChoice=value;
 if(which==='mode')mode=value;
 if(which==='arena')arena=value;
 document.querySelectorAll('[data-pick]').forEach(el=>el.classList.toggle('selected',el.dataset.pick===which&&el.dataset.value===value||el.dataset.pick!==which&&el.classList.contains('selected')));
 if(role==='menu'){gfx.setStage(arena,mode,previewStyles());}
}
for(const b of document.querySelectorAll('[data-pick]')){
 b.addEventListener('click',()=>select(b.dataset.pick,b.dataset.value));
}
function freshFighter(id,style,x,dir,weapon=id===0?weaponChoice:(defaultWeapons[style]||'sword')){
 return {id,style,weapon:equipped(weapon).id,x,y:0,z:0,vx:0,vz:0,vy:0,dir,hp:100,chi:0,grounded:true,jumps:0,prevJump:false,block:false,parry:0,
 hitstun:0,invuln:0,dashTimer:0,dashCool:0,attack:null,attackCool:0,specialCool:0,superCool:0,combo:0,comboClock:0,prevBlock:false,shotCool:0,shotId:0,shotTime:0};
}
function announce(text,seconds=1.2){const el=$('announce');el.textContent=text;el.classList.add('visible');noticeDeadline=performance.now()+seconds*1000;}
function flash(intensity=.3){const f=$('flash');f.style.opacity=String(intensity);setTimeout(()=>f.style.opacity='0',80)}
function currentStyles(){return [0,1].map(i=>({...classes[players[i]?.style]||classes.ronin,weapon:players[i]?.weapon||'sword'}))}
function enterFight(){
 $('menu').classList.add('hidden');$('result-screen').classList.add('hidden');document.body.classList.add('fight');
 $('hint').textContent=role==='solo'?'ТРЕНИРОВКА ПРОТИВ БОТА':role==='host'?'ОНЛАЙН • ВЫ ХОЗЯИН КОМНАТЫ':'ОНЛАЙН • ВЫ ГОСТЬ';
 gfx.setStage(arena,mode,currentStyles());
}
function newMatch(p1=choice,p2='knight',w1=weaponChoice,w2=defaultWeapons[p2]||'sword'){
 players=[freshFighter(0,p1,-3.5,1,w1),freshFighter(1,p2,3.5,-1,w2)];
 match={phase:'intro',delay:1.65,round:1,time:MAX_ROUND_TIME,scores:[0,0],winner:null,event:null,eventId:0};
 lastFx=0;enterFight();updateHUD();announce('ПРИГОТОВИТЬСЯ',1.3);
}
function nextRound(){
 const s1=players[0].style,s2=players[1].style;
 const w1=players[0].weapon,w2=players[1].weapon;
 players=[freshFighter(0,s1,-3.5,1,w1),freshFighter(1,s2,3.5,-1,w2)];
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
function weaponRange(f){
 const c=classes[f.style],w=equipped(f.weapon);
 return Math.max(1.4,w.range+(c.range-2.4)*.22);
}
function damageMove(kind,c,w){
 const speed=w.speed;
 const reach=Math.max(1.4,w.range+(c.range-2.4)*.22);
 const power=c.power*w.power;
 if(kind==='light')return {kind,duration:.38/speed,start:.09/speed,active:.14/speed,dmg:8*power,range:reach,knock:3.2,cost:0};
 if(kind==='heavy')return {kind,duration:.69/speed,start:.26/speed,active:.14/speed,dmg:15*power,range:reach+.16,knock:6.3*w.power,cost:0};
 if(kind==='special')return {kind,duration:.82/speed,start:.2/speed,active:.27/speed,dmg:16*power,range:Math.max(reach+1.1,c.id==='mage'?5:0),knock:7.4,cost:24};
 return {kind:'super',duration:1.1/speed,start:.29/speed,active:.26/speed,dmg:33*power,range:Math.max(5.4,reach+1.4),knock:11,cost:65};
}
function performAttack(f,kind){
 const c=classes[f.style];if(f.attack||f.hitstun>0||f.attackCool>0)return;
 if(kind==='special'&&(f.chi<24||f.specialCool>0))return;
 if(kind==='super'&&(f.chi<65||f.superCool>0))return;
 const move=damageMove(kind,c,equipped(f.weapon));f.attack={...move,remaining:move.duration,hit:false};
 f.attackCool=kind==='light'?.13:kind==='heavy'?.32:kind==='special'?.45:.8;
 if(kind==='special'){f.specialCool=1.9;f.chi-=24;if(c.id==='ninja')f.x+=f.dir*1.4}
 if(kind==='super'){f.superCool=3.8;f.chi-=65;announce(c.name+' • СУПЕР!',.75);flash(.3)}
}
function impact(f,other,attack,blocked,parried){
 const isSuper=attack.kind==='super';
 const guarded=blocked&&!parried;
 let dmg=parried?0:guarded?Math.max(1,Math.round(attack.dmg*.18)):Math.round(attack.dmg);
 if(role==='solo'&&f.id===1)dmg=Math.max(1,Math.round(dmg*.6));
 if(role==='solo'&&f.id===0&&!guarded&&!parried)dmg=Math.round(dmg*1.15);
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
 const depth=Math.abs((defender.z||0)-(attacker.z||0));
 const tolerance=a.kind==='super'?2.7:1.8;
 if(distance>-.6 && distance<a.range+.12 && depth<(a.kind==='super'?2.5:2.05) && Math.abs(attacker.y-defender.y)<tolerance){
  a.hit=true;
  const blocked=defender.block&&defender.dir===-attacker.dir;
  const parried=blocked&&defender.parry>0;
  impact(attacker,defender,a,blocked,parried);
 }
}
function botControl(f,target,delta){
 const dst=target.x-f.x,abs=Math.abs(dst),dz=(target.z||0)-(f.z||0);
 const brave=weaponRange(f)+.1;
 // Training opponent: clear openings and slower reactions, without changing online balance.
 f.botThink=(f.botThink||0)-delta;
 if(f.botThink>0)return f.botLast||{};
 f.botThink=.28+Math.random()*.33;
 const shotRatio=botLearning.shots/Math.max(1,botLearning.frames),attackRatio=botLearning.attacks/Math.max(1,botLearning.frames),blockRatio=botLearning.blocks/Math.max(1,botLearning.frames);
 const r={
 left:dst<0&&abs>brave*.75,right:dst>0&&abs>brave*.75,
 up:dz<-.65,down:dz>.65,
 jump:mode==='platform'&&abs>3&&Math.random()<.08,block:false,shoot:abs>4&&abs<11&&Math.random()<.24,
 dash:abs>6&&Math.random()<.07,light:false,heavy:false,special:false,super:false
 };
 if(abs<brave+.45&&f.attackCool<=0&&f.hitstun<=0){
  const prob=Math.random();
  r.block=target.attack!==null&&prob<Math.min(.58,.2+attackRatio*5);
  r.light=!r.block&&prob<.28;
  r.heavy=!r.block&&prob>=.28&&prob<.4;
  r.special=!r.block&&f.chi>=24&&prob>.92;
  r.super=!r.block&&f.chi>=65&&prob>.99;
 }
 // Sidestep props if the direct approach is obstructed.
 const nextX=f.x+Math.sign(dst)*.8;
 for(const side of [-1,1])for(let j=0;j<3;j++){const cx=side*(5.9+j*1.15)+Math.round(nextX/20)*20,cz=5.5+(j%2)*1.2;if(Math.abs(nextX-cx)<1.3&&Math.abs((f.z||0)-cz)<1.3){r.up=(f.z||0)>=cz;r.down=!r.up;}}
 if(shotRatio>.04&&abs>3&&Math.random()<.32){r.up=Math.random()<.5;r.down=!r.up;}
 if(blockRatio>.22&&abs<brave+.8&&Math.random()<.35)r.heavy=true;
 f.botLast=r;return r;
}
function fighterStep(f,enemy,inp,dt){
 const style=classes[f.style],gear=equipped(f.weapon),runSpeed=style.speed*gear.move;
 f.hitstun=Math.max(0,f.hitstun-dt);f.invuln=Math.max(0,f.invuln-dt);
 f.attackCool=Math.max(0,f.attackCool-dt);f.specialCool=Math.max(0,f.specialCool-dt);
 f.superCool=Math.max(0,f.superCool-dt);f.dashCool=Math.max(0,f.dashCool-dt);f.shotCool=Math.max(0,(f.shotCool||0)-dt);
 f.comboClock=Math.max(0,f.comboClock-dt);
 if(f.comboClock<=0)f.combo=0;
 f.dir=enemy.x>=f.x?1:-1;
 // Attack direction and facing remain consistent while circling in 3D.
 const canMove=f.hitstun<=0;
 if(inp.block&&!f.prevBlock){f.parry=.16}
 f.prevBlock=!!inp.block;f.parry=Math.max(0,f.parry-dt);
 f.block=canMove&&!!inp.block&&!f.attack;
 if(canMove){
  if(inp.dash&&f.dashCool<=0&&!f.block){f.dashCool=1.05;f.dashTimer=.15;f.vx=(inp.left?-1:inp.right?1:f.dir)*runSpeed*2.45}
  if(f.dashTimer>0){f.dashTimer-=dt}else{
   const axis=(inp.right?1:0)-(inp.left?1:0);
   f.vx=axis*runSpeed*(f.block?.3:f.attack?.4:1);
   const depthAxis=(inp.down?1:0)-(inp.up?1:0);
   f.vz=depthAxis*runSpeed*(f.block?.3:f.attack?.4:1)*.85;
  }
  const jumpNow=!!inp.jump&&!f.prevJump;f.prevJump=!!inp.jump;
  if(jumpNow&&(f.grounded||(f.style==='ninja'&&f.jumps<2))){
   f.vy=mode==='platform'?12.2:8.4;f.grounded=false;f.jumps++;
  }
  if(!f.block){
   if(inp.shoot&&f.shotCool<=0&&!f.attack){f.shotCool=.75;f.shotId=(f.shotId||0)+1;f.shotTime=.4;}
   if(inp.super)performAttack(f,'super');
   else if(inp.special)performAttack(f,'special');
   else if(inp.heavy)performAttack(f,'heavy');
   else if(inp.light)performAttack(f,'light');
  }
 }
 const oldX=f.x,oldZ=f.z||0;
 const props=[];const baseChunk=Math.round(f.x/20);
 for(let k=baseChunk-1;k<=baseChunk+1;k++)for(const side of [-1,1]){
  for(let j=0;j<3;j++)props.push({x:side*(5.9+j*1.15)+k*20,z:5.5+(j%2)*1.2,half:.44,height:.85});
  props.push({x:side*8.2+k*20,z:3.1,half:.42,height:1.12});
 }
 f.x+=f.vx*dt;
 f.z=(f.z||0)+(f.vz||0)*dt;
 // Collide with repeated crates and barrels. Sliding on free axis allows going around.
 const collide=(x,z)=>{const chunk=Math.round(x/20);for(let k=chunk-1;k<=chunk+1;k++)for(const side of [-1,1]){
  for(let j=0;j<3;j++){const cx=side*(5.9+j*1.15)+k*20,cz=5.5+(j%2)*1.2;if(Math.abs(x-cx)<.83&&Math.abs(z-cz)<.83&&f.y<.85-.12)return true;}
  if(Math.hypot(x-(side*8.2+k*20),z-3.1)<.83&&f.y<1.12-.12)return true;
 }return false};
 if(collide(f.x,f.z)){if(!collide(f.x,oldZ))f.z=oldZ;else if(!collide(oldX,f.z))f.x=oldX;else{f.x=oldX;f.z=oldZ;}}
 f.shotTime=Math.max(0,(f.shotTime||0)-dt);
 const oldY=f.y;f.vy-=23*dt;f.y+=f.vy*dt;f.grounded=false;
 let landing=0;
 if(f.vy<=0)for(const prop of props){if(Math.abs(f.x-prop.x)<prop.half+.22&&Math.abs(f.z-prop.z)<prop.half+.22&&oldY>=prop.height-.16&&f.y<=prop.height)landing=Math.max(landing,prop.height);}
 if(mode==='platform'&&f.vy<=0){
  const platforms=[[-5.2,2.05,1.54],[0,3.05,1.72],[5.1,2.1,1.54]];
  const chunk=Math.round(f.x/20);
  for(let index=chunk-1;index<=chunk+1;index++)for(const [px,py,pw]of platforms){if(Math.abs(f.x-(px+index*20))<pw&&oldY>=py-.1&&f.y<=py)landing=Math.max(landing,py)}
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
 const a=players[0],b=players[1],ctrl1=copyState();
 if(role==='solo'){botLearning.frames++;botLearning.shots+=ctrl1.shoot?1:0;botLearning.attacks+=ctrl1.light||ctrl1.heavy?1:0;botLearning.blocks+=ctrl1.block?1:0;}
 const ctrl2=role==='solo'?botControl(b,a,dt):remoteInput;
 fighterStep(a,b,ctrl1,dt);fighterStep(b,a,ctrl2||{},dt);
 for(const [shooter,target] of [[a,b],[b,a]]){
  if(shooter.shotId&&shooter.shotId!==shooter.lastShotId){shooter.lastShotId=shooter.shotId;shooter.projectiles=shooter.projectiles||[];shooter.projectiles.push({x:shooter.x,z:shooter.z,y:shooter.y+1.4,dir:shooter.dir,life:1.35});}
  for(const p of shooter.projectiles||[]){p.x+=p.dir*13*dt;p.life-=dt;
   if(p.life>0&&Math.abs(p.x-target.x)<.7&&Math.abs(p.z-target.z)<1.15&&Math.abs(p.y-(target.y+1.4))<1.4){p.life=0;const blocked=target.block&&target.dir===-p.dir;const dmg=blocked?2:role==='solo'&&shooter.id===1?4:8;target.hp=clamp(target.hp-dmg,0,100);target.hitstun=blocked?.08:.17;target.chi=clamp(target.chi+4,0,100);gfx.impact(target.x,target.y+1,false,blocked);}
  }
  shooter.projectiles=(shooter.projectiles||[]).filter(p=>p.life>0);
 }
 handleAttack(a,b);handleAttack(b,a);
 if(mode!=='endless')match.time=Math.max(0,match.time-dt);
 if(a.hp<=0||b.hp<=0||(mode!=='endless'&&match.time<=0)){
  let win=a.hp===b.hp?(Math.random()<.5?0:1):(a.hp>b.hp?0:1);
  endRound(win);
 }
}
function updateHUD(){
 if(!match||players.length<2)return;
 $('name1').textContent=(classes[players[0].style]?.name||'БОЕЦ 1')+' • '+equipped(players[0].weapon).name;
 $('name2').textContent=(classes[players[1].style]?.name||'БОЕЦ 2')+' • '+equipped(players[1].weapon).name;
 $('hp1').style.width=clamp(players[0].hp,0,100)+'%';
 $('hp2').style.width=clamp(players[1].hp,0,100)+'%';
 $('chi1').style.width=clamp(players[0].chi,0,100)+'%';
 $('chi2').style.width=clamp(players[1].chi,0,100)+'%';
 $('time').textContent=mode==='endless'?'∞':String(Math.ceil(match.time)).padStart(2,'0');
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
 gfx.setStage(arena,mode,previewStyles());
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
  if(!isHost){setNet('Связь установлена, ждём начала боя…');send({t:'hello',style:choice,weapon:weaponChoice})}
 });
 c.on('data',msg=>{
  if(!msg||typeof msg!=='object')return;
  if(isHost){
   if(msg.t==='hello'){
    const guest=classes[msg.style]?msg.style:'ninja';
    const guestWeapon=equipped(msg.weapon).id;
    newMatch(choice,guest,weaponChoice,guestWeapon);
    send({t:'start',mode,arena,first:choice,second:guest,firstWeapon:weaponChoice,secondWeapon:guestWeapon});
    setNet('Друг подключён. Бой начался!');
   }
   if(msg.t==='input'&&msg.input){
    remoteInput=Object.fromEntries(controls.map(k=>[k,!!msg.input[k]]));
   }
   if(msg.t==='rematch'&&match?.phase==='finished'){const [p1,p2]=players;newMatch(p1.style,p2.style,p1.weapon,p2.weapon);send({t:'start',mode,arena,first:p1.style,second:p2.style,firstWeapon:p1.weapon,secondWeapon:p2.weapon})}
  }else{
   if(msg.t==='start'){
    mode=['duel','platform','endless'].includes(msg.mode)?msg.mode:'endless';
    arena=['temple','grove','city','cavern','citadel'].includes(msg.arena)?msg.arena:'temple';
    role='guest';newMatch(classes[msg.first]?msg.first:'ronin',classes[msg.second]?msg.second:'knight',equipped(msg.firstWeapon).id,equipped(msg.secondWeapon).id);
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
 const pad=$('move-joystick'),knob=$('joystick-knob');
 let activeStick=null;
 const clearStick=()=>{activeStick=null;knob.style.transform='translate3d(0px,0px,0)';for(const k of ['left','right','up','down'])input[k]=false;};
 const updateStick=(x,y)=>{
  const r=pad.getBoundingClientRect(),radius=Math.max(20,r.width*.34);
  let dx=x-r.left-r.width/2,dy=y-r.top-r.height/2;
  const magnitude=Math.hypot(dx,dy);if(magnitude>radius){dx*=radius/magnitude;dy*=radius/magnitude;}
  knob.style.transform='translate3d('+dx+'px,'+dy+'px,0)';
  const dead=radius*.18;
  input.left=dx < -dead;input.right=dx > dead;
  input.up=dy < -dead;input.down=dy > dead;
 };
 pad.addEventListener('pointerdown',e=>{
  if(activeStick!==null)return;e.preventDefault();activeStick=e.pointerId;
  try{pad.setPointerCapture(e.pointerId)}catch(_){}
  updateStick(e.clientX,e.clientY);
 },{passive:false});
 // Listen on the window as well: direction changes keep working outside the circle.
 window.addEventListener('pointermove',e=>{if(activeStick!==e.pointerId)return;e.preventDefault();updateStick(e.clientX,e.clientY);},{passive:false});
 window.addEventListener('pointerup',e=>{if(activeStick===e.pointerId)clearStick()});
 window.addEventListener('pointercancel',e=>{if(activeStick===e.pointerId)clearStick()});
 window.addEventListener('blur',clearStick);
 document.querySelectorAll('[data-key]').forEach(b=>{
  const key=b.dataset.key;
  const down=e=>{e.preventDefault();input[key]=true;b.classList.add('pressed');try{b.setPointerCapture(e.pointerId)}catch(e){}};
  const up=e=>{e.preventDefault();input[key]=false;b.classList.remove('pressed')};
  b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);
 });
 const keyMapping={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyW:'up',ArrowUp:'up',
 KeyJ:'light',KeyK:'heavy',KeyS:'down',ArrowDown:'down',KeyB:'block',ShiftLeft:'dash',ShiftRight:'dash',KeyL:'special',KeyP:'super',KeyF:'shoot',Space:'jump'};
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
 else if(role==='host'){const [p0,p1]=players;newMatch(p0.style,p1.style,p0.weapon,p1.weapon);send({t:'start',mode,arena,first:p0.style,second:p1.style,firstWeapon:p0.weapon,secondWeapon:p1.weapon})}
 else if(role==='guest')send({t:'rematch'});
});
$('copy-invite').addEventListener('click',async()=>{
 const code=$('room-code').textContent;const link=$('invite-link').value||location.origin+location.pathname+'?join='+code;
 try{await navigator.clipboard.writeText(link);setNet('Ссылка приглашения скопирована.')}catch(e){$('invite-link').focus();$('invite-link').select();setNet('Выделена ссылка — скопируй вручную.')}
});
bindTouch();
const query=new URLSearchParams(location.search);const invite=query.get('join');
if(invite){$('join-code').value=invite.replace(/[^A-Za-z2-9]/g,'').slice(0,6).toUpperCase()}
gfx.setStage(arena,mode,previewStyles());requestAnimationFrame(liveFrame);
