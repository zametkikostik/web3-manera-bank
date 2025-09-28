const OpenAI = require('openai');
const axios = require('axios');
const logger = require('../utils/logger');

let openai;
let openrouter;

const setupAI = async () => {
  try {
    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      logger.info('✅ OpenAI initialized');
    }

    // Initialize OpenRouter
    if (process.env.OPENROUTER_API_KEY) {
      openrouter = axios.create({
        baseURL: 'https://openrouter.ai/api/v1',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      logger.info('✅ OpenRouter initialized');
    }

    logger.info('✅ AI services initialized successfully');
    
  } catch (error) {
    logger.error('❌ AI setup failed:', error);
    throw error;
  }
};

const generateResponse = async (message, model = 'gpt-4', service = 'openai') => {
  try {
    let response;
    
    if (service === 'openai' && openai) {
      response = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'system',
            content: `You are a helpful banking assistant for Web3 Bank Monera. You can help with:
            - Banking operations and account management
            - DeFi protocols (Aave, Uniswap, Balancer)
            - Cryptocurrency trading and portfolio management
            - Blockchain transactions and gas optimization
            - Financial advice and market analysis
            - Multi-language support (Bulgarian, English, Russian, German, French, Spanish)
            
            Always provide accurate, helpful, and secure financial advice. Never share private keys or sensitive information.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });
      
      return {
        content: response.choices[0].message.content,
        model: model,
        service: 'openai',
        tokens: response.usage.total_tokens
      };
      
    } else if (service === 'openrouter' && openrouter) {
      const response = await openrouter.post('/chat/completions', {
        model: model,
        messages: [
          {
            role: 'system',
            content: `You are a helpful banking assistant for Web3 Bank Monera. You can help with:
            - Banking operations and account management
            - DeFi protocols (Aave, Uniswap, Balancer)
            - Cryptocurrency trading and portfolio management
            - Blockchain transactions and gas optimization
            - Financial advice and market analysis
            - Multi-language support (Bulgarian, English, Russian, German, French, Spanish)
            
            Always provide accurate, helpful, and secure financial advice. Never share private keys or sensitive information.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });
      
      return {
        content: response.data.choices[0].message.content,
        model: model,
        service: 'openrouter',
        tokens: response.data.usage.total_tokens
      };
    }
    
    throw new Error('AI service not available');
    
  } catch (error) {
    logger.error('AI generation failed:', error);
    throw error;
  }
};

const analyzeTransaction = async (transactionData) => {
  try {
    const prompt = `Analyze this banking transaction and provide insights:
    
    Transaction Data: ${JSON.stringify(transactionData, null, 2)}
    
    Please provide:
    1. Risk assessment (low/medium/high)
    2. Potential fraud indicators
    3. Compliance recommendations
    4. Optimization suggestions
    5. User notification recommendations`;
    
    return await generateResponse(prompt, 'gpt-4', 'openai');
  } catch (error) {
    logger.error('Transaction analysis failed:', error);
    throw error;
  }
};

const generatePortfolioAdvice = async (portfolioData, userPreferences) => {
  try {
    const prompt = `Analyze this investment portfolio and provide personalized advice:
    
    Portfolio: ${JSON.stringify(portfolioData, null, 2)}
    User Preferences: ${JSON.stringify(userPreferences, null, 2)}
    
    Please provide:
    1. Portfolio diversification analysis
    2. Risk assessment
    3. Rebalancing recommendations
    4. DeFi opportunities
    5. Market outlook and trends`;
    
    return await generateResponse(prompt, 'gpt-4', 'openai');
  } catch (error) {
    logger.error('Portfolio analysis failed:', error);
    throw error;
  }
};

const translateText = async (text, targetLanguage = 'bg') => {
  try {
    const prompt = `Translate the following text to ${targetLanguage}:
    
    "${text}"
    
    Provide only the translation, no additional text.`;
    
    return await generateResponse(prompt, 'gpt-3.5-turbo', 'openai');
  } catch (error) {
    logger.error('Translation failed:', error);
    throw error;
  }
};

const generateMarketReport = async (assets, timeframe = '24h') => {
  try {
    const prompt = `Generate a comprehensive market report for these assets: ${assets.join(', ')} for the ${timeframe} timeframe.
    
    Include:
    1. Price movements and trends
    2. Volume analysis
    3. Technical indicators
    4. Market sentiment
    5. DeFi opportunities
    6. Risk factors
    7. Trading recommendations`;
    
    return await generateResponse(prompt, 'gpt-4', 'openai');
  } catch (error) {
    logger.error('Market report generation failed:', error);
    throw error;
  }
};

const detectFraud = async (transactionData, userHistory) => {
  try {
    const prompt = `Analyze this transaction for potential fraud:
    
    Transaction: ${JSON.stringify(transactionData, null, 2)}
    User History: ${JSON.stringify(userHistory, null, 2)}
    
    Provide:
    1. Fraud probability (0-100%)
    2. Risk factors identified
    3. Recommended actions
    4. Additional verification needed`;
    
    return await generateResponse(prompt, 'gpt-4', 'openai');
  } catch (error) {
    logger.error('Fraud detection failed:', error);
    throw error;
  }
};

module.exports = {
  setupAI,
  generateResponse,
  analyzeTransaction,
  generatePortfolioAdvice,
  translateText,
  generateMarketReport,
  detectFraud
};