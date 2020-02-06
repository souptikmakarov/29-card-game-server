// export const Session = () => {
//     this.Id = "";

// }

class ActiveRoom{
    constructor(){
        this._roomName = "";
        this.pair_1_score = 0;
        this.pair_2_score = 0;
        this.pair_1 = [];
        this.pair_2 = [];
        this.games_played = [];
        this.deck = null;
        this.temp_deck = null;
        this.curr_game = null;
        this.bid_starter = null;
    }
}

class Session{
    constructor(){
        // this._roomId = "";
        this._roomName = "";
        this._pair_1_score = 0;
        this._pair_2_score = 0;
        this.pair_1 = [];
        this.pair_2 = [];
        this.games_played = [];
    }

    get roomName(){
        return this._roomName;
    }

    set roomName(rName){
        this._roomName = rName;
    }

    get pair_1_score(){
        return this._pair_1_score;
    }

    set pair_1_score(score){
        this._pair_1_score = score;
    }

    get pair_2_score(){
        return this._pair_2_score;
    }

    set pair_2_score(score){
        this._pair_2_score = score;
    }
}

class Player{
    constructor(){
        this._name = "";
        this._password = "";
        this._socketId = "";
        this._card_in_hand = [];
    }

    get name(){
        return this._name;
    }

    set name(name){
        this._name = name;
    }

    get password(){
        return this._password;
    }

    set password(password){
        this._password = password;
    }

    get socketId(){
        return this._socketId;
    }

    set socketId(socketId){
        this._socketId = socketId;
    }

    get card_in_hand(){
        return this._card_in_hand;
    }

    set card_in_hand(card_in_hand){
        this._card_in_hand = card_in_hand;
    }
}

class Game{
    constructor(){
        this._bid = 0;
        this._bidding_player = null;
        this._trump = null;
        this._trump_shown = false;
        this.hands_played = [];
        this._currentStand = 15;
        this._stander = null;
        this._raiser = null;
        this._playerCards = {};
    }

    get bid(){
        return this._bid;
    }

    set bid(bid){
        this._bid = bid;
    }

    get bidding_player(){
        return this._bidding_player;
    }

    set bidding_player(bidding_player){
        this._bidding_player = bidding_player;
    }

    get trump(){
        return this._trump;
    }

    set trump(trump){
        this._trump = trump;
    }

    get trump_shown(){
        return this._trump_shown;
    }

    set trump_shown(trump_shown){
        this._trump_shown = trump_shown;
    }

    get currentStand(){
        return this._currentStand;
    }

    set currentStand(currentStand){
        this._currentStand = currentStand;
    }

    get stander(){
        return this._stander;
    }

    set stander(stander){
        this._stander = stander;
    }

    get raiser(){
        return this._raiser;
    }

    set raiser(raiser){
        this._raiser = raiser;
    }
}

class Hand{
    constructor(){
        this._starting_player = null;
        this.cards = [];
        this.winning_player = null;
        this.points = 0;
    }
}

class Card{
    constructor(suit, rank, priority, point){
        this._suit = suit;
        this._rank = rank;
        this._priority = priority;
        this._point = point;
    }

    get suit(){
        return this._suit;
    }

    set suit(suit){
        this._suit = suit;
    }

    get rank(){
        return this._rank;
    }

    set rank(rank){
        this._rank = rank;
    }

    get priority(){
        return this._priority;
    }

    set priority(priority){
        this._priority = priority;
    }

    get point(){
        return this._point;
    }

    set point(point){
        this._point = point;
    }

    inversePriority(){
        this._priority = 9 - this._priority;
    }
}

class Deck{
    constructor(){
        this._cards = [
            new Card("H", "J", 1, 3),
            new Card("H", "9", 2, 2),
            new Card("H", "A", 3, 1),
            new Card("H", "10", 4, 1),
            new Card("H", "K", 5, 0),
            new Card("H", "Q", 6, 0),
            new Card("H", "8", 7, 0),
            new Card("H", "7", 8, 0),
            new Card("D", "J", 1, 3),
            new Card("D", "9", 2, 2),
            new Card("D", "A", 3, 1),
            new Card("D", "10", 4, 1),
            new Card("D", "K", 5, 0),
            new Card("D", "Q", 6, 0),
            new Card("D", "8", 7, 0),
            new Card("D", "7", 8, 0),
            new Card("C", "J", 1, 3),
            new Card("C", "9", 2, 2),
            new Card("C", "A", 3, 1),
            new Card("C", "10", 4, 1),
            new Card("C", "K", 5, 0),
            new Card("C", "Q", 6, 0),
            new Card("C", "8", 7, 0),
            new Card("C", "7", 8, 0),
            new Card("S", "J", 1, 3),
            new Card("S", "9", 2, 2),
            new Card("S", "A", 3, 1),
            new Card("S", "10", 4, 1),
            new Card("S", "K", 5, 0),
            new Card("S", "Q", 6, 0),
            new Card("S", "8", 7, 0),
            new Card("S", "7", 8, 0)
        ];
        this.firstShuffle();
    }

    firstShuffle(){
        for (var i = 0; i < 10; i++){
            let cutStart = Math.floor(Math.random() * 10);
            let cutEnd = Math.floor(Math.random() * (32 - 25) + 25);
            let part_deck = this._cards.splice(cutStart, cutEnd);
            this._cards = part_deck.concat(this._cards);
        }
    }

    shuffle(){
        for (var i = 0; i < 3; i++){
            let cutStart = Math.floor(Math.random() * (18 - 10) + 10);
            let cutEnd = Math.floor(Math.random() * (32 - 25) + 25);
            let part_deck = this._cards.splice(cutStart, cutEnd);
            this._cards = part_deck.concat(this._cards);
        }
        let half_deck = this._cards.splice(0, this._cards.length/2);
    }

    reversePriority(){
        for (let card in this._cards){
            card.inversePriority();
        }
    }
}

module.exports = {
    Session,
    Player,
    Game,
    Hand,
    Card,
    Deck,
    ActiveRoom
}