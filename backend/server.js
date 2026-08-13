const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST"]
  }
});

// Game state storage
const rooms = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', (data) => {
    const { roomCode, player } = data;
    socket.join(roomCode);
    
    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        code: roomCode,
        host_id: player.id,
        status: 'lobby',
        game_mode: null,
        players: [],
        game_state: {}
      };
    }
    
    // Add or update player
    const existingPlayerIdx = rooms[roomCode].players.findIndex(p => p.id === player.id);
    if (existingPlayerIdx >= 0) {
      rooms[roomCode].players[existingPlayerIdx] = { ...rooms[roomCode].players[existingPlayerIdx], ...player, socket_id: socket.id };
    } else {
      rooms[roomCode].players.push({ ...player, socket_id: socket.id });
    }

    io.to(roomCode).emit('room_update', rooms[roomCode]);
  });

  socket.on('leave_room', (data) => {
    const { roomCode, playerId } = data;
    socket.leave(roomCode);
    if (rooms[roomCode]) {
      rooms[roomCode].players = rooms[roomCode].players.filter(p => p.id !== playerId);
      io.to(roomCode).emit('room_update', rooms[roomCode]);
    }
  });

  socket.on('update_room_state', (data) => {
    const { roomCode, updates } = data;
    if (rooms[roomCode]) {
      rooms[roomCode] = { ...rooms[roomCode], ...updates };
      io.to(roomCode).emit('room_update', rooms[roomCode]);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Logic to handle player disconnect and potential host migration
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      const playerIdx = room.players.findIndex(p => p.socket_id === socket.id);
      if (playerIdx >= 0) {
        room.players[playerIdx].connected = false;
        io.to(roomCode).emit('room_update', room);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
