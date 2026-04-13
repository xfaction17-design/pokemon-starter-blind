const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

const rooms = {};

console.log(`Serveur WebSocket démarré sur le port ${PORT}`);

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    let data;
    try { data = JSON.parse(message); } catch { return; }

    if (data.type === 'create_room') {
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      rooms[roomCode] = { players: [ws], choices: {}, names: {} };
      ws.roomCode = roomCode;
      ws.playerId = 'player1';
      rooms[roomCode].names['player1'] = data.name || 'Joueur 1';
      ws.send(JSON.stringify({ type: 'room_created', roomCode }));
    }

    else if (data.type === 'join_room') {
      const room = rooms[data.roomCode];
      if (!room) return ws.send(JSON.stringify({ type: 'error', message: 'Salle introuvable' }));
      if (room.players.length >= 2) return ws.send(JSON.stringify({ type: 'error', message: 'Salle pleine' }));
      room.players.push(ws);
      ws.roomCode = data.roomCode;
      ws.playerId = 'player2';
      room.names['player2'] = data.name || 'Joueur 2';
      ws.send(JSON.stringify({ type: 'room_joined', roomCode: data.roomCode }));
      room.players[0].send(JSON.stringify({ type: 'opponent_joined', opponentName: room.names['player2'] }));
      ws.send(JSON.stringify({ type: 'opponent_joined', opponentName: room.names['player1'] }));
    }

    else if (data.type === 'choose_type') {
      const room = rooms[ws.roomCode];
      if (!room) return;
      room.choices[ws.playerId] = data.pokemonType;
      if (Object.keys(room.choices).length === 2) {
        room.players.forEach(p => {
          p.send(JSON.stringify({
            type: 'reveal',
            choices: room.choices,
            names: room.names
          }));
        });
      } else {
        const opponent = room.players.find(p => p !== ws);
        if (opponent) opponent.send(JSON.stringify({ type: 'opponent_chose' }));
        ws.send(JSON.stringify({ type: 'waiting_opponent' }));
      }
    }

    else if (data.type === 'play_again') {
      const room = rooms[ws.roomCode];
      if (!room) return;
      room.choices = {};
      room.players.forEach(p => p.send(JSON.stringify({ type: 'new_round' })));
    }
  });

  ws.on('close', () => {
    const room = rooms[ws.roomCode];
    if (!room) return;
    room.players = room.players.filter(p => p !== ws);
    if (room.players.length === 0) {
      delete rooms[ws.roomCode];
    } else {
      room.players[0].send(JSON.stringify({ type: 'opponent_left' }));
    }
  });
});
