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

    this.pendingModelRequests = {}; // Add this line to track pending requests
  }

  /**
   * Load a model from file
   * @param {string} modelPath - Path to the model file
   * @returns {Promise} Promise that resolves with the loaded model
   */
  loadModel(modelPath) {
    // Check if model is already in cache
    if (this.modelCache[modelPath]) {
      // Clone and return immediately for cached models
      return Promise.resolve({
        model: this.modelCache[modelPath].clone(),
        isFirstLoad: false
      });
    }

    // Load the model
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        modelPath,
        (gltf) => {
          console.log(`Model ${modelPath} loaded successfully (first time)`);

          // Important: Don't add to scene yet, just cache the original
          this.modelCache[modelPath] = gltf.scene;

          // Resolve with clone and first-load flag
          resolve({
            model: gltf.scene.clone(),
            isFirstLoad: true
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

    // Check if there's already a pending request for this hex
    const requestKey = `${hexId}_${options.modelPath || 'fallback'}`;
    if (this.pendingModelRequests[requestKey]) {
      console.log(`Skipping duplicate model request for hex ${hexId}`);
      return this.pendingModelRequests[requestKey];
    }

    // Remove any existing model on this hex
    this.removeModel(hexId);

    let model;

    // Create a promise for this request
    const requestPromise = (async () => {
      let model;

      try {
        if (options.modelPath) {
          // Get model and first-load flag
          const { model: loadedModel, isFirstLoad } = await this.loadModel(options.modelPath);
          model = loadedModel;

          // Center the model origin point (add this line)
          model = this.centerModelOrigin(loadedModel);

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

          // Apply position BEFORE adding to scene
          model.position.copy(position);

          // Apply rotation if specified
          if (options.rotation) {
            model.rotation.x = options.rotation.x || 0;
            model.rotation.y = options.rotation.y || 0;
            model.rotation.z = options.rotation.z || 0;
          }

          // Add unique identifier
          model.userData.hexId = hexId;
          model.userData.instanceId = Date.now() + Math.random().toString(36).substring(2, 9);

          // Now add to scene after all transforms are applied
          this.scene.add(model);

          // Force matrix update
          model.updateMatrix();
          model.updateMatrixWorld(true);
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
      } finally {
        // Remove from pending requests when done
        delete this.pendingModelRequests[requestKey];
      }
      this.logModelInfo();
    })();

    // Store the promise in pending requests
    this.pendingModelRequests[requestKey] = requestPromise;
    return requestPromise;
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

    // Update each animated model
    Object.keys(this.animatedModels).forEach(hexId => {
      const animData = this.animatedModels[hexId];
      if (!animData || !animData.model) return;

      // Check if this is the first animation update
      if (!animData.initialized) {
        // Force model to its initial position before starting animations
        animData.model.position.y = animData.initialY;
        animData.model.updateMatrixWorld(true);
        animData.initialized = true;
      }

      // Apply animations
      if (animData.hoverRange > 0) {
        animData.model.position.y = animData.initialY +
          Math.sin(time * animData.hoverSpeed) * animData.hoverRange;
      }

      if (animData.rotateSpeed > 0) {
        animData.model.rotation.y += deltaTime * animData.rotateSpeed;
      }

      // Ensure matrix is updated after changes
      animData.model.updateMatrix();
    });
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

  /**
 * Centers a model's origin point to its geometric center
 * @param {THREE.Object3D} model - The model to center
 * @returns {THREE.Object3D} The centered model
 */
  centerModelOrigin(model) {
    // Calculate the bounding box of the model
    const bbox = new THREE.Box3().setFromObject(model);

    // Calculate the center of the bounding box
    const center = bbox.getCenter(new THREE.Vector3());

    // Create a parent container
    const container = new THREE.Object3D();

    // Add model to container
    container.add(model);

    // Offset the model within the container to center its origin
    model.position.sub(center);

    // Store the original center for reference if needed
    container.userData.originalCenter = center.clone();

    return container;
  }

  resetClock() {
    this.clock = new THREE.Clock();
  }

  ensureModelInitialized(model) {
    // Make sure all child objects have matrix auto updates enabled
    model.traverse(child => {
      if (child.isMesh) {
        child.matrixAutoUpdate = true;
      }
    });

    // Force a matrix update on the model
    model.updateMatrix();
    model.updateMatrixWorld(true);
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