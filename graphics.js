
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
const PALETTES={
 temple:{sky:['#1554a7','#ef7e87','#ffcc79'],accent:0xff9c4b,stone:0x736b75,roof:0xa83b46},
 grove:{sky:['#0a2537','#316677','#b1c797'],accent:0x91faad,stone:0x437b79,roof:0x295a59},
 cavern:{sky:['#10142d','#4d3171','#8b71a8'],accent:0x9a75ff,stone:0x443c68,roof:0x342752},
 citadel:{sky:['#273850','#b1a5a0','#d6c8a1'],accent:0xffca82,stone:0x827d82,roof:0x615c73},
 city:{sky:['#160e30','#47316f','#cb6696'],accent:0xf97dde,stone:0x494065,roof:0x3b3976}
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
 let terrain=[],tilePrototype=null,backdrop=null,skyPlane=null,illustratedBackdrop=null,shotMeshes=[],cameraCenter=0,baseWidth=19,screenRatio=1,currentViewWidth=19;
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
  scene.remove(world);world=new THREE.Group();scene.add(world);particles=[];glows=[];fighters=[];mode=playMode;cameraCenter=0;currentViewWidth=baseWidth;terrain=[];shotMeshes=[];
  backdrop=new THREE.Group();world.add(backdrop);
  const tile=new THREE.Group();tilePrototype=tile;
  const p=PALETTES[arena]||PALETTES.temple;arenaColor=p.accent;scene.fog.density=arena==='grove'?.019:.013;scene.fog.color.set(p.sky[0]);sun.color.setHex(p.accent);fill.color.setHex(arena==='grove'?0xa1ddff:0x76a2ff);
  const sky=addMesh(backdrop,new THREE.PlaneGeometry(170,90),new THREE.MeshBasicMaterial({map:skyTexture(p.sky),depthWrite:false,side:THREE.DoubleSide}),0,17,-66);sky.castShadow=false;sky.receiveShadow=false;skyPlane=sky;sky.visible=false;
  const artwork=arena==='grove'?jungleTexture():new THREE.TextureLoader().load('./assets/steel-arena-backdrop.svg');artwork.colorSpace=THREE.SRGBColorSpace;
  illustratedBackdrop=addMesh(backdrop,new THREE.PlaneGeometry(125,70),new THREE.MeshBasicMaterial({map:artwork,depthWrite:false,side:THREE.DoubleSide}),0,11,-37);
  illustratedBackdrop.castShadow=false;illustratedBackdrop.receiveShadow=false;
  for(let i=-5;i<=5;i++){
   if(illustratedBackdrop)break;
   const h=4+(Math.sin(i*4.93)+1)*1.5;const x=i*4.4;
   const hill=cyl(tile,mat(arena==='grove'?0x1b5358:0x2b2945),x,h*.27,-18,2.1,3.7,h,5);hill.rotation.y=.34;
  }
  const floor=box(tile,mat(p.stone),0,-.45,0,20.5,.9,19);
  // Retro-action bridge details: crates, steel bands, warning barrels and banners.
  for(const side of [-1,1]){
   for(let j=0;j<3;j++){
    const xx=side*(5.9+j*1.15),zz=5.5+(j%2)*1.2;
    box(tile,mat(0x805135),xx,.43,zz,.87,.85,.85);
    box(tile,M.ink,xx,.42,zz+.445,.84,.09,.045);
    box(tile,M.gold,xx,.42,zz-.445,.84,.08,.045);
   }
   const bx=side*8.2;
   cyl(tile,mat(0xc92f30),bx,.58,3.1,.4,.4,1.12,10);
   box(tile,M.ink,bx,.86,3.51,.65,.16,.05);
   box(tile,M.gold,bx,.48,3.52,.5,.11,.06);
   const flag=box(tile,mat(0x9f2638),side*7.5,2.6,-6.5,1.15,1.75,.08);
   flag.rotation.z=side*.09;
   box(tile,M.cream,side*7.5,2.65,-6.44,.38,.38,.06);
  }
  const paving=mat(arena==='city'?0x756781:arena==='grove'?0x617f78:0x988487);
  for(let row=-4;row<=4;row+=2)for(let col=-9;col<=9;col+=2){
   const slab=box(tile,paving,col*1.08+(row%2)*.38,.027,row*1.9,2.05,.065,3.55);
   slab.rotation.y=((row+col)%3-1)*.018;
  }
  for(let i=0;i<12;i++){
   const z=-7.7+(i%4)*4.9,x=-8.6+Math.floor(i/4)*8.4;
   const crack=box(tile,M.ink,x,.07,z,1.1,.018,.035);crack.rotation.y=i*.74;crack.castShadow=false;
  }
  // Stone paving provides strong perspective lines; no debug grid.
  box(tile,M.ink,0,-.89,0,21,.18,19.4);
  for(const z of [-10.3,10.3]){
   for(let j=-4;j<=4;j++){
    const x=j*2.45;
    const plinth=box(tile,mat(p.stone),x,.55,z,.85,1.1,.85);
    const column=cyl(tile,mat(arena==='grove'?0x56887a:0x82748a),x,2.1,z,.32,.43,2.4,10);
    box(tile,M.gold,x,3.34,z,.92,.17,.92);
    if(j===0){
     const flame=addMesh(tile,new THREE.ConeGeometry(.22,.72,9),new THREE.MeshBasicMaterial({color:0xffb86e}),x,3.82,z);
     flame.castShadow=false;
     const light=new THREE.PointLight(p.accent,3.5,7,2);light.position.set(x,3.6,z);tile.add(light);
    }
   }
  }
  for(let j=0;j<3;j++){
   const x=-9+j*8.2;
   const island=new THREE.Group();island.position.set(x,7+(j%2)*2,-27-j*3);tile.add(island);
   const rock=addMesh(island,new THREE.DodecahedronGeometry(2.5,1),mat(arena==='grove'?0x365c58:0x60506d));rock.scale.set(1.4,.48,1.1);
   const underside=addMesh(island,new THREE.ConeGeometry(1.9,3.6,7),mat(0x302a40),0,-2.2,0);underside.rotation.z=Math.PI;
   for(let k=0;k<3;k++){const cloud=ball(island,new THREE.MeshBasicMaterial({color:0xe4bad2,transparent:true,opacity:.22,depthWrite:false}),-2+k*1.8,-2.8,-1.5,.95,12);cloud.castShadow=false;}
  }
  // Layered foreground and background geometry makes the arena read as a deep 3D space.
  for(let j=0;j<9;j++){
   const x=-9+j*2.3, depth=-10-(j%3)*3.8;
   const rock=addMesh(tile,new THREE.DodecahedronGeometry(.65+(j%3)*.28,0),mat(arena==='grove'?0x365b62:0x50435e),x,.05,depth);
   rock.scale.set(1.35,.6,1.1);rock.rotation.y=j*.63;
   const pillar=cyl(tile,mat(p.stone),x,1.2,depth-1.6,.25,.36,2.4,8);
   pillar.rotation.z=(j%2?1:-1)*.08;
  }
  for(let j=0;j<12;j++){
   const x=-9+j*1.7;
   const pebble=addMesh(tile,new THREE.IcosahedronGeometry(.13+(j%3)*.045,0),mat(j%2?0xa9a0ae:0x6c697d),x,.045,3.8+(j%3)*.85);
   pebble.scale.set(1.6,.36,.9);pebble.castShadow=false;
  }
  for(let x=-10;x<=10;x+=1){box(tile,mat(arena==='city'?0x7c668e:0xb0a2a0),x,-.009,2.9,.05,.025,5.7)}
  for(let x=-9;x<=9;x+=3){box(tile,M.gold,x,-.015,3.7,.3,.025,.33)}
  // No walls: the floor repeats endlessly as the camera follows the fighters.
  const sideColors=[0x5c3c59,0x444568,0x376c67];
  for(let side of [-1,1]){
   if(arena==='grove'){
    for(let j=0;j<4;j++)jungleTree(tile,side*(5.7+j*1.7),-5.8-(j%2)*4,.8+(j%3)*.2);
    for(let j=0;j<5;j++) bamboo(tile,side*(6.6+j*.5),-5.5-j*.75,.72+j*.13);
    torii(tile,side*8,-12,.8,0x477e70);
   }else if(arena==='cavern'){
    for(let j=0;j<7;j++){const xx=side*(5+j*1.5);const crystal=addMesh(tile,new THREE.ConeGeometry(.35+j%3*.18,1.5+j%3,6),new THREE.MeshStandardMaterial({color:0x9474ee,emissive:0x5b3bd5,emissiveIntensity:.8}),xx,.8,-8-j%3);crystal.rotation.z=side*.25;}
   }else if(arena==='citadel'){
    for(let j=0;j<5;j++){const xx=side*(5.5+j*1.65);cyl(tile,mat(0xb5a99e),xx,2.2,-9,.38,.52,4.4,12);box(tile,mat(0xc8b8a1),xx,4.5,-9,1.1,.28,1.1);}
   }else if(arena==='city'){
    for(let j=0;j<6;j++){const xx=side*(6.3+j*1.45);const ht=3+(j%3)*1.2;box(tile,mat(sideColors[j%3]),xx,ht*.5,-10,1.2,ht,1.35);
      for(let yy=1;yy<ht;yy+=.75){box(tile,mat(j%2?0x8a70d1:0xfd9dc5),xx,yy,-9.29,.58,.1,.03)}}
    lantern(tile,side*6.8,2.5,-4,0xfa79ec);
   }else{
    const house=new THREE.Group();house.position.set(side*8,0,-8);tile.add(house);
    box(house,mat(0x644459),0,1.55,0,3,3,2);roof(house,mat(p.roof),0,3.35,0,3.8);box(house,M.gold,0,1.7,1.03,1,.85,.13);
    torii(tile,side*5.1,-9,.7,0xb8494c);lantern(tile,side*6.7,2.2,-3.4,0xffba77);
   }
  }
  if(mode==='platform'){
   const spots=[[-5.2,2.05,3.1],[0,3.05,3.45],[5.1,2.1,3.1]];
   for(const [x,y,w] of spots){
    box(tile,M.ink,x,y-.22,0,w,.35,3.2);
    box(tile,mat(arena==='grove'?0x8fc59e:p.accent),x,y-.02,0,w,.11,3.3);
    for(let s of [-1,1]){box(tile,M.gold,x+s*(w/2-.22),y-.1,1.5,.12,.31,.12)}
   }
  }
  terrain=[tile];
  for(let i=0;i<2;i++) fighters.push(makeFighter(styles[i],i));
  renderer.setClearColor(0x080b17);
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
   f.root.visible=s.hp>0||s.y>-2;
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
  const targetX=a&&b?(a.x+b.x)/2:0;
  const separation=a&&b?Math.abs(a.x-b.x):0;
  cameraCenter+=(targetX-cameraCenter)*Math.min(1,delta*4.5);
  const desiredWidth=Math.max(baseWidth,separation+8);
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
  const orbit=.55+Math.sin(t*.75)*.14;
  const distance=Math.max(17,currentViewWidth/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect)+2);
  const dolly=distance+Math.sin(t*.73)*1.35;
  camera.position.x=cameraCenter+Math.sin(orbit)*dolly*.72+Math.sin(now*.12)*camShake*.18;
  camera.position.y=8.7+Math.sin(t*1.27)*.8+Math.cos(now*.11)*camShake*.14;
  camera.position.z=Math.cos(orbit)*dolly;
  camera.lookAt(cameraCenter,1.55,(a?.z??0)*.5+(b?.z??0)*.5);
  camera.rotation.z=Math.sin(t*.8)*.012;
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
  screenRatio=h/w;baseWidth=Math.max(19,10.6*w/h);currentViewWidth=Math.max(baseWidth,currentViewWidth);
  camera.aspect=w/h;camera.updateProjectionMatrix();
 }
 resize();addEventListener('resize',resize);
 return {setStage,sync,impact,resize,renderer};
}
