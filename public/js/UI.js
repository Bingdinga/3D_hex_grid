/**
 * UI class to handle all UI interactions
 */
class UI {
    constructor() {
      // Room elements
      this.roomCodeDisplay = document.getElementById('room-code-display');
      this.copyRoomCodeBtn = document.getElementById('copy-room-code');
      this.createRoomBtn = document.getElementById('create-room-btn');
      this.roomCodeInput = document.getElementById('room-code-input');
      this.joinRoomBtn = document.getElementById('join-room-btn');
      
      // Chat elements
      this.chatContainer = document.getElementById('chat-container');
      this.toggleChatBtn = document.getElementById('toggle-chat-btn');
      this.chatMessages = document.getElementById('chat-messages');
      this.chatInput = document.getElementById('chat-input');
      this.sendChatBtn = document.getElementById('send-chat-btn');
      
      // State
      this.currentRoomCode = null;
      
      // Initialize event listeners
      this.initEventListeners();
    }
    
    /**
     * Set up all event listeners for UI elements
     */
    initEventListeners() {
      // Room-related listeners
      this.createRoomBtn.addEventListener('click', () => {
        if (this.onCreateRoom) this.onCreateRoom();
      });
      
      this.joinRoomBtn.addEventListener('click', () => {
        const roomCode = this.roomCodeInput.value.trim().toUpperCase();
        if (roomCode && this.onJoinRoom) {
          this.onJoinRoom(roomCode);
        }
      });
      
      this.copyRoomCodeBtn.addEventListener('click', () => {
        if (this.currentRoomCode) {
          navigator.clipboard.writeText(this.currentRoomCode)
            .then(() => {
              // Temporary visual feedback
              const originalText = this.copyRoomCodeBtn.textContent;
              this.copyRoomCodeBtn.textContent = 'Copied!';
              setTimeout(() => {
                this.copyRoomCodeBtn.textContent = originalText;
              }, 2000);
            })
            .catch(err => {
              console.error('Could not copy room code: ', err);
            });
        }
      });
      
      // Chat-related listeners
      this.toggleChatBtn.addEventListener('click', () => {
        this.toggleChat();
      });
      
      this.sendChatBtn.addEventListener('click', () => {
        this.sendChatMessage();
      });
      
      this.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.sendChatMessage();
        }
      });
    }
    
    /**
     * Toggle chat panel expanded/collapsed state
     */
    toggleChat() {
      this.chatContainer.classList.toggle('collapsed');
      this.toggleChatBtn.textContent = this.chatContainer.classList.contains('collapsed') ? '▼' : '▲';
      
      // If expanding, focus the chat input
      if (!this.chatContainer.classList.contains('collapsed')) {
        this.chatInput.focus();
      }
    }
    
    /**
     * Send a chat message
     */
    sendChatMessage() {
      const message = this.chatInput.value.trim();
      if (message && this.currentRoomCode && this.onSendChatMessage) {
        this.onSendChatMessage(this.currentRoomCode, message);
        this.chatInput.value = '';
      }
    }
    
    /**
     * Update the room code display
     * @param {string} roomCode - The room code to display
     */
    updateRoomDisplay(roomCode) {
      this.currentRoomCode = roomCode;
      
      if (roomCode) {
        this.roomCodeDisplay.textContent = `Room: ${roomCode}`;
        this.copyRoomCodeBtn.disabled = false;
        
        // Update UI state to show we're in a room
        this.createRoomBtn.disabled = true;
        this.joinRoomBtn.disabled = true;
        this.roomCodeInput.disabled = true;
      } else {
        this.roomCodeDisplay.textContent = 'Not in a room';
        this.copyRoomCodeBtn.disabled = true;
        
        // Update UI state to show we're not in a room
        this.createRoomBtn.disabled = false;
        this.joinRoomBtn.disabled = false;
        this.roomCodeInput.disabled = false;
      }
    }
    
    /**
     * Display a new chat message
     * @param {string} userId - ID of the user who sent the message
     * @param {string} message - The message content
     * @param {number} timestamp - Message timestamp
     */
    displayChatMessage(userId, message, timestamp) {
      const messageElement = document.createElement('div');
      messageElement.className = 'chat-message';
      
      // Format the timestamp
      const date = new Date(timestamp);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Create message content with user ID and timestamp
      messageElement.innerHTML = `
        <span class="user-id">${this.formatUserId(userId)}</span>
        <span class="timestamp">${timeStr}</span>
        <div class="message-content">${this.escapeHtml(message)}</div>
      `;
      
      // Add to chat and scroll to bottom
      this.chatMessages.appendChild(messageElement);
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
      
      // If chat is collapsed, give visual indication of new message
      if (this.chatContainer.classList.contains('collapsed')) {
        this.toggleChatBtn.textContent = '▼ New';
        
        // Flash the chat header briefly
        this.chatContainer.classList.add('new-message');
        setTimeout(() => {
          this.chatContainer.classList.remove('new-message');
        }, 1000);
      }
    }
    
    /**
     * Format a user ID to a shorter display name
     * @param {string} userId - The full user ID
     * @returns {string} Shortened display name
     */
    formatUserId(userId) {
      // Use the last 5 characters of the ID if it's long
      if (userId.length > 10) {
        return `User-${userId.substring(userId.length - 5)}`;
      }
      return userId;
    }
    
    /**
     * Display an error message
     * @param {string} message - Error message to display
     */
    displayError(message) {
      alert(message);
    }
    
    /**
     * Escape HTML to prevent XSS
     * @param {string} unsafe - Potentially unsafe HTML string
     * @returns {string} Escaped safe string
     */
    escapeHtml(unsafe) {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
    
    /**
     * Set callback for when a user creates a room
     * @param {Function} callback - Function to call
     */
    setCreateRoomCallback(callback) {
      this.onCreateRoom = callback;
    }
    
    /**
     * Set callback for when a user joins a room
     * @param {Function} callback - Function to call with room code
     */
    setJoinRoomCallback(callback) {
      this.onJoinRoom = callback;
    }
    
    /**
     * Set callback for when a user sends a chat message
     * @param {Function} callback - Function to call with room code and message
     */
    setSendChatMessageCallback(callback) {
      this.onSendChatMessage = callback;
    }
  }