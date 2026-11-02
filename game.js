
import {createGraphics} from './graphics.js?v=20261102namesfix';
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
let joystickAxis={x:0,y:0};let gamepadActive=false;
let role='menu',peer=null,connection=null,remoteInput={},networkTick=0;
const botLearning={shots:0,attacks:0,blocks:0,frames:0};
let choice='ronin',weaponChoice='sword',arena='garden',mode='endless',players=[],match=null,lastFx=0,noticeDeadline=0,worldTime=0;
const MAX_ROUND_TIME=90;
let botCount=1;
let firstPerson=false;
let aimYaw=Math.PI/2,aimPitch=-.12,aimPointer=null,aimLastX=0,aimLastY=0;
let flashUntil=0,hitUntil=0;
function aimVector(){return {x:Math.sin(aimYaw),z:Math.cos(aimYaw)};}
function syncAim(){const p=players[0];if(p&&firstPerson){const d=aimVector();p.facingX=d.x;p.facingZ=d.z;p.dir=d.x<0?-1:1;}gfx.setAim(aimYaw,aimPitch);}
const aiming=$('fps-aim-zone');
aiming.addEventListener('pointerdown',e=>{if(!firstPerson||role==='menu'||aimPointer!==null)return;e.preventDefault();aimPointer=e.pointerId;aimLastX=e.clientX;aimLastY=e.clientY;try{aiming.setPointerCapture(e.pointerId)}catch(_){} });
aiming.addEventListener('pointermove',e=>{if(e.pointerId!==aimPointer)return;e.preventDefault();aimYaw+=(e.clientX-aimLastX)*.0055;aimPitch=clamp(aimPitch-(e.clientY-aimLastY)*.0045,-1.1,.8);aimLastX=e.clientX;aimLastY=e.clientY;syncAim();});
const releaseAim=e=>{if(e.pointerId===aimPointer)aimPointer=null;};
aiming.addEventListener('pointerup',releaseAim);aiming.addEventListener('pointercancel',releaseAim);

const viewButton=$('view-camera');
viewButton.addEventListener('click',()=>{firstPerson=!firstPerson;if(firstPerson&&players[0]){const p=players[0];aimYaw=Math.atan2(p.facingX??p.dir??1,p.facingZ??0);aimPitch=-.12;}gfx.setFirstPerson(firstPerson);syncAim();viewButton.textContent=firstPerson?'🎥 ВИД ОТ ТРЕТЬЕГО ЛИЦА':'👁 ВИД ОТ ПЕРВОГО ЛИЦА';viewButton.setAttribute('aria-pressed',String(firstPerson));document.body.classList.toggle('first-person',firstPerson);});
$('bot-count').addEventListener('input',e=>{botCount=clamp(Number(e.target.value)||1,1,10);$('bot-count-value').textContent=String(botCount)});
const botRoster=()=>Array.from({length:botCount},(_,i)=>{const ids=['knight','ninja','brute','lancer','mage','ronin'];const type=ids[i%ids.length];const angle=i*Math.PI*2/botCount;const f=freshFighter(i+1,type,Math.cos(angle)*Math.max(5,botCount*1.15),-1,defaultWeapons[type]);f.z=Math.sin(angle)*Math.max(4,botCount*.7);return f;});
const copyState=()=>({...Object.fromEntries(controls.map(k=>[k,!!input[k]])),axisX:joystickAxis.x,axisY:joystickAxis.y});
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
const nickInput=$('player-nick');
const cleanNick=value=>String(value||'').trim().replace(/[<>\\x00-\\x1f]/g,'').slice(0,16)||'ИГРОК';
try{nickInput.value=localStorage.getItem('steel-arena-nick')||'ИГРОК'}catch(_){nickInput.value='ИГРОК'}
nickInput.addEventListener('change',()=>{nickInput.value=cleanNick(nickInput.value);try{localStorage.setItem('steel-arena-nick',nickInput.value)}catch(_){}});
const myNick=()=>cleanNick(nickInput.value);
function freshFighter(id,style,x,dir,weapon=id===0?weaponChoice:(defaultWeapons[style]||'sword')){
 return {id,nick:id===0?myNick():'БОТ '+id,style,weapon:equipped(weapon).id,x,y:0,z:0,vx:0,vz:0,vy:0,dir,hp:100,chi:0,grounded:true,jumps:0,prevJump:false,block:false,parry:0,
 hitstun:0,invuln:0,dashTimer:0,dashCool:0,attack:null,attackCool:0,specialCool:0,superCool:0,combo:0,comboClock:0,prevBlock:false,shotCool:0,shotId:0,shotTime:0};
}
function announce(text,seconds=1.2){const el=$('announce');el.textContent=text;el.classList.add('visible');noticeDeadline=performance.now()+seconds*1000;}
function flash(intensity=.3){const f=$('flash');f.style.opacity=String(intensity);setTimeout(()=>f.style.opacity='0',80)}
function currentStyles(){return players.map(p=>({...classes[p?.style]||classes.ronin,weapon:p?.weapon||'sword'}))}
function enterFight(){
 $('menu').classList.add('hidden');$('result-screen').classList.add('hidden');document.body.classList.add('fight');
 $('hint').textContent=role==='solo'?'ТРЕНИРОВКА ПРОТИВ БОТА':role==='host'?'ОНЛАЙН • ВЫ ХОЗЯИН КОМНАТЫ':'ОНЛАЙН • ВЫ ГОСТЬ';
 gfx.setStage(arena,mode,currentStyles());gfx.setFirstPerson(firstPerson);
}
function newMatch(p1=choice,p2='knight',w1=weaponChoice,w2=defaultWeapons[p2]||'sword'){
 players=role==='solo'?[freshFighter(0,p1,0,1,w1),...botRoster()]:[freshFighter(0,p1,-3.5,1,w1),freshFighter(1,p2,3.5,-1,w2)];
 match={phase:'intro',delay:1.65,round:1,time:MAX_ROUND_TIME,scores:[0,0],winner:null,event:null,eventId:0};
 lastFx=0;enterFight();updateHUD();announce('ПРИГОТОВИТЬСЯ',1.3);
}
function nextRound(){
 const s1=players[0].style,s2=players[1].style;
 const w1=players[0].weapon,w2=players[1].weapon;
 const identities=players.map(p=>({nick:p.nick,team:p.team}));
 players=role==='solo'?[freshFighter(0,s1,0,1,w1),...botRoster()]:[freshFighter(0,s1,-3.5,1,w1),freshFighter(1,s2,3.5,-1,w2)];
 players.forEach((p,i)=>Object.assign(p,identities[i]||{}));
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
 const dx=defender.x-attacker.x,dz=(defender.z||0)-(attacker.z||0);
 const distance=role==='solo'?Math.hypot(dx,dz):dx*attacker.dir;
 const depth=role==='solo'?0:Math.abs(dz);
 const tolerance=a.kind==='super'?2.7:1.8;
 if(distance>-.6 && distance<a.range+.12 && depth<(a.kind==='super'?2.5:2.05) && Math.abs(attacker.y-defender.y)<tolerance){
  a.hit=true;
  const blocked=defender.block&&(role==='solo'||defender.dir===-attacker.dir);
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
 left:dst<-.5&&Math.hypot(dst,dz)>brave*.75,right:dst>.5&&Math.hypot(dst,dz)>brave*.75,
 up:dz<-.45,down:dz>.45,
 jump:mode==='platform'&&abs>3&&Math.random()<.08,block:false,shoot:abs>4&&abs<11&&Math.random()<.24,
 dash:abs>6&&Math.random()<.07,light:false,heavy:false,special:false,super:false
 };
 if(Math.hypot(dst,dz)<brave+.45&&f.attackCool<=0&&f.hitstun<=0){
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
 if(f.facingX===undefined){f.facingX=f.dir;f.facingZ=0;}
 // Attack direction and facing remain consistent while circling in 3D.
 const canMove=f.hitstun<=0;
 if(inp.block&&!f.prevBlock){f.parry=.16}
 f.prevBlock=!!inp.block;f.parry=Math.max(0,f.parry-dt);
 f.block=canMove&&!!inp.block&&!f.attack;
 if(canMove){
  if(inp.dash&&f.dashCool<=0&&!f.block){f.dashCool=1.05;f.dashTimer=.15;f.vx=(inp.left?-1:inp.right?1:f.dir)*runSpeed*2.45}
  if(f.dashTimer>0){f.dashTimer-=dt}else{
   const axis=typeof inp.axisX==='number'?inp.axisX:(inp.right?1:0)-(inp.left?1:0);
   f.vx=axis*runSpeed*(f.block?.3:f.attack?.4:1);
   const depthAxis=typeof inp.axisY==='number'?inp.axisY:(inp.down?1:0)-(inp.up?1:0);
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
 const props=[];
 const mazeWalls=[[-7,-19,1.1,11],[-3.5,-15,7,.9],[5,-19,1.1,12],[-7,1,1.1,13],[-3,5,6,.9],[7,0,1.1,14],[-5,20,1.1,10],[4,19,1.1,10],[-1,25,8,.9],[-5,-1,5,.9],[4,-8,5,.9]];
 const obstacles=mazeWalls.map(([x,z,w,d])=>({x,z,halfX:w/2,halfZ:d/2,height:1.5}));
 for(const [x,z] of [[-7,-9],[7,13],[-7,13]])obstacles.push({x,z,halfX:1.65,halfZ:1.5,height:3});
 for(let j=0;j<14;j++){const x=(j%2?-1:1)*(3.9+(j%3)*1.05),z=-26+j*4;if(Math.abs(z)<5)continue;obstacles.push({x,z,halfX:.43,halfZ:.43,height:.9});}
 const oldX=f.x,oldZ=f.z||0;
 f.x+=f.vx*dt;f.z=(f.z||0)+(f.vz||0)*dt;
 if(Math.hypot(f.vx||0,f.vz||0)>.2&&!(firstPerson&&f.id===0)){const len=Math.hypot(f.vx,f.vz);f.facingX=f.vx/len;f.facingZ=f.vz/len;f.dir=f.facingX<-.15?-1:f.facingX>.15?1:f.dir;}
 const collide=(x,z)=>obstacles.some(o=>Math.abs(x-o.x)<o.halfX+.33&&Math.abs(z-o.z)<o.halfZ+.33&&f.y<o.height-.12);
 if(collide(f.x,f.z)){if(!collide(f.x,oldZ))f.z=oldZ;else if(!collide(oldX,f.z))f.x=oldX;else{f.x=oldX;f.z=oldZ;}}
 f.x=clamp(f.x,-8.5,8.5);f.z=clamp(f.z,-32,32);
 f.shotTime=Math.max(0,(f.shotTime||0)-dt);
 const oldY=f.y;f.vy-=23*dt;f.y+=f.vy*dt;f.grounded=false;
 let landing=0;
 if(f.vy<=0)for(const prop of props){if(Math.abs(f.x-prop.x)<prop.half+.22&&Math.abs(f.z-prop.z)<prop.half+.22&&oldY>=prop.height-.16&&f.y<=prop.height)landing=Math.max(landing,prop.height);}
 if(mode==='platform'&&f.vy<=0){
  const platforms=[[-5.2,2.05,1.54],[0,3.05,1.72],[5.1,2.1,1.54]];
  const chunk=Math.round(f.x/20);
  for(let index=chunk-1;index<=chunk+1;index++)for(const [px,py,pw]of platforms){if(Math.abs(f.x-(px+index*20))<pw&&Math.abs(f.z)<3.1&&oldY>=py-.1&&f.y<=py)landing=Math.max(landing,py)}
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
 if(firstPerson)syncAim();
 if(role==='solo'){
  const aliveBots=players.slice(1).filter(p=>p.hp>0);
  if(a.hp>0)fighterStep(a,aliveBots[0]||b,ctrl1,dt);
  for(const bot of aliveBots)fighterStep(bot,a,botControl(bot,a,dt),dt);
 }else{fighterStep(a,b,ctrl1,dt);fighterStep(b,a,remoteInput||{},dt);}
 for(const shooter of players){
  if(shooter.hp<=0)continue;
  if(shooter.shotId&&shooter.shotId!==shooter.lastShotId){
   shooter.lastShotId=shooter.shotId;shooter.projectiles=shooter.projectiles||[];
   if(shooter.id===0&&firstPerson){flashUntil=performance.now()+95;$('fps-muzzle').classList.remove('firing');void $('fps-muzzle').offsetWidth;$('fps-muzzle').classList.add('firing');}
   const vx=shooter.facingX??shooter.dir,vz=shooter.facingZ??0;
   const mag=Math.hypot(vx,vz)||1;
   shooter.projectiles.push({x:shooter.x+vx/mag*.65,z:shooter.z+vz/mag*.65,y:shooter.y+1.4,vx:vx/mag*13,vz:vz/mag*13,life:1.6});
  }
  for(const p of shooter.projectiles||[]){
   p.x+=p.vx*dt;p.z+=p.vz*dt;p.life-=dt;
   if(p.life<=0)continue;
   const targets=role==='solo'?(shooter.id===0?players.slice(1):[a]):players.filter(t=>t!==shooter);
   for(const target of targets){
    if(target.hp<=0)continue;
    if(Math.hypot(p.x-target.x,p.z-target.z)<.95&&Math.abs(p.y-(target.y+1.4))<1.4){
     p.life=0;if(shooter.id===0&&firstPerson){hitUntil=performance.now()+170;$('fps-crosshair').classList.add('hit');}const blocked=target.block&&target.dir===-(Math.sign(p.vx)||shooter.dir);
     const dmg=blocked?2:role==='solo'&&shooter.id!==0?4:8;
     target.hp=clamp(target.hp-dmg,0,100);target.hitstun=blocked?.08:.17;
     target.chi=clamp(target.chi+4,0,100);gfx.impact(target.x,target.y+1,false,blocked);break;
    }
   }
  }
  shooter.projectiles=(shooter.projectiles||[]).filter(p=>p.life>0);
 }
 if(role==='solo'){
  for(const attacker of players){if(attacker.hp<=0)continue;
   const targets=attacker.id===0?players.slice(1):[a];
   for(const defender of targets){if(defender.hp>0)handleAttack(attacker,defender);}
  }
 }else{handleAttack(a,b);handleAttack(b,a);}
 if(mode!=='endless'&&role!=='solo')match.time=Math.max(0,match.time-dt);
 if(role==='solo'){
  const remaining=players.slice(1).filter(p=>p.hp>0).length;
  if(a.hp<=0||remaining===0){match.phase='finished';match.winner=a.hp>0?0:1;announce(a.hp>0?'ВСЕ БОТЫ УНИЧТОЖЕНЫ!':'ТЫ ПОГИБ!',2);setTimeout(()=>{if(match?.phase==='finished')showResult()},1600);}
 }else if(a.hp<=0||b.hp<=0||(mode!=='endless'&&match.time<=0)){
  const win=a.hp===b.hp?(Math.random()<.5?0:1):(a.hp>b.hp?0:1);endRound(win);
 }
}
function updateHUD(){
 if(!match||players.length<2)return;
 $('name1').textContent=(classes[players[0].style]?.name||'БОЕЦ 1')+' • '+equipped(players[0].weapon).name;
 $('name2').textContent=role==='solo'?('БОТЫ • ОСТАЛОСЬ '+players.slice(1).filter(p=>p.hp>0).length+' / '+(players.length-1)):(classes[players[1].style]?.name||'БОЕЦ 2')+' • '+equipped(players[1].weapon).name;
 $('hp1').style.width=clamp(players[0].hp,0,100)+'%';
 $('hp2').style.width=(role==='solo'?players.slice(1).reduce((sum,p)=>sum+p.hp,0)/(players.length-1):clamp(players[1].hp,0,100))+'%';
 $('chi1').style.width=clamp(players[0].chi,0,100)+'%';
 $('chi2').style.width=(role==='solo'?0:clamp(players[1].chi,0,100))+'%';
 $('time').textContent=role==='solo'||mode==='endless'?'∞':String(Math.ceil(match.time)).padStart(2,'0');
 $('rounds').textContent=match.scores.map(x=>'●'.repeat(x)+'○'.repeat(2-x)).join('  ·  ');
}
function send(obj){
 if(connection&&connection.open)try{connection.send(obj)}catch(err){console.warn('send failed',err)}
}
function pollGamepad(){
 const pads=navigator.getGamepads?.()||[];const pad=Array.from(pads).find(p=>p&&p.connected);
 if(!pad){if(gamepadActive){gamepadActive=false;joystickAxis={x:0,y:0};for(const k of controls)input[k]=false;}return;}
 gamepadActive=true;
 const dead=v=>Math.abs(v)<.16?0:Math.sign(v)*(Math.abs(v)-.16)/.84;
 joystickAxis={x:dead(pad.axes[0]||0),y:dead(pad.axes[1]||0)};
 const pressed=n=>!!pad.buttons[n]?.pressed;
 input.left=joystickAxis.x<-.15||pressed(14);input.right=joystickAxis.x>.15||pressed(15);
 input.up=joystickAxis.y<-.15||pressed(12);input.down=joystickAxis.y>.15||pressed(13);
 input.jump=pressed(0);input.light=pressed(2);input.heavy=pressed(3);input.block=pressed(1);
 input.dash=pressed(4);input.special=pressed(5);input.shoot=pressed(7);input.super=pressed(6);
}
let tiltEnabled=false,tiltOrigin=null;
const tiltButton=$('tilt-camera');
const onOrientation=e=>{
 if(!tiltEnabled||e.gamma==null||e.beta==null)return;
 if(!tiltOrigin)tiltOrigin={gamma:e.gamma,beta:e.beta};
 const x=clamp((e.gamma-tiltOrigin.gamma)/27,-1,1);
 const y=clamp((e.beta-tiltOrigin.beta)/27,-1,1);
 gfx.setCameraTilt(x,y);
};
window.addEventListener('deviceorientation',onOrientation);
tiltButton.addEventListener('click',async()=>{
 if(tiltEnabled){tiltEnabled=false;tiltOrigin=null;gfx.setCameraTilt(0,0);tiltButton.textContent='📱 КАМЕРА: ВЫКЛ';tiltButton.setAttribute('aria-pressed','false');return;}
 try{
  if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
   const permission=await DeviceOrientationEvent.requestPermission();if(permission!=='granted')throw Error('Нет разрешения на датчики');
  }
  if(!('DeviceOrientationEvent' in window))throw Error('Датчик ориентации недоступен');
  tiltEnabled=true;tiltOrigin=null;tiltButton.textContent='📱 КАМЕРА: ВКЛ';tiltButton.setAttribute('aria-pressed','true');
 }catch(err){tiltButton.textContent='⚠ ДАТЧИК НЕДОСТУПЕН';console.warn(err);}
});
function liveFrame(ms){
 const dt=Math.min(.045,Math.max(0,(ms-(liveFrame.previous||ms))/1000));liveFrame.previous=ms;worldTime+=dt;
 pollGamepad();
 if(firstPerson)syncAim();
 if(performance.now()>hitUntil)$('fps-crosshair').classList.remove('hit');
 if(performance.now()>flashUntil)$('fps-muzzle').classList.remove('firing');
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
 firstPerson=false;aimPointer=null;gfx.setFirstPerson(false);document.body.classList.remove('first-person');viewButton.textContent='👁 ВИД ОТ ПЕРВОГО ЛИЦА';viewButton.setAttribute('aria-pressed','false');
 shutdown();role='menu';match=null;players=[];document.body.classList.remove('fight');
 $('menu').classList.remove('hidden');$('result-screen').classList.add('hidden');$('room-block').classList.add('hidden');
 $('net-status').textContent='';$('announce').classList.remove('visible');noticeDeadline=0;
 gfx.setStage(arena,mode,previewStyles());
}
function setNet(s){$('net-status').textContent=s}
function launchBot(){shutdown();botCount=clamp(parseInt($('bot-count').value,10)||1,1,10);$('bot-count-value').textContent=String(botCount);role='solo';newMatch(choice,'knight');$('hint').textContent='ВЫЖИВАНИЕ • УНИЧТОЖЬ ВСЕХ '+botCount+' БОТОВ';}
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
  if(!isHost){setNet('Связь установлена, ждём начала боя…');send({t:'hello',style:choice,weapon:weaponChoice,nick:myNick()})}
 });
 c.on('data',msg=>{
  if(!msg||typeof msg!=='object')return;
  if(isHost){
   if(msg.t==='hello'){
    const guest=classes[msg.style]?msg.style:'ninja';
    const guestNick=cleanNick(msg.nick||'ГОСТЬ');
    const guestWeapon=equipped(msg.weapon).id;
    newMatch(choice,guest,weaponChoice,guestWeapon);
    players[1].nick=guestNick;players[0].team='host';players[1].team='guest';
    send({t:'start',mode,arena,first:choice,second:guest,firstWeapon:weaponChoice,secondWeapon:guestWeapon,firstNick:myNick(),secondNick:guestNick});
    setNet('Друг подключён. Бой начался!');
   }
   if(msg.t==='input'&&msg.input){
    // Keep the guest's analog thumbstick axes (not only digital directions).
    // Clamp untrusted network input before applying it to the host simulation.
    const ax=Number(msg.input.axisX),ay=Number(msg.input.axisY);
    remoteInput={
     ...Object.fromEntries(controls.map(k=>[k,!!msg.input[k]])),
     ...(Number.isFinite(ax)?{axisX:clamp(ax,-1,1)}:{}),
     ...(Number.isFinite(ay)?{axisY:clamp(ay,-1,1)}:{})
    };
   }
   if(msg.t==='rematch'&&match?.phase==='finished'){const [p1,p2]=players;const firstNick=p1.nick,secondNick=p2.nick;newMatch(p1.style,p2.style,p1.weapon,p2.weapon);players[0].nick=firstNick;players[1].nick=secondNick;players[0].team='host';players[1].team='guest';send({t:'start',mode,arena,first:p1.style,second:p2.style,firstWeapon:p1.weapon,secondWeapon:p2.weapon,firstNick,secondNick})}
  }else{
   if(msg.t==='start'){
    mode=['duel','platform','endless'].includes(msg.mode)?msg.mode:'endless';
    arena='garden';
    role='guest';newMatch(classes[msg.first]?msg.first:'ronin',classes[msg.second]?msg.second:'knight',equipped(msg.firstWeapon).id,equipped(msg.secondWeapon).id);players[0].nick=cleanNick(msg.firstNick||'ХОЗЯИН');players[1].nick=cleanNick(msg.secondNick||myNick());players[0].team='host';players[1].team='guest';
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
 const clearStick=()=>{activeStick=null;joystickAxis={x:0,y:0};pad.classList.remove('engaged');knob.style.transform='translate3d(0px,0px,0)';for(const k of ['left','right','up','down'])input[k]=false;};
 const updateStick=(x,y)=>{
  const r=pad.getBoundingClientRect(),radius=Math.max(20,r.width*.34);
  let dx=x-r.left-r.width/2,dy=y-r.top-r.height/2;
  const magnitude=Math.hypot(dx,dy);if(magnitude>radius){dx*=radius/magnitude;dy*=radius/magnitude;}
  knob.style.transform='translate3d('+dx+'px,'+dy+'px,0)';
  const dead=radius*.18;
  joystickAxis={x:Math.abs(dx)<dead?0:dx/radius,y:Math.abs(dy)<dead?0:dy/radius};
  pad.classList.add('engaged');
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
 else if(role==='host'){const [p0,p1]=players;const firstNick=p0.nick,secondNick=p1.nick;newMatch(p0.style,p1.style,p0.weapon,p1.weapon);players[0].nick=firstNick;players[1].nick=secondNick;players[0].team='host';players[1].team='guest';send({t:'start',mode,arena,first:p0.style,second:p1.style,firstWeapon:p0.weapon,secondWeapon:p1.weapon,firstNick,secondNick})}
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
