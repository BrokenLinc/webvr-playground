// Globals: WEBVR, THREE, document
import { makeFullViewport, makeRenderer, makeViveControllers, makeVREffect, warnIfNoVR } from './helpers';

export default (config) => {
  const {
    near = 0.1,
    far = 10,
    controller:controllerConfig,
    fog,
    background = 0x808080,
  } = config;
//  const controllerConfig = config.controller;
  let onRender;

  warnIfNoVR();

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  if(fog) scene.fog = new THREE.Fog(background, fog, far);

  // Camera
  const aspectRatio = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera( 70, aspectRatio, near, far );
  scene.add( camera );

  // Decor
  (function() {
  	// Floor
  	var geometry = new THREE.PlaneGeometry( 4, 4 );
  	var material = new THREE.MeshStandardMaterial( {
  		color: 0xeeeeee,
  		roughness: 1.0,
  		metalness: 0.0,
  	} );
    material.transparent = true;
    material.opacity = 0.2;
  	var floor = new THREE.Mesh( geometry, material );
  	floor.rotation.x = - Math.PI / 2;
  	floor.receiveShadow = true;
  	scene.add( floor );

  	// Lights
  	scene.add( new THREE.HemisphereLight( 0x808080, 0x606060 ) );

  	var light = new THREE.DirectionalLight( 0xffffff );
  	light.position.set( 0, 6, 0 );
  	light.castShadow = true;
  	light.shadow.camera.top = 2;
  	light.shadow.camera.bottom = -2;
  	light.shadow.camera.right = 2;
  	light.shadow.camera.left = -2;
  	light.shadow.mapSize.set( 4096, 4096 );
  	scene.add( light );
  })();

  // Vive Controllers
  const {controls, controller1, controller2} = makeViveControllers({camera, controllerConfig});
  scene.add( controller1 );
  scene.add( controller2 );

  // Fullscreen VR renderer
  const renderer = makeRenderer(window.document.body);
  const effect = makeVREffect(renderer);
  makeFullViewport(camera, effect);

  // Render loop
  function animate(time) {
  	effect.requestAnimationFrame( animate );
  	render(time);
  }

  // Render
  function render(time) {
  	controller1.update();
  	controller2.update();
  	controls.update();

    onRender && onRender(time);

  	effect.render( scene, camera );
  }

  // Public animation start
  function startAnimation(_onRender) {
    onRender = _onRender;
    animate();
  }

  return {
    scene,
    camera,
    renderer,
    effect,
    controls,
    controller1,
    controller2,
    startAnimation,
  };
}
