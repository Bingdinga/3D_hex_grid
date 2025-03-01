# 3D Hexagonal Grid Space

An interactive 3D hexagonal grid application with multi-user capabilities, designed to run on a Raspberry Pi 5.

## Features

- Interactive 3D hexagonal grid using Three.js
- Real-time multi-user interaction via Socket.io
- Room-based sessions with shareable codes
- In-room chat functionality
- Lightweight custom UI components

## System Requirements

- Raspberry Pi 5 (recommended) or 4
- Node.js v14+ and npm
- Modern web browser with WebGL support

## Installation

1. Clone this repository to your Raspberry Pi:

```bash
git clone https://github.com/yourusername/3d-hex-grid.git
cd 3d-hex-grid
```

2. Install server dependencies:

```bash
cd server
npm install
```

## Running the Application

1. Start the server:

```bash
cd server
npm start
```

2. Access the application by navigating to your Raspberry Pi's IP address with port 3000 in a web browser:

```
http://raspberry-pi-ip:3000
```

For local development on the Pi itself, you can use:

```
http://localhost:3000
```

## Usage Instructions

### Creating a Room

1. Click the "Create Room" button
2. A unique room code will be generated
3. Share this code with others who want to join

### Joining a Room

1. Enter the room code in the input field
2. Click "Join"
3. You will be connected to the shared space

### Interacting with the Grid

- Click on any hexagon to trigger an action
- Actions are synchronized across all connected users
- The hexagon's color and height will change when clicked

### Using the Chat

- Click the chat panel to expand it
- Type messages and press Enter or click Send
- Messages will be visible to all users in the room

## Development

### Project Structure

```
project/
├── public/
│   ├── index.html       # Main HTML file
│   ├── styles.css       # CSS styles
│   ├── js/
│   │   ├── main.js      # Entry point
│   │   ├── HexGrid.js   # Hexagonal grid implementation
│   │   ├── HexUtils.js  # Utility functions for hex calculations
│   │   ├── UI.js        # Custom UI components
│   │   └── Socket.js    # Socket.io client implementation
├── server/
│   ├── server.js        # Main server file
│   ├── RoomManager.js   # Handles room creation and management
│   └── package.json     # Node.js dependencies
└── README.md            # This file
```

### Extending the Application

- Modify `HexGrid.js` to change the appearance or behavior of the hexagonal grid
- Add new event types in `Socket.js` and `server.js` to support additional interactions
- Extend `UI.js` to add more interface components

## Running as a Service

To have the application start automatically when your Raspberry Pi boots:

1. Create a systemd service file:

```bash
sudo nano /etc/systemd/system/hexgrid.service
```

2. Add the following content (adjust paths as needed):

```
[Unit]
Description=3D Hex Grid Application
After=network.target

[Service]
ExecStart=/usr/bin/node /home/pi/3d-hex-grid/server/server.js
WorkingDirectory=/home/pi/3d-hex-grid/server
StandardOutput=inherit
StandardError=inherit
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

3. Enable and start the service:

```bash
sudo systemctl enable hexgrid.service
sudo systemctl start hexgrid.service
```

## Troubleshooting

- If the server won't start, check that the required ports (default: 3000) are not in use
- For performance issues on older Raspberry Pi models, reduce the grid radius in HexGrid.js
- Check server logs with `systemctl status hexgrid.service` if running as a service