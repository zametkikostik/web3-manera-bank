const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'web3-bank-monera' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Add request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId || null
    };
    
    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });
  
  next();
};

// Security event logger
const securityLogger = {
  loginAttempt: (email, ip, success) => {
    logger.warn('Login attempt', {
      event: 'login_attempt',
      email,
      ip,
      success,
      timestamp: new Date().toISOString()
    });
  },
  
  suspiciousActivity: (userId, activity, details) => {
    logger.error('Suspicious activity detected', {
      event: 'suspicious_activity',
      userId,
      activity,
      details,
      timestamp: new Date().toISOString()
    });
  },
  
  transactionAlert: (userId, transactionId, alertType, details) => {
    logger.warn('Transaction alert', {
      event: 'transaction_alert',
      userId,
      transactionId,
      alertType,
      details,
      timestamp: new Date().toISOString()
    });
  },
  
  adminAction: (adminId, action, target, details) => {
    logger.info('Admin action', {
      event: 'admin_action',
      adminId,
      action,
      target,
      details,
      timestamp: new Date().toISOString()
    });
  }
};

// Performance logger
const performanceLogger = {
  databaseQuery: (query, duration, rows) => {
    if (duration > 1000) { // Log slow queries
      logger.warn('Slow database query', {
        event: 'slow_query',
        query: query.substring(0, 100) + '...',
        duration: `${duration}ms`,
        rows
      });
    }
  },
  
  apiCall: (service, endpoint, duration, status) => {
    logger.info('External API call', {
      event: 'api_call',
      service,
      endpoint,
      duration: `${duration}ms`,
      status
    });
  },
  
  blockchainTransaction: (network, txHash, duration, gasUsed) => {
    logger.info('Blockchain transaction', {
      event: 'blockchain_tx',
      network,
      txHash,
      duration: `${duration}ms`,
      gasUsed
    });
  }
};

module.exports = {
  logger,
  requestLogger,
  securityLogger,
  performanceLogger
};