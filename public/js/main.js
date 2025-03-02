// Import statements
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Import your own modules
import { HexUtils } from './HexUtils.js';
import { VoxelModelManager } from './VoxelModelManager.js';
import { HexGrid } from './HexGrid.js';
import { UI } from './UI.js';
import { SocketManager } from './Socket.js';

// Make THREE available globally for compatibility
window.THREE = THREE;
window.GLTFLoader = GLTFLoader;

/**
 * Main entry point for the 3D Hex Grid application
 */
class App {
  constructor() {
    console.log('App constructor started');

    try {
      // Initialize Three.js
      this.initThree();
      console.log('Three.js initialized');

      // Initialize components
      this.ui = new UI();
      console.log('UI initialized');

      this.socketManager = new SocketManager();
      console.log('Socket manager initialized');

      // Initialize hex grid
      this.hexGrid = new HexGrid(this.scene, 1, 10);
      console.log('Hex grid initialized');

      // Connect components
      this.connectComponents();
      console.log('Components connected');

      // Start render loop
      this.animate = this.animate.bind(this); // Bind animate to preserve 'this' context
      this.animate();
      console.log('Animation loop started');

      // Detect if we're on a mobile device
      this.isMobile = this.detectMobile();
      console.log('Mobile device detection:', this.isMobile ? 'Mobile' : 'Desktop');

      // Prevent default touch behavior (scrolling, pinch-zoom)
      this.preventDefaultTouchBehavior();
    } catch (error) {
      console.error('Error during initialization:', error);
      alert('Error initializing application: ' + error.message);
    }
  }

  /**
   * Detect if the user is on a mobile device
   * @returns {boolean} True if on mobile device
   */
  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Initialize Three.js scene, camera, renderer, etc.
   */
  initThree() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 15, 20);
    this.camera.lookAt(0, 0, 0);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('canvas-container').appendChild(this.renderer.domElement);

    // Initialize controls using imported OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.25;
    this.controls.screenSpacePanning = false;
    this.controls.maxPolarAngle = Math.PI / 2;

    // Configure OrbitControls for our specific control scheme
    this.controls.mouseButtons = {
      LEFT: null,  // Disable left-click for OrbitControls
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE  // Right-click to rotate/pan
    };

    // Add touch gesture recognition for OrbitControls
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,  // One finger rotates
      TWO: THREE.TOUCH.DOLLY_PAN  // Two fingers for zoom/pan
    };

    // Add custom properties to track dragging
    this.controls.wasDragging = false;
    this.controls.isMouseDown = false;
    this.controls.isMouseMoving = false;
    this.controls.lastMoveTime = Date.now();
    this.controls.isRightMouseDown = false;
    this.controls.isTouching = false;

    // Override the update method to add our custom tracking
    const originalUpdate = this.controls.update.bind(this.controls);
    this.controls.update = () => {
      originalUpdate();

      // Reset dragging state on each frame if not actively moving
      if (!this.controls.isMouseMoving && Date.now() - this.controls.lastMoveTime > 300) {
        this.controls.wasDragging = false;
      }
    };

    // Add event listeners to track mouse movement for drag detection
    this.renderer.domElement.addEventListener('mousedown', () => {
      this.controls.isMouseDown = true;
      this.controls.lastMoveTime = Date.now();
    });

    this.renderer.domElement.addEventListener('mousemove', () => {
      if (this.controls.isMouseDown) {
        this.controls.isMouseMoving = true;
        this.controls.wasDragging = true;
        this.controls.lastMoveTime = Date.now();
      }
    });

    window.addEventListener('mouseup', () => {
      this.controls.isMouseDown = false;
      this.controls.isMouseMoving = false;
    });

    // Add this to the initThree method, near where the other event listeners are defined
    // Mouse wheel for zoom
    this.renderer.domElement.addEventListener('wheel', (event) => {
      // Only proceed if controls are enabled
      if (!this.controls.enabled) return;

      // Check if a hex is selected (in which case we prioritize height adjustment)
      if (this.hexGrid && this.hexGrid.selectedHex) {
        // Let the hex grid handle the scroll event for height adjustment
        const hexHandled = this.hexGrid.handleScroll(event);

        // Always prevent default and stop propagation when a hex is selected
        // to avoid camera zooming interference
        event.preventDefault();
        event.stopPropagation();

        // Disable OrbitControls zoom temporarily
        this.controls.enableZoom = false;
        // console.log('Zoom disabled');

        return;
      } else {
        this.controls.enableZoom = true;
        // console.log('Zoom enabled');
      }

      // If no hex is selected, let OrbitControls handle the zooming normally
      // No need to prevent default as OrbitControls will do that
    }, { passive: false });

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);

    // Add axes helper for debugging (X = red, Y = green, Z = blue)
    this.axesHelper = new THREE.AxesHelper(10); // 10 is the size of the axes
    this.gridHelper = new THREE.GridHelper(50, 50, 0x555555, 0x333333);
    this.scene.add(this.axesHelper);
    this.axesHelper.visible = false; // Hidden by default
    this.scene.add(this.gridHelper);
    this.gridHelper.visible = false; // Hidden by default

    // Set up mouse position tracking
    this.mouse = new THREE.Vector2();
    window.addEventListener('mousemove', (event) => {
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    // Set up touch position tracking for mobile
    window.addEventListener('touchmove', (event) => {
      if (event.touches.length > 0) {
        const touch = event.touches[0];
        this.mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
      }
    });

    // Use bind to preserve 'this' context
    const handleHexClick = this.handleHexClick.bind(this);

    // Set up click handling specifically for left-click on desktop
    window.addEventListener('click', (event) => {
      // Only proceed if it's a left-click (button 0)
      if (event.button !== 0) return;

      // Make sure the click is not on a UI element
      if (event.target.closest('#ui-overlay')) return;

      // Only process if we're not in a drag operation
      if (!this.controls.wasDragging) {
        handleHexClick();
      }
    });

    // Set up touch tap handling for mobile
    window.addEventListener('touchend', (event) => {
      // Make sure the tap is not on a UI element
      if (event.target.closest('#ui-overlay')) return;

      // Only handle single-finger taps (not multi-touch gestures)
      if (event.changedTouches.length === 1) {
        // Update mouse position one last time
        const touch = event.changedTouches[0];
        this.mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;

        // Check if this was a tap, not a drag 
        if (!this.controls.wasDragging) {
          handleHexClick();
        }
      }
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Handle device orientation changes
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      }, 200); // Small delay to allow browser to complete orientation change
    });
  }

  /**
   * Implement custom orbital controls
   */
  implementCustomControls() {
    // This method is now redundant as we're using OrbitControls directly in initThree
    console.log('Using imported OrbitControls');
  }

  /**
   * Connect all components and set up callbacks
   */
  connectComponents() {
    // UI to Socket connections
    this.ui.setCreateRoomCallback(() => {
      this.socketManager.createRoom();
    });

    this.ui.setJoinRoomCallback((roomCode) => {
      this.socketManager.joinRoom(roomCode);
    });

    this.ui.setSendChatMessageCallback((roomCode, message) => {
      this.socketManager.sendChatMessage(roomCode, message);
    });

    // Socket to UI connections
    this.socketManager.setRoomCreatedCallback((roomCode) => {
      this.currentRoomCode = roomCode;
      this.ui.updateRoomDisplay(roomCode);

      // Update HexGrid with room code and socket manager
      this.hexGrid.setRoomCode(roomCode);
      this.hexGrid.setSocketManager(this.socketManager);
    });

    this.socketManager.setRoomJoinedCallback((roomCode, state) => {
      this.currentRoomCode = roomCode;
      this.ui.updateRoomDisplay(roomCode);

      // Update HexGrid with room code and socket manager
      this.hexGrid.setRoomCode(roomCode);
      this.hexGrid.setSocketManager(this.socketManager);

      // Apply the existing room state to our grid
      if (state && Object.keys(state).length > 0) {
        console.log('Applying existing room state with', Object.keys(state).length, 'hexes');

        // Apply in batches to avoid UI freezing
        const hexIds = Object.keys(state);
        const batchSize = 10;

        // Function to process a batch
        const processBatch = (startIndex) => {
          const endIndex = Math.min(startIndex + batchSize, hexIds.length);

          for (let i = startIndex; i < endIndex; i++) {
            const hexId = hexIds[i];
            const hexState = state[hexId];
            this.hexGrid.updateHexState(hexId, hexState);
          }

          // Process next batch if there are more hexes
          if (endIndex < hexIds.length) {
            setTimeout(() => processBatch(endIndex), 10);
          }
        };

        // Start processing batches
        processBatch(0);
      }
    });

    this.socketManager.setRoomErrorCallback((error) => {
      this.ui.displayError(error);
    });

    this.socketManager.setChatMessageCallback((userId, message, timestamp) => {
      this.ui.displayChatMessage(userId, message, timestamp);
    });

    this.socketManager.setHexUpdatedCallback((hexId, action) => {
      this.hexGrid.updateHexState(hexId, action);
    });
  }

  /**
   * Prevent default touch behavior to avoid scrolling and zooming
   */
  preventDefaultTouchBehavior() {
    // Prevent scrolling when touching the canvas
    document.body.addEventListener('touchstart', function (e) {
      if (e.target === document.querySelector('#canvas-container canvas')) {
        e.preventDefault();
      }
    }, { passive: false });

    document.body.addEventListener('touchmove', function (e) {
      if (e.target === document.querySelector('#canvas-container canvas')) {
        e.preventDefault();
      }
    }, { passive: false });

    document.body.addEventListener('touchend', function (e) {
      if (e.target === document.querySelector('#canvas-container canvas')) {
        e.preventDefault();
      }
    }, { passive: false });

    // Track keyboard state for modifiers
    this.isShiftKeyPressed = false;
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') this.isShiftKeyPressed = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') this.isShiftKeyPressed = false;
    });

    // Add keyboard shortcut for toggling axes helper (press 'X' key)
    window.addEventListener('keydown', (event) => {
      // Toggle axes helper with 'X' key
      if (event.key === 'x' || event.key === 'X') {
        this.toggleAxesHelper();
      }
    });

    // Disable context menu (right-click) for the application
    document.getElementById('game-container').addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  /**
   * Handle hex click and notify server
   */
  handleHexClick() {
    // Only send updates if we're in a room
    if (!this.currentRoomCode) return;

    const selectedHex = this.hexGrid.handleClick(this.mouse, this.camera);

    if (selectedHex) {
      console.log('Hex clicked:', selectedHex);

      // Check if Shift key is pressed for placing a voxel model instead of changing color
      if (this.isShiftKeyPressed) {
        console.log('Placing voxel model (Shift key pressed)');
        this.handleVoxelModelPlacement(selectedHex.hexId);
        return;
      }

      // Only send color change on first click of a hex
      // We'll check if the hex already has a custom color by looking at the mesh
      const hexMesh = this.hexGrid.hexMeshes[selectedHex.hexId];
      const hasCustomColor = hexMesh &&
        hexMesh.material &&
        hexMesh.material.color &&
        hexMesh.material.color.getHex() !== this.hexGrid.defaultMaterial.color.getHex();

      // Only set color if it doesn't already have a custom color
      if (!hasCustomColor) {
        // Generate a random color
        const action = {
          color: this.getRandomColor(),
          height: 1.0 // Default starting height
        };

        // Send action to server
        this.socketManager.sendHexAction(
          this.currentRoomCode,
          selectedHex.hexId,
          action
        );
      }
    }
  }

  /**
   * Handle placing a voxel model on a hex
   * @param {string} hexId - ID of the clicked hex
   */
  handleVoxelModelPlacement(hexId) {
    // Only place models if we're in a room
    if (!this.currentRoomCode) return;

    // Check if the hex exists
    const hexMesh = this.hexGrid.hexMeshes[hexId];
    if (!hexMesh) return;

    // Get available model types
    const modelTypes = ['doom_voxel_marines', 'hot_air_ballon_voxel', 'voxel_isabelle', 'voxel_lucky_cat', 'voxel_world'];

    // Select a random model type
    const randomModelType = modelTypes[Math.floor(Math.random() * modelTypes.length)];

    // Create a model selection with animation parameters
    const modelOptions = {
      modelType: randomModelType,
      heightOffset: 1.0,
      scale: 0.5 + Math.random() * 0.5, // Random scale between 0.5 and 1.0
      rotation: {
        x: 0,
        y: Math.random() * Math.PI * 2, // Random Y rotation
        z: 0
      },
      animate: true,
      hoverRange: 0.1 + Math.random() * 0.15, // Random hover range
      hoverSpeed: 0.8 + Math.random() * 1.0, // Random hover speed
      rotateSpeed: 0.2 + Math.random() * 0.6 // Random rotation speed
    };

    // Place the model on the hex
    this.hexGrid.spawnVoxelModelOnHex(hexId, modelOptions);

    // Sync with other clients via socket
    if (this.socketManager) {
      const action = {
        voxelModel: {
          type: modelOptions.modelType,
          scale: modelOptions.scale,
          rotation: modelOptions.rotation,
          animate: modelOptions.animate,
          hoverRange: modelOptions.hoverRange,
          hoverSpeed: modelOptions.hoverSpeed,
          rotateSpeed: modelOptions.rotateSpeed
        }
      };

      this.socketManager.sendHexAction(
        this.currentRoomCode,
        hexId,
        action
      );
    }
  }

  /**
   * Generate a random hex color
   * @returns {string} Random hex color
   */
  getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  /**
   * Animation loop
   */
  animate() {
    requestAnimationFrame(this.animate);

    // Update controls
    if (this.controls && typeof this.controls.update === 'function') {
      this.controls.update();
    }

    // Update model animations if available
    if (this.hexGrid && this.hexGrid.voxelModelManager &&
      typeof this.hexGrid.voxelModelManager.updateAnimations === 'function') {
      this.hexGrid.voxelModelManager.updateAnimations();
    }

    // Check if we're currently dragging to avoid hover effects
    const isDragging = this.controls.isRightMouseDown ||
      this.controls.wasDragging ||
      (this.controls.isTouching && this.controls.wasDragging);

    // Update hex hover state - pass dragging state to prevent hover during camera movement
    this.hexGrid.handleMouseMove(this.mouse, this.camera, isDragging);

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Toggle the visibility of the coordinate axes
   */
  toggleAxesHelper() {
    if (this.axesHelper) {
      this.axesHelper.visible = !this.axesHelper.visible;
      console.log(`Axes helper is now ${this.axesHelper.visible ? 'visible' : 'hidden'}`);
      this.gridHelper.visible = !this.gridHelper.visible;
      console.log(`Grid helper is now ${this.gridHelper.visible ? 'visible' : 'hidden'}`);
    }
  }
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
});