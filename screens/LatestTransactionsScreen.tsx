import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useI18n } from '../src/context/I18nContext';
import { useTheme } from '../src/context/ThemeContext';
import syncService from '../src/services/sync.service';
import { Transaction } from '../src/types';
import { formatCurrency } from '../src/utils/currency';

export default function LatestTransactionsScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setTransactions((await syncService.getAllTransactionsIncludingPending())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadTransactions(); }, [loadTransactions]));

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isIncome = item.type === 'INCOME';
    const status = item.paymentStatus || 'PAID';
    return (
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: colors.border }]}
        onPress={() => navigation.navigate('TransactionDetails', { transaction: item })}
      >
        <View style={[styles.icon, { backgroundColor: isIncome ? colors.income : colors.expense }]}>
          <Icon name={isIncome ? 'arrow-downward' : 'arrow-upward'} size={20} color={colors.textInverse} />
        </View>
        <View style={styles.rowContent}>
          <Text style={[styles.category, { color: colors.text }]}>{item.category?.name || t('latestTransactions.uncategorized')}</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>{new Date(item.createdAt).toLocaleDateString(locale)}</Text>
          {status !== 'PAID' && <Text style={[styles.status, { color: colors.warning }]}>{t(`latestTransactions.${status.toLowerCase()}`)}</Text>}
        </View>
        <View style={styles.amountBlock}>
          <Text style={[styles.amount, { color: isIncome ? colors.income : colors.expense }]}>
            {isIncome ? '+' : '-'}{formatCurrency(Number(item.amount), { locale })}
          </Text>
          <Icon name="chevron-right" size={22} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('latestTransactions.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('latestTransactions.subtitle')}</Text>
      </View>
      {loading ? <ActivityIndicator size="large" color={colors.primary} style={styles.loader} /> : (
        <FlatList
          data={transactions}
          keyExtractor={item => item.id}
          renderItem={renderTransaction}
          contentContainerStyle={transactions.length === 0 ? styles.emptyContainer : styles.list}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.textSecondary }]}>{t('latestTransactions.empty')}</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 22, paddingBottom: 14, width: '100%', maxWidth: 960, alignSelf: 'center' },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { marginTop: 5, fontSize: 14 },
  loader: { marginTop: 50 },
  list: { paddingHorizontal: 16, paddingBottom: 24, width: '100%', maxWidth: 960, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1, marginHorizontal: 12 },
  category: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 4 },
  status: { fontSize: 12, marginTop: 3 },
  amountBlock: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: 15, fontWeight: '700' },
  emptyContainer: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 16 },
});
