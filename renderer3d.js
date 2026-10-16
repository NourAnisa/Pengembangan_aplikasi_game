/* Penjaga Sungai — original, local procedural 3D art. Three.js r180.
 * No remote models, textures, fonts, tracking, or runtime downloads.
 * The world and objective positions remain identical to the teaching model.
 */
import * as THREE from './vendor/three.module.js';

const LAND_Y = 0.58;
const toWorld = p => new THREE.Vector3((p.x - 800) / 40, LAND_Y, (p.y - 450) / 40);
const clamp = THREE.MathUtils.clamp;
const WEST = [[100,185],[255,245],[420,245],[590,230],[610,280],[590,355],[555,455],[550,490],[650,500],[650,548],[550,550],[505,610],[330,625],[110,595],[90,440]].map(([x,y])=>[(x-800)/40,(y-450)/40]);
const EAST = [[980,495],[980,550],[1100,560],[1170,600],[1510,610],[1540,520],[1535,310],[1450,245],[1260,205],[1130,245],[1070,330],[1045,440]].map(([x,y])=>[(x-800)/40,(y-450)/40]);
const WEST_VISUAL=[[-70,-45],[-17,-28],[-10,-15],...WEST.slice(2,12),[-8.8,9],[-10,22],[-70,42]];
const EAST_VISUAL=[...EAST.slice(0,3),[8.3,6],[9.2,14],[11,26],[70,42],[70,-45],[18,-29],[14,-14],...EAST.slice(8)];
const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
function rng(seed=7356) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function inPolygon(x,z,points) { let yes=false; for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if(((a[1]>z)!==(b[1]>z))&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes; }
const surfaceVertex = `varying vec3 vWorld; varying vec3 vNormal; void main(){vec4 p=modelMatrix*vec4(position,1.0); vWorld=p.xyz; vNormal=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*p;}`;

export class RiverRenderer {
  constructor({canvas,onPoint,onReady,onError}={}) {
    this.canvas=canvas; this.onPoint=onPoint; this.onReady=onReady; this.onError=onError;
    this.random=rng(); this.time=0; this.state=null; this.resources=[]; this.materials={}; this.treeLeaves=[];
    this.lastPlayer=V(-14.125,LAND_Y,2); this.lastStatus='title'; this.walkPhase=0; this.facing=0;
    this.mobile=typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches;
    this.quality=this.mobile?'medium':'high'; this.disposed=false; this._ready=false;
    try {
      this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance',stencil:false});
      const gl=this.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
      this.softwareRenderer=!!(debug&&/SwiftShader|llvmpipe|Software/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)));
      if(this.softwareRenderer)this.quality='low';
      this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,this.softwareRenderer ? 0.65 :this.mobile?1.25:1.5));
      this.renderer.outputColorSpace=THREE.SRGBColorSpace;
      this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=1.12;
      this.renderer.shadowMap.enabled=this.quality!=='low'; this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      this.scene=new THREE.Scene(); this.scene.background=new THREE.Color('#a5c9d5');
      this.scene.fog=new THREE.FogExp2('#b3c6c3',0.0105);
      this.camera=new THREE.PerspectiveCamera(43,1,0.1,230); this.camera.position.set(0,22.5,29.5); this.camera.lookAt(0,.2,-1.1);
      this.cameraTarget=V(0,.2,-1.1); this.raycaster=new THREE.Raycaster(); this.pointer=new THREE.Vector2(); this.groundPlane=new THREE.Plane(V(0,1,0),-LAND_Y);
      this._makeMaterials(); this._makeLighting(); this._makeSky(); this._makeWater(); this._makeIslands(); this._makeLandscape(); this._makeVillage(); this._makeMission(); this._makeAtmosphere(); this._batchStaticMeshes();
      this._pointerDown=e=>{this.down={x:e.clientX,y:e.clientY,t:performance.now()};};
      this._pointerUp=e=>{if(!this.down||Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>12)return;const r=this.canvas.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);const p=V();if(this.raycaster.ray.intersectPlane(this.groundPlane,p)&&this.onPoint)this.onPoint({x:p.x*40+800,y:p.z*40+450});};
      canvas.addEventListener('pointerdown',this._pointerDown); canvas.addEventListener('pointerup',this._pointerUp);
      this._contextLost=e=>{e.preventDefault();this.onError?.(new Error('Konteks grafis terhenti. Muat ulang halaman atau pilih kualitas ringan.'));};
      canvas.addEventListener('webglcontextlost',this._contextLost);
      this.resize(); this._ready=true; this.onReady?.();
    } catch(error) { this.error=error; this.onError?.(error); if(!onError)throw error; }
  }
  _standard(color,options={}) { const m=new THREE.MeshStandardMaterial({color,roughness:.86,...options}); this.resources.push(m); return m; }
  _mesh(geometry,material,parent=this.scene,{x=0,y=0,z=0,rx=0,ry=0,rz=0,cast=true,receive=true}={}) {
    const m=new THREE.Mesh(geometry,material); m.position.set(x,y,z); m.rotation.set(rx,ry,rz);m.castShadow=cast;m.receiveShadow=receive;parent.add(m);return m;
  }
  _box(w,h,d,material,parent=this.scene,x=0,y=0,z=0) {return this._mesh(new THREE.BoxGeometry(w,h,d),material,parent,{x,y,z});}
  _sphere(r,material,parent=this.scene,x=0,y=0,z=0,sx=1,sy=1,sz=1){const m=this._mesh(new THREE.SphereGeometry(r,14,10),material,parent,{x,y,z});m.scale.set(sx,sy,sz);return m;}
  _cylinder(a,b,r1,r2,material,parent=this.scene,segments=9){const d=b.clone().sub(a);const m=this._mesh(new THREE.CylinderGeometry(r2,r1,d.length(),segments),material,parent);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return m;}
  _tube(points,radius,material,parent=this.scene,closed=false,segments=24){return this._mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,closed),segments,radius,6,closed),material,parent);}
  _texture(kind) {
    const size=256,c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');const random=rng(kind==='wood'?80:130);
    ctx.fillStyle=kind==='wood'?'#a18257':kind==='roof'?'#596b63':'#c5bea4';ctx.fillRect(0,0,size,size);
    if(kind==='wood') {
      for(let i=0;i<230;i++){const x=random()*size;ctx.strokeStyle=`rgba(${random()>.6?'42,30,18':'244,208,154'},${.07+random()*.2})`;ctx.lineWidth=.3+random()*1.1;ctx.beginPath();ctx.moveTo(x,0);for(let y=0;y<=size;y+=12)ctx.lineTo(x+Math.sin(y*.025+i)*2.2,y);ctx.stroke();}
      for(let k=0;k<9;k++){const x=random()*size,y=random()*size;ctx.strokeStyle='rgba(61,40,24,.2)';for(let r=3;r<14;r+=3){ctx.beginPath();ctx.ellipse(x,y,r*.3,r,0,0,Math.PI*2);ctx.stroke();}}
    } else if(kind==='roof') {
      for(let x=0;x<size;x+=16){const g=ctx.createLinearGradient(x,0,x+16,0);g.addColorStop(0,'rgba(255,255,255,.14)');g.addColorStop(.45,'rgba(255,255,255,.04)');g.addColorStop(1,'rgba(0,10,7,.23)');ctx.fillStyle=g;ctx.fillRect(x,0,16,size);}
      for(let i=0;i<500;i++){ctx.fillStyle=`rgba(86,56,33,${random()*.2})`;ctx.fillRect(random()*size,random()*size,random()*12,random()*3);}
    } else {
      for(let i=0;i<13000;i++){const v=Math.round(70+random()*170);ctx.fillStyle=`rgba(${v},${v},${v-15},${.1+random()*.22})`;const s=.5+random()*2;ctx.fillRect(random()*size,random()*size,s,s);}
    }
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;this.resources.push(t);return t;
  }
  _makeMaterials(){
    const wood=this._texture('wood'),stone=this._texture('stone'),roof=this._texture('roof');
    this.materials={
      grass:this._standard('#a7ad89',{map:stone,bumpMap:stone,bumpScale:.024,roughness:1,vertexColors:true}),soil:this._standard('#877650',{roughness:1,map:stone}),
      sand:this._standard('#bcb38c',{map:stone,roughness:1}),rock:this._standard('#8e9b89',{map:stone,roughness:1}),darkRock:this._standard('#627872',{map:stone}),
      wood:this._standard('#a88b65',{map:wood,roughness:.87,bumpMap:wood,bumpScale:.045}),darkWood:this._standard('#66523b',{map:wood,bumpMap:wood,bumpScale:.04}),paleWood:this._standard('#c1ac82',{map:wood}),
      roof:this._standard('#506e6b',{map:roof,metalness:.12,roughness:.7}),roofRust:this._standard('#93674c',{map:roof,metalness:.08}),
      iron:this._standard('#485f62',{metalness:.65,roughness:.5}),rust:this._standard('#8d5538',{metalness:.45,roughness:.77}),gold:this._standard('#e2b95f',{metalness:.75,roughness:.28}),
      leaves:this._standard('#426e42',{roughness:.92,side:THREE.DoubleSide,vertexColors:true}),leafLight:this._standard('#78954e',{roughness:1,side:THREE.DoubleSide}),
      bark:this._standard('#78644b',{map:wood,roughness:1}),rope:this._standard('#b3a17a'),cloth:this._standard('#e4d1ab'),blue:this._standard('#356878'),
      trousers:this._standard('#334653'),boot:this._standard('#66503b'),red:this._standard('#bd4236',{roughness:.8}),skin:this._standard('#b67e52',{roughness:.77}),hair:this._standard('#272e29'),eye:this._standard('#172728'),
      white:this._standard('#ece3c9'),marker:this._standard('#ffda83',{emissive:'#e4a53e',emissiveIntensity:.55,metalness:.3,roughness:.35})
    };
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;const c=shadowCanvas.getContext('2d'),g=c.createRadialGradient(32,32,1,32,32,32);g.addColorStop(0,'rgba(12,26,18,.48)');g.addColorStop(.5,'rgba(12,26,18,.22)');g.addColorStop(1,'rgba(12,26,18,0)');c.fillStyle=g;c.fillRect(0,0,64,64);this.contactTexture=new THREE.CanvasTexture(shadowCanvas);this.resources.push(this.contactTexture);
  }
  _shadow(x,z,sx=1,sz=1,y=LAND_Y+.012,parent=this.scene){const m=new THREE.Mesh(new THREE.PlaneGeometry(sx*2,sz*2),new THREE.MeshBasicMaterial({map:this.contactTexture,transparent:true,depthWrite:false,opacity:.7}));m.rotation.x=-Math.PI/2;m.position.set(x,y,z);parent.add(m);return m;}
  _makeLighting(){
    this.scene.add(new THREE.HemisphereLight('#c0dde3','#4d5c31',2.2));
    this.sun=new THREE.DirectionalLight('#ffdcaa',3.6);this.sun.position.set(-16,28,12);this.sun.castShadow=true;
    Object.assign(this.sun.shadow.camera,{left:-27,right:27,top:21,bottom:-18,near:.5,far:90});
    const sz=this.softwareRenderer?512:this.mobile?1024:2048;this.sun.shadow.mapSize.set(sz,sz);this.sun.shadow.bias=-.00025;this.sun.shadow.normalBias=.045;this.sun.shadow.radius=3;this.scene.add(this.sun);
    const fill=new THREE.DirectionalLight('#a4dcdf',.65);fill.position.set(15,10,-16);this.scene.add(fill);
  }
  _makeSky(){
    const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color('#739fb6')},horizon:{value:new THREE.Color('#f3dfb9')}},vertexShader:'varying vec3 p; void main(){ p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',fragmentShader:'varying vec3 p; uniform vec3 top; uniform vec3 horizon; void main(){ float h=normalize(p).y; gl_FragColor=vec4(mix(horizon,top,pow(max(h,0.),.45)),1.); }'});
    this._mesh(new THREE.SphereGeometry(180,24,16),material,this.scene,{cast:false,receive:false});
    const sunMat=new THREE.MeshBasicMaterial({color:'#fff1cc',fog:false});this._sphere(2.6,sunMat,this.scene,-48,25,-76);
    // A locally generated sky environment supplies plausible reflections to metal and water.
    const envScene=new THREE.Scene();envScene.add(new THREE.Mesh(new THREE.SphereGeometry(30,24,16),material.clone()));
    const pmrem=new THREE.PMREMGenerator(this.renderer);this.environment=pmrem.fromScene(envScene,.04,.1,100);this.scene.environment=this.environment.texture;pmrem.dispose();envScene.children[0].geometry.dispose();envScene.children[0].material.dispose();
    const mountainMat=this._standard('#718f87',{roughness:1});
    for(let i=0;i<18;i++){const x=-76+i*9,y=5+this.random()*8,z=-38-this.random()*25;const m=this._mesh(new THREE.ConeGeometry(7+this.random()*8,y,28),mountainMat,this.scene,{x,y:y*.5-2,z,cast:false});m.scale.z=.6+this.random()*.6;m.rotation.y=this.random()*3;}
    for(let i=0;i<9;i++){const x=-50+i*13,z=-48-this.random()*18;for(let j=0;j<3;j++){this._sphere(3+this.random()*2,this._standard('#d5dfcc',{roughness:1}),this.scene,x+j*3,15+this.random()*3,z,1.5,.25,.6).castShadow=false;}}
  }
  _makeWater(){
    this.waterUniforms={uTime:{value:0},uSun:{value:this.sun.position.clone().normalize()},uClear:{value:0}};
    const material=new THREE.ShaderMaterial({uniforms:this.waterUniforms,vertexShader:`uniform float uTime; varying vec3 vWorld; void main(){vec3 p=position; vec4 w=modelMatrix*vec4(p,1.); w.y+=sin(w.x*1.3+uTime*.9)*.034+sin(w.z*1.7-w.x*.4+uTime*1.2)*.023; vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w;}`,
      fragmentShader:`uniform float uTime; uniform vec3 uSun; uniform float uClear; varying vec3 vWorld;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 a=floor(p),b=fract(p);b=b*b*(3.-2.*b);return mix(mix(hash(a),hash(a+vec2(1,0)),b.x),mix(hash(a+vec2(0,1)),hash(a+1.),b.x),b.y);}
      void main(){vec2 p=vWorld.xz; float t=uTime;
      float a=p.x*1.3+t*.9,b=p.y*1.7-p.x*.4+t*1.2,c=p.x*4.1+p.y*2.4-t*1.6;
      vec3 n=normalize(vec3(-cos(a)*.048+cos(b)*.012-cos(c)*.022,1.,-cos(b)*.042-cos(c)*.013));
      vec3 eye=normalize(cameraPosition-vWorld);float fres=pow(1.-max(dot(n,eye),0.),4.);
      float clouds=noise(p*.13+vec2(t*.008,0.));float rip=noise(p*2.5+vec2(t*.05,t*.13));
      vec3 col=mix(vec3(.012,.115,.14),vec3(.035,.25,.255),clouds*.62+uClear*.18);col=mix(col,vec3(.35,.58,.57),fres*.55);
      float spec=pow(max(dot(normalize(uSun+eye),n),0.),105.)*.85;col+=vec3(1.,.84,.59)*spec;
      float spark=pow(max(sin(p.x*6.2+sin(p.y*3.1+t)*2.-t*1.1),0.),36.)*pow(rip,4.);col+=vec3(.10,.19,.16)*spark;
      float d=length(cameraPosition-vWorld);float fog=1.-exp(-d*.003);col=mix(col,vec3(.45,.61,.58),fog*.25);
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`.replace('#include <tonemapping_fragment> #include <colorspace_fragment>','#include <tonemapping_fragment>\n#include <colorspace_fragment>')});
    this.water=this._mesh(new THREE.PlaneGeometry(190,190,100,100),material,this.scene,{y:-.13,rx:-Math.PI/2,cast:false,receive:false});
  }
  _makeIslands(){
    const colors=[];
    for(const points of [WEST_VISUAL,EAST_VISUAL]){
      const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
      const sides=new THREE.ExtrudeGeometry(shape,{depth:.85,bevelEnabled:true,bevelSegments:2,bevelSize:.2,bevelThickness:.13,curveSegments:3});
      this._mesh(sides,this.materials.soil,this.scene,{y:-.43,rx:-Math.PI/2});
      const top=new THREE.ShapeGeometry(shape);top.rotateX(-Math.PI/2);const pos=top.attributes.position;const color=new THREE.Color();const arr=[];
      for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);color.setHSL(.235+Math.sin(x*.5+z)*.013,.26+.05*Math.cos(z),.37+Math.sin(x*.55+z*.7)*.036);arr.push(color.r,color.g,color.b);}top.setAttribute('color',new THREE.Float32BufferAttribute(arr,3));this._mesh(top,this.materials.grass,this.scene,{y:LAND_Y});
      this._shore(points);
    }
    this._path([[-14.1,2],[-12.2,1.8],[-10.2,.5],[-10.05,-3.65]],.78);
    this._path([[-10.2,.5],[-7.7,1.5],[-5.2,1.75]],.77);
    this._path([[5.3,1.75],[7.25,1.6],[9.15,-.15],[11.2,-2.1],[14.3,-3.95]],.88);
    this._dock(-5.25,1.75,'west');this._dock(5.375,1.75,'east');
    // Pebbles, roots, and little ground plants are instanced, keeping the scene light.
    const matrices=[],hues=[];const dummy=new THREE.Object3D();
    for(let i=0;i<750;i++){const x=-18+this.random()*37,z=-6.3+this.random()*10.7;if(!inPolygon(x,z,WEST)&&!inPolygon(x,z,EAST))continue;const size=.025+this.random()*.07;dummy.position.set(x,LAND_Y+.018,z);dummy.scale.set(size*1.5,size*.4,size);dummy.rotation.set(this.random(),this.random()*6,this.random());dummy.updateMatrix();matrices.push(dummy.matrix.clone());hues.push(new THREE.Color().setHSL(.13,.12,.38+this.random()*.2));}
    const pebbles=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),this.materials.rock,matrices.length);matrices.forEach((m,i)=>{pebbles.setMatrixAt(i,m);pebbles.setColorAt(i,hues[i]);});pebbles.receiveShadow=true;this.scene.add(pebbles);
  }
  _shore(points){
    const pts=points.map(([x,z])=>V(x,0,z));const curve=new THREE.CatmullRomCurve3(pts,true,'centripetal');const verts=[],uv=[],idx=[];
    for(let i=0;i<=240;i++){const t=i/240,p=curve.getPoint(t%1),tangent=curve.getTangent(t%1),out=V(tangent.z,0,-tangent.x).normalize();const c=points.reduce((s,a)=>s.add(V(a[0],0,a[1])),V()).multiplyScalar(1/points.length);if(out.dot(p.clone().sub(c))<0)out.negate();
      for(const [j,d]of [[0,.12],[1,.62]]){const q=p.clone().addScaledVector(out,d);verts.push(q.x,-.047+Math.sin(i*.8)*.006,q.z);uv.push(t*30,j);}if(i<240){const n=i*2;idx.push(n,n+1,n+2,n+1,n+3,n+2);}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uTime:{value:0}},vertexShader:'varying vec2 v;varying vec3 p;void main(){v=uv;p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float uTime;varying vec2 v;varying vec3 p;void main(){float r=sin(v.x*8.+sin(p.x*4.+uTime)*2.+uTime*.65);float a=(1.-v.y)*(.18+.2*r)*smoothstep(1.,.6,v.y);gl_FragColor=vec4(.72,.85,.69,max(a,0.));}'});
    this._mesh(geo,mat,this.scene,{cast:false,receive:false});(this.foams??=[]).push(mat);
    const rockGeo=new THREE.IcosahedronGeometry(1,1),rocks=[];for(let i=0;i<105;i++){const t=i/105,p=curve.getPoint(t),rad=.13+this.random()*.15;const obj=new THREE.Object3D();obj.position.set(p.x,-.02+this.random()*.09,p.z);obj.rotation.set(this.random(),this.random()*6,this.random());obj.scale.set(rad*1.8,rad*1.2,rad);obj.updateMatrix();rocks.push(obj.matrix.clone());}
    const mesh=new THREE.InstancedMesh(rockGeo,this.materials.darkRock,rocks.length);rocks.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=mesh.receiveShadow=true;this.scene.add(mesh);
  }
  _path(points,width){const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>V(x,LAND_Y+.014,z)));const vs=[],uv=[],ids=[];for(let i=0;i<=100;i++){const p=curve.getPoint(i/100),tan=curve.getTangent(i/100),normal=V(tan.z,0,-tan.x).normalize();for(let s of [-1,1]){const q=p.clone().addScaledVector(normal,s*(width*.5+Math.sin(i*.9)*.045));vs.push(q.x,q.y,q.z);uv.push((s+1)/2,i/10);}if(i<100){const n=i*2;ids.push(n,n+2,n+1,n+1,n+2,n+3);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ids);g.computeVertexNormals();this._mesh(g,this.materials.sand);}
  _dock(x,z,side){const group=new THREE.Group();group.position.set(x,0,z);this.scene.add(group);const direction=side==='west'?1:-1;const length=3.05;
    for(let i=0;i<16;i++){const p=this._box(.17,.13,1.35,this.materials.wood,group,-direction*.9+i*.185*direction,.65,0);p.rotation.y=Math.sin(i)*.015;}
    for(const px of [-.82,1.75])for(const pz of [-.57,.57]){this._cylinder(V(px*direction,-.45,pz),V(px*direction,1.34,pz),.1,.09,this.materials.darkWood,group);this._cylinder(V(px*direction,1.30,pz),V(px*direction,1.4,pz),.13,.13,this.materials.paleWood,group);for(let k=0;k<3;k++){this._mesh(new THREE.TorusGeometry(.106,.019,5,12),this.materials.rope,group,{x:px*direction,y:1.13+k*.045,z:pz,rx:Math.PI/2});}}
    for(const pz of [-.59,.59])this._tube([V(-.82*direction,1.20,pz),V(.4*direction,.98,pz),V(1.75*direction,1.2,pz)],.023,this.materials.rope,group);
    this._box(2.9,.13,.12,this.materials.darkWood,group,.5*direction,.48,-.45);this._box(2.9,.13,.12,this.materials.darkWood,group,.5*direction,.48,.45);
  }
  _makeLandscape(){
    const palms=[[-17,-4.5],[-17.2,-1.6],[-16.5,2.5],[-17.5,3.6],[-6.7,-2.9],[-6,-4.2],[-8.1,-5.1],[-14.1,-5.5],[7.5,-4.5],[8.4,-3.4],[10.4,-4.65],[12.2,-5.25],[17.3,-2.5],[17.4,.3],[16.4,3.05],[18.5,5.8]];
    const treePoints=[[-17.3,.2],[-15.8,-4.4],[-12.7,-4.7],[-7.9,-3.5],[-7.3,-.9],[7.6,-2.2],[10.7,-4.45],[16.9,-3.75],[17.3,1.6],[20.2,2.6],[-19.8,2.6]];
    for(let i=0;i<20;i++){const side=i<10?-1:1;treePoints.push([side*(20+this.random()*15),-18+this.random()*30]);if(i%2===0)palms.push([side*(20+this.random()*10),-12+this.random()*24]);}
    this._palms(palms);this._broadleaf(treePoints);this._grass();
    // Reeds and water lilies around quiet edges, outside the navigation path.
    const lilyMat=this._standard('#517a41',{side:THREE.DoubleSide,roughness:.8});
    for(let i=0;i<32;i++){const x=(i<16?-1:1)*(8+this.random()*9),z=4.6+this.random()*3.3;const leaf=this._mesh(new THREE.CircleGeometry(.12+this.random()*.22,14,0,Math.PI*1.88),lilyMat,this.scene,{x,y:-.055,z,rx:-Math.PI/2,rz:this.random()*6,cast:false});if(i%8===0)this._sphere(.065,this.materials.white,this.scene,x,.015,z,1,.6,1);}
    for(let i=0;i<12;i++){const x=-26+this.random()*52,z=-12-this.random()*7;this._sphere(1+this.random()*2,this.materials.darkRock,this.scene,x,-.25,z,1,.38,.6);}
  }
  _palmLeafGeometry(){const pos=[],uv=[],ids=[];for(let i=0;i<=12;i++){const t=i/12,wide=Math.sin(t*Math.PI)*.19*(1-.3*t);const y=Math.sin(t*Math.PI)*.4-t*t*.6;for(const s of [-1,1]){pos.push(s*wide,y, t*2.5);uv.push((s+1)*.5,t);}if(i<12){let n=i*2;ids.push(n,n+1,n+2,n+1,n+3,n+2);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ids);g.computeVertexNormals();const cols=[];for(let i=0;i<pos.length;i+=3){const c=new THREE.Color().setHSL(.235,.29,.26+this.random()*.1);cols.push(c.r,c.g,c.b);}g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));return g;}
  _palms(points){const trunkGeo=new THREE.CylinderGeometry(.11,.135,1,9),trunks=new THREE.InstancedMesh(trunkGeo,this.materials.bark,points.length*9);const leafGeo=this._palmLeafGeometry(),leaves=new THREE.InstancedMesh(leafGeo,this.materials.leaves,points.length*10);const obj=new THREE.Object3D();let ti=0,li=0;for(const[x,z]of points){const h=3.0+this.random()*2.05,lean=(this.random()-.5)*1.15,angle=this.random()*6.28;const trunkPoints=[];for(let j=0;j<=9;j++){const t=j/9;trunkPoints.push(V(x+Math.sin(t*.9)*lean,LAND_Y+t*h,z+Math.cos(angle)*t*t*.45));}
      for(let j=0;j<9;j++){const a=trunkPoints[j],b=trunkPoints[j+1],d=b.clone().sub(a);obj.position.copy(a).add(b).multiplyScalar(.5);obj.quaternion.setFromUnitVectors(V(0,1,0),d.clone().normalize());obj.scale.set(1-j*.045,d.length()*1.05,1-j*.045);obj.updateMatrix();trunks.setMatrixAt(ti++,obj.matrix);}
      const crown=trunkPoints[9];this._shadow(x,z,.72,.6);for(let j=0;j<10;j++){const a=j*Math.PI*.2+angle;obj.position.copy(crown);obj.rotation.set(.06+this.random()*.45,a,(this.random()-.5)*.14);const scale=.7+this.random()*.3;obj.scale.set(scale,scale,scale);obj.updateMatrix();leaves.setMatrixAt(li++,obj.matrix);}
      for(let k=0;k<3;k++)this._sphere(.12,this.materials.bark,this.scene,crown.x+(k-1)*.12,crown.y-.17,crown.z+.1);
    }trunks.castShadow=trunks.receiveShadow=true;leaves.castShadow=leaves.receiveShadow=true;this.scene.add(trunks,leaves);this.palmLeaves=leaves;}
  _broadleaf(points){const trunkGeo=new THREE.CylinderGeometry(.11,.2,1,9),trunks=new THREE.InstancedMesh(trunkGeo,this.materials.bark,points.length*3);const canopyMaterial=this.materials.leaves.clone();canopyMaterial.vertexColors=false;canopyMaterial.color.set('#b8d5a3');const leaves=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),canopyMaterial,points.length*13);const obj=new THREE.Object3D();let ti=0,li=0;for(const[x,z]of points){const h=1.8+this.random()*.9;for(let j=0;j<3;j++){const a=j*2.1;const start=V(x,LAND_Y,z),end=V(x+Math.sin(a)*.45,LAND_Y+h,z+Math.cos(a)*.45);obj.position.copy(start).add(end).multiplyScalar(.5);obj.quaternion.setFromUnitVectors(V(0,1,0),end.clone().sub(start).normalize());obj.scale.set(j? .6:1,h, j?.6:1);obj.updateMatrix();trunks.setMatrixAt(ti++,obj.matrix);}
      for(let j=0;j<13;j++){const a=j*2.399,r=.2+this.random()*.95;obj.position.set(x+Math.cos(a)*r,LAND_Y+h+.2+this.random()*.9,z+Math.sin(a)*r);obj.rotation.set(this.random(),this.random()*6,this.random());const s=.6+this.random()*.45;obj.scale.set(s,s*.6,s);obj.updateMatrix();leaves.setMatrixAt(li,obj.matrix);leaves.setColorAt(li++,new THREE.Color().setHSL(.24+this.random()*.035,.24,.23+this.random()*.14));}this._shadow(x,z,1.5,1.1);
    }trunks.castShadow=true;leaves.castShadow=true;this.scene.add(trunks,leaves);}
  _grass(){const positions=[],colors=[];const green=new THREE.Color();for(let i=0;i<2600;i++){const x=-18+this.random()*37,z=-6.1+this.random()*10.4;if(!inPolygon(x,z,WEST)&&!inPolygon(x,z,EAST))continue;const path=Math.min(Math.hypot(x+10,z+.5),Math.hypot(x-10,z+1));if(path<2.25&&this.random()<.8)continue;const h=.07+this.random()*.2,w=.025+this.random()*.025;for(let j=0;j<2;j++){const a=this.random()*Math.PI;positions.push(x-Math.cos(a)*w,LAND_Y,z-Math.sin(a)*w,x+Math.cos(a)*w,LAND_Y,z+Math.sin(a)*w,x+Math.sin(a)*h*.25,LAND_Y+h,z+Math.cos(a)*h*.25);green.setHSL(.20+this.random()*.06,.25,.30+this.random()*.13);for(let k=0;k<3;k++)colors.push(green.r,green.g,green.b);}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();this._mesh(geo,this.materials.leaves,this.scene,{cast:false});
  }
  _makeVillage(){this._hut(-10.1,-5.35,3.55,2.65,true);this._hut(-15.2,-3.55,3.35,2.75,false);this._hut(15.3,1.4,2.65,2.35,false,.15);
    // Split bamboo fences and an old mooring post give scale without blocking paths.
    for(const side of [-1,1]){const z=side===-1?-5.5:3.5;for(let i=0;i<5;i++){const x=-13+i*.5;this._cylinder(V(x,LAND_Y,z),V(x,1.48+(i%2)*.08,z),.037,.025,this.materials.bark);if(i<4)for(const y of [1.02,1.32])this._cylinder(V(x,y,z),V(x+.5,y,z),.026,.026,this.materials.paleWood);}}
    for(let i=0;i<3;i++){const x=-12.5+i*.45,z=-2.8;this._barrel(x,z,.35);}
    this._sign(-11.8,-2.05,'GUDANG KUNCI');this._sign(-6.5,.7,'DERMAGA');this._sign(11.5,-2.7,'PINTU AIR');
  }
  _hut(x,z,w,d,warehouse=false,rotation=0){const g=new THREE.Group();g.position.set(x,LAND_Y,z);g.rotation.y=rotation;this.scene.add(g);const m=this.materials;
    for(const px of [-w*.43,w*.43])for(const pz of [-d*.42,d*.42])this._cylinder(V(px,-1,pz),V(px,1.1,pz),.11,.09,m.darkWood,g);
    this._box(w+.12,.14,d+.12,m.wood,g,0,.28,0);
    for(let i=0;i<Math.ceil(w/.24);i++){const px=-w/2+.12+i*.24;this._box(.225,1.9,.11,m.wood,g,px,1.3,-d/2);if(Math.abs(px)>.53)this._box(.225,1.9,.11,m.wood,g,px,1.3,d/2);}
    for(const px of [-w/2,w/2]){for(let i=0;i<Math.ceil(d/.24);i++){this._box(.11,1.9,.225,m.paleWood,g,px,1.3,-d/2+.12+i*.24);}}
    for(const pz of [-d/2-.03,d/2+.03])for(const y of [.5,2.09])this._box(w+.15,.11,.13,m.darkWood,g,0,y,pz);
    for(const px of [-w/2,w/2])this._box(.13,.11,d+.15,m.darkWood,g,px,2.09,0);
    // A dark open doorway, framed lintel, shuttered window, and porch steps.
    this._box(1.05,1.7,.07,m.darkWood,g,0,1.16,d/2-.04);this._box(.92,1.6,.025,this._standard('#29342b'),g,0,1.12,d/2+.008);
    for(const px of [-.57,.57])this._box(.11,1.85,.14,m.paleWood,g,px,1.20,d/2+.05);this._box(1.25,.15,.16,m.paleWood,g,0,2.05,d/2+.07);
    this._box(w+.2,.1,.6,m.wood,g,0,.3,d/2+.3);for(let i=0;i<2;i++)this._box(1.1,.13,.3,m.wood,g,0,.15-i*.13,d/2+.65+i*.25);
    for(const px of [-w*.32,w*.32]){this._box(.56,.65,.13,m.darkWood,g,px,1.43,d/2+.09);for(let k=0;k<4;k++)this._box(.6,.09,.08,m.paleWood,g,px,1.18+k*.15,d/2+.18);}
    const roofW=w/2+.43,roofD=d+.78,roofTop=3.03,eave=2.10;const vertices=[-roofW,eave,-roofD/2,0,roofTop,-roofD/2,roofW,eave,-roofD/2,-roofW,eave,roofD/2,0,roofTop,roofD/2,roofW,eave,roofD/2];
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,.5,1,1,0,0,0,.5,1,1,0],2));geo.setIndex([0,3,1,1,3,4,1,4,2,2,4,5]);geo.computeVertexNormals();const roofMat=(warehouse?m.roofRust:m.roof).clone();roofMat.side=THREE.DoubleSide;this._mesh(geo,roofMat,g);
    this._cylinder(V(0,roofTop+.01,-roofD/2-.02),V(0,roofTop+.01,roofD/2+.02),.066,.066,m.darkWood,g);
    for(const pz of [-roofD/2,roofD/2]){this._cylinder(V(-roofW,eave,pz),V(0,roofTop,pz),.045,.045,m.darkWood,g);this._cylinder(V(0,roofTop,pz),V(roofW,eave,pz),.045,.045,m.darkWood,g);}
    for(let i=0;i<8;i++){const pz=-roofD/2+i*roofD/7;for(const side of [-1,1])this._cylinder(V(0,roofTop+.018,pz),V(side*roofW,eave+.018,pz),.012,.012,m.iron,g);}
    // Rolled reed blind and small hanging lantern.
    this._cylinder(V(-w*.37,1.9,d/2+.24),V(w*.37,1.9,d/2+.24),.065,.065,m.rope,g);
    this._box(.19,.28,.19,m.darkWood,g,.78,1.69,d/2+.30);this._box(.13,.20,.195,this._standard('#e0b15a',{emissive:'#f6c967',emissiveIntensity:.35}),g,.78,1.69,d/2+.305);
    this._shadow(x,z,w*.7,d*.7);
  }
  _barrel(x,z,r=.3){const g=new THREE.Group();g.position.set(x,LAND_Y,z);this.scene.add(g);const mesh=this._mesh(new THREE.CylinderGeometry(r*.85,r*.9,r*1.9,12),this.materials.wood,g,{y:r*.95});for(const y of [r*.35,r*1.5])this._mesh(new THREE.TorusGeometry(r*.92,.025,5,12),this.materials.iron,g,{y,rx:Math.PI/2});this._mesh(new THREE.CircleGeometry(r*.85,12),this.materials.darkWood,g,{y:r*1.91,rx:-Math.PI/2});}
  _textTexture(text,{color='#f7e9cd',bg=null,width=512,height=96,size=37}={}){const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);}ctx.font=`600 ${size}px system-ui, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,width*.5,height*.51,width*.9);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;this.resources.push(t);return t;}
  _sign(x,z,text){const g=new THREE.Group();g.position.set(x,LAND_Y,z);this.scene.add(g);this._box(.09,1.12,.1,this.materials.darkWood,g,0,.56,0);this._box(1.55,.34,.085,this.materials.darkWood,g,0,1.01,0);const mat=new THREE.MeshBasicMaterial({map:this._textTexture(text),transparent:true,depthWrite:false});this._mesh(new THREE.PlaneGeometry(1.5,.29),mat,g,{y:1.01,z:.045,cast:false});}
  _makeMission(){
    this.hero=this._character(false);this.hero.root.position.copy(this.lastPlayer);this.scene.add(this.hero.root);this.heroShadow=this._shadow(this.lastPlayer.x,this.lastPlayer.z,.43,.34);
    this.guardian=this._character(true);this.guardian.root.position.copy(toWorld({x:285,y:485}));this.guardian.root.rotation.y=-.6;this.scene.add(this.guardian.root);this._shadow(-12.875,.875,.43,.35);
    this.boat=this._boat();this.scene.add(this.boat.root);this.boat.root.position.set(-3.50,-.03,2.37);this.boat.root.rotation.y=Math.PI/2;
    this.parcel=new THREE.Group();this.parcel.position.copy(toWorld({x:470,y:465}));this.scene.add(this.parcel);this._crate(this.parcel,.65,true);this._shadow(-8.25,.375,.5,.4);
    this.crates=[];for(let i=0;i<3;i++){const g=new THREE.Group();g.position.copy(toWorld({x:1165+(i%2)*24-12,y:430+Math.floor(i/2)*22-12}));g.rotation.y=(i-1)*.16;this.scene.add(g);this._crate(g,.75);g.userData.origin=g.position.clone();this.crates.push(g);this._shadow(g.position.x,g.position.z,.6,.5);}
    this._gate();
    this.key=new THREE.Group();this.key.position.set(-10,2.05,-3.95);this.scene.add(this.key);this._mesh(new THREE.TorusGeometry(.17,.045,8,24),this.materials.gold,this.key,{x:0,y:.25,z:0});this._box(.07,.47,.07,this.materials.gold,this.key,0,-.05,0);this._box(.16,.07,.07,this.materials.gold,this.key,.055,-.22,0);this._box(.14,.07,.07,this.materials.gold,this.key,.045,-.12,0);
    this.markers={key:this._beacon(-10,-3.9),boat:this._beacon(-5.25,1.75),crates:this._beacon(9.12,-.5),gate:this._beacon(14.5,-4.5)};
    this.objectiveLight=new THREE.PointLight('#ffd67d',1.6,5,2);this.scene.add(this.objectiveLight);
  }
  _crate(parent,size=.75,parcel=false){const m=this.materials,s=size;
    this._box(s,s*.94,s,parcel?m.paleWood:m.wood,parent,0,s*.47,0);
    for(const x of [-s*.43,s*.43])for(const z of [-s*.52,s*.52])this._box(s*.11,s*.96,s*.09,m.darkWood,parent,x,s*.47,z);
    for(const z of [-s*.53,s*.53]){for(const y of [s*.08,s*.88])this._box(s*.97,s*.1,s*.09,m.paleWood,parent,0,y,z);const b=this._box(s*.11,s*1.12,s*.07,m.paleWood,parent,0,s*.47,z);b.rotation.z=-.72;}
    if(parcel){for(const z of [-s*.25,s*.25])this._box(s*1.02,s*.95,.025,m.rope,parent,0,s*.48,z);this._box(.3,.22,.01,this.materials.cloth,parent,0,.48,s*.505);}
  }
  _character(old=false){const root=new THREE.Group(),body=new THREE.Group();root.add(body);const m=this.materials;
    const torso=this._mesh(new THREE.CylinderGeometry(.245,.205,.49,10),old?m.blue:m.cloth,body,{y:1.12});torso.scale.z=.72;
    this._mesh(new THREE.CylinderGeometry(.22,.22,.085,10),m.boot,body,{y:.86}).scale.z=.75;
    for(const side of [-1,1]){const shoulder=new THREE.Group();shoulder.position.set(side*.26,1.30,0);body.add(shoulder);this._mesh(new THREE.CapsuleGeometry(.095,.17,3,8),old?m.blue:m.cloth,shoulder,{y:-.13});const elbow=new THREE.Group();elbow.position.y=-.32;shoulder.add(elbow);this._mesh(new THREE.CapsuleGeometry(.068,.2,3,8),m.skin,elbow,{y:-.1});this._sphere(.081,m.skin,elbow,0,-.26,0,.8,1,1);if(side===-1)body.userData.leftArm=shoulder;else body.userData.rightArm=shoulder;
      const leg=new THREE.Group();leg.position.set(side*.125,.80,0);body.add(leg);this._mesh(new THREE.CapsuleGeometry(.095,.22,3,8),m.trousers,leg,{y:-.16});const knee=new THREE.Group();knee.position.y=-.35;leg.add(knee);this._mesh(new THREE.CapsuleGeometry(.075,.22,3,8),m.trousers,knee,{y:-.13});this._box(.17,.17,.28,m.boot,knee,0,-.34,.055);if(side===-1){body.userData.leftLeg=leg;body.userData.leftKnee=knee;}else{body.userData.rightLeg=leg;body.userData.rightKnee=knee;}}
    this._mesh(new THREE.CylinderGeometry(.075,.085,.17,9),m.skin,body,{y:1.44});
    this._sphere(.22,m.skin,body,0,1.68,0,.87,1.13,.94);
    for(const side of [-1,1]){this._sphere(.055,m.skin,body,side*.19,1.68,0,.55,1,.65);this._sphere(.025,m.eye,body,side*.074,1.70,.181,.8,.8,.55);const brow=this._box(.065,.013,.022,old?m.white:m.hair,body,side*.074,1.756,.177);brow.rotation.z=side*.11;}
    this._sphere(.045,m.skin,body,0,1.66,.203,.7,.9,1);this._box(.075,.012,.02,m.boot,body,0,1.58,.182);
    this._mesh(new THREE.SphereGeometry(.225,12,8,0,Math.PI*2,0,Math.PI*.56),old?m.white:m.hair,body,{y:1.72});
    if(old){this._sphere(.18,m.white,body,0,1.55,.08,.85,.65,.7);this._mesh(new THREE.CylinderGeometry(.34,.35,.045,20),m.rope,body,{y:1.91});this._mesh(new THREE.ConeGeometry(.25,.21,16),m.rope,body,{y:2.02});this._cylinder(V(-.41,0,.16),V(-.41,1.55,.16),.027,.024,m.darkWood,body);body.userData.leftArm.rotation.x=-.35;body.userData.leftArm.rotation.z=.2;}
    else {
      this._mesh(new THREE.CylinderGeometry(.115,.14,.11,12),m.red,body,{y:1.445});
      this._sphere(.07,m.red,body,.10,1.43,.09,.7,.8,.8);
      const scarfGeo=new THREE.PlaneGeometry(.16,.68,2,9);scarfGeo.translate(0,-.34,0);const scarf=this._mesh(scarfGeo,new THREE.MeshStandardMaterial({color:'#c8483c',roughness:.9,side:THREE.DoubleSide}),body,{x:.08,y:1.44,z:-.13});scarf.rotation.x=-.7;body.userData.scarf=scarf;
      // Canvas satchel, shoulder strap, and sleeve cuffs.
      this._box(.25,.27,.14,m.boot,body,-.20,.93,-.17);const strap=this._box(.055,.57,.035,m.boot,body,-.04,1.15,.19);strap.rotation.z=-.55;
      this._sphere(.075,m.hair,body,-.08,1.93,-.035,1.2,.65,1);
    }
    return{root,body,...body.userData};
  }
  _boat(){const root=new THREE.Group(),m=this.materials;const v=[],idx=[],uv=[];const steps=26,sides=12;
    for(let i=0;i<=steps;i++){const t=i/steps,z=(t-.5)*3.9,w=Math.pow(Math.sin(Math.PI*t),.72)*.62+.012;for(let j=0;j<=sides;j++){const a=j/sides*Math.PI;const x=Math.cos(a)*w,y=.62-Math.sin(a)*.48+Math.pow(Math.abs(t-.5)*2,4)*.23;v.push(x,y,z);uv.push(j/sides*3,t*5);if(i<steps&&j<sides){const n=i*(sides+1)+j;idx.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const hullMat=m.darkWood.clone();hullMat.side=THREE.DoubleSide;this._mesh(g,hullMat,root);
    for(const side of [-1,1]){const points=[];for(let i=0;i<=26;i++){const t=i/26;points.push(V(side*(Math.pow(Math.sin(Math.PI*t),.72)*.62+.012),.64+Math.pow(Math.abs(t-.5)*2,4)*.23,(t-.5)*3.9));}this._tube(points,.045,m.paleWood,root);}
    for(const z of [-1.0,0,1.0]){const w=Math.pow(Math.sin(Math.PI*(z/3.9+.5)),.72)*1.13;this._box(w,.095,.25,m.paleWood,root,0,.53,z);}
    for(let k=0;k<7;k++){const t=(k+1)/8,z=(t-.5)*3.9,w=Math.pow(Math.sin(Math.PI*t),.72)*.6;const p=[];for(let j=0;j<=12;j++){const a=j/12*Math.PI;p.push(V(Math.cos(a)*w,.63-Math.sin(a)*.455,z));}this._tube(p,.019,m.wood,root);}
    const oars=[];for(const side of [-1,1]){const oar=new THREE.Group();oar.position.set(side*.53,.64,.4);oar.rotation.z=-side*.32;this._cylinder(V(0,0,0),V(side*1.12,-.46,.55),.025,.019,m.paleWood,oar);const blade=this._box(.19,.045,.47,m.wood,oar,side*1.13,-.46,.68);blade.rotation.z=-side*.3;blade.rotation.y=-side*.3;root.add(oar);oars.push(oar);}
    const ropePoints=[];for(let i=0;i<35;i++){const a=i*.9,r=.14+i*.001;ropePoints.push(V(Math.cos(a)*r,.59+i*.0005,Math.sin(a)*r+1.1));}this._tube(ropePoints,.014,m.rope,root,false,60);
    return{root,oars};
  }
  _gate(){const g=new THREE.Group();g.position.set(14.5,LAND_Y,-4.5);this.scene.add(g);const m=this.materials;
    // Narrow northbound channel and its weathered stone shoulders.
    const channel=this._mesh(new THREE.PlaneGeometry(2.4,13),this.water.material,g,{y:.026,z:-6,rx:-Math.PI/2,cast:false});
    for(const x of [-1.55,1.55]){
      this._box(.65,.7,11,m.rock,g,x,.13,-5.2);
      for(let i=0;i<6;i++)this._box(.6,.48,.63,m.rock,g,x,i*.45+.22,0);
      this._box(.82,.2,.85,m.darkRock,g,x,2.9,0);
      for(let i=0;i<7;i++)this._box(.5,.27,.7,m.rock,g,x,.62,-.8-i*1.1);
    }
    this._box(3.8,.32,.76,m.iron,g,0,3.20,0);this._box(3.65,.11,.8,m.wood,g,0,3.41,.01);
    this.gateDoor=new THREE.Group();g.add(this.gateDoor);
    for(let i=0;i<9;i++)this._box(.28,2.4,.22,m.darkWood,this.gateDoor,-1.12+i*.28,1.3,0);
    for(const y of [.35,1.3,2.35])this._box(2.55,.13,.32,m.iron,this.gateDoor,0,y,.015);
    for(const x of [-1.12,1.12])for(const y of [.35,1.3,2.35])this._sphere(.045,m.gold,this.gateDoor,x,y,.19,1,1,.45);
    for(const x of [-1.37,1.37])this._box(.11,3.2,.15,m.iron,g,x,1.6,.21);
    this.gateWheel=new THREE.Group();this.gateWheel.position.set(2.08,1.6,.48);g.add(this.gateWheel);this._mesh(new THREE.TorusGeometry(.42,.045,8,24),m.rust,this.gateWheel);for(let i=0;i<6;i++){const a=i*Math.PI/3;this._cylinder(V(),V(Math.sin(a)*.4,Math.cos(a)*.4,0),.022,.022,m.rust,this.gateWheel);}
    this._cylinder(V(2.08,.1,.18),V(2.08,1.6,.18),.06,.055,m.iron,g);this._cylinder(V(2.08,1.6,.18),V(2.08,1.6,.5),.055,.055,m.iron,g);
    const screw=this._mesh(new THREE.CylinderGeometry(.055,.055,2,9),m.iron,g,{y:3.2});for(let i=0;i<13;i++)this._mesh(new THREE.TorusGeometry(.066,.018,5,10),m.rust,g,{y:2.38+i*.13,rx:Math.PI/2});
    this._box(4.8,.15,.9,m.wood,g,.35,.11,.93);this._shadow(14.5,-4.5,2.2,.9);
    // Sprays become visible when the player opens the gate.
    this.gateSpray=[];const sprayMat=new THREE.MeshBasicMaterial({color:'#c2e9dd',transparent:true,opacity:.45,depthWrite:false});for(let i=0;i<22;i++){const drop=this._sphere(.035+this.random()*.025,sprayMat,g,(this.random()-.5)*2,.2,.7);drop.userData.offset=this.random()*6.28;drop.visible=false;this.gateSpray.push(drop);}
  }
  _beacon(x,z){const g=new THREE.Group();g.position.set(x,LAND_Y+.035,z);this.scene.add(g);const mat=new THREE.MeshBasicMaterial({color:'#ffd58a',transparent:true,opacity:.7,depthWrite:false});this._mesh(new THREE.RingGeometry(.42,.47,40),mat,g,{rx:-Math.PI/2,cast:false});const diamond=this._mesh(new THREE.OctahedronGeometry(.13,0),this.materials.marker,g,{y:1.4,cast:false});g.userData.diamond=diamond;g.userData.ring=g.children[0];return g;}
  _makeAtmosphere(){
    const pts=[];for(let i=0;i<90;i++)pts.push(-20+this.random()*40,.9+this.random()*7,-8+this.random()*16);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));this.motes=new THREE.Points(g,new THREE.PointsMaterial({color:'#ffe1a4',size:.027,transparent:true,opacity:.6,depthWrite:false,sizeAttenuation:true}));this.scene.add(this.motes);
    const birds=new THREE.Group();this.birds=[];for(let i=0;i<7;i++){const b=new THREE.Group();for(const side of [-1,1]){const wing=new THREE.Mesh(new THREE.ConeGeometry(.055,.35,3),new THREE.MeshBasicMaterial({color:'#3c5b61'}));wing.rotation.z=side*Math.PI/2;wing.position.x=side*.15;b.add(wing);}birds.add(b);this.birds.push(b);}this.scene.add(birds);
    this.wakeRings=[];for(let i=0;i<6;i++){const material=new THREE.MeshBasicMaterial({color:'#b7ddd1',transparent:true,opacity:.15,depthWrite:false,side:THREE.DoubleSide});const ring=this._mesh(new THREE.RingGeometry(.48,.50,48),material,this.scene,{rx:-Math.PI/2,y:-.015,cast:false});this.wakeRings.push(ring);}
  }
  _batchStaticMeshes(){
    // Merge stationary PBR geometry by material. Art stays detailed while CPU
    // draw submission remains modest on integrated GPUs and mobile devices.
    this.scene.updateMatrixWorld(true);
    const dynamic=new Set([this.hero.root,this.guardian.root,this.boat.root,this.parcel,...this.crates,this.key,this.gateDoor,this.gateWheel,...this.gateSpray,...Object.values(this.markers)]);
    const batches=new Map();
    this.scene.traverse(o=>{
      if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material)||!o.material?.isMeshStandardMaterial||o.material.transparent||o.material.vertexColors)return;
      for(let p=o;p;p=p.parent)if(dynamic.has(p))return;
      const key=o.material.uuid+':'+o.castShadow+':'+o.receiveShadow;
      if(!batches.has(key))batches.set(key,[]);batches.get(key).push(o);
    });
    for(const list of batches.values()){
      if(list.length<2)continue;const positions=[],normals=[],uvs=[];
      for(const mesh of list){
        const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geo.applyMatrix4(mesh.matrixWorld);
        if(!geo.attributes.normal)geo.computeVertexNormals();
        positions.push(geo.attributes.position.array);normals.push(geo.attributes.normal.array);
        uvs.push(geo.attributes.uv?.array||new Float32Array(geo.attributes.position.count*2));geo.dispose();
      }
      const combine=arrays=>{const out=new Float32Array(arrays.reduce((n,a)=>n+a.length,0));let i=0;for(const a of arrays){out.set(a,i);i+=a.length;}return out;};
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(combine(positions),3));geometry.setAttribute('normal',new THREE.BufferAttribute(combine(normals),3));geometry.setAttribute('uv',new THREE.BufferAttribute(combine(uvs),2));geometry.computeBoundingSphere();
      const merged=new THREE.Mesh(geometry,list[0].material);merged.castShadow=list[0].castShadow;merged.receiveShadow=list[0].receiveShadow;merged.name='Static world batch';
      for(const mesh of list){mesh.parent.remove(mesh);mesh.geometry.dispose();}this.scene.add(merged);
    }
  }
  resize(){if(!this.renderer||this.disposed)return;const rect=this.canvas.getBoundingClientRect();const w=Math.max(1,rect.width||this.canvas.clientWidth||window.innerWidth),h=Math.max(1,rect.height||this.canvas.clientHeight||window.innerHeight);this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  setQuality(value='auto'){if(!this.renderer)return;this.quality=value==='auto'?(this.softwareRenderer?'low':this.mobile?'medium':'high'):value;const low=this.quality==='low';this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,this.softwareRenderer?(low ? 0.65 : 1):low?1:this.quality==='medium'?1.25:1.5));this.renderer.shadowMap.enabled=!low;this.sun.castShadow=!low;this.motes.visible=!low;this.resize();}
  render(state={},dt=.016,time=0){
    if(!this._ready||this.disposed||this.error)return;
    // The title uses a local still preview; do not render an invisible canvas.
    const bounds=this.canvas.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
    if(Math.abs(this.camera.aspect-bounds.width/bounds.height)>.02)this.resize();
    dt=clamp(Number(dt)||.016,0,.1);this.time=Number.isFinite(time)&&time>this.time?time:this.time+dt;const t=this.time;this.state=state;
    this.waterUniforms.uTime.value=t;this.waterUniforms.uClear.value=THREE.MathUtils.damp(this.waterUniforms.uClear.value,state.gateOpen?1:0,1,dt);for(const f of this.foams)f.uniforms.uTime.value=t;
    const p=state.player?toWorld(state.player):this.lastPlayer.clone(),travel=!!state.travelling;
    const moved=Math.hypot(p.x-this.lastPlayer.x,p.z-this.lastPlayer.z),moving=moved>.002&&!state.paused&&state.status==='playing'&&!travel;
    if(moving){this.facing=Math.atan2(p.x-this.lastPlayer.x,p.z-this.lastPlayer.z);this.walkPhase+=Math.min(moved,.4)*4.4;}
    const goalAngle=this.facing;let delta=THREE.MathUtils.euclideanModulo(goalAngle-this.hero.root.rotation.y+Math.PI,Math.PI*2)-Math.PI;this.hero.root.rotation.y+=delta*Math.min(1,dt*13);
    this.hero.root.position.copy(p);this.hero.root.position.y=travel?.49:LAND_Y;
    const swing=moving?Math.sin(this.walkPhase)*.6:Math.sin(t*1.6)*.018;
    this.hero.leftLeg.rotation.x=swing;this.hero.rightLeg.rotation.x=-swing;this.hero.leftKnee.rotation.x=Math.max(0,-swing)*.6;this.hero.rightKnee.rotation.x=Math.max(0,swing)*.6;
    this.hero.leftArm.rotation.x=-swing*.7;this.hero.rightArm.rotation.x=swing*.7;
    this.hero.body.position.y=moving?Math.abs(Math.sin(this.walkPhase))*.035:Math.sin(t*1.8)*.008;
    this.hero.scarf.rotation.x=-.6+Math.sin(t*5.3)*.09+(moving?-.25:0);this.hero.scarf.rotation.z=Math.sin(t*3.2)*.12;
    this.heroShadow.position.set(p.x,LAND_Y+.014,p.z);this.heroShadow.visible=!travel;
    this.hero.root.visible=state.status!=='title';this.lastPlayer.copy(p);
    this.guardian.body.rotation.z=Math.sin(t*.8)*.012;
    const boatX=travel?p.x:state.crossed?4.9:-3.5;
    this.boat.root.position.set(boatX,-.025+Math.sin(t*1.8)*.025,travel?p.z:2.37);this.boat.root.rotation.z=Math.sin(t*1.1)*.014;this.boat.root.rotation.x=Math.sin(t*.8)*.012;
    this.boat.oars.forEach((o,i)=>{o.rotation.x=travel?Math.sin(t*4+i)*.4:0;o.rotation.z=(i?1:-1)*(.32+(travel?Math.sin(t*4+i)*.18:0));});
    if(travel){this.hero.root.position.y=.48;this.hero.leftLeg.rotation.x=-.65;this.hero.rightLeg.rotation.x=-.65;this.hero.body.position.y=-.14;this.hero.root.rotation.y=Math.PI/2;}
    this.key.visible=!state.hasKey;this.key.rotation.y=t*.7;this.key.position.y=2.05+Math.sin(t*2)*.1;
    this.parcel.visible=state.parcel!=='carried';if(state.parcel==='stored')this.parcel.position.set(-6.8,LAND_Y,2.15);else this.parcel.position.copy(toWorld({x:470,y:465}));
    for(let i=0;i<3;i++){const g=this.crates[i],gone=i<(state.crateHits||0);const target=g.userData.origin.clone();if(gone){target.x+=2.1;target.z+=1.25+i*.14;}g.position.lerp(target,Math.min(1,dt*5));g.rotation.y=THREE.MathUtils.damp(g.rotation.y,gone?.45+i*.3:(i-1)*.16,5,dt);}
    this.gateDoor.position.y=THREE.MathUtils.damp(this.gateDoor.position.y,state.gateOpen?2.8:0,1.25,dt);if(state.gateOpen)this.gateWheel.rotation.z=t*.8;
    for(const d of this.gateSpray){d.visible=!!state.gateOpen;if(d.visible){const a=t*2.2+d.userData.offset;d.position.y=.1+Math.abs(Math.sin(a))*.65;d.position.z=.4+(a%3)*.7;}}
    const active=!state.hasKey?'key':!state.crossed?'boat':(state.crateHits||0)<3?'crates':'gate';
    for(const[id,marker]of Object.entries(this.markers)){const finished=(id==='key'&&state.hasKey)||(id==='boat'&&state.crossed)||(id==='crates'&&state.crateHits>=3)||(id==='gate'&&state.gateOpen);marker.visible=!finished&&state.status!=='title';marker.userData.diamond.position.y=1.42+Math.sin(t*2.5)*.12;marker.userData.diamond.rotation.y=t*.6;marker.userData.ring.material.opacity=id===active?.58+Math.sin(t*2.8)*.15:.18;marker.userData.diamond.visible=id===active;}
    this.objectiveLight.position.copy(this.markers[active].position).add(V(0,1.8,0));this.objectiveLight.visible=state.status==='playing';
    for(let i=0;i<this.wakeRings.length;i++){const ring=this.wakeRings[i],phase=(t*.4+i/6)%1;ring.position.x=this.boat.root.position.x-(travel?phase*1.8:0);ring.position.z=this.boat.root.position.z+.3;ring.scale.set(.4+phase*2,.4+phase*1.2,1);ring.material.opacity=(1-phase)*(travel?.23:.07);}
    this.motes.rotation.y=t*.007;this.motes.position.y=Math.sin(t*.3)*.12;
    this.birds.forEach((b,i)=>{const a=t*.065+i*.8;b.position.set(Math.sin(a)*21,10+Math.sin(a*2+i),-10+Math.cos(a)*7);b.rotation.y=-a;for(let j=0;j<2;j++)b.children[j].rotation.x=Math.sin(t*4+i)*(j?1:-1)*.35;});
    const title=state.status==='title',won=state.status==='won';
    const aspect=this.camera.aspect,portrait=aspect<1;const followX=title?Math.sin(t*.035)*.65:p.x*.72;
    const target=V(followX,.35,title?-1.2:p.z*.24-.65);
    const entering=this.lastStatus==='title'&&!title;
    if(entering)this.cameraTarget.copy(target);else this.cameraTarget.lerp(target,1-Math.exp(-dt*(title?.4:2.0)));
    const cameraHeight=portrait?(title?31:16):title?22.5:won?16.5:10.2;
    const cameraDepth=portrait?(title?38:20):title?29:won?21:13.2;
    const desired=V(this.cameraTarget.x+(title?Math.sin(t*.026)*1.0:0),cameraHeight,this.cameraTarget.z+cameraDepth);
    if(entering)this.camera.position.copy(desired);else this.camera.position.lerp(desired,1-Math.exp(-dt*2.5));this.camera.lookAt(this.cameraTarget);
    if(this.lastStatus!==state.status){this.lastStatus=state.status;}
    this.renderer.render(this.scene,this.camera);this.frames=(this.frames||0)+1;
  }
  projectPoint(point){if(!this.camera)return null;const p=toWorld(point).project(this.camera),r=this.canvas.getBoundingClientRect();return{x:r.left+(p.x+1)*.5*r.width,y:r.top+(1-p.y)*.5*r.height,visible:p.z>-1&&p.z<1&&Math.abs(p.x)<=1&&Math.abs(p.y)<=1};}
  getStats(){return this.renderer?{mode:'3d',softwareRenderer:this.softwareRenderer,frames:this.frames||0,calls:this.renderer.info.render.calls,width:this.canvas.width,height:this.canvas.height,renderer:'Three.js r180 / WebGL',quality:this.quality,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,textures:this.renderer.info.memory.textures,geometries:this.renderer.info.memory.geometries,pixelRatio:this.renderer.getPixelRatio(),ready:this._ready}: {ready:false,error:this.error?.message};}
  dispose(){if(this.disposed)return;this.disposed=true;this.canvas?.removeEventListener('pointerdown',this._pointerDown);this.canvas?.removeEventListener('pointerup',this._pointerUp);this.canvas?.removeEventListener('webglcontextlost',this._contextLost);if(this.scene){const geometries=new Set(),materials=new Set(),textures=new Set();this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});for(const m of materials){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}for(const g of geometries)g.dispose();for(const t of textures)t.dispose();}this.environment?.dispose();this.renderer?.dispose();}
}
export default RiverRenderer;
