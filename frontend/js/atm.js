/* ─────────────────────────────────────────────────────
   BancoCaixa ATM  —  Frontend State Machine
   ───────────────────────────────────────────────────── */

const API = "";          // same origin (Flask serves the HTML)
const screen  = document.getElementById("screen");
const cashBills = document.getElementById("cashBills");

/* ── State ─────────────────────────────────────────── */
let state = {
  screen: "welcome",    // welcome | card | pin | menu | balance | withdraw-amount | withdraw-confirm | statement | message
  cardId: "",
  pin: "",
  input: "",
  sessionId: null,
  ownerName: "",
  cardNumber: "",
  pendingAmount: 0,
  authMethod: "local",
};

/* ── Clock ──────────────────────────────────────────── */
function fmtClock() {
  const now = new Date();
  return now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDate() {
  return new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).toUpperCase();
}

/* ── API helpers ────────────────────────────────────── */
async function apiPost(path, body) {
  const r = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

/* ── Render engine ──────────────────────────────────── */
function render() {
  switch (state.screen) {
    case "welcome":     renderWelcome();    break;
    case "card":        renderCard();       break;
    case "pin":         renderPin();        break;
    case "menu":        renderMenu();       break;
    case "balance":     renderBalance();    break;
    case "withdraw-amount":   renderWithdrawAmount(); break;
    case "withdraw-confirm":  renderWithdrawConfirm(); break;
    case "withdraw-other":    renderWithdrawOther();   break;
    case "statement":   renderStatement();  break;
    case "loading":     renderLoading();    break;
    case "message":     renderMessage();    break;
  }
}

/* ── Screens ────────────────────────────────────────── */
function renderWelcome() {
  screen.innerHTML = `
    <div class="s-header">
      <span>BANCO CAIXA</span>
      <span>ATM-001</span>
    </div>
    <div class="s-clock" id="clk">${fmtClock()}</div>
    <div class="s-date">${fmtDate()}</div>
    <div class="s-prompt">▸ INSIRA SEU CARTÃO PARA INICIAR</div>
  `;
  // live clock
  clearInterval(window._clockInterval);
  window._clockInterval = setInterval(() => {
    const el = document.getElementById("clk");
    if (el) el.textContent = fmtClock();
  }, 1000);
}

function renderCard() {
  screen.innerHTML = `
    <div class="s-header"><span>IDENTIFICAÇÃO</span></div>
    <div class="s-title">Número do Cartão</div>
    <div class="s-sub">Digite os 4 últimos dígitos</div>
    <div class="s-label">CARTÃO</div>
    <div class="s-input-display">
      ${state.input || ""}<span class="s-cursor"></span>
    </div>
    <div class="s-btn" onclick="gotoScreen('welcome')">← CANCELAR</div>
  `;
}

function renderPin() {
  const dots = "●".repeat(state.input.length) + "○".repeat(Math.max(0, 4 - state.input.length));
  screen.innerHTML = `
    <div class="s-header"><span>AUTENTICAÇÃO</span></div>
    <div class="s-card-display">${state.cardId ? `**** **** **** ${state.cardId}` : ""}</div>
    <div class="s-title">Senha</div>
    <div class="s-sub">Digite sua senha de 4 dígitos</div>
    <div class="s-label">PIN</div>
    <div class="s-input-display" style="letter-spacing:0.5em;font-size:20px">
      ${dots}<span class="s-cursor"></span>
    </div>
    <div class="s-btn" onclick="gotoScreen('card')">← VOLTAR</div>
  `;
}

function renderMenu() {
  const authLabel = state.authMethod === "lambda" ? "AWS LAMBDA" : "LOCAL";
  screen.innerHTML = `
    <div class="s-header">
      <span>MENU PRINCIPAL</span>
      <span class="s-auth-tag">AUTH: ${authLabel}</span>
    </div>
    <div class="s-owner">${state.ownerName}</div>
    <div class="s-menu">
      <div class="s-menu-item" onclick="doBalance()">
        <span class="item-num">1</span>
        <span>Consultar Saldo</span>
        <span class="item-arrow">›</span>
      </div>
      <div class="s-menu-item" onclick="gotoScreen('withdraw-amount')">
        <span class="item-num">2</span>
        <span>Sacar Dinheiro</span>
        <span class="item-arrow">›</span>
      </div>
      <div class="s-menu-item" onclick="doStatement()">
        <span class="item-num">3</span>
        <span>Extrato</span>
        <span class="item-arrow">›</span>
      </div>
      <div class="s-menu-item" onclick="doLogout()">
        <span class="item-num">0</span>
        <span>Encerrar</span>
        <span class="item-arrow">›</span>
      </div>
    </div>
  `;
}

function renderBalance() {
  screen.innerHTML = `
    <div class="s-header"><span>SALDO</span></div>
    <div class="s-card-display">${state.cardNumber}</div>
    <div class="s-value">∞ ∞ ∞</div>
    <div class="s-value-label">SALDO DISPONÍVEL — R$</div>
    <hr class="s-divider" />
    <div style="text-align:center;font-size:10px;color:var(--screen-muted);margin-bottom:10px;">
      ✦ CONTA ILIMITADA ATIVA ✦
    </div>
    <div class="s-btn" onclick="gotoScreen('menu')">← VOLTAR AO MENU</div>
  `;
}

function renderWithdrawAmount() {
  screen.innerHTML = `
    <div class="s-header"><span>SAQUE</span></div>
    <div class="s-sub" style="margin-bottom:10px">Selecione o valor:</div>
    <div class="s-amounts">
      <div class="s-amount-btn" onclick="selectAmount(100)">R$ 100</div>
      <div class="s-amount-btn" onclick="selectAmount(200)">R$ 200</div>
      <div class="s-amount-btn" onclick="selectAmount(300)">R$ 300</div>
      <div class="s-amount-btn" onclick="selectAmount(500)">R$ 500</div>
      <div class="s-amount-btn" onclick="selectAmount(1000)">R$ 1.000</div>
      <div class="s-amount-btn" onclick="selectAmount(2000)">R$ 2.000</div>
      <div class="s-amount-btn other" onclick="gotoScreen('withdraw-other')">✎ OUTRO VALOR</div>
    </div>
    <div class="s-btn" style="margin-top:10px" onclick="gotoScreen('menu')">← CANCELAR</div>
  `;
}

function renderWithdrawOther() {
  screen.innerHTML = `
    <div class="s-header"><span>SAQUE — OUTRO VALOR</span></div>
    <div class="s-label">VALOR (R$)</div>
    <div class="s-input-display">
      ${state.input ? formatCurrency(state.input) : "0,00"}<span class="s-cursor"></span>
    </div>
    <div class="s-sub" style="font-size:9px">Máximo: R$ 10.000,00</div>
    <div class="s-btn" onclick="confirmOtherAmount()">CONFIRMAR →</div>
    <div class="s-btn" onclick="gotoScreen('withdraw-amount')">← CANCELAR</div>
  `;
}

function renderWithdrawConfirm() {
  const val = state.pendingAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  screen.innerHTML = `
    <div class="s-header"><span>CONFIRMAR SAQUE</span></div>
    <div class="s-value">${val}</div>
    <div class="s-value-label">VALOR A SACAR</div>
    <hr class="s-divider" />
    <div class="s-sub" style="text-align:center;margin-bottom:16px">Confirma a operação?</div>
    <div class="s-btn" onclick="doWithdraw()">✔ CONFIRMAR SAQUE</div>
    <div class="s-btn" onclick="gotoScreen('withdraw-amount')">← VOLTAR</div>
  `;
}

function renderLoading(msg = "PROCESSANDO...") {
  screen.innerHTML = `
    <div class="s-loading">
      <div class="s-spinner"></div>
      <span>${msg}</span>
    </div>
  `;
}

function renderMessage() {
  const isErr = state.msgType === "error";
  screen.innerHTML = `
    <div class="s-header"><span>${isErr ? "ATENÇÃO" : "INFORMAÇÃO"}</span></div>
    <div class="s-msg ${isErr ? "s-msg--error" : ""}">
      <div class="s-msg-icon">${isErr ? "⚠" : "✓"}</div>
      <div class="s-msg-text">${state.msgText}</div>
      ${state.msgSub ? `<div class="s-msg-sub">${state.msgSub}</div>` : ""}
    </div>
    <div class="s-btn" style="margin-top:auto" onclick="gotoScreen('${state.msgNext || "menu"}')">${state.msgAction || "← VOLTAR"}</div>
  `;
}

function renderStatement() {
  const txs = state.transactions || [];
  screen.innerHTML = `
    <div class="s-header"><span>EXTRATO</span></div>
    <div class="s-owner" style="font-size:13px;margin-bottom:8px">${state.ownerName}</div>
    <div class="s-transactions">
      ${txs.map(t => `
        <div class="s-tx">
          <span class="s-tx-date">${t.date}</span>
          <span class="s-tx-desc">${t.desc}</span>
          <span class="s-tx-val ${t.value > 0 ? "pos" : "neg"}">
            ${t.value > 0 ? "+" : ""}${t.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </div>
      `).join("")}
    </div>
    <div class="s-btn" style="margin-top:auto" onclick="gotoScreen('menu')">← VOLTAR</div>
  `;
}

/* ── Actions ────────────────────────────────────────── */
function gotoScreen(name) {
  clearInterval(window._clockInterval);
  state.screen = name;
  state.input = "";
  render();
}

function selectAmount(amount) {
  state.pendingAmount = amount;
  gotoScreen("withdraw-confirm");
}

function confirmOtherAmount() {
  const val = parseFloat(state.input);
  if (!val || val <= 0) { showToast("Digite um valor válido"); return; }
  if (val > 10000)       { showToast("Limite máximo: R$ 10.000"); return; }
  state.pendingAmount = val;
  state.input = "";
  gotoScreen("withdraw-confirm");
}

async function doAuth() {
  renderLoading("AUTENTICANDO...");
  try {
    const res = await apiPost("/api/auth", { card_id: state.cardId, pin: state.pin });
    if (res.success) {
      state.sessionId  = res.session_id;
      state.ownerName  = res.owner;
      state.cardNumber = res.card_number;
      state.authMethod = res.auth_method;
      gotoScreen("menu");
    } else {
      state.msgText   = res.message || "Autenticação falhou.";
      state.msgSub    = "Verifique o cartão e a senha.";
      state.msgType   = "error";
      state.msgNext   = "card";
      state.msgAction = "← TENTAR NOVAMENTE";
      gotoScreen("message");
    }
  } catch {
    state.msgText = "Erro de comunicação.";
    state.msgSub  = "Tente novamente.";
    state.msgType = "error";
    state.msgNext = "welcome";
    gotoScreen("message");
  }
}

async function doBalance() {
  renderLoading("CONSULTANDO SALDO...");
  try {
    await apiPost("/api/balance", { session_id: state.sessionId });
    gotoScreen("balance");
  } catch {
    gotoScreen("balance"); // show anyway for demo
  }
}

async function doWithdraw() {
  renderLoading("PROCESSANDO SAQUE...");
  try {
    const res = await apiPost("/api/withdraw", {
      session_id: state.sessionId,
      amount: state.pendingAmount,
    });
    if (res.success) {
      animateCash();
      state.msgText   = `Saque realizado!`;
      state.msgSub    = `R$ ${state.pendingAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} — Retire o dinheiro.`;
      state.msgType   = "success";
      state.msgNext   = "menu";
      state.msgAction = "← MENU PRINCIPAL";
      setTimeout(() => gotoScreen("message"), 600);
    } else {
      state.msgText = res.message;
      state.msgType = "error";
      state.msgNext = "menu";
      gotoScreen("message");
    }
  } catch {
    state.msgText = "Erro ao processar saque.";
    state.msgType = "error";
    state.msgNext = "menu";
    gotoScreen("message");
  }
}

async function doStatement() {
  renderLoading("CARREGANDO EXTRATO...");
  try {
    const res = await apiPost("/api/statement", { session_id: state.sessionId });
    if (res.success) {
      state.transactions = res.transactions;
      gotoScreen("statement");
    }
  } catch {
    gotoScreen("menu");
  }
}

async function doLogout() {
  await apiPost("/api/logout", { session_id: state.sessionId }).catch(() => {});
  state.sessionId = null;
  state.ownerName = "";
  state.cardId    = "";
  state.pin       = "";
  gotoScreen("welcome");
}

/* ── Cash animation ─────────────────────────────────── */
function animateCash() {
  cashBills.innerHTML = "";
  const count = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const bill = document.createElement("div");
    bill.className = "bill";
    cashBills.appendChild(bill);
    setTimeout(() => { bill.style.height = (14 + Math.random() * 8) + "px"; }, i * 60);
  }
  setTimeout(() => {
    Array.from(cashBills.children).forEach(b => { b.style.height = "0"; });
    setTimeout(() => { cashBills.innerHTML = ""; }, 600);
  }, 3500);
}

/* ── Keypad handler ─────────────────────────────────── */
function handleKey(val) {
  const s = state.screen;

  if (val === "clear") {
    state.input = state.input.slice(0, -1);
    render();
    return;
  }

  if (val === "enter") {
    if (s === "welcome" || s === "card") {
      if (state.screen === "welcome") { gotoScreen("card"); return; }
      if (state.input.length >= 1) {
        state.cardId = state.input;
        state.input  = "";
        gotoScreen("pin");
      } else {
        showToast("Digite o número do cartão");
      }
      return;
    }
    if (s === "pin") {
      if (state.input.length >= 1) {
        state.pin   = state.input;
        state.input = "";
        doAuth();
      } else {
        showToast("Digite sua senha");
      }
      return;
    }
    if (s === "withdraw-other") {
      confirmOtherAmount();
      return;
    }
    return;
  }

  // Digit keys
  if (/^\d$/.test(val)) {
    if (s === "card") {
      if (state.input.length < 4) { state.input += val; render(); }
    } else if (s === "pin") {
      if (state.input.length < 4) { state.input += val; render(); }
    } else if (s === "withdraw-other") {
      if (state.input.length < 6) { state.input += val; render(); }
    } else if (s === "welcome") {
      gotoScreen("card");
    } else if (s === "menu") {
      const map = { "1": doBalance, "2": () => gotoScreen("withdraw-amount"), "3": doStatement, "0": doLogout };
      if (map[val]) map[val]();
    }
  }
}

/* ── Utility ────────────────────────────────────────── */
function formatCurrency(raw) {
  const n = parseInt(raw, 10);
  if (!n) return "0,00";
  return (n / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

let toastTimer;
function showToast(msg) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2000);
}

/* ── Event listeners ────────────────────────────────── */
document.querySelectorAll(".key").forEach(btn => {
  btn.addEventListener("click", () => handleKey(btn.dataset.val));
});

document.addEventListener("keydown", e => {
  if (/^[0-9]$/.test(e.key))    handleKey(e.key);
  if (e.key === "Enter")         handleKey("enter");
  if (e.key === "Backspace")     handleKey("clear");
});

/* ── Boot ───────────────────────────────────────────── */
render();
