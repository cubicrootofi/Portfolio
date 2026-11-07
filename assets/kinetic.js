/* Three independent scenes share a visibility-aware scheduler and motion preference. */
(() => {
  'use strict';
  const T=globalThis.THREE,M=globalThis.KineticModels;
  const figures=[...document.querySelectorAll('[data-scene]')];
  const fallback=figure=>{
    figure.classList.add('is-fallback');
    const surface=figure.querySelector('.scene__surface');
    surface.tabIndex=-1;surface.setAttribute('role','img');
    figure.querySelector('.scene__hint').textContent='Static study · interactive 3D is unavailable in this browser';
    figure.querySelectorAll('input,button').forEach(el=>el.disabled=true);
  };
  if(!T||!M){figures.forEach(fallback);window.dispatchEvent(new Event('portfolio:scenes-ready'));return;}
  const motion=window.portfolioMotion;
  const scenes=[];let raf=0,last=0,elapsed=0;
  const wake=()=>{if(!raf&&!document.hidden)raf=requestAnimationFrame(frame);};
  function frame(now){
    raf=0;
    const dt=Math.min(.035,(now-last)/1000||.016);last=now;
    if(!motion.paused)elapsed+=dt;
    let running=false;
    scenes.forEach(s=>{
      if(!s.visible||s.lost)return;
      if(!motion.paused){s.step(dt);running=true;}
      else if(s.dirty)s.snap();
      if(!motion.paused||s.dirty){s.render();s.dirty=false;}
    });
    if(running)wake();
  }
  const invalidate=s=>{s.dirty=true;wake();};
  figures.forEach(figure=>{
    let renderer;
    try{
      renderer=new T.WebGLRenderer({canvas:figure.querySelector('canvas'),alpha:true,antialias:true,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));
      renderer.outputColorSpace=T.SRGBColorSpace;
      renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.48;
    }catch(error){fallback(figure);return;}
    const kind=figure.dataset.scene,surface=figure.querySelector('.scene__surface');
    const model=M[kind](),scene=new T.Scene();scene.add(model.root);
    const camera=new T.OrthographicCamera(-3,3,3,-3,.1,60);
    camera.position.copy(model.view);camera.lookAt(model.target);
    scene.add(new T.HemisphereLight(0xeee8ff,0x26212b,2.1));
    const key=new T.DirectionalLight(0xfff5e6,3.8);key.position.set(-4,6,7);scene.add(key);
    const rim=new T.DirectionalLight(0xad8ce3,3.4);rim.position.set(5,2,-3);scene.add(rim);
    const fill=new T.DirectionalLight(0xc8d6f4,1.5);fill.position.set(2,-1,5);scene.add(fill);
    const s={figure,surface,renderer,model,scene,camera,kind,visible:false,dirty:true,lost:false,
      x:0,y:0,vx:0,vy:0,targetX:0,targetY:0,angle:0,pitch:0,targetAngle:0,targetPitch:0,
      spread:.45,targetSpread:.45,progress:0,targetProgress:0,drag:null,targetDrag:null,manual:false,
      input:figure.querySelector('input'),output:figure.querySelector('output')};
    const pose=()=>{
      model.root.rotation.y=s.angle;model.root.rotation.x=s.pitch;
      if(kind==='puppet')model.update(elapsed,s.x,s.y,!motion.paused,s.targetX,s.targetY);
      if(kind==='tensegrity')model.update(elapsed,s.spread,s.drag);
      if(kind==='connection')model.update(elapsed,s.progress);
    };
    s.step=dt=>{
      if(kind==='puppet'){
        // A damped spring gives the body weight behind the control bar.
        s.vx+=(s.targetX-s.x)*24*dt;s.vy+=(s.targetY-s.y)*24*dt;
        s.vx*=Math.exp(-5.5*dt);s.vy*=Math.exp(-5.5*dt);
        s.x+=s.vx*dt;s.y+=s.vy*dt;
      }
      const blend=1-Math.exp(-7*dt);
      s.angle+=(s.targetAngle-s.angle)*blend;s.pitch+=(s.targetPitch-s.pitch)*blend;
      s.spread+=(s.targetSpread-s.spread)*blend;s.progress+=(s.targetProgress-s.progress)*blend;
      if(s.targetDrag){
        if(!s.drag)s.drag={...s.targetDrag};
        s.drag.x+=(s.targetDrag.x-s.drag.x)*blend;s.drag.y+=(s.targetDrag.y-s.drag.y)*blend;
      }else if(s.drag){s.drag.x*=Math.exp(-6*dt);s.drag.y*=Math.exp(-6*dt);if(Math.hypot(s.drag.x,s.drag.y)<.002)s.drag=null;}
      pose();
    };
    s.snap=()=>{s.x=s.targetX;s.y=s.targetY;s.angle=s.targetAngle;s.pitch=s.targetPitch;s.spread=s.targetSpread;s.progress=s.targetProgress;s.drag=s.targetDrag?{...s.targetDrag}:null;pose();};
    s.render=()=>renderer.render(scene,camera);
    const resize=()=>{
      const width=surface.clientWidth,height=surface.clientHeight;
      if(!width||!height)return;
      const aspect=width/height;
      // Fit the full object on narrow screens without clipping the suspension bar.
      const viewHeight=Math.max(model.height,(kind==='connection'?6.25:kind==='tensegrity'?5.5:3.8)/aspect);
      camera.top=viewHeight/2;camera.bottom=-viewHeight/2;camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2;camera.updateProjectionMatrix();
      renderer.setSize(width,height,false);invalidate(s);
    };
    new ResizeObserver(resize).observe(surface);
    new IntersectionObserver(([entry])=>{s.visible=entry.isIntersecting;if(s.visible)invalidate(s);},{rootMargin:'70px'}).observe(figure);
    const syncInput=value=>{if(s.input){const n=Math.round(value*100);s.input.value=n;s.output.textContent=n+'%';}};
    const raycaster=new T.Raycaster(),pointer=new T.Vector2();let gesture=null;
    const locate=e=>{const r=surface.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*2-1,y:1-(e.clientY-r.top)/r.height*2};};
    surface.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      const p=locate(e);pointer.set(p.x,p.y);raycaster.setFromCamera(pointer,camera);scene.updateMatrixWorld(true);
      let hit=kind==='tensegrity'?raycaster.intersectObjects(model.nodes,false)[0]:null;
      if(!hit&&kind==='tensegrity'&&e.pointerType==='touch'){
        const rect=surface.getBoundingClientRect();let nearest=28;
        model.nodes.forEach(node=>{const q=node.getWorldPosition(new T.Vector3()).project(camera);const distance=Math.hypot((q.x-p.x)*rect.width/2,(q.y-p.y)*rect.height/2);if(distance<nearest){nearest=distance;hit={object:node};}});
      }
      gesture={id:e.pointerId,startX:e.clientX,startY:e.clientY,angle:s.targetAngle,pitch:s.targetPitch,node:hit?.object.userData.nodeIndex,initial:p};
      surface.setPointerCapture(e.pointerId);surface.focus({preventScroll:true});invalidate(s);
    });
    surface.addEventListener('pointermove',e=>{
      const p=locate(e);
      if(kind==='puppet'&&(e.pointerType==='mouse'||gesture)){
        s.targetX=M.clamp(p.x*1.15,-1,1);s.targetY=M.clamp(p.y*.9,-1,1);invalidate(s);
      }
      if(!gesture||gesture.id!==e.pointerId||kind==='puppet')return;
      const dx=e.clientX-gesture.startX,dy=e.clientY-gesture.startY;
      if(gesture.node!==undefined)s.targetDrag={index:gesture.node,x:M.clamp((p.x-gesture.initial.x)*2.6,-.85,.85),y:M.clamp((p.y-gesture.initial.y)*2.6,-.85,.85)};
      else{s.targetAngle=gesture.angle+dx*.008;s.targetPitch=M.clamp(gesture.pitch+dy*.004,-.4,.4);}
      invalidate(s);
    },{passive:true});
    const release=()=>{gesture=null;s.targetDrag=null;if(kind==='puppet'){s.targetX=0;s.targetY=0;}invalidate(s);};
    surface.addEventListener('pointerup',release);surface.addEventListener('pointercancel',release);surface.addEventListener('lostpointercapture',release);
    surface.addEventListener('pointerleave',()=>{if(!gesture&&kind==='puppet')release();});
    surface.addEventListener('keydown',e=>{
      const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'];
      if(!keys.includes(e.key))return;e.preventDefault();
      if(e.key==='Home'){reset();return;}
      const dx=e.key==='ArrowRight'?.2:e.key==='ArrowLeft'?-.2:0;
      const dy=e.key==='ArrowUp'?.2:e.key==='ArrowDown'?-.2:0;
      if(kind==='puppet'){s.targetX=M.clamp(s.targetX+dx,-1,1);s.targetY=M.clamp(s.targetY+dy,-1,1);}
      else{s.targetAngle+=dx;s.targetPitch=M.clamp(s.targetPitch-dy,-.4,.4);}
      invalidate(s);
    });
    function reset(){
      gesture=null;s.targetX=s.targetY=s.targetAngle=s.targetPitch=0;s.vx=s.vy=0;s.targetDrag=null;
      if(kind==='tensegrity'){s.targetSpread=.45;syncInput(.45);}
      if(kind==='connection'){s.manual=false;scrollProgress();}
      if(motion.paused)s.snap();invalidate(s);
    }
    figure.querySelector('[data-reset]').addEventListener('click',reset);
    if(s.input)s.input.addEventListener('input',()=>{
      const value=Number(s.input.value)/100;s.output.textContent=s.input.value+'%';
      if(kind==='tensegrity')s.targetSpread=value;
      else{s.manual=true;s.targetProgress=value;}
      invalidate(s);
    });
    function scrollProgress(){
      if(kind!=='connection'||s.manual)return;
      // Native page scroll drives the assembly, without pinning or stealing scroll.
      const r=figure.getBoundingClientRect();
      // Fractions of the screen height, measured from the top, for where the figure's top edge is:
      // assembly starts at START and is complete by END (the section is fully in view by then).
      const START = .7, END = .12;
      s.targetProgress = M.clamp((innerHeight*START - r.top) / Math.max(1, innerHeight*(START - END)), 0, 1);
      syncInput(s.targetProgress); // keeps the Assembly slider and its % in step with the scroll
      if(s.visible)invalidate(s);
    }
    if(kind==='connection'){
      window.addEventListener('scroll',scrollProgress,{passive:true});window.addEventListener('resize',scrollProgress);scrollProgress();
      const resetButton=figure.querySelector('[data-reset]');resetButton.textContent='Follow scroll ↺';resetButton.setAttribute('aria-label','Reset view and let scrolling control the assembly');
    }
    const canvas=figure.querySelector('canvas');
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();s.lost=true;figure.classList.remove('is-ready');fallback(figure);});
    canvas.addEventListener('webglcontextrestored',()=>location.reload());
    s.snap();resize();s.render();figure.classList.add('is-ready');scenes.push(s);
  });
  window.addEventListener('portfolio:motion',()=>{scenes.forEach(s=>{s.dirty=true;});wake();});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;}
    else{last=performance.now();scenes.forEach(s=>s.dirty=true);wake();}
  });
  window.dispatchEvent(new Event('portfolio:scenes-ready'));
  wake();
})();
