import * as THREE from 'three';
import { HexUtils } from './HexUtils.js';
import { VoxelModelManager } from './VoxelModelManager.js';

/**
 * HexGrid class handles creating and managing a hexagonal grid in Three.js
 */
class HexGrid {
  constructor(scene, hexSize = 1, radius = 10) {
    this.scene = scene;
    this.hexUtils = new HexUtils(hexSize);
    this.radius = radius;
    this.hexMeshes = {}; // Maps hex IDs to their meshes
    this.sphereObjects = {}; // Maps hex IDs to their sphere objects
    this.selectedHex = null;
    this.hoverHex = null;
    this.currentRoomCode = null; // We'll need to know the room code for updates
    this.socketManager = null; // Reference to socket manager for sending updates

    // Initialize voxel model components
    this.voxelModels = {}; // Maps hex IDs to their voxel model data
    this.voxelModelManager = null; // Will be initialized if VoxelModelManager exists

    // Set smaller radius for mobile devices to improve performance
    if (this.detectMobile()) {
      this.radius = Math.min(radius, 8); // Reduce radius on mobile for performance
    }

    // Create materials
    this.defaultMaterial = new THREE.MeshLambertMaterial({
      color: 0x3498db,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });

    this.hoverMaterial = new THREE.MeshLambertMaterial({
      color: 0x2ecc71,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });

    this.selectedMaterial = new THREE.MeshLambertMaterial({
      color: 0xe74c3c,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });

    // Create sphere material
    this.sphereMaterial = new THREE.MeshLambertMaterial({
      color: 0xf39c12, // Orange color for the sphere
      transparent: false,
      side: THREE.DoubleSide
    });

    // Create raycaster for hex selection
    this.raycaster = new THREE.Raycaster();

    // Initialize
    this.createGrid();

    // Initialize voxel model manager if the class exists
    this.initVoxelModelManager(scene);

    // Add scroll listener for height adjustment of selected hex
    window.addEventListener('wheel', this.handleScroll.bind(this));

    console.log('HexGrid constructor completed, voxelModelManager initialized:',
      this.voxelModelManager ? 'yes' : 'no',
      'VoxelModelManager class exists:',
      typeof VoxelModelManager !== 'undefined' ? 'yes' : 'no');
  }

  /**
   * Set the socket manager reference
   * @param {SocketManager} socketManager - Reference to socket manager
   */
  setSocketManager(socketManager) {
    this.socketManager = socketManager;
  }

  /**
   * Set the current room code
   * @param {string} roomCode - Current room code
   */
  setRoomCode(roomCode) {
    this.currentRoomCode = roomCode;
  }

  /**
   * Initialize the voxel model manager
   * @param {THREE.Scene} scene - The scene to add models to
   */
  initVoxelModelManager(scene) {
    // Skip if we've already initialized
    if (this.voxelModelManager) return;

    // Check if VoxelModelManager exists
    if (typeof VoxelModelManager === 'undefined') {
      console.error('VoxelModelManager class not available! Check script loading order.');
      return;
    }

    try {
      // Create the manager
      this.voxelModelManager = new VoxelModelManager(scene);
      console.log('Voxel model manager initialized successfully:', this.voxelModelManager);
    } catch (error) {
      console.error('Error initializing voxel model manager:', error);
      this.voxelModelManager = null;
    }
  }

  /**
 * Handle scroll wheel events to adjust selected hex height
 * @param {WheelEvent} event - Mouse wheel event
 * @returns {boolean} - Whether the event was handled by this method
 */
  handleScroll(event) {
    // Only proceed if we have a selected hex
    if (!this.selectedHex || !this.currentRoomCode || !this.socketManager) return false;

    // Always handle the scroll event when there's a selected hex, regardless of where it happened
    // This ensures that camera zoom is disabled while a hex is selected

    // Get current height or default to 1
    const currentHeight = this.selectedHex.userData.height || 1;

    // Calculate new height based on scroll direction
    // Use smaller increments for finer control
    const direction = event.deltaY > 0 ? -1 : 1;
    const heightChange = 0.25 * direction;
    let newHeight = Math.max(0.25, Math.min(5, currentHeight + heightChange));

    // Round to nearest 0.25 for cleaner values
    newHeight = Math.round(newHeight * 4) / 4;

    // Only update if height actually changed
    if (newHeight !== currentHeight) {
      // Create action with just the height change
      const action = {
        height: newHeight
      };

      // Send to server
      this.socketManager.sendHexAction(
        this.currentRoomCode,
        this.selectedHex.userData.hexId,
        action
      );
    }

    // Always return true when we have a selected hex to prevent camera zooming
    return true;
  }

  /**
   * Detect if the user is on a mobile device
   * @returns {boolean} True if on mobile device
   */
  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Create the hexagonal grid
   */
  createGrid() {
    const hexes = this.hexUtils.getHexesInRadius(0, 0, this.radius);

    // Process each hex in the grid
    hexes.forEach(hex => {
      const { q, r } = hex;
      const hexId = this.hexUtils.getHexId(q, r);

      // Create hexagon shape
      const corners = this.hexUtils.getHexCorners(q, r);
      const hexShape = new THREE.Shape();

      // Move to first corner
      hexShape.moveTo(corners[0].x, corners[0].z);

      // Draw lines to each corner
      for (let i = 1; i < corners.length; i++) {
        hexShape.lineTo(corners[i].x, corners[i].z);
      }

      // Close the shape
      hexShape.lineTo(corners[0].x, corners[0].z);

      // Create geometry from shape
      const geometry = new THREE.ShapeGeometry(hexShape);

      // Rotate to lie flat on xz plane
      geometry.rotateX(-Math.PI / 2);

      // Create mesh
      const mesh = new THREE.Mesh(geometry, this.defaultMaterial.clone());

      // Position slightly above the ground plane to avoid z-fighting
      mesh.position.y = 0.01;

      // Store hex data
      mesh.userData = { q, r, hexId, height: 0.01 };

      // Add to scene and store reference
      this.scene.add(mesh);
      this.hexMeshes[hexId] = mesh;
    });
  }

  /**
   * Handle mouse/touch movement for hex highlighting
   * @param {THREE.Vector2} pointerPosition - Normalized mouse/touch position
   * @param {THREE.Camera} camera - Current camera
   * @param {boolean} isDragging - Whether we are currently in a drag operation
   */
  handleMouseMove(pointerPosition, camera, isDragging = false) {
    // Skip hover effects completely for mobile devices and during dragging
    if (this.detectMobile() || isDragging) {
      // Clear any existing hover state
      if (this.hoverHex && this.hoverHex !== this.selectedHex) {
        this.hoverHex.material = this.defaultMaterial.clone();
        this.hoverHex = null;
      }
      return null;
    }

    this.raycaster.setFromCamera(pointerPosition, camera);

    // Find intersections
    const intersects = this.raycaster.intersectObjects(Object.values(this.hexMeshes));

    // Clear previous hover (but not if it's the selected hex)
    if (this.hoverHex && this.hoverHex !== this.selectedHex) {
      this.hoverHex.material = this.defaultMaterial.clone();
    }

    // Set new hover - but only on desktop
    if (intersects.length > 0) {
      const hex = intersects[0].object;

      if (hex !== this.selectedHex) {
        hex.material = this.hoverMaterial.clone();
        this.hoverHex = hex;
      }

      return hex;
    }

    this.hoverHex = null;
    return null;
  }

  /**
   * Handle mouse click or touch tap for hex selection
   * @param {THREE.Vector2} pointerPosition - Normalized mouse/touch position
   * @param {THREE.Camera} camera - Current camera
   * @returns {Object|null} Selected hex data or null if no hex was clicked
   */
  handleClick(pointerPosition, camera) {
    this.raycaster.setFromCamera(pointerPosition, camera);

    // Add some tolerance for touch input
    if (this.detectMobile()) {
      this.raycaster.params.Line.threshold = 0.1;
      this.raycaster.params.Points.threshold = 0.1;
    }

    // Find intersections
    const intersects = this.raycaster.intersectObjects(Object.values(this.hexMeshes));

    // Clear previous selection visual (but maintain selected hex)
    if (this.selectedHex) {
      // Restore default material to previous selection
      this.selectedHex.material = this.defaultMaterial.clone();
    }

    // If we clicked on a hex, select it
    if (intersects.length > 0) {
      const hex = intersects[0].object;

      // Apply selection material
      hex.material = this.selectedMaterial.clone();
      this.selectedHex = hex;

      // // Spawn a sphere above the selected hex
      // this.spawnSphereAboveHex(hex.userData.hexId);

      // Add this:
      this.createHexCenterMarker(hex.userData.hexId);

      return {
        hexId: hex.userData.hexId,
        q: hex.userData.q,
        r: hex.userData.r
      };
    } else {
      // If we clicked elsewhere, clear selection
      this.selectedHex = null;
      return null;
    }
  }

  /**
   * Update a hex's appearance based on its state
   * @param {string} hexId - Hex ID
   * @param {Object} state - New state data
   */
  updateHexState(hexId, state) {
    const hex = this.hexMeshes[hexId];
    if (!hex) return;

    // Keep track if this is the currently selected hex
    const wasSelected = hex === this.selectedHex;
    const wasHover = hex === this.hoverHex;

    // Store current height or use default if not available
    const currentHeight = hex.userData.height || 0.01;

    // Apply color change if specified
    if (state.color) {
      // Create a new material to avoid modifying shared materials
      const newMaterial = wasSelected ?
        this.selectedMaterial.clone() :
        (wasHover ? this.hoverMaterial.clone() : this.defaultMaterial.clone());

      // Set the new color
      newMaterial.color.set(state.color);
      hex.material = newMaterial;
    }

    // Handle voxel model data if present
    if (state.voxelModel) {
      // Create model options from incoming data
      const modelOptions = {
        fallbackType: state.voxelModel.type,
        heightOffset: 1.0, // Use a consistent height offset
        scale: state.voxelModel.scale || 0.5,
        rotation: state.voxelModel.rotation || { x: 0, y: 0, z: 0 }
      };

      // Create or update the model
      this.spawnVoxelModelOnHex(hexId, modelOptions);
    }

    // Then handle extrusion if height is specified
    if (state.height !== undefined) {
      // Store the new height in user data
      hex.userData.height = state.height;

      // Extrude the hex to create a 3D column
      this.extrudeHex(hex, state.height);

      // Update any voxel model that might be on this hex
      this.updateVoxelModel(hexId);

      // Update any sphere that might be on this hex
      this.updateSpherePosition(hexId);
    }
  }

  /**
   * Extrude a hex to create a 3D column
   * @param {THREE.Mesh} hexMesh - The hex mesh to extrude
   * @param {number} height - The height to extrude to
   */
  extrudeHex(hexMesh, height) {
    const { q, r } = hexMesh.userData;
    const hexId = hexMesh.userData.hexId;

    // Store selection state and material
    const wasSelected = hexMesh === this.selectedHex;
    const wasHover = hexMesh === this.hoverHex;
    const currentMaterial = hexMesh.material.clone();

    // Remove old mesh
    this.scene.remove(hexMesh);

    // Create corners
    const corners = this.hexUtils.getHexCorners(q, r);

    // Create extruded geometry
    const shape = new THREE.Shape();
    shape.moveTo(corners[0].x, corners[0].z);
    for (let i = 1; i < corners.length; i++) {
      shape.lineTo(corners[i].x, corners[i].z);
    }
    shape.lineTo(corners[0].x, corners[0].z);

    // Extrusion settings
    const extrudeSettings = {
      steps: 1,
      depth: height,
      bevelEnabled: false
    };

    // Create extruded geometry
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Rotate to correct orientation (extrude along Y axis)
    geometry.rotateX(-Math.PI / 2);

    // Create new mesh with the same material
    const newMesh = new THREE.Mesh(geometry, currentMaterial);

    // Copy user data, including height
    newMesh.userData = { q, r, hexId, height };

    // Add to scene
    this.scene.add(newMesh);

    // Store reference to replace the old one
    this.hexMeshes[hexId] = newMesh;

    // Restore selection state if needed
    if (wasSelected) {
      this.selectedHex = newMesh;
    }

    if (wasHover) {
      this.hoverHex = newMesh;
    }
  }

  /**
 * Spawns or updates a sphere above a hexagon
 * @param {string} hexId - ID of the hex to place the sphere above
 * @param {Object} options - Optional properties for the sphere
 */
  spawnSphereAboveHex(hexId, options = {}) {
    const hex = this.hexMeshes[hexId];
    if (!hex) return;

    // Default options
    const sphereOptions = {
      radius: options.radius || 0.5,
      color: options.color || 0xf39c12,
      height: options.height || 1.5 // Height above the hex
    };

    // If this hex already has a sphere, remove it first
    if (this.sphereObjects[hexId]) {
      this.scene.remove(this.sphereObjects[hexId]);
    }

    // Create sphere geometry
    const geometry = new THREE.SphereGeometry(sphereOptions.radius, 16, 16);

    // Create material (clone the default or use a custom color)
    const material = this.sphereMaterial.clone();
    if (sphereOptions.color) {
      material.color.set(sphereOptions.color);
    }

    // Create mesh
    const sphere = new THREE.Mesh(geometry, material);

    // Position the sphere
    const position = this.hexUtils.getObjectPosition(
      hex.userData.q,
      hex.userData.r,
      hex.userData.height + sphereOptions.heightOffset
    );
    sphere.position.copy(position);

    // Store the height offset in user data so we can maintain it during updates
    sphere.userData = {
      heightOffset: sphereOptions.heightOffset
    };

    // Position the sphere
    sphere.position.set(
      position.x,  // x coordinate from hex position
      hex.userData.height + sphereOptions.heightOffset, // Fixed height above the hex
      position.z   // z coordinate from hex position
    );

    // Add to scene
    this.scene.add(sphere);
    console.log('Sphere spawned above hex');

    // Store reference
    this.sphereObjects[hexId] = sphere;

    return sphere;
  }

  /**
 * Updates the position of a sphere when its hex changes height
 * @param {string} hexId - ID of the hex
 */
  updateSpherePosition(hexId) {
    const sphere = this.sphereObjects[hexId];
    const hex = this.hexMeshes[hexId];

    if (!sphere || !hex) return;

    // Use the stored height offset to position the sphere
    const heightOffset = sphere.userData.heightOffset || 2.0;

    // Update the y position to maintain fixed distance above the hex
    sphere.position.y = hex.userData.height + heightOffset;
  }

  // Add these methods to the HexGrid class in HexGrid.js



  /**
   * Spawn a voxel model on a hex
   * @param {string} hexId - ID of the hex to place the model on
   * @param {Object} options - Options for the model
   * @returns {THREE.Group} The model instance
   */
  /**
 * Spawn a voxel model on a hex
 * @param {string} hexId - ID of the hex to place the model on
 * @param {Object} options - Options for the model
 * @returns {THREE.Object3D} The model instance
 */
  spawnVoxelModelOnHex(hexId, options = {}) {

    // Check if VoxelModelManager class exists at all
    if (typeof VoxelModelManager === 'undefined') {
      console.error('VoxelModelManager class is not defined!');
      return null;
    }
    // Skip if voxel model manager isn't initialized
    if (!this.voxelModelManager) {
      console.warn('Cannot spawn voxel model: voxel model manager not initialized');
      return null;
    }

    const hex = this.hexMeshes[hexId];
    if (!hex) {
      console.warn(`Cannot spawn voxel model: hex ${hexId} not found`);
      return null;
    }

    // Default options
    const modelOptions = {
      heightOffset: options.heightOffset || 1.0, // Height above the hex
      scale: options.scale || 0.5
    };

    // If a model type was specified, convert it to a path
    if (options.modelType) {
      modelOptions.modelPath = `models/${options.modelType}.glb`;
    } else if (options.modelPath) {
      modelOptions.modelPath = options.modelPath;
    }

    // Add rotation if specified
    if (options.rotation) {
      modelOptions.rotation = options.rotation;
    }

    // Calculate position
    const position = this.hexUtils.getObjectPosition(
      hex.userData.q,
      hex.userData.r,
      hex.userData.height + modelOptions.heightOffset
    );

    // Store the height offset in user data for position updates
    this.voxelModels[hexId] = {
      heightOffset: modelOptions.heightOffset
    };

    // Create the model
    return this.voxelModelManager.placeModelAt(hexId, position, modelOptions);
  }

  /**
   * Update a voxel model's position when its hex changes height
   * @param {string} hexId - ID of the hex
   */
  updateVoxelModelPosition(hexId) {
    // Skip if we don't have this model
    if (!this.voxelModels[hexId]) return;

    const hex = this.hexMeshes[hexId];
    if (!hex) return;

    // Get the stored height offset
    const heightOffset = this.voxelModels[hexId].heightOffset || 0.5;

    // Calculate new position
    const position = this.hexUtils.getObjectPosition(
      hex.userData.q,
      hex.userData.r,
      hex.userData.height + heightOffset
    );

    // Update model position
    if (this.voxelModelManager) {
      this.voxelModelManager.updateModelPosition(hexId, position);
    }
  }

  /**
   * Remove a voxel model from a hex
   * @param {string} hexId - ID of the hex
   */
  removeVoxelModel(hexId) {
    if (this.voxelModelManager) {
      this.voxelModelManager.removeModel(hexId);
    }

    if (this.voxelModels[hexId]) {
      delete this.voxelModels[hexId];
    }
  }

  /**
   * Update voxel model when hex state changes
   * This should be called from updateHexState
   * @param {string} hexId - ID of the hex
   */
  updateVoxelModel(hexId) {
    // Only update if we have a model on this hex
    if (this.voxelModels[hexId]) {
      this.updateVoxelModelPosition(hexId);
    }
  }

  /**
  * Create a visual marker at the center of a hex for debugging
  * @param {string} hexId - ID of the hex
  */
  createHexCenterMarker(hexId) {
    const hex = this.hexMeshes[hexId];
    if (!hex) return;

    // Remove any existing marker
    if (this.centerMarker) {
      this.scene.remove(this.centerMarker);
    }

    // Create a small sphere to mark the hex center
    const geometry = new THREE.SphereGeometry(0.1, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red
    this.centerMarker = new THREE.Mesh(geometry, material);

    // Position at hex center
    const position = this.hexUtils.getObjectPosition(hex.userData.q, hex.userData.r, 0);
    this.centerMarker.position.copy(position);

    // Add to scene
    this.scene.add(this.centerMarker);

    // Log the position for debugging
    console.log('Hex center position:', {
      hexId,
      q: hex.userData.q,
      r: hex.userData.r,
      position: position,
      worldPosition: this.centerMarker.position
    });
  }

  /**
  * Debug method to visualize coordinates and check transformations
  */
  debugCoordinates() {
    // Create arrows showing the coordinate axes at origin
    const origin = new THREE.Vector3(0, 0, 0);

    // X axis (red)
    const xDir = new THREE.Vector3(1, 0, 0);
    const xArrow = new THREE.ArrowHelper(xDir, origin, 2, 0xff0000, 0.2, 0.1);
    this.scene.add(xArrow);

    // Y axis (green)
    const yDir = new THREE.Vector3(0, 1, 0);
    const yArrow = new THREE.ArrowHelper(yDir, origin, 2, 0x00ff00, 0.2, 0.1);
    this.scene.add(yArrow);

    // Z axis (blue)
    const zDir = new THREE.Vector3(0, 0, 1);
    const zArrow = new THREE.ArrowHelper(zDir, origin, 2, 0x0000ff, 0.2, 0.1);
    this.scene.add(zArrow);

    // Add a small sphere at coordinate (1,1) to test the transformation
    const testCoord = this.hexUtils.axialToPixel(1, 1);
    console.log('Test coordinate (1,1) transforms to:', testCoord);

    const testSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    testSphere.position.copy(testCoord);
    this.scene.add(testSphere);

    // Add another sphere with manual negative z
    const testSphere2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff00ff })
    );
    testSphere2.position.set(testCoord.x, testCoord.y, -testCoord.z);
    this.scene.add(testSphere2);

    console.log('Debug coordinates visualization added');
  }
}

export { HexGrid };