-- Allow the recipient of a friend request to accept it (update status)
-- This is needed because acceptFriendRequest updates status to 'accepted'
-- instead of inserting into the friends table (which would require acting as another user)

-- Drop and recreate to avoid conflicts if already exists
drop policy if exists "Recipients can accept friend requests" on friend_requests;

create policy "Recipients can accept friend requests"
  on friend_requests for update
  to authenticated
  using (to_user_id = auth.uid())
  with check (to_user_id = auth.uid());
