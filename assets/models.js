/* Procedural geometry for the three kinetic studies. No downloaded models or textures. */
(() => {
  'use strict';
  const T=globalThis.THREE;
  const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const sphere=new T.SphereGeometry(1,16,10);
  const rod=new T.CylinderGeometry(1,1,1,12);
  const cube=new T.BoxGeometry(1,1,1);
  const steel=new T.MeshStandardMaterial({color:0x777782,metalness:.72,roughness:.36});
  const dark=new T.MeshStandardMaterial({color:0x282830,metalness:.65,roughness:.43});
  const light=new T.MeshStandardMaterial({color:0xbdbac4,metalness:.68,roughness:.31});
  const violet=new T.MeshStandardMaterial({color:0xd996e4,metalness:.45,roughness:.3,emissive:0x493269,emissiveIntensity:.3});
  const graphite=new T.MeshStandardMaterial({color:0x131319,metalness:.35,roughness:.6});
  const up=V(0,1,0);
  function ball(parent,p,r=.07,material=violet){const m=new T.Mesh(sphere,material);m.position.copy(p);m.scale.setScalar(r);parent.add(m);return m;}
  function box(parent,p,size,material=steel){const m=new T.Mesh(cube,material);m.position.copy(p);m.scale.copy(size);parent.add(m);return m;}
  function bar(parent,a,b,r=.04,material=steel){const m=new T.Mesh(rod,material);parent.add(m);setBar(m,a,b,r);return m;}
  function setBar(mesh,a,b,r){const d=b.clone().sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.set(r,d.length(),r);mesh.quaternion.setFromUnitVectors(up,d.normalize());}
  function cable(parent,a,b,color=0xb9aecf,opacity=.54){
    const g=new T.BufferGeometry().setFromPoints([a,b]);const mat=new T.LineBasicMaterial({color,transparent:true,opacity});const m=new T.Line(g,mat);parent.add(m);return m;
  }
  function setCable(line,a,b,slack=0){
    const count=slack?13:2;
    let att=line.geometry.attributes.position;
    if(att.count!==count){line.geometry.dispose();line.geometry=new T.BufferGeometry().setFromPoints(Array.from({length:count},()=>V()));att=line.geometry.attributes.position;}
    for(let i=0;i<count;i++){const t=i/(count-1);att.setXYZ(i,T.MathUtils.lerp(a.x,b.x,t),T.MathUtils.lerp(a.y,b.y,t)-Math.sin(t*Math.PI)*slack,T.MathUtils.lerp(a.z,b.z,t));}
    att.needsUpdate=true;line.geometry.computeBoundingSphere();
  }
  function iBeam(parent,length,depth,width,axis='y',material=steel){
    const group=new T.Group(),thickness=depth*.075;
    box(group,V(0,0,0),V(thickness,length,depth-thickness*2),material);
    box(group,V(0,0,-depth/2+thickness/2),V(width,length,thickness),material);
    box(group,V(0,0,depth/2-thickness/2),V(width,length,thickness),material);
    // Local Y is the member axis. Local Z is the section's depth.
    if(axis==='x')group.rotation.z=-Math.PI/2;
    parent.add(group);return group;
  }
  function ground(parent,y=-2.6,r=1.75){
    const circle=new T.Mesh(new T.CircleGeometry(r,64),new T.MeshBasicMaterial({color:0x25212e,transparent:true,opacity:.3,depthWrite:false}));
    circle.rotation.x=-Math.PI/2;circle.position.y=y;parent.add(circle);
    const ring=new T.LineLoop(new T.BufferGeometry().setFromPoints(Array.from({length:96},(_,i)=>V(Math.cos(i/96*Math.PI*2)*r,y+.005,Math.sin(i/96*Math.PI*2)*r))),new T.LineBasicMaterial({color:0x5a506b,transparent:true,opacity:.32}));parent.add(ring);
  }
  // A three-storey steel frame, 2 x 2 bays (four panels a floor), hung from a marionette control
  // by its five roof joints (four corners and the centre). The base is fixed: pulling the strings
  // sways the floors in the first mode of a uniform three-storey shear building, roof most.
  function frame(){
    const root=new T.Group(),control=new T.Group();root.add(control);
    const N=3,bay=1.15,half=(N-1)*bay/2,storey=.8,base=-2.2,top=base+3*storey,lift=1.9;
    const MODE=[0,.445,.802,1];
    const grid=(i,j,k)=>V(-half+i*bay,base+k*storey,-half+j*bay);
    const slabMat=new T.MeshStandardMaterial({color:0x2a2733,metalness:.4,roughness:.6,transparent:true,opacity:.5});
    const columns=[],beams=[],slabs=[];
    for(let k=0;k<3;k++)for(let i=0;i<N;i++)for(let j=0;j<N;j++)columns.push({a:[i,j,k],b:[i,j,k+1],mesh:bar(root,grid(i,j,k),grid(i,j,k+1),.045,light)});
    for(let k=1;k<=3;k++){
      for(let i=0;i<N;i++)for(let j=0;j<N-1;j++){
        beams.push({a:[i,j,k],b:[i,j+1,k],mesh:bar(root,grid(i,j,k),grid(i,j+1,k),.034,steel)});
        beams.push({a:[j,i,k],b:[j+1,i,k],mesh:bar(root,grid(j,i,k),grid(j+1,i,k),.034,steel)});
      }
      slabs.push(box(root,V(0,base+k*storey-.035,0),V(2*half+.12,.03,2*half+.12),slabMat));
    }
    // fixed base: a raft with a footing under every column
    box(root,V(0,base-.07,0),V(2*half+.5,.12,2*half+.5),dark);
    for(let i=0;i<N;i++)for(let j=0;j<N;j++)box(root,grid(i,j,0).add(V(0,.03,0)),V(.13,.06,.13),graphite);
    ground(root,base-.14,2.35);
    // the control: an X whose arm tips sit over the roof corners, with the centre string at its hub
    bar(control,V(-half,0,-half),V(half,0,half),.05,light);
    bar(control,V(-half,0,half),V(half,0,-half),.05,light);
    ball(control,V(),.09,violet);
    const strung=[[0,0],[0,N-1],[N-1,0],[N-1,N-1],[(N-1)/2,(N-1)/2]];
    const anchors=strung.map(([i,j])=>V(-half+i*bay,0,-half+j*bay));
    const joints=strung.map(()=>ball(root,V(),.07,violet));
    const lines=strung.map(()=>cable(root,V(),V(),0xc5b9df,.54));
    function update(time,x,y,active=true,controlX=x,controlY=y){
      const drift=active?Math.sin(time*.9)*.025:0;
      const sx=(x+drift)*.55,sz=-y*.4;
      const node=(i,j,k)=>grid(i,j,k).add(V(sx*MODE[k],0,sz*MODE[k]));
      columns.forEach(c=>setBar(c.mesh,node(...c.a),node(...c.b),.045));
      beams.forEach(b=>setBar(b.mesh,node(...b.a),node(...b.b),.034));
      slabs.forEach((slab,n)=>slab.position.set(sx*MODE[n+1],base+(n+1)*storey-.035,sz*MODE[n+1]));
      // the hand leads; the frame follows through the damped spring in kinetic.js
      control.position.set(controlX*.7,top+lift+controlY*.12,-controlY*.45);
      control.rotation.z=-controlX*.12;control.rotation.x=-controlY*.1;
      root.updateMatrixWorld(true);
      strung.forEach(([i,j],n)=>{
        const roof=node(i,j,3);joints[n].position.copy(roof);
        const a=control.localToWorld(anchors[n].clone());root.worldToLocal(a);
        setCable(lines[n],a,roof,.008);
      });
    }
    update(0,0,0,false);
    return {root,update,height:6.4,target:V(0,0,0),view:V(5.5,3.2,10),reset(){update(0,0,0,false);}};
  }
  function tensegrity(){
    const root=new T.Group(),structure=new T.Group();root.add(structure);
    const phi=(1+Math.sqrt(5))/2;
    const original=[V(0,1,phi),V(0,1,-phi),V(0,-1,phi),V(0,-1,-phi),V(1,phi,0),V(1,-phi,0),V(-1,phi,0),V(-1,-phi,0),V(phi,0,1),V(-phi,0,1),V(phi,0,-1),V(-phi,0,-1)];
    const pairs=[[0,1],[2,3],[4,5],[6,7],[8,9],[10,11]];
    const bars=pairs.map(([a,b])=>bar(structure,original[a],original[b],.065,light));
    const nodes=original.map((p,i)=>{const n=ball(structure,p,.09,violet);n.userData.nodeIndex=i;return n;});
    const edges=[];
    original.forEach((a,i)=>original.forEach((b,j)=>{if(i<j&&Math.abs(a.distanceTo(b)-2)<.001&&!((a.x===0&&b.x===0)||(a.y===0&&b.y===0)||(a.z===0&&b.z===0)))edges.push({a:i,b:j,line:cable(structure,a,b,0x9981c1,.56)});}));
    ground(root,-2.35,2.05);
    const points=original.map(p=>p.clone());
    function update(time,spread=.45,drag=null){
      const offset=(spread-.45)*.42;
      original.forEach((p,i)=>{
        points[i].copy(p);
        // Translate each rigid strut outward; its original length is preserved.
        const pair=pairs.find(pair=>pair.includes(i));
        const midpoint=original[pair[0]].clone().add(original[pair[1]]).multiplyScalar(.5);
        points[i].add(midpoint.multiplyScalar(offset));
        if(drag&&pair.includes(drag.index))points[i].add(V(drag.x,drag.y,0));
        nodes[i].position.copy(points[i]);
      });
      pairs.forEach(([a,b],i)=>setBar(bars[i],points[a],points[b],.065));
      edges.forEach(({a,b,line})=>{
        const strain=clamp((points[a].distanceTo(points[b])-2)*.8,0,1);
        line.material.color.set(0x9981c1).lerp(new T.Color(0xe8dcff),strain);
        line.material.opacity=.42+strain*.55;setCable(line,points[a],points[b]);
      });
    }
    update(0);
    return {root,structure,nodes,pairs,points,edges,update,height:5.9,target:V(0,0,0),view:V(3.75,7.5,15),reset(){update(0,.45,null);}};
  }
  function connection(){
    const root=new T.Group(),assembly=new T.Group();root.add(assembly);
    const column=iBeam(assembly,3.5,1,1,'y',dark);column.position.set(-1.36,-1.4,0);column.rotation.y=Math.PI/2;steel;
    const pedestal=box(assembly,V(-1.36,-2.7,0),V(2,1.3,2),steel);
    const beam=iBeam(assembly,2.75,.8,.58,'x',steel);beam.position.set(.7,.2,0);beam.rotation.x=Math.PI/2;
    const beamEndPlate=box(assembly,V(-.83,.2,0),V(.05,1.28,.86),light);
    const columnBasePlate=box(assembly,V(-.83,.2,0),V(.1,1.7,1.7),light);
    columnBasePlate.position.set(-1.36,-1.95,0);columnBasePlate.rotation.z=Math.PI/2;
    const bolts=[],nuts=[],anchors=[],boltWashers=[],anchorWashers=[];
    const boltGeom=new T.CylinderGeometry(.085,.085,.095,6),anchorGeom=new T.CylinderGeometry(.034,.034,.6,16),shaftGeom=new T.CylinderGeometry(.034,.034,.36,16),washerGeom=new T.TorusGeometry(.08,.014,5,16);
    for(const y of [-.32,.72])for(const z of [-.30,.30]){
      const g=new T.Group();g.position.set(-.7,y,z);assembly.add(g);
      const head=new T.Mesh(boltGeom,violet);head.rotation.z=Math.PI/2;head.position.x=-0.035;g.add(head);
      const shaft=new T.Mesh(shaftGeom,steel);shaft.rotation.z=Math.PI/2;shaft.position.x=-.2;g.add(shaft);
      const washer=new T.Mesh(washerGeom,light);washer.rotation.y=Math.PI/2;washer.position.x=-.09;g.add(washer);
      bolts.push(g);
      boltWashers.push(washer);
    }

    for(const y of [-.32,.72])for(const z of [-.30,.30]){
      const g=new T.Group();g.position.set(-.7,y,z);assembly.add(g);
      const nut=new T.Mesh(boltGeom,violet);nut.rotation.z=Math.PI/2;nut.position.x=-0.27;g.add(nut);
      nuts.push(g);
    }

    for(const x of [-2,-0.73])for(const z of [-.65,.65]){
      const g=new T.Group();g.position.set(x,-1.8,z);assembly.add(g);
      const head=new T.Mesh(boltGeom,violet);head.position.y=-1.13;g.add(head);
      const anchor=new T.Mesh(anchorGeom,steel);anchor.position.y=-1.4;g.add(anchor);
      const washer=new T.Mesh(washerGeom,light);washer.rotation.x=Math.PI/2;washer.position.y=-1.193;g.add(washer);
      anchors.push(g);
      anchorWashers.push(washer);
    }
    // Ghosted alignment path makes the assembly direction legible.
    const guide=new T.Line(new T.BufferGeometry().setFromPoints([V(-2.2,.2,0),V(3.3,.2,0)]),new T.LineDashedMaterial({color:0x71627e,dashSize:.07,gapSize:.08,transparent:true,opacity:.5}));guide.computeLineDistances();assembly.add(guide);
    const guideColumn=new T.Line(new T.BufferGeometry().setFromPoints([V(-1,0,0),V(3.5,0,0)]),new T.LineDashedMaterial({color:0x71627e,dashSize:.07,gapSize:.08,transparent:true,opacity:.5}));guideColumn.computeLineDistances();assembly.add(guideColumn);
    guideColumn.rotation.z=Math.PI/2;guideColumn.position.set(-1.36,-1.4,0);
    function update(time,progress=0){
      const e=1-progress;
      beam.position.x=.56+e*.85;
      column.position.y=.56+(e-1)*0.85;
      beamEndPlate.position.x=-.83+e*.48;
      pedestal.position.y=-3.5+(1-e)*0.85;
      bolts.forEach((bolt,i)=>{bolt.position.x=-.7+e*(1.6);bolt.rotation.x=e*Math.PI*2;});
      nuts.forEach((nut,i)=>{nut.position.x=-.7-e*(0.4);nut.rotation.x=e*Math.PI*2;});
      anchors.forEach((anchor,i)=>{anchor.position.y=-.7+e*(1+(i%2)*.25)});
      columnBasePlate.position.y=-1.95-e*0.25;
      boltWashers.forEach((washer,i)=>washer.position.x=-.09+e*(-0.15));
      anchorWashers.forEach((washer,i)=>washer.position.y=-1.193+e*(-0.3));
    }
    update(0,0);
    return {root,assembly,beam,columnBasePlate,beamEndPlate,pedestal,bolts,update,height:7,target:V(.5,-1,0),view:V(3,4.5,11),reset(){update(0,0);}};
  }
  // the hero scene keeps its 'puppet' name in the page and kinetic.js; it is now the frame
  globalThis.KineticModels={puppet:frame,tensegrity,connection,V,clamp};
})();
