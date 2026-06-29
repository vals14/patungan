import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { GroupWithBalance } from '../services/groupService'

interface Props {
  item: GroupWithBalance
  onPress: () => void
}

export function GroupCard({ item, onPress }: Props) {
  const { group, memberCount, expenseCount, myBalance } = item

  const balanceColor = myBalance > 0 ? '#16a34a' : myBalance < 0 ? '#dc2626' : '#888'
  const balanceLabel =
    myBalance > 0
      ? `+${group.currency} ${Math.abs(myBalance).toLocaleString()}`
      : myBalance < 0
      ? `-${group.currency} ${Math.abs(myBalance).toLocaleString()}`
      : 'Settled'

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.name}>{group.name}</Text>
          <Text style={styles.meta}>
            {memberCount} member{memberCount !== 1 ? 's' : ''} · {expenseCount} expense{expenseCount !== 1 ? 's' : ''} · {group.currency}
          </Text>
        </View>
        <Text style={[styles.balance, { color: balanceColor }]}>{balanceLabel}</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: '#e5e5e5',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: { flex: 1, marginRight: 12 },
  name: { fontSize: 15, fontWeight: '500', color: '#1a1a1a', marginBottom: 3 },
  meta: { fontSize: 12, color: '#888' },
  balance: { fontSize: 13, fontWeight: '500' },
})
