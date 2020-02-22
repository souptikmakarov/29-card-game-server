var models = require('./game-models');
var monk = require('monk');
const PLAYER = "player";

class PlayerRepo{
    constructor(db){
        this._db = db;
        this._loggedInPlayers = [];
    }

    registerPlayer(playerName, playerPass, callback){
        let player_col = this._db.get(PLAYER);
        let player = new models.Player();
        player.name = playerName;
        player.password = playerPass;
        player_col.insert(player, (err, res) => {
            if (!err){
                callback({
                    err: null,
                    playerId: res._id.toString()
                });
                this._loggedInPlayers.push(player);
            }
            else{
                callback({
                    err: "Could not create player",
                    playerId: null
                });
            }
        });
    }

    loginPlayer(playerName, playerPass, callback){
        let player_col = this._db.get(PLAYER);
        let player = new models.Player();
        player.name = playerName;
        player.password = playerPass;
        if (this._loggedInPlayers.find(e => e.name == player.name && e.password == player.password)){
            callback({
                err: "Player already logged in",
                playerId: null
            });
            return;
        }
        player_col.findOne({_name: playerName, _password: playerPass }, (err, res) => {
            if (!err && res){
                callback({
                    err: null,
                    playerId: res._id.toString()
                });
                this._loggedInPlayers.push(player);
            }
            else{
                callback({
                    err: "Could not login player",
                    playerId: null
                });
            }
        });
    }

    getPlayerData(playerId, callback){
        let player_col = this._db.get(PLAYER);
        player_col.findOne({ _id: monk.id(playerId) }, (err, res) => {
            if (!err && res){
                callback({
                    err: null,
                    name: res._name
                });
            }
            else{
                callback({
                    err: "Player not found",
                    name: null
                });
            }
        });
    }
}


module.exports = PlayerRepo;