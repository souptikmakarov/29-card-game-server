var models = require('./game-models');
var monk = require('monk');
const SESSION = "session";

const TRUMP_HEARTS = "hearts";
const TRUMP_DIAMONDS = "diamonds";
const TRUMP_CLUBS = "clubs";
const TRUMP_SPADES = "spades";
const TRUMP_JOKER = "joker";
const TRUMP_GUARANTEE = "guarantee";
const TRUMP_SEVENTH = "seventh";

class NewGameRoom {
    constructor(db, player_repo) {
        this._db = db;
        this._playerRepo = player_repo;
        this._activeRooms = {};
        this._activePlayers = {};
    }

    updateActivePlayer(playerId, socketId) {
        this._activePlayers[playerId] = socketId;
    }

    updateActivePlayerAndJoinRoom(playerId, socketId, roomId, callback){
        this.updateActivePlayer(playerId, socketId);
        this.findActiveRooms(res => {
            if (!res.err && res.activeRooms.find(room => room.roomId == roomId)){
                let lastRoom = this._activeRooms[roomId];
                if (lastRoom){
                    if (lastRoom.pair_1.indexOf(playerId) != -1 || lastRoom.pair_2.indexOf(playerId) != -1){
                        callback(true);
                    }
                }
            }
            callback(false);
        })
    }

    getPlayerIdForSocketId(socketId) {
        for (var p in this._activePlayers) {
            if (this._activePlayers[p] == socketId) {
                return p;
            }
        }
    }

    markPlayerDisconnected(socketId) {
        let pl = this.getPlayerIdForSocketId(socketId);
        if (pl)
            this._activePlayers[pl] = null;
    }

    createNewRoom(roomName, adminId, callback) {
        this._session = new models.Session();
        this._session.roomName = roomName;
        this._session.pair_1.push(adminId);


        let newActiveRoom = new models.ActiveRoom();
        newActiveRoom._roomName = roomName;
        newActiveRoom.pair_1.push(adminId);

        let session_col = this._db.get(SESSION);
        session_col.insert(this._session, (err, result) => {
            if (!err) {
                this._activeRooms[result._id.toString()] = newActiveRoom;
                callback(result._id.toString());
            } else {
                callback(null);
            }
        });
    }

    joinExistingRoomAndReturnPlayerList(roomId, playerId, callback) {
        let activeRoom = this._activeRooms[roomId];
        if (activeRoom) {
            let session_col = this._db.get(SESSION);
            session_col.findOne({ _id: monk.id(roomId) }, (err, doc) => {
                let playerList = null;
                let canGameStart = false;
                let isUpdateReq = false;
                if (!doc) {
                    callback({
                        err: "Room not found",
                        playerList: playerList,
                        canGameStart: canGameStart
                    });
                    return;
                }
                if (doc.pair_1.length === 1) {
                    if (doc.pair_1.indexOf(playerId) == -1) {
                        doc.pair_1.push(playerId);
                        playerList = doc.pair_1;
                        isUpdateReq = true;
                    }
                }
                else if (doc.pair_2.length < 2) {
                    if (doc.pair_1.indexOf(playerId) == -1 && doc.pair_2.indexOf(playerId) == -1) {
                        doc.pair_2.push(playerId);
                        playerList = doc.pair_1.concat(doc.pair_2);
                        isUpdateReq = true;

                        if (doc.pair_1.length == 2 && doc.pair_2.length == 2)
                            canGameStart = true;
                    }
                }
                else {
                    // if (!(doc.pair_1.includes(playerId) || doc.pair_2.includes(playerId))) {
                    callback({
                        err: "Room is already full",
                        playerList: playerList,
                        canGameStart: canGameStart
                    });
                    return;
                    // }
                    // else{
                    //     callback({
                    //         err: null,
                    //         playerList: doc.pair_1.concat(doc.pair_2),
                    //         canGameStart: false
                    //     });
                    //     return;
                    // }
                }

                if (isUpdateReq) {
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
                }
                else{
                    callback({
                        err: null,
                        playerList: playerList,
                        canGameStart: canGameStart
                    });
                }
            });
        }
        else
            callback({
                err: "Room not found",
                playerList: null,
                canGameStart: false
            });
    }

    removePlayerFromRoom(playerId, callback) {
        let session_col = this._db.get(SESSION);
        session_col.findOne({
            $or: [
                { pair_1: playerId },
                { pair_2: playerId }
            ]
        }, (err, doc) => {
            if (doc) {
                if (doc.pair_1.includes(playerId)) {
                    doc.pair_1.splice(doc.pair_1.indexOf(playerId), 1);
                    session_col.findOneAndUpdate({ _id: doc._id }, { $set: { pair_1: doc.pair_1 } }, (err, updatedDoc) => {
                        if (updatedDoc) {
                            callback({
                                err: null,
                                playerList: doc.pair_1.concat(doc.pair_2),
                                roomId: doc._id
                            });
                            return;
                        }
                    });
                }
                else if (doc.pair_2.includes(playerId)) {
                    doc.pair_2.splice(doc.pair_2.indexOf(playerId), 1);
                    session_col.findOneAndUpdate({ _id: doc._id }, { $set: { pair_2: doc.pair_2 } }, (err, updatedDoc) => {
                        if (updatedDoc) {
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
            else {
                callback({
                    err: "No rooms found for user",
                    playerList: null,
                    roomId: null
                })
            }
        });
    }

    findActiveRooms(callback) {
        let session_col = this._db.get(SESSION);
        session_col.find({
            $or: [
                { 'pair_1.0': { $exists: true } },
                { 'pair_2.0': { $exists: true } }
            ]
        },
            (err, docs) => {
                if (docs.length > 0) {
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
                    for (var roomId of inactiveRooms) {
                        session_col.remove({ _id: roomId });
                    }
                }
                else {
                    callback({
                        err: "No active rooms",
                        activeRooms: []
                    });
                }
            });
    }

    getPlayersInRoom(roomId, callback){
        let currRoom = this._activeRooms[roomId];
        callback([currRoom.pair_1[0], currRoom.pair_1[1], currRoom.pair_2[0], currRoom.pair_2[1]]);
    }

    startNewGameSession(roomId, callback) {
        let currRoom = this._activeRooms[roomId];
        currRoom.bid_starter = 10;

        let roomDeck = new models.Deck();
        roomDeck.firstShuffle();
        currRoom.deck = roomDeck;

        let newGame = new models.Game();
        newGame.stander = this.getPlayer(currRoom, currRoom.bid_starter);
        newGame.raiser = newGame.stander;

        for (var i of [10, 20, 11, 21]) {
            newGame._playerCards[this.getPlayer(currRoom, i)] = {};
            newGame._playerCards[this.getPlayer(currRoom, i)]["firstHand"] = currRoom.deck._cards.splice(0, 4);
        }
        for (var i of [10, 20, 11, 21]) {
            newGame._playerCards[this.getPlayer(currRoom, i)]["secondHand"] = currRoom.deck._cards.splice(0, 4);
        }
        currRoom.curr_game = newGame;

        callback({
            playerCards: newGame._playerCards,
            stander: newGame.stander,
            raiser: newGame.raiser,
            raiseTo: newGame.currentStand + 1
        });
    }

    playerMadeBid(bid, socketId, roomId, callback) {
        let currRoom = this._activeRooms[roomId];
        let bidding_player = this.getPlayerIdForSocketId(socketId);
        let bidder_pos = this.getPlayerPos(currRoom, bidding_player);
        if (bid == 0) {          //Player passes
            if (currRoom.curr_game.stander == currRoom.curr_game.raiser) {                   //If player is opening bidder
                currRoom.curr_game.raiser = this.getPlayer(currRoom, this.getNextPlayer(bidder_pos));
                currRoom.curr_game.stander = currRoom.curr_game.raiser;                     //Next player becomes opening bidder
                //raiseTo: currentStand + 1
                //forPlayer: raiser
            }
            else {
                if (bidding_player == currRoom.curr_game.stander) {
                    currRoom.curr_game.stander = currRoom.curr_game.raiser;
                    let nextPlayer = this.getPlayer(currRoom, this.getNextPlayer(this.getPlayerPos(currRoom, currRoom.curr_game.stander)));
                    if (nextPlayer == this.getPlayer(currRoom, currRoom.bid_starter)) {                                                  //Last player passes
                        if (currRoom.curr_game.currentStand == 15) {                         // No one made bid
                            callback({
                                finalBid: currRoom.curr_game.bid,
                                bidding_player: currRoom.curr_game.bidding_player,
                                biddingComplete: true,
                                gameCancelled: true
                            });
                        }
                        else {                                                               // Someone bid
                            currRoom.curr_game.bid = currRoom.curr_game.currentStand;
                            currRoom.curr_game.bidding_player = currRoom.curr_game.stander;
                            callback({
                                finalBid: currRoom.curr_game.bid,
                                bidding_player: currRoom.curr_game.bidding_player,
                                biddingComplete: true,
                                gameCancelled: false
                            });
                            return;
                        }
                    }
                    else
                        currRoom.curr_game.raiser = nextPlayer;
                    //raiseTo: currentStand + 1
                    //forPlayer: raiser
                }
                else {
                    let nextPlayer = this.getPlayer(currRoom, this.getNextPlayer(this.getPlayerPos(currRoom, currRoom.curr_game.raiser)));
                    if (nextPlayer == this.getPlayer(currRoom, currRoom.bid_starter)) {                                                  //Last player passes
                        if (currRoom.curr_game.currentStand == 15) {                         // No one made bid
                            callback({
                                finalBid: currRoom.curr_game.bid,
                                bidding_player: currRoom.curr_game.bidding_player,
                                biddingComplete: true,
                                gameCancelled: true
                            });
                        }
                        else {                                                               // Someone bid
                            currRoom.curr_game.bid = currRoom.curr_game.currentStand;
                            currRoom.curr_game.bidding_player = currRoom.curr_game.stander;
                            callback({
                                finalBid: currRoom.curr_game.bid,
                                bidding_player: currRoom.curr_game.bidding_player,
                                biddingComplete: true,
                                gameCancelled: false
                            });
                            return;
                        }
                    }
                    else
                        currRoom.curr_game.raiser = nextPlayer;
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
            if (currRoom.curr_game.stander == currRoom.curr_game.raiser) {                   //If player is opening bidder
                currRoom.curr_game.raiser = this.getPlayer(currRoom, this.getNextPlayer(bidder_pos));
                callback({
                    raiseTo: currRoom.curr_game.currentStand + 1,
                    forPlayer: currRoom.curr_game.raiser,
                    biddingComplete: false
                });
            }
            else {
                if (bidding_player == currRoom.curr_game.stander) {                          //Stander accepts raise and ask for further raise
                    if (currRoom.curr_game.currentStand == 28) {                             //Bid reaches 28
                        currRoom.curr_game.bid = currRoom.curr_game.currentStand;
                        currRoom.curr_game.bidding_player = currRoom.curr_game.stander;
                        callback({
                            finalBid: currRoom.curr_game.bid,
                            bidding_player: currRoom.curr_game.bidding_player,
                            biddingComplete: true,
                            gameCancelled: false
                        });
                        return;
                    }
                    else
                        callback({
                            raiseTo: currRoom.curr_game.currentStand + 1,
                            forPlayer: currRoom.curr_game.raiser,
                            biddingComplete: false
                        });
                }
                else {                                                                       //Raiser raises and ask stander to accept
                    callback({
                        raiseTo: currRoom.curr_game.currentStand,
                        forPlayer: currRoom.curr_game.stander,
                        biddingComplete: false
                    });
                }
            }
        }
    }

    playerSetTrump(roomId, trump, callback){
        let currRoom = this._activeRooms[roomId];
        if (currRoom){
            let currGame = currRoom.curr_game;
            currGame.trump = trump;
            currGame.priority_deck = new models.Deck();
            if (trump == TRUMP_SEVENTH){
                let trumpSuit = currRoom.curr_game._playerCards[currRoom.curr_game.bidding_player]["secondHand"][2].suit;
                if (trumpSuit == "S")
                    currGame.trump = TRUMP_SPADES;
                else if (trumpSuit == "H")
                    currGame.trump = TRUMP_HEARTS;
                else if (trumpSuit == "C")
                    currGame.trump = TRUMP_CLUBS;
                else if (trumpSuit == "D")
                    currGame.trump = TRUMP_DIAMONDS;
            }
            currRoom.curr_game.hand_starter = this.getPlayer(currRoom, currRoom.bid_starter);
            callback({
                playerCards: currRoom.curr_game._playerCards,
                starter: currRoom.curr_game.hand_starter
            });
        }
    }

    showTrump(roomId, callback){
        let currRoom = this._activeRooms[roomId];
        if (currRoom){
            let currGame = currRoom.curr_game;
            currGame.trump_shown = true;
            if (currGame.trump == TRUMP_SPADES)
                currGame.priority_deck.makeSuitAsTrump("S");
            else if (currGame.trump == TRUMP_HEARTS)
                currGame.priority_deck.makeSuitAsTrump("H");
            else if (currGame.trump == TRUMP_CLUBS)
                currGame.priority_deck.makeSuitAsTrump("C");
            else if (currGame.trump == TRUMP_DIAMONDS)
                currGame.priority_deck.makeSuitAsTrump("D");
            else if (currGame.trump == TRUMP_GUARANTEE)
                currGame.priority_deck.reversePriority();
            callback(currGame.trump);
        }
    }

    playerDealtCard(roomId, card, playerId, callback){
        let currRoom = this._activeRooms[roomId];
        if (currRoom){
            if (playerId == currRoom.curr_game.hand_starter){
                let currHand = new models.Hand();
                currHand.starting_player = playerId;
                currHand.starting_suit = card.suit;
                currHand.cards.push(models.Card.fromPlayerCard(card.suit, card.rank));
                currRoom.curr_game.curr_hand = currHand;
            }
            else{
                currRoom.curr_game.curr_hand.cards.push(models.Card.fromPlayerCard(card.suit, card.rank));
                if (currRoom.curr_game.curr_hand.cards.length == 4){                             // 4 needs to change for single
                    this.determineHandWinner(currRoom);
                    currRoom.curr_game.hands_played.push(currRoom.curr_game.curr_hand);
                    if (currRoom.curr_game.hands_played.length == 8){
                        var lastHandWinner = currRoom.curr_game.curr_hand.winning_player;
                        var pair_1_points = currRoom.curr_game.pair_1_points;
                        var pair_2_points = currRoom.curr_game.pair_2_points;
                        var gameWon = this.updateScoreAndStartNextGame(currRoom);
                        callback({
                            handComplete: true,
                            gameComplete: true,
                            gameWon: gameWon,
                            lastHandWinner: lastHandWinner,
                            pair_1_points: pair_1_points,
                            pair_2_points: pair_2_points,
                            pair_1_score: currRoom.pair_1_score,
                            pair_2_score: currRoom.pair_2_score,
                            playerCards: currRoom.curr_game._playerCards,
                            stander: currRoom.curr_game.stander,
                            raiser: currRoom.curr_game.raiser,
                            raiseTo: currRoom.curr_game.currentStand + 1
                        });
                        return;
                    }
                    currRoom.curr_game.hand_starter = currRoom.curr_game.curr_hand.winning_player;
                    callback({
                        nextPlayer: currRoom.curr_game.hand_starter,
                        handComplete: true,
                        gameComplete: false,
                        pair_1_points: currRoom.curr_game.pair_1_points,
                        pair_2_points: currRoom.curr_game.pair_2_points
                    });
                    return;
                }
            }
            let nextPlayer = this.getPlayer(currRoom, this.getNextPlayer(this.getPlayerPos(currRoom, playerId)));
            callback({
                nextPlayer: nextPlayer,
                handComplete: false,
                gameComplete: false
            });
        }
    }

    determineHandWinner(currRoom){
        let currentWinner = currRoom.curr_game.hand_starter;
        let currentPlayer = currRoom.curr_game.hand_starter;
        let highestPriority = currRoom.curr_game.priority_deck.getPriority(currRoom.curr_game.curr_hand.cards[0].suit, currRoom.curr_game.curr_hand.cards[0].rank);
        let totalPointsInHand = currRoom.curr_game.priority_deck.getPoint(currRoom.curr_game.curr_hand.cards[0].suit, currRoom.curr_game.curr_hand.cards[0].rank);
        let startingSuit = currRoom.curr_game.curr_hand.cards[0].suit;
        for(var i = 1; i < 4; i++){
            currentPlayer = this.getPlayer(currRoom, this.getNextPlayer(this.getPlayerPos(currRoom, currentPlayer)));
            let currentPriority = 0;
            currentPriority = currRoom.curr_game.priority_deck.getPriority(currRoom.curr_game.curr_hand.cards[i].suit, currRoom.curr_game.curr_hand.cards[i].rank);

            if (currRoom.curr_game.curr_hand.cards[i].suit == startingSuit){
                if (currentPriority > highestPriority){
                    highestPriority = currentPriority;
                    currentWinner = currentPlayer;
                }
            }
            else{
                if (currentPriority > highestPriority && currentPriority > 8){
                    highestPriority = currentPriority;
                    currentWinner = currentPlayer;
                }
            }
            totalPointsInHand += currRoom.curr_game.priority_deck.getPoint(currRoom.curr_game.curr_hand.cards[i].suit, currRoom.curr_game.curr_hand.cards[i].rank);
        }
        if (currRoom.curr_game.hands_played.length == 7){
            totalPointsInHand += 1;
        }

        currRoom.curr_game.curr_hand.winning_player = currentWinner;
        currRoom.curr_game.curr_hand.points = totalPointsInHand;

        let winner_pos = this.getPlayerPos(currRoom, currentWinner);
        if (winner_pos == 10 || winner_pos == 11){
            currRoom.curr_game.pair_1_points += totalPointsInHand;
        }
        else if (winner_pos == 20 || winner_pos == 21){
            currRoom.curr_game.pair_2_points += totalPointsInHand;
        }
    }

    updateScoreAndStartNextGame(currRoom){
        // Update pair score
        let gameWon = false;
        if (currRoom.pair_1.indexOf(currRoom.curr_game.bidding_player) != -1)
            if (currRoom.curr_game.pair_1_points >= currRoom.curr_game.bid){
                currRoom.pair_1_score += 1;
                gameWon = true;
            }
            else
                currRoom.pair_1_score -= 1;
        else
            if (currRoom.curr_game.pair_2_points >= currRoom.curr_game.bid){
                currRoom.pair_2_score += 1;
                gameWon = true;
            }
            else
                currRoom.pair_2_score -= 1;
        
        // Setup next game
        currRoom.games_played.push(currRoom.curr_game);
        currRoom.bid_starter = this.getNextPlayer(currRoom.bid_starter);

        // Assemble cards played in order and shuffle
        let assembledDeck = [];
        for (var handPlayed of currRoom.curr_game.hands_played){
            for (var card of handPlayed.cards){
                assembledDeck.push(card);
            }
        }
        currRoom.deck._cards = assembledDeck;
        currRoom.deck.shuffle();

        // Initialise game data
        let newGame = new models.Game();
        newGame.stander = this.getPlayer(currRoom, currRoom.bid_starter);
        newGame.raiser = newGame.stander;

        for (var i of [10, 20, 11, 21]) {
            newGame._playerCards[this.getPlayer(currRoom, i)] = {};
            newGame._playerCards[this.getPlayer(currRoom, i)]["firstHand"] = currRoom.deck._cards.splice(0, 4);
        }
        for (var i of [10, 20, 11, 21]) {
            newGame._playerCards[this.getPlayer(currRoom, i)]["secondHand"] = currRoom.deck._cards.splice(0, 4);
        }
        currRoom.curr_game = newGame;
        return gameWon;
    }

    getPlayerPos(roomObj, playerId) {
        if (playerId == roomObj.pair_1[0])
            return 10;
        else if (playerId == roomObj.pair_1[1])
            return 11;
        else if (playerId == roomObj.pair_2[0])
            return 20;
        else if (playerId == roomObj.pair_2[1])
            return 21;
    }

    getPlayer(roomObj, playerPos) {
        if (playerPos == 10)
            return roomObj.pair_1[0];
        else if (playerPos == 20)
            return roomObj.pair_2[0];
        else if (playerPos == 11)
            return roomObj.pair_1[1];
        else if (playerPos == 21)
            return roomObj.pair_2[1];
    }

    getNextPlayer(player_pos) {
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