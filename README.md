# Web3 Manera Payment System

Полнофункциональная платежная система с интеграцией Web3 технологий.

## Установка на VDS

### Требования:
- Ubuntu 20.04+
- Docker 20.10+
- Docker Compose 1.29+
- Node.js 18.x
- npm 9.x

### Шаги установки:

1. Обновите систему:
```bash
sudo apt update && sudo apt upgrade -y
```

2. Установите зависимости:
```bash
sudo apt install -y git nodejs npm docker.io docker-compose
```

3. Клонируйте репозиторий:
```bash
git clone https://github.com/zametkikostik/web3-manera.git
cd web3-manera
```

4. Настройте переменные окружения:
```bash
cp .env.example .env
nano .env  # Отредактируйте файл под ваши настройки
```

5. Запустите систему:
```bash
docker-compose up -d --build
```

6. Инициализируйте базу данных:
```bash
docker-compose exec backend node scripts/create-admin.js
```

7. Система будет доступна:
- Frontend: http://your-vds-ip:3000
- Backend: http://your-vds-ip:8080
- Мониторинг: http://your-vds-ip:9090 (Prometheus), http://your-vds-ip:3001 (Grafana)

## Особенности системы:
- Поддержка Ethereum/Polygon/BSC сетей
- Интеграция с Aave/Uniswap
- NFT KYC паспорта
- 5-уровневая система привилегий
- Мультиязычный интерфейс (EN/RU/BG)