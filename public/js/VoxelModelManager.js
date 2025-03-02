import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * VoxelModelManager handles loading, caching, and managing 3D models for the hex grid
 */
class VoxelModelManager {
  constructor(scene) {
    console.log('VoxelModelManager constructor called');
    this.scene = scene;
    this.models = {};     // Active model instances by hexId
    this.modelCache = {}; // Cache for loaded models

    // Create a GLTFLoader instance
    this.gltfLoader = new GLTFLoader();

    // Create a simple fallback geometry
    this.fallbackGeometry = new THREE.BoxGeometry(1, 1, 1);

    this.animatedModels = {}; // Track models that should be animated
    this.clock = new THREE.Clock(); // For timing animations
  }

  /**
   * Load a model from file
   * @param {string} modelPath - Path to the model file
   * @returns {Promise} Promise that resolves with the loaded model
   */
  loadModel(modelPath) {
    // Check if model is already in cache
    if (this.modelCache[modelPath]) {
      return Promise.resolve(this.modelCache[modelPath].clone());
    }

    // Load the model
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        modelPath,
        (gltf) => {
          console.log(`Model ${modelPath} loaded successfully`);

          // Store in cache for future use
          this.modelCache[modelPath] = gltf.scene.clone();

          // Resolve with a clone of the loaded model
          resolve(gltf.scene.clone());
        },
        (progress) => {
          console.log(`Loading ${modelPath}: ${(progress.loaded / progress.total * 100).toFixed(2)}%`);
        },
        (error) => {
          console.error(`Error loading model ${modelPath}:`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Place a model at a position
   * @param {string} hexId - ID of the hex
   * @param {THREE.Vector3} position - Position to place the model
   * @param {Object} options - Options for the model
   */
  async placeModelAt(hexId, position, options = {}) {
    console.log(`Placing model at hex ${hexId}`, position, options);

    // Remove any existing model on this hex
    this.removeModel(hexId);

    let model;

    try {
      if (options.modelPath) {
        // Try to load the specified model
        model = await this.loadModel(options.modelPath);

        // First, normalize the model size by getting its bounding box
        const bbox = new THREE.Box3().setFromObject(model);
        const size = bbox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        // Normalize to a base size of 1 unit, then apply the requested scale
        const normalizedScale = 1 / maxDim;
        const scale = options.scale || 0.5;
        model.scale.set(
          normalizedScale * scale,
          normalizedScale * scale,
          normalizedScale * scale
        );
      } else {
        // Use fallback if no model path is specified
        console.log('Using fallback model (no model path specified)');
        const material = new THREE.MeshStandardMaterial({
          color: Math.random() * 0xffffff
        });
        model = new THREE.Mesh(this.fallbackGeometry, material);

        // Apply scale directly for fallback cube
        const scale = options.scale || 0.5;
        model.scale.set(scale, scale, scale);
      }

      // Apply position
      model.position.copy(position);

      // Apply scale
      const scale = options.scale || 0.5;
      model.scale.set(scale, scale, scale);

      // Apply rotation if specified
      if (options.rotation) {
        model.rotation.x = options.rotation.x || 0;
        model.rotation.y = options.rotation.y || 0;
        model.rotation.z = options.rotation.z || 0;
      }

      // Store animation parameters if animation is enabled
      if (options.animate) {
        this.animatedModels[hexId] = {
          model: model,
          initialY: position.y,
          hoverRange: options.hoverRange || 0.2,
          hoverSpeed: options.hoverSpeed || 1.0,
          rotateSpeed: options.rotateSpeed || 0.5
        };
      }

      // Add to scene
      this.scene.add(model);

      // Store reference
      this.models[hexId] = model;

      return model;
    } catch (error) {
      console.error('Error placing model:', error);

      //   // Use fallback on error
      //   return this.placeFallbackModel(hexId, position, options);
    }
  }

  // In VoxelModelManager.js - Add this new method
  updateModelHeight(hexId, position, hexHeight) {
    const model = this.models[hexId];
    if (!model) return;

    // Update the position
    model.position.copy(position);

    // Update animation data if this model is animated
    if (this.animatedModels[hexId]) {
      this.animatedModels[hexId].initialY = position.y;
      this.animatedModels[hexId].hexHeight = hexHeight;
    }
  }

  /**
   * Place a fallback cube model as a backup
   * @param {string} hexId - ID of the hex
   * @param {THREE.Vector3} position - Position to place the model
   * @param {Object} options - Options for the model
   */
  placeFallbackModel(hexId, position, options = {}) {
    const scale = options.scale || 0.5;
    const material = new THREE.MeshStandardMaterial({
      color: Math.random() * 0xffffff
    });

    const mesh = new THREE.Mesh(this.fallbackGeometry, material);

    // Apply position
    mesh.position.copy(position);

    // Apply scale
    mesh.scale.set(scale, scale, scale);

    // Apply rotation if specified
    if (options.rotation) {
      mesh.rotation.x = options.rotation.x || 0;
      mesh.rotation.y = options.rotation.y || 0;
      mesh.rotation.z = options.rotation.z || 0;
    }

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

  // In VoxelModelManager.js - Update the updateAnimations method
  updateAnimations() {
    const deltaTime = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // Update each animated model
    Object.keys(this.animatedModels).forEach(hexId => {
      const animData = this.animatedModels[hexId];
      const model = animData.model;

      if (model) {
        // Bobbing up and down animation
        if (animData.hoverRange > 0) {
          model.position.y = animData.initialY +
            Math.sin(time * animData.hoverSpeed) * animData.hoverRange;
        }

        // Rotation animation around Y axis
        if (animData.rotateSpeed > 0) {
          model.rotation.y += deltaTime * animData.rotateSpeed;
        }
      }
    });
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

export { VoxelModelManager };