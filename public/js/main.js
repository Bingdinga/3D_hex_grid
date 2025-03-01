/**
 * Main entry point for the 3D Hex Grid application
 */
class App {
    constructor() {
      // Initialize Three.js
      this.initThree();
      
      // Initialize components
      this.ui = new UI();
      this.socketManager = new SocketManager();
      
      // Initialize hex grid
      this.hexGrid = new HexGrid(this.scene, 1, 10);
      
      // Connect components
      this.connectComponents();
      
      // Start render loop
      this.animate();
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
      
      // Add OrbitControls
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.25;
      this.controls.screenSpacePanning = false;
      this.controls.maxPolarAngle = Math.PI / 2;
      
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
      
      // Set up click handling
      window.addEventListener('click', (event) => {
        // Make sure the click is not on a UI element
        if (event.target.closest('#ui-overlay')) return;
        
        this.handleHexClick();
      });
      
      // Handle window resize
      window.addEventListener('resize', () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
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
      this.controls.update();
      
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