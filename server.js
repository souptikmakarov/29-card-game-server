const config = require('config');
const mongoose = require('mongoose');   // Module to connect to MongoDB
const room_provider = require('./room-provider');

// module.exports = function () {

//     const dbConnUrl = config.get('db_conn_url');

//     // Connect to the database. In case of any error, log the error and exit as this is a Fatal error.
//     mongoose.connect(dbConnUrl)
//         .then(() => logger.info('Successfully connected to the Database.'))
//         .catch(error => {
//             logger.info('FATAL ERROR: Connection to Database Failed.');
//             throw new Error(error);
//         });
// };
var express = require('express');
var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var port = config.get('appPort');
var rooms = new room_provider();

server.listen(port, () => console.log("Starting Server. Listening on Port", port));

app.get('/', async function(req, res){
    res.sendFile(__dirname + '/index.html');
});

app.get('/socket.io/socket.io.js', async function(req, res){
    res.sendFile(__dirname + '/node_modules/socket.io-client/dist/socket.io.js');
});

io.on('connection', socket => {
    console.log('a user connected');
    socket.on('disconnect', function(){
      console.log('user disconnected');
    });
    io.emit("Hello", "Sockets");

    socket.on("changeMessageForAll", msg => {
        console.log("Message changed to: ", msg);
        io.emit("Hello", msg);
    });

    socket.on("changeMessageForRoom", msg => {
        playerRoom = rooms.getRoomName(socket.id);
        console.log(`Message for room ${playerRoom} changed to ${msg}`);
        io.to(playerRoom).emit("Hello", msg);
    });

    socket.on("createRoom", roomName => {
        socket.join(roomName, () => {
            console.log(`${socket.id} created room ${roomName}`);
            rooms.addRoom(socket.id, roomName);
            socket.emit("players_in_room", [socket.id]);
            io.emit("room_created", roomName);
        });
    });

    socket.on("joinRoom", roomName => {
        socket.join(roomName, () => {
            console.log(`${socket.id} joined room ${roomName}`);
            rooms.joinRoom(socket.id, roomName);
            player_list = rooms.getPlayersInRoom(roomName);
            io.to(roomName).emit("players_in_room", player_list);
        });
    });
});