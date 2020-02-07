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

    getPlayerIdForSocketId(socketId){
        for(var p in this._activePlayers){
            if (this._activePlayers[p] == socketId){
                return p;
            }
        }
    }

    markPlayerDisconnected(socketId){
        let pl = this.getPlayerIdForSocketId(socketId);
        if (pl)
            this._activePlayers[pl] = null;
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
        let activeRoom = this._activeRooms[roomId];
        if (activeRoom){
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
        else
            callback({
                err: "Room not found",
                playerList: null,
                canGameStart: false
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
                let inactiveRooms = [];
                docs.forEach(doc => {
                    if (this._activeRooms[doc._id])
                        activeRooms.push({
                            roomName: doc._roomName,
                            roomId: doc._id
                        });
                    else
                        inactiveRooms.push(doc._id);
                });
                callback({
                    err: null,
                    activeRooms: activeRooms
                });
                for (var roomId of inactiveRooms){
                    session_col.remove({_id: roomId});
                }
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
        let currRoom = this._activeRooms[roomId];
        currRoom.bid_starter = 10;

        let roomDeck = new models.Deck();
        currRoom.deck = roomDeck;

        let newGame = new models.Game();
        newGame.stander = this.getPlayer(currRoom, currRoom.bid_starter);
        newGame.raiser = newGame.stander;
        // newGame.stander;                     //This is to make player as opening bidder
        // this.getPlayer(currRoom, getNextPlayer(currRoom.bid_starter));

        for(var i of [10, 20, 11, 21]){
            newGame._playerCards[this.getPlayer(currRoom, i)] = {};
            newGame._playerCards[this.getPlayer(currRoom, i)]["firstHand"] = currRoom.deck._cards.splice(0,4);
        }
        for(var i of [10, 20, 11, 21]){
            newGame._playerCards[this.getPlayer(currRoom, i)]["secondHand"] = currRoom.deck._cards.splice(0,4);
        }
        console.log(newGame._playerCards[this.getPlayer(currRoom, i)]["firstHand"].length, 
            newGame._playerCards[this.getPlayer(currRoom, i)]["secondHand"].length);
        currRoom.curr_game = newGame;

        callback({
            playerCards: newGame._playerCards,
            stander: newGame.stander,
            raiser: newGame.raiser,
            raiseTo: newGame.currentStand + 1
        });
    }

    playerMadeBid(bid, socketId, roomId, callback){
        let currRoom = this._activeRooms[roomId];
        let bidding_player = this.getPlayerIdForSocketId(socketId);
        let bidder_pos = this.getPlayerPos(currRoom, bidding_player);
        if (bid == 0){          //Player passes
            if (currRoom.curr_game.stander == currRoom.curr_game.raiser){                   //If player is opening bidder
                currRoom.curr_game.raiser = this.getPlayer(currRoom, this.getNextPlayer(bidder_pos));
                currRoom.curr_game.stander = currRoom.curr_game.raiser;                     //Next player becomes opening bidder
                //raiseTo: currentStand + 1
                //forPlayer: raiser
            }
            else{
                if (bidding_player == currRoom.curr_game.stander){
                    currRoom.curr_game.stander = currRoom.curr_game.raiser;
                    currRoom.curr_game.raiser = this.getPlayer(currRoom, this.getNextPlayer(this.getPlayerPos(currRoom, currRoom.curr_game.stander)));
                    //raiseTo: currentStand + 1
                    //forPlayer: raiser
                }
                else{
                    let nextPlayer = this.getNextPlayer(this.getPlayerPos(currRoom, currRoom.curr_game.raiser));
                    if (nextPlayer == 10){                                                  //Last player passes
                        currRoom.curr_game.bid = currRoom.curr_game.currentStand;
                        currRoom.curr_game.bidding_player = currRoom.curr_game.stander;
                        callback({
                            finalBid: currRoom.curr_game.bid,
                            bidding_player: currRoom.curr_game.bidding_player,
                            biddingComplete: false
                        });
                        return;
                    }
                    else
                        currRoom.curr_game.raiser = this.getPlayer(currRoom, nextPlayer);
                    //raiseTo: currentStand + 1
                    //forPlayer: raiser
                }
            }
            callback({
                raiseTo: currRoom.curr_game.currentStand + 1,
                forPlayer: currRoom.curr_game.raiser,
                biddingComplete: false
            });
        }
        else {                  //Player bids
            currRoom.curr_game.currentStand = bid;
            if (currRoom.curr_game.stander == currRoom.curr_game.raiser){                   //If player is opening bidder
                currRoom.curr_game.raiser = this.getPlayer(currRoom, this.getNextPlayer(bidder_pos));
                callback({
                    raiseTo: currRoom.curr_game.currentStand + 1,
                    forPlayer: currRoom.curr_game.raiser,
                    biddingComplete: false
                });
            }
            else{
                if (bidding_player == currRoom.curr_game.stander){                          //Stander accepts raise and ask for further raise
                    callback({
                        raiseTo: currRoom.curr_game.currentStand + 1,
                        forPlayer: currRoom.curr_game.raiser,
                        biddingComplete: false
                    });
                }
                else{                                                                       //Raiser raises and ask stander to accept
                    callback({
                        raiseTo: currRoom.curr_game.currentStand,
                        forPlayer: currRoom.curr_game.stander,
                        biddingComplete: false
                    });
                }
            }
        }
    }

    getPlayerPos(roomObj, playerId){
        if (playerId == roomObj.pair_1[0])
            return 10;
        else if (playerId == roomObj.pair_1[1])
            return 11;
        else if (playerId == roomObj.pair_2[0])
            return 20;
        else if (playerId == roomObj.pair_2[1])
            return 21;
    }

    getPlayer(roomObj, playerPos){
        if (playerPos == 10)
            return roomObj.pair_1[0];
        else if (playerPos == 20)
            return roomObj.pair_2[0];
        else if (playerPos == 11)
            return roomObj.pair_1[1];
        else if (playerPos == 21)
            return roomObj.pair_2[1];
    }

    getNextPlayer(player_pos){
        if (player_pos == 10)
            return 20;
        else if (player_pos == 20)
            return 11;
        else if (player_pos == 11)
            return 21;
        else if (player_pos == 21)
            return 10;
    }
}

module.exports = NewGameRoom;