import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useI18n } from '../src/context/I18nContext';
import { useTheme } from '../src/context/ThemeContext';
import syncService from '../src/services/sync.service';
import { Transaction } from '../src/types';
import { formatCurrency } from '../src/utils/currency';

export default function TransactionDetailsScreen(): React.JSX.Element {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const [transaction, setTransaction] = useState<Transaction>(route.params.transaction);
  const [payment, setPayment] = useState('');
  const [saving, setSaving] = useState(false);
  const total = Number(transaction.amount);
  const paid = Number(transaction.paidAmount || 0);
  const remaining = Math.max(total - paid, 0);

  const addPayment = async () => {
    const amount = Number(payment);
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
      Alert.alert(t('app.error'), t('latestTransactions.invalidPayment'));
      return;
    }
    setSaving(true);
    const newPaid = paid + amount;
    const updated = await syncService.updateLocalTransaction(transaction.id, {
      paidAmount: String(newPaid),
      paymentStatus: newPaid >= total ? 'PAID' : 'PARTIAL',
    });
    setSaving(false);
    if (updated) {
      setTransaction(updated);
      setPayment('');
      Alert.alert(t('app.success'), t('latestTransactions.paymentSaved'));
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>{t('app.back')}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('latestTransactions.details')}</Text>
        <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.category, { color: colors.text }]}>{transaction.category?.name || t('latestTransactions.uncategorized')}</Text>
          <Text style={[styles.total, { color: transaction.type === 'INCOME' ? colors.income : colors.expense }]}>{formatCurrency(total, { locale })}</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>{new Date(transaction.createdAt).toLocaleString(locale)}</Text>
          {!!transaction.description && <Text style={[styles.description, { color: colors.text }]}>{transaction.description}</Text>}
        </View>
        {transaction.receiptUrl && <Image source={{ uri: transaction.receiptUrl }} style={styles.receipt} resizeMode="contain" />}
        <View style={[styles.paymentSection, { borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('latestTransactions.payment')}</Text>
          <Text style={[styles.paymentLine, { color: colors.textSecondary }]}>{t('latestTransactions.paid')}: {formatCurrency(paid, { locale })}</Text>
          <Text style={[styles.paymentLine, { color: colors.textSecondary }]}>{t('latestTransactions.remaining')}: {formatCurrency(remaining, { locale })}</Text>
          {remaining > 0 && <>
            <TextInput
              value={payment}
              onChangeText={setPayment}
              keyboardType="decimal-pad"
              placeholder={t('latestTransactions.paymentPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <TouchableOpacity disabled={saving} style={[styles.button, { backgroundColor: colors.primary }]} onPress={addPayment}>
              <Text style={[styles.buttonText, { color: colors.textInverse }]}>{t('latestTransactions.addPayment')}</Text>
            </TouchableOpacity>
          </>}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: 20, paddingBottom: 40 }, back: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 }, backText: { fontSize: 16 }, title: { fontSize: 28, fontWeight: '700', marginBottom: 18 }, summary: { borderWidth: 1, padding: 18, borderRadius: 8 }, category: { fontSize: 18, fontWeight: '600' }, total: { fontSize: 30, fontWeight: '700', marginVertical: 10 }, meta: { fontSize: 13 }, description: { marginTop: 12, fontSize: 15 }, receipt: { width: '100%', height: 260, marginTop: 18 }, paymentSection: { borderTopWidth: 1, marginTop: 22, paddingTop: 18 }, sectionTitle: { fontSize: 19, fontWeight: '700', marginBottom: 10 }, paymentLine: { fontSize: 15, marginBottom: 6 }, input: { borderWidth: 1, borderRadius: 6, padding: 12, marginTop: 14, fontSize: 16 }, button: { padding: 14, borderRadius: 6, alignItems: 'center', marginTop: 12 }, buttonText: { fontSize: 16, fontWeight: '700' },
});
