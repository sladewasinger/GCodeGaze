// main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GCodeParser } from './GCodeParser.js'; // Adjust the path as necessary

// Set up Three.js scene, camera, and renderer
const scene = new THREE.Scene();
const aspectRatio = window.innerWidth / window.innerHeight;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvasContainer').appendChild(renderer.domElement);

const frustumSize = 1000;
const camera = new THREE.OrthographicCamera(
    frustumSize * aspectRatio / -2,
    frustumSize * aspectRatio / 2,
    frustumSize / 2,
    frustumSize / -2,
    1,
    2000
);

// Adjust camera position to look at the scene from a diagonal angle
camera.position.set(500, 500, 500);
camera.lookAt(0, 0, 0);

// Adjust the camera's up vector to be aligned with the Z-axis
camera.up.set(0, 0, 1);

// Set up controls for the camera
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = true;
controls.enablePan = true;
controls.enableZoom = true;
controls.minDistance = 100;
controls.maxDistance = 2000;
controls.screenSpacePanning = true; // Change to false for more natural "turntable" panning
controls.rotateSpeed = 1.0;
controls.panSpeed = 1.0;
controls.zoomSpeed = 1.0;

// Update target to the center of the build plate
controls.target.set(0, 0, 0);

// These restrictions can be adjusted or removed if you want more freedom in camera movement
controls.maxPolarAngle = Math.PI; // Prevent the camera from going below the build plate

// Update the camera and controls
camera.updateProjectionMatrix();
controls.update();

let extrusionLineSegments, travelLineSegments;
const purgeSphereMeshes = [];

// Function to visualize layers using Three.js
// After parsing the G-code and visualizing the initial layer
function visualizeLayers(layers) {
    // Set the slider's maximum to the number of layers
    const layerSlider = document.getElementById('layerSlider');
    layerSlider.max = layers.length - 1;

    // Initial layer visualization
    updateLayerVisualization(0);

    // Slider event listener
    layerSlider.oninput = function () {
        updateLayerVisualization(this.value);
    };


    function updateLayerVisualization(selectedLayerIndex) {
        // Remove existing line segments and purge spheres from the scene
        if (extrusionLineSegments) scene.remove(extrusionLineSegments);
        if (travelLineSegments) scene.remove(travelLineSegments);
        purgeSphereMeshes.forEach(mesh => scene.remove(mesh));
        purgeSphereMeshes.length = 0;

        // Create materials for the lines: one for extrusion (green) and one for travel (blue)
        const extrusionMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const travelMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });

        // Create geometries to hold all line segments
        const extrusionGeometry = new THREE.BufferGeometry();
        const travelGeometry = new THREE.BufferGeometry();
        const extrusionPositions = [];
        const travelPositions = [];

        // Collect line segment positions for all layers up to the selected index
        for (let i = 0; i <= selectedLayerIndex; i++) {
            const layer = layers[i];
            layer.movements.forEach(movement => {
                const positionsArray = movement.isExtruding ? extrusionPositions : travelPositions;
                positionsArray.push(movement.from.x, movement.from.y, movement.from.z);
                positionsArray.push(movement.to.x, movement.to.y, movement.to.z);
            });
        }

        // Create geometry and material for purge spheres
        const sphereGeometry = new THREE.SphereGeometry(2, 16, 16);
        const purgeMaterial = new THREE.MeshBasicMaterial({ color: 0xff8000 });

        // Render purge spheres for each layer up to the selected index
        for (let i = 0; i <= selectedLayerIndex; i++) {
            const layer = layers[i];
            layer.purges.forEach(purge => {
                const purgePosition = purge.position;
                const purgeSphere = new THREE.Mesh(sphereGeometry, purgeMaterial);
                purgeSphere.position.set(purgePosition.x, purgePosition.y, purgePosition.z);
                scene.add(purgeSphere);
                purgeSphereMeshes.push(purgeSphere);
            });
        }

        // Set the positions attribute of the geometries
        extrusionGeometry.setAttribute('position', new THREE.Float32BufferAttribute(extrusionPositions, 3));
        travelGeometry.setAttribute('position', new THREE.Float32BufferAttribute(travelPositions, 3));

        // Create line segment objects and add them to the scene
        extrusionLineSegments = new THREE.LineSegments(extrusionGeometry, extrusionMaterial);
        travelLineSegments = new THREE.LineSegments(travelGeometry, travelMaterial);
        scene.add(extrusionLineSegments);
        scene.add(travelLineSegments);

        // Render the scene
        renderer.render(scene, camera);
    }
}

// Function to handle G-code file upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const contents = e.target.result;
            const parser = new GCodeParser();
            const layers = parser.parse(contents);
            visualizeLayers(layers);
        };
        reader.readAsText(file);
    }
}

// Add event listener to file input
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.gcode';
fileInput.addEventListener('change', handleFileUpload);
document.getElementById("fileInputContainer").appendChild(fileInput);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();

// Resize handler
window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}