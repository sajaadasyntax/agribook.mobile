import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;

export default function HomeScreen() {
  const [language, setLanguage] = useState('EN');
  const [businessName, setBusinessName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [owner, setOwner] = useState('');
  const [location, setLocation] = useState('');

  const totalIncome = 12450;
  const totalExpense = 8320;
  const balance = totalIncome - totalExpense;

  const chartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        data: [2000, 2500, 3000, 2800, 3200, 3500, 4000, 3800, 4200, 4500, 4800, 5000],
        color: (opacity = 1) => `rgba(255, 152, 0, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.languageSelector}
          onPress={() => setLanguage(language === 'EN' ? 'AR' : 'EN')}
        >
          <Text style={[styles.langText, language === 'EN' && styles.langActive]}>EN</Text>
          <Text style={styles.langDivider}>|</Text>
          <Text style={[styles.langText, language === 'AR' && styles.langActive]}>العربية</Text>
        </TouchableOpacity>
        <Text style={styles.appTitle}>AgriBooks</Text>
        <TouchableOpacity>
          <Icon name="notifications" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Information</Text>
        <View style={styles.profileGrid}>
          <View style={styles.profileImageContainer}>
            <TouchableOpacity style={styles.profileImage}>
              <Icon name="image" size={24} color="#4CAF50" />
            </TouchableOpacity>
          </View>
          <View style={styles.inputGrid}>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Phone number"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
              />
              <TextInput
                style={styles.input}
                placeholder="OTP • • •"
                value={otp}
                onChangeText={setOtp}
                secureTextEntry
              />
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Business name"
                value={businessName}
                onChangeText={setBusinessName}
              />
              <TextInput
                style={styles.input}
                placeholder="Owner"
                value={owner}
                onChangeText={setOwner}
              />
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Type (Agriculture)"
                editable={false}
              />
              <TextInput
                style={styles.input}
                placeholder="Location"
                value={location}
                onChangeText={setLocation}
              />
            </View>
          </View>
        </View>
        <View style={styles.securitySection}>
          <Icon name="lock" size={20} color="#666" />
          <Text style={styles.securityText}>Secure with Fingerprint</Text>
        </View>
        <TouchableOpacity style={styles.saveButton}>
          <Icon name="check" size={20} color="#fff" />
          <Text style={styles.saveButtonText}>Save Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Financial Summary */}
      <View style={styles.section}>
        <View style={styles.financialCards}>
          <View style={[styles.financialCard, styles.incomeCard]}>
            <Text style={styles.financialLabel}>Total Income</Text>
            <Text style={[styles.financialAmount, styles.incomeAmount]}>
              ${totalIncome.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.financialCard, styles.expenseCard]}>
            <Text style={styles.financialLabel}>Total Expense</Text>
            <Text style={[styles.financialAmount, styles.expenseAmount]}>
              ${totalExpense.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.financialCard, styles.balanceCard]}>
            <Text style={styles.financialLabel}>Balance</Text>
            <Text style={[styles.financialAmount, styles.balanceAmount]}>
              ${balance.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.section}>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.actionButton, styles.addIncomeButton]}>
            <Icon name="add" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Add Income</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.addExpenseButton]}>
            <Icon name="remove" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Add Expense</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Monthly Trend */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Monthly Trend</Text>
        <View style={styles.chartContainer}>
          <BarChart
            data={chartData}
            width={screenWidth - 40}
            height={220}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(255, 152, 0, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              style: {
                borderRadius: 16,
              },
            }}
            showValuesOnTopOfBars
            withInnerLines={false}
            withOuterLines={false}
            fromZero
            style={styles.chart}
          />
        </View>
        <View style={styles.chartInfo}>
          <Text style={styles.chartLabel}>Profit +$540</Text>
          <Text style={styles.chartLabel}>Month: Jul</Text>
        </View>
      </View>

      {/* Income Entry */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Income Entry</Text>
        <View style={styles.categoryButtons}>
          {['Sales', 'Processing', 'Packaging', 'Other'].map((cat) => (
            <TouchableOpacity key={cat} style={styles.categoryButton}>
              <Text style={styles.categoryButtonText}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.fullInput}
          placeholder="e.g., 1200"
          keyboardType="numeric"
        />
        <TextInput
          style={styles.fullInput}
          placeholder="Add description"
          multiline
        />
        <View style={styles.fileAttachment}>
          <Text style={styles.fileLabel}>Attach photo/receipt:</Text>
          <Text style={styles.fileStatus}>No file</Text>
        </View>
        <View style={styles.saveButtons}>
          <TouchableOpacity style={[styles.saveButton, styles.saveIncomeButton]}>
            <Text style={styles.saveButtonText}>Save Income</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveButton, styles.saveNewButton]}>
            <Text style={styles.saveButtonText}>Save & New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Expense Entry */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Expense Entry</Text>
        <View style={styles.categoryButtons}>
          {['Seeds', 'Transport', 'Labor', 'Utilities'].map((cat) => (
            <TouchableOpacity key={cat} style={styles.categoryButton}>
              <Text style={styles.categoryButtonText}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.fullInput}
          placeholder="e.g., 450"
          keyboardType="numeric"
        />
        <TextInput
          style={styles.fullInput}
          placeholder="Add description"
          multiline
        />
        <View style={styles.fileAttachment}>
          <Text style={styles.fileLabel}>Attach receipt:</Text>
          <Text style={styles.fileStatus}>No file</Text>
        </View>
        <View style={styles.saveButtons}>
          <TouchableOpacity style={[styles.saveButton, styles.saveExpenseButton]}>
            <Text style={styles.saveButtonText}>Save Expense</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  langText: {
    fontSize: 14,
    color: '#666',
  },
  langActive: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  langDivider: {
    marginHorizontal: 8,
    color: '#666',
  },
  appTitle: {
    fontSize: 20,
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
    marginBottom: 12,
  },
  profileGrid: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  profileImageContainer: {
    marginRight: 12,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  inputGrid: {
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  securitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  securityText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  financialCards: {
    flexDirection: 'row',
    gap: 10,
  },
  financialCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  incomeCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  expenseCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  balanceCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  financialLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  financialAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  incomeAmount: {
    color: '#4CAF50',
  },
  expenseAmount: {
    color: '#F44336',
  },
  balanceAmount: {
    color: '#4CAF50',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  addIncomeButton: {
    backgroundColor: '#4CAF50',
  },
  addExpenseButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  chartLabel: {
    fontSize: 14,
    color: '#666',
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  categoryButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '500',
  },
  fullInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  fileAttachment: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fileLabel: {
    fontSize: 14,
    color: '#666',
  },
  fileStatus: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  saveButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  saveIncomeButton: {
    flex: 1,
  },
  saveExpenseButton: {
    flex: 1,
  },
  saveNewButton: {
    flex: 1,
    backgroundColor: '#81C784',
  },
});

