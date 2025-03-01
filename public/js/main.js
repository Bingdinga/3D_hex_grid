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
    document.body.addEventListener('touchstart', function(e) {
      if (e.target === document.querySelector('#canvas-container canvas')) {
        e.preventDefault();
      }
    }, { passive: false });
    
    document.body.addEventListener('touchmove', function(e) {
      if (e.target === document.querySelector('#canvas-container canvas')) {
        e.preventDefault();
      }
    }, { passive: false });
    
    document.body.addEventListener('touchend', function(e) {
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
    
    // Set up click handling
    window.addEventListener('click', (event) => {
      // Make sure the click is not on a UI element
      if (event.target.closest('#ui-overlay')) return;
      
      this.handleHexClick();
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
        
        // Check if this was a tap, not a drag (movement less than threshold)
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
      
      // Add touch gesture recognition for OrbitControls
      this.controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
      };
      
      return;
    }
    
    console.log('Using custom orbital controls');
    
    // Simple camera controls
    this.controls = {
      update: function() {},  // Empty update function for animation loop
      enabled: true,
      isMouseDown: false,
      isTouching: false,
      wasDragging: false,
      dragThreshold: 10,
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
    
    // Mouse down event
    this.renderer.domElement.addEventListener('mousedown', (event) => {
      if (event.button === 0) { // Left mouse button
        this.controls.isMouseDown = true;
        this.controls.lastMousePosition = {
          x: event.clientX,
          y: event.clientY
        };
        
        // Prevent default behavior
        event.preventDefault();
      }
    });
    
    // Mouse up event
    window.addEventListener('mouseup', () => {
      this.controls.isMouseDown = false;
    });
    
    // Mouse move event for rotation
    window.addEventListener('mousemove', (event) => {
      if (this.controls.isMouseDown && this.controls.enabled) {
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
      }
    });
    
    // Touch start event for mobile
    this.renderer.domElement.addEventListener('touchstart', (event) => {
      event.preventDefault();
      
      if (event.touches.length === 1) {
        // Single touch - for rotation
        this.controls.isTouching = true;
        this.controls.wasDragging = false;
        const touch = event.touches[0];
        this.controls.lastTouchPosition = {
          x: touch.clientX,
          y: touch.clientY
        };
        this.controls.touchStartPosition = {
          x: touch.clientX,
          y: touch.clientY
        };
      } 
      else if (event.touches.length === 2) {
        // Two touches - for pinch zoom
        this.controls.isTouching = true;
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        
        // Calculate the distance between the two touches
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        this.controls.pinchStartDistance = Math.sqrt(dx * dx + dy * dy);
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
        }
      }
    }, { passive: false });
    
    // Touch end event for mobile
    this.renderer.domElement.addEventListener('touchend', (event) => {
      event.preventDefault();
      this.controls.isTouching = false;
      
      // Keep wasDragging flag until next touchstart
    }, { passive: false });
    
    // Mouse wheel for zoom
    this.renderer.domElement.addEventListener('wheel', (event) => {
      if (!this.controls.enabled) return;
      
      const zoomSpeed = 0.1;
      const direction = event.deltaY > 0 ? 1 : -1;
      
      // Update camera distance
      this.controls.cameraDistance = Math.max(5, Math.min(50, this.controls.cameraDistance * (1 + direction * zoomSpeed)));
      
      // Update camera position
      this.controls.updateCameraPosition(this.camera);
      
      // Prevent default scrolling behavior
      event.preventDefault();
    }, { passive: false });
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
    });
    
    this.socketManager.setRoomJoinedCallback((roomCode, state) => {
      this.currentRoomCode = roomCode;
      this.ui.updateRoomDisplay(roomCode);
      
      // Apply the existing room state to our grid
      Object.entries(state).forEach(([hexId, hexState]) => {
        this.hexGrid.updateHexState(hexId, hexState);
      });
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
    if (!this.currentRoomCode) return;
    
    const selectedHex = this.hexGrid.handleClick(this.mouse, this.camera);
    if (selectedHex) {
      console.log('Hex clicked:', selectedHex);
      
      // In a real app, you might have different action types
      // For now, we'll just change the color and height
      const action = {
        color: this.getRandomColor(),
        height: Math.random() * 3
      };
      
      // Send action to server
      this.socketManager.sendHexAction(
        this.currentRoomCode,
        selectedHex.hexId,
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
    requestAnimationFrame(this.animate.bind(this));
    
    // Update controls
    if (this.controls && typeof this.controls.update === 'function') {
      this.controls.update();
    }
    
    // Update hex hover state
    this.hexGrid.handleMouseMove(this.mouse, this.camera);
    
    // Render
    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
});