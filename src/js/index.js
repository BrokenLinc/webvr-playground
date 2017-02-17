// Globals: WEBVR, THREE, document
import '../css/app.less';
import config from './config';
import bootstrapvr from './bootstrapvr';
import TWEEN from 'tween.js';

import { getFirstControllerIntersection, pickup, drop, scaleAround, deepClone } from './helpers';

const SCALE_SPEED = 101/100;
const MOVE_SPEED = 1/30;
const FRICTION = 100/98;

const {
	scene, camera, renderer, effect,
  controls, controller1, controller2,
  startAnimation
} = bootstrapvr(config);

const setupTools = (controller) => {
	var palette = new THREE.Group();
	palette.position.set(0, 0.02, 0);
	//palette.rotation.set(0, 0, 0);
	controller.add( palette );

	var geometry = new THREE.CylinderGeometry( 0.3, 0.307, 0.01, 128 );
	var material = new THREE.MeshPhongMaterial({
		color: 0x00081e,
		shading: THREE.FlatShading,
	});
	material.transparent = true;
	material.opacity = 0.5;
	var paletteBoard = new THREE.Mesh( geometry, material );
	paletteBoard.castShadow = true;
	paletteBoard.receiveShadow = true;
	palette.add(paletteBoard);

	var shapeLibrary = new THREE.Group();
	palette.add(shapeLibrary);

	const shapeMap = [
		() => new THREE.ConeGeometry(0.04, 0.16, 32),
		() => new THREE.DodecahedronGeometry(0.04),
		() => new THREE.SphereGeometry(0.04, 32, 32),
		() => new THREE.TorusGeometry(0.04, 0.01, 16, 32),
	];

	for(var i=0; i<shapeMap.length; i++) {
		var x = Math.cos(i/shapeMap.length * Math.PI*2) * 0.25;
		var y = Math.sin(i/shapeMap.length * Math.PI*2) * 0.25;
		var objectGeometry = shapeMap[i]();
		var objectMaterial = new THREE.MeshPhongMaterial({
			color: 0xbbccff,
			shading: THREE.FlatShading,
		});
		var shape = new THREE.Mesh( objectGeometry, objectMaterial );
		shape.castShadow = true;
		shape.receiveShadow = true;
		shape.position.set(x, 0.04, y);

		shapeLibrary.add( shape );
	}

	palette.scale.set(0.001, 0.001, 0.001);
	palette.rotation.set(0,Math.PI/3,0);

	controller.userData.palette = palette;

	return {
		shapeLibrary,
	};
}

const { shapeLibrary } = setupTools(controller1);

// List of lit-up objects to clear routinely
const intersected = [];

// Scattered shapes
const groupPivot = new THREE.Group();
scene.add( groupPivot );
const group = new THREE.Group();
groupPivot.add( group );

// funky object
const dodecs = (function() {
	const objects = [];
	for(var i=0; i<10; i++) {
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
controller1.addEventListener( 'menudown', onMenuDown );
controller1.addEventListener( 'menuup', onMenuUp );
// ****************

startAnimation((time) => {
	moveObjects();

	if(time) TWEEN.update();

	testTrigger(controller1);
	testTrigger(controller2);

	testGrips(controller1, 1/SCALE_SPEED);
	testGrips(controller2, SCALE_SPEED);

	testThumbpad(controller1);
	testThumbpad(controller2);

	cleanIntersected();
	intersectObjects(controller1);
	intersectObjects(controller2);
});

function moveObjects() {
	for(var i in group.children) {
		const object = group.children[i];
		if(object.velocity) {
			let counter = (object.counter || 0) + 1;
			if(counter % 40 === 0) {
				group.add(deepClone(object));
			}
			object.counter = counter;

			const scaledVelocity = object.velocity.clone();
			scaledVelocity.multiplyScalar(1/groupPivot.scale.x);
			object.position.add(scaledVelocity);
			object.velocity.multiplyScalar(1/FRICTION);

			if(object.velocity.length() < 0.001) {
				object.velocity = null;
			}
		}
	}
}

function testTrigger(controller) {
	if(controller.userData.selected) {
		const object = controller.userData.selected;
		controller.userData.selectedPositions.unshift(object.getWorldPosition());
	}
}

function testThumbpad(controller) {
	if(controller.getButtonState('thumbpad')) {
		moveWorld(controller);
	}
}

function moveWorld(controller) {
	const speed = controller.getGamepad().axes[1] * MOVE_SPEED;
	groupPivot.translateOnAxis(controller.getWorldDirection(), speed);
}

function testGrips(controller, scaleFactor) {
	if(controller.getButtonState('grips')) {
		if(controller.userData.selected) {
			scaleObject(controller.userData.selected, scaleFactor);
		} else {
			scaleWorld(controller, scaleFactor);
		}
	}
}

function scaleObject(object, scaleFactor) {
	const newScale = object.scale.x * scaleFactor;
	object.scale.set(newScale, newScale, newScale);
}

function scaleWorld(controller, scaleFactor) {
	const intersection = getFirstControllerIntersection(controller, group.children);

	if (intersection) {
		scaleAround(group, intersection.point, scaleFactor);
	}
}

// Grab an object
function onTriggerDown({ target:controller }) {
	let intersection = getFirstControllerIntersection(controller, group.children);

	if (intersection) {
		const object = pickup(intersection.object, controller);
		//object.material.emissive.b = 1; // glows blue
		object.material.emissive.r = 0;
		controller.userData.selected = object;
		controller.userData.selectedPositions = [];
		controller.beam.visible = false;
		return;
	}

	// Yuck
	if(controller === controller2 && controller1.userData.palette.visible) {
		intersection = getFirstControllerIntersection(controller, shapeLibrary.children);

		if (intersection) {
			const object = pickup(intersection.object, controller, true);
			//object.material.emissive.b = 1; // glows blue
			object.material.emissive.r = 0;
			controller.userData.selected = object;
			controller.userData.selectedPositions = [];
			controller.beam.visible = false;
			return;
		}
	}
}

// Drop current object
function onTriggerUp({ target:controller }) {
	const object = controller.userData.selected;
	if (object) {
		drop(object, group);
		object.material.emissive.b = 0;
		controller.userData.selected = undefined;
		controller.beam.visible = true;

		object.velocity = new THREE.Vector3().subVectors(controller.userData.selectedPositions[0], controller.userData.selectedPositions[1]);
	}
}

function onMenuDown({ target:controller }) {
	//controller.userData.palette.visible = !controller.userData.palette.visible;

	var startingScale = {
		x: controller.userData.palette.scale.x,
		y: controller.userData.palette.scale.y,
		z: controller.userData.palette.scale.z,
	};
	var startingRotation = {
		x: controller.userData.palette.rotation.x,
		y: controller.userData.palette.rotation.y,
		z: controller.userData.palette.rotation.z,
	};

	controller.userData.paletteTween && controller.userData.paletteTween.stop();
	controller.userData.paletteRotationTween && controller.userData.paletteRotationTween.stop();

	controller.userData.paletteTween = new TWEEN.Tween(startingScale)
			.to({ x: 1, y: 1, z: 1 }, 200)
			.easing(TWEEN.Easing.Quadratic.Out)
	    .onUpdate(function() {
				controller.userData.palette.scale.set(this.x, this.y, this.z);
	    })
			.start();

	controller.userData.paletteRotationTween = new TWEEN.Tween(startingRotation)
			.to({ x: 0, y: 0, z: 0 }, 200)
			.easing(TWEEN.Easing.Quadratic.Out)
	    .onUpdate(function() {
				controller.userData.palette.rotation.set(this.x, this.y, this.z);
	    })
			.start();
}

function onMenuUp({ target:controller }) {
	//controller.userData.palette.visible = !controller.userData.palette.visible;

	var startingScale = {
		x: controller.userData.palette.scale.x,
		y: controller.userData.palette.scale.y,
		z: controller.userData.palette.scale.z,
	};
	var startingRotation = {
		x: controller.userData.palette.rotation.x,
		y: controller.userData.palette.rotation.y,
		z: controller.userData.palette.rotation.z,
	};

	controller.userData.paletteTween && controller.userData.paletteTween.stop();
	controller.userData.paletteRotationTween && controller.userData.paletteRotationTween.stop();

	controller.userData.paletteTween = new TWEEN.Tween(startingScale)
			.to({ x: 0.001, y: 0.001, z: 0.001 }, 200)
			.easing(TWEEN.Easing.Quadratic.Out)
	    .onUpdate(function() {
				controller.userData.palette.scale.set(this.x, this.y, this.z);
	    })
			.start();

	controller.userData.paletteRotationTween = new TWEEN.Tween(startingRotation)
			.to({ x: 0, y: Math.PI/3, z: 0 }, 200)
			.easing(TWEEN.Easing.Quadratic.Out)
	    .onUpdate(function() {
				controller.userData.palette.rotation.set(this.x, this.y, this.z);
	    })
			.start();
}

// Make the beam stop at first object, and light it up
function intersectObjects( controller ) {
	// Skip this if the controller is holding an object
	if (controller.userData.selected) return;

	const intersection = getFirstControllerIntersection(controller, group.children);

	if (intersection) {
		const object = intersection.object;
		object.material.emissive.r = 0.1; // glows red
		intersected.push(object);
		controller.beam.scale.z = intersection.distance; // stop at the object
	} else {
		controller.beam.scale.z = 5; // long beam!
	}
}

// Clear all intersections
function cleanIntersected() {
	while (intersected.length) {
		intersected.pop().material.emissive.r = 0;
	}
}
