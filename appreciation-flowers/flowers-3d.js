'use strict';
(() => {
  if(!window.THREE) return;
  const T=window.THREE;
  const colors=['#e64f88','#f09a68','#ad7ed4','#efbd51','#dd6fa7','#74afa4'];
  const records=new Map(), snapshots=new Map();
  let renderer,scene,camera,last=0,frameNumber=0;
  const flowerGeometries=[];
  try {
    renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));
    renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
    renderer.setClearColor(0x000000,0);
    renderer.domElement.id='flowers3D';renderer.domElement.setAttribute('aria-hidden','true');
    document.body.append(renderer.domElement);
    scene=new T.Scene();
    scene.add(new T.HemisphereLight(0xfff8ed,0x46644f,.65));
    const key=new T.DirectionalLight(0xfff1dd,1.3);key.position.set(-4,6,6);scene.add(key);
    const fill=new T.DirectionalLight(0xe7e4ff,.45);fill.position.set(4,2,-4);scene.add(fill);
    const rim=new T.DirectionalLight(0xffd6dd,.5);rim.position.set(-3,0,-4);scene.add(rim);
    camera=new T.PerspectiveCamera(35,1,.1,100);
    document.documentElement.classList.add('has-flower3d');
  } catch { return; }

  function petalGeometry(length,width) {
    const vertices=[],uv=[],indices=[],shades=[];
    const cols=12,rows=16;
    for(let j=0;j<=rows;j++){
      const v=j/rows;
      for(let i=0;i<=cols;i++){
        const u=i/cols*2-1;
        const w=Math.pow(Math.sin(Math.PI*v),.62)*width;
        const x=u*w,y=v*length;
        const z=.17*Math.sin(Math.PI*v)+.24*u*u*Math.sin(Math.PI*v)+.13*Math.pow(v,5)+.025*Math.sin(u*7+v*7)*v;
        vertices.push(x,y,z);uv.push(i/cols,v);
        const light=.53+.47*v-.10*Math.abs(u);
        shades.push(light,light,light);
        if(j<rows&&i<cols){const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);}
      }
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(shades,3));g.setIndex(indices);g.computeVertexNormals();flowerGeometries.push(g);return g;
  }
  const shapes=[petalGeometry(1.03,.47),petalGeometry(.83,.39),petalGeometry(.64,.31)];
  const leafShape=new T.Shape();leafShape.moveTo(0,0);leafShape.bezierCurveTo(-.30,.14,-.34,.52,0,.87);leafShape.bezierCurveTo(.27,.49,.28,.19,0,0);
  const leafGeometry=new T.ExtrudeGeometry(leafShape,{depth:.025,bevelEnabled:true,bevelThickness:.025,bevelSize:.035,bevelSegments:2,steps:1,curveSegments:14});
  leafGeometry.computeVertexNormals();
  const leafMat=new T.MeshPhysicalMaterial({color:'#3c8f67',roughness:.48,clearcoat:.28,side:T.DoubleSide});
  const stemMat=new T.MeshStandardMaterial({color:'#427e51',roughness:.65});
  const goldMat=new T.MeshPhysicalMaterial({color:'#edba44',roughness:.39,metalness:.18,clearcoat:.3});
  const pollenGeometry=new T.SphereGeometry(.035,6,5);

  function makeFlower(index,full=true) {
    const root=new T.Group(),head=new T.Group(),petals=[];
    head.position.y=full?.72:0;root.add(head);
    const hue=new T.Color(colors[index%colors.length]).convertSRGBToLinear();
    [10,8,6].forEach((count,layer)=>{
      const material=new T.MeshPhysicalMaterial({color:hue.clone().lerp(new T.Color('#ffdfed').convertSRGBToLinear(),layer*.09),vertexColors:true,roughness:.48,metalness:0,clearcoat:.12,clearcoatRoughness:.5,side:T.DoubleSide});
      for(let i=0;i<count;i++){
        const angle=i/count*Math.PI*2+layer*.29;
        const pivot=new T.Group();pivot.rotation.y=angle;
        pivot.position.set(Math.sin(angle)*(.08-layer*.02),.035*layer,Math.cos(angle)*(.08-layer*.02));
        const petal=new T.Mesh(shapes[layer],material);petal.rotation.y=Math.PI; pivot.add(petal);head.add(pivot);
        petals.push({mesh:petal,layer,phase:i*.27});
      }
    });
    const center=new T.Mesh(new T.SphereGeometry(.18,20,14),goldMat);center.scale.set(1,.55,1);center.position.y=.09;head.add(center);
    for(let i=0;i<26;i++){const dot=new T.Mesh(pollenGeometry,goldMat);const a=i*2.399,r=Math.sqrt(i/26)*.17;dot.position.set(Math.cos(a)*r,.1+Math.sqrt(Math.max(0,.03-r*r))*.27,Math.sin(a)*r);head.add(dot);}
    if(full){
      const curve=new T.CatmullRomCurve3([new T.Vector3(.03,-1.3,0),new T.Vector3(-.05,-.7,.06),new T.Vector3(.03,0,0),new T.Vector3(0,.76,0)]);
      root.add(new T.Mesh(new T.TubeGeometry(curve,18,.025,7,false),stemMat));
      const left=new T.Mesh(leafGeometry,leafMat);left.position.set(0,-.65,.02);left.rotation.set(.2,-.3,.92);left.scale.setScalar(.83);root.add(left);
      const right=new T.Mesh(leafGeometry,leafMat);right.position.set(0,-.22,0);right.rotation.set(-.2,.7,-.88);right.scale.setScalar(.75);root.add(right);
      const sepal=new T.Mesh(new T.ConeGeometry(.14,.32,7),leafMat);sepal.position.y=.63;root.add(sepal);
    }
    root.userData={petals,head,openness:0,target:0,full};
    return root;
  }
  function pose(root,amount) {
    root.userData.petals.forEach(({mesh,layer,phase})=>{
      const closed=.12+layer*.045,open=[1.25,.94,.59][layer];
      mesh.rotation.x=closed+(open-closed)*amount;
      mesh.rotation.z=Math.sin(phase)*.035*amount;
    });
    root.userData.openness=amount;
  }
  function makeBouquet() {
    const group=new T.Group();
    [[0,-.85,0,.08,-.26,.82],[1,.82,-.02,-.03,.27,.8],[4,0,.38,-.15,0,1],[3,-.47,-.43,.40,-.22,.62],[2,.57,-.46,.35,.26,.64]].forEach(([i,x,y,z,rotation,scale])=>{
      const rose=makeFlower(i);rose.position.set(x,y,z);rose.rotation.z=rotation;rose.scale.setScalar(scale);pose(rose,1);group.add(rose);
    });
    group.userData.bouquet=true;return group;
  }
  function sync() {
    const targets=new Set(document.querySelectorAll('[data-flower3d]'));
    for(const [element,record] of records){if(!targets.has(element)){scene.remove(record.object);disposeFlower(record.object);records.delete(element);}}
    targets.forEach(element=>{
      if(records.has(element))return;
      const index=Number(element.dataset.flower3d),object=index<0?makeBouquet():makeFlower(index);
      scene.add(object);records.set(element,{object,index,element});
    });
  }
  function disposeFlower(root){
    const materials=new Set(),geometries=new Set();
    root.traverse(o=>{if(o.isMesh){if(![leafMat,stemMat,goldMat].includes(o.material))materials.add(o.material);if(![...shapes,leafGeometry,pollenGeometry].includes(o.geometry))geometries.add(o.geometry);}});
    materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());
  }
  function visible(element) { return !!element.getClientRects().length; }
  function frame(now) {
    requestAnimationFrame(frame);
    if(document.hidden)return;
    const calm=document.documentElement.classList.contains('motion-off');
    if(now-last<(calm?100:33))return;
    const dt=Math.min((now-last)/1000,.1);last=now;frameNumber++;
    if(frameNumber%20===0)sync();
    const w=document.documentElement.clientWidth,h=innerHeight;
    const ratio=renderer.getPixelRatio();
    if(renderer.domElement.width!==Math.floor(w*ratio)||renderer.domElement.height!==Math.floor(h*ratio))renderer.setSize(w,h,false);
    renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);
    for(const {object,element,index} of records.values()){
      if(!visible(element))continue;
      const r=element.getBoundingClientRect();if(r.bottom<0||r.top>h||r.right<0||r.left>w)continue;
      for(const other of records.values())other.object.visible=false;object.visible=true;
      if(index>=0){
        const button=element.closest('.flower-button');
        const target=button&&(button.classList.contains('opened')||button.classList.contains('blooming'))?1:0;
        const current=object.userData.openness;
        pose(object,calm?target:current+(target-current)*Math.min(1,dt*3.2));
        object.rotation.y=.13+(calm?0:Math.sin(now*.0007+index)*.055);
      } else object.rotation.y=calm?-.12:-.12+Math.sin(now*.0002)*.05;
      camera.aspect=r.width/r.height;
      if(index<0){camera.position.set(0,3.9,7.8);camera.lookAt(0,.25,0);}else{camera.position.set(0,3.2,5.7);camera.lookAt(0,.18,0);}
      camera.updateProjectionMatrix();
      renderer.setViewport(r.left,h-r.bottom,r.width,r.height);
      renderer.setScissor(Math.max(0,r.left),Math.max(0,h-r.bottom),Math.min(w,r.right)-Math.max(0,r.left),Math.min(h,r.bottom)-Math.max(0,r.top));
      renderer.render(scene,camera);
    }
    renderer.setScissorTest(false);
  }
  function snapshot(index) {
    if(snapshots.has(index))return snapshots.get(index);
    const photoScene=new T.Scene();
    scene.children.filter(o=>o.isLight).forEach(light=>photoScene.add(light.clone()));
    const rose=makeFlower(index,false);pose(rose,1);photoScene.add(rose);rose.rotation.y=-.12;
    const photoCamera=new T.PerspectiveCamera(35,1,.1,30);photoCamera.position.set(0,3.3,3.1);photoCamera.lookAt(0,.15,0);
    renderer.setScissorTest(false);renderer.setSize(440,440,false);renderer.setViewport(0,0,440,440);renderer.clear();renderer.render(photoScene,photoCamera);
    const data=renderer.domElement.toDataURL('image/png');snapshots.set(index,data);
    disposeFlower(rose);renderer.setSize(document.documentElement.clientWidth,innerHeight,false);return data;
  }
  window.Flower3D={sync,snapshot};
  sync();requestAnimationFrame(frame);
})();
