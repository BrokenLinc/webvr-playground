// Globals: WEBVR, THREE, document

module.exports.makeFullViewport = (camera, effect) => {
  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    effect.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onWindowResize, false);
};

module.exports.warnIfNoVR = () => {
  if (WEBVR.isAvailable() === false) {
  	window.document.body.appendChild(WEBVR.getMessage());
  }
};

module.exports.makeViveControllers = ({ camera, controllerConfig }) => {
  const { beams, modelPath, modelFile, texturePath, textureFile, specularFile } = controllerConfig;

	// Headset
	const controls = new THREE.VRControls( camera );
	controls.standing = true;

  // Inputs
  const controller1 = new THREE.ViveController( 0 );
  controller1.standingMatrix = controls.getStandingMatrix();

  const controller2 = new THREE.ViveController( 1 );
  controller2.standingMatrix = controls.getStandingMatrix();

  // Beams
  if(beams) {
    const geometry = new THREE.Geometry();
    geometry.vertices.push( new THREE.Vector3( 0, 0, 0 ) );
    geometry.vertices.push( new THREE.Vector3( 0, 0, - 1 ) );

    const line = new THREE.Line( geometry );
    line.scale.z = 5;

    controller1.beam = line.clone();
    controller2.beam = line.clone();

    controller1.add( controller1.beam );
    controller2.add( controller2.beam );
  } else {
    // Make empty shim object for references
    controller1.beam = new THREE.Object3D();
    controller2.beam = new THREE.Object3D();

    controller1.add( controller1.beam );
    controller2.add( controller2.beam );
  }

  // Models
  var loader = new THREE.OBJLoader();
  loader.setPath(modelPath);
  loader.load(modelFile, function ( object ) {

    var loader = new THREE.TextureLoader();
    loader.setPath(texturePath);

    var controller = object.children[ 0 ];
    controller.material.map = loader.load(textureFile);
    controller.material.specularMap = loader.load(specularFile);

    controller1.add( object.clone() );
    controller2.add( object.clone() );
  });

  return { controls, controller1, controller2 };
}

module.exports.makeRenderer = (domElement) => {
  const renderer = new THREE.WebGLRenderer( { antialias: true } );
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.shadowMap.enabled = true;
  renderer.gammaInput = true;
  renderer.gammaOutput = true;
  domElement.appendChild( renderer.domElement );
  return renderer;
}

module.exports.makeVREffect = (renderer) => {
	const effect = new THREE.VREffect( renderer );
	if ( WEBVR.isAvailable() === true ) {
		document.body.appendChild( WEBVR.getButton( effect ) );
	}
  return effect;
}

const getRaycasterFromController =
module.exports.getRaycasterFromController = (controller) => {
  const raycaster = new THREE.Raycaster();
  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation( controller.matrixWorld );
  raycaster.ray.origin.setFromMatrixPosition( controller.matrixWorld );
  raycaster.ray.direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );
  return raycaster;
}

// Determine controller beam collisions
const getControllerIntersections =
module.exports.getControllerIntersections = ( controller, objects ) => {
  // const raycaster = new THREE.Raycaster();
  // const tempMatrix = new THREE.Matrix4();
	// tempMatrix.identity().extractRotation( controller.matrixWorld );
	// raycaster.ray.origin.setFromMatrixPosition( controller.matrixWorld );
	// raycaster.ray.direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );
  // return raycaster.intersectObjects( objects );
  return getRaycasterFromController(controller).intersectObjects(objects);
};

module.exports.getFirstControllerIntersection = ( controller, objects ) => {
  const intersections = getControllerIntersections( controller, objects );
  return intersections.length > 0 ? intersections[0] : null;
};

const deepClone =
module.exports.deepClone = (object) => {
  const clonedObject = object.clone();
  clonedObject.material = object.material.clone();
  return clonedObject;
};

module.exports.pickup =
module.exports.drop =
module.exports.transfer = (_object, destination, doClone) => {
  const object = doClone ? deepClone(_object) : _object;

  object.material.color.setHex(Math.random() * 0xffffff);

  object.matrix.premultiply( _object.parent.matrixWorld );

  const tempMatrix = new THREE.Matrix4();
  tempMatrix.getInverse( destination.matrixWorld );
  object.matrix.premultiply( tempMatrix );

  object.matrix.decompose( object.position, object.quaternion, object.scale );
  destination.add( object );

  return object;
}

// `object.parent` must be a pivot container in world coordinates
// `point` must be in world coordinates
// `scaleFactor` is a multiplier
module.exports.scaleAround = (object, point, scaleFactor) => {
	const pivot = object.parent;
	const scale = pivot.scale.x;

	object.position.set(
		object.position.x + (pivot.position.x - point.x) / scale,
		object.position.y + (pivot.position.y - point.y) / scale,
		object.position.z + (pivot.position.z - point.z) / scale
	);

	pivot.position.set(point.x,point.y,point.z);

	const newScale = scale * scaleFactor;
	pivot.scale.set(newScale, newScale, newScale);
}
