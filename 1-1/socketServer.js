const { Server } = require('socket.io');

function createSocketServer(server) {
    const io = new Server(server, {path:'/webRTC_V0'});
    io.on('connection', socket => {
        console.log('Socket Client connected');
        webRTCHandler(socket);
        socket.on('disconnect', () => console.log('Client disconnected'));
    });
}

function webRTCHandler(socket) {
    socket.on('webrtc:signaling', (signalMessage) => {
        socket.broadcast.emit('webrtc:signaling', signalMessage);
    });
}

exports.createSocketServer = createSocketServer;