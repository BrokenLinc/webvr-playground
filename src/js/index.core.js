// Globals: WEBVR, THREE, document
import '../css/app.less';
import config from './config';
import bootstrapvr from './bootstrapvr';

import { getFirstIntersection, getIntersections, pickup, drop } from './helpers';

const {
	scene, camera, renderer, effect,
  controls, controller1, controller2,
  startAnimation
} = bootstrapvr(config);

// List of lit-up objects to clear routinely
const intersected = [];

// Scattered shapes x 50
const group = new THREE.Group();
scene.add( group );

// funky object
const dodecs = (function() {
	const objects = [];
	for(var i=0; i<1; i++) {
		var geometry = new THREE.DodecahedronGeometry(0.3);
		var material = new THREE.MeshPhongMaterial({
			color: Math.random() * 0xffffff,
			shading: THREE.FlatShading,
		});

		var object = new THREE.Mesh(geometry, material);
		object.position.y = 0.5;
		object.castShadow = true;
		object.receiveShadow = true;

		group.add( object );
		objects.push(object);
	}

	return objects;
})();

// ****************
// Vive Controllers
controller1.addEventListener( 'triggerdown', onTriggerDown );
controller1.addEventListener( 'triggerup', onTriggerUp );
controller2.addEventListener( 'triggerdown', onTriggerDown );
controller2.addEventListener( 'triggerup', onTriggerUp );
// ****************

startAnimation(() => {
	cleanIntersected();
	intersectObjects( controller1 );
	intersectObjects( controller2 );
});

// Grab an object
function onTriggerDown({ target:controller }) {
	const intersection = getFirstIntersection(controller, group);

	if (intersection && intersection.distance<1) {
		const object = intersection.object;
		pickup(object, controller);
		object.material.emissive.b = 1;
		controller.userData.selected = object;
	}
}

// Drop current object
function onTriggerUp({ target:controller }) {
	const object = controller.userData.selected;
	if (object) {
		drop(object, group);
		object.material.emissive.b = 0;
		controller.userData.selected = undefined;
	}
}

// Make the beam stop at first object, and light it up
function intersectObjects( controller ) {
	// Skip this if the controller is holding an object
	if (controller.userData.selected) return;

	const beam = controller.getObjectByName('beam');
	const intersection = getFirstIntersection(controller, group);

	if (intersection) {
		const object = intersection.object;
		object.material.emissive.r = 1;
		intersected.push(object);
		if (beam) beam.scale.z = intersection.distance; // stop at the object
	} else {
		if (beam) beam.scale.z = 5; // long beam!
	}
}

// Clear all intersections
function cleanIntersected() {
	while (intersected.length) {
		intersected.pop().material.emissive.r = 0;
	}
}
