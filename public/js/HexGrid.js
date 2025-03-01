/**
 * HexGrid class handles creating and managing a hexagonal grid in Three.js
 */
class HexGrid {
    constructor(scene, hexSize = 1, radius = 10) {
      this.scene = scene;
      this.hexUtils = new HexUtils(hexSize);
      this.radius = radius;
      this.hexMeshes = {}; // Maps hex IDs to their meshes
      this.selectedHex = null;
      this.hoverHex = null;
      
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
      
      // Create raycaster for hex selection
      this.raycaster = new THREE.Raycaster();
      
      // Initialize
      this.createGrid();
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
        mesh.userData = { q, r, hexId };
        
        // Add to scene and store reference
        this.scene.add(mesh);
        this.hexMeshes[hexId] = mesh;
      });
    }
    
    /**
     * Handle mouse movement for hex highlighting
     * @param {THREE.Vector2} mousePosition - Normalized mouse position
     * @param {THREE.Camera} camera - Current camera
     */
    handleMouseMove(mousePosition, camera) {
      this.raycaster.setFromCamera(mousePosition, camera);
      
      // Find intersections
      const intersects = this.raycaster.intersectObjects(Object.values(this.hexMeshes));
      
      // Clear previous hover
      if (this.hoverHex && this.hoverHex !== this.selectedHex) {
        this.hoverHex.material = this.defaultMaterial;
      }
      
      // Set new hover
      if (intersects.length > 0) {
        const hex = intersects[0].object;
        
        if (hex !== this.selectedHex) {
          hex.material = this.hoverMaterial;
          this.hoverHex = hex;
        }
        
        return hex;
      }
      
      this.hoverHex = null;
      return null;
    }
    
    /**
     * Handle mouse click for hex selection
     * @param {THREE.Vector2} mousePosition - Normalized mouse position
     * @param {THREE.Camera} camera - Current camera
     * @returns {Object|null} Selected hex data or null if no hex was clicked
     */
    handleClick(mousePosition, camera) {
      this.raycaster.setFromCamera(mousePosition, camera);
      
      // Find intersections
      const intersects = this.raycaster.intersectObjects(Object.values(this.hexMeshes));
      
      // Clear previous selection
      if (this.selectedHex) {
        this.selectedHex.material = this.defaultMaterial;
      }
      
      // Set new selection
      if (intersects.length > 0) {
        const hex = intersects[0].object;
        hex.material = this.selectedMaterial;
        this.selectedHex = hex;
        
        return {
          hexId: hex.userData.hexId,
          q: hex.userData.q,
          r: hex.userData.r
        };
      }
      
      this.selectedHex = null;
      return null;
    }
    
    /**
     * Update a hex's appearance based on its state
     * @param {string} hexId - Hex ID
     * @param {Object} state - New state data
     */
    updateHexState(hexId, state) {
      const hex = this.hexMeshes[hexId];
      if (!hex) return;
      
      // Example of state updates
      if (state.color) {
        hex.material.color.set(state.color);
      }
      
      if (state.height !== undefined) {
        // Extrude the hex to create a 3D column
        this.extrudeHex(hex, state.height);
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
      
      const extrudeSettings = {
        steps: 1,
        depth: height,
        bevelEnabled: false
      };
      
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geometry.rotateX(-Math.PI / 2);
      
      // Create new mesh
      const newMesh = new THREE.Mesh(geometry, hexMesh.material.clone());
      newMesh.userData = { q, r, hexId };
      
      // Add to scene and update reference
      this.scene.add(newMesh);
      this.hexMeshes[hexId] = newMesh;
      
      // Update selection/hover if needed
      if (hexMesh === this.selectedHex) {
        this.selectedHex = newMesh;
      }
      if (hexMesh === this.hoverHex) {
        this.hoverHex = newMesh;
      }
    }
  }