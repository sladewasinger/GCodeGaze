// main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GCodeParser } from './GCodeParser.js'; // Adjust the path as necessary

// Set up Three.js scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvasContainer').appendChild(renderer.domElement);

// Set up controls for the camera
const controls = new OrbitControls(camera, renderer.domElement);

// Function to visualize layers using Three.js
function visualizeLayers(layers) {
    // Clear existing scene
    while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }

    // Create a material for the lines
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });

    // Iterate over layers and movements to create lines
    layers.forEach(layer => {
        layer.movements.forEach(movement => {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(movement.from.x, movement.from.y, movement.from.z),
                new THREE.Vector3(movement.to.x, movement.to.y, movement.to.z)
            ]);
            const line = new THREE.Line(geometry, material);
            scene.add(line);
        });
    });

    // Update camera position to fit the scene
    controls.target.set(0, 0, 0);
    camera.position.set(0, 0, Math.max(500, 2 * layers.length));
    camera.lookAt(controls.target);
    controls.update();
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