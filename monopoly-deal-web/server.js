const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

// Game state
const rooms = new Map();

// Card definitions
const COLORS = {
  BROWN: { setSize: 2, rents: [1, 2] },
  LIGHT_BLUE: { setSize: 3, rents: [1, 2, 3] },
  PINK: { setSize: 3, rents: [1, 2, 4] },
  ORANGE: { setSize: 3, rents: [1, 3, 5] },
  RED: { setSize: 3, rents: [2, 3, 6] },
  YELLOW: { setSize: 3, rents: [2, 4, 6] },
  GREEN: { setSize: 3, rents: [2, 4, 7] },
  DARK_BLUE: { setSize: 2, rents: [3, 8] },
  RAILROAD: { setSize: 4, rents: [1, 2, 3, 4] },
  UTILITY: { setSize: 2, rents: [1, 2] }
};

const PROPERTIES = [
  {name: "Mediterranean Avenue", color: "BROWN", value: 1, img: "MediterraneanAvenue"},
  {name: "Baltic Avenue", color: "BROWN", value: 1, img: "BalticAvenue"},
  {name: "Oriental Avenue", color: "LIGHT_BLUE", value: 1, img: "OrientalAvenue"},
  {name: "Vermont Avenue", color: "LIGHT_BLUE", value: 1, img: "VermontAvenue"},
  {name: "Connecticut Avenue", color: "LIGHT_BLUE", value: 1, img: "ConnecticutAvenue"},
  {name: "St. Charles Place", color: "PINK", value: 2, img: "St_CharlesPlace"},
  {name: "States Avenue", color: "PINK", value: 2, img: "StatesAvenue"},
  {name: "Virginia Avenue", color: "PINK", value: 2, img: "VirginiaAvenue"},
  {name: "St. James Place", color: "ORANGE", value: 2, img: "St_JamesPlace"},
  {name: "Tennessee Avenue", color: "ORANGE", value: 2, img: "TennesseeAvenue"},
  {name: "New York Avenue", color: "ORANGE", value: 2, img: "New_YorkAvenue"},
  {name: "Kentucky Avenue", color: "RED", value: 3, img: "KentuckyAvenue"},
  {name: "Indiana Avenue", color: "RED", value: 3, img: "IndianaAvenue"},
  {name: "Illinois Avenue", color: "RED", value: 3, img: "IllinoisAvenue"},
  {name: "Atlantic Avenue", color: "YELLOW", value: 3, img: "AtlanticAvenue"},
  {name: "Ventnor Avenue", color: "YELLOW", value: 3, img: "VentnorAvenue"},
  {name: "Marvin Gardens", color: "YELLOW", value: 3, img: "MarvinGardens"},
  {name: "Pacific Avenue", color: "GREEN", value: 4, img: "PacificAvenue"},
  {name: "North Carolina Avenue", color: "GREEN", value: 4, img: "North_CarolinaAvenue"},
  {name: "Pennsylvania Avenue", color: "GREEN", value: 4, img: "PennsylvaniaAvenue"},
  {name: "Park Place", color: "DARK_BLUE", value: 4, img: "ParkPlace"},
  {name: "Boardwalk", color: "DARK_BLUE", value: 4, img: "Boardwalk"},
  {name: "Reading Railroad", color: "RAILROAD", value: 2, img: "ReadingRailroad"},
  {name: "Pennsylvania Railroad", color: "RAILROAD", value: 2, img: "PennsylvaniaRailroad"},
  {name: "B. & O. Railroad", color: "RAILROAD", value: 2, img: "B__O_Railroad"},
  {name: "Short Line", color: "RAILROAD", value: 2, img: "ShortLine"},
  {name: "Electric Company", color: "UTILITY", value: 2, img: "ElectricCompany"},
  {name: "Water Works", color: "UTILITY", value: 2, img: "WaterWorks"}
];

const WILDCARDS = [
  {colors: ["DARK_BLUE", "GREEN"], value: 4},
  {colors: ["GREEN", "RAILROAD"], value: 4},
  {colors: ["LIGHT_BLUE", "BROWN"], value: 1},
  {colors: ["LIGHT_BLUE", "RAILROAD"], value: 4},
  {colors: ["ORANGE", "PINK"], value: 2},
  {colors: ["ORANGE", "PINK"], value: 2},
  {colors: ["RAILROAD", "UTILITY"], value: 2},
  {colors: ["RAILROAD", "UTILITY"], value: 2},
  {colors: ["RED", "YELLOW"], value: 3},
  {colors: ["RED", "YELLOW"], value: 3},
  {colors: ["ALL"], value: 0},
  {colors: ["ALL"], value: 0}
];

const MONEY = [
  {value: 10, count: 1},
  {value: 5, count: 2},
  {value: 4, count: 3},
  {value: 3, count: 3},
  {value: 2, count: 5},
  {value: 1, count: 6}
];

const RENTS = [
  {colors: ["DARK_BLUE", "GREEN"], value: 1, count: 2},
  {colors: ["RED", "YELLOW"], value: 1, count: 2},
  {colors: ["PINK", "ORANGE"], value: 1, count: 2},
  {colors: ["LIGHT_BLUE", "BROWN"], value: 1, count: 2},
  {colors: ["RAILROAD", "UTILITY"], value: 1, count: 2},
  {colors: ["ALL"], value: 3, count: 3}
];

const ACTIONS = [
  {name: "Pass Go", type: "PASS_GO", value: 1, count: 10},
  {name: "It's My Birthday", type: "BIRTHDAY", value: 2, count: 3},
  {name: "Debt Collector", type: "DEBT_COLLECTOR", value: 3, count: 3},
  {name: "Sly Deal", type: "SLY_DEAL", value: 3, count: 3},
  {name: "Forced Deal", type: "FORCED_DEAL", value: 3, count: 4},
  {name: "Deal Breaker", type: "DEAL_BREAKER", value: 5, count: 2},
  {name: "Just Say No", type: "JUST_SAY_NO", value: 4, count: 3},
  {name: "House", type: "HOUSE", value: 3, count: 3},
  {name: "Hotel", type: "HOTEL", value: 4, count: 2},
  {name: "Double The Rent", type: "DOUBLE_RENT", value: 1, count: 2}
];

function createDeck() {
  const deck = [];
  
  PROPERTIES.forEach(p => {
    deck.push({ type: "PROPERTY", name: p.name, color: p.color, value: p.value, img: p.img });
  });
  
  WILDCARDS.forEach(w => {
    deck.push({ type: "WILDCARD", colors: w.colors, value: w.value, currentColor: w.colors[0] });
  });
  
  MONEY.forEach(m => {
    for (let i = 0; i < m.count; i++) {
      deck.push({ type: "MONEY", value: m.value });
    }
  });
  
  RENTS.forEach(r => {
    for (let i = 0; i < r.count; i++) {
      deck.push({ type: "RENT", colors: r.colors, value: r.value });
    }
  });
  
  ACTIONS.forEach(a => {
    for (let i = 0; i < a.count; i++) {
      deck.push({ type: "ACTION", name: a.name, actionType: a.type, value: a.value });
    }
  });
  
  return shuffle(deck);
}

function shuffle(array) {
  for (let pass = 0; pass < 4; pass++) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
  return array;
}

function getRentValue(color, count, hasHouse, hasHotel) {
  const colorInfo = COLORS[color];
  if (!colorInfo) return 0;
  const idx = Math.min(count, colorInfo.rents.length) - 1;
  let rent = idx >= 0 ? colorInfo.rents[idx] : 0;
  if (hasHouse) rent += 3;
  if (hasHotel) rent += 4;
  return rent;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createRoom(hostWs, hostName) {
  let code;
  do {
    code = generateRoomCode();
  } while (rooms.has(code));
  
  const room = {
    code,
    state: 'lobby',
    players: new Map(),
    playerOrder: [],
    currentPlayerIndex: 0,
    deck: [],
    discard: [],
    cardsPlayedThisTurn: 0,
    pendingAction: null,
    lastPlayedCard: null,
    lastPlayedBy: null,
    lastPlayedType: null,
    winner: null,
    actionLog: []
  };
  
  const playerId = generatePlayerId();
  const isTVHost = hostName === 'TV-Host';
  room.players.set(playerId, {
    id: playerId,
    name: hostName,
    ws: hostWs,
    ready: isTVHost, // TV-Host auto-readies
    hand: [],
    bank: [],
    properties: {},
    pendingWildcards: null,
    isHost: true,
    isTVHost: isTVHost
  });
  room.playerOrder.push(playerId);
  
  hostWs.playerId = playerId;
  hostWs.roomCode = code;
  
  rooms.set(code, room);
  return { code, playerId };
}

function generatePlayerId() {
  return 'p_' + Math.random().toString(36).substr(2, 9);
}

function joinRoom(code, ws, playerName) {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: 'Room not found' };
  if (room.state !== 'lobby') return { error: 'Game already started' };
  if (room.players.size >= 5) return { error: 'Room is full' };
  
  const playerId = generatePlayerId();
  room.players.set(playerId, {
    id: playerId,
    name: playerName,
    ws: ws,
    ready: false,
    hand: [],
    bank: [],
    properties: {},
    pendingWildcards: null,
    isHost: false
  });
  room.playerOrder.push(playerId);
  
  ws.playerId = playerId;
  ws.roomCode = code.toUpperCase();
  
  return { playerId, code: room.code };
}

function startGame(room) {
  // Count real players (non-TV-Host)
  let realPlayerCount = 0;
  let allReady = true;
  room.players.forEach(p => { 
    if (!p.isTVHost) {
      realPlayerCount++;
      if (!p.ready) allReady = false;
    }
  });
  
  if (realPlayerCount < 2) return false;
  if (!allReady) return false;
  
  room.state = 'playing';
  room.deck = createDeck();
  room.discard = [];
  room.cardsPlayedThisTurn = 0;
  room.pendingAction = null;
  room.winner = null;
  room.actionLog = [];
  
  // Randomize player order (keeping TV-Host at the end if present)
  const realPlayers = room.playerOrder.filter(pid => !room.players.get(pid).isTVHost);
  const tvHost = room.playerOrder.filter(pid => room.players.get(pid).isTVHost);
  shuffle(realPlayers);
  room.playerOrder = [...realPlayers, ...tvHost];
  
  // First player is always index 0 now (first real player after shuffle)
  room.currentPlayerIndex = 0;
  
  // Deal 5 cards to each real player
  room.players.forEach(player => {
    player.hand = [];
    player.bank = [];
    player.properties = {};
    player.pendingWildcards = null;
    if (!player.isTVHost) {
      for (let i = 0; i < 5; i++) {
        if (room.deck.length > 0) {
          player.hand.push(room.deck.pop());
        }
      }
    }
  });
  
  // Draw 2 for first player
  const firstPlayer = room.players.get(room.playerOrder[room.currentPlayerIndex]);
  for (let i = 0; i < 2; i++) {
    if (room.deck.length > 0) {
      firstPlayer.hand.push(room.deck.pop());
    }
  }
  
  log(room, 'GAME_START', { players: realPlayerCount });
  log(room, 'TURN', { name: firstPlayer.name });
  
  return true;
}

function log(room, type, data) {
  let msg = '';
  switch(type) {
    case 'GAME_START': msg = `Game started with ${data.players} players`; break;
    case 'TURN': msg = `${data.name}'s turn`; break;
    case 'DRAW': msg = `${data.name} drew ${data.count} cards`; break;
    case 'PROPERTY': msg = `${data.name} played ${data.color} property`; break;
    case 'BANK': msg = `${data.name} banked $${data.amount}M`; break;
    case 'RENT': msg = `${data.name} charged $${data.amount}M rent`; break;
    case 'PAYMENT': msg = `${data.from} paid ${data.to} $${data.amount}M`; break;
    case 'ACTION': msg = `${data.name}: ${data.action}`; break;
    case 'DISCARD': msg = `${data.name} discarded ${data.card}`; break;
    default: msg = type;
  }
  room.actionLog.push(msg);
  if (room.actionLog.length > 20) room.actionLog.shift();
}

function getCurrentPlayer(room) {
  return room.players.get(room.playerOrder[room.currentPlayerIndex]);
}

function checkSetCompletion(props, color) {
  if (!props || !COLORS[color]) return;
  const setSize = COLORS[color].setSize;
  if (props.cards.length < setSize) {
    props.house = false;
    props.hotel = false;
  }
}

function playCard(room, playerId, cardIndex, playType, targetData) {
  if (room.pendingAction) return { error: 'Waiting for action response' };
  
  const current = getCurrentPlayer(room);
  if (!current || current.id !== playerId) return { error: 'Not your turn' };
  
  if (current.pendingWildcards && current.pendingWildcards.length > 0) {
    return { error: 'Must place received wildcards first' };
  }
  
  if (room.cardsPlayedThisTurn >= 3) return { error: 'Already played 3 cards' };
  
  const card = current.hand[cardIndex - 1];
  if (!card) return { error: 'Invalid card' };
  
  // Store for last played display
  const cardCopy = { ...card };
  
  if (playType === 'bank') {
    if (!card.value || card.value <= 0) return { error: 'Card has no value' };
    current.hand.splice(cardIndex - 1, 1);
    current.bank.push(card);
    room.cardsPlayedThisTurn++;
    room.lastPlayedCard = cardCopy;
    room.lastPlayedBy = current.name;
    room.lastPlayedType = 'bank';
    log(room, 'BANK', { name: current.name, amount: card.value });
    checkWin(room);
    return { success: true };
  }
  
  if (playType === 'property') {
    if (card.type !== 'PROPERTY' && card.type !== 'WILDCARD') {
      return { error: 'Not a property card' };
    }
    
    current.hand.splice(cardIndex - 1, 1);
    
    let color;
    if (card.type === 'PROPERTY') {
      color = card.color;
    } else {
      color = targetData?.color || card.colors[0];
      if (card.colors[0] !== 'ALL' && !card.colors.includes(color)) {
        current.hand.splice(cardIndex - 1, 0, card);
        return { error: 'Invalid color for wildcard' };
      }
      card.currentColor = color;
    }
    
    if (!current.properties[color]) {
      current.properties[color] = { cards: [], house: false, hotel: false };
    }
    current.properties[color].cards.push(card);
    
    room.cardsPlayedThisTurn++;
    room.lastPlayedCard = cardCopy;
    room.lastPlayedBy = current.name;
    room.lastPlayedType = 'property';
    log(room, 'PROPERTY', { name: current.name, color });
    checkWin(room);
    return { success: true };
  }
  
  if (playType === 'action') {
    current.hand.splice(cardIndex - 1, 1);
    
    const result = executeAction(room, current, card, cardIndex, targetData);
    if (result.error) {
      current.hand.splice(cardIndex - 1, 0, card);
      return result;
    }
    
    room.cardsPlayedThisTurn++;
    room.lastPlayedCard = cardCopy;
    room.lastPlayedBy = current.name;
    room.lastPlayedType = 'action';
    checkWin(room);
    return { success: true };
  }
  
  return { error: 'Invalid play type' };
}

function executeAction(room, player, card, cardIndex, targetData) {
  if (card.type === 'RENT') {
    return executeRent(room, player, card, cardIndex, targetData);
  }
  
  if (card.type !== 'ACTION') return { error: 'Not an action card' };
  
  switch (card.actionType) {
    case 'PASS_GO':
      for (let i = 0; i < 2 && room.deck.length > 0; i++) {
        player.hand.push(room.deck.pop());
      }
      room.discard.push(card);
      log(room, 'ACTION', { name: player.name, action: 'Pass Go' });
      return { success: true };
      
    case 'BIRTHDAY':
      const bdayTargets = room.playerOrder.filter(pid => {
        const p = room.players.get(pid);
        return pid !== player.id && !p.isTVHost;
      });
      room.pendingAction = {
        type: 'BIRTHDAY',
        from: player.id,
        card,
        amount: 2,
        remaining: [...bdayTargets]
      };
      log(room, 'ACTION', { name: player.name, action: "It's My Birthday!" });
      return { success: true };
      
    case 'DEBT_COLLECTOR':
      if (!targetData?.targetId) return { error: 'Must select target' };
      room.pendingAction = {
        type: 'DEBT',
        from: player.id,
        card,
        amount: 5,
        remaining: [targetData.targetId]
      };
      log(room, 'ACTION', { name: player.name, action: 'Debt Collector' });
      return { success: true };
      
    case 'SLY_DEAL':
      return executeSlyDeal(room, player, card, targetData);
      
    case 'FORCED_DEAL':
      return executeForcedDeal(room, player, card, targetData);
      
    case 'DEAL_BREAKER':
      return executeDealBreaker(room, player, card, targetData);
      
    case 'HOUSE':
      return executeHouse(room, player, card, targetData);
      
    case 'HOTEL':
      return executeHotel(room, player, card, targetData);
      
    case 'JUST_SAY_NO':
      return { error: 'Use Just Say No in response to actions' };
      
    case 'DOUBLE_RENT':
      return { error: 'Use Double Rent with a Rent card' };
      
    default:
      room.discard.push(card);
      return { success: true };
  }
}

function executeRent(room, player, card, cardIndex, targetData) {
  const color = targetData?.color;
  if (!color) return { error: 'Must specify color' };
  
  if (card.colors[0] !== 'ALL' && !card.colors.includes(color)) {
    return { error: "Rent card doesn't match that color" };
  }
  
  const props = player.properties[color];
  if (!props || props.cards.length === 0) {
    return { error: 'No properties of that color' };
  }
  
  let rent = getRentValue(color, props.cards.length, props.house, props.hotel);
  
  let targetPlayers = [];
  if (card.colors[0] === 'ALL') {
    if (!targetData?.targetId) return { error: 'Wild rent requires target' };
    targetPlayers = [targetData.targetId];
  } else {
    targetPlayers = room.playerOrder.filter(pid => {
      const p = room.players.get(pid);
      return pid !== player.id && !p.isTVHost;
    });
  }
  
  // Handle double rent
  if (targetData?.doubleRentIndex) {
    let adjustedIndex = targetData.doubleRentIndex;
    if (targetData.doubleRentIndex > cardIndex) {
      adjustedIndex = adjustedIndex - 1;
    }
    const doubleCard = player.hand[adjustedIndex - 1];
    if (doubleCard && doubleCard.actionType === 'DOUBLE_RENT') {
      player.hand.splice(adjustedIndex - 1, 1);
      room.discard.push(doubleCard);
      rent = rent * 2;
      room.cardsPlayedThisTurn++;
    }
  }
  
  room.pendingAction = {
    type: 'RENT',
    from: player.id,
    card,
    amount: rent,
    color,
    remaining: [...targetPlayers]
  };
  
  log(room, 'RENT', { name: player.name, color, amount: rent });
  return { success: true };
}

function executeSlyDeal(room, player, card, targetData) {
  if (!targetData?.targetId || !targetData?.color) {
    return { error: 'Must select target and color' };
  }
  
  const target = room.players.get(targetData.targetId);
  if (!target) return { error: 'Invalid target' };
  
  const props = target.properties[targetData.color];
  if (!props || props.cards.length === 0) {
    return { error: 'Target has no properties of that color' };
  }
  
  // Can't steal from complete set
  const setSize = COLORS[targetData.color]?.setSize || 3;
  if (props.cards.length >= setSize) {
    return { error: "Can't steal from complete set" };
  }
  
  room.pendingAction = {
    type: 'SLY_DEAL',
    from: player.id,
    card,
    targetId: targetData.targetId,
    color: targetData.color,
    cardIndex: targetData.cardIndex || 1,
    remaining: [targetData.targetId]
  };
  
  log(room, 'ACTION', { name: player.name, action: 'Sly Deal' });
  return { success: true };
}

function executeForcedDeal(room, player, card, targetData) {
  if (!targetData?.targetId || !targetData?.theirColor || !targetData?.yourColor) {
    return { error: 'Must select all trade details' };
  }
  
  const target = room.players.get(targetData.targetId);
  if (!target) return { error: 'Invalid target' };
  
  const theirProps = target.properties[targetData.theirColor];
  if (!theirProps || theirProps.cards.length === 0) {
    return { error: 'Target has no properties of that color' };
  }
  
  const setSize = COLORS[targetData.theirColor]?.setSize || 3;
  if (theirProps.cards.length >= setSize) {
    return { error: "Can't steal from complete set" };
  }
  
  const yourProps = player.properties[targetData.yourColor];
  if (!yourProps || yourProps.cards.length === 0) {
    return { error: 'You have no properties of that color' };
  }
  
  room.pendingAction = {
    type: 'FORCED_DEAL',
    from: player.id,
    card,
    targetId: targetData.targetId,
    theirColor: targetData.theirColor,
    yourColor: targetData.yourColor,
    remaining: [targetData.targetId]
  };
  
  log(room, 'ACTION', { name: player.name, action: 'Forced Deal' });
  return { success: true };
}

function executeDealBreaker(room, player, card, targetData) {
  if (!targetData?.targetId || !targetData?.color) {
    return { error: 'Must select target and color' };
  }
  
  const target = room.players.get(targetData.targetId);
  if (!target) return { error: 'Invalid target' };
  
  const props = target.properties[targetData.color];
  if (!props) return { error: 'Target has no properties of that color' };
  
  const setSize = COLORS[targetData.color]?.setSize || 3;
  if (props.cards.length < setSize) {
    return { error: 'Not a complete set' };
  }
  
  room.pendingAction = {
    type: 'DEAL_BREAKER',
    from: player.id,
    card,
    targetId: targetData.targetId,
    color: targetData.color,
    remaining: [targetData.targetId]
  };
  
  log(room, 'ACTION', { name: player.name, action: 'Deal Breaker' });
  return { success: true };
}

function executeHouse(room, player, card, targetData) {
  if (!targetData?.color) return { error: 'Must select color' };
  
  const props = player.properties[targetData.color];
  if (!props) return { error: 'No properties of that color' };
  
  const setSize = COLORS[targetData.color]?.setSize || 3;
  if (props.cards.length < setSize) {
    return { error: 'Set not complete' };
  }
  
  if (props.house) return { error: 'Already has house' };
  if (targetData.color === 'RAILROAD' || targetData.color === 'UTILITY') {
    return { error: "Can't add house to Railroad/Utility" };
  }
  
  props.house = true;
  room.discard.push(card);
  log(room, 'ACTION', { name: player.name, action: 'House on ' + targetData.color });
  return { success: true };
}

function executeHotel(room, player, card, targetData) {
  if (!targetData?.color) return { error: 'Must select color' };
  
  const props = player.properties[targetData.color];
  if (!props) return { error: 'No properties of that color' };
  
  const setSize = COLORS[targetData.color]?.setSize || 3;
  if (props.cards.length < setSize) {
    return { error: 'Set not complete' };
  }
  
  if (!props.house) return { error: 'Must have house first' };
  if (props.hotel) return { error: 'Already has hotel' };
  
  props.hotel = true;
  room.discard.push(card);
  log(room, 'ACTION', { name: player.name, action: 'Hotel on ' + targetData.color });
  return { success: true };
}

function makePayment(room, playerId, payment) {
  if (!room.pendingAction) return { error: 'No pending action' };
  
  const idx = room.pendingAction.remaining.indexOf(playerId);
  if (idx === -1) return { error: 'Not waiting for your payment' };
  
  const player = room.players.get(playerId);
  const recipient = room.players.get(room.pendingAction.from);
  const owed = room.pendingAction.amount;
  
  // Calculate totals
  let totalBank = player.bank.reduce((sum, c) => sum + (c.value || 0), 0);
  let totalProps = 0;
  for (const color in player.properties) {
    player.properties[color].cards.forEach(c => totalProps += (c.value || 0));
  }
  const totalAvailable = totalBank + totalProps;
  
  let offering = 0;
  if (payment.bankIndices) {
    payment.bankIndices.forEach(i => {
      const c = player.bank[i - 1];
      if (c) offering += (c.value || 0);
    });
  }
  if (payment.propertyData) {
    payment.propertyData.forEach(p => {
      const props = player.properties[p.color];
      if (props && props.cards[p.index - 1]) {
        offering += (props.cards[p.index - 1].value || 0);
      }
    });
  }
  
  if (totalAvailable >= owed && offering < owed) {
    return { error: 'Must pay full amount' };
  }
  
  // Remove from remaining first
  room.pendingAction.remaining.splice(idx, 1);
  
  // Process bank payment
  const receivedWildcards = [];
  if (payment.bankIndices) {
    payment.bankIndices.sort((a, b) => b - a);
    payment.bankIndices.forEach(i => {
      const card = player.bank.splice(i - 1, 1)[0];
      if (card) recipient.bank.push(card);
    });
  }
  
  // Process property payment
  if (payment.propertyData) {
    payment.propertyData.sort((a, b) => {
      if (a.color === b.color) return b.index - a.index;
      return a.color > b.color ? -1 : 1;
    });
    
    payment.propertyData.forEach(p => {
      const props = player.properties[p.color];
      if (props && props.cards[p.index - 1]) {
        const card = props.cards.splice(p.index - 1, 1)[0];
        
        if (card.type === 'WILDCARD' && card.colors[0] !== 'ALL') {
          receivedWildcards.push(card);
        } else {
          const targetColor = card.currentColor || p.color;
          if (!recipient.properties[targetColor]) {
            recipient.properties[targetColor] = { cards: [], house: false, hotel: false };
          }
          recipient.properties[targetColor].cards.push(card);
        }
        
        checkSetCompletion(props, p.color);
        if (props.cards.length === 0) {
          delete player.properties[p.color];
        }
      }
    });
  }
  
  log(room, 'PAYMENT', { from: player.name, to: recipient.name, amount: offering });
  
  // Handle received wildcards
  if (receivedWildcards.length > 0) {
    if (!recipient.pendingWildcards) recipient.pendingWildcards = [];
    receivedWildcards.forEach(wc => recipient.pendingWildcards.push(wc));
  }
  
  // Check if all payments done
  if (room.pendingAction.remaining.length === 0) {
    room.discard.push(room.pendingAction.card);
    room.pendingAction = null;
  }
  
  return { success: true };
}

function respondToAction(room, playerId, response, cardIndex) {
  if (!room.pendingAction) return { error: 'No pending action' };
  
  if (response === 'JUST_SAY_NO') {
    const player = room.players.get(playerId);
    const card = player.hand[cardIndex - 1];
    if (!card || card.actionType !== 'JUST_SAY_NO') {
      return { error: 'Invalid Just Say No card' };
    }
    
    player.hand.splice(cardIndex - 1, 1);
    room.discard.push(card);
    
    // For payment actions, remove player from remaining
    const idx = room.pendingAction.remaining.indexOf(playerId);
    if (idx !== -1) {
      room.pendingAction.remaining.splice(idx, 1);
    }
    
    log(room, 'ACTION', { name: player.name, action: 'Just Say No!' });
    
    if (room.pendingAction.remaining.length === 0) {
      room.discard.push(room.pendingAction.card);
      room.pendingAction = null;
    }
    
    return { success: true };
  }
  
  if (response === 'ACCEPT') {
    // Execute the steal action
    const actionType = room.pendingAction.type;
    const from = room.players.get(room.pendingAction.from);
    const target = room.players.get(room.pendingAction.targetId);
    
    if (actionType === 'SLY_DEAL') {
      const props = target.properties[room.pendingAction.color];
      if (props && props.cards.length > 0) {
        const cardIdx = (room.pendingAction.cardIndex || 1) - 1;
        const card = props.cards.splice(cardIdx, 1)[0];
        
        const targetColor = card.currentColor || room.pendingAction.color;
        if (!from.properties[targetColor]) {
          from.properties[targetColor] = { cards: [], house: false, hotel: false };
        }
        from.properties[targetColor].cards.push(card);
        
        checkSetCompletion(props, room.pendingAction.color);
        if (props.cards.length === 0) {
          delete target.properties[room.pendingAction.color];
        }
      }
    }
    
    if (actionType === 'FORCED_DEAL') {
      const theirProps = target.properties[room.pendingAction.theirColor];
      const yourProps = from.properties[room.pendingAction.yourColor];
      
      if (theirProps && theirProps.cards.length > 0 && yourProps && yourProps.cards.length > 0) {
        const theirCard = theirProps.cards.pop();
        const yourCard = yourProps.cards.pop();
        
        const theirTargetColor = theirCard.currentColor || room.pendingAction.theirColor;
        if (!from.properties[theirTargetColor]) {
          from.properties[theirTargetColor] = { cards: [], house: false, hotel: false };
        }
        from.properties[theirTargetColor].cards.push(theirCard);
        
        const yourTargetColor = yourCard.currentColor || room.pendingAction.yourColor;
        if (!target.properties[yourTargetColor]) {
          target.properties[yourTargetColor] = { cards: [], house: false, hotel: false };
        }
        target.properties[yourTargetColor].cards.push(yourCard);
        
        checkSetCompletion(theirProps, room.pendingAction.theirColor);
        checkSetCompletion(yourProps, room.pendingAction.yourColor);
        
        if (theirProps.cards.length === 0) delete target.properties[room.pendingAction.theirColor];
        if (yourProps.cards.length === 0) delete from.properties[room.pendingAction.yourColor];
      }
    }
    
    if (actionType === 'DEAL_BREAKER') {
      const props = target.properties[room.pendingAction.color];
      if (props) {
        if (!from.properties[room.pendingAction.color]) {
          from.properties[room.pendingAction.color] = { cards: [], house: false, hotel: false };
        }
        from.properties[room.pendingAction.color].cards.push(...props.cards);
        from.properties[room.pendingAction.color].house = props.house;
        from.properties[room.pendingAction.color].hotel = props.hotel;
        delete target.properties[room.pendingAction.color];
      }
    }
    
    room.pendingAction.remaining = [];
    room.discard.push(room.pendingAction.card);
    room.pendingAction = null;
    
    return { success: true };
  }
  
  return { error: 'Invalid response' };
}

function placeWildcard(room, playerId, wildcardIndex, chosenColor) {
  const player = room.players.get(playerId);
  if (!player || !player.pendingWildcards) return { error: 'No pending wildcards' };
  
  const card = player.pendingWildcards[wildcardIndex];
  if (!card) return { error: 'Invalid wildcard' };
  
  if (card.colors[0] !== 'ALL' && !card.colors.includes(chosenColor)) {
    return { error: 'Invalid color for wildcard' };
  }
  
  card.currentColor = chosenColor;
  card.locked = true;
  
  if (!player.properties[chosenColor]) {
    player.properties[chosenColor] = { cards: [], house: false, hotel: false };
  }
  player.properties[chosenColor].cards.push(card);
  
  player.pendingWildcards.splice(wildcardIndex, 1);
  if (player.pendingWildcards.length === 0) {
    player.pendingWildcards = null;
  }
  
  return { success: true };
}

function moveWildcard(room, playerId, fromColor, cardIndex, toColor) {
  const player = room.players.get(playerId);
  if (!player) return { error: 'Invalid player' };
  
  const current = getCurrentPlayer(room);
  if (!current || current.id !== playerId) return { error: 'Not your turn' };
  
  if (player.pendingWildcards && player.pendingWildcards.length > 0) {
    return { error: 'Must place received wildcards first' };
  }
  
  const fromProps = player.properties[fromColor];
  if (!fromProps) return { error: 'No properties of that color' };
  
  const card = fromProps.cards[cardIndex - 1];
  if (!card || card.type !== 'WILDCARD') return { error: 'Not a wildcard' };
  if (card.locked) return { error: 'Wildcard is locked' };
  
  if (card.colors[0] !== 'ALL' && !card.colors.includes(toColor)) {
    return { error: 'Invalid color for wildcard' };
  }
  
  fromProps.cards.splice(cardIndex - 1, 1);
  checkSetCompletion(fromProps, fromColor);
  if (fromProps.cards.length === 0) {
    delete player.properties[fromColor];
  }
  
  if (!player.properties[toColor]) {
    player.properties[toColor] = { cards: [], house: false, hotel: false };
  }
  card.currentColor = toColor;
  player.properties[toColor].cards.push(card);
  
  return { success: true };
}

function endTurn(room, playerId) {
  const current = getCurrentPlayer(room);
  if (!current || current.id !== playerId) return { error: 'Not your turn' };
  if (room.pendingAction) return { error: 'Resolve pending action first' };
  if (current.pendingWildcards && current.pendingWildcards.length > 0) {
    return { error: 'Must place received wildcards first' };
  }
  
  // Discard down to 7
  while (current.hand.length > 7) {
    const idx = Math.floor(Math.random() * current.hand.length);
    const card = current.hand.splice(idx, 1)[0];
    room.discard.push(card);
    room.lastPlayedCard = card;
    room.lastPlayedBy = current.name;
    room.lastPlayedType = 'discarded';
    log(room, 'DISCARD', { name: current.name, card: card.name || card.type });
  }
  
  // Next player - skip TV-Host
  let nextIndex = (room.currentPlayerIndex + 1) % room.playerOrder.length;
  let attempts = 0;
  while (attempts < room.playerOrder.length) {
    const nextP = room.players.get(room.playerOrder[nextIndex]);
    if (!nextP.isTVHost) break;
    nextIndex = (nextIndex + 1) % room.playerOrder.length;
    attempts++;
  }
  room.currentPlayerIndex = nextIndex;
  room.cardsPlayedThisTurn = 0;
  
  // Draw 2
  const nextPlayer = getCurrentPlayer(room);
  if (nextPlayer.hand.length === 0) {
    // Draw 5 if empty hand
    for (let i = 0; i < 5 && room.deck.length > 0; i++) {
      nextPlayer.hand.push(room.deck.pop());
    }
    log(room, 'DRAW', { name: nextPlayer.name, count: 5 });
  } else {
    for (let i = 0; i < 2 && room.deck.length > 0; i++) {
      nextPlayer.hand.push(room.deck.pop());
    }
    log(room, 'DRAW', { name: nextPlayer.name, count: 2 });
  }
  
  log(room, 'TURN', { name: nextPlayer.name });
  
  // Check deck empty
  if (room.deck.length === 0 && room.discard.length > 0) {
    room.deck = shuffle([...room.discard]);
    room.discard = [];
  }
  
  return { success: true };
}

function checkWin(room) {
  const current = getCurrentPlayer(room);
  if (!current) return false;
  
  let completeSets = 0;
  for (const color in current.properties) {
    const setSize = COLORS[color]?.setSize || 3;
    if (current.properties[color].cards.length >= setSize) {
      completeSets++;
    }
  }
  
  if (completeSets >= 3) {
    room.state = 'gameover';
    room.winner = current.name;
    return true;
  }
  return false;
}

function getPublicState(room) {
  const players = {};
  room.players.forEach((p, pid) => {
    let completeSets = 0;
    for (const color in p.properties) {
      const setSize = COLORS[color]?.setSize || 3;
      if (p.properties[color].cards.length >= setSize) {
        completeSets++;
      }
    }
    
    const props = {};
    for (const color in p.properties) {
      const cardInfos = p.properties[color].cards.map((c, i) => ({
        index: i + 1,
        type: c.type,
        name: c.name || (c.type === 'WILDCARD' ? 'Wild' : color),
        isWild: c.type === 'WILDCARD',
        value: c.value,
        img: c.img,
        colors: c.colors,
        currentColor: c.currentColor
      }));
      props[color] = {
        count: p.properties[color].cards.length,
        house: p.properties[color].house,
        hotel: p.properties[color].hotel,
        complete: p.properties[color].cards.length >= (COLORS[color]?.setSize || 3),
        cards: cardInfos
      };
    }
    
    players[pid] = {
      name: p.name,
      handCount: p.hand.length,
      bankValue: p.bank.reduce((sum, c) => sum + (c.value || 0), 0),
      properties: props,
      completeSets,
      ready: p.ready,
      isHost: p.isHost
    };
  });
  
  const current = getCurrentPlayer(room);
  
  return {
    state: room.state,
    players,
    playerOrder: room.playerOrder,
    currentPlayer: current?.id,
    currentPlayerName: current?.name || '',
    cardsPlayed: room.cardsPlayedThisTurn,
    deckCount: room.deck.length,
    pendingAction: room.pendingAction ? {
      type: room.pendingAction.type,
      from: room.pendingAction.from,
      amount: room.pendingAction.amount,
      remaining: room.pendingAction.remaining
    } : null,
    winner: room.winner,
    actionLog: room.actionLog,
    lastPlayedCard: room.lastPlayedCard,
    lastPlayedBy: room.lastPlayedBy,
    lastPlayedType: room.lastPlayedType
  };
}

function getPrivateState(room, playerId) {
  const player = room.players.get(playerId);
  if (!player) return null;
  
  const current = getCurrentPlayer(room);
  const isCurrentPlayer = current && current.id === playerId;
  
  let needsPayment = false;
  let paymentAmount = 0;
  let needsStealResponse = false;
  let stealActionType = null;
  
  if (room.pendingAction && room.pendingAction.remaining) {
    if (room.pendingAction.remaining.includes(playerId)) {
      const actionType = room.pendingAction.type;
      if (['RENT', 'BIRTHDAY', 'DEBT'].includes(actionType)) {
        needsPayment = true;
        paymentAmount = room.pendingAction.amount;
      } else if (['SLY_DEAL', 'FORCED_DEAL', 'DEAL_BREAKER'].includes(actionType)) {
        needsStealResponse = true;
        stealActionType = actionType;
      }
    }
  }
  
  const myProperties = {};
  for (const color in player.properties) {
    myProperties[color] = {
      cards: player.properties[color].cards,
      house: player.properties[color].house,
      hotel: player.properties[color].hotel
    };
  }
  
  return {
    hand: player.hand,
    bank: player.bank,
    properties: myProperties,
    isCurrentPlayer,
    canPlay: isCurrentPlayer && room.cardsPlayedThisTurn < 3 && !room.pendingAction,
    needsPayment,
    paymentAmount,
    needsStealResponse,
    stealActionType,
    pendingWildcards: player.pendingWildcards
  };
}

function broadcastRoom(room) {
  const publicState = getPublicState(room);
  
  room.players.forEach((player, pid) => {
    if (player.ws && player.ws.readyState === WebSocket.OPEN) {
      const privateState = getPrivateState(room, pid);
      player.ws.send(JSON.stringify({
        type: 'state',
        public: publicState,
        private: privateState,
        playerId: pid,
        roomCode: room.code
      }));
    }
  });
  
  // Broadcast to spectators
  if (room.spectators) {
    room.spectators.forEach(ws => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'state',
          public: publicState
        }));
      }
    });
  }
}

function resetGame(room) {
  room.state = 'lobby';
  room.deck = [];
  room.discard = [];
  room.currentPlayerIndex = 0;
  room.cardsPlayedThisTurn = 0;
  room.pendingAction = null;
  room.lastPlayedCard = null;
  room.lastPlayedBy = null;
  room.winner = null;
  room.actionLog = [];
  
  room.players.forEach(p => {
    p.ready = false;
    p.hand = [];
    p.bank = [];
    p.properties = {};
    p.pendingWildcards = null;
  });
}

// WebSocket handling
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'create': {
          const result = createRoom(ws, data.name || 'Host');
          ws.send(JSON.stringify({ type: 'created', ...result }));
          const room = rooms.get(result.code);
          broadcastRoom(room);
          break;
        }
        
        case 'join': {
          const result = joinRoom(data.code, ws, data.name || 'Player');
          if (result.error) {
            ws.send(JSON.stringify({ type: 'error', message: result.error }));
          } else {
            ws.send(JSON.stringify({ type: 'joined', ...result }));
            const room = rooms.get(result.code);
            broadcastRoom(room);
          }
          break;
        }
        
        case 'spectate': {
          const room = rooms.get(data.code?.toUpperCase());
          if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
          } else {
            if (!room.spectators) room.spectators = [];
            room.spectators.push(ws);
            ws.isSpectator = true;
            ws.roomCode = room.code;
            ws.send(JSON.stringify({ type: 'spectating', code: room.code }));
            // Send current state immediately
            ws.send(JSON.stringify({ type: 'state', public: getPublicState(room) }));
          }
          break;
        }
        
        case 'ready': {
          const room = rooms.get(ws.roomCode);
          if (room) {
            const player = room.players.get(ws.playerId);
            if (player) {
              player.ready = !player.ready;
              broadcastRoom(room);
            }
          }
          break;
        }
        
        case 'start': {
          const room = rooms.get(ws.roomCode);
          if (room) {
            const player = room.players.get(ws.playerId);
            if (player?.isHost) {
              if (startGame(room)) {
                broadcastRoom(room);
              }
            }
          }
          break;
        }
        
        case 'playCard': {
          const room = rooms.get(ws.roomCode);
          if (room && room.state === 'playing') {
            const result = playCard(room, ws.playerId, data.cardIndex, data.playType, data.targetData);
            if (result.error) {
              ws.send(JSON.stringify({ type: 'error', message: result.error }));
            }
            broadcastRoom(room);
          }
          break;
        }
        
        case 'pay': {
          const room = rooms.get(ws.roomCode);
          if (room) {
            const result = makePayment(room, ws.playerId, data.payment);
            if (result.error) {
              ws.send(JSON.stringify({ type: 'error', message: result.error }));
            }
            broadcastRoom(room);
          }
          break;
        }
        
        case 'respond': {
          const room = rooms.get(ws.roomCode);
          if (room) {
            const result = respondToAction(room, ws.playerId, data.response, data.cardIndex);
            if (result.error) {
              ws.send(JSON.stringify({ type: 'error', message: result.error }));
            }
            broadcastRoom(room);
          }
          break;
        }
        
        case 'placeWild': {
          const room = rooms.get(ws.roomCode);
          if (room) {
            const result = placeWildcard(room, ws.playerId, data.index, data.color);
            if (result.error) {
              ws.send(JSON.stringify({ type: 'error', message: result.error }));
            }
            broadcastRoom(room);
          }
          break;
        }
        
        case 'moveWild': {
          const room = rooms.get(ws.roomCode);
          if (room) {
            const result = moveWildcard(room, ws.playerId, data.fromColor, data.cardIndex, data.toColor);
            if (result.error) {
              ws.send(JSON.stringify({ type: 'error', message: result.error }));
            }
            broadcastRoom(room);
          }
          break;
        }
        
        case 'endTurn': {
          const room = rooms.get(ws.roomCode);
          if (room) {
            const result = endTurn(room, ws.playerId);
            if (result.error) {
              ws.send(JSON.stringify({ type: 'error', message: result.error }));
            }
            broadcastRoom(room);
          }
          break;
        }
        
        case 'playAgain': {
          const room = rooms.get(ws.roomCode);
          if (room) {
            resetGame(room);
            broadcastRoom(room);
          }
          break;
        }
      }
    } catch (e) {
      console.error('Message error:', e);
    }
  });
  
  ws.on('close', () => {
    if (ws.roomCode) {
      const room = rooms.get(ws.roomCode);
      if (room) {
        // Handle spectator disconnect
        if (ws.isSpectator && room.spectators) {
          const idx = room.spectators.indexOf(ws);
          if (idx !== -1) room.spectators.splice(idx, 1);
        }
        // Handle player disconnect
        if (ws.playerId) {
          const player = room.players.get(ws.playerId);
          if (player) {
            player.ws = null;
          }
          broadcastRoom(room);
        }
      }
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Self-ping to prevent Render from sleeping (every 14 minutes)
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_URL) {
  setInterval(() => {
    fetch(`${RENDER_URL}/health`).catch(() => {});
  }, 14 * 60 * 1000); // 14 minutes
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Monopoly Deal server running on port ${PORT}`);
  if (RENDER_URL) {
    console.log(`Keep-alive enabled for: ${RENDER_URL}`);
  }
});
