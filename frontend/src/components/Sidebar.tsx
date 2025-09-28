import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  CreditCard, 
  ArrowLeftRight, 
  TrendingUp, 
  DollarSign, 
  Bot, 
  Coins, 
  User, 
  Settings, 
  Shield,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  const navigation = [
    { name: t('dashboard'), href: '/dashboard', icon: Home },
    { name: t('banking.accounts'), href: '/accounts', icon: CreditCard },
    { name: t('banking.transactions'), href: '/transactions', icon: ArrowLeftRight },
    { name: t('defi.protocols'), href: '/defi', icon: TrendingUp },
    { name: t('exchange.trading'), href: '/exchange', icon: DollarSign },
    { name: t('payments.methods'), href: '/payments', icon: CreditCard },
    { name: t('ai.assistant'), href: '/ai', icon: Bot },
    { name: t('tokens.balance'), href: '/tokens', icon: Coins },
  ];

  const userNavigation = [
    { name: t('profile'), href: '/profile', icon: User },
    { name: t('settings'), href: '/settings', icon: Settings },
  ];

  // Add admin navigation if user is admin
  const adminNavigation = user?.walletAddress === process.env.REACT_APP_ADMIN_WALLET_ADDRESS ? [
    { name: t('admin.dashboard'), href: '/admin', icon: Shield },
  ] : [];

  const allNavigation = [...navigation, ...userNavigation, ...adminNavigation];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">M</span>
                </div>
              </div>
              <div className="ml-3">
                <h1 className="text-lg font-semibold text-gray-900">Monera Bank</h1>
                <p className="text-xs text-gray-500">Web3 Banking</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {allNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={onClose}
                  className={`
                    group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200
                    ${isActive
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <item.icon
                    className={`
                      mr-3 h-5 w-5 flex-shrink-0
                      ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}
                    `}
                  />
                  {item.name}
                </NavLink>
              );
            })}
          </nav>

          {/* User info */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-700">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;