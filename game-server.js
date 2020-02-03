var models = require('./game-models');
var monk = require('monk');
const SESSION = "session";

class NewGameRoom{
    constructor(db, player_repo){
        this._db = db;
        this._playerRepo = player_repo;
        this._activeRooms = {};
        this._activePlayers = {};
    }

    updateActivePlayer(playerId, socketId){
        this._activePlayers[playerId] = socketId;
    }

    markPlayerDisconnected(socketId){
        for(var p in this._activePlayers){
            if (this._activePlayers[p] == socketId){
                this._activePlayers[p] = null;
                break;
            }
        }
    }

    createNewRoom(roomName, adminId, callback){
        this._session = new models.Session();
        this._session.roomName = roomName;
        this._session.pair_1.push(adminId);

        
        let newActiveRoom = new models.ActiveRoom();
        newActiveRoom._roomName = roomName;
        newActiveRoom.pair_1.push(adminId);

        let session_col = this._db.get(SESSION);
        session_col.insert(this._session, (err, result) => {
            if (!err){
                this._activeRooms[result._id.toString()] = newActiveRoom;
                callback(result._id.toString());
            }else{
                callback(null);
            }
        });
    }

    joinExistingRoomAndReturnPlayerList(roomId, playerId, callback){
        let session_col = this._db.get(SESSION);
        session_col.findOne({ _id: monk.id(roomId) }, (err, doc) => {
            let playerList = null;
            let canGameStart = false;
            if (!doc){
                callback({
                    err: "Room not found",
                    playerList: playerList,
                    canGameStart: canGameStart
                });
                return;
            }
            if (doc.pair_1.length === 1){
                doc.pair_1.push(playerId);
                playerList = doc.pair_1;
            }
            else if(doc.pair_2.length < 2){
                doc.pair_2.push(playerId);
                playerList = doc.pair_1.concat(doc.pair_2);

                if (doc.pair_1.length == 2 && doc.pair_2.length == 2)
                    canGameStart = true;
            }
            else{
                if (!(doc.pair_1.includes(playerId) || doc.pair_2.includes(playerId))){
                    callback({
                        err: "Room is already full",
                        playerList: playerList,
                        canGameStart: canGameStart
                    });
                    return;
                }
            }

            let activeRoom = this._activeRooms[roomId];
            activeRoom.pair_1 = doc.pair_1;
            activeRoom.pair_2 = doc.pair_2;
             
            session_col.findOneAndUpdate({ _id: monk.id(roomId) }, { $set: doc }, (err, updatedDoc) => {
                if (updatedDoc)
                    callback({
                        err: null,
                        playerList: playerList,
                        canGameStart: canGameStart
                    });
                else
                    callback({
                        err: "Room not found",
                        playerList: playerList,
                        canGameStart: canGameStart
                    });
            });
        });
    }

    removePlayerFromRoom(playerId, callback){
        let session_col = this._db.get(SESSION);
        session_col.findOne({
            $or: [
                { pair_1: playerId },
                { pair_2: playerId }
            ]
        }, (err, doc) => {
            if (doc){
                if (doc.pair_1.includes(playerId)){
                    doc.pair_1.splice(doc.pair_1.indexOf(playerId), 1);
                    session_col.findOneAndUpdate({ _id: doc._id }, { $set: { pair_1: doc.pair_1 } }, (err, updatedDoc) => {
                        if (updatedDoc){
                            callback({
                                err: null,
                                playerList: doc.pair_1.concat(doc.pair_2),
                                roomId: doc._id
                            });
                            return;
                        }
                    });
                }
                else if (doc.pair_2.includes(playerId)){
                    doc.pair_2.splice(doc.pair_2.indexOf(playerId), 1);
                    session_col.findOneAndUpdate({ _id: doc._id }, { $set: { pair_2: doc.pair_2 } }, (err, updatedDoc) => {
                        if (updatedDoc){
                            callback({
                                err: null,
                                playerList: doc.pair_1.concat(doc.pair_2),
                                roomId: doc._id
                            });
                            return;
                        }
                    });
                }

                let activeRoom = this._activeRooms[doc._id.toString()];
                activeRoom.pair_1 = doc.pair_1;
                activeRoom.pair_2 = doc.pair_2;
            }
            else{
                callback({
                    err: "No rooms found for user",
                    playerList: null,
                    roomId: null
                })
            }
        });
    }

    findActiveRooms(callback){
        let session_col = this._db.get(SESSION);
        session_col.find({
            $or: [
                {'pair_1.0': {$exists: true}},
                {'pair_2.0': {$exists: true}}
            ]
        },
        (err, docs) => {
            if (docs.length > 0){
                let activeRooms = [];
                docs.forEach(doc => {
                    activeRooms.push({
                        roomName: doc._roomName,
                        roomId: doc._id
                    });
                });
                callback({
                    err: null,
                    activeRooms: activeRooms
                });
            }
            else{
                callback({
                    err: "No active rooms",
                    activeRooms: []
                });
            }
        });
    }


    startNewGameSession(roomId, callback){
        let roomDeck = models.Deck();
        let currRoom = this._activeRooms[roomId];
        currRoom.deck = roomDeck;
        currRoom.bid_starter = 10;

        let newGame = models.Game();
        newGame.stander = this.getPlayer(currRoom, currRoom.bid_starter);
        newGame.raiser = this.getPlayer(currRoom, getNextPlayer(currRoom.bid_starter));

        for(var i of [10, 20, 11, 21]){
            newGame._playerCards[this.getPlayer(currRoom, i)] = {};
            newGame._playerCards[this.getPlayer(currRoom, i)]["firstHand"] = currRoom.deck._cards.splice(0,4);
        }
        for(var i of [10, 20, 11, 21]){
            newGame._playerCards[this.getPlayer(currRoom, i)]["secondHand"] = currRoom.deck._cards.splice(0,4);
        }

        currRoom.curr_game = newGame;

        callback({
            playerCards: newGame._playerCards,
            stander: newGame.stander,
            raiser: newGame.raiser,
            currentStand: newGame.currentStand
        });
    }

    getPlayer(roomObj, playerPos){
        if (playerPos == 10)
            return {
                playerId: roomObj.pair_1[0],
                pos: 10
            }
        else if (playerPos == 20)
            return {
                playerId: roomObj.pair_2[0],
                pos: 20
            }
        else if (playerPos == 11)
            return {
                playerId: roomObj.pair_1[1],
                pos: 11
            }
        else if (playerPos == 21)
            return {
                playerId: roomObj.pair_2[1],
                pos: 21
            }
    }

    getNextPlayer(){
        if (bid_starter == 10)
            return 20;
        else if (bid_starter == 20)
            return 11;
        else if (bid_starter == 11)
            return 21;
        else if (bid_starter == 21)
            return 10;
    }
}

module.exports = NewGameRoom;