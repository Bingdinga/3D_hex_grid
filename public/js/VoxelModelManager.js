/**
 * VoxelModelManager handles loading, caching, and managing 3D models for the hex grid
 */
class VoxelModelManager {
  constructor(scene) {
    console.log('VoxelModelManager constructor called');
    this.scene = scene;
    this.models = {};     // Active model instances by hexId
    
    // Create a simple fallback geometry
    this.fallbackGeometry = new THREE.BoxGeometry(1, 1, 1);
  }
  
  /**
   * Place a model at a position
   * @param {string} hexId - ID of the hex
   * @param {THREE.Vector3} position - Position to place the model
   * @param {Object} options - Options for the model
   */
  placeModelAt(hexId, position, options = {}) {
    console.log(`Placing model at hex ${hexId}`, position);
    const scale = options.scale || 0.5;
    
    // Remove any existing model on this hex
    this.removeModel(hexId);
    
    // Create a simple cube as a fallback
    const material = new THREE.MeshStandardMaterial({
      color: Math.random() * 0xffffff
    });
    
    const mesh = new THREE.Mesh(this.fallbackGeometry, material);
    
    // Apply position
    mesh.position.copy(position);
    
    // Apply scale
    mesh.scale.set(scale, scale, scale);
    
    // Add to scene
    this.scene.add(mesh);
    
    // Store reference
    this.models[hexId] = mesh;
    
    return mesh;
  }
  
  /**
   * Update a model's position
   * @param {string} hexId - ID of the hex
   * @param {THREE.Vector3} position - New position
   */
  updateModelPosition(hexId, position) {
    const model = this.models[hexId];
    if (model) {
      model.position.copy(position);
    }
  }
  
  /**
   * Remove a model from a hex
   * @param {string} hexId - ID of the hex
   */
  removeModel(hexId) {
    if (this.models[hexId]) {
      this.scene.remove(this.models[hexId]);
      delete this.models[hexId];
    }
  }
}