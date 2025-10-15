# Web3 Bank Monera

Полноценный банк с Web3/DeFi функционалом, построенный на Open Bank Project с интеграцией блокчейн-протоколов.

## 🚀 Особенности

- 🏦 **Полноценный банковский функционал** на базе Open Bank Project
- 🌐 **Web3/DeFi интеграция** (Aave, Uniswap, Balancer, Bisq, Hodl Hodl)
- 💳 **Платежные системы** (Stripe, ЮMoney, Payeer, iCard)
- 🤖 **AI интеграция** (ChatGPT, OpenRouter)
- 🪙 **Внутренний токен** с механизмом сжигания
- 📱 **Мобильное приложение** (React Native)
- 🌍 **Мультиязычность** (Болгарский, Английский, Русский, Немецкий, Французский, Испанский)
- 🔗 **Интеграция с биржами** (Bybit)
- ⚡ **GetBlock и собственные ноды**
- 🔐 **Админ-панель** с функцией вывода средств

## 🛠 Технологии

### Backend
- **Open Bank Project** - основа банковского функционала
- **Node.js + Express** - серверная часть
- **PostgreSQL** - основная база данных
- **Redis** - кэширование и сессии
- **Web3.js + Ethers.js** - блокчейн интеграция
- **Socket.io** - real-time уведомления

### Frontend
- **React + TypeScript** - веб-интерфейс
- **Tailwind CSS** - стилизация
- **React Query** - управление состоянием
- **React Router** - маршрутизация
- **Framer Motion** - анимации

### Mobile
- **React Native + Expo** - мобильное приложение
- **React Navigation** - навигация
- **React Native Paper** - UI компоненты
- **React Native Reanimated** - анимации

### Blockchain & DeFi
- **Ethereum, Polygon, BSC** - поддерживаемые сети
- **Aave** - протокол кредитования
- **Uniswap** - DEX для обмена токенов
- **Balancer** - автоматизированные маркет-мейкеры
- **Bisq, Hodl Hodl** - P2P торговля

### AI & Payments
- **OpenAI GPT-4** - AI ассистент
- **OpenRouter** - альтернативный AI
- **Stripe** - международные платежи
- **ЮMoney** - российские платежи
- **Payeer** - криптовалютные платежи
- **iCard** - болгарские платежи

## 🚀 Быстрый старт

### 1. Клонирование репозитория
```bash
git clone https://github.com/zametkikostik/web3-bank-monera.git
cd web3-bank-monera
```

### 2. Настройка окружения
```bash
# Копируем файл конфигурации
cp .env.example .env

# Редактируем переменные окружения
nano .env
```

### 3. Установка зависимостей
```bash
# Устанавливаем все зависимости
npm run install:all

# Или по отдельности
npm install
cd backend && npm install
cd ../frontend && npm install
cd ../mobile && npm install
```

### 4. Настройка базы данных
```bash
# Создаем базу данных PostgreSQL
createdb web3bank

# Запускаем миграции
cd backend && npm run db:migrate
```

### 5. Запуск приложения

#### Разработка
```bash
# Запуск всех сервисов
npm run dev

# Или по отдельности
npm run server  # Backend на порту 5000
npm run client  # Frontend на порту 3000
npm run mobile  # Mobile app
```

#### Продакшн с Docker
```bash
# Запуск с Docker Compose
./scripts/deploy.sh

# Или вручную
docker-compose up -d
```

## 🔧 Конфигурация

### Переменные окружения (.env)

#### База данных
```env
DATABASE_URL=postgresql://username:password@localhost:5432/web3bank
REDIS_URL=redis://localhost:6379
```

#### JWT и безопасность
```env
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=your-32-character-encryption-key
```

#### Open Bank Project
```env
OBP_API_HOST=https://apisandbox.openbankproject.com
OBP_CONSUMER_KEY=your-obp-consumer-key
OBP_CONSUMER_SECRET=your-obp-consumer-secret
```

#### Blockchain
```env
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/your-infura-key
POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/your-infura-key
BSC_RPC_URL=https://bsc-dataseed.binance.org
GETBLOCK_API_KEY=your-getblock-api-key
```

#### DeFi протоколы
```env
AAVE_POOL_ADDRESS=0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9
UNISWAP_V3_ROUTER=0xE592427A0AEce92De3Edee1F18E0157C05861564
BALANCER_VAULT=0xBA12222222228d8Ba445958a75a0704d566BF2C8
```

#### Платежные системы
```env
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
YUMONEY_CLIENT_ID=your-yumoney-client-id
PAYEER_MERCHANT_ID=your-payeer-merchant-id
ICARD_MERCHANT_ID=your-icard-merchant-id
```

#### AI сервисы
```env
OPENAI_API_KEY=sk-your-openai-api-key
OPENROUTER_API_KEY=sk-or-your-openrouter-api-key
```

#### Биржи
```env
BYBIT_API_KEY=your-bybit-api-key
BYBIT_SECRET_KEY=your-bybit-secret-key
```

#### Токен банка
```env
BANK_TOKEN_NAME=MoneraToken
BANK_TOKEN_SYMBOL=MNR
BANK_TOKEN_TOTAL_SUPPLY=1000000000
BANK_TOKEN_DECIMALS=18
```

## 📱 Мобильное приложение

### Установка Expo CLI
```bash
npm install -g @expo/cli
```

### Запуск мобильного приложения
```bash
cd mobile
npm start
```

### Сборка для продакшн
```bash
# Android
expo build:android

# iOS
expo build:ios
```

## 🏗 Архитектура

```
web3-bank-monera/
├── backend/                 # Backend API (Node.js + Express)
│   ├── src/
│   │   ├── config/         # Конфигурация сервисов
│   │   ├── routes/         # API маршруты
│   │   ├── middleware/      # Middleware функции
│   │   ├── utils/          # Утилиты
│   │   └── index.js        # Точка входа
│   ├── scripts/            # Скрипты развертывания
│   └── package.json
├── frontend/               # Web интерфейс (React)
│   ├── src/
│   │   ├── components/     # React компоненты
│   │   ├── pages/          # Страницы
│   │   ├── contexts/       # React контексты
│   │   ├── services/       # API сервисы
│   │   └── App.tsx
│   └── package.json
├── mobile/                 # Мобильное приложение (React Native)
│   ├── src/
│   │   ├── screens/        # Экраны приложения
│   │   ├── components/     # Компоненты
│   │   ├── contexts/       # Контексты
│   │   └── services/       # API сервисы
│   ├── App.tsx
│   └── package.json
├── scripts/                # Скрипты развертывания
├── monitoring/             # Конфигурация мониторинга
├── docker-compose.yml      # Docker конфигурация
├── nginx.conf             # Nginx конфигурация
└── README.md
```

## 🔐 Безопасность

### Аутентификация
- JWT токены с истечением срока действия
- Двухфакторная аутентификация (2FA)
- Биометрическая аутентификация в мобильном приложении

### Шифрование
- Все приватные ключи шифруются
- Чувствительные данные в базе данных зашифрованы
- HTTPS для всех соединений

### Мониторинг
- Логирование всех операций
- Мониторинг подозрительной активности
- Алерты при аномалиях

## 📊 Мониторинг

### Prometheus + Grafana
- Метрики производительности
- Мониторинг использования ресурсов
- Дашборды для анализа

### ELK Stack
- Централизованное логирование
- Анализ логов
- Алерты при ошибках

### Health Checks
- Проверка состояния всех сервисов
- Автоматическое восстановление
- Уведомления о проблемах

## 🚀 Развертывание

### Docker (Рекомендуется)
```bash
# Полное развертывание
./scripts/deploy.sh

# Или вручную
docker-compose up -d
```

### Ручное развертывание
```bash
# 1. Установка зависимостей
npm run install:all

# 2. Настройка базы данных
createdb web3bank
cd backend && npm run db:migrate

# 3. Запуск сервисов
npm run dev
```

### Продакшн
- Используйте Docker для изоляции
- Настройте SSL сертификаты
- Настройте мониторинг
- Настройте резервное копирование

## 🔧 API Документация

### Основные эндпоинты

#### Аутентификация
- `POST /api/auth/login` - Вход в систему
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/chat` - AI чат

#### Банковские операции
- `GET /api/accounts` - Получить счета
- `GET /api/transactions` - История транзакций
- `POST /api/transactions` - Создать транзакцию

#### DeFi операции
- `GET /api/defi/positions` - DeFi позиции
- `POST /api/defi/aave/supply` - Предоставить ликвидность в Aave
- `POST /api/defi/uniswap/swap` - Обмен токенов в Uniswap

#### Платежи
- `GET /api/payments/methods` - Методы платежей
- `POST /api/payments/stripe/create-payment-intent` - Создать платеж Stripe

#### AI
- `POST /api/ai/chat` - AI чат
- `POST /api/ai/analyze-transaction` - Анализ транзакции

## 📱 Мобильное приложение

### Функции
- Полный банковский функционал
- DeFi операции
- Торговля на биржах
- AI ассистент
- Биометрическая аутентификация
- Push уведомления

### Установка
```bash
# Установка Expo CLI
npm install -g @expo/cli

# Запуск приложения
cd mobile
npm start

# Сканирование QR кода в Expo Go
```

## 🌍 Мультиязычность

Поддерживаемые языки:
- 🇧🇬 Болгарский (по умолчанию)
- 🇺🇸 Английский
- 🇷🇺 Русский
- 🇩🇪 Немецкий
- 🇫🇷 Французский
- 🇪🇸 Испанский

## 🪙 Внутренний токен (MNR)

### Механизм работы
- Эмиссия: 1 миллиард токенов
- Сжигание: 0.1% от каждой транзакции
- Заработок: 5% от комиссий
- Автоматическая эмиссия при достижении 0

### Использование
- Оплата комиссий
- Получение скидок
- Участие в голосовании
- Стейкинг

## 🔐 Админ-панель

### Функции администратора
- Просмотр всех пользователей
- Управление транзакциями
- Настройки системы
- Вывод средств на указанный кошелек
- Мониторинг системы

### Доступ
- Только для администраторов
- Проверка по wallet address
- Дополнительная аутентификация

## 📈 Мониторинг и аналитика

### Метрики
- Количество пользователей
- Объем транзакций
- DeFi позиции
- Использование AI
- Производительность системы

### Дашборды
- Общая статистика
- Финансовые показатели
- Пользовательская активность
- Системные метрики

## 🚨 Алерты

### Автоматические уведомления
- Критические ошибки
- Подозрительная активность
- Превышение лимитов
- Проблемы с сервисами

## 📚 Документация

- [API Документация](http://localhost:5000/api-docs)
- [Админ панель](http://localhost:3000/admin)
- [Мониторинг](http://localhost:3001)
- [Логи](http://localhost:5601)

## 🤝 Поддержка

### Контакты
- Email: support@web3bankmonera.com
- Telegram: @web3bankmonera
- Discord: Web3 Bank Monera

### Сообщество
- GitHub Issues
- Telegram группа
- Discord сервер

## 📄 Лицензия

MIT License - см. файл [LICENSE](LICENSE)

## 🙏 Благодарности

- Open Bank Project за основу банковского функционала
- Ethereum Foundation за блокчейн инфраструктуру
- DeFi протоколы за интеграцию
- Сообщество разработчиков за вклад

---

**⚠️ Важно**: Это демонстрационный проект. Для продакшн использования необходимо:
- Получить банковскую лицензию
- Пройти аудит безопасности
- Настроить соответствие регуляциям
- Получить необходимые сертификаты