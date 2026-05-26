import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useFriends } from '@/hooks/useFriends';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Image } from 'expo-image';

export default function FriendsScreen() {
  const { friends, searchResults, searching, searchUsers, addFriend, addFriendByEmail, acceptFriendRequest, removeFriend } = useFriends();
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [emailInvite, setEmailInvite] = useState('');
  const [addMode, setAddMode] = useState<'search' | 'email'>('search');
  const [sendingEmailInvite, setSendingEmailInvite] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const acceptedFriends = friends.filter(f => f.status === 'accepted');
  const pendingRequests = friends.filter(f => f.status === 'pending');
  const sentRequests = friends.filter(f => f.status === 'sent');

  const handleSearch = async (text: string) => {
    setSearchTerm(text);
    setError('');
    if (text.trim().length >= 3) {
      const { error: searchError } = await searchUsers(text.trim());
      if (searchError) setError(searchError);
    }
  };

  const handleAddFriend = async (userId: string) => {
    const { error: addError } = await addFriend(userId);
    if (addError) setError(addError);
    else { setSearchTerm(''); setShowAddModal(false); }
  };

  const handleEmailInvite = async () => {
    if (!emailInvite.trim()) return;
    setSendingEmailInvite(true);
    setError('');
    setSuccessMsg('');
    const { error: inviteError } = await addFriendByEmail(emailInvite.trim());
    setSendingEmailInvite(false);
    if (inviteError) setError(inviteError);
    else {
      setSuccessMsg('Friend request sent!');
      setEmailInvite('');
      setTimeout(() => { setShowAddModal(false); setSuccessMsg(''); }, 1500);
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setSearchTerm('');
    setEmailInvite('');
    setError('');
    setSuccessMsg('');
    setAddMode('search');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.title}>Friends</Text>
          <Text style={styles.subtitle}>{acceptedFriends.length} {acceptedFriends.length === 1 ? 'friend' : 'friends'}</Text>
        </View>

        {/* Friend Requests */}
        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Requests</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingRequests.length}</Text>
              </View>
            </View>
            {pendingRequests.map(friend => (
              <View key={friend.id} style={styles.friendItem}>
                <View style={[styles.avatar, { backgroundColor: theme.colors.primaryLight }]}>
                  <MaterialIcons name="person" size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{friend.name}</Text>
                  <Text style={styles.friendEmail}>{friend.email}</Text>
                </View>
                <View style={styles.actions}>
                  <Pressable onPress={() => acceptFriendRequest(friend.id)} style={styles.acceptButton}>
                    <MaterialIcons name="check" size={18} color={theme.colors.white} />
                  </Pressable>
                  <Pressable onPress={() => removeFriend(friend.id)} style={styles.rejectButton}>
                    <MaterialIcons name="close" size={18} color={theme.colors.charcoal} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* My Friends */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Friends</Text>
          {acceptedFriends.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <MaterialIcons name="people-outline" size={28} color={theme.colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No friends yet</Text>
              <Text style={styles.emptySubtext}>Add friends to send them cards</Text>
            </View>
          ) : (
            acceptedFriends.map(friend => (
              <View key={friend.id} style={styles.friendItem}>
                {friend.avatar ? (
                  <Image source={{ uri: friend.avatar }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: theme.colors.primaryLight }]}>
                    <Text style={styles.avatarInitial}>
                      {friend.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{friend.name}</Text>
                  <Text style={styles.friendEmail}>{friend.email}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={theme.colors.lightGray} />
              </View>
            ))
          )}
        </View>

        {/* Sent Requests */}
        {sentRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending</Text>
            {sentRequests.map(friend => (
              <View key={friend.id} style={styles.friendItem}>
                <View style={[styles.avatar, { backgroundColor: theme.colors.creamDark }]}>
                  <MaterialIcons name="person-outline" size={20} color={theme.colors.mediumGray} />
                </View>
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{friend.name}</Text>
                  <Text style={styles.friendEmail}>{friend.email}</Text>
                </View>
                <View style={styles.pendingChip}>
                  <Text style={styles.pendingChipText}>Pending</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable style={styles.fab} onPress={() => setShowAddModal(true)}>
        <MaterialIcons name="person-add" size={24} color={theme.colors.white} />
      </Pressable>

      {/* Add Friend Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Friend</Text>
              <Pressable onPress={handleCloseModal} style={styles.closeBtn}>
                <MaterialIcons name="close" size={20} color={theme.colors.charcoal} />
              </Pressable>
            </View>

            {/* Mode Toggle */}
            <View style={styles.modeToggle}>
              {(['search', 'email'] as const).map(mode => (
                <Pressable
                  key={mode}
                  style={[styles.modeTab, addMode === mode && styles.modeTabActive]}
                  onPress={() => { setAddMode(mode); setError(''); setSuccessMsg(''); }}
                >
                  <MaterialIcons
                    name={mode === 'search' ? 'search' : 'alternate-email'}
                    size={15}
                    color={addMode === mode ? theme.colors.white : theme.colors.mediumGray}
                  />
                  <Text style={[styles.modeTabText, addMode === mode && styles.modeTabTextActive]}>
                    {mode === 'search' ? 'Search' : 'By Email'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {addMode === 'search' ? (
              <>
                <Input name="friend-search" label="Search by Email or Phone" placeholder="Enter email or phone" value={searchTerm} onChangeText={handleSearch} autoCapitalize="none" />
                {searching ? (
                  <View style={styles.centered}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  </View>
                ) : searchTerm.trim().length >= 3 && searchResults.length === 0 ? (
                  <View style={styles.centered}>
                    <Text style={styles.noResultsText}>No users found</Text>
                    <Pressable onPress={() => { setAddMode('email'); setEmailInvite(searchTerm); setError(''); }}>
                      <Text style={styles.switchLink}>Try sending by email instead</Text>
                    </Pressable>
                  </View>
                ) : searchResults.length > 0 ? (
                  <ScrollView style={{ maxHeight: 280 }}>
                    {searchResults.map(result => {
                      const alreadyFriend = friends.some(f => f.email === result.email);
                      return (
                        <View key={result.id} style={styles.resultItem}>
                          <View style={[styles.avatar, { backgroundColor: theme.colors.primaryLight }]}>
                            <Text style={styles.avatarInitial}>{result.name.charAt(0).toUpperCase()}</Text>
                          </View>
                          <View style={styles.friendInfo}>
                            <Text style={styles.friendName}>{result.name}</Text>
                            <Text style={styles.friendEmail}>{result.email}</Text>
                          </View>
                          {alreadyFriend ? (
                            <Text style={styles.alreadyText}>Friend</Text>
                          ) : (
                            <Pressable onPress={() => handleAddFriend(result.id)} style={styles.addButton}>
                              <MaterialIcons name="person-add" size={18} color={theme.colors.white} />
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <View style={styles.centered}>
                    <MaterialIcons name="search" size={40} color={theme.colors.lightGray} />
                    <Text style={styles.hintText}>Enter 3+ characters to search</Text>
                  </View>
                )}
              </>
            ) : (
              <View>
                <Text style={styles.emailDesc}>Send a friend request to someone with a Xo Cherie account.</Text>
                <Input name="invite-email" label="Email Address" placeholder="friend@example.com" value={emailInvite} onChangeText={t => { setEmailInvite(t); setError(''); setSuccessMsg(''); }} keyboardType="email-address" autoCapitalize="none" />
                {successMsg ? (
                  <View style={styles.successRow}>
                    <MaterialIcons name="check-circle" size={16} color={theme.colors.success} />
                    <Text style={styles.successText}>{successMsg}</Text>
                  </View>
                ) : null}
                <Button title={sendingEmailInvite ? 'Sending...' : 'Send Request'} onPress={handleEmailInvite} disabled={!emailInvite.trim() || sendingEmailInvite} />
              </View>
            )}

            {error ? (
              <View style={styles.errorRow}>
                <MaterialIcons name="error-outline" size={16} color={theme.colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.cream },
  scrollView: { flex: 1 },
  content: { paddingBottom: 110 },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  title: { fontSize: 30, fontWeight: '700', color: theme.colors.dark, fontFamily: theme.fonts.serif, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: theme.colors.mediumGray, marginTop: 2, fontWeight: '500' },
  section: { paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.mediumGray, letterSpacing: 1.2, textTransform: 'uppercase' },
  badge: { backgroundColor: theme.colors.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontSize: 11, fontWeight: '700', color: theme.colors.white },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.md,
    ...theme.shadows.card,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitial: { fontSize: 18, fontWeight: '700', color: theme.colors.primary },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: '600', color: theme.colors.dark },
  friendEmail: { fontSize: 13, color: theme.colors.mediumGray, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  acceptButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  rejectButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.colors.lightGray,
    alignItems: 'center', justifyContent: 'center',
  },
  pendingChip: {
    backgroundColor: theme.colors.creamDark,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingChipText: { fontSize: 12, color: theme.colors.mediumGray, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: theme.spacing.xl },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.dark, marginBottom: 4 },
  emptySubtext: { fontSize: 14, color: theme.colors.mediumGray, textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: 100, right: theme.spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...theme.shadows.fab,
  },
  modalOverlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: theme.spacing.lg,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: theme.colors.lightGray,
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.dark, letterSpacing: -0.3 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.creamDark, alignItems: 'center', justifyContent: 'center' },
  modeToggle: { flexDirection: 'row', backgroundColor: theme.colors.creamDark, borderRadius: theme.borderRadius.md, padding: 4, marginBottom: theme.spacing.md, gap: 4 },
  modeTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: theme.borderRadius.sm },
  modeTabActive: { backgroundColor: theme.colors.primary },
  modeTabText: { fontSize: 14, fontWeight: '600', color: theme.colors.mediumGray },
  modeTabTextActive: { color: theme.colors.white },
  centered: { alignItems: 'center', paddingVertical: theme.spacing.xl, gap: theme.spacing.sm },
  noResultsText: { fontSize: 15, color: theme.colors.mediumGray, fontWeight: '600' },
  switchLink: { fontSize: 14, color: theme.colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
  hintText: { fontSize: 13, color: theme.colors.mediumGray },
  resultItem: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, backgroundColor: theme.colors.cream, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.sm, gap: theme.spacing.md },
  addButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  alreadyText: { fontSize: 12, color: theme.colors.mediumGray, fontStyle: 'italic' },
  emailDesc: { fontSize: 14, color: theme.colors.mediumGray, lineHeight: 20, marginBottom: theme.spacing.md },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0FFF4', padding: 12, borderRadius: theme.borderRadius.sm, marginBottom: theme.spacing.sm },
  successText: { flex: 1, fontSize: 13, color: theme.colors.success, fontWeight: '600' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.errorLight, padding: 12, borderRadius: theme.borderRadius.sm, marginTop: theme.spacing.sm },
  errorText: { flex: 1, fontSize: 13, color: theme.colors.error },
});
