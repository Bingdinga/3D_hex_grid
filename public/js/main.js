/**
 * Main entry point for the 3D Hex Grid application
 */
class App {
  constructor() {
    console.log('App constructor started');

    try {
      // Check if THREE is loaded
      if (typeof THREE === 'undefined') {
        console.error('THREE is not defined - Three.js might not be loaded correctly');
        alert('Three.js library not loaded!');
        return;
      }

      console.log('THREE is defined, initializing scene...');

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

    // Disable context menu (right-click) for the application
    document.getElementById('game-container').addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
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

    // Implement custom camera controls
    this.implementCustomControls();

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);

    // Add a simple grid for reference
    const gridHelper = new THREE.GridHelper(30, 30, 0x555555, 0x333333);
    this.scene.add(gridHelper);

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

    // Set up click handling specifically for left-click on desktop
    window.addEventListener('click', (event) => {
      // Only proceed if it's a left-click (button 0)
      if (event.button !== 0) return;

      // Make sure the click is not on a UI element
      if (event.target.closest('#ui-overlay')) return;

      // Only process if we're not in a drag operation
      if (!this.controls.wasDragging) {
        this.handleHexClick();
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
        // The threshold is checked in touchmove and stored in wasDragging
        if (!this.controls.wasDragging) {
          this.handleHexClick();
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
    // Try to use ThreeOrbitControls if available from module import
    if (window.ThreeOrbitControls) {
      console.log('Using imported OrbitControls');
      this.controls = new window.ThreeOrbitControls(this.camera, this.renderer.domElement);
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

      return;
    }

    console.log('Using custom orbital controls');

    // Simple camera controls
    this.controls = {
      update: function () {
        // Reset dragging state on each frame if not actively moving
        if (!this.isMouseMoving && !this.isTouching && Date.now() - this.lastMoveTime > 300) {
          this.wasDragging = false;
        }
      },
      enabled: true,
      isMouseDown: false,
      isRightMouseDown: false,
      isMouseMoving: false,
      isTouching: false,
      wasDragging: false,
      dragThreshold: 5,  // Lower threshold for better distinction between tap and drag
      lastMoveTime: 0,
      lastMousePosition: { x: 0, y: 0 },
      lastTouchPosition: { x: 0, y: 0 },
      touchStartPosition: { x: 0, y: 0 },
      pinchStartDistance: 0,
      cameraDistance: 25,  // Initial camera distance
      cameraTheta: Math.PI / 4,  // Horizontal angle
      cameraPhi: Math.PI / 3,    // Vertical angle

      // Update camera position using spherical coordinates
      updateCameraPosition: (camera) => {
        if (!this.controls.enabled) return;

        const x = this.controls.cameraDistance * Math.sin(this.controls.cameraPhi) * Math.cos(this.controls.cameraTheta);
        const y = this.controls.cameraDistance * Math.cos(this.controls.cameraPhi);
        const z = this.controls.cameraDistance * Math.sin(this.controls.cameraPhi) * Math.sin(this.controls.cameraTheta);

        camera.position.set(x, y, z);
        camera.lookAt(0, 0, 0);
      }
    };

    // Initial camera position update
    this.controls.updateCameraPosition(this.camera);

    // Mouse down event - specifically track right mouse button for panning
    this.renderer.domElement.addEventListener('mousedown', (event) => {
      // Button 2 is right mouse button
      if (event.button === 2) {
        this.controls.isRightMouseDown = true;
        this.controls.lastMousePosition = {
          x: event.clientX,
          y: event.clientY
        };
        event.preventDefault();
      } else if (event.button === 0) {
        // Left button - just track for drag detection, don't actually do anything
        this.controls.isMouseDown = true;
        this.controls.wasDragging = false;
        this.controls.lastMousePosition = {
          x: event.clientX,
          y: event.clientY
        };
      }
    });

    // Mouse up event
    window.addEventListener('mouseup', (event) => {
      if (event.button === 2) {
        this.controls.isRightMouseDown = false;
      } else if (event.button === 0) {
        this.controls.isMouseDown = false;
      }

      this.controls.isMouseMoving = false;
    });

    // Mouse move event for rotation (but only on right-click)
    window.addEventListener('mousemove', (event) => {
      // Track if we're moving the mouse while button is down (for drag detection)
      if (this.controls.isMouseDown) {
        const deltaX = Math.abs(event.clientX - this.controls.lastMousePosition.x);
        const deltaY = Math.abs(event.clientY - this.controls.lastMousePosition.y);

        // If there's significant movement, consider it a drag
        if (deltaX > this.controls.dragThreshold || deltaY > this.controls.dragThreshold) {
          this.controls.wasDragging = true;
          this.controls.isMouseMoving = true;
          this.controls.lastMoveTime = Date.now();
        }
      }

      // Only respond to movement if right mouse button is down (for camera control)
      if (this.controls.isRightMouseDown && this.controls.enabled) {
        // Calculate deltas
        const deltaX = event.clientX - this.controls.lastMousePosition.x;
        const deltaY = event.clientY - this.controls.lastMousePosition.y;

        // Update angles
        this.controls.cameraTheta += deltaX * 0.01;

        // Clamp vertical rotation to avoid gimbal lock
        this.controls.cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.controls.cameraPhi - deltaY * 0.01));

        // Update camera position
        this.controls.updateCameraPosition(this.camera);

        // Save current position
        this.controls.lastMousePosition = {
          x: event.clientX,
          y: event.clientY
        };

        this.controls.isMouseMoving = true;
        this.controls.lastMoveTime = Date.now();
      }
    });

    // Touch start event for mobile
    this.renderer.domElement.addEventListener('touchstart', (event) => {
      event.preventDefault();

      if (event.touches.length === 1) {
        // Single touch - for rotation
        this.controls.isTouching = true;
        this.controls.wasDragging = false; // Reset drag flag on new touch
        const touch = event.touches[0];
        this.controls.lastTouchPosition = {
          x: touch.clientX,
          y: touch.clientY
        };
        this.controls.touchStartPosition = {
          x: touch.clientX,
          y: touch.clientY
        };
        this.controls.lastMoveTime = Date.now();
      }
      else if (event.touches.length === 2) {
        // Two touches - for pinch zoom
        this.controls.isTouching = true;
        this.controls.wasDragging = true; // Always consider multi-touch as a drag
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];

        // Calculate the distance between the two touches
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        this.controls.pinchStartDistance = Math.sqrt(dx * dx + dy * dy);
        this.controls.lastMoveTime = Date.now();
      }
    }, { passive: false });

    // Touch move event for mobile
    this.renderer.domElement.addEventListener('touchmove', (event) => {
      event.preventDefault();

      if (this.controls.isTouching && this.controls.enabled) {
        if (event.touches.length === 1) {
          // Single touch movement - rotation
          const touch = event.touches[0];

          // Calculate touch movement
          const deltaX = touch.clientX - this.controls.lastTouchPosition.x;
          const deltaY = touch.clientY - this.controls.lastTouchPosition.y;

          // Check if we've moved beyond the drag threshold
          const totalDeltaX = touch.clientX - this.controls.touchStartPosition.x;
          const totalDeltaY = touch.clientY - this.controls.touchStartPosition.y;
          const totalDelta = Math.sqrt(totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY);

          if (totalDelta > this.controls.dragThreshold) {
            this.controls.wasDragging = true;
          }

          // Update camera angles
          this.controls.cameraTheta += deltaX * 0.01;
          this.controls.cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.controls.cameraPhi - deltaY * 0.01));

          // Update camera position
          this.controls.updateCameraPosition(this.camera);

          // Save current position
          this.controls.lastTouchPosition = {
            x: touch.clientX,
            y: touch.clientY
          };

          this.controls.lastMoveTime = Date.now();
        }
        else if (event.touches.length === 2) {
          // Two-finger pinch-zoom
          const touch1 = event.touches[0];
          const touch2 = event.touches[1];

          // Calculate current distance between touches
          const dx = touch1.clientX - touch2.clientX;
          const dy = touch1.clientY - touch2.clientY;
          const currentDistance = Math.sqrt(dx * dx + dy * dy);

          // Calculate zoom factor
          const zoomFactor = currentDistance / this.controls.pinchStartDistance;

          // Update camera distance (zoom)
          this.controls.cameraDistance = Math.max(5, Math.min(50, this.controls.cameraDistance / zoomFactor));

          // Save the new distance
          this.controls.pinchStartDistance = currentDistance;

          // Update camera position
          this.controls.updateCameraPosition(this.camera);

          // Mark as dragging to prevent click after pinch
          this.controls.wasDragging = true;
          this.controls.lastMoveTime = Date.now();
        }
      }
    }, { passive: false });

    // Touch end event for mobile
    this.renderer.domElement.addEventListener('touchend', (event) => {
      event.preventDefault();
      this.controls.isTouching = false;

      // We'll maintain the wasDragging flag briefly to prevent accidental taps
      // It will be reset by the update method after a short delay
    }, { passive: false });

    // Mouse wheel for zoom
    this.renderer.domElement.addEventListener('wheel', (event) => {
      // First let the hex grid try to handle the event
      const hexHandled = this.hexGrid.handleScroll(event);

      // If hex grid didn't handle it and controls are enabled, use it for zoom
      if (!hexHandled && this.controls.enabled) {
        const zoomSpeed = 0.1;
        const direction = event.deltaY > 0 ? 1 : -1;

        // Update camera distance
        this.controls.cameraDistance = Math.max(5, Math.min(50, this.controls.cameraDistance * (1 + direction * zoomSpeed)));

        // Update camera position
        this.controls.updateCameraPosition(this.camera);

        // Prevent default scrolling behavior
        event.preventDefault();
      }
    }, { passive: false });

    // Disable context menu to allow right-click dragging
    this.renderer.domElement.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
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
   * Handle hex click and notify server
   */
  handleHexClick() {
    // Only send updates if we're in a room
    if (!this.currentRoomCode) return;

    const selectedHex = this.hexGrid.handleClick(this.mouse, this.camera);

    if (selectedHex) {
      console.log('Hex clicked:', selectedHex);

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
    requestAnimationFrame(this.animate.bind(this));

    // Update controls
    if (this.controls && typeof this.controls.update === 'function') {
      this.controls.update();
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
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
});