from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import uuid
import time
import os
import boto3
import json
import base64
import hashlib
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder="../frontend")
CORS(app)


ACCOUNTS = {
    "1234": {
        "card_number": "**** **** **** 1234",
        "owner": "JOÃO SILVA",
        "pin_hash": hashlib.sha256("1111".encode()).hexdigest(),
        "balance": float("inf"),  
        "currency": "BRL",
    },
    "5678": {
        "card_number": "**** **** **** 5678",
        "owner": "MARIA SOUZA",
        "pin_hash": hashlib.sha256("2222".encode()).hexdigest(),
        "balance": float("inf"),
        "currency": "BRL",
    },
}

SESSIONS: dict = {}
SESSION_TTL = 120 


LAMBDA_FUNCTION_NAME = os.getenv("LAMBDA_FUNCTION_NAME", "")
AWS_REGION           = os.getenv("AWS_REGION", "us-east-1")
USE_LAMBDA_AUTH      = bool(LAMBDA_FUNCTION_NAME)

def _lambda_client():
    return boto3.client(
        "lambda",
        region_name=AWS_REGION,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        aws_session_token=os.getenv("AWS_SESSION_TOKEN"),
    )

def authorize_via_lambda(card_id: str, pin: str) -> dict:
    """
    Chama o Lambda de autorização.
    Payload enviado:  { card_id, pin }
    Resposta esperada: { authorized: bool, message: str, context?: {...} }
    """
    payload = json.dumps({"card_id": card_id, "pin": pin})
    try:
        client = _lambda_client()
        resp = client.invoke(
            FunctionName=LAMBDA_FUNCTION_NAME,
            InvocationType="RequestResponse",
            Payload=payload.encode(),
        )
        result = json.loads(resp["Payload"].read())
        if "body" in result:
            result = json.loads(result["body"])
        return result
    except Exception as exc:
        logger.error("Lambda invoke failed: %s", exc)
        return {"authorized": False, "message": "Serviço de autorização indisponível."}

def authorize_local(card_id: str, pin: str) -> dict:
    """Autorização local (fallback quando Lambda não está configurado)."""
    account = ACCOUNTS.get(card_id)
    if not account:
        return {"authorized": False, "message": "Cartão não encontrado."}
    pin_hash = hashlib.sha256(pin.encode()).hexdigest()
    if pin_hash != account["pin_hash"]:
        return {"authorized": False, "message": "PIN incorreto."}
    return {"authorized": True, "message": "OK"}


def _clean_sessions():
    now = time.time()
    expired = [sid for sid, s in SESSIONS.items() if now - s["created_at"] > SESSION_TTL]
    for sid in expired:
        del SESSIONS[sid]

def _get_session(session_id: str):
    _clean_sessions()
    return SESSIONS.get(session_id)

def _require_session(session_id: str):
    s = _get_session(session_id)
    if not s or not s.get("authenticated"):
        return None, jsonify({"success": False, "message": "Sessão inválida ou expirada."}), 401
    return s, None, None


@app.route("/")
def index():
    return send_from_directory("../frontend", "index.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory("../frontend", path)

@app.route("/api/auth", methods=["POST"])
def auth():
    data = request.get_json(silent=True) or {}
    card_id = str(data.get("card_id", "")).strip()
    pin     = str(data.get("pin", "")).strip()

    if not card_id or not pin:
        return jsonify({"success": False, "message": "Dados incompletos."}), 400

    if USE_LAMBDA_AUTH:
        logger.info("Authenticating via Lambda: %s", LAMBDA_FUNCTION_NAME)
        result = authorize_via_lambda(card_id, pin)
    else:
        logger.info("Authenticating locally (no Lambda configured)")
        result = authorize_local(card_id, pin)

    if not result.get("authorized"):
        return jsonify({"success": False, "message": result.get("message", "Não autorizado.")}), 401

    account = ACCOUNTS.get(card_id)
    if not account:
        return jsonify({"success": False, "message": "Conta não encontrada."}), 404

    session_id = str(uuid.uuid4())
    SESSIONS[session_id] = {
        "account_id": card_id,
        "created_at": time.time(),
        "authenticated": True,
        "lambda_context": result.get("context", {}),
    }
    return jsonify({
        "success": True,
        "session_id": session_id,
        "owner": account["owner"],
        "card_number": account["card_number"],
        "auth_method": "lambda" if USE_LAMBDA_AUTH else "local",
    })


@app.route("/api/balance", methods=["POST"])
def balance():
    data = request.get_json(silent=True) or {}
    session, err, code = _require_session(data.get("session_id", ""))
    if err:
        return err, code

    account = ACCOUNTS[session["account_id"]]
    bal = account["balance"]
    return jsonify({
        "success": True,
        "balance": "∞" if bal == float("inf") else f"{bal:,.2f}",
        "currency": account["currency"],
    })


@app.route("/api/withdraw", methods=["POST"])
def withdraw():
    data = request.get_json(silent=True) or {}
    session, err, code = _require_session(data.get("session_id", ""))
    if err:
        return err, code

    try:
        amount = float(data.get("amount", 0))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Valor inválido."}), 400

    if amount <= 0:
        return jsonify({"success": False, "message": "Valor deve ser positivo."}), 400
    if amount > 10_000:
        return jsonify({"success": False, "message": "Limite por saque: R$ 10.000,00."}), 400

    account = ACCOUNTS[session["account_id"]]
    logger.info("Withdraw R$ %.2f for account %s", amount, session["account_id"])
    return jsonify({
        "success": True,
        "amount": amount,
        "currency": account["currency"],
        "message": f"Saque de R$ {amount:,.2f} realizado com sucesso.",
    })


@app.route("/api/statement", methods=["POST"])
def statement():
    data = request.get_json(silent=True) or {}
    session, err, code = _require_session(data.get("session_id", ""))
    if err:
        return err, code

    account = ACCOUNTS[session["account_id"]]
    # Extrato fictício para demonstração
    fake_transactions = [
        {"date": "06/06/2025", "desc": "SAQUE ATM",          "value": -500.00},
        {"date": "04/06/2025", "desc": "DEPÓSITO",           "value": +2000.00},
        {"date": "02/06/2025", "desc": "TRANSFERÊNCIA PIX",  "value": -350.00},
        {"date": "01/06/2025", "desc": "PAGAMENTO CONTA",    "value": -180.50},
        {"date": "30/05/2025", "desc": "DEPÓSITO",           "value": +5000.00},
    ]
    return jsonify({
        "success": True,
        "owner": account["owner"],
        "transactions": fake_transactions,
    })


@app.route("/api/logout", methods=["POST"])
def logout():
    data = request.get_json(silent=True) or {}
    sid = data.get("session_id", "")
    if sid in SESSIONS:
        del SESSIONS[sid]
    return jsonify({"success": True})


@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "lambda_auth": USE_LAMBDA_AUTH,
        "lambda_function": LAMBDA_FUNCTION_NAME or "not configured",
        "active_sessions": len(SESSIONS),
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=os.getenv("FLASK_DEBUG", "0") == "1")
