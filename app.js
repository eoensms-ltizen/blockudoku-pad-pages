const COLORS = ["block"];
const COLOR_LABELS = {
  block: "Block",
  fire: "Flare",
  water: "Tide",
  wood: "Leaf",
  light: "Spark",
  dark: "Dusk",
};

const DEFAULT_SHAPES = [
  [[1]],
  [[1, 1]],
  [[1], [1]],
  [[1, 1, 1]],
  [[1], [1], [1]],
  [[1, 1, 1, 1]],
  [[1], [1], [1], [1]],
  [[1, 1, 1, 1, 1]],
  [[1], [1], [1], [1], [1]],
  [[1, 1], [1, 1]],
  [[1, 0], [1, 0], [1, 1]],
  [[0, 1], [0, 1], [1, 1]],
  [[1, 1, 1], [0, 1, 0]],
  [[0, 1, 0], [1, 1, 1]],
  [[1, 0], [1, 1], [1, 0]],
  [[0, 1], [1, 1], [0, 1]],
  [[1, 1, 0], [0, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
  [[1, 1, 1], [1, 0, 0]],
  [[1, 1, 1], [0, 0, 1]],
  [[1, 0, 1], [1, 1, 1]],
  [[1, 1, 1], [1, 0, 1]],
  [[1, 1], [1, 0], [1, 1]],
  [[1, 1], [0, 1], [1, 1]],
];

let SHAPES = DEFAULT_SHAPES.map((shape, index) => {
  shape.shapeName = `Shape ${index + 1}`;
  return shape;
});

const EMPTY_MONSTER = {
  name: "No Monster Configured",
  hp: 1,
  turns: 99,
  theme: ["#7fd0ff", "#1b2633"],
  sprites: [],
};
let ACTIVE_MONSTERS = [EMPTY_MONSTER];
const DEFAULT_PLAYER_SPRITES = {
  idle: {
    url: "assets/player/sprite_sheet_209x256.png",
    columns: 10,
    rows: 2,
    frames: 14,
    frameMs: 120,
    mode: "pingpong",
    frameWidth: 209,
    frameHeight: 256,
  },
  attack: {
    url: "assets/player/sprite_sheet_209x256_swing1.png",
    columns: 10,
    rows: 1,
    frames: 6,
    frameMs: 70,
    mode: "once",
    frameWidth: 209,
    frameHeight: 256,
  },
};
let PLAYER_SPRITES = { ...DEFAULT_PLAYER_SPRITES };

const state = {
  board: Array.from({ length: 9 }, () => Array(9).fill(null)),
  pieces: [],
  selectedPieceId: null,
  floor: 1,
  enemyIndex: 0,
  enemyHp: EMPTY_MONSTER.hp,
  enemyMaxHp: EMPTY_MONSTER.hp,
  playerHp: 1000,
  playerMaxHp: 1000,
  enemyTurn: EMPTY_MONSTER.turns,
  score: 0,
  lastDamage: 0,
  combo: 0,
  skills: { fire: 0, water: 0, wood: 0, light: 0, dark: 0 },
  gameOver: false,
  resolving: false,
  enemyChangedThisMove: false,
  enemyDeck: [],
};

const boardEl = document.querySelector("#board");
const trayEl = document.querySelector("#pieceTray");
const logEl = document.querySelector("#battleLog");
const enemyPanel = document.querySelector(".enemy-panel");
const enemyPortrait = document.querySelector(".enemy-portrait");
const enemySprite = document.querySelector("#enemySprite");
const playerSprite = document.querySelector("#playerSprite");
const enemyHpBar = document.querySelector("#enemyHpBar");
const playerHpBar = document.querySelector("#playerHpBar");
const enemyHpText = document.querySelector("#enemyHpText");
const enemyName = document.querySelector("#enemyName");
const floorText = document.querySelector("#floorText");
const playerHpText = document.querySelector("#playerHpText");
const turnText = document.querySelector("#turnText");
const scoreText = document.querySelector("#scoreText");
const damageText = document.querySelector("#damageText");
const comboBadge = document.querySelector("#comboBadge");
const newGameButton = document.querySelector("#newGameButton");
const viewToggleButton = document.querySelector("#viewToggleButton");
const mobileFloorText = document.querySelector("#mobileFloorText");
const mobileEnemyName = document.querySelector("#mobileEnemyName");
const mobileEnemyHpText = document.querySelector("#mobileEnemyHpText");
const mobilePlayerHpText = document.querySelector("#mobilePlayerHpText");
const mobileTurnText = document.querySelector("#mobileTurnText");
const mobileScoreText = document.querySelector("#mobileScoreText");

let dragSession = null;
let audioContext = null;
let playerIdleFrame = 0;
let playerMode = "idle";
let playerActionTimer = null;
let enemySpriteTimer = null;
let enemySpriteFrame = 0;
let enemySpriteDirection = 1;
let playerIdleDirection = 1;

const SOUND = {
  drag: [420, 0.035, "sine", 0.03],
  place: [520, 0.055, "triangle", 0.05],
  match: [760, 0.12, "sawtooth", 0.045],
  damage: [180, 0.16, "square", 0.04],
  skill: [980, 0.18, "triangle", 0.05],
  enemy: [120, 0.14, "sawtooth", 0.035],
};

const DEFAULT_SETTINGS = {
  generatorCandidates: 24,
  pathPlacementLimit: 6,
  pathNodeBudget: 140,
  easyPenalty: 180,
  rescueBonus: 260,
  largePieceSafeBonus: 32,
  largePieceDangerPenalty: 60,
  pokeDamage: 24,
  blockDamage: 18,
  comboDamage: 32,
  comboBonus: 4,
  scorePerBlock: 12,
  scorePerCombo: 100,
  noComboScore: 5,
  monsterKillScore: 500,
  enemyDamage: 135,
  floorHpGrowth: 160,
};

let balanceSettings = { ...DEFAULT_SETTINGS };

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffledIndices(length) {
  const items = Array.from({ length }, (_, index) => index);
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function drawMonsterIndex() {
  if (state.enemyDeck.length === 0) {
    state.enemyDeck = shuffledIndices(ACTIVE_MONSTERS.length);
    if (state.enemyDeck[0] === state.enemyIndex && state.enemyDeck.length > 1) {
      [state.enemyDeck[0], state.enemyDeck[1]] = [state.enemyDeck[1], state.enemyDeck[0]];
    }
  }
  return state.enemyDeck.shift();
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function playSound(name) {
  audioContext ||= new AudioContext();
  if (audioContext.state === "suspended") audioContext.resume();
  const [frequency, duration, type, gainValue] = SOUND[name];
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.55), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function getBoardCellSize() {
  return boardEl.querySelector(".cell")?.getBoundingClientRect().width || boardEl.getBoundingClientRect().width / 9;
}

function createPiece(id) {
  return { id, shape: randomItem(SHAPES), color: randomItem(COLORS), used: false };
}

function createPieceFromShape(id, shape) {
  return { id, shape, name: shape.shapeName || "Block", color: randomItem(COLORS), used: false };
}

function generatePieces() {
  const candidates = Array.from({ length: balanceSettings.generatorCandidates }, () => {
    const shapes = [randomItem(SHAPES), randomItem(SHAPES), randomItem(SHAPES)];
    return {
      shapes,
      score: scorePieceSet(shapes),
    };
  });

  candidates.sort((a, b) => b.score - a.score);
  const viable = candidates.filter((candidate) => candidate.score > -5000);
  const pool = viable.length > 0 ? viable.slice(0, Math.max(4, Math.ceil(viable.length * 0.25))) : candidates.slice(0, 8);
  return randomItem(pool).shapes.map((shape, index) => createPieceFromShape(index, shape));
}

function scorePieceSet(shapes) {
  const board = cloneBoard(state.board);
  const emptyCount = countEmpty(board);
  const danger = 1 - emptyCount / 81;
  const individualMoves = shapes.map((shape) => getPlacements(board, shape));
  const movableCount = individualMoves.filter((moves) => moves.length > 0).length;

  if (movableCount === 0) return -10000;

  const path = findBestPlacementPath(board, shapes);
  const immediateClears = individualMoves.reduce((total, moves) => total + moves.filter((move) => move.clearGroups > 0).length, 0);
  const averageMobility = individualMoves.reduce((total, moves) => total + Math.min(moves.length, 18), 0) / shapes.length;
  const totalCells = shapes.reduce((total, shape) => total + countShapeCells(shape), 0);
  const largePieceCount = shapes.filter((shape) => countShapeCells(shape) >= 5).length;

  let score = 0;
  score += movableCount * 120;
  score += averageMobility * 8;
  score += immediateClears * 26;
  score += totalCells * (danger > 0.58 ? -7 : 5);
  score += largePieceCount * (danger > 0.55 ? -balanceSettings.largePieceDangerPenalty : balanceSettings.largePieceSafeBonus);

  if (path.canPlaceAll) {
    score += 560;
    score += path.bestClears * 90;
    score += path.tightness * 16;
  } else {
    score -= danger > 0.48 ? 760 : 260;
  }

  const tooEasy = immediateClears >= 10 || averageMobility > 16;
  if (tooEasy && danger < 0.45) score -= balanceSettings.easyPenalty;

  const rescue = danger > 0.62 && movableCount >= 2;
  if (rescue) score += balanceSettings.rescueBonus;

  return score + Math.random() * 40;
}

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function countShapeCells(shape) {
  return shape.reduce((total, row) => total + row.filter(Boolean).length, 0);
}

function countEmpty(board) {
  return board.reduce((total, row) => total + row.filter((cell) => !cell).length, 0);
}

function canPlaceShape(board, shape, startRow, startCol) {
  return shape.every((shapeRow, rowOffset) =>
    shapeRow.every((filled, colOffset) => {
      if (!filled) return true;
      const row = startRow + rowOffset;
      const col = startCol + colOffset;
      return row >= 0 && row < 9 && col >= 0 && col < 9 && !board[row][col];
    }),
  );
}

function getPlacements(board, shape) {
  const placements = [];
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (!canPlaceShape(board, shape, row, col)) continue;
      const stampedBoard = stampShapeOnBoard(board, shape, row, col);
      const clear = findClearsOnBoard(stampedBoard);
      placements.push({
        row,
        col,
        clearGroups: clear.groups.length,
        clearCells: clear.cells.size,
      });
    }
  }
  return placements;
}

function stampShapeOnBoard(board, shape, startRow, startCol) {
  const nextBoard = cloneBoard(board);
  shape.forEach((shapeRow, rowOffset) => {
    shapeRow.forEach((filled, colOffset) => {
      if (filled) nextBoard[startRow + rowOffset][startCol + colOffset] = "block";
    });
  });
  return nextBoard;
}

function placeShapeOnBoard(board, shape, startRow, startCol) {
  const nextBoard = stampShapeOnBoard(board, shape, startRow, startCol);
  const clear = findClearsOnBoard(nextBoard);
  clear.cells.forEach((key) => {
    const [row, col] = key.split(",").map(Number);
    nextBoard[row][col] = null;
  });
  return nextBoard;
}

function findClearsOnBoard(board) {
  const cells = new Set();
  const groups = [];

  for (let row = 0; row < 9; row += 1) {
    if (board[row].every(Boolean)) {
      groups.push({ type: "row", index: row });
      for (let col = 0; col < 9; col += 1) cells.add(`${row},${col}`);
    }
  }

  for (let col = 0; col < 9; col += 1) {
    if (board.every((row) => row[col])) {
      groups.push({ type: "column", index: col });
      for (let row = 0; row < 9; row += 1) cells.add(`${row},${col}`);
    }
  }

  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxCol = 0; boxCol < 3; boxCol += 1) {
      const filled = [];
      for (let row = boxRow * 3; row < boxRow * 3 + 3; row += 1) {
        for (let col = boxCol * 3; col < boxCol * 3 + 3; col += 1) {
          filled.push([row, col, board[row][col]]);
        }
      }
      if (filled.every((cell) => cell[2])) {
        groups.push({ type: "box", index: boxRow * 3 + boxCol });
        filled.forEach(([row, col]) => cells.add(`${row},${col}`));
      }
    }
  }

  return { cells, groups };
}

function findBestPlacementPath(board, shapes) {
  let bestClears = 0;
  let bestTightness = 0;
  let searchedNodes = 0;

  function walk(currentBoard, remainingShapes, clears) {
    searchedNodes += 1;
    if (searchedNodes > balanceSettings.pathNodeBudget) return false;

    if (remainingShapes.length === 0) {
      const emptyAfter = countEmpty(currentBoard);
      bestClears = Math.max(bestClears, clears);
      bestTightness = Math.max(bestTightness, Math.max(0, 42 - emptyAfter));
      return true;
    }

    let found = false;
    for (let shapeIndex = 0; shapeIndex < remainingShapes.length; shapeIndex += 1) {
      const shape = remainingShapes[shapeIndex];
      const placements = getPlacements(currentBoard, shape)
        .sort((a, b) => b.clearGroups - a.clearGroups || b.clearCells - a.clearCells)
        .slice(0, balanceSettings.pathPlacementLimit);

      for (const placement of placements) {
        const nextBoard = placeShapeOnBoard(currentBoard, shape, placement.row, placement.col);
        const nextShapes = remainingShapes.filter((_, index) => index !== shapeIndex);
        if (walk(nextBoard, nextShapes, clears + placement.clearGroups)) found = true;
      }
    }
    return found;
  }

  return {
    canPlaceAll: walk(board, shapes, 0),
    bestClears,
    tightness: bestTightness,
  };
}

function cellsToShape(cells) {
  const maxRow = Math.max(...cells.map(([row]) => row));
  const maxCol = Math.max(...cells.map(([, col]) => col));
  const shape = Array.from({ length: maxRow + 1 }, () => Array(maxCol + 1).fill(0));
  cells.forEach(([row, col]) => {
    shape[row][col] = 1;
  });
  return shape;
}

async function fetchJson(primaryUrl, fallbackUrl) {
  const urls = [primaryUrl, fallbackUrl].filter(Boolean);
  let lastError = null;
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`${url} returned ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("JSON request failed.");
}

async function loadShapes() {
  try {
    const data = await fetchJson("/api/shapes", "db/shapes.json");
    const shapeList = Array.isArray(data) ? data : data.shapes || [];
    const shapes = shapeList
      .filter((shape) => shape.enabled !== false && Array.isArray(shape.cells) && shape.cells.length > 0)
      .map((shape) => {
        const matrix = cellsToShape(shape.cells);
        matrix.shapeName = shape.name;
        return matrix;
      });
    SHAPES = shapes.length > 0 ? shapes : [...DEFAULT_SHAPES];
  } catch (error) {
    SHAPES = [...DEFAULT_SHAPES];
  }
}

async function loadSettings() {
  try {
    const data = await fetchJson("/api/settings", "db/settings.json");
    balanceSettings = { ...DEFAULT_SETTINGS, ...(data.settings || data) };
  } catch (error) {
    balanceSettings = { ...DEFAULT_SETTINGS };
  }
}

const ORIGIN_MAP = {
  center: "center center",
  "top-left": "left top",
  "top-right": "right top",
  "bottom-left": "left bottom",
  "bottom-right": "right bottom",
};

function applyLayout(layout = {}) {
  const root = document.documentElement;
  ["monster", "player", "board", "tray"].forEach((key) => {
    const item = layout[key] || {};
    root.style.setProperty(`--layout-${key}-x`, `${Number(item.x) || 0}px`);
    root.style.setProperty(`--layout-${key}-y`, `${Number(item.y) || 0}px`);
    root.style.setProperty(`--layout-${key}-scale`, Number(item.scale) || 1);
    root.style.setProperty(`--layout-${key}-origin`, ORIGIN_MAP[item.origin] || ORIGIN_MAP.center);
  });
}

async function loadLayout() {
  try {
    const data = await fetchJson("/api/layout", "db/layout.json");
    applyLayout(data.layout || data);
  } catch (error) {
    applyLayout();
  }
}

function animationToSprite(character, animation) {
  return {
    url: animation.imageUrl || character.imageUrl,
    columns: animation.columns,
    rows: animation.rows,
    frames: animation.frames,
    startFrame: animation.startFrame || 0,
    frameMs: animation.frameMs,
    mode: animation.mode === "once" ? "once" : "pingpong",
    frameWidth: animation.frameWidth || 256,
    frameHeight: animation.frameHeight || 197,
    scale: animation.scale || 1,
    offsetX: animation.offsetX || 0,
    offsetY: animation.offsetY || 0,
  };
}

function characterToMonster(character) {
  const animations = Array.isArray(character.animations) ? character.animations : [];
  const idleAnimations = animations.filter((animation) => animation.name === "idle");
  const damageAnimations = animations.filter((animation) => animation.name === "damage");
  const attackAnimations = animations.filter((animation) => animation.name === "attack");
  const sprites = idleAnimations.map((animation) => animationToSprite(character, animation));
  return {
    name: character.name,
    hp: character.hp,
    turns: character.turns,
    theme: [character.themeA || "#ff6540", character.themeB || "#7fd0ff"],
    sprites,
    animations: {
      idle: sprites,
      damage: damageAnimations.map((animation) => animationToSprite(character, animation)),
      attack: attackAnimations.map((animation) => animationToSprite(character, animation)),
    },
  };
}

function characterToPlayerSprites(character) {
  const animations = Array.isArray(character.animations) ? character.animations : [];
  const idle = animations.find((animation) => animation.name === "idle");
  const attack = animations.find((animation) => animation.name === "attack");
  if (!idle) return null;
  const idleSprite = animationToSprite(character, idle);
  return {
    idle: idleSprite,
    attack: attack ? animationToSprite(character, attack) : null,
  };
}

async function loadCharacters() {
  try {
    const data = await fetchJson("/api/characters", "db/characters.json");
    const characterList = Array.isArray(data) ? data : data.characters || [];
    const monsters = characterList
      .filter((character) => character.active && character.role === "monster" && character.imageUrl)
      .map(characterToMonster)
      .filter((monster) => monster.sprites.length > 0);
    ACTIVE_MONSTERS = monsters.length > 0 ? monsters : [EMPTY_MONSTER];
    const playerCharacter = characterList.find((character) => character.active && character.role === "player" && character.imageUrl);
    PLAYER_SPRITES = characterToPlayerSprites(playerCharacter || {}) || { ...DEFAULT_PLAYER_SPRITES };
  } catch (error) {
    ACTIVE_MONSTERS = [EMPTY_MONSTER];
    PLAYER_SPRITES = { ...DEFAULT_PLAYER_SPRITES };
  }
}

function resetGame() {
  state.board = Array.from({ length: 9 }, () => Array(9).fill(null));
  state.pieces = generatePieces();
  state.selectedPieceId = null;
  playerMode = "idle";
  playerIdleFrame = 0;
  playerIdleDirection = 1;
  window.clearTimeout(playerActionTimer);
  playerActionTimer = null;
  setPlayerSprite("idle", 0);
  state.floor = 1;
  state.enemyDeck = shuffledIndices(ACTIVE_MONSTERS.length);
  state.enemyIndex = drawMonsterIndex();
  setupEnemy();
  state.playerHp = state.playerMaxHp;
  state.score = 0;
  state.lastDamage = 0;
  state.combo = 0;
  state.gameOver = false;
  state.resolving = false;
  state.enemyChangedThisMove = false;
  enemyPortrait.classList.remove("defeated");
  Object.keys(state.skills).forEach((key) => {
    state.skills[key] = 0;
  });
  logEl.innerHTML = "";
  addLog("블록을 드래그해서 보드에 놓아보세요.");
  render();
}

function render() {
  renderBoard();
  renderPieces();
  renderStats();
}

function renderBoard() {
  boardEl.innerHTML = "";
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const button = document.createElement("button");
      const boxTone = (Math.floor(row / 3) + Math.floor(col / 3)) % 2 === 0 ? "box-a" : "box-b";
      button.className = `cell ${boxTone} ${state.board[row][col] || ""}`;
      button.type = "button";
      button.dataset.row = row;
      button.dataset.col = col;
      button.setAttribute("aria-label", `${row + 1}행 ${col + 1}열`);
      button.addEventListener("click", () => placeSelectedPiece(row, col));
      button.addEventListener("mouseenter", () => previewPiece(row, col));
      boardEl.append(button);
    }
  }
}

function renderPieces() {
  trayEl.innerHTML = "";
  state.pieces.forEach((piece) => {
    const pieceEl = document.createElement("button");
    pieceEl.className = `piece ${piece.used ? "picked" : ""}`;
    pieceEl.type = "button";
    pieceEl.disabled = piece.used || state.gameOver || state.resolving;
    pieceEl.dataset.pieceId = piece.id;
    pieceEl.setAttribute("aria-label", piece.used ? "사용한 블록 자리" : `${COLOR_LABELS[piece.color]} 블록`);
    if (piece.used) {
      const placeholder = document.createElement("span");
      placeholder.className = "picked-mark";
      pieceEl.append(placeholder);
    } else {
      pieceEl.append(createMiniGrid(piece));
      pieceEl.addEventListener("click", () => selectPiece(piece.id));
      pieceEl.addEventListener("pointerdown", (event) => beginPointerDrag(event, piece.id));
    }
    trayEl.append(pieceEl);
  });
}

function createMiniGrid(piece) {
  const grid = document.createElement("span");
  grid.className = "mini-grid";
  const rows = piece.shape.length;
  const cols = Math.max(...piece.shape.map((row) => row.length));
  const offsetRow = Math.floor((5 - rows) / 2);
  const offsetCol = Math.floor((5 - cols) / 2);

  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const miniCell = document.createElement("span");
      const shapeRow = row - offsetRow;
      const shapeCol = col - offsetCol;
      const isBlock = piece.shape[shapeRow]?.[shapeCol];
      miniCell.className = `mini-cell ${isBlock ? piece.color : "blank"}`;
      grid.append(miniCell);
    }
  }
  return grid;
}

function renderStats() {
  const monster = ACTIVE_MONSTERS[state.enemyIndex];
  const enemyHpLabel = `${Math.max(0, state.enemyHp)} / ${state.enemyMaxHp}`;
  const playerHpLabel = `${Math.max(0, state.playerHp)} / ${state.playerMaxHp}`;
  const turnLabel = state.gameOver ? "Battle ended" : `Next attack: ${state.enemyTurn}`;
  enemyHpBar.style.width = `${Math.max(0, (state.enemyHp / state.enemyMaxHp) * 100)}%`;
  playerHpBar.style.width = `${Math.max(0, (state.playerHp / state.playerMaxHp) * 100)}%`;
  floorText.textContent = `Floor ${state.floor}`;
  enemyName.textContent = monster.name;
  enemyHpText.textContent = enemyHpLabel;
  playerHpText.textContent = playerHpLabel;
  turnText.textContent = turnLabel;
  scoreText.textContent = String(state.score);
  damageText.textContent = String(state.lastDamage);
  comboBadge.textContent = `${state.combo} combo`;
  mobileFloorText.textContent = `Floor ${state.floor}`;
  mobileEnemyName.textContent = monster.name;
  mobileEnemyHpText.textContent = enemyHpLabel;
  mobilePlayerHpText.textContent = playerHpLabel;
  mobileTurnText.textContent = turnLabel;
  mobileScoreText.textContent = String(state.score);

  Object.entries(state.skills).forEach(([color, cooldown]) => {
    const label = document.querySelector(`#${color}Skill`);
    const card = document.querySelector(`[data-skill="${color}"]`);
    label.textContent = cooldown === 0 ? "Ready" : `${cooldown} turn`;
    card.disabled = state.gameOver || state.resolving || cooldown > 0;
  });
}

function selectPiece(pieceId) {
  const piece = state.pieces.find((item) => item.id === pieceId);
  if (!piece || piece.used || state.gameOver || state.resolving) return;
  state.selectedPieceId = pieceId;
  renderPieces();
  document.querySelector(`[data-piece-id="${pieceId}"]`)?.classList.add("dragging");
}

function getSelectedPiece() {
  return state.pieces.find((piece) => piece.id === state.selectedPieceId && !piece.used);
}

function canPlace(piece, startRow, startCol) {
  return piece.shape.every((shapeRow, rowOffset) =>
    shapeRow.every((filled, colOffset) => {
      if (!filled) return true;
      const row = startRow + rowOffset;
      const col = startCol + colOffset;
      return row >= 0 && row < 9 && col >= 0 && col < 9 && !state.board[row][col];
    }),
  );
}

async function placeSelectedPiece(row, col) {
  const piece = getSelectedPiece();
  if (!piece || state.gameOver || state.resolving || !canPlace(piece, row, col)) return false;

  state.resolving = true;
  const placedCells = [];
  piece.shape.forEach((shapeRow, rowOffset) => {
    shapeRow.forEach((filled, colOffset) => {
      if (!filled) return;
      const targetRow = row + rowOffset;
      const targetCol = col + colOffset;
      state.board[targetRow][targetCol] = piece.color;
      placedCells.push(`${targetRow},${targetCol}`);
    });
  });
  piece.used = true;
  state.selectedPieceId = null;
  render();
  animateCells(placedCells, "placed");
  playSound("place");
  await sleep(180);

  await resolveComboSequence(piece);
  reduceCooldowns();

  if (state.pieces.every((item) => item.used)) {
    state.pieces = generatePieces();
  }

  if (!state.enemyChangedThisMove) {
    state.enemyTurn -= 1;
    if (state.enemyTurn <= 0 && !state.gameOver) enemyAttack();
  }
  state.enemyChangedThisMove = false;

  if (!hasAnyMove() && !state.gameOver) {
    state.gameOver = true;
    addLog("놓을 수 있는 조각이 없습니다. 전투 종료.");
  }

  state.resolving = false;
  render();
  return true;
}

function previewPiece(row, col) {
  const piece = getSelectedPiece();
  if (!piece || state.gameOver || state.resolving) return;
  clearPreview();
  const valid = canPlace(piece, row, col);
  piece.shape.forEach((shapeRow, rowOffset) => {
    shapeRow.forEach((filled, colOffset) => {
      if (!filled) return;
      getCell(row + rowOffset, col + colOffset)?.classList.add(valid ? "ghost" : "invalid");
    });
  });
}

function clearPreview() {
  boardEl.querySelectorAll(".ghost, .invalid").forEach((cell) => {
    cell.classList.remove("ghost", "invalid");
  });
}

function getCell(row, col) {
  return boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

function findClears() {
  const cells = new Set();
  const groups = [];

  for (let row = 0; row < 9; row += 1) {
    if (state.board[row].every(Boolean)) {
      const groupCells = [];
      for (let col = 0; col < 9; col += 1) {
        const key = `${row},${col}`;
        cells.add(key);
        groupCells.push(key);
      }
      groups.push({ type: "row", index: row, cells: groupCells });
    }
  }

  for (let col = 0; col < 9; col += 1) {
    if (state.board.every((row) => row[col])) {
      const groupCells = [];
      for (let row = 0; row < 9; row += 1) {
        const key = `${row},${col}`;
        cells.add(key);
        groupCells.push(key);
      }
      groups.push({ type: "column", index: col, cells: groupCells });
    }
  }

  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxCol = 0; boxCol < 3; boxCol += 1) {
      const filled = [];
      for (let row = boxRow * 3; row < boxRow * 3 + 3; row += 1) {
        for (let col = boxCol * 3; col < boxCol * 3 + 3; col += 1) {
          filled.push([row, col, state.board[row][col]]);
        }
      }
      if (filled.every((cell) => cell[2])) {
        const groupCells = filled.map(([row, col]) => `${row},${col}`);
        groups.push({ type: "box", index: boxRow * 3 + boxCol, cells: groupCells });
        groupCells.forEach((key) => cells.add(key));
      }
    }
  }

  return { cells, groups };
}

async function resolveComboSequence(piece) {
  const cleared = findClears();

  if (cleared.groups.length === 0) {
    const poke = balanceSettings.pokeDamage;
    dealDamage(poke, piece.color, "poke");
    state.score += balanceSettings.noComboScore;
    state.combo = 0;
    addLog(`${piece.name || "Block"} 견제 공격. 콤보가 끊겼습니다.`);
    return;
  }

  const combo = state.combo + 1;
  const blockCount = cleared.cells.size;
  const clearName = getClearName(cleared.groups);
  const damage =
    blockCount * balanceSettings.blockDamage +
    combo * balanceSettings.comboDamage +
    Math.floor(blockCount * combo * balanceSettings.comboBonus);

  state.combo = combo;
  renderStats();
  comboBadge.classList.remove("combo-hit");
  void comboBadge.offsetWidth;
  comboBadge.classList.add("combo-hit");
  window.setTimeout(() => comboBadge.classList.remove("combo-hit"), 460);
  animateCells([...cleared.cells], "matched");
  playSound("match");
  await sleep(320);

  cleared.cells.forEach((key) => {
    const [row, col] = key.split(",").map(Number);
    state.board[row][col] = null;
  });

  playPlayerSwing();
  dealDamage(damage, piece.color, combo > 1 ? "combo" : "poke");
  state.score += blockCount * balanceSettings.scorePerBlock + combo * balanceSettings.scorePerCombo;
  addLog(`${piece.name || "Block"} ${combo}콤보! ${clearName}, ${blockCount}칸, ${damage} 피해.`);
  await sleep(120);
  render();
}

function getClearName(groups) {
  const rows = groups.filter((group) => group.type === "row").length;
  const columns = groups.filter((group) => group.type === "column").length;
  const boxes = groups.filter((group) => group.type === "box").length;
  const parts = [];
  if (rows) parts.push(`가로 ${rows}`);
  if (columns) parts.push(`세로 ${columns}`);
  if (boxes) parts.push(`박스 ${boxes}`);
  return parts.join(" + ");
}

function dealDamage(amount, color, intensity) {
  state.enemyHp -= amount;
  state.lastDamage = amount;
  playSound(intensity === "skill" ? "skill" : "damage");
  showDamageNumber(amount, color, intensity);
  reactEnemy(intensity);
  checkEnemyDefeated();
}

function reduceCooldowns() {
  Object.keys(state.skills).forEach((color) => {
    state.skills[color] = Math.max(0, state.skills[color] - 1);
  });
}

function enemyAttack() {
  const damage = balanceSettings.enemyDamage;
  const table = document.querySelector(".game-table");
  playEnemyMotion("attack");
  state.playerHp -= damage;
  state.enemyTurn = ACTIVE_MONSTERS[state.enemyIndex].turns;
  table.classList.add("player-hit");
  playSound("enemy");
  window.setTimeout(() => table.classList.remove("player-hit"), 420);
  addLog(`적이 반격해서 ${damage} 피해를 받았습니다.`);
  if (state.playerHp <= 0) {
    state.playerHp = 0;
    state.gameOver = true;
    addLog("HP가 0이 됐습니다. 전투 패배.");
  }
}

function checkEnemyDefeated() {
  if (state.enemyHp > 0) return;
  state.score += balanceSettings.monsterKillScore;
  state.playerHp = state.playerMaxHp;
  state.enemyChangedThisMove = true;
  addLog(`${ACTIVE_MONSTERS[state.enemyIndex].name}을 쓰러뜨렸습니다. HP가 모두 회복됩니다.`);
  advanceEnemy();
}

function setupEnemy() {
  const monster = ACTIVE_MONSTERS[state.enemyIndex];
  const floorBonus = Math.floor((state.floor - 1) * balanceSettings.floorHpGrowth);
  state.enemyMaxHp = monster.hp + floorBonus;
  state.enemyHp = state.enemyMaxHp;
  state.enemyTurn = monster.turns;
  enemyPortrait.classList.remove("defeated");
  enemyPortrait.style.setProperty("--monster-a", monster.theme[0]);
  enemyPortrait.style.setProperty("--monster-b", monster.theme[1]);
  playEnemyMotion("idle");
}

function getEnemyMotionSprites(name) {
  const monster = ACTIVE_MONSTERS[state.enemyIndex];
  const idleSprites = monster.animations?.idle?.length ? monster.animations.idle : monster.sprites || [monster.sprite];
  if (name === "idle") return idleSprites.filter(Boolean);
  const sprites = monster.animations?.[name]?.filter(Boolean) || [];
  return sprites.length > 0 ? sprites : idleSprites.filter(Boolean);
}

function playEnemyMotion(name = "idle") {
  startEnemySpriteAnimation(getEnemyMotionSprites(name), name !== "idle");
}

function startEnemySpriteAnimation(sprites, returnToIdle = false) {
  window.clearInterval(enemySpriteTimer);
  enemySpriteTimer = null;
  enemySpriteFrame = 0;
  enemySpriteDirection = 1;
  const spriteOptions = sprites.filter(Boolean);
  let sprite = randomItem(spriteOptions);
  if (!sprite) {
    enemySprite.style.backgroundImage = "none";
    return;
  }

  setEnemySpriteSheet(sprite);
  setEnemySpriteFrame(enemySpriteFrame, sprite);
  enemySpriteTimer = window.setInterval(() => {
    if (sprite.mode === "once") {
      enemySpriteFrame += 1;
      if (enemySpriteFrame >= sprite.frames) {
        enemySpriteFrame = sprite.frames - 1;
        setEnemySpriteFrame(enemySpriteFrame, sprite);
        window.clearInterval(enemySpriteTimer);
        enemySpriteTimer = null;
        window.setTimeout(() => playEnemyMotion("idle"), sprite.frameMs);
        return;
      }
    } else {
      enemySpriteFrame += enemySpriteDirection;
      if (enemySpriteFrame >= sprite.frames - 1) {
        enemySpriteFrame = sprite.frames - 1;
        enemySpriteDirection = -1;
      } else if (enemySpriteFrame <= 0) {
        enemySpriteFrame = 0;
        enemySpriteDirection = 1;
        if (returnToIdle) {
          window.clearInterval(enemySpriteTimer);
          enemySpriteTimer = null;
          window.setTimeout(() => playEnemyMotion("idle"), sprite.frameMs);
          return;
        }
        sprite = randomItem(spriteOptions);
        setEnemySpriteSheet(sprite);
      }
    }
    setEnemySpriteFrame(enemySpriteFrame, sprite);
  }, sprite.frameMs);
}

function setEnemySpriteSheet(sprite) {
  enemySprite.style.backgroundImage = `url("${sprite.url}")`;
  enemySprite.style.backgroundSize = `${sprite.columns * 100}% ${sprite.rows * 100}%`;
  enemySprite.style.aspectRatio = `${sprite.frameWidth || 256} / ${sprite.frameHeight || 197}`;
  enemySprite.style.setProperty("--enemy-offset-x", `${sprite.offsetX || 0}px`);
  enemySprite.style.setProperty("--enemy-offset-y", `${sprite.offsetY || 0}px`);
  enemySprite.style.setProperty("--enemy-scale", sprite.scale || 1);
}

function setEnemySpriteFrame(frame, sprite) {
  const actualFrame = (sprite.startFrame || 0) + frame;
  const col = actualFrame % sprite.columns;
  const row = Math.floor(actualFrame / sprite.columns);
  const x = sprite.columns === 1 ? 0 : (col / (sprite.columns - 1)) * 100;
  const y = sprite.rows === 1 ? 0 : (row / (sprite.rows - 1)) * 100;
  enemySprite.style.backgroundPosition = `${x}% ${y}%`;
}

function advanceEnemy() {
  state.floor += 1;
  state.enemyIndex = drawMonsterIndex();
  enemyPortrait.classList.add("defeated");
  window.setTimeout(() => {
    setupEnemy();
    render();
  }, 380);
}

function hasAnyMove() {
  return state.pieces
    .filter((piece) => !piece.used)
    .some((piece) => {
      for (let row = 0; row < 9; row += 1) {
        for (let col = 0; col < 9; col += 1) {
          if (canPlace(piece, row, col)) return true;
        }
      }
      return false;
    });
}

function addLog(message) {
  const item = document.createElement("li");
  item.textContent = message;
  logEl.append(item);
  while (logEl.children.length > 9) logEl.removeChild(logEl.firstChild);
}

function castSkill(color) {
  if (state.gameOver || state.resolving || state.skills[color] > 0) return;
  const damage = color === "light" ? 190 : 150;
  const heal = color === "water" ? 90 : 0;
  const delay = color === "dark" ? 1 : 0;

  state.playerHp = Math.min(state.playerMaxHp, state.playerHp + heal);
  state.enemyTurn += delay;
  state.skills[color] = 5;
  dealDamage(damage, color, "skill");
  addLog(`${COLOR_LABELS[color]} 스킬: ${damage} 피해${heal ? `, ${heal} 회복` : ""}${delay ? ", 적 공격 지연" : ""}.`);
  render();
}

function animateCells(keys, className) {
  keys.forEach((key, index) => {
    const [row, col] = key.split(",").map(Number);
    const cell = getCell(row, col);
    if (!cell) return;
    cell.style.animationDelay = className === "placed" ? "0ms" : `${Math.min(index * 18, 160)}ms`;
    cell.classList.add(className);
  });
}

function showDamageNumber(amount, color, intensity) {
  const popup = document.createElement("div");
  popup.className = `damage-pop ${color} ${intensity}`;
  popup.textContent = `-${amount}`;
  enemyPanel.append(popup);
  window.setTimeout(() => popup.remove(), 850);
}

function reactEnemy(intensity) {
  playEnemyMotion("damage");
  enemyPortrait.classList.remove("hit", "big-hit", "skill-hit");
  void enemyPortrait.offsetWidth;
  const className = intensity === "combo" ? "big-hit" : intensity === "skill" ? "skill-hit" : "hit";
  enemyPortrait.classList.add(className);
  window.setTimeout(() => enemyPortrait.classList.remove("hit", "big-hit", "skill-hit"), 620);
}

function preloadPlayerSprites() {
  Object.values(PLAYER_SPRITES).filter(Boolean).forEach((sprite) => {
    const image = new Image();
    image.src = sprite.url;
  });
  ACTIVE_MONSTERS.forEach((monster) => {
    const sprites = Object.values(monster.animations || {}).flat().concat(monster.sprites || [monster.sprite]);
    sprites.filter(Boolean).forEach((sprite) => {
      const image = new Image();
      image.src = sprite.url;
    });
  });
}

function startPlayerIdleAnimation() {
  setPlayerSprite("idle", 0);
  window.setInterval(() => {
    if (playerMode !== "idle") return;
    const sprite = PLAYER_SPRITES.idle;
    if (sprite.mode === "once") {
      playerIdleFrame = (playerIdleFrame + 1) % sprite.frames;
    } else {
      playerIdleFrame += playerIdleDirection;
      if (playerIdleFrame >= sprite.frames - 1) {
        playerIdleFrame = sprite.frames - 1;
        playerIdleDirection = -1;
      } else if (playerIdleFrame <= 0) {
        playerIdleFrame = 0;
        playerIdleDirection = 1;
      }
    }
    setPlayerSpriteFrame(playerIdleFrame, PLAYER_SPRITES.idle);
  }, PLAYER_SPRITES.idle.frameMs);
}

function playPlayerSwing() {
  const sprite = PLAYER_SPRITES.attack || PLAYER_SPRITES.idle;
  playerMode = "attack";
  window.clearTimeout(playerActionTimer);
  setPlayerSprite(PLAYER_SPRITES.attack ? "attack" : "idle", 0);

  let frame = 0;
  let direction = 1;
  const step = () => {
    if (sprite.mode === "once") {
      frame += 1;
      if (frame >= sprite.frames) {
        playerMode = "idle";
        playerActionTimer = null;
        setPlayerSprite("idle", playerIdleFrame);
        return;
      }
    } else {
      frame += direction;
      if (frame >= sprite.frames - 1) {
        frame = sprite.frames - 1;
        direction = -1;
      } else if (frame <= 0) {
        frame = 0;
        playerMode = "idle";
        playerActionTimer = null;
        setPlayerSprite("idle", playerIdleFrame);
        return;
      }
    }
    setPlayerSpriteFrame(frame, sprite);
    playerActionTimer = window.setTimeout(step, sprite.frameMs);
  };
  playerActionTimer = window.setTimeout(step, sprite.frameMs);
}

function setPlayerSprite(mode, frame) {
  const sprite = PLAYER_SPRITES[mode] || PLAYER_SPRITES.idle;
  playerSprite.style.backgroundImage = `url("${sprite.url}")`;
  playerSprite.style.backgroundSize = `${sprite.columns * 100}% ${sprite.rows * 100}%`;
  playerSprite.style.aspectRatio = `${sprite.frameWidth || 209} / ${sprite.frameHeight || 256}`;
  playerSprite.style.setProperty("--player-offset-x", `${sprite.offsetX || 0}px`);
  playerSprite.style.setProperty("--player-offset-y", `${sprite.offsetY || 0}px`);
  playerSprite.style.setProperty("--player-sprite-scale", sprite.scale || 1);
  setPlayerSpriteFrame(frame, sprite);
}

function setPlayerSpriteFrame(frame, sprite) {
  const actualFrame = (sprite.startFrame || 0) + frame;
  const col = actualFrame % sprite.columns;
  const row = Math.floor(actualFrame / sprite.columns);
  const x = sprite.columns === 1 ? 0 : (col / (sprite.columns - 1)) * 100;
  const y = sprite.rows === 1 ? 0 : (row / (sprite.rows - 1)) * 100;
  playerSprite.style.backgroundPosition = `${x}% ${y}%`;
}

function beginPointerDrag(event, pieceId) {
  const piece = state.pieces.find((item) => item.id === pieceId);
  if (!piece || piece.used || state.gameOver || state.resolving) return;
  event.preventDefault();
  playSound("drag");
  selectPiece(pieceId);

  const ghost = createDragGhost(piece);
  document.body.append(ghost);
  dragSession = { ghost, lastCell: null, piece };
  positionDragGhost(event.clientX, event.clientY);

  event.currentTarget.setPointerCapture?.(event.pointerId);
  window.requestAnimationFrame(() => {
    ghost.classList.add("lifted", "pulling");
    movePointerDrag(event);
    window.setTimeout(() => {
      ghost.classList.remove("pulling");
      ghost.classList.add("free");
    }, 170);
  });
}

function movePointerDrag(event) {
  if (!dragSession) return;
  event.preventDefault?.();
  const liftedPoint = getLiftedPoint(event.clientX, event.clientY);
  const dropPoint = getDropPoint(liftedPoint.x, liftedPoint.y);

  const cell = cellFromPoint(dropPoint.x, dropPoint.y);
  if (!cell) {
    clearPreview();
    dragSession.lastCell = null;
    positionDragGhost(liftedPoint.x, liftedPoint.y);
    return;
  }

  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  dragSession.lastCell = { row, col };
  positionDragGhost(liftedPoint.x, liftedPoint.y);
  previewPiece(row, col);
}

async function endPointerDrag() {
  if (!dragSession) return;
  const dropCell = dragSession.lastCell;
  dragSession.ghost.remove();
  dragSession = null;
  clearPreview();
  const placed = dropCell ? await placeSelectedPiece(dropCell.row, dropCell.col) : false;
  if (!placed) renderPieces();
}

function cellFromPoint(x, y) {
  const ghost = dragSession?.ghost;
  if (ghost) ghost.style.display = "none";
  const element = document.elementFromPoint(x, y);
  if (ghost) ghost.style.display = "";
  return element?.closest?.(".cell") || null;
}

function positionDragGhost(x, y) {
  dragSession.ghost.style.left = `${x}px`;
  dragSession.ghost.style.top = `${y}px`;
}

function getLiftedPoint(x, y) {
  return {
    x,
    y: y - getBoardCellSize() * 3.9,
  };
}

function getDropPoint(x, y) {
  const piece = dragSession?.piece;
  if (!piece) return { x, y };
  const cellSize = getBoardCellSize();
  const cols = Math.max(...piece.shape.map((row) => row.length));
  const rows = piece.shape.length;

  return {
    x: x - (cols * cellSize) / 2 + cellSize / 2,
    y: y - (rows * cellSize) / 2 + cellSize / 2,
  };
}

function createDragGhost(piece) {
  const ghost = document.createElement("div");
  ghost.className = "drag-ghost";
  ghost.style.setProperty("--drag-cell-size", `${getBoardCellSize()}px`);
  const grid = document.createElement("span");
  const cols = Math.max(...piece.shape.map((row) => row.length));
  grid.className = "shape-grid";
  grid.style.gridTemplateColumns = `repeat(${cols}, var(--drag-cell-size))`;
  grid.style.gridTemplateRows = `repeat(${piece.shape.length}, var(--drag-cell-size))`;

  piece.shape.forEach((shapeRow) => {
    for (let col = 0; col < cols; col += 1) {
      const block = document.createElement("span");
      block.className = shapeRow[col] ? `shape-cell ${piece.color}` : "shape-cell blank";
      grid.append(block);
    }
  });

  ghost.append(grid);
  return ghost;
}

window.addEventListener("pointermove", movePointerDrag, { passive: false });
window.addEventListener("pointerup", endPointerDrag);
window.addEventListener("pointercancel", endPointerDrag);
boardEl.addEventListener("mouseleave", clearPreview);

document.querySelectorAll("[data-skill]").forEach((button) => {
  button.addEventListener("click", () => castSkill(button.dataset.skill));
});

function setMobileUi(enabled) {
  document.body.classList.toggle("mobile-ui", enabled);
  viewToggleButton.textContent = enabled ? "PC UI" : "Mobile UI";
  localStorage.setItem("blockudoku-view", enabled ? "mobile" : "pc");
}

viewToggleButton.addEventListener("click", () => {
  setMobileUi(!document.body.classList.contains("mobile-ui"));
});

newGameButton.addEventListener("click", resetGame);
const viewMode = new URLSearchParams(window.location.search).get("view");
if (viewMode === "mobile" || viewMode === "pc") {
  setMobileUi(viewMode === "mobile");
} else {
  setMobileUi(localStorage.getItem("blockudoku-view") === "mobile");
}
Promise.all([loadShapes(), loadSettings(), loadCharacters(), loadLayout()])
  .then(() => {
    preloadPlayerSprites();
    startPlayerIdleAnimation();
    resetGame();
  })
  .catch((error) => {
    console.error(error);
    ACTIVE_MONSTERS = [EMPTY_MONSTER];
    PLAYER_SPRITES = { ...DEFAULT_PLAYER_SPRITES };
    startPlayerIdleAnimation();
    resetGame();
    addLog("초기 설정을 불러오지 못해 기본 설정으로 시작했습니다.");
  });
