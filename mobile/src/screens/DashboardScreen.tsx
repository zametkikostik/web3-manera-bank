import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useQuery } from 'react-query';
import { LinearGradient } from 'react-native-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { accountsAPI, transactionsAPI, tokensAPI, defiAPI } from '../services/api';
import { useTranslation } from 'react-i18next';

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation();
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

  const quickActions = [
    {
      title: t('banking.transfer'),
      icon: 'send',
      color: '#3B82F6',
      onPress: () => navigation.navigate('Transactions'),
    },
    {
      title: t('defi.lending'),
      icon: 'trending-up',
      color: '#10B981',
      onPress: () => navigation.navigate('DeFi'),
    },
    {
      title: t('exchange.trading'),
      icon: 'swap-horiz',
      color: '#8B5CF6',
      onPress: () => navigation.navigate('Exchange'),
    },
    {
      title: t('ai.assistant'),
      icon: 'smart-toy',
      color: '#F59E0B',
      onPress: () => navigation.navigate('AIAssistant'),
    },
  ];

  const recentTransactions = transactions?.data?.transactions || [];

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#3B82F6', '#1D4ED8']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={styles.welcomeText}>{t('welcome')}</Text>
          <Text style={styles.balanceText}>
            {totalBalance.toFixed(2)} BGN
          </Text>
          <Text style={styles.balanceLabel}>{t('banking.balance')}</Text>
        </View>
      </LinearGradient>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <MaterialIcons name="account-balance" size={24} color="#3B82F6" />
          <Text style={styles.statValue}>{totalBalance.toFixed(2)}</Text>
          <Text style={styles.statLabel}>BGN</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialIcons name="trending-up" size={24} color="#10B981" />
          <Text style={styles.statValue}>{totalDefiValue.toFixed(2)}</Text>
          <Text style={styles.statLabel}>USD</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialIcons name="monetization-on" size={24} color="#F59E0B" />
          <Text style={styles.statValue}>{tokenBalance?.data?.balance || 0}</Text>
          <Text style={styles.statLabel}>MNR</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('quickActions')}</Text>
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.quickActionButton, { backgroundColor: action.color }]}
              onPress={action.onPress}
            >
              <MaterialIcons name={action.icon as any} size={24} color="white" />
              <Text style={styles.quickActionText}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Recent Transactions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('banking.transactions')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
            <Text style={styles.seeAllText}>{t('seeAll')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.transactionsList}>
          {recentTransactions.map((transaction: any) => (
            <View key={transaction.id} style={styles.transactionItem}>
              <View style={styles.transactionIcon}>
                <MaterialIcons 
                  name={transaction.transaction_type === 'deposit' ? 'arrow-downward' : 'arrow-upward'} 
                  size={20} 
                  color={transaction.transaction_type === 'deposit' ? '#10B981' : '#EF4444'} 
                />
              </View>
              <View style={styles.transactionDetails}>
                <Text style={styles.transactionDescription}>
                  {transaction.description || 'Transaction'}
                </Text>
                <Text style={styles.transactionDate}>
                  {new Date(transaction.created_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.transactionAmount}>
                <Text style={[
                  styles.transactionAmountText,
                  { color: transaction.transaction_type === 'deposit' ? '#10B981' : '#EF4444' }
                ]}>
                  {transaction.transaction_type === 'deposit' ? '+' : '-'}
                  {transaction.amount} {transaction.currency}
                </Text>
                <Text style={styles.transactionStatus}>
                  {transaction.status}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* DeFi Positions */}
      {defiPositions?.data?.positions?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('defi.protocols')}</Text>
          <View style={styles.defiPositionsList}>
            {defiPositions.data.positions.slice(0, 3).map((position: any) => (
              <View key={position.id} style={styles.defiPositionItem}>
                <View style={styles.defiPositionIcon}>
                  <Text style={styles.defiPositionIconText}>
                    {position.protocol[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.defiPositionDetails}>
                  <Text style={styles.defiPositionProtocol}>
                    {position.protocol} - {position.asset}
                  </Text>
                  <Text style={styles.defiPositionType}>
                    {position.position_type}
                  </Text>
                </View>
                <View style={styles.defiPositionAmount}>
                  <Text style={styles.defiPositionAmountText}>
                    {position.amount} {position.asset}
                  </Text>
                  <Text style={styles.defiPositionApy}>
                    {position.apy}% APY
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 18,
    color: 'white',
    marginBottom: 10,
  },
  balanceText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -20,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    marginHorizontal: 5,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  seeAllText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    width: '48%',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  quickActionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  transactionsList: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  transactionDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  transactionStatus: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  defiPositionsList: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
  },
  defiPositionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  defiPositionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  defiPositionIconText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  defiPositionDetails: {
    flex: 1,
  },
  defiPositionProtocol: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  defiPositionType: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  defiPositionAmount: {
    alignItems: 'flex-end',
  },
  defiPositionAmountText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  defiPositionApy: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 2,
  },
});

export default DashboardScreen;