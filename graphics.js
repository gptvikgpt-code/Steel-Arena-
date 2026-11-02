
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
const PALETTES={
 temple:{sky:['#1554a7','#ef7e87','#ffcc79'],accent:0xff9c4b,stone:0x736b75,roof:0xa83b46},
 grove:{sky:['#0a2537','#316677','#b1c797'],accent:0x91faad,stone:0x437b79,roof:0x295a59},
 cavern:{sky:['#10142d','#4d3171','#8b71a8'],accent:0x9a75ff,stone:0x443c68,roof:0x342752},
 citadel:{sky:['#273850','#b1a5a0','#d6c8a1'],accent:0xffca82,stone:0x827d82,roof:0x615c73},
 city:{sky:['#160e30','#47316f','#cb6696'],accent:0xf97dde,stone:0x494065,roof:0x3b3976},
 desert:{sky:['#263c70','#e4a66c','#fbe4a5'],accent:0xffc16d,stone:0xc5a16b,roof:0x99734c},
 glacier:{sky:['#102d59','#4c8eb3','#d9f6ff'],accent:0x8af2ff,stone:0x6aa6bd,roof:0x7bb9d1},
 volcano:{sky:['#160b1b','#8d2b25','#ff8b3d'],accent:0xff6635,stone:0x41383e,roof:0x6d2928},
 space:{sky:['#090d30','#282363','#6450ac'],accent:0x88aaff,stone:0x39476e,roof:0x293457},
 desert:{sky:['#344b8d','#d9874f','#ffe1a0'],accent:0xffd17b,stone:0xb88a57,roof:0x9a5e37},
 glacier:{sky:['#08253f','#3a86ae','#b7f5ff'],accent:0x83edff,stone:0x568da7,roof:0x37657c},
 volcano:{sky:['#130e1d','#61232c','#e86a2f'],accent:0xff693a,stone:0x4b3840,roof:0x7a3432},
 space:{sky:['#05091e','#1d2761','#663ea4'],accent:0x80e5ff,stone:0x26375d,roof:0x374a81}
};
const gradData=new Uint8Array([24,24,28,255,105,105,115,255,210,210,215,255,255,255,255,255]);
const gradient=new THREE.DataTexture(gradData,4,1,THREE.RGBAFormat);gradient.magFilter=gradient.minFilter=THREE.NearestFilter;gradient.needsUpdate=true;
const mat=(c)=>new THREE.MeshToonMaterial({color:c,gradientMap:gradient});
const M={ink:mat(0x192134),cream:mat(0xffe5b9),gold:mat(0xe7b66e),iron:mat(0x9baeca),white:mat(0xfff6e2),skin:mat(0xf5c29d),dark:mat(0x2c354b)};
function addMesh(parent,geometry,material,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function box(g,ma,x,y,z,w,h,d){return addMesh(g,new THREE.BoxGeometry(w,h,d),ma,x,y,z)}
function ball(g,ma,x,y,z,r,seg=14){return addMesh(g,new THREE.SphereGeometry(r,seg,10),ma,x,y,z)}
function cyl(g,ma,x,y,z,r1,r2,h,n=9){return addMesh(g,new THREE.CylinderGeometry(r1,r2,h,n),ma,x,y,z)}
export function createGraphics(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.38;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.3));
 // Crisp retro-action look without flattening the actual 3D scene.
 renderer.toneMappingExposure=1.62;
 const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x1c213f,.013);
 const camera=new THREE.PerspectiveCamera(48,1,.1,260);
 camera.position.set(0,7.8,25);camera.lookAt(0,2,0);
 scene.add(new THREE.HemisphereLight(0xcbdffb,0x65506a,2.1));
 const sun=new THREE.DirectionalLight(0xffe3bd,3);sun.position.set(-6,14,9);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-17;sun.shadow.camera.right=17;sun.shadow.camera.top=15;sun.shadow.camera.bottom=-14;sun.shadow.normalBias=.025;scene.add(sun);
 const fill=new THREE.DirectionalLight(0x6caeff,1.45);fill.position.set(8,6,-10);scene.add(fill);
 const rim=new THREE.DirectionalLight(0x9edbff,2.3);rim.position.set(3,8,-5);scene.add(rim);
 let world=new THREE.Group();scene.add(world);let fighters=[],particles=[],glows=[],arenaColor=0xffac65,mode='duel',camShake=0,blur=0;
 let terrain=[],tilePrototype=null,backdrop=null,skyPlane=null,illustratedBackdrop=null,shotMeshes=[],cameraCenter=0,baseWidth=36,screenRatio=1,currentViewWidth=36;
 let tiltTarget={x:0,y:0},tiltNow={x:0,y:0},firstPerson=false,aimYaw=Math.PI/2,aimPitch=-.12;
 function setAim(yaw,pitch){aimYaw=yaw;aimPitch=THREE.MathUtils.clamp(pitch,-1.1,.8);}
 let poopMarkers=new Map();
 function setFirstPerson(enabled){firstPerson=!!enabled;camera.fov=firstPerson?82:48;camera.updateProjectionMatrix();}
 function setCameraTilt(x=0,y=0){tiltTarget.x=THREE.MathUtils.clamp(x,-1,1);tiltTarget.y=THREE.MathUtils.clamp(y,-1,1)}
 function skyTexture(colors){
  const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');
  const grd=ctx.createLinearGradient(0,0,0,256);colors.forEach((color,i)=>grd.addColorStop(i/(colors.length-1),color));ctx.fillStyle=grd;ctx.fillRect(0,0,512,256);
  ctx.fillStyle='#ffedc0';ctx.globalAlpha=.84;ctx.beginPath();ctx.arc(365,122,27,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.13;ctx.beginPath();ctx.arc(365,122,45,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  for(let l=0;l<4;l++){ctx.beginPath();const y=174+l*19;ctx.moveTo(0,256);ctx.lineTo(0,y);for(let x=0;x<=512;x+=19){let peak=Math.sin(x*.03+l*3)*12+Math.sin(x*.07+l*4)*7;ctx.lineTo(x,y-peak-(x%57===0?22:0))}ctx.lineTo(512,256);ctx.closePath();ctx.fillStyle=['#17274088','#203047aa','#22273bc9','#151e33ea'][l];ctx.fill()}
  for(let i=0;i<60;i++){let x=(i*159.7)%512,y=(i*35.8)%145;ctx.globalAlpha=.2+(i%5)/15;ctx.fillStyle='#fff6d1';ctx.fillRect(x,y,i%7===0?3:1,1)}ctx.globalAlpha=1;
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;return t;
 }
 function roof(g,ma,x,y,z,w=2.7){const p=box(g,ma,x,y,z,w,.2,1.55);p.rotation.z=0;const a=box(g,ma,x-w*.46,y+.16,z, w*.18,.18,1.65);a.rotation.z=-.38;const b=box(g,ma,x+w*.46,y+.16,z,w*.18,.18,1.65);b.rotation.z=.38}
 function lantern(g,x,y,z,color){
  cyl(g,M.ink,x,y+.35,z,.035,.035,.7);const lamp=box(g,mat(color),x,y,z,.34,.49,.33);lamp.material.emissive=new THREE.Color(color);lamp.material.emissiveIntensity=.35;box(g,M.gold,x,y+.25,z,.44,.09,.42);box(g,M.gold,x,y-.26,z,.43,.09,.42);
 }
 function torii(g,x,z,scale,color){
  const ob=new THREE.Group();ob.position.set(x,0,z);ob.scale.setScalar(scale);g.add(ob);
  for(const px of [-1.4,1.4]){cyl(ob,mat(color),px,2.1,0,.17,.2,4.25,8);box(ob,M.ink,px,.21,.1,.65,.15,.68)}
  box(ob,mat(color),0,4.0,0,3.6,.29,.42);box(ob,M.ink,0,4.28,0,4.25,.24,.58);box(ob,M.gold,0,3.4,.05,2.5,.12,.35);
 }
 function bamboo(g,x,z,scale){
  const ob=new THREE.Group();ob.position.set(x,0,z);ob.scale.setScalar(scale);g.add(ob);
  for(let j=0;j<3;j++){const xx=(j-1)*.38;cyl(ob,mat([0x4c8e73,0x6dba84,0x9bcf8f][j]),xx,2+j*.25,0,.075,.095,4+j*.6,7);for(let v=.9;v<4.3;v+=.72){cyl(ob,M.cream,xx,v,0,.09,.09,.034);for(const d of [-1,1]){let leaf=addMesh(ob,new THREE.ConeGeometry(.2,.85,5),mat(0x61ac80),xx+d*.18,v+.18,0);leaf.rotation.z=d*.95}}}
 }

 function jungleTexture(){
  const c=document.createElement('canvas');c.width=1024;c.height=576;const ctx=c.getContext('2d');
  const sky=ctx.createLinearGradient(0,0,0,576);sky.addColorStop(0,'#092c27');sky.addColorStop(.43,'#367e69');sky.addColorStop(.8,'#b6cfa1');sky.addColorStop(1,'#1b4a38');ctx.fillStyle=sky;ctx.fillRect(0,0,1024,576);
  const glow=ctx.createRadialGradient(610,155,5,610,155,320);glow.addColorStop(0,'#fff8c9cc');glow.addColorStop(.5,'#d3e6a755');glow.addColorStop(1,'#b0e3b000');ctx.fillStyle=glow;ctx.fillRect(0,0,1024,576);
  let seed=173;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  for(let layer=0;layer<5;layer++){
   const y=230+layer*65;ctx.fillStyle=['#386c60','#285f4e','#20523e','#174735','#0c322b'][layer];
   for(let i=0;i<55;i++){const x=i*22+rnd()*28-30,h=35+rnd()*110+layer*10;ctx.fillRect(x,y-h,5+layer*2,h+120);
    ctx.beginPath();ctx.ellipse(x,y-h,24+rnd()*40,23+rnd()*40,rnd()*.6,0,Math.PI*2);ctx.fill();}
  }
  for(let j=0;j<3;j++){
   const x=210+j*340,y=310+j*35;ctx.fillStyle='#435e51';ctx.beginPath();ctx.moveTo(x-115,y);ctx.lineTo(x-70,y-115);ctx.lineTo(x+80,y-125);ctx.lineTo(x+120,y);ctx.fill();
   const water=ctx.createLinearGradient(x-25,0,x+30,0);water.addColorStop(0,'#a8efe5');water.addColorStop(.5,'#e4ffff');water.addColorStop(1,'#379c9d');ctx.fillStyle=water;ctx.fillRect(x-25,y-5,55,260);
  }
  for(let i=0;i<95;i++){const x=rnd()*1024,y=420+rnd()*155;ctx.fillStyle=i%3?'#173e2c':'#4e8250';ctx.beginPath();ctx.ellipse(x,y,5+rnd()*25,6+rnd()*20,rnd()*3,0,Math.PI*2);ctx.fill();}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;
 }
 function jungleTree(g,x,z,scale){
  const tree=new THREE.Group();tree.position.set(x,0,z);tree.scale.setScalar(scale);g.add(tree);
  const bark=mat(0x574a34),leaf=mat(0x245b32),bright=mat(0x3f8846);
  cyl(tree,bark,0,3,0,.3,.48,6,9);
  for(let i=0;i<5;i++){
   const angle=i*Math.PI*2/5,dx=Math.cos(angle)*1.45,dz=Math.sin(angle)*1.45;
   const branch=cyl(tree,bark,dx*.52,5.1,dz*.52,.13,.22,2.5,7);branch.rotation.z=-Math.cos(angle)*.65;branch.rotation.x=Math.sin(angle)*.65;
   const crown=addMesh(tree,new THREE.IcosahedronGeometry(1.65,1),i%2?leaf:bright,dx,6.1+(i%2)*.4,dz);crown.scale.set(1.15,.65,1.05);
  }
  const crown=addMesh(tree,new THREE.IcosahedronGeometry(1.9,1),leaf,0,7.15,0);crown.scale.y=.7;
  for(let i=0;i<4;i++){const vine=cyl(tree,mat(0x3b7c39),Math.sin(i*2)*1.1,4.6,Math.cos(i*2)*1.1,.035,.05,2.4,5);vine.rotation.z=.13;}
 }
 function setStage(arena,playMode,styles){
  scene.remove(world);world=new THREE.Group();scene.add(world);
  particles=[];glows=[];fighters=[];mode=playMode;cameraCenter=0;currentViewWidth=baseWidth;terrain=[];shotMeshes=[];poopMarkers=new Map();
  backdrop=new THREE.Group();world.add(backdrop);
  const tile=new THREE.Group();tilePrototype=tile;
  const grass=mat(0x67b96a),grassLight=mat(0x8ad179),stone=mat(0x8e9486),wall=mat(0xb6a989),wood=mat(0x9c633e),roofMat=mat(0xc85e4f),leaf=mat(0x3c955a),flowerYellow=mat(0xffdf5a),flowerPink=mat(0xff76ad);
  arenaColor=0x9ad6a2;scene.fog.density=.007;scene.fog.color.setHex(0xa8e1f5);sun.color.setHex(0xffe5aa);fill.color.setHex(0x9edaff);
  const sky=addMesh(backdrop,new THREE.PlaneGeometry(210,115),new THREE.MeshBasicMaterial({map:skyTexture(['#71b9e8','#b8e8e5','#e9f6c1']),depthWrite:false,side:THREE.DoubleSide}),0,20,-80);
  sky.castShadow=false;sky.receiveShadow=false;skyPlane=sky;sky.visible=false;
  illustratedBackdrop=sky;
  box(tile,grass,0,-.5,0,20.5,1,70);
  // Garden paths, stone stepping tiles, meadows and colourful flowers.
  for(let z=-30;z<=30;z+=3)for(let x=-9;x<=9;x+=3){
   const n=Math.abs(Math.sin(x*13.3+z*9.7));
   if(n>.67){const patch=box(tile,grassLight,x,.035,z,1.6,.05,1.5);patch.rotation.y=n*.4;}
   if(n>.35)for(let k=0;k<3;k++){
    const fx=x+Math.sin(n*11+k*2)*.8,fz=z+Math.cos(n*13+k*2)*.8;
    cyl(tile,mat(0x3d9454),fx,.18,fz,.035,.04,.36,5);
    const petal=ball(tile,k%2?flowerPink:flowerYellow,fx,.42,fz,.16,7);petal.scale.y=.6;
   }
  }
  for(let z=-30;z<=30;z+=2.6){
   box(tile,stone,0,.035,z,3.1,.09,2.3);
   if(z%2<1)for(let x of [-1.2,1.2])box(tile,wall,x,.105,z,.13,.07,2.1);
  }
  // Wide walkable maze with low stone hedges, breaks, side routes and courtyards.
  const mazeWalls=[
   [-7,-19,1.1,11],[-3.5,-15,7,.9],[5,-19,1.1,12],
   [-7,1,1.1,13],[-3,5,6,.9],[7,0,1.1,14],
   [-5,20,1.1,10],[4,19,1.1,10],[-1,25,8,.9],
   [-5,-1,5,.9],[4,-8,5,.9]
  ];
  for(const [x,z,w,d] of mazeWalls){
   box(tile,wall,x,.72,z,w,1.4,d);
   box(tile,stone,x,1.48,z,w+.16,.17,d+.16);
   for(const side of [-1,1])if(w>3){
    const bush=ball(tile,leaf,x+side*(w*.36),1.7,z,.55,9);bush.scale.y=.65;
   }
  }
  // Three small cottages with doors, windows, chimneys and sloping roofs.
  for(const [hx,hz,turn] of [[-7,-9,0],[7,13,Math.PI],[-7,13,0]]){
   const house=new THREE.Group();house.position.set(hx,0,hz);house.rotation.y=turn;tile.add(house);
   box(house,mat(0xf5d9aa),0,1.35,0,3.3,2.7,3);
   const top=addMesh(house,new THREE.ConeGeometry(2.65,1.8,4),roofMat,0,3.4,0);top.rotation.y=Math.PI/4;top.scale.z=.95;
   box(house,wood,0,.85,1.54,.85,1.7,.1);
   box(house,mat(0x8be6ed),-1,1.65,1.55,.65,.75,.08);
   box(house,mat(0x8be6ed),1,1.65,1.55,.65,.75,.08);
   box(house,stone,1.05,3.65,-.6,.55,1.3,.55);
  }
  // Waterfall cliffs and rivers flank the battlefield, visible in first person.
  const water=new THREE.MeshStandardMaterial({color:0x39a6d9,roughness:.17,metalness:.12,transparent:true,opacity:.82,emissive:0x075273,emissiveIntensity:.18});
  const foam=new THREE.MeshBasicMaterial({color:0xc9faff,transparent:true,opacity:.8,depthWrite:false});
  for(const side of [-1,1]){
   for(let z=-28;z<=28;z+=8){
    const x=side*10;
    box(tile,mat(0x667c66),x,2.1,z,2.2,4.2,7.5);
    box(tile,grassLight,x,4.24,z,2.6,.35,7.7);
    box(tile,water,side*8.95,2.1,z,.16,4.1,3.2);
    for(let k=0;k<4;k++)box(tile,foam,side*8.85,.12,z-1.1+k*.7,.2,.12,.38);
    const pool=box(tile,water,side*8.2,.045,z,1.35,.055,4.3);pool.castShadow=false;
   }
  }
  // Trees, bushes, rocks, barrels and crates scattered without blocking the spawn.
  for(let j=0;j<24;j++){
   const side=j%2?-1:1,x=side*(5.5+(j%4)*.7),z=-30+j*2.6;
   cyl(tile,wood,x,1.05,z,.23,.3,2.1,7);
   const crown=ball(tile,leaf,x,2.55,z,1.05,10);crown.scale.y=1.25;
   if(j%3===0){const rock=addMesh(tile,new THREE.DodecahedronGeometry(.65,0),stone,x-side*1.25,.35,z);rock.scale.y=.65;}
  }
  for(let j=0;j<14;j++){
   const x=(j%2?-1:1)*(3.9+(j%3)*1.05),z=-26+j*4;
   if(Math.abs(z)<5)continue;
   if(j%2){box(tile,wood,x,.43,z,.8,.85,.8);box(tile,stone,x,.87,z,.82,.08,.82);}
   else cyl(tile,mat(0xc54843),x,.55,z,.4,.4,1.1,10);
  }
  // No raised platform tiles: the entire environment is traversable at ground level.
  terrain=[tile];
  for(let i=0;i<2;i++)fighters.push(makeFighter(styles[i],i));
  renderer.setClearColor(0x9ad7ec);
 }
 function makeFighter(style,number){
  const g=new THREE.Group();world.add(g);const skin=mat(style.skin||0xf0c09d),primary=mat(style.color),secondary=mat(style.trim),metal=mat(style.metal||0xb0baca);
  const hips=new THREE.Group();hips.position.y=1.12;g.add(hips);cyl(hips,primary,0,.1,0,.43,.4,.43,8);
  const legs=[];
  for(let s of [-1,1]){
   const leg=new THREE.Group();leg.position.set(s*.28,-.05,0);hips.add(leg);legs.push(leg);
   cyl(leg,secondary,0,-.43,0,.16,.19,.85,9);
   box(leg,M.ink,0,-.83,.18,.35,.25,.66);
   box(leg,metal,0,-.32,.18,.27,.32,.09);
  }
  const torso=new THREE.Group();torso.position.y=1.4;g.add(torso);
  cyl(torso,primary,0,.32,0,.5,.37,1.04,9);
  box(torso,secondary,0,.46,.36,.79,.25,.15);
  box(torso,M.gold,0,-.1,.28,.92,.13,.45);
  // Raised armour plates and layered chest geometry add visible highlights and depth.
  const chest=addMesh(torso,new THREE.SphereGeometry(.52,16,12),primary,0,.36,.09);
  chest.scale.set(1,.87,.72);
  for(const side of [-1,1]){
   const plate=addMesh(torso,new THREE.SphereGeometry(.31,12,9),metal,side*.27,.43,.36);
   plate.scale.set(.92,.82,.35);
   const clasp=ball(torso,M.gold,side*.3,.24,.49,.065,10);
  }
  box(torso,M.ink,0,.32,.53,.08,.68,.045);
  const shoulders=[];
  for(let s of [-1,1]){
   const arm=new THREE.Group();arm.position.set(s*.64,.68,0);torso.add(arm);shoulders.push(arm);
   ball(arm,metal,0,-.09,0,.25);
   const pauldron=addMesh(arm,new THREE.SphereGeometry(.34,14,10),secondary,0,-.12,.04);
   pauldron.scale.set(1.22,.68,1.15);
   box(arm,M.gold,0,-.27,.29,.42,.07,.09);
   cyl(arm,primary,0,-.45,0,.18,.2,.64,8);
   ball(arm,skin,0,-.84,0,.19);
   box(arm,M.ink,0,-.7,.02,.33,.28,.35);
  }
  const cape=box(torso,secondary,0,-.18,-.38,1.08,1.25,.11);cape.rotation.x=.09;
  const head=new THREE.Group();head.position.set(0,2.46,.05);g.add(head);
  ball(head,skin,0,0,0,.41,20);
  ball(head,skin,0,-.16,.28,.18,12);
  for(const side of [-1,1])ball(head,skin,side*.37,-.04,0,.095,10);
  for(const s of [-1,1]) {ball(head,M.ink,s*.15,.065,.348,.056,8);box(head,M.cream,s*.15,.08,.383,.025,.018,.018)}
  const mouth=box(head,secondary,0,-.18,.37,.2,.035,.03);
  if(style.id==='ronin'){cyl(head,M.ink,0,.33,0,.43,.4,.31,10);const pony=addMesh(head,new THREE.ConeGeometry(.2,.6,8),M.ink,0,.78,-.12);pony.rotation.z=.22}
  else if(style.id==='knight'){cyl(head,metal,0,.25,0,.43,.47,.46,10);box(head,M.gold,0,.08,.42,.12,.18,.08);cyl(head,secondary,0,.72,0,.13,.18,.5,7)}
  else if(style.id==='ninja'){box(head,M.ink,0,.03,.35,.72,.27,.18);for(const s of [-1,1])box(head,M.cream,s*.14,.075,.458,.11,.045,.02)}
  else if(style.id==='mage'){cyl(head,secondary,0,.43,0,.56,.42,.15,9);const hat=addMesh(head,new THREE.ConeGeometry(.47,.78,8),primary,0,.83,0);hat.rotation.z=.14}
  else if(style.id==='brute'){for(const s of [-1,1]){const horn=addMesh(head,new THREE.ConeGeometry(.13,.43,7),M.gold,s*.28,.44,0);horn.rotation.z=-s*.35}}
  else {box(head,secondary,0,.34,0,.78,.22,.55);const plume=addMesh(head,new THREE.ConeGeometry(.14,.6,7),primary,0,.83,0);plume.rotation.z=.33}

  // Weapon is chosen independently of the fighter; each silhouette is visibly different.
  const weapon=new THREE.Group();weapon.position.set(.02,-.83,.11);shoulders[1].add(weapon);
  const held=style.weapon||({ronin:'sword',knight:'hammer',ninja:'daggers',mage:'staff',brute:'axe',lancer:'spear'}[style.id]||'sword');
  const grip=mat(0x604938);
  if(held==='sword'){
   box(weapon,grip,.28,-.1,0,.56,.12,.14);
   box(weapon,M.gold,.59,-.1,0,.13,.38,.24);
   box(weapon,metal,1.21,-.1,0,1.17,.19,.1);
   const tip=addMesh(weapon,new THREE.ConeGeometry(.12,.31,4),metal,1.93,-.1,0);tip.rotation.z=-Math.PI/2;
  }else if(held==='axe'){
   box(weapon,grip,.82,-.1,0,1.7,.12,.15);
   box(weapon,M.gold,.22,-.1,0,.25,.19,.2);
   box(weapon,metal,1.58,-.11,0,.25,.92,.25);
   const edge=box(weapon,metal,1.82,.03,0,.35,.74,.13);edge.rotation.z=-.14;
   box(weapon,M.ink,1.53,-.1,.145,.24,.23,.045);
  }else if(held==='spear'){
   box(weapon,grip,1.1,-.1,0,2.15,.105,.13);
   for(const x of [.32,1.53])box(weapon,M.gold,x,-.1,0,.11,.15,.17);
   const tip=addMesh(weapon,new THREE.ConeGeometry(.18,.8,7),metal,2.52,-.1,0);tip.rotation.z=-Math.PI/2;
  }else if(held==='staff'){
   box(weapon,grip,1.03,-.1,0,2.02,.14,.15);
   for(const x of [.25,.93,1.62])box(weapon,M.gold,x,-.1,0,.12,.19,.19);
   const orb=addMesh(weapon,new THREE.OctahedronGeometry(.26),secondary,2.17,-.1,0);orb.material.emissive=new THREE.Color(style.trim);orb.material.emissiveIntensity=.45;
   box(weapon,M.ink,1.85,-.1,0,.19,.23,.23);
  }else if(held==='hammer'){
   box(weapon,grip,.72,-.1,0,1.38,.14,.18);
   box(weapon,M.gold,1.35,-.1,0,.13,.32,.23);
   box(weapon,metal,1.52,-.1,0,.59,.7,.52);
   box(weapon,M.ink,1.52,.31,0,.63,.09,.57);
   box(weapon,M.ink,1.52,-.49,0,.63,.09,.57);
  }else if(held==='daggers'){
   box(weapon,grip,.16,-.1,0,.3,.14,.16);
   box(weapon,M.gold,.33,-.1,0,.1,.28,.18);
   box(weapon,metal,.73,-.1,0,.74,.13,.09);
   const tip=addMesh(weapon,new THREE.ConeGeometry(.08,.22,5),metal,1.18,-.1,0);tip.rotation.z=-Math.PI/2;
   const offHand=new THREE.Group();offHand.position.set(-.02,-.83,.14);shoulders[0].add(offHand);
   box(offHand,grip,-.14,-.1,0,.29,.14,.15);
   box(offHand,M.gold,-.29,-.1,0,.1,.25,.17);
   box(offHand,metal,-.66,-.1,0,.67,.12,.09);
  }
  const aura=addMesh(g,new THREE.RingGeometry(.51,.59,36),new THREE.MeshBasicMaterial({color:number===0?0xf7ae58:0x61dfff,transparent:true,opacity:.4,side:THREE.DoubleSide}),0,.022,0);aura.rotation.x=-Math.PI/2;aura.castShadow=false;
  const shadow=addMesh(g,new THREE.CircleGeometry(.73,26),new THREE.MeshBasicMaterial({color:0x050810,transparent:true,opacity:.45,depthWrite:false}),0,.025,0);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;
  return {root:g,torso,head,legs,arms:shoulders,cape,aura,shadow,weapon,style};
 }
 function sync(fighterStates,delta,now){
  if(!fighters.length)return;
  while(fighters.length<fighterStates.length){const i=fighters.length;const state=fighterStates[i];const fallback={skin:0xe7b48e,color:0x6479aa,trim:0xf4b865,weapon:'sword'};const style=state?.style?({ronin:{color:0x8a3548,trim:0xf4b865},knight:{color:0x406ab1,trim:0xe4c17b},ninja:{color:0x393d62,trim:0x6be0d8},mage:{color:0x653c9c,trim:0x7be4ff},brute:{color:0x9b4c36,trim:0xf9cf78},lancer:{color:0x2d827a,trim:0xc2e899}}[state.style]||{}):{};fighters.push(makeFighter({...fallback,...style,weapon:state?.weapon||'sword'},i));}
  // Defeated enemies become a cartoon poop emoji trophy, while their 3D fighter vanishes.
  fighterStates.forEach((state,i)=>{
   if(!state||i===0||state.hp>0||poopMarkers.has(i))return;
   const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
   const ctx=canvas.getContext('2d');ctx.font='104px "Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif';
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('💩',64,69);
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
   const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
   sprite.position.set(state.x,1.25,state.z||0);sprite.scale.set(2.2,2.2,1);world.add(sprite);
   poopMarkers.set(i,{sprite,texture});
  });
  fighters.forEach((f,i)=>{f.root.visible=i<fighterStates.length&&fighterStates[i]?.hp>0});
  fighterStates.forEach((s,i)=>{
   if(!s)return;const f=fighters[i];if(!f)return;const moving=Math.abs(s.vx)>.4||Math.abs(s.vz||0)>.4;const t=now*.004;
   const action=s.attack?.kind||null;const attackPhase=s.attack?1-Math.max(0,s.attack.remaining)/Math.max(.01,s.attack.duration):0;
   const turn=Math.sin(now*.0008+i*1.6)*.18;
   const lean=Math.sin(now*.002+i*2)*.065;
   f.root.position.set(s.x,s.y,s.z??0);f.root.scale.x=1;
   // Smooth yaw follows movement, including reversing direction and sidestepping.
   const desiredYaw=Math.abs(s.vx||0)+Math.abs(s.vz||0)>.25?Math.atan2(s.vx||0,s.vz||0):s.dir<0?-Math.PI/2:Math.PI/2;
   const angleDiff=Math.atan2(Math.sin(desiredYaw-(f.yaw??desiredYaw)),Math.cos(desiredYaw-(f.yaw??desiredYaw)));
   f.yaw=(f.yaw??desiredYaw)+angleDiff*Math.min(1,delta*9);
   // Continuous character turning, idle weight shifts, and attack spins.
   const spin=action==='super'?Math.sin(attackPhase*Math.PI)*Math.PI*1.7:action==='special'?Math.sin(attackPhase*Math.PI)*.9:0;
   f.root.rotation.y=f.yaw+turn+spin+(s.block?.22:0)+(moving?Math.sin(t*1.8)*.1:0);
   f.root.rotation.z=lean*.28+(s.hitstun>0?-.13*s.dir:0);
   const swing=Math.sin(t*2+i)*.025;
   f.torso.position.y=1.4+(s.grounded?Math.sin(t*2.8+i)*(moving?.085:.055):0);
   f.torso.rotation.y=Math.sin(t*.9+i)*.11+(s.attack?.kind==='heavy'?.16:0);
   f.torso.rotation.z=(s.vx||0)*-.018+(s.hitstun>0?.13:0)+Math.sin(t*1.3+i)*.075;
   f.head.rotation.z=-(s.vx||0)*.014+Math.sin(t+i)*.09;
   f.head.rotation.y=Math.sin(t*.7+i)*.19;
   f.legs[0].rotation.z=moving?Math.sin(t*5.5)*.65:Math.sin(t*.9)*.075;
   f.legs[1].rotation.z=moving?-Math.sin(t*5.5)*.65:-Math.sin(t*.9)*.075;
   f.arms[0].rotation.z=s.block?.8:moving?Math.sin(t*5.5)*.3:-.14+Math.sin(t*1.3)*.16;
   let hitAnim=0;
   if(s.attack&&s.attack.duration){const progress=1-Math.max(0,s.attack.remaining)/s.attack.duration;hitAnim=Math.sin(Math.min(1,progress)*Math.PI)*1.95;}
   f.arms[1].rotation.z=-.25-hitAnim+(moving?Math.sin(t*5.5+.7)*.2:Math.sin(t*1.4+i)*.15);
   f.arms[1].rotation.x=action?Math.sin(attackPhase*Math.PI)*-.9:Math.sin(t*.8)*.1;
   f.weapon.rotation.y=action?Math.sin(attackPhase*Math.PI)*.55:Math.sin(t*.9)*.1;
   f.cape.rotation.x=.08+(moving?.3:0)+(s.y>.15?.4:0)+Math.sin(t*2+i)*.19;
   f.aura.material.opacity=.18+(s.chi||0)/350;
   f.aura.scale.setScalar(1+(s.chi||0)/230);
   f.head.scale.y=s.hitstun>0?.93:1;
   // Never show a defeated fighter again: the poop trophy replaces its model.
   f.root.visible=s.hp>0 && !(firstPerson&&i===0);
  });
  // Render live projectile positions from the authoritative match state.
  const shots=fighterStates.flatMap((fighter,i)=>(fighter?.projectiles||[]).map(p=>({...p,owner:i})));
  while(shotMeshes.length<shots.length){const orb=addMesh(world,new THREE.SphereGeometry(.17,12,8),new THREE.MeshBasicMaterial({color:0xffd45a}),0,0,0);const halo=addMesh(orb,new THREE.SphereGeometry(.32,12,8),new THREE.MeshBasicMaterial({color:0xffa62d,transparent:true,opacity:.28,depthWrite:false}));orb.castShadow=false;halo.castShadow=false;shotMeshes.push(orb)}
  shotMeshes.forEach((mesh,i)=>{mesh.visible=i<shots.length;if(i<shots.length){mesh.position.set(shots[i].x,shots[i].y,shots[i].z);mesh.scale.setScalar(1+Math.sin(now*.024+i)*.2);}});
  for(let j=particles.length-1;j>=0;j--){
   const p=particles[j];p.life-=delta;p.mesh.position.addScaledVector(p.velocity,delta);p.velocity.y-=6*delta;
   p.mesh.scale.setScalar(Math.max(.02,p.life/p.max));p.mesh.material.opacity=Math.max(0,p.life/p.max);
   if(p.life<=0){world.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();particles.splice(j,1)}
  }
  // Follow the combat rather than stopping the fighters at invisible walls.
  const a=fighterStates[0],b=fighterStates[1];
  const active=fighterStates.filter(p=>p&&p.hp>0);
  const targetX=active.length?active.reduce((sum,p)=>sum+p.x,0)/active.length:0;
  const separation=active.length?Math.max(...active.map(p=>p.x))-Math.min(...active.map(p=>p.x)):0;
  cameraCenter+=(targetX-cameraCenter)*Math.min(1,delta*4.5);
  const desiredWidth=Math.max(baseWidth,separation+12);
  currentViewWidth+=(desiredWidth-currentViewWidth)*Math.min(1,delta*5);
  camera.aspect=1/screenRatio;
  camera.updateProjectionMatrix();
  const needed=Math.min(9,Math.max(3,Math.ceil(currentViewWidth/20)+2));
  while(terrain.length<needed){const chunk=tilePrototype.clone(true);world.add(chunk);terrain.push(chunk)}
  for(let i=0;i<terrain.length;i++){
   const tileIndex=Math.floor(cameraCenter/20)+i-Math.floor(terrain.length/2);
   terrain[i].position.x=tileIndex*20;
  }
  if(backdrop){backdrop.position.x=cameraCenter*.88;if(skyPlane)skyPlane.scale.x=Math.max(1,currentViewWidth/104);if(illustratedBackdrop)illustratedBackdrop.scale.x=Math.max(1,currentViewWidth/60)}
  camShake=Math.max(0,camShake-delta*8);
  // Floating cinematic camera: orbit, dolly, vertical drift and true 3D parallax.
  const t=now*.00023;
  tiltNow.x+=(tiltTarget.x-tiltNow.x)*Math.min(1,delta*5);
  tiltNow.y+=(tiltTarget.y-tiltNow.y)*Math.min(1,delta*5);
  const orbit=.25+Math.sin(t*.75)*.06+tiltNow.x*.24;
  const distance=Math.max(17,currentViewWidth/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect)+2);
  const dolly=distance+Math.sin(t*.73)*1.35;
  camera.position.x=cameraCenter+Math.sin(orbit)*dolly*.72+Math.sin(now*.12)*camShake*.18;
  camera.position.y=16.2+tiltNow.y*3.1+Math.sin(t*1.27)*.45+Math.cos(now*.11)*camShake*.14;
  camera.position.z=Math.cos(orbit)*dolly;
  camera.lookAt(cameraCenter+tiltNow.x*1.3,1.55,(a?.z??0)*.5+(b?.z??0)*.5+tiltNow.y*.9);
  camera.rotation.z=Math.sin(t*.8)*.012;
  if(firstPerson&&a){
   const eye=new THREE.Vector3(a.x,a.y+1.72+(a.grounded?Math.sin(now*.011)*Math.min(.035,Math.hypot(a.vx||0,a.vz||0)*.006):0),a.z||0);
   const direction=new THREE.Vector3(Math.sin(aimYaw)*Math.cos(aimPitch),Math.sin(aimPitch)+tiltNow.y*.12,Math.cos(aimYaw)*Math.cos(aimPitch)).normalize();
   camera.position.copy(eye);
   camera.up.set(0,1,0);
   camera.lookAt(eye.clone().addScaledVector(direction,15));
   if(fighters[0])fighters[0].root.visible=false;
  }
  renderer.render(scene,camera);
 }
 function impact(x,y,isSuper=false,parry=false){
  camShake=isSuper?1.5:parry?.6:.4;
  const colors=parry?[0x73e9fd,0xffffff,0x9ec7ff]:isSuper?[0xffe99c,0xff5c48,0xffcc44]:[0xffe3a4,0xffffff,0xf7a969];
  const count=isSuper?43:parry?16:23;
  for(let i=0;i<count;i++){
   const rr=Math.random()*Math.PI*2,speed=2.2+Math.random()*(isSuper?9:5);
   const mesh=addMesh(world,new THREE.OctahedronGeometry(.04+Math.random()*.105),new THREE.MeshBasicMaterial({color:colors[i%colors.length],transparent:true,opacity:1}),x,y+.8,(Math.random()-.5)*1.2);
   mesh.castShadow=false;mesh.receiveShadow=false;
   const life=.2+Math.random()*.48;
   particles.push({mesh,velocity:new THREE.Vector3(Math.cos(rr)*speed,Math.sin(rr)*speed+1,(Math.random()-.5)*4),life,max:life});
  }
 }
 function resize(){
  const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);
  screenRatio=h/w;baseWidth=Math.max(36,20*w/h);currentViewWidth=Math.max(baseWidth,currentViewWidth);
  camera.aspect=w/h;camera.updateProjectionMatrix();
 }
 resize();addEventListener('resize',resize);
 return {setStage,sync,impact,resize,renderer,setCameraTilt,setFirstPerson,setAim};
}
