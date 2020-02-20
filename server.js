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
var host = process.env.HOST || "0.0.0.0"
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


server.listen(port, host, () => console.log(`Server Up. Listening on ${host}:${port}`));

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

app.post('/getPlayersInRoom', async (req, res) => {
    game_rooms.getPlayersInRoom(req.body["roomId"], playersInRoom => {
        res.json({ "playersInRoom": playersInRoom });
    });
});

io.on('connection', socket => {
    console.log('a user connected');

    socket.on("player_reconnect", data => {
        console.log("user reconnected " + data.playerId);
        game_rooms.updateActivePlayerAndJoinRoom(data.playerId, socket.id, data.roomId, canJoinRoom => {
            if (canJoinRoom)
                socket.join(data.roomId, () => {
                    console.log(`${data.playerId} joined room ${data.roomId}`);
                });
            else
                socket.emit("room_invalid", null);
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
                console.log(`${data.playerId} created room ${data.roomName} with id ${roomId}`);
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
                    console.log(`${data.playerId} joined room ${data.roomId}`);
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
                    // TODO:: Write logic to restart game and ask player for bid
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

    socket.on("set_trump", data => {
        game_rooms.playerSetTrump(data.roomId, data.trump, res => {
            for(var playerId of Object.keys(res.playerCards)){
                io.to(data.roomId).emit("player_card", {
                    forPlayer: playerId,
                    cards: res.playerCards[playerId]["secondHand"]
                });
            }
            io.to(data.roomId).emit("play_card", res.starter);
        });
    });

    socket.on("deal_card", data => {
        io.to(data.roomId).emit("player_dealt_card", {
            playerId: data.playerId,
            suit: data.card.suit,
            rank: data.card.rank
        });
        game_rooms.playerDealtCard(data.roomId, data.card, data.playerId, res => {
            if (res.gameComplete){
                io.to(data.roomId).emit("hand_complete", {
                    winner: res.lastHandWinner,
                    pair_1_points: res.pair_1_points,
                    pair_2_points: res.pair_2_points
                });
                setTimeout(()=>{
                    io.to(data.roomId).emit("game_complete", {
                        gameWon: res.gameWon,
                        pair_1_score: res.pair_1_score,
                        pair_2_score: res.pair_2_score
                    });

                    setTimeout(()=>{
                        for(var playerId of Object.keys(res.playerCards)){
                            io.to(data.roomId).emit("player_card", {
                                forPlayer: playerId,
                                cards: res.playerCards[playerId]["firstHand"]
                            });
                        }
                        io.to(data.roomId).emit("bidding_raise", {
                            forPlayer: res.stander,    //res.raiser also works
                            raiseTo: res.raiseTo
                        });
                    }, 3000);
                }, 1000);
            }
            else{
                let delay = 500;
                if (res.handComplete){
                    io.to(data.roomId).emit("hand_complete", {
                        winner: res.nextPlayer,
                        pair_1_points: res.pair_1_points,
                        pair_2_points: res.pair_2_points
                    });
                    delay = 2000;
                }
                setTimeout(()=>{
                    io.to(data.roomId).emit("play_card", res.nextPlayer);
                }, delay);
            }
        });
    });

    socket.on("show_trump", roomId => {
        game_rooms.showTrump(roomId, trump => {
            io.to(roomId).emit("trump_revealed", trump);
        });
    })
});