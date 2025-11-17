import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function AddScreen() {
  const [entryType, setEntryType] = useState('income'); // 'income' or 'expense'
  const [selectedCategory, setSelectedCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const incomeCategories = ['Sales', 'Processing', 'Packaging', 'Other'];
  const expenseCategories = ['Seeds', 'Transport', 'Labor', 'Utilities'];

  const categories = entryType === 'income' ? incomeCategories : expenseCategories;

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
            onPress={() => setEntryType('income')}
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
            onPress={() => setEntryType('expense')}
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
        <View style={styles.categoryButtons}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryButton,
                selectedCategory === cat && styles.categoryButtonActive,
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryButtonText,
                  selectedCategory === cat && styles.categoryButtonTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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

        {/* File Attachment */}
        <View style={styles.fileAttachment}>
          <Text style={styles.fileLabel}>
            {entryType === 'income' ? 'Attach photo/receipt:' : 'Attach receipt:'}
          </Text>
          <TouchableOpacity style={styles.fileButton}>
            <Icon name="attach-file" size={20} color="#4CAF50" />
            <Text style={styles.fileButtonText}>Choose File</Text>
          </TouchableOpacity>
        </View>

        {/* Save Buttons */}
        <View style={styles.saveButtons}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              entryType === 'income' ? styles.saveIncomeButton : styles.saveExpenseButton,
            ]}
          >
            <Text style={styles.saveButtonText}>
              Save {entryType === 'income' ? 'Income' : 'Expense'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveButton, styles.saveNewButton]}>
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
  fileAttachment: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  fileLabel: {
    fontSize: 14,
    color: '#666',
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileButtonText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
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

