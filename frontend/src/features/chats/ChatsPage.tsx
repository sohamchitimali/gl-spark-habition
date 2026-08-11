import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { getMyMessages, sendMessage, markAsRead, type DirectMessage } from '../../api/chatApi';
import { getUsers, getFriendships, type UserProfile, type FriendshipDto } from '../../api/authApi';
import { getMyGroups, type GroupResponse, getPendingRequests, approveRequest, rejectRequest } from '../../api/groupApi';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Loading from '../../components/Loading';

interface Conversation {
  id: string; // 'user_123' or 'group_456'
  type: 'FRIEND' | 'STRANGER' | 'GROUP';
  name: string;
  avatarText: string;
  avatarColor: string;
  messages: DirectMessage[];
  unreadCount: number;
  lastMessageAt: number;
  
  // Payload for action buttons
  otherUserId?: number; // if user chat
  groupId?: number; // if group chat
  pendingRequestId?: number; // if join request chat
  pendingGroupId?: number; // if join request chat
  otherUsername?: string;
}

const ChatsPage = () => {
  const { userId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Preselect from URL parameters
  useEffect(() => {
    const userParam = searchParams.get('user');
    const groupParam = searchParams.get('group');
    if (userParam && conversations.length > 0) {
      const match = conversations.find(c => c.otherUsername === userParam);
      if (match) setActiveConvoId(match.id);
    } else if (groupParam && conversations.length > 0) {
      const match = conversations.find(c => c.id === `group_${groupParam}`);
      if (match) setActiveConvoId(match.id);
    }
  }, [searchParams, conversations]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, activeConvoId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [msgRes, groupsRes, friendsRes] = await Promise.all([
          getMyMessages(),
          getMyGroups(),
          getFriendships()
        ]);
        
        const myGroups = groupsRes.data;
        const myFriends = friendsRes.data.filter(f => f.status === 'ACCEPTED');
        const msgs = msgRes.data;

        // Group messages into buckets
        // bucket key: 'group_123' or 'user_456'
        const buckets = new Map<string, DirectMessage[]>();
        
        msgs.forEach(msg => {
          if (msg.chatType === 'GROUP' && msg.groupId) {
            const key = `group_${msg.groupId}`;
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key)?.push(msg);
          } else {
            // It's a DM or JOIN_REQUEST
            const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
            if (otherId) {
              const key = `user_${otherId}`;
              if (!buckets.has(key)) buckets.set(key, []);
              buckets.get(key)?.push(msg);
            }
          }
        });

        // Collect all unique user IDs we need profiles for
        const otherUserIds = new Set<number>();
        msgs.forEach(msg => {
          if (msg.chatType !== 'GROUP') {
            const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
            if (otherId) otherUserIds.add(otherId);
          }
        });

        const usersRes = otherUserIds.size > 0 ? await getUsers(Array.from(otherUserIds)) : { data: [] };
        const userMap = new Map<number, UserProfile>();
        usersRes.data.forEach(u => userMap.set(u.id, u));

        const formattedConvos: Conversation[] = [];

        // Process buckets
        for (const [key, bMsgs] of Array.from(buckets.entries())) {
          bMsgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          const unreadCount = bMsgs.filter(m => m.receiverId === userId && !m.isRead).length;
          const lastMessageAt = new Date(bMsgs[bMsgs.length - 1].createdAt).getTime();

          if (key.startsWith('group_')) {
            const gid = parseInt(key.split('_')[1]);
            const group = myGroups.find(g => g.id === gid);
            if (group) {
              formattedConvos.push({
                id: key,
                type: 'GROUP',
                name: group.name,
                avatarText: group.name.charAt(0).toUpperCase(),
                avatarColor: '#534AB7', // default group color
                messages: bMsgs,
                unreadCount,
                lastMessageAt,
                groupId: gid
              });
            }
          } else {
            const uid = parseInt(key.split('_')[1]);
            const user = userMap.get(uid);
            if (user) {
              const isFriend = myFriends.some(f => f.friendProfile.username === user.username);
              
              // Check if join request context
              let pendingRequestId;
              let pendingGroupId;
              const joinReqMsg = bMsgs.find(m => m.chatType === 'JOIN_REQUEST' && m.groupId);
              if (joinReqMsg && joinReqMsg.groupId) {
                const group = myGroups.find(g => g.id === joinReqMsg.groupId);
                if (group && group.ownerId === userId) {
                   try {
                     const reqsRes = await getPendingRequests(joinReqMsg.groupId);
                     const matchingReq = reqsRes.data.find((r: any) => r.applicantId === uid);
                     if (matchingReq) {
                       pendingRequestId = matchingReq.id;
                       pendingGroupId = joinReqMsg.groupId;
                     }
                   } catch (e) {}
                }
              }

              formattedConvos.push({
                id: key,
                type: isFriend ? 'FRIEND' : 'STRANGER',
                name: user.name || user.username || 'Unknown',
                avatarText: (user.name || user.username || '?').charAt(0).toUpperCase(),
                avatarColor: user.preferredColor || '#424240',
                messages: bMsgs,
                unreadCount,
                lastMessageAt,
                otherUserId: uid,
                otherUsername: user.username,
                pendingRequestId,
                pendingGroupId
              });
            }
          }
        }

        // Add groups we are part of but have no messages yet
        myGroups.forEach(g => {
          const key = `group_${g.id}`;
          if (!buckets.has(key)) {
            formattedConvos.push({
              id: key,
              type: 'GROUP',
              name: g.name,
              avatarText: g.name.charAt(0).toUpperCase(),
              avatarColor: '#534AB7',
              messages: [],
              unreadCount: 0,
              lastMessageAt: 0,
              groupId: g.id
            });
          }
        });

        // Add users we have no messages with yet, ONLY if URL requested it
        const userParam = searchParams.get('user');
        if (userParam && !formattedConvos.some(c => c.otherUsername === userParam)) {
            // Find friend
            const friend = myFriends.find(f => f.friendProfile.username === userParam);
            if (friend) {
                formattedConvos.push({
                  id: `user_${friend.friendId}`,
                  type: 'FRIEND',
                  name: friend.friendProfile.name || friend.friendProfile.username || 'Unknown',
                  avatarText: (friend.friendProfile.name || friend.friendProfile.username || '?').charAt(0).toUpperCase(),
                  avatarColor: friend.friendProfile.preferredColor || '#424240',
                  messages: [],
                  unreadCount: 0,
                  lastMessageAt: Date.now(),
                  otherUserId: friend.friendId,
                  otherUsername: friend.friendProfile.username
                });
            } else {
                // Fetch stranger profile
                try {
                    const { getUserByUsername } = await import('../../api/authApi');
                    const strangerRes = await getUserByUsername(userParam);
                    const stranger = strangerRes.data;
                    formattedConvos.push({
                      id: `user_${stranger.id}`,
                      type: 'STRANGER',
                      name: stranger.name || stranger.username || 'Unknown',
                      avatarText: (stranger.name || stranger.username || '?').charAt(0).toUpperCase(),
                      avatarColor: stranger.preferredColor || '#424240',
                      messages: [],
                      unreadCount: 0,
                      lastMessageAt: Date.now(),
                      otherUserId: stranger.id,
                      otherUsername: stranger.username
                    });
                } catch (e) {
                    console.error("Stranger not found", e);
                }
            }
        }

        formattedConvos.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
        setConversations(formattedConvos);

      } catch (err) {
        console.error('Failed to load chats', err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchData();
    }
  }, [userId, searchParams]);

  const activeConvo = conversations.find(c => c.id === activeConvoId);

  // Mark as read when opening a convo
  useEffect(() => {
    if (activeConvo && activeConvo.unreadCount > 0) {
      const unreadMsgs = activeConvo.messages.filter(m => m.receiverId === userId && !m.isRead);
      unreadMsgs.forEach(m => markAsRead(m.id).catch(console.error));
      
      setConversations(prev => prev.map(c => 
        c.id === activeConvoId 
          ? { 
              ...c, 
              unreadCount: 0, 
              messages: c.messages.map(m => m.receiverId === userId ? { ...m, isRead: true } : m) 
            }
          : c
      ));
    }
  }, [activeConvoId, activeConvo, userId]);

  const handleApprove = async (groupId: number, requestId: number) => {
    setActionLoading(true);
    try {
      await approveRequest(groupId, requestId);
      setConversations(prev => prev.map(c => 
        c.pendingRequestId === requestId ? { ...c, pendingRequestId: undefined, pendingGroupId: undefined } : c
      ));
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (groupId: number, requestId: number) => {
    setActionLoading(true);
    try {
      await rejectRequest(groupId, requestId);
      setConversations(prev => prev.map(c => 
        c.pendingRequestId === requestId ? { ...c, pendingRequestId: undefined, pendingGroupId: undefined } : c
      ));
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConvo) return;
    
    try {
      let payload: any = { content: newMessage };
      
      if (activeConvo.type === 'GROUP' && activeConvo.groupId) {
        payload.chatType = 'GROUP';
        payload.groupId = activeConvo.groupId;
      } else if (activeConvo.otherUserId) {
        payload.receiverId = activeConvo.otherUserId;
        if (activeConvo.pendingGroupId) {
          payload.groupId = activeConvo.pendingGroupId;
        }
      }

      const res = await sendMessage(payload);
      
      setConversations(prev => prev.map(c => {
        if (c.id === activeConvoId) {
          return { 
            ...c, 
            messages: [...c.messages, res.data],
            lastMessageAt: new Date(res.data.createdAt).getTime()
          };
        }
        return c;
      }).sort((a, b) => b.lastMessageAt - a.lastMessageAt));
      
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  
  const handleClearChat = async () => {
    if (!activeConvo || !activeConvo.otherUserId) return;
    setActionLoading(true);
    try {
      const { deleteDirectChat } = await import('../../api/chatApi');
      await deleteDirectChat(activeConvo.otherUserId);
      setConversations(prev => prev.filter(c => c.id !== activeConvoId));
      setActiveConvoId(null);
    } catch (err) {
      console.error('Failed to clear chat', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#121212' }}>
        <Loading size={32} />
      </div>
    );
  }

  const filteredConversations = conversations.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#121212' }}>
      <Navbar />
      
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 flex gap-6 overflow-hidden h-[calc(100vh-80px)]">
        
        {/* Sidebar */}
        <div className={`w-full md:w-96 flex flex-col rounded-2xl overflow-hidden shrink-0 transition-transform ${activeConvoId ? 'hidden md:flex' : 'flex'}`} style={{ background: '#1a1a18', border: '1px solid #363634' }}>
          <div className="p-5 border-b" style={{ borderColor: '#363634' }}>
            <h2 className="text-2xl font-bold text-white mb-4">Chats</h2>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full bg-[#2C2C2A] text-white border border-[#363634] rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-[#534AB7] transition-colors"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {searchQuery ? (
                  <p>No chats matching "{searchQuery}"</p>
                ) : (
                  <>
                    <p>No messages yet.</p>
                    <p className="text-sm mt-2">Chat with friends or group members to get started!</p>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col">
                {filteredConversations.map(convo => (
                  <button
                    key={convo.id}
                    onClick={() => {
                        setActiveConvoId(convo.id);
                        // Clean up URL params silently
                        setSearchParams({});
                    }}
                    className="w-full p-4 flex items-center gap-4 text-left transition-colors border-b"
                    style={{ 
                      background: activeConvoId === convo.id ? '#2C2C2A' : 'transparent',
                      borderColor: '#363634'
                    }}
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0 text-lg shadow-inner relative" style={{ background: convo.avatarColor }}>
                      {convo.avatarText}
                      {convo.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-[10px] font-bold border-2 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" style={{ borderColor: '#1a1a18' }}>
                          {convo.unreadCount}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-white font-bold truncate flex items-center gap-1">
                          {convo.name}
                          {convo.type === 'GROUP' && <span title="Group">👥</span>}
                          {convo.type === 'FRIEND' && <span title="Friend">👤</span>}
                        </p>
                        {convo.lastMessageAt > 0 && (
                          <span className="text-xs text-gray-500 shrink-0">
                            {new Date(convo.lastMessageAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 truncate">
                        {convo.messages.length > 0 
                          ? convo.messages[convo.messages.length - 1].content 
                          : 'Tap to start chatting'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className={`flex-1 flex flex-col rounded-2xl overflow-hidden relative ${!activeConvoId ? 'hidden md:flex' : 'flex'}`} style={{ background: '#1a1a18', border: '1px solid #363634' }}>
          {activeConvo ? (
            <>
              {/* Chat Header */}
              <div className="p-4 flex items-center gap-4 border-b z-10" style={{ background: '#2C2C2A', borderColor: '#363634' }}>
                <button onClick={() => setActiveConvoId(null)} className="md:hidden p-2 text-gray-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: activeConvo.avatarColor }}>
                  {activeConvo.avatarText}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold flex items-center gap-1">
                    {activeConvo.name}
                    {activeConvo.type === 'GROUP' && <span title="Group">👥</span>}
                    {activeConvo.type === 'FRIEND' && <span title="Friend">👤</span>}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {activeConvo.type === 'GROUP' ? 'Group Chat' : `@${activeConvo.otherUsername || 'user'}`}
                  </p>
                </div>
                
                {/* Clear Chat Button (only for 1:1 chats) */}
                {activeConvo.type !== 'GROUP' && (
                  <button 
                    onClick={handleClearChat}
                    disabled={actionLoading}
                    className="p-2 text-gray-500 hover:text-red-400 transition-colors bg-[#1a1a18] rounded-xl border border-[#363634] hover:border-red-900 flex items-center gap-2"
                    title="Clear Chat"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeConvo.messages.map((msg, i) => {
                  const isMe = msg.senderId === userId;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMe ? 'text-white shadow-md' : 'text-gray-200'}`}
                           style={{ background: isMe ? '#7F77DD' : '#2C2C2A' }}>
                        {msg.chatType === 'JOIN_REQUEST' && !isMe && (
                          <div className="text-[10px] uppercase font-bold text-[#F0997B] mb-1">Join Request</div>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-indigo-200' : 'text-gray-500'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Action Bar (Join Requests) */}
              {activeConvo.pendingRequestId && activeConvo.pendingGroupId && (
                <div className="p-3 mx-4 mb-4 rounded-xl flex items-center justify-between" style={{ background: 'rgba(240, 153, 123, 0.1)', border: '1px solid rgba(240, 153, 123, 0.2)' }}>
                  <p className="text-sm" style={{ color: '#F0997B' }}>This user has requested to join your group.</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(activeConvo.pendingGroupId!, activeConvo.pendingRequestId!)} disabled={actionLoading}
                      className="px-4 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 text-sm font-bold transition-colors">
                      Approve
                    </button>
                    <button onClick={() => handleReject(activeConvo.pendingGroupId!, activeConvo.pendingRequestId!)} disabled={actionLoading}
                      className="px-4 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-bold transition-colors">
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {/* Chat Input */}
              <div className="p-4 border-t" style={{ background: '#2C2C2A', borderColor: '#363634' }}>
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent border-none text-white focus:ring-0 outline-none placeholder-gray-500 px-2"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                    style={{ background: '#7F77DD' }}
                  >
                    <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 text-center">
              <svg className="w-20 h-20 mb-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              <h3 className="text-xl font-bold text-white mb-2">Your Messages</h3>
              <p className="max-w-xs">Select a conversation from the sidebar to view messages or start a new chat.</p>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};

export default ChatsPage;
