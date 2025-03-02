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
    // New flag to track if this is the first time loading this model
    const isFirstLoad = !this.modelCache[modelPath];

    // Check if model is already in cache
    if (this.modelCache[modelPath]) {
      // Clone and return immediately for cached models
      return Promise.resolve({
        model: this.modelCache[modelPath].clone(),
        isFirstLoad: false
      });
    }

    /// Load the model
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        modelPath,
        (gltf) => {
          console.log(`Model ${modelPath} loaded successfully${isFirstLoad ? ' (FIRST TIME)' : ''}`);

          // Store in cache
          this.modelCache[modelPath] = gltf.scene;

          // Resolve with clone and first-load flag
          resolve({
            model: gltf.scene.clone(),
            isFirstLoad: isFirstLoad
          });
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


  // Add this method to VoxelModelManager.js
  ensureModelReadyForAnimation(model, hexId, options) {
    console.log(`Ensuring model for hex ${hexId} is ready for animation`);

    // Make sure model has proper traversal state
    if (model.traverse) {
      model.traverse(child => {
        if (child.isMesh) {
          child.matrixAutoUpdate = true;
        }
      });
    }

    // Force an initial position update
    model.position.y = options.initialY + 0.0001; // Tiny offset to force update
    model.updateMatrixWorld(true);

    // If this is the first time this model type is used, make a note
    const modelType = options.modelPath || 'fallback';
    if (!this._initializedModelTypes) this._initializedModelTypes = {};

    if (!this._initializedModelTypes[modelType]) {
      console.log(`First time seeing model type: ${modelType}`);
      this._initializedModelTypes[modelType] = true;

      // Force a matrix update on the entire scene
      this.scene.updateMatrixWorld(true);
    }
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
        // Get model and first-load flag
        const { model: loadedModel, isFirstLoad } = await this.loadModel(options.modelPath);
        model = loadedModel;

        // If this is the first time loading this model, add special handling
        if (isFirstLoad) {
          console.log(`First time loading model ${options.modelPath}, extra setup`);
          // Wait a frame for the model to initialize
          await new Promise(resolve => setTimeout(resolve, 16));
        }


        // First, normalize the model size by getting its bounding box
        const bbox = new THREE.Box3().setFromObject(model);
        const size = bbox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        // Normalize to a base size of 1 unit, then apply the requested scale
        const normalizedScale = 1 / maxDim;
        const scale = options.scale || 1.5;
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
        const scale = options.scale || 1.5;
        model.scale.set(scale, scale, scale);
      }

      // Add a unique identifier to the model to help with debugging
      model.userData.hexId = hexId;
      model.userData.instanceId = Date.now() + Math.random().toString(36).substring(2, 9);

      // Apply position
      model.position.copy(position);

      // Apply rotation if specified
      if (options.rotation) {
        model.rotation.x = options.rotation.x || 0;
        model.rotation.y = options.rotation.y || 0;
        model.rotation.z = options.rotation.z || 0;
      }



      // Add to scene
      this.scene.add(model);

      this.ensureModelReadyForAnimation(model, hexId, {
        initialY: position.y,
        ...options
      });

      // If this is the first animated model, reset the clock
      if (options.animate && Object.keys(this.animatedModels).length === 0) {
        console.log("First animated model, resetting animation clock");
        this.resetClock();
      }

      // Store reference
      this.models[hexId] = model;

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

      console.log(`Model placed at hex ${hexId}, instanceId: ${model.userData.instanceId}`);

      return model;
    } catch (error) {
      console.error('Error placing model:', error);
      return this.placeFallbackModel(hexId, position, options);
    }
    this.logModelInfo();
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
    const scale = options.scale || 1.5;
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

  updateAnimations() {
    const deltaTime = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // Track if this is the first animation update for any model
    let hasNewAnimations = false;

    // Update each animated model
    Object.keys(this.animatedModels).forEach(hexId => {
      const animData = this.animatedModels[hexId];
      if (!animData || !animData.model) return;

      // Check if this model has been animated before
      if (!animData.hasAnimated) {
        hasNewAnimations = true;
        animData.hasAnimated = true;
        console.log(`First animation update for model on hex ${hexId}`);

        // Force initial position to match expected position
        // This ensures it's not stuck in its starting position
        animData.model.position.y = animData.initialY;
        animData.model.updateMatrixWorld(true);
      }

      // Apply animations
      if (animData.hoverRange > 0) {
        animData.model.position.y = animData.initialY +
          Math.sin(time * animData.hoverSpeed) * animData.hoverRange;
      }

      if (animData.rotateSpeed > 0) {
        animData.model.rotation.y += deltaTime * animData.rotateSpeed;
      }
    });

    // If we just started animating new models, force a scene update
    if (hasNewAnimations) {
      this.scene.updateMatrixWorld(true);
    }
  }

  /**
   * Remove a model from a hex
   * @param {string} hexId - ID of the hex
   */
  removeModel(hexId) {
    if (this.models[hexId]) {
      // Remove from scene
      this.scene.remove(this.models[hexId]);

      // Clean up animation data as well
      delete this.animatedModels[hexId];

      // Remove reference to model
      delete this.models[hexId];

      console.log(`Model removed from hex ${hexId}`);
    }
  }

  resetClock() {
    this.clock = new THREE.Clock();
  }

  // Add this method to VoxelModelManager.js
  logModelInfo() {
    console.log('-------- Voxel Model Manager Status --------');
    console.log(`Active models: ${Object.keys(this.models).length}`);
    console.log(`Animated models: ${Object.keys(this.animatedModels).length}`);
    console.log(`Model cache entries: ${Object.keys(this.modelCache).length}`);

    // List all active models
    console.log('Active model placements:');
    Object.entries(this.models).forEach(([hexId, model]) => {
      console.log(`  Hex ${hexId}: ${model.userData.instanceId || 'unknown'}`);
    });
  }

}

export { VoxelModelManager };