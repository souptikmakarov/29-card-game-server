// export const Session = () => {
//     this.Id = "";

// }

class ActiveRoom {
    constructor() {
        this._roomName = "";
        this.pair_1_score = 0;
        this.pair_2_score = 0;
        this.pair_1 = [];
        this.pair_2 = [];
        this.games_played = [];
        this.deck = null;
        this.priority_deck = null;
        this.curr_game = null;
        this.bid_starter = null;
    }
}

class Session {
    constructor() {
        // this._roomId = "";
        this._roomName = "";
        this._pair_1_score = 0;
        this._pair_2_score = 0;
        this.pair_1 = [];
        this.pair_2 = [];
        this.games_played = [];
    }

    get roomName() {
        return this._roomName;
    }

    set roomName(rName) {
        this._roomName = rName;
    }

    get pair_1_score() {
        return this._pair_1_score;
    }

    set pair_1_score(score) {
        this._pair_1_score = score;
    }

    get pair_2_score() {
        return this._pair_2_score;
    }

    set pair_2_score(score) {
        this._pair_2_score = score;
    }
}

class Player {
    constructor() {
        this._name = "";
        this._password = "";
        this._socketId = "";
        this._card_in_hand = [];
    }

    get name() {
        return this._name;
    }

    set name(name) {
        this._name = name;
    }

    get password() {
        return this._password;
    }

    set password(password) {
        this._password = password;
    }

    get socketId() {
        return this._socketId;
    }

    set socketId(socketId) {
        this._socketId = socketId;
    }

    get card_in_hand() {
        return this._card_in_hand;
    }

    set card_in_hand(card_in_hand) {
        this._card_in_hand = card_in_hand;
    }
}

class Game {
    constructor() {
        this._bid = 0;
        this._bidding_player = null;
        this._trump = null;
        this._trump_shown = false;
        this.hands_played = [];
        this._curr_hand = null;
        this._currentStand = 15;
        this._stander = null;
        this._raiser = null;
        this._playerCards = {};
        this._hand_starter = null;
    }

    get bid() {
        return this._bid;
    }

    set bid(bid) {
        this._bid = bid;
    }

    get bidding_player() {
        return this._bidding_player;
    }

    set bidding_player(bidding_player) {
        this._bidding_player = bidding_player;
    }

    get trump() {
        return this._trump;
    }

    set trump(trump) {
        this._trump = trump;
    }

    get trump_shown() {
        return this._trump_shown;
    }

    set trump_shown(trump_shown) {
        this._trump_shown = trump_shown;
    }

    get currentStand() {
        return this._currentStand;
    }

    set currentStand(currentStand) {
        this._currentStand = currentStand;
    }

    get stander() {
        return this._stander;
    }

    set stander(stander) {
        this._stander = stander;
    }

    get raiser() {
        return this._raiser;
    }

    set raiser(raiser) {
        this._raiser = raiser;
    }

    get hand_starter() {
        return this._hand_starter;
    }

    set hand_starter(hand_starter) {
        this._hand_starter = hand_starter;
    }

    get curr_hand() {
        return this._curr_hand;
    }

    set curr_hand(curr_hand) {
        this._curr_hand = curr_hand;
    }
}

class Hand {
    constructor() {
        this.starting_player = null;
        this.cards = [];
        this.winning_player = null;
        this.points = 0;
    }
}

class Card {
    constructor(suit, rank, priority, point) {
        this._suit = suit;
        this._rank = rank;
        this._priority = priority;
        this._point = point;
    }

    static fromPlayerCard(suit, rank){
        return new Card
    }

    get suit() {
        return this._suit;
    }

    set suit(suit) {
        this._suit = suit;
    }

    get rank() {
        return this._rank;
    }

    set rank(rank) {
        this._rank = rank;
    }

    get priority() {
        return this._priority;
    }

    set priority(priority) {
        this._priority = priority;
    }

    get point() {
        return this._point;
    }

    set point(point) {
        this._point = point;
    }

    inversePriority() {
        this._priority = 9 - this._priority;
    }

    markTrump(){
        this._priority = this._priority + 8;
    }
}

class Deck {
    constructor() {
        this._cards = [
            new Card("H", "J", 8, 3),
            new Card("H", "9", 7, 2),
            new Card("H", "A", 6, 1),
            new Card("H", "10", 5, 1),
            new Card("H", "K", 4, 0),
            new Card("H", "Q", 3, 0),
            new Card("H", "8", 2, 0),
            new Card("H", "7", 1, 0),
            new Card("D", "J", 8, 3),
            new Card("D", "9", 7, 2),
            new Card("D", "A", 6, 1),
            new Card("D", "10", 5, 1),
            new Card("D", "K", 4, 0),
            new Card("D", "Q", 3, 0),
            new Card("D", "8", 2, 0),
            new Card("D", "7", 1, 0),
            new Card("C", "J", 8, 3),
            new Card("C", "9", 7, 2),
            new Card("C", "A", 6, 1),
            new Card("C", "10", 5, 1),
            new Card("C", "K", 4, 0),
            new Card("C", "Q", 3, 0),
            new Card("C", "8", 2, 0),
            new Card("C", "7", 1, 0),
            new Card("S", "J", 8, 3),
            new Card("S", "9", 7, 2),
            new Card("S", "A", 6, 1),
            new Card("S", "10", 5, 1),
            new Card("S", "K", 4, 0),
            new Card("S", "Q", 3, 0),
            new Card("S", "8", 2, 0),
            new Card("S", "7", 1, 0)
        ];
    }

    getPriority(suit, rank){
        for (var card of this._cards){
            if (card.suit == suit && card.rank == rank){
                return card.priority;
            }
        }
    }

    getPoint(suit, rank){
        for (var card of this._cards){
            if (card.suit == suit && card.rank == rank){
                return card.point;
            }
        }
    }

    firstShuffle() {
        var m = this._cards.length, t, i;

        // While there remain elements to shuffle…
        while (m) {

            // Pick a remaining element…
            i = Math.floor(Math.random() * m--);

            // And swap it with the current element.
            t = this._cards[m];
            this._cards[m] = this._cards[i];
            this._cards[i] = t;
        }
    }

    shuffle() {
        for (var i = 0; i < 3; i++) {
            let cutStart = Math.floor(Math.random() * (15 - 5) + 5);
            let cutEnd = Math.floor(Math.random() * (40 - 25) + 25);
            let part_deck = this._cards.splice(cutStart, cutEnd);
            this._cards = part_deck.concat(this._cards);
        }
        let half_deck = this._cards.splice(0, this._cards.length / 2);
        this._cards = this._cards.concat(half_deck);
    }

    reversePriority() {
        for (let card of this._cards) {
            card.inversePriority();
        }
    }

    makeSuitAsTrump(suit){
        for (let card of this._cards) {
            if(card.suit == suit)
                card.markTrump();
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