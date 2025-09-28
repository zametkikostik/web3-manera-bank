const { ethers } = require('ethers');
const Web3 = require('web3');
const logger = require('../utils/logger');

let providers = {};
let contracts = {};

const setupWeb3 = async () => {
  try {
    // Ethereum provider
    providers.ethereum = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
    
    // Polygon provider
    providers.polygon = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    
    // BSC provider
    providers.bsc = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
    
    // GetBlock provider (if configured)
    if (process.env.GETBLOCK_NODE_URL) {
      providers.getblock = new ethers.JsonRpcProvider(process.env.GETBLOCK_NODE_URL);
    }

    // Test connections
    for (const [network, provider] of Object.entries(providers)) {
      try {
        const blockNumber = await provider.getBlockNumber();
        logger.info(`✅ ${network} provider connected, latest block: ${blockNumber}`);
      } catch (error) {
        logger.warn(`⚠️ ${network} provider connection failed:`, error.message);
      }
    }

    // Initialize DeFi contracts
    await initializeContracts();
    
    logger.info('✅ Web3 providers initialized successfully');
    
  } catch (error) {
    logger.error('❌ Web3 setup failed:', error);
    throw error;
  }
};

const initializeContracts = async () => {
  try {
    // Aave Lending Pool
    if (process.env.AAVE_POOL_ADDRESS) {
      const aaveABI = [
        "function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external",
        "function withdraw(address asset, uint256 amount, address to) external returns (uint256)",
        "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external",
        "function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) external returns (uint256)",
        "function getUserAccountData(address user) external view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)"
      ];
      
      contracts.aave = new ethers.Contract(
        process.env.AAVE_POOL_ADDRESS,
        aaveABI,
        providers.ethereum
      );
    }

    // Uniswap V3 Router
    if (process.env.UNISWAP_V3_ROUTER) {
      const uniswapABI = [
        "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut)",
        "function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum) external returns (uint256 amountOut)"
      ];
      
      contracts.uniswap = new ethers.Contract(
        process.env.UNISWAP_V3_ROUTER,
        uniswapABI,
        providers.ethereum
      );
    }

    // Balancer Vault
    if (process.env.BALANCER_VAULT) {
      const balancerABI = [
        "function swap((bytes32 poolId, uint8 kind, address assetIn, address assetOut, uint256 amount, bytes userData), (address sender, bool fromInternalBalance, address recipient, bool toInternalBalance), uint256 limit, uint256 deadline) external returns (uint256 amountCalculated)",
        "function joinPool(bytes32 poolId, address sender, address recipient, (address[] assets, uint256[] maxAmountsIn, bytes userData, bool fromInternalBalance)) external",
        "function exitPool(bytes32 poolId, address sender, address recipient, (address[] assets, uint256[] minAmountsOut, bytes userData, bool toInternalBalance)) external"
      ];
      
      contracts.balancer = new ethers.Contract(
        process.env.BALANCER_VAULT,
        balancerABI,
        providers.ethereum
      );
    }

    logger.info('✅ DeFi contracts initialized');
    
  } catch (error) {
    logger.error('❌ Failed to initialize contracts:', error);
    throw error;
  }
};

const getProvider = (network = 'ethereum') => {
  return providers[network];
};

const getContract = (name) => {
  return contracts[name];
};

const createWallet = () => {
  return ethers.Wallet.createRandom();
};

const getWallet = (privateKey) => {
  return new ethers.Wallet(privateKey, providers.ethereum);
};

const encryptPrivateKey = (privateKey, password) => {
  // In production, use a proper encryption library
  const crypto = require('crypto');
  const cipher = crypto.createCipher('aes-256-cbc', password);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

const decryptPrivateKey = (encryptedKey, password) => {
  const crypto = require('crypto');
  const decipher = crypto.createDecipher('aes-256-cbc', password);
  let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

const getGasPrice = async (network = 'ethereum') => {
  try {
    const provider = getProvider(network);
    const feeData = await provider.getFeeData();
    return {
      gasPrice: feeData.gasPrice,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
    };
  } catch (error) {
    logger.error('Failed to get gas price:', error);
    throw error;
  }
};

const estimateGas = async (transaction, network = 'ethereum') => {
  try {
    const provider = getProvider(network);
    return await provider.estimateGas(transaction);
  } catch (error) {
    logger.error('Failed to estimate gas:', error);
    throw error;
  }
};

module.exports = {
  setupWeb3,
  getProvider,
  getContract,
  createWallet,
  getWallet,
  encryptPrivateKey,
  decryptPrivateKey,
  getGasPrice,
  estimateGas
};