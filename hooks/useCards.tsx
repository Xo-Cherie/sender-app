import { useState, useEffect } from 'react';
import { Card, ReceivedCard, RecipientDeliveryStatus } from '@/types';
import { supabase } from '@/lib/supabase';
import { invokeEdgeFunction, getEdgeFunctionErrorMessage } from '@/lib/edgeFunctions';
import { claimInvitedCardsForSession } from '@/lib/claimInvitedCards';
import { useAuth } from './useAuth';
import { CardCategory, cardTemplates } from '@/constants/cardTemplates';
import { resolveCardFrontImage } from '@/lib/cardImages';

// Helper to validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function resolveCardCategory(templateId: string | null): CardCategory {
  return cardTemplates.find(t => t.id === templateId)?.category || 'birthday';
}

type ProfileRow = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

function formatProfileName(profile?: ProfileRow): string {
  if (!profile) return 'Unknown';
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
  return fullName || profile.email || 'Unknown';
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return [value];
  }

  return [];
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

async function getFunctionErrorMessage(error: any): Promise<string> {
  return getEdgeFunctionErrorMessage(error, error?.message || 'Request failed');
}

export function useCards() {
  const { user } = useAuth();
  const [sentCards, setSentCards] = useState<Card[]>([]);
  const [receivedCards, setReceivedCards] = useState<ReceivedCard[]>([]);
  const [drafts, setDrafts] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      clearCards();
      return;
    }

    setLoading(true);
    loadCards();
    
    // Auto-refresh every 30 seconds to check for new cards
    const interval = setInterval(() => {
      loadCards();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [user]);

  function clearCards() {
    setSentCards([]);
    setReceivedCards([]);
    setDrafts([]);
    setLoading(false);
  }

  async function loadCards() {
    if (!user || !user.id) {
      console.warn('useCards: No user or user ID available');
      return;
    }

    try {
      await claimInvitedCards();

      const { data: receivedData, error: receivedError } = await supabase
        .from('received_cards')
        .select('id, card_id, is_read, is_pinned, received_at, acknowledged_at')
        .eq('recipient_id', user.id)
        .order('received_at', { ascending: false });

      if (receivedError) throw receivedError;

      const receivedRows = receivedData || [];
      const receivedCardIds = receivedRows.map((row: any) => row.card_id).filter(Boolean);
      const { data: receivedCardData, error: receivedCardsError } = receivedCardIds.length
        ? await supabase.from('cards').select('*').in('id', receivedCardIds)
        : { data: [], error: null };

      if (receivedCardsError) throw receivedCardsError;

      const receivedCardById = new Map((receivedCardData || []).map((card: any) => [card.id, card]));
      const senderIds = Array.from(new Set((receivedCardData || []).map((card: any) => card.sender_id).filter(Boolean)));
      const { data: senderProfiles } = senderIds.length
        ? await supabase.from('user_profiles').select('id, email, first_name, last_name').in('id', senderIds)
        : { data: [] };
      const profileById = new Map((senderProfiles || []).map((profile: ProfileRow) => [profile.id, profile]));

      const received: ReceivedCard[] = receivedRows
        .map((rc: any) => {
          const card = receivedCardById.get(rc.card_id);
          if (!card) return null;
          const storedRecipientInfo = card.recipient_info || {};
          const storedRecipientNames = normalizeStringArray(storedRecipientInfo.names);
          const storedSenderName = normalizeString(storedRecipientInfo.senderName);

          return {
            id: rc.card_id,
            senderId: card.sender_id,
            senderName: storedSenderName || formatProfileName(profileById.get(card.sender_id)),
            recipientIds: [user.id],
            recipientNames: storedRecipientNames.length > 0 ? storedRecipientNames : [user.name || user.email],
            category: resolveCardCategory(card.design_template),
            templateId: card.design_template,
            frontImage: resolveCardFrontImage(card.front_design_url, card.design_template),
            personalMessage: card.message || '',
            mediaAttachments: card.media_attachments || [],
            gift: card.gift_details || undefined,
            createdAt: card.created_at,
            status: 'sent' as const,
            isRead: rc.is_read || false,
            isPinned: rc.is_pinned || false,
            isXod: !!rc.acknowledged_at,
            xodAt: rc.acknowledged_at,
            recipientId: user.id,
          };
        })
        .filter(Boolean) as ReceivedCard[];

      setReceivedCards(received);

      const { data: sentData, error: sentError } = await supabase
        .from('cards')
        .select('*')
        .eq('sender_id', user.id)
        .or('status.is.null,status.eq.sent')
        .order('created_at', { ascending: false });

      if (sentError) throw sentError;

      const sentCardIds = (sentData || []).map((card: any) => card.id).filter(Boolean);
      const { data: sentRecipientRows } = sentCardIds.length
        ? await supabase
            .from('received_cards')
            .select('card_id, recipient_id, is_read, acknowledged_at')
            .in('card_id', sentCardIds)
        : { data: [] };
      const recipientIds = Array.from(new Set((sentRecipientRows || []).map((row: any) => row.recipient_id).filter(Boolean)));
      const { data: recipientProfiles } = recipientIds.length
        ? await supabase.from('user_profiles').select('id, email, first_name, last_name').in('id', recipientIds)
        : { data: [] };
      const recipientProfileById = new Map((recipientProfiles || []).map((profile: ProfileRow) => [profile.id, profile]));
      const recipientRowsByCardId = (sentRecipientRows || []).reduce((acc: Record<string, any[]>, row: any) => {
        acc[row.card_id] = acc[row.card_id] || [];
        acc[row.card_id].push(row);
        return acc;
      }, {});

      const sent: Card[] = (sentData || []).map((c: any) => {
        const recipients = recipientRowsByCardId[c.id] || [];
        const dbRecipientIds = recipients.map((rc: any) => rc.recipient_id);
        const dbRecipientNames = recipients.map((rc: any) => formatProfileName(recipientProfileById.get(rc.recipient_id)));
        const storedRecipientInfo = c.recipient_info || {};
        const storedRecipientNames = normalizeStringArray(storedRecipientInfo.names);
        const storedRecipientIds = normalizeStringArray(storedRecipientInfo.ids);
        const storedRecipientEmails = normalizeStringArray(storedRecipientInfo.emails);
        const storedSenderName = normalizeString(storedRecipientInfo.senderName);
        const finalRecipientNames = storedRecipientNames.length > 0
          ? storedRecipientNames
          : (dbRecipientNames.length > 0 ? dbRecipientNames : ['Unknown Recipient']);
        const finalRecipientIds = storedRecipientIds.length > 0
          ? storedRecipientIds
          : dbRecipientIds;
        const deliveryStatuses: RecipientDeliveryStatus[] = recipients.map((rc: any) => ({
          recipientId: rc.recipient_id,
          recipientName: formatProfileName(recipientProfileById.get(rc.recipient_id)),
          isRead: rc.is_read || false,
          isXod: !!rc.acknowledged_at,
        }));

        return {
          id: c.id,
          senderId: c.sender_id,
          senderName: storedSenderName || user.name || user.email,
          recipientIds: finalRecipientIds,
          recipientNames: finalRecipientNames,
          recipientEmails: storedRecipientEmails,
          category: resolveCardCategory(c.design_template),
          templateId: c.design_template || 'bday-1',
          frontImage: resolveCardFrontImage(c.front_design_url, c.design_template),
          personalMessage: c.message || '',
          mediaAttachments: c.media_attachments || [],
          gift: c.gift_details || undefined,
          createdAt: c.created_at,
          sentAt: c.created_at,
          status: 'sent' as const,
          deliveryStatuses,
        };
      });

      setSentCards(sent);

      const { data: draftsData, error: draftsError } = await supabase
        .from('cards')
        .select('*')
        .eq('sender_id', user.id)
        .eq('status', 'draft')
        .order('created_at', { ascending: false });

      if (draftsError) throw draftsError;

      const draftCards: Card[] = (draftsData || []).map((c: any) => {
        const storedRecipientInfo = c.recipient_info || {};
        const storedSenderName = normalizeString(storedRecipientInfo.senderName);
        return {
          id: c.id,
          senderId: c.sender_id,
          senderName: storedSenderName || user.name || user.email,
          recipientIds: normalizeStringArray(storedRecipientInfo.ids),
          recipientNames: normalizeStringArray(storedRecipientInfo.names),
          recipientEmails: normalizeStringArray(storedRecipientInfo.emails),
          category: resolveCardCategory(c.design_template),
          templateId: c.design_template || 'bday-1',
          frontImage: resolveCardFrontImage(c.front_design_url, c.design_template),
          personalMessage: c.message || '',
          mediaAttachments: c.media_attachments || [],
          gift: c.gift_details || undefined,
          createdAt: c.created_at,
          status: 'draft' as const,
        };
      });
      setDrafts(draftCards);
    } catch (error) {
      console.error('Failed to load cards:', error);
      // Set empty arrays on error to prevent undefined state
      setReceivedCards([]);
      setSentCards([]);
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }

  async function claimInvitedCards(): Promise<void> {
    await claimInvitedCardsForSession();
  }

  async function sendCard(card: Card): Promise<void> {
    if (!user || !user.id) {
      throw new Error('User not authenticated');
    }
    
    if (!card || !card.templateId || !card.recipientIds || card.recipientIds.length === 0) {
      throw new Error('Invalid card data');
    }

    try {
      // Filter out custom-email recipients (not real UUIDs) before storing
      const validRecipientIds: string[] = [];
      const validRecipientNames: string[] = [];
      const customRecipientNames: string[] = [];
      const customRecipientEmails: string[] = [];
      let customEmailIndex = 0;

      card.recipientIds.forEach((id, idx) => {
        if (id && !id.startsWith('custom-') && isValidUUID(id)) {
          validRecipientIds.push(id);
          validRecipientNames.push(card.recipientNames[idx] || '');
        } else {
          const email = normalizeEmail(card.recipientEmails?.[customEmailIndex] || card.recipientNames[idx]);
          const displayName = card.recipientNames[idx] || email || id;
          customEmailIndex += 1;

          customRecipientNames.push(displayName);
          if (email) {
            customRecipientEmails.push(email);
          }
        }
      });

      const emailsNeedingInvite: string[] = [];
      for (const email of customRecipientEmails) {
        const { data: profile, error: profileLookupError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        if (profileLookupError) {
          console.warn('Could not look up recipient email:', email, profileLookupError.message);
          emailsNeedingInvite.push(email);
          continue;
        }

        if (profile?.id) {
          if (!validRecipientIds.includes(profile.id)) {
            validRecipientIds.push(profile.id);
          }
        } else {
          emailsNeedingInvite.push(email);
        }
      }

      // Store recipient info for display purposes
      // Only store valid UUIDs in ids to avoid trigger failures
      const displayRecipientName = normalizeString(card.recipientDisplayName)
        || normalizeStringArray(card.recipientNames).join(', ');
      const displaySenderName = normalizeString(card.senderDisplayName) || card.senderName;
      const recipientInfo = {
        ids: validRecipientIds,
        names: displayRecipientName
          ? [displayRecipientName]
          : [...validRecipientNames, ...customRecipientNames],
        emails: customRecipientEmails,
        senderName: displaySenderName,
      };

      if (validRecipientIds.length > 0) {
        const { data: recipientProfiles, error: recipientLookupError } = await supabase
          .from('user_profiles')
          .select('id')
          .in('id', validRecipientIds);

        if (recipientLookupError) {
          throw new Error(`Could not verify recipients: ${recipientLookupError.message}`);
        }

        const foundRecipientIds = new Set((recipientProfiles || []).map((profile) => profile.id));
        const missingRecipientIds = validRecipientIds.filter((recipientId) => !foundRecipientIds.has(recipientId));

        if (missingRecipientIds.length > 0) {
          throw new Error(
            'One or more selected friends do not have a complete account yet. Remove them and use "Send to email" instead, or ask them to finish signing up first.'
          );
        }
      }

      if (validRecipientIds.length === 0 && emailsNeedingInvite.length === 0) {
        throw new Error('Add at least one accepted friend or a recipient email before sending.');
      }

      if (card.gift?.giftId && card.gift.paymentStatus !== 'paid') {
        throw new Error('Monetary gifts must be paid before the card can be sent.');
      }

      // Always store front_design_url as a template reference so it can be resolved on any platform
      const frontDesignUrl = `template:${card.templateId}`;

      // Insert card into cards table
      const { data: cardData, error: cardError } = await supabase
        .from('cards')
        .insert({
          sender_id: user.id,
          design_template: card.templateId,
          front_design_url: frontDesignUrl,
          message: card.personalMessage,
          media_attachments: card.mediaAttachments,
          gift_details: card.gift,
          recipient_info: recipientInfo,
        })
        .select()
        .single();

      if (cardError) {
        console.error('Failed to insert card:', cardError);
        throw cardError;
      }

      const template = cardTemplates.find(t => t.id === card.templateId);
      const inviteErrors: string[] = [];

      for (const email of emailsNeedingInvite) {
        const { error } = await invokeEdgeFunction('invite-friend', {
          body: {
            type: 'card',
            email,
            cardId: cardData.id,
            cardTitle: template?.title || 'a card',
            messagePreview: card.personalMessage?.slice(0, 180),
            inviterName: displaySenderName,
          },
        });

        if (error) {
          inviteErrors.push(`${email}: ${await getFunctionErrorMessage(error)}`);
        }
      }

      if (inviteErrors.length > 0) {
        throw new Error(`Card was saved, but invite delivery failed. ${inviteErrors.join(' ')}`);
      }

      if (card.gift?.giftId && cardData?.id) {
        const primaryRecipientId = validRecipientIds[0];
        const { error: linkError } = await invokeEdgeFunction('link-gift-to-card', {
          body: {
            giftId: card.gift.giftId,
            cardId: cardData.id,
            recipientId: primaryRecipientId,
          },
        });

        if (linkError) {
          throw new Error(`Card sent, but gift link failed: ${await getFunctionErrorMessage(linkError)}`);
        }
      }

      // Reload cards to get updated data
      await loadCards();
    } catch (error) {
      console.error('Failed to send card:', error);
      throw error;
    }
  }

  async function markAsRead(cardId: string): Promise<void> {
    if (!cardId || !user?.id) return;
    try {
      const { error } = await supabase
        .from('received_cards')
        .update({ is_read: true })
        .eq('card_id', cardId)
        .eq('recipient_id', user.id);
      if (error) throw error;
      setReceivedCards(prev =>
        prev.map(card => (card.id === cardId ? { ...card, isRead: true } : card))
      );
    } catch (error) {
      console.error('Failed to mark card as read:', error);
    }
  }

  async function togglePin(cardId: string): Promise<void> {
    if (!cardId || !user?.id) return;
    const card = receivedCards.find(c => c.id === cardId);
    if (!card) return;
    try {
      const isPinned = !card.isPinned;
      const { error } = await supabase
        .from('received_cards')
        .update({ is_pinned: isPinned })
        .eq('card_id', cardId)
        .eq('recipient_id', user.id);
      if (error) throw error;
      setReceivedCards(prev =>
        prev.map(c => (c.id === cardId ? { ...c, isPinned } : c))
      );
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  }

  async function sendXo(cardId: string): Promise<void> {
    if (!cardId || !user?.id) return;
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('received_cards')
        .update({ acknowledged_at: now })
        .eq('card_id', cardId)
        .eq('recipient_id', user.id);
      if (error) throw error;
      setReceivedCards(prev =>
        prev.map(card =>
          card.id === cardId
            ? { ...card, isXod: true, xodAt: now }
            : card
        )
      );
    } catch (error) {
      console.error('Failed to send Xo:', error);
    }
  }

  async function deleteReceivedCard(cardId: string): Promise<void> {
    if (!cardId || !user?.id) {
      console.warn('deleteReceivedCard: No card ID or user ID provided');
      return;
    }
    try {
      // Delete from received_cards table
      const { error } = await supabase
        .from('received_cards')
        .delete()
        .eq('card_id', cardId)
        .eq('recipient_id', user.id);

      if (error) throw error;

      setReceivedCards(prev => prev.filter(card => card.id !== cardId));
    } catch (error) {
      console.error('Failed to delete received card:', error);
      throw error;
    }
  }

  async function deleteSentCard(cardId: string): Promise<void> {
    if (!cardId || !user?.id) {
      console.warn('deleteSentCard: No card ID or user ID provided');
      return;
    }
    try {
      // Delete card (will cascade delete received_cards)
      const { error } = await supabase
        .from('cards')
        .delete()
        .eq('id', cardId)
        .eq('sender_id', user.id);

      if (error) throw error;

      setSentCards(prev => prev.filter(card => card.id !== cardId));
    } catch (error) {
      console.error('Failed to delete sent card:', error);
      throw error;
    }
  }

  async function saveDraft(card: Card): Promise<void> {
    if (!user?.id) {
      console.warn('saveDraft: No user ID provided');
      return;
    }
    try {
      // Check if draft already exists
      const { data: existingDraft } = await supabase
        .from('cards')
        .select('id')
        .eq('id', card.id)
        .eq('sender_id', user.id)
        .eq('status', 'draft')
        .single();

      if (existingDraft) {
        // Update existing draft
        const { error } = await supabase
          .from('cards')
          .update({
            design_template: card.templateId,
            front_design_url: `template:${card.templateId}`,
            message: card.personalMessage,
            media_attachments: card.mediaAttachments,
            gift_details: card.gift,
            recipient_info: {
              ids: card.recipientIds,
              names: card.recipientDisplayName ? [card.recipientDisplayName] : card.recipientNames,
              emails: card.recipientEmails || [],
              senderName: card.senderDisplayName || card.senderName,
            },
          })
          .eq('id', card.id)
          .eq('sender_id', user.id);

        if (error) throw error;
      } else {
        // Create new draft
        const { error } = await supabase
          .from('cards')
          .insert({
            sender_id: user.id,
            design_template: card.templateId,
            front_design_url: `template:${card.templateId}`,
            message: card.personalMessage,
            media_attachments: card.mediaAttachments,
            gift_details: card.gift,
            recipient_info: {
              ids: card.recipientIds,
              names: card.recipientDisplayName ? [card.recipientDisplayName] : card.recipientNames,
              emails: card.recipientEmails || [],
              senderName: card.senderDisplayName || card.senderName,
            },
            status: 'draft',
          });

        if (error) throw error;
      }

      await loadCards();
    } catch (error) {
      console.error('Failed to save draft:', error);
      throw error;
    }
  }

  async function deleteDraft(cardId: string): Promise<void> {
    if (!cardId || !user?.id) {
      console.warn('deleteDraft: No card ID or user ID provided');
      return;
    }
    try {
      const { error } = await supabase
        .from('cards')
        .delete()
        .eq('id', cardId)
        .eq('sender_id', user.id)
        .eq('status', 'draft');

      if (error) throw error;

      await loadCards();
    } catch (error) {
      console.error('Failed to delete draft:', error);
      throw error;
    }
  }

  async function refreshCards() {
    if (!user?.id) {
      clearCards();
      return;
    }

    setLoading(true);
    await loadCards();
  }

  return {
    sentCards,
    receivedCards,
    drafts,
    loading,
    sendCard,
    markAsRead,
    togglePin,
    sendXo,
    deleteReceivedCard,
    deleteSentCard,
    saveDraft,
    deleteDraft,
    refreshCards,
  };
}
