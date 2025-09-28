import React from 'react';
import { useQuery } from 'react-query';
import { 
  CreditCard, 
  TrendingUp, 
  DollarSign, 
  Coins, 
  ArrowUpRight, 
  ArrowDownRight,
  Activity,
  Users,
  Zap
} from 'lucide-react';
import { accountsAPI, transactionsAPI, tokensAPI, defiAPI } from '../services/api';
import { useTranslation } from 'react-i18next';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();

  // Fetch dashboard data
  const { data: accounts } = useQuery('accounts', () => accountsAPI.getAccounts());
  const { data: transactions } = useQuery('recent-transactions', () => 
    transactionsAPI.getTransactions({ limit: 5 })
  );
  const { data: tokenBalance } = useQuery('token-balance', () => tokensAPI.getBalance());
  const { data: defiPositions } = useQuery('defi-positions', () => defiAPI.getPositions());

  const totalBalance = accounts?.data?.reduce((sum: number, account: any) => 
    sum + parseFloat(account.balance || 0), 0
  ) || 0;

  const totalDefiValue = defiPositions?.data?.reduce((sum: number, position: any) => 
    sum + parseFloat(position.amount || 0), 0
  ) || 0;

  const stats = [
    {
      name: t('banking.balance'),
      value: `${totalBalance.toFixed(2)} BGN`,
      change: '+2.5%',
      changeType: 'positive',
      icon: CreditCard,
    },
    {
      name: t('defi.protocols'),
      value: `${totalDefiValue.toFixed(2)} USD`,
      change: '+12.3%',
      changeType: 'positive',
      icon: TrendingUp,
    },
    {
      name: t('tokens.balance'),
      value: `${tokenBalance?.data?.balance || 0} MNR`,
      change: '+5.2%',
      changeType: 'positive',
      icon: Coins,
    },
    {
      name: t('exchange.trading'),
      value: '24.5%',
      change: '+8.1%',
      changeType: 'positive',
      icon: Activity,
    },
  ];

  const recentTransactions = transactions?.data?.transactions || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard')}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('welcome')} - {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow-sm ring-1 ring-gray-200"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <stat.icon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center">
              {stat.changeType === 'positive' ? (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              )}
              <span className={`ml-1 text-sm font-medium ${
                stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
              }`}>
                {stat.change}
              </span>
              <span className="ml-1 text-sm text-gray-500">vs last month</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Transactions */}
        <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {t('banking.transactions')}
            </h3>
            <div className="space-y-3">
              {recentTransactions.map((transaction: any) => (
                <div key={transaction.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 w-2 h-2 rounded-full ${
                      transaction.status === 'completed' ? 'bg-green-500' :
                      transaction.status === 'pending' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`} />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {transaction.description || 'Transaction'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(transaction.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${
                      transaction.transaction_type === 'deposit' ? 'text-green-600' :
                      transaction.transaction_type === 'withdrawal' ? 'text-red-600' :
                      'text-gray-900'
                    }`}>
                      {transaction.transaction_type === 'deposit' ? '+' : '-'}
                      {transaction.amount} {transaction.currency}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {transaction.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* DeFi Positions */}
        <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {t('defi.protocols')}
            </h3>
            <div className="space-y-3">
              {defiPositions?.data?.positions?.slice(0, 3).map((position: any) => (
                <div key={position.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">
                          {position.protocol[0].toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {position.protocol} - {position.asset}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {position.position_type}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {position.amount} {position.asset}
                    </p>
                    <p className="text-xs text-green-600">
                      {position.apy}% APY
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {t('quickActions')}
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <ArrowUpRight className="h-6 w-6 text-blue-500 mb-2" />
              <span className="text-sm font-medium text-gray-900">{t('banking.transfer')}</span>
            </button>
            <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <TrendingUp className="h-6 w-6 text-green-500 mb-2" />
              <span className="text-sm font-medium text-gray-900">{t('defi.lending')}</span>
            </button>
            <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <DollarSign className="h-6 w-6 text-purple-500 mb-2" />
              <span className="text-sm font-medium text-gray-900">{t('exchange.trading')}</span>
            </button>
            <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Zap className="h-6 w-6 text-yellow-500 mb-2" />
              <span className="text-sm font-medium text-gray-900">{t('ai.assistant')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;