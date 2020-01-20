module.exports = function (){
    this.Rooms = [];

    this.addRoom = (id, roomName) => {
        let newRoom = new Room();
        newRoom.roomName = roomName;
        newRoom.players.push(id);
        this.Rooms.push(newRoom);
    }

    this.joinRoom = (id, roomName) => {
        this.Rooms = this.Rooms.map(room => {
            if (room.roomName === roomName){
                room.players.push(id);
                return room;
            }
            return room;
        });
    }

    this.getRoomName = id => {
        let playerRoom = this.Rooms.find(room => room.players.includes(id));
        return playerRoom.roomName;
    }

    this.getPlayersInRoom = roomName => {
        let playerRoom = this.Rooms.find(room => room.roomName == roomName);
        return playerRoom.players;
    }
}

function Room(){
    this.roomName = "";
    this.players = [];
}