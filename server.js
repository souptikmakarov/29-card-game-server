const config = require('config');
var NewGameRoom = require('./game-server');
var PlayerRepo = require('./player-repo');
const express = require('express');
const path = require('path');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var bodyParser = require('body-parser');
var monk = require('monk');

var port = process.env.PORT || config.get('appPort');
var mongoURL = config.get('db_conn_url');
const db = monk(mongoURL);

let player_repo = new PlayerRepo(db);
let game_rooms = new NewGameRoom(db, player_repo);

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
}

server.listen(port, () => console.log("Starting Server. Listening on Port", port));

app.use(bodyParser.json());
app.use(function(req, res, next){
    req.player_repo = player_repo;
    next();
});
app.use(allowCrossDomain);

// Serve only the static files form the dist directory
app.use(express.static(__dirname + '/game-client'));

app.get('/', function(req,res) {
    res.sendFile(path.join(__dirname+'/game-client/index.html'));
});

app.post('/register', async (req, res)=>{
    let pName = req.body["name"];
    let pPass = req.body["password"];
    req.player_repo.registerPlayer(pName, pPass, resp => {
        res.json(resp);
    });
});

app.post('/login', async (req, res)=>{
    let pName = req.body["name"];
    let pPass = req.body["password"];
    req.player_repo.loginPlayer(pName, pPass, resp => {
        res.json(resp);
    });
});

app.post('/getPlayerName', async (req, res)=>{
    let pId = req.body["playerId"];
    req.player_repo.getPlayerData(pId, resp => {
        res.json(resp);
    });
});

app.get('/getActiveRooms', async (req, res) => {
    game_rooms.findActiveRooms(data => {
        if (!data.err){
            res.json({ "rooms_available": data.activeRooms });
        }
        else{
            res.json({ "rooms_available": null });
        }
    });
});

io.on('connection', socket => {
    console.log('a user connected');

    socket.on("player_reconnect", data => {
        console.log("user reconnected " + data.playerId);
        game_rooms.updateActivePlayerAndJoinRoom(data.playerId, socket.id, data.roomId, canJoinRoom => {
            if (canJoinRoom)
                socket.join(data.roomId, () => {
                    console.log(`${socket.id} joined room ${data.roomId}`);
                });
        });
    });

    socket.on('disconnect', function(reason){
        console.log('user disconnected ' + reason);
        game_rooms.markPlayerDisconnected(socket.id);
        // game_rooms.removePlayerFromRoom(socket.id, data => {
        //     if(!data.err){
        //         io.to(data.roomId).emit("players_in_room", data.playerList);
        //     }
        // });
    });

    socket.on("create_room", data => {
        game_rooms.updateActivePlayer(data.playerId, socket.id);
        game_rooms.createNewRoom(data.roomName, data.playerId, roomId => {
            socket.join(roomId, () => {
                console.log(`${socket.id} created room ${data.roomName} with id ${roomId}`);
                socket.emit("players_in_room", [socket.id]);
                io.emit("room_created", {
                    roomName: data.roomName,
                    roomId: roomId
                });
            });
        });
    });

    socket.on("join_room", data => {
        game_rooms.updateActivePlayer(data.playerId, socket.id);
        game_rooms.joinExistingRoomAndReturnPlayerList(data.roomId, data.playerId, result => {
            if (result.err){
                socket.emit("join_room_failed", result.err);
            }
            else{
                socket.join(data.roomId, () => {
                    console.log(`${socket.id} joined room ${data.roomId}`);
                    io.to(data.roomId).emit("players_in_room", result.playerList);
                    
                    if (result.canGameStart){
                        console.log("Game can start");
                        setTimeout(() => startGameAndInformPlayers(data.roomId), 1000);
                    }
                });
            }
        });
    });

    function startGameAndInformPlayers(roomId){
        io.to(roomId).emit("game_start");
        setTimeout(() => dealCardsAndStartBidding(roomId), 1000);
    }

    function dealCardsAndStartBidding(roomId){
        game_rooms.startNewGameSession(roomId, res => {
            for(var playerId of Object.keys(res.playerCards)){
                io.to(roomId).emit("player_card", {
                    forPlayer: playerId,
                    cards: res.playerCards[playerId]["firstHand"]
                });
            }
            io.to(roomId).emit("bidding_raise", {
                forPlayer: res.stander,    //res.raiser also works
                raiseTo: res.raiseTo
            });
        });
    }

    socket.on("player_bid", data => {
        // Inform all of current bid
        io.to(data.roomId).emit("bidding_update", {
            bidder: game_rooms.getPlayerIdForSocketId(socket.id),
            bid: data.bid
        });

        // Inform all of next bidder and expected bid
        game_rooms.playerMadeBid(data.bid, socket.id, data.roomId, res => {
            if (res.biddingComplete){
                if (res.gameCancelled){

                }
                else    
                    io.to(data.roomId).emit("bidding_complete", {
                        bidding_player: res.bidding_player,
                        finalBid: res.finalBid
                    });
            }
            else{
                io.to(data.roomId).emit("bidding_raise", {
                    forPlayer: res.forPlayer,
                    raiseTo: res.raiseTo
                });
            }
        });
    });
});