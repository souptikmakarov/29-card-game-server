const config = require('config');
var NewGameRoom = require('./game-server');
var PlayerRepo = require('./player-repo');
var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var bodyParser = require('body-parser');
var monk = require('monk');

var port = config.get('appPort');
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

app.get('/', async function(req, res){
    res.sendFile(__dirname + '/index.html');
});

app.get('/socket.io/socket.io.js', async function(req, res){
    res.sendFile(__dirname + '/node_modules/socket.io-client/dist/socket.io.js');
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

    socket.on('disconnect', function(){
        console.log('user disconnected');
        game_rooms.markPlayerDisconnected(socket.id);
        // game_rooms.removePlayerFromRoom(socket.id, data => {
        //     if(!data.err){
        //         io.to(data.roomId).emit("players_in_room", data.playerList);
        //     }
        // });
    });

    socket.on("createRoom", data => {
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

    socket.on("joinRoom", data => {
        game_rooms.updateActivePlayer(data.playerId, socket.id);
        game_rooms.joinExistingRoomAndReturnPlayerList(data.roomId, data.playerId, result => {
            if (result.err){
                socket.emit("join_room_failed", result.err);
            }
            else{
                socket.join(data.roomId, () => {
                    console.log(`${socket.id} joined room ${data.roomId}`);
                    io.to(data.roomId).emit("players_in_room", result.playerList);
                });

                if (result.canGameStart){
                    console.log("Game can start");
                    io.to(data.roomId).emit("game_start");
                    setTimeout(() => startGameAndInformPlayers(data.roomId), 1000);
                }
            }
        });
    });

    function startGameAndInformPlayers(roomId){
        game_rooms.startNewGame(roomId, res => {
            for(var playerId of Object.keys(res.playerCards)){
                io.to(roomId).emit("player_card", {
                    forPlayer: playerId,
                    cards: res.playerCards[playerId]["firstHand"]
                });
            }
            io.to(roomId).emit("bidding_raise", {
                forPlayer: res.stander.playerId,
                raiseTo: res.currentStand
            });
        });
    }


});