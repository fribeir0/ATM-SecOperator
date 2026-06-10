# 🏧 ATM Simulator

Simulador de caixa eletrônico com interface web, backend Python/Flask,
e integração opcional com AWS Lambda para autorização (com KMS).

---

## Estrutura

```
atm-simulator/
├── backend/
│   ├── app.py              # Flask API
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/atm.js
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Rodar localmente (sem Lambda)

```bash
# 1. Copie o .env
cp .env.example .env

# 2. Suba o container
docker compose up --build

# 3. Acesse
open http://localhost:5000
```

**Contas de teste:**
| Cartão | PIN  |
|--------|------|
| 1234   | 1111 |
| 5678   | 2222 |

---

## Rodar com Lambda e KMS (AWS)

```bash
# Edite o .env
LAMBDA_FUNCTION_NAME=nome-da-sua-funcao
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

docker compose up --build
```

O ATM detecta automaticamente se o Lambda está configurado e troca o modo de auth.
A tela de menu mostra `AUTH: AWS LAMBDA` ou `AUTH: LOCAL`.

---

## API endpoints

| Método | Rota              | Descrição                          |
|--------|-------------------|------------------------------------|
| POST   | `/api/auth`       | Autenticar (chama Lambda se config) |
| POST   | `/api/balance`    | Consultar saldo                    |
| POST   | `/api/withdraw`   | Realizar saque                     |
| POST   | `/api/statement`  | Extrato dos últimos lançamentos    |
| POST   | `/api/logout`     | Encerrar sessão                    |
| GET    | `/api/health`     | Health check + status da sessão    |
