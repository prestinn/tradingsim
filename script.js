// -------------------------------------------
// Global Variables & DOM Elements
// -------------------------------------------
let socket;

// DOM Elements
let tradesLeftDisplay, progressFill, balanceDisplay, winRateDisplay, drawdownDisplay, finalScoreDisplay;
let cashInput, buyBtn, sellBtn, closeBtn, restartBtn;
let tradeHistoryBody;

// Additional Trader Stats
let unrealPnlDisplay, entryPriceDisplay, currentPriceDisplay, liquidationPriceDisplay, leverageDisplay, marginUsageDisplay;

// Advanced-stats DOM references
let avgWinDisplay, avgLossDisplay, largestWinDisplay, largestLossDisplay;

// Additional for leverage & total leveraged size
let leverageInput, totalLeveragedSizeDisplay;  

// NEW: Username-related DOM
let usernameDisplay, changeUserBtn, viewScoresBtn;

// Charting
let chart;                 
let candlestickSeries;     
let positionMarkers = [];  
let entryPriceLine;        

// Trading States
let xValues = [], openValues = [], highValues = [], lowValues = [], closeValues = []; 
let paperBalance = 1000;
const START_BALANCE = 1000;  

let positionOpen   = false;
let positionSide   = 0;      
let entryPrice     = 0;
let largestWin     = 0;
let largestLoss    = 0;
let positionSize   = 0;
let LEVERAGE       = 5;      

let realizedPnL    = 0, feesPaid = 0, maxDrawdown = 0;
let totalWins      = 0, totalLosses = 0, totalProfit = 0, totalLoss = 0, tradesLeft = 5;

// Keep a record of closed trades for advanced stats
let closedTrades   = [];

// Fee Rate
const FEE_RATE = 0.0002;

// Local user session
let currentUsername = "";

// -------------------------------------------
// Init
// -------------------------------------------
function init() {
  console.log("Initializing Trading Game (Lightweight Charts)...");

  // 1) Create or load username
  createUsernameModal();
  loadUsername();

  // 2) Grab DOM references
  tradesLeftDisplay  = document.getElementById("tradesLeft");
  progressFill       = document.getElementById("progressFill");
  balanceDisplay     = document.getElementById("balanceDisplay");
  winRateDisplay     = document.getElementById("winRateDisplay");
  drawdownDisplay    = document.getElementById("drawdownDisplay");
  finalScoreDisplay  = document.getElementById("finalScoreDisplay");

  cashInput          = document.getElementById("qtyInput");
  buyBtn             = document.getElementById("buyBtn");
  sellBtn            = document.getElementById("sellBtn");
  closeBtn           = document.getElementById("closeBtn");
  restartBtn         = document.getElementById("restartBtn");
  tradeHistoryBody   = document.getElementById("tradeHistoryBody");

  unrealPnlDisplay      = document.getElementById("unrealPnlDisplay");
  entryPriceDisplay     = document.getElementById("entryPriceDisplay");
  currentPriceDisplay   = document.getElementById("currentPriceDisplay");
  liquidationPriceDisplay = document.getElementById("liquidationPriceDisplay");
  leverageDisplay       = document.getElementById("leverageDisplay");
  marginUsageDisplay    = document.getElementById("marginUsageDisplay");

  avgWinDisplay         = document.getElementById("avgWinDisplay");
  avgLossDisplay        = document.getElementById("avgLossDisplay");
  largestWinDisplay     = document.getElementById("largestWinDisplay");
  largestLossDisplay    = document.getElementById("largestLossDisplay");

  leverageInput         = document.getElementById("leverageInput");
  totalLeveragedSizeDisplay = document.getElementById("totalLeveragedSizeDisplay");

  // NEW: references for username + buttons
  usernameDisplay  = document.getElementById("usernameDisplay");
  changeUserBtn    = document.getElementById("changeUserBtn");
  viewScoresBtn    = document.getElementById("viewScoresBtn");

  // 3) Create hidden modals
  createModalContainer();
  createHighscoreModal();

  // 4) Set up Lightweight Chart
  initLightweightChart();

  // 5) WebSocket Connection
  socket = new WebSocket("wss://wesera.net:8765");
  socket.onopen    = () => console.log("WebSocket connected!");
  socket.onmessage = (event) => handleServerMessage(event.data);
  socket.onclose   = () => console.log("WebSocket disconnected.");
  socket.onerror   = (error) => showModal("WebSocket Error", error.message);

  // 6) Event Listeners
  buyBtn.addEventListener("click",  () => handleTrade("BUY"));
  sellBtn.addEventListener("click", () => handleTrade("SELL"));
  closeBtn.addEventListener("click", closePosition);
  restartBtn.addEventListener("click", resetGame);

  if (leverageInput) {
    leverageInput.addEventListener("change", () => {
      const val = parseInt(leverageInput.value) || LEVERAGE;
      // clamp between 2 and 100
      LEVERAGE = Math.max(2, Math.min(100, val));
      updateGameUI();  
    });
  }

  if (changeUserBtn) {
    changeUserBtn.addEventListener("click", openUsernameModal);
  }
  if (viewScoresBtn) {
    viewScoresBtn.addEventListener("click", showHighScores);
  }

  // 7) Initialize UI
  updateGameUI();
}

// -------------------------------------------
// Username Handling
// -------------------------------------------
function loadUsername() {
  const stored = sessionStorage.getItem("tradingGameUsername");
  if (stored) {
    currentUsername = stored;
    updateUsernameDisplay(stored);
  } else {
    // If no user in session, show username modal
    openUsernameModal();
  }
}

function updateUsernameDisplay(name) {
  if (usernameDisplay) {
    usernameDisplay.textContent = `User: ${name}`;
  }
  currentUsername = name;
  sessionStorage.setItem("tradingGameUsername", name);
}

function createUsernameModal() {
  if (document.getElementById("usernameModalBackdrop")) return;

  const userModalHTML = `
    <div id="usernameModalBackdrop" class="fixed inset-0 bg-gray-800 bg-opacity-50 hidden items-center justify-center z-50">
      <div id="usernameModalBox" class="bg-white rounded-lg shadow-lg p-6 max-w-md text-center">
        <h2 class="text-xl font-bold mb-2">Enter Your Username</h2>
        <input id="usernameInput" type="text" class="border p-2 w-3/4" placeholder="Enter username..." />
        <div class="mt-4">
          <button id="usernameSaveBtn" class="btn btn-primary px-4 py-2">Save</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", userModalHTML);

  const usernameSaveBtn = document.getElementById("usernameSaveBtn");
  usernameSaveBtn.addEventListener("click", () => {
    const input = document.getElementById("usernameInput");
    const val = (input.value || "").trim() || "Guest";
    updateUsernameDisplay(val);
    hideUsernameModal();
  });
}

function openUsernameModal() {
  const userBackdrop = document.getElementById("usernameModalBackdrop");
  const userInput = document.getElementById("usernameInput");
  if (!userBackdrop || !userInput) return;
  userInput.value = currentUsername || "";
  userBackdrop.classList.remove("hidden");
  userBackdrop.classList.add("flex");
}

function hideUsernameModal() {
  const userBackdrop = document.getElementById("usernameModalBackdrop");
  if (!userBackdrop) return;
  userBackdrop.classList.remove("flex");
  userBackdrop.classList.add("hidden");
}

// -------------------------------------------
// Create & Setup a Lightweight Chart
// -------------------------------------------
function initLightweightChart() {
  const chartDiv = document.getElementById("chartDiv");
  chart = LightweightCharts.createChart(chartDiv, {
    width: chartDiv.clientWidth,
    height: 400,
    layout: {
      background: { type: 'Solid', color: '#FFFFFF' },
      textColor: '#333',
    },
    grid: {
      vertLines: { color: '#eee' },
      horzLines: { color: '#eee' },
    },
    timeScale: {
      borderVisible: false,
      timeVisible: true,
      secondsVisible: false,
    },
    rightPriceScale: {
      borderVisible: false,
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
    },
  });

  candlestickSeries = chart.addCandlestickSeries({
    upColor: 'green',
    downColor: 'red',
    borderVisible: false,
    wickUpColor: 'green',
    wickDownColor: 'red',
  });
}

// -------------------------------------------
// WebSocket Handlers
// -------------------------------------------
function handleServerMessage(data) {
  const parsed = JSON.parse(data);
  if (parsed.type === "initial_candles") {
    loadInitialCandles(parsed.candles);
  } else if (parsed.type === "new_candle") {
    addNewCandle(parsed.candle);
  }
}

function loadInitialCandles(candles) {
  if (!candles || candles.length === 0) return;
  const candleData = candles.map(c => ({
    time: c.timestamp,
    open: c.open,
    high: c.high,
    low:  c.low,
    close:c.close
  }));

  xValues       = candleData.map(d => d.time);
  openValues    = candleData.map(d => d.open);
  highValues    = candleData.map(d => d.high);
  lowValues     = candleData.map(d => d.low);
  closeValues   = candleData.map(d => d.close);

  candlestickSeries.setData(candleData);
}

function addNewCandle(candle) {
  if (!candle) return;
  const newData = {
    time: candle.timestamp,  
    open: candle.open,
    high: candle.high,
    low:  candle.low,
    close: candle.close
  };

  if (xValues.length >= 100) {
    xValues.shift(); openValues.shift(); highValues.shift();
    lowValues.shift(); closeValues.shift();
  }
  xValues.push(newData.time);
  openValues.push(newData.open);
  highValues.push(newData.high);
  lowValues.push(newData.low);
  closeValues.push(newData.close);

  candlestickSeries.update(newData);
  updateChartMarkers();
  updateEntryPriceLine();
  updateGameUI();
}

// -------------------------------------------
// Markers & Price Line Helpers
// -------------------------------------------
function updateChartMarkers() {
  candlestickSeries.setMarkers(positionMarkers);
}

function updateEntryPriceLine() {
  if (entryPriceLine) {
    candlestickSeries.removePriceLine(entryPriceLine);
    entryPriceLine = null;
  }
  if (!positionOpen) return;

  const color = (positionSide === 1) ? 'green' : 'red';
  entryPriceLine = candlestickSeries.createPriceLine({
    price: entryPrice,
    color,
    lineWidth: 2,
    lineStyle: LightweightCharts.LineStyle.Dotted,
    axisLabelVisible: true,
    title: 'Entry',
  });
}

// -------------------------------------------
// Trading Actions
// -------------------------------------------
function handleTrade(side) {
  // If no trades left, can’t open new position
  if (tradesLeft <= 0 && !positionOpen) {
    return showModal("Game Over", "Click Restart to Play Again.");
  }

  const enteredCash = parseFloat(cashInput.value) || 1;
  if (enteredCash <= 0) {
    return showModal("Invalid Entry", "Enter a valid cash amount (> 0)!");
  }
  if (enteredCash > paperBalance) {
    return showModal("Not Enough Balance", "You can't risk more than your current balance!");
  }

  // If user tries to switch sides while a position is open
  if (positionOpen) {
    if (positionSide === 1 && side === "SELL") {
      return showModal("Position Already Open", "Close your LONG before opening a SHORT!");
    } 
    if (positionSide === -1 && side === "BUY") {
      return showModal("Position Already Open", "Close your SHORT before opening a LONG!");
    }
  }

  const price = getLatestPrice();
  const addedSize = enteredCash / price;

  // If opening brand new position => reduce tradesLeft
  if (!positionOpen) {
    positionOpen = true;
    positionSide = (side === "BUY") ? 1 : -1;
    entryPrice   = price;
    positionSize = addedSize;
    tradesLeft--;  // used up a trade slot
  } else {
    // Scaling in same direction => no tradesLeft usage
    const newSize = positionSize + addedSize;
    entryPrice = ((entryPrice * positionSize) + (price * addedSize)) / newSize;
    positionSize = newSize;
  }

  addTradeMarker(side, price, enteredCash);
  showModal("Trade Placed", `You ${side.toUpperCase()} $${enteredCash.toFixed(2)} worth @ $${price.toFixed(2)}!`);
  updateGameUI();

  // If no trades left but user is in a position, they can still close
  // Final score will be calculated upon close or right here if they have no position
  if (tradesLeft === 0 && !positionOpen) {
    calculateFinalScore();
  }
}

function closePosition() {
  if (!positionOpen) {
    return showModal("No Position", "No open position to close!");
  }

  const closePrice = getLatestPrice();
  const tradePnL = (positionSide === 1)
    ? (closePrice - entryPrice) * positionSize * LEVERAGE
    : (entryPrice - closePrice) * positionSize * LEVERAGE;

  paperBalance += tradePnL;
  realizedPnL += tradePnL;
  trackClosedTrade(positionSide, entryPrice, closePrice, tradePnL);

  positionOpen = false;
  positionSide = 0;
  entryPrice   = 0;
  positionSize = 0;

  addTradeMarker("CLOSE", closePrice, 0, tradePnL);
  showModal("Position Closed", `You closed at $${closePrice.toFixed(2)}\nPnL: $${tradePnL.toFixed(2)}`);
  updateGameUI();

  // If tradesLeft is 0, final score
  if (tradesLeft === 0) {
    calculateFinalScore();
    showEndSummaryModal();
  }
}

// -------------------------------------------
// Trade History & Stats Tracking
// -------------------------------------------
function addTradeMarker(side, price, cashUsed=0, realized=0) {
  const markerTime = xValues.length ? xValues[xValues.length - 1] : Math.floor(Date.now()/1000);

  let markerColor = 'blue', markerShape = 'arrowUp';
  if (side === 'BUY') {
    markerColor = 'green'; 
    markerShape = 'arrowUp';
  } else if (side === 'SELL') {
    markerColor = 'red'; 
    markerShape = 'arrowDown';
  } else if (side === 'CLOSE') {
    markerColor = 'gray'; 
    markerShape = 'circle';
  }

  positionMarkers.push({
    time: markerTime,
    position: 'aboveBar',
    color: markerColor,
    shape: markerShape,
    text: side.toUpperCase(),
  });
  updateChartMarkers();
  updateEntryPriceLine();

  // Also log a row in trade history
  const fee = (price * 1 * FEE_RATE).toFixed(2);
  const row = tradeHistoryBody.insertRow();
  row.innerHTML = `
    <td>${new Date().toLocaleTimeString()}</td>
    <td>${side.toUpperCase()}</td>
    <td>$${cashUsed.toFixed(2)}</td>
    <td>${price.toFixed(2)}</td>
    <td>$${fee}</td>
    <td>${realized !== 0 ? realized.toFixed(2) : '--'}</td>
  `;
}

function trackClosedTrade(side, openPrice, closePrice, realizedPnL) {
  const sideText = side === 1 ? "LONG" : "SHORT";
  const tradeObj = {
    side: sideText,
    entryPrice: openPrice,
    exitPrice: closePrice,
    realizedPnL,
    closedAt: new Date()
  };
  closedTrades.push(tradeObj);

  if (realizedPnL >= 0) {
    totalWins++;
    totalProfit += realizedPnL;
    if (realizedPnL > largestWin) largestWin = realizedPnL;
  } else {
    totalLosses++;
    totalLoss += realizedPnL;
    if (realizedPnL < largestLoss) largestLoss = realizedPnL;
  }
}

// -------------------------------------------
// UI Updates
// -------------------------------------------
function updateGameUI() {
  // color-coded background
  if (!positionOpen) {
    document.body.style.backgroundColor = "#f4f6f9";
  } else if (positionSide === 1) {
    document.body.style.backgroundColor = "#d2f8d2";
  } else if (positionSide === -1) {
    document.body.style.backgroundColor = "#ffd2d2";
  }

  closeBtn.disabled = !positionOpen;

  // Trades left + progress
  if (tradesLeftDisplay) {
    tradesLeftDisplay.textContent = tradesLeft;
  }
  if (progressFill) {
    progressFill.style.width = `${(tradesLeft / 5) * 100}%`;
  }

  // Balance
  if (balanceDisplay) {
    balanceDisplay.textContent = `$${paperBalance.toFixed(2)}`;
  }

  // Leverage
  if (leverageDisplay) {
    leverageDisplay.textContent = `${LEVERAGE}x`;
  }

  // Current Price
  const latestPrice = getLatestPrice();
  if (currentPriceDisplay) {
    currentPriceDisplay.textContent = `$${latestPrice.toFixed(2)}`;
  }

  // Entry Price
  if (entryPriceDisplay) {
    entryPriceDisplay.textContent = positionOpen ? `$${entryPrice.toFixed(2)}` : "--";
  }

  // Unrealized PnL
  let unrealPnl = 0;
  if (positionOpen) {
    unrealPnl = (positionSide === 1)
      ? (latestPrice - entryPrice) * positionSize * LEVERAGE
      : (entryPrice - latestPrice) * positionSize * LEVERAGE;
  }
  if (unrealPnlDisplay) {
    unrealPnlDisplay.textContent = positionOpen ? `$${unrealPnl.toFixed(2)}` : "--";
  }

  // Liquidation Price
  if (liquidationPriceDisplay) {
    liquidationPriceDisplay.textContent = positionOpen
      ? `$${(entryPrice * (1 - (1 / LEVERAGE))).toFixed(2)}`
      : "--";
  }

  // Margin Usage
  if (marginUsageDisplay) {
    marginUsageDisplay.textContent = positionOpen 
      ? `$${(entryPrice * positionSize / LEVERAGE).toFixed(2)}`
      : "--";
  }

  // Show total leveraged position size
  if (totalLeveragedSizeDisplay) {
    const totalSize = positionSize * LEVERAGE; 
    totalLeveragedSizeDisplay.textContent = positionOpen 
      ? totalSize.toFixed(4) 
      : "0.0000";
  }

  // Win Rate
  const wr = (totalWins / Math.max(1, totalWins + totalLosses)) * 100;
  if (winRateDisplay) {
    winRateDisplay.textContent = `${wr.toFixed(2)}%`;
  }

  // (Optional) track drawdown logic. (Placeholder)
  if (drawdownDisplay) {
    drawdownDisplay.textContent = `$${maxDrawdown.toFixed(2)}`;
  }

  updateAdvancedStats();
}

function updateAdvancedStats() {
  const numberOfClosedTrades = closedTrades.length;
  if (numberOfClosedTrades === 0) {
    if (avgWinDisplay)   avgWinDisplay.textContent        = "--";
    if (avgLossDisplay)  avgLossDisplay.textContent       = "--";
    if (largestWinDisplay)   largestWinDisplay.textContent = "--";
    if (largestLossDisplay)  largestLossDisplay.textContent= "--";
    return;
  }

  let sumWins = 0, countWins = 0;
  let sumLoss = 0, countLoss = 0;
  closedTrades.forEach(t => {
    if (t.realizedPnL >= 0) {
      sumWins += t.realizedPnL; countWins++;
    } else {
      sumLoss += t.realizedPnL; countLoss++;
    }
  });

  const averageWin  = (countWins === 0) ? 0 : sumWins / countWins;
  const averageLoss = (countLoss === 0) ? 0 : sumLoss / countLoss;

  if (avgWinDisplay)   avgWinDisplay.textContent   = `$${averageWin.toFixed(2)}`;
  if (avgLossDisplay)  avgLossDisplay.textContent  = `$${averageLoss.toFixed(2)}`;
  if (largestWinDisplay)   largestWinDisplay.textContent   = `$${largestWin.toFixed(2)}`;
  if (largestLossDisplay)  largestLossDisplay.textContent  = `$${largestLoss.toFixed(2)}`;
}

// -------------------------------------------
// Final Scoring & Summary
// -------------------------------------------
function calculateFinalScore() {
  const netProfit = paperBalance - START_BALANCE;
  const finalBalanceRatio = paperBalance / START_BALANCE;
  const wr = totalWins / Math.max(1, (totalWins + totalLosses));

  let score = 0;
  // Up to 40 points from netProfit ratio
  let profitPart = (finalBalanceRatio - 1) * 100;
  profitPart = Math.max(0, Math.min(40, profitPart));
  score += profitPart;

  // Up to 40 points from win rate
  let wrPoints = wr * 40;
  score += wrPoints;

  // Up to 20 points from minimal drawdown (placeholder)
  let ddPenalty = maxDrawdown / START_BALANCE;
  let ddScore = 20 - (ddPenalty * 20);
  if (ddScore < 0) ddScore = 0;
  score += ddScore;

  if (score > 100) score = 100;
  if (score < 0)   score = 0;

  if (finalScoreDisplay) {
    finalScoreDisplay.textContent = `${score.toFixed(2)}%`;
  }

  const gameScoreSpan = document.getElementById("gameScore");
  if (gameScoreSpan) {
    gameScoreSpan.textContent = `${score.toFixed(2)}%`;
  }

  // Update highscore if better
  saveHighScore(currentUsername, score.toFixed(2));
}

function showEndSummaryModal() {
  let summaryRows = closedTrades.map((t, idx) => {
    return `
      <tr>
        <td class="p-2">${idx+1}</td>
        <td class="p-2">${t.side}</td>
        <td class="p-2">${t.entryPrice.toFixed(2)}</td>
        <td class="p-2">${t.exitPrice.toFixed(2)}</td>
        <td class="p-2">${t.realizedPnL.toFixed(2)}</td>
      </tr>
    `;
  }).join("");

  let modalHtml = `
    <div class="mb-4">
      <h3 class="text-xl font-bold">All 5 Trades Summary</h3>
      <table class="w-full mt-2">
        <thead>
          <tr class="bg-gray-200">
            <th class="p-2">#</th>
            <th class="p-2">Side</th>
            <th class="p-2">Entry</th>
            <th class="p-2">Exit</th>
            <th class="p-2">Realized PnL</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows}
        </tbody>
      </table>
    </div>
    <p class="mb-4">Your final score is: <strong>${finalScoreDisplay.textContent}</strong></p>
    <p class="mb-4">
      <a href="https://twitter.com/intent/tweet?text=I scored ${finalScoreDisplay.textContent} in this Trading Game!"
         class="text-blue-500 underline"
         target="_blank">
         Share on Twitter
      </a>
    </p>
    <button id="restartBtn" class="btn btn-primary mt-4">Restart Game</button>
  `;
  showModal("Final Summary", modalHtml);
}

// -------------------------------------------
// Highscores (Local Storage) 
// -------------------------------------------
function createHighscoreModal() {
  if (document.getElementById("highscoreModalBackdrop")) return;
  const hsModalHTML = `
    <div id="highscoreModalBackdrop" class="fixed inset-0 bg-gray-800 bg-opacity-50 hidden items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-lg p-6 max-w-md text-center">
        <h2 class="text-xl font-bold mb-2">Highscores</h2>
        <div id="highscoreList" class="overflow-y-auto max-h-60 mb-4"></div>
        <button id="highscoreCloseBtn" class="btn btn-primary px-4 py-2">Close</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", hsModalHTML);

  const closeHsBtn = document.getElementById("highscoreCloseBtn");
  closeHsBtn.addEventListener("click", hideHighScores);
}

function showHighScores() {
  const backdrop = document.getElementById("highscoreModalBackdrop");
  const container = document.getElementById("highscoreList");
  if (!backdrop || !container) return;

  // Load all stored highscores from localStorage
  let scoreboard = [];
  for (let i=0; i<localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith("score_")) {
      const user = key.replace("score_", "");
      const val = localStorage.getItem(key);
      scoreboard.push({ user, score: parseFloat(val) });
    }
  }

  // Sort descending by score
  scoreboard.sort((a,b) => b.score - a.score);

  // Build HTML
  let hsHtml = `<table class="w-full mt-2"><thead><tr class="bg-gray-200">
    <th class="p-2">#</th><th class="p-2">User</th><th class="p-2">Score</th></tr></thead><tbody>`;
  scoreboard.forEach((item, idx) => {
    hsHtml += `
      <tr>
        <td class="p-2">${idx+1}</td>
        <td class="p-2">${item.user}</td>
        <td class="p-2">${item.score}%</td>
      </tr>
    `;
  });
  hsHtml += `</tbody></table>`;

  container.innerHTML = hsHtml;

  backdrop.classList.remove("hidden");
  backdrop.classList.add("flex");
}

function hideHighScores() {
  const backdrop = document.getElementById("highscoreModalBackdrop");
  if (!backdrop) return;
  backdrop.classList.remove("flex");
  backdrop.classList.add("hidden");
}

function saveHighScore(user, score) {
  if (!user) return;
  // Compare existing
  const key = `score_${user}`;
  const oldScore = parseFloat(localStorage.getItem(key) || "0");
  const newScore = parseFloat(score);
  if (newScore > oldScore) {
    localStorage.setItem(key, newScore);
  }
}

// -------------------------------------------
// Misc
// -------------------------------------------
function resetGame() {
  console.log("Resetting the game...");

  // Reset Core Game Variables
  paperBalance = 1000;
  positionOpen = false;
  positionSide = 0;
  entryPrice = 0;
  positionSize = 0;
  realizedPnL = 0;
  maxDrawdown = 0;
  totalWins = 0;
  totalLosses = 0;
  totalProfit = 0;
  totalLoss = 0;
  tradesLeft = 5;
  closedTrades = [];
  positionMarkers = [];

  // Reset UI Elements
  if (tradesLeftDisplay) tradesLeftDisplay.textContent = tradesLeft;
  if (progressFill) progressFill.style.width = "100%";
  if (balanceDisplay) balanceDisplay.textContent = `$${paperBalance.toFixed(2)}`;
  if (winRateDisplay) winRateDisplay.textContent = "0%";
  if (drawdownDisplay) drawdownDisplay.textContent = "$0";
  if (finalScoreDisplay) finalScoreDisplay.textContent = "--";
  if (gameScoreSpan) gameScoreSpan.textContent = "0%";
  
  if (unrealPnlDisplay) unrealPnlDisplay.textContent = "--";
  if (entryPriceDisplay) entryPriceDisplay.textContent = "--";
  if (currentPriceDisplay) currentPriceDisplay.textContent = "--";
  if (liquidationPriceDisplay) liquidationPriceDisplay.textContent = "--";
  if (leverageDisplay) leverageDisplay.textContent = `${LEVERAGE}x`;
  if (marginUsageDisplay) marginUsageDisplay.textContent = "$0";

  if (avgWinDisplay) avgWinDisplay.textContent = "--";
  if (avgLossDisplay) avgLossDisplay.textContent = "--";
  if (largestWinDisplay) largestWinDisplay.textContent = "--";
  if (largestLossDisplay) largestLossDisplay.textContent = "--";

  // Clear Trade History Table
  if (tradeHistoryBody) tradeHistoryBody.innerHTML = "";

  // Clear the chart and reinitialize
  if (candlestickSeries) {
    candlestickSeries.setData([]);
  }

  // Hide Game Over screen
  document.getElementById("gameOverScreen").classList.add("hidden");

  console.log("Game successfully reset.");
}

function getLatestPrice() {
  return closeValues.length ? closeValues[closeValues.length - 1] : 100;
}

// -------------------------------------------
// Modal / UI boilerplate
// -------------------------------------------
function createModalContainer() {
  if (document.getElementById("modalBackdrop")) return;
  const modalHTML = `
    <div id="modalBackdrop" class="fixed inset-0 bg-gray-800 bg-opacity-50 hidden items-center justify-center z-50">
      <div id="modalBox" class="bg-white rounded-lg shadow-lg p-6 max-w-md text-center">
        <h2 id="modalTitle" class="text-xl font-bold mb-2">Modal Title</h2>
        <p id="modalMessage" class="mb-4">Modal Message</p>
        <button id="modalCloseBtn" class="btn btn-primary px-4 py-2">OK</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHTML);
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  modalCloseBtn.addEventListener("click", hideModal);
}

function showModal(title, message) {
  const backdrop = document.getElementById("modalBackdrop");
  const modalTitle = document.getElementById("modalTitle");
  const modalMessage = document.getElementById("modalMessage");
  if (!backdrop || !modalTitle || !modalMessage) {
    console.error("Modal elements not found in DOM!");
    return;
  }
  modalTitle.textContent = title;
  modalMessage.innerHTML = message;
  backdrop.classList.remove("hidden");
  backdrop.classList.add("flex");
}

function hideModal() {
  const backdrop = document.getElementById("modalBackdrop");
  if (!backdrop) return;
  backdrop.classList.remove("flex");
  backdrop.classList.add("hidden");
}

// On page load
window.onload = init;
