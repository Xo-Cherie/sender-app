import { useState, useEffect } from 'react';
import { Friend } from '@/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

function sanitizeSearchTerm(value: string): string {
  return value.trim().replace(/[%(),]/g, '');
}

export function useFriends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (user) {
      loadFriends();
    }
  }, [user]);

  async function loadFriends() {
    if (!user) return;

    try {
      // Get friend requests sent to me
      const { data: receivedRequests } = await supabase
        .from('friend_requests')
        .select(`
          id,
          from_user_id,
          status,
          user_profiles!friend_requests_from_user_id_fkey(id, email, first_name, last_name)
        `)
        .eq('to_user_id', user.id);

      // Get friend requests I sent
      const { data: sentRequests } = await supabase
        .from('friend_requests')
        .select(`
          id,
          to_user_id,
          status,
          user_profiles!friend_requests_to_user_id_fkey(id, email, first_name, last_name)
        `)
        .eq('from_user_id', user.id);

      // Get accepted friends
      const { data: acceptedFriends, error: friendsError } = await supabase
        .from('friends')
        .select(`
          id,
          friend_id,
          user_profiles!friends_friend_id_fkey(id, email, first_name, last_name)
        `)
        .eq('user_id', user.id);

      const allFriends: Friend[] = [];

      // Add received requests (pending only - accepted ones show in friends list)
      receivedRequests?.forEach((req: any) => {
        if (req.user_profiles && req.status === 'pending') {
          allFriends.push({
            id: req.id, // request ID used for accept/reject actions
            name: `${req.user_profiles.first_name || ''} ${req.user_profiles.last_name || ''}`.trim() || req.user_profiles.email,
            email: req.user_profiles.email,
            status: 'pending',
            userId: req.user_profiles.id, // actual user ID for sending cards
          });
        }
      });

      // Add sent requests (only pending ones, accepted ones will appear in friends list)
      sentRequests?.forEach((req: any) => {
        if (req.user_profiles && req.status === 'pending') {
          allFriends.push({
            id: req.id,
            name: `${req.user_profiles.first_name || ''} ${req.user_profiles.last_name || ''}`.trim() || req.user_profiles.email,
            email: req.user_profiles.email,
            status: 'sent',
            userId: req.user_profiles.id,
          });
        }
      });

      // Add accepted friends
      acceptedFriends?.forEach((friend: any) => {
        if (friend.user_profiles) {
          allFriends.push({
            id: friend.user_profiles.id, // Use the actual user profile ID, not the friendship record ID
            name: `${friend.user_profiles.first_name || ''} ${friend.user_profiles.last_name || ''}`.trim() || friend.user_profiles.email,
            email: friend.user_profiles.email,
            status: 'accepted',
          });
        }
      });

      setFriends(allFriends);
    } catch (error) {
      console.error('Failed to load friends:', error);
    } finally {
      setLoading(false);
    }
  }

  async function searchUsers(searchTerm: string): Promise<{ error: string | null }> {
    const safeSearchTerm = sanitizeSearchTerm(searchTerm);

    if (!user || !safeSearchTerm) {
      setSearchResults([]);
      return { error: null };
    }

    setSearching(true);

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name, phone_number')
        .neq('id', user.id)
        .or(`email.ilike.%${safeSearchTerm}%,phone_number.ilike.%${safeSearchTerm}%`);

      if (error) throw error;

      const results: Friend[] = (data || []).map((profile: any) => ({
        id: profile.id,
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
        email: profile.email,
        status: 'pending' as const,
      }));

      setSearchResults(results);
      return { error: null };
    } catch (error: any) {
      console.error('Search failed:', error);
      return { error: error.message || 'Search failed' };
    } finally {
      setSearching(false);
    }
  }

  async function addFriendByEmail(email: string): Promise<{ error: string | null }> {
    if (!user) return { error: 'Not authenticated' };

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return { error: 'Email is required' };

    try {
      // Look up the user by email
      const { data: profiles, error: lookupError } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name')
        .eq('email', normalizedEmail)
        .neq('id', user.id)
        .limit(1);

      if (lookupError) throw lookupError;

      if (!profiles || profiles.length === 0) {
        return { error: 'No account found with that email address' };
      }

      const targetUser = profiles[0];
      return addFriend(targetUser.id);
    } catch (error: any) {
      console.error('Add friend by email failed:', error);
      return { error: error.message || 'Failed to send friend request' };
    }
  }

  async function addFriend(userId: string): Promise<{ error: string | null }> {
    if (!user) return { error: 'Not authenticated' };

    try {
      // Check if already friends
      const { data: existingFriendship } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', user.id)
        .eq('friend_id', userId)
        .single();

      if (existingFriendship) {
        return { error: 'Already friends with this user' };
      }

      // Check if friend request already exists (either direction)
      const { data: existingRequest } = await supabase
        .from('friend_requests')
        .select('id, from_user_id, to_user_id')
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${userId}),and(from_user_id.eq.${userId},to_user_id.eq.${user.id})`)
        .single();

      if (existingRequest) {
        return { error: 'Friend request already exists' };
      }

      // Create new friend request
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          from_user_id: user.id,
          to_user_id: userId,
          status: 'pending',
        });

      if (error) throw error;

      await loadFriends();
      return { error: null };
    } catch (error: any) {
      console.error('Add friend failed:', error);
      return { error: error.message || 'Failed to send friend request' };
    }
  }

  async function acceptFriendRequest(requestId: string): Promise<void> {
    if (!user) return;

    try {
      // Get the request details
      const { data: request, error: fetchError } = await supabase
        .from('friend_requests')
        .select('from_user_id, to_user_id')
        .eq('id', requestId)
        .single();

      if (fetchError) {
        console.error('Failed to fetch friend request:', fetchError);
        return;
      }

      if (!request) return;

      const { error: friendsError } = await supabase.from('friends').insert([
        { user_id: request.to_user_id, friend_id: request.from_user_id },
        { user_id: request.from_user_id, friend_id: request.to_user_id },
      ]);

      if (friendsError) {
        console.error('Failed to create friendship:', friendsError);
        return;
      }

      // Delete the friend request (no longer needed)
      const { error: deleteError } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId);

      if (deleteError) {
        console.error('Failed to delete friend request:', deleteError);
      }

      await loadFriends();
    } catch (error) {
      console.error('Accept friend request failed:', error);
    }
  }

  async function removeFriend(friendId: string): Promise<void> {
    try {
      await supabase
        .from('friend_requests')
        .delete()
        .eq('id', friendId);

      await loadFriends();
    } catch (error) {
      console.error('Remove friend failed:', error);
    }
  }

  return {
    friends,
    loading,
    searchResults,
    searching,
    searchUsers,
    addFriend,
    addFriendByEmail,
    acceptFriendRequest,
    removeFriend,
  };
}
