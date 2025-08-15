'use client'

import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  MessageCircle,
  Users,
  MoreVertical,
  Plus,
  Loader2,
  Send,
  Phone,
  Video,
  ArrowLeft,
  Paperclip,
  Smile,
  Mic,
} from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Bring in your own interfaces from your project
import { ChatWithLastMessage } from '@/lib/interfaces/ChatWithLastMessage';
import { WhatsAppAccount } from '@/lib/interfaces/WhatsAppAccount';
import { ChatItemProps } from '@/lib/interfaces/ChatItemProps';
import { Message } from '@/lib/interfaces/Message';

// If you have a Database type from Supabase, replace `any` with it
// type Database = ...

type TabType = 'all' | 'unread' | 'groups';

/* ---------------------------------- Utils --------------------------------- */
const formatRelativeTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const avatarUrl = (name: string | null | undefined, jid: string): string => {
  const seed = name || jid.split('@')[0];
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
};

/* ------------------------------- Chat Item UI ------------------------------ */
const ChatItem: React.FC<ChatItemProps> = ({ chat, onClick, currentUserJid, isSelected }) => {
  const displayName = chat.is_group
    ? chat.group_subject || 'Unnamed Group'
    : chat.name || chat.jid.split('@')[0];

  const getLastMessagePreview = (): string => {
    if (!chat.last_message) return 'No messages yet';

    const message = chat.last_message as unknown as Message; // compatible with your interface shape
    let preview = '';

    if (chat.is_group && message.sender_jid && message.sender_jid !== currentUserJid) {
      const senderName = message.sender_jid.split('@')[0];
      preview = `${senderName}: `;
    } else if (message.sender_jid === currentUserJid) {
      preview = 'You: ';
    }

    switch (message.type) {
      case 'text':
        preview += message.text || '';
        break;
      case 'image':
        preview += '📷 Photo';
        break;
      case 'video':
        preview += '🎥 Video';
        break;
      case 'audio':
        preview += '🎵 Audio';
        break;
      case 'document':
        preview += '📄 Document';
        break;
      case 'sticker':
        preview += '🏷️ Sticker';
        break;
      case 'location':
        preview += '📍 Location';
        break;
      default:
        preview += message.text || 'Message';
    }

    return preview;
  };

  return (
    <div
      className={`flex items-center p-3 md:p-4 cursor-pointer border-b border-gray-100 dark:border-gray-700 transition-colors ${
        isSelected
          ? 'bg-green-50 dark:bg-green-900/20 border-r-4 border-r-green-500'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700'
      }`}
      onClick={() => onClick(chat)}
    >
      <div className="relative mr-3 flex-shrink-0">
        <img
          src={avatarUrl(chat.name, chat.jid)}
          alt={displayName}
          className="w-12 h-12 md:w-14 md:h-14 rounded-full ring-2 ring-gray-100 dark:ring-gray-700"
        />
        {chat.is_group && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-green-600 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900">
            <Users className="w-2 h-2 md:w-2.5 md:h-2.5 text-white" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center min-w-0 flex-1">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm md:text-base">
              {displayName}
            </h3>
            {chat.is_group && chat.participant_count && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 flex-shrink-0">
                ({chat.participant_count})
              </span>
            )}
          </div>
          {chat.last_message && (
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
              {formatRelativeTime((chat.last_message as any).created_at)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-300 truncate pr-2 flex-1">
            {getLastMessagePreview()}
          </p>
          {chat.unread_count && chat.unread_count > 0 && (
            <span className="bg-green-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center text-center flex-shrink-0">
              {chat.unread_count > 99 ? '99+' : chat.unread_count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------- Chat View UI ------------------------------ */
const ChatView: React.FC<{
  selectedChat: ChatWithLastMessage | null;
  currentUserJid: string;
  onBack: () => void;
}> = ({ selectedChat, currentUserJid, onBack }) => {
  const supabase = createClientComponentClient<any>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const accountId = selectedChat?.account_id as number | undefined;

  // fetch messages for the selected chat
  useEffect(() => {
    const load = async () => {
      if (!selectedChat) return;
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', selectedChat.id)
        .order('created_at', { ascending: true });
      if (!error) setMessages((data as Message[]) || []);
    };
    load();
  }, [selectedChat, supabase]);

  // realtime: messages in this chat
  useEffect(() => {
    if (!selectedChat) return;

    const channel = supabase
      .channel(`messages-chat-${selectedChat.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${selectedChat.id}` },
        () => {
          // refetch on any change
          supabase
            .from('messages')
            .select('*')
            .eq('chat_id', selectedChat.id)
            .order('created_at', { ascending: true })
            .then(({ data }) => setMessages((data as Message[]) || []));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChat, supabase]);

  const displayName = useMemo(() => {
    if (!selectedChat) return '';
    return selectedChat.is_group
      ? selectedChat.group_subject || 'Unnamed Group'
      : selectedChat.name || selectedChat.jid.split('@')[0];
  }, [selectedChat]);

  const formatMsgTime = (timestamp: string): string =>
    new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !accountId) return;

    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const { error } = await supabase.from('messages').insert({
      account_id: accountId,
      chat_id: selectedChat.id,
      sender_jid: currentUserJid,
      message_id: localId,
      type: 'text',
      text: newMessage.trim(),
      created_at: new Date().toISOString(),
    });

    if (!error) setNewMessage('');
  };

  if (!selectedChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">Select a chat to start messaging</h3>
          <p className="text-gray-400 dark:text-gray-500">Choose from your existing conversations or start a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="bg-green-600 dark:bg-green-700 text-white p-4 flex items-center space-x-3 shadow-sm">
        <button onClick={onBack} className="md:hidden p-2 hover:bg-green-700 dark:hover:bg-green-800 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <img src={avatarUrl(selectedChat.name, selectedChat.jid)} alt={displayName} className="w-10 h-10 rounded-full ring-2 ring-green-500" />

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate">{displayName}</h2>
          <p className="text-xs opacity-90 truncate">{selectedChat.is_group ? `${selectedChat.participant_count || 0} participants` : 'Online'}</p>
        </div>

        <div className="flex items-center space-x-2">
          <button className="p-2 hover:bg-green-700 dark:hover:bg-green-800 rounded-full transition-colors">
            <Video className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-green-700 dark:hover:bg-green-800 rounded-full transition-colors">
            <Phone className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-green-700 dark:hover:bg-green-800 rounded-full transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-800"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f0f0f0' fill-opacity='0.1'%3E%3Cpath d='M30 30c0-11.046-8.954-20-20-20s-20 8.954-20 20 8.954 20 20 20 20-8.954 20-20z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          backgroundRepeat: 'repeat',
        }}
      >
        {messages.map((message) => {
          const isOwn = message.sender_jid === currentUserJid;
          return (
            <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-2 rounded-2xl shadow-sm ${
                  isOwn ? 'bg-green-500 text-white rounded-br-sm' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                }`}
              >
                {!isOwn && selectedChat.is_group && (
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">{message.sender_jid.split('@')[0]}</p>
                )}
                {message.text && <p className="text-sm leading-relaxed">{message.text}</p>}
                <p className={`text-xs mt-1 ${isOwn ? 'text-green-100' : 'text-gray-500 dark:text-gray-400'}`}>{formatMsgTime(message.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-gray-900 p-4 border-t dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors">
            <Paperclip className="w-5 h-5" />
          </button>

          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              placeholder="Type a message..."
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border-none rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 text-sm dark:text-white dark:placeholder-gray-400"
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors">
              <Smile className="w-5 h-5" />
            </button>
          </div>

          {newMessage.trim() ? (
            <button onClick={handleSendMessage} className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-full transition-colors">
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors">
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------- Chat List UI ------------------------------ */
const ChatList: React.FC<{
  onChatSelect: (chat: ChatWithLastMessage) => void;
  selectedChat: ChatWithLastMessage | null;
}> = ({ onChatSelect, selectedChat }) => {
  const supabase = createClientComponentClient<any>();

  const [searchQuery, setSearchQuery] = useState('');
  const [chats, setChats] = useState<ChatWithLastMessage[]>([]);
  const [filteredChats, setFilteredChats] = useState<ChatWithLastMessage[]>([]);
  const [selectedTab, setSelectedTab] = useState<TabType>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentAccount, setCurrentAccount] = useState<WhatsAppAccount | null>(null);

  // current user JID derived from account
  const currentUserJid = useMemo(
    () => (currentAccount ? `${currentAccount.phone_number}@s.whatsapp.net` : ''),
    [currentAccount]
  );

  // 1) Load current account (pick the first connected account; adjust as you need)
  const fetchCurrentAccount = async (): Promise<WhatsAppAccount | null> => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_accounts')
        .select('*')
        .eq('status', 'connected')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as WhatsAppAccount) || null;
    } catch (err) {
      console.error('Error fetching current account', err);
      return null;
    }
  };

  // 2) Load chats for account with latest message and participant count
  const fetchChats = async (accountId: number) => {
    try {
      setLoading(true);
      setError(null);

      // Step A: contacts list
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .eq('account_id', accountId)
        .order('updated_at', { ascending: false });
      if (contactsError) throw contactsError;

      // Step B: enrich each contact with last message + unread count + participant count
      const enriched = await Promise.all(
        (contacts || []).map(async (c: any) => {
          // last message
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', c.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // participant count for groups
          let participantCount: number | undefined = undefined;
          if (c.is_group) {
            const { count } = await supabase
              .from('group_participants')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', c.id)
              .is('left_at', null);
            participantCount = count || 0;
          }

          // NOTE: Implementing true unread counts requires either a view/RPC.
          // For now set to 0 or derive from your own logic.
          const unreadCount = 0;

          const chat: ChatWithLastMessage = {
            ...c,
            last_message: lastMessage || undefined,
            unread_count: unreadCount,
            participant_count: participantCount,
          } as ChatWithLastMessage;

          return chat;
        })
      );

      // sort by last message time (fallback to contact created_at)
      enriched.sort((a, b) => {
        const aTime = (a.last_message as any)?.created_at || a.updated_at || a.created_at;
        const bTime = (b.last_message as any)?.created_at || b.updated_at || b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setChats(enriched);
      setFilteredChats(enriched);
    } catch (err: any) {
      console.error('Error fetching chats', err);
      setError(err?.message || 'Failed to load chats');
    } finally {
      setLoading(false);
    }
  };

  // init
  useEffect(() => {
    (async () => {
      const account = await fetchCurrentAccount();
      if (account) {
        setCurrentAccount(account);
        await fetchChats(account.id);
      } else {
        setError('No WhatsApp account found');
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // realtime: messages & contacts for this account
  useEffect(() => {
    if (!currentAccount) return;

    const messagesChannel = supabase
      .channel(`messages-${currentAccount.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `account_id=eq.${currentAccount.id}` },
        () => fetchChats(currentAccount.id)
      )
      .subscribe();

    const contactsChannel = supabase
      .channel(`contacts-${currentAccount.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts', filter: `account_id=eq.${currentAccount.id}` },
        () => fetchChats(currentAccount.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(contactsChannel);
    };
  }, [currentAccount, supabase]);

  // filter by search
  useEffect(() => {
    const qs = searchQuery.toLowerCase();
    const filtered = chats.filter((chat) => {
      const name = chat.is_group ? chat.group_subject || '' : chat.name || chat.jid;
      const lastText = (chat.last_message as any)?.text || '';
      return name.toLowerCase().includes(qs) || lastText.toLowerCase().includes(qs);
    });
    setFilteredChats(filtered);
  }, [searchQuery, chats]);

  const unreadChats = filteredChats.filter((c) => (c.unread_count || 0) > 0);
  const groupChats = filteredChats.filter((c) => c.is_group);

  const getDisplayChats = (): ChatWithLastMessage[] => {
    switch (selectedTab) {
      case 'unread':
        return unreadChats;
      case 'groups':
        return groupChats;
      default:
        return filteredChats;
    }
  };

  const totalUnread = chats.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <Loader2 className="w-6 h-6 animate-spin text-green-600" />
          <span className="text-gray-600 dark:text-gray-300">Loading chats...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400 font-medium mb-2">Error loading chats</p>
          <p className="text-gray-600 dark:text-gray-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="bg-green-600 dark:bg-green-700 text-white">
        <div className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <MessageCircle className="w-6 h-6 md:w-8 md:h-8" />
              <div>
                <h1 className="text-lg md:text-xl font-semibold">Chats</h1>
                {totalUnread > 0 && <p className="text-xs md:text-sm opacity-90">{totalUnread} unread message{totalUnread !== 1 ? 's' : ''}</p>}
                {currentAccount && <p className="text-xs opacity-75">{currentAccount.phone_number}</p>}
              </div>
            </div>
            <div className="flex items-center space-x-3 md:space-x-4">
              <Search className="w-5 h-5 md:w-6 md:h-6 cursor-pointer hover:opacity-80 transition-opacity" />
              <MoreVertical className="w-5 h-5 md:w-6 md:h-6 cursor-pointer hover:opacity-80 transition-opacity" />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-4 md:space-x-6 overflow-x-auto">
            <button
              className={`pb-2 px-1 whitespace-nowrap text-sm md:text-base ${
                selectedTab === 'all' ? 'border-b-2 border-white font-medium' : 'opacity-70 hover:opacity-90'
              } transition-opacity`}
              onClick={() => setSelectedTab('all')}
            >
              All ({filteredChats.length})
            </button>
            <button
              className={`pb-2 px-1 whitespace-nowrap text-sm md:text-base ${
                selectedTab === 'unread' ? 'border-b-2 border-white font-medium' : 'opacity-70 hover:opacity-90'
              } transition-opacity`}
              onClick={() => setSelectedTab('unread')}
            >
              Unread ({unreadChats.length})
            </button>
            <button
              className={`pb-2 px-1 whitespace-nowrap text-sm md:text-base ${
                selectedTab === 'groups' ? 'border-b-2 border-white font-medium' : 'opacity-70 hover:opacity-90'
              } transition-opacity`}
              onClick={() => setSelectedTab('groups')}
            >
              Groups ({groupChats.length})
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 md:p-4 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="relative">
          <Search className="w-4 h-4 md:w-5 md:h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search chats..."
            className="w-full pl-10 md:pl-12 pr-4 py-2 md:py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm md:text-base dark:text-white dark:placeholder-gray-400 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {getDisplayChats().length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-8">
            <MessageCircle className="w-12 h-12 md:w-16 md:h-16 mb-4 opacity-50" />
            <p className="text-base md:text-lg font-medium mb-2">No chats found</p>
            <p className="text-sm md:text-base text-center">{searchQuery ? 'Try a different search term' : 'Start a new conversation'}</p>
          </div>
        ) : (
          <div>
            {getDisplayChats().map((chat) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                onClick={onChatSelect}
                currentUserJid={currentUserJid}
                isSelected={selectedChat?.id === chat.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700">
        <div className="flex items-center space-x-3 md:space-x-4">
          <button className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            <span className="text-sm">New Chat</span>
          </button>
          <button className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors">
            <Users className="w-4 h-4" />
            <span className="text-sm">Group</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ----------------------------- Main Layout Shell --------------------------- */
const WhatsAppLayout: React.FC = () => {
  const [selectedChat, setSelectedChat] = useState<ChatWithLastMessage | null>(null);
  const [showChatList, setShowChatList] = useState(true);

  const supabase = createClientComponentClient<any>();
  const [currentAccount, setCurrentAccount] = useState<WhatsAppAccount | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('whatsapp_accounts')
        .select('*')
        .eq('status', 'connected')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) setCurrentAccount(data as WhatsAppAccount);
    })();
  }, [supabase]);

  const currentUserJid = currentAccount ? `${currentAccount.phone_number}@s.whatsapp.net` : '';

  const handleChatSelect = (chat: ChatWithLastMessage) => {
    setSelectedChat(chat);
    setShowChatList(false);
  };

  const handleBackToList = () => {
    setShowChatList(true);
  };

  return (
    <div className="h-screen flex bg-white dark:bg-gray-900">
      {/* Left */}
      <div className={`${showChatList ? 'flex' : 'hidden'} md:flex w-full md:w-96 lg:w-1/3 xl:w-1/4 border-r dark:border-gray-700 flex-col`}>
        <ChatList onChatSelect={handleChatSelect} selectedChat={selectedChat} />
      </div>

      {/* Right */}
      <div className={`${!showChatList ? 'flex' : 'hidden'} md:flex flex-1`}>
        <ChatView selectedChat={selectedChat} currentUserJid={currentUserJid} onBack={handleBackToList} />
      </div>
    </div>
  );
};

export default WhatsAppLayout;
