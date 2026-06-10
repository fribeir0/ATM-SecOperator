FROM python:3.12-slim

WORKDIR /app

# Dependências Python
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Backend
COPY backend/ ./backend/

# Frontend (servido pelo Flask)
COPY frontend/ ./frontend/

# Expõe a porta
EXPOSE 5000

# Roda com Gunicorn em produção (usa Flask dev se DEBUG=1)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "30", "backend.app:app"]
