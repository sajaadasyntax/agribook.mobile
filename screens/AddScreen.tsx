import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '../src/context/UserContext';
import { categoryApi, transactionApi } from '../src/services/api.service';
import { Category, CreateTransactionDto } from '../src/types';

export default function AddScreen(): JSX.Element {
  const { isAuthenticated } = useUser();
  const [entryType, setEntryType] = useState<'income' | 'expense'>('income');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const loadCategories = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setLoadingCategories(true);
      const type = entryType === 'income' ? 'INCOME' : 'EXPENSE';
      const cats = await categoryApi.getAll(type);
      setCategories(cats);
      setSelectedCategory('');
    } catch (error) {
      console.error('Error loading categories:', error);
      Alert.alert('Error', 'Failed to load categories');
    } finally {
      setLoadingCategories(false);
    }
  }, [entryType, isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories])
  );

  const handleSave = async () => {
    if (!selectedCategory || !amount) {
      Alert.alert('Error', 'Please select a category and enter an amount');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      setLoading(true);
      const data: CreateTransactionDto = {
        type: entryType.toUpperCase() as 'INCOME' | 'EXPENSE',
        amount: amountNum,
        categoryId: selectedCategory,
        description: notes || undefined,
      };

      await transactionApi.create(data);
      Alert.alert('Success', `Transaction saved successfully`);

      // Reset form
      setAmount('');
      setNotes('');
      setSelectedCategory('');
    } catch (error) {
      console.error('Error saving transaction:', error);
      Alert.alert('Error', 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndNew = async () => {
    await handleSave();
    // Form is already reset, just need to keep entry type
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Add Transaction</Text>
      </View>

      {/* Type Selector */}
      <View style={styles.section}>
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[styles.typeButton, entryType === 'income' && styles.typeButtonActive]}
            onPress={() => {
              setEntryType('income');
              setSelectedCategory('');
            }}
          >
            <Icon name="add" size={24} color={entryType === 'income' ? '#fff' : '#4CAF50'} />
            <Text
              style={[
                styles.typeButtonText,
                entryType === 'income' && styles.typeButtonTextActive,
              ]}
            >
              Income
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, entryType === 'expense' && styles.typeButtonActive]}
            onPress={() => {
              setEntryType('expense');
              setSelectedCategory('');
            }}
          >
            <Icon name="remove" size={24} color={entryType === 'expense' ? '#fff' : '#F44336'} />
            <Text
              style={[
                styles.typeButtonText,
                entryType === 'expense' && styles.typeButtonTextActive,
              ]}
            >
              Expense
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Entry Form */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {entryType === 'income' ? 'Income' : 'Expense'} Entry
        </Text>

        {/* Category Selection */}
        <Text style={styles.label}>Category</Text>
        {loadingCategories ? (
          <ActivityIndicator size="small" color="#4CAF50" style={styles.loader} />
        ) : (
          <View style={styles.categoryButtons}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryButton,
                  selectedCategory === cat.id && styles.categoryButtonActive,
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    selectedCategory === cat.id && styles.categoryButtonTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Amount Input */}
        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          placeholder={entryType === 'income' ? 'e.g., 1200' : 'e.g., 450'}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />

        {/* Notes Input */}
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Add description"
          multiline
          numberOfLines={4}
          value={notes}
          onChangeText={setNotes}
        />

        {/* Save Buttons */}
        <View style={styles.saveButtons}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              entryType === 'income' ? styles.saveIncomeButton : styles.saveExpenseButton,
            ]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>
                Save {entryType === 'income' ? 'Income' : 'Expense'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, styles.saveNewButton]}
            onPress={handleSaveAndNew}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>Save & New</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E9',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
    backgroundColor: '#fff',
    gap: 8,
  },
  typeButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  loader: {
    marginVertical: 12,
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  categoryButtonActive: {
    backgroundColor: '#4CAF50',
  },
  categoryButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveIncomeButton: {
    backgroundColor: '#4CAF50',
  },
  saveExpenseButton: {
    backgroundColor: '#F44336',
  },
  saveNewButton: {
    backgroundColor: '#81C784',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

