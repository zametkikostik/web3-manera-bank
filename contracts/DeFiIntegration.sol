// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external;
}

interface IUniswapRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

contract DeFiIntegration is Ownable {
    IAavePool public aavePool;
    IUniswapRouter public uniswapRouter;
    address public aavePoolAddress;
    address public uniswapRouterAddress;

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setAavePool(address _aavePool) external onlyOwner {
        aavePool = IAavePool(_aavePool);
        aavePoolAddress = _aavePool;
    }

    function setUniswapRouter(address _uniswapRouter) external onlyOwner {
        uniswapRouter = IUniswapRouter(_uniswapRouter);
        uniswapRouterAddress = _uniswapRouter;
    }

    function depositToAave(address token, uint256 amount) external onlyOwner {
        IERC20(token).approve(aavePoolAddress, amount);
        aavePool.supply(token, amount, address(this), 0);
    }

    function swapOnUniswap(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        uint deadline
    ) external onlyOwner {
        IERC20(path[0]).approve(uniswapRouterAddress, amountIn);
        uniswapRouter.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            address(this),
            deadline
        );
    }
}