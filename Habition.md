# **1\. Project Overview**

## **Habition \- The Habit Competition Platform**

A habit-tracking and accountability platform that combines **self-improvement** with **friendly competition**. Users create groups with shared daily tasks, track consistency through heat maps and progress graphs, earn coins for completing habits, and compete over fixed-duration challenges. The app promotes personal growth while motivating users through transparent progress tracking and healthy competition with friends.

# **2\. User Story Requirements**

### **US-001 — User Registration & Profile**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-001 |
| **Title** | User Registration & Profile |
| **As a...** | New user |
| **I want to...** | Register with my email and password |
| **So that...** | I can create a personal account |
| **Acceptance Criteria** | 1\. Given valid email/password, when I submit registration, then my account is created and I receive a confirmation. 2\. Given an email already in use, when I register, then I see an error. 3\. Given valid credentials, when I log in, then I land on my dashboard. |
| **Priority** | High |

### **US-002 — Create a Habit Group**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-002 |
| **Title** | Create a Habit Group |
| **As a...** | User |
| **I want to...** | Create a group and invite friends |
| **So that...** | We can compete on the same set of habits |
| **Acceptance Criteria** | 1\. Given I create a group, when I set a name, then a unique invite code is generated. 2\. Given I add tasks to the group, when I save, then all members see the same task list. 3\. Given I'm the group owner, when I view settings, then I can edit or remove tasks. |
| **Priority** | High |

### **US-003 — Join a Group via Invite Code**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-003 |
| **Title** | Join a Group via Invite Code |
| **As a...** | User |
| **I want to...** | Join a friend's group using an invite code |
| **So that...** | I can start competing with them |
| **Acceptance Criteria** | 1\. Given a valid invite code, when I enter it, then I'm added as a group member. 2\. Given an invalid/expired code, when I submit it, then I see an error message. 3\. Given I've joined, when I open the group, then I see the shared task list and current members. |
| **Priority** | High |

### **US-004 — Log Daily Task Completion**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-004 |
| **Title** | Log Daily Task Completion |
| **As a...** | User |
| **I want to...** | Mark a habit/task as complete for the day |
| **So that...** | My consistency is tracked |
| **Acceptance Criteria** | 1\. Given a task is not yet completed today, when I mark it done, then it's recorded with a timestamp. 2\. Given a task is already completed today, when I try again, then the system shows “already completed.” 3\. Given I complete a task, when the day ends, then it reflects correctly in that day's heatmap cell. |
| **Priority** | High |

### **US-005 — View Personal Heatmap**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-005 |
| **Title** | View Personal Heatmap |
| **As a...** | User |
| **I want to...** | See a heatmap of my task completions |
| **So that...** | I can visualize my consistency over time |
| **Acceptance Criteria** | 1\. Given I have completion history, when I open my profile, then a monthly heatmap renders. 2\. Given I select “yearly view,” when it loads, then all 12 months display completion intensity. 3\. Given a day has zero completions, when rendered, then it's visually distinct (empty state) from a day with completions. |
| **Priority** | Medium |

### **US-006 — Earn Coins for Consistency**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-006 |
| **Title** | Earn Coins for Consistency |
| **As a...** | User |
| **I want to...** | Earn coins when I complete tasks and hit streaks |
| **So that...** | I'm rewarded for consistency |
| **Acceptance Criteria** | 1\. Given I complete a task, when it's logged, then coins are credited to my balance. 2\. Given I reach a streak milestone (e.g., 7 days), when the milestone is hit, then I receive bonus coins. 3\. Given I miss a day, when the streak breaks, then the streak counter resets but past coins remain. |
| **Priority** | Medium |

### **US-007 — Compare Progress via Leaderboard Chart**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-007 |
| **Title** | Compare Progress via Leaderboard Chart |
| **As a...** | Group member |
| **I want to...** | See a graph comparing everyone's coins |
| **So that...** | I know where I stand in the competition |
| **Acceptance Criteria** | 1\. Given a group has multiple members, when I open the leaderboard, then a chart ranks members by coins earned. 2\. Given coin totals update, when I refresh, then the chart reflects the latest standings. 3\. Given a competition is active, when I view the chart, then remaining time is also displayed. |
| **Priority** | Medium |

### **US-008 — Time-Bound Competition & Winner Declaration**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-008 |
| **Title** | Time-Bound Competition & Winner Declaration |
| **As a...** | Group admin |
| **I want to...** | Set a start and end date for a competition |
| **So that...** | A winner is automatically determined at the deadline |
| **Acceptance Criteria** | 1\. Given a competition end date is reached, when the system runs the check, then the member with the most coins is declared winner. 2\. Given a tie in coins, when the winner is calculated, then the tiebreaker (e.g., longest streak) is applied. 3\. Given the winner is determined, when the competition closes, then all members receive a result notification. |
| **Priority** | High |

### **US-009 — Self-Accountability Streak Tracking**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-009 |
| **Title** | Self-Accountability Streak Tracking |
| **As a...** | User |
| **I want to...** | Track my own personal streak independent of others |
| **So that...** | I stay accountable to myself, not just to competitors |
| **Acceptance Criteria** | 1\. Given I complete tasks daily, when I view “My Streak,” then it shows consecutive days completed. 2\. Given I break my streak, when I check my stats, then my personal best streak is still visible. 3\. Given I have no group, when I use the app, then personal streak/heatmap tracking still works standalone. |
| **Priority** | Medium |

### **US-010 — Local Group Control Page & Admin Assignment**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-010 |
| **Title** | Local Group Control Page & Admin Assignment |
| **As a...** | Group owner |
| **I want to...** | Manage group members and assign admin roles |
| **So that...** | I can share group management responsibilities |
| **Acceptance Criteria** | 1\. Given I am the group owner, when I open group settings, then I can see a list of members. 2\. Given a member list, when I click “Make Admin,” then the user is granted admin privileges. 3\. Given a user is an admin, when they view the group dashboard, then they can approve/reject join requests. |
| **Priority** | High |

### **US-011 — Group Based Streaks**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-011 |
| **Title** | Group Based Streaks |
| **As a...** | Group member |
| **I want to...** | Maintain a streak specifically for group habits |
| **So that...** | I am incentivized to stay consistent with the group's goals |
| **Acceptance Criteria** | 1\. Given I complete all group habits for the day, when the day ends, then my group streak increases by 1\. 2\. Given I miss a group habit, when the day ends, then my group streak resets to 0\. 3\. Given I view the group dashboard, when it loads, then my current group streak and personal best are displayed. |
| **Priority** | High |

### **US-012 — Global User & Group Discovery**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-012 |
| **Title** | Global User & Group Discovery |
| **As a...** | User |
| **I want to...** | Search for other users and public groups |
| **So that...** | I can find friends to add and communities to join |
| **Acceptance Criteria** | 1\. Given I navigate to Discover People, when I search a username, then relevant users are displayed in tiled cards. 2\. Given I find a user, when I click “Add Friend,” then a request is sent. 3\. Given I am on a discovery page, when viewing the layout, then the search bar and cards follow a consistent, compact UI design. |
| **Priority** | Medium |

### **US-013 — Unified Toast Notifications**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-013 |
| **Title** | Unified Toast Notifications |
| **As a...** | User |
| **I want to...** | Receive non-intrusive notifications for my actions |
| **So that...** | I am informed without my workflow being interrupted by browser alerts |
| **Acceptance Criteria** | 1\. Given I send a friend request, when it succeeds, then a toast notification slides in. 2\. Given a background error occurs, when caught, then a styled error toast appears. 3\. Given a toast is displayed, when a few seconds pass, then it automatically dismisses. |
| **Priority** | Low |

### **US-014 — Group Join Request Approval Workflow**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-014 |
| **Title** | Group Join Request Approval Workflow |
| **As a...** | Group admin |
| **I want to...** | Review and approve/reject join requests for my group |
| **So that...** | I can control who enters the group, even if it is listed as OPEN |
| **Acceptance Criteria** | 1\. Given a user requests to join an OPEN group, when submitted, then they are placed in a PENDING state. 2\. Given I am an admin, when a request is made, then I receive a direct message notification. 3\. Given I view pending requests, when I click approve, then the user becomes a member. |
| **Priority** | High |

### **US-015 — Standardized Visual Indicators**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-015 |
| **Title** | Standardized Visual Indicators |
| **As a...** | User |
| **I want to...** | Easily identify actionable notifications |
| **So that...** | I know exactly where my attention is needed |
| **Acceptance Criteria** | 1\. Given I have unread chats or requests, when I view the navbar, then a blinking green dot appears. 2\. Given a competition is running out of time, when I view the dashboard, then a red dot is displayed on the timer. 3\. Given I have no notifications, when I view the UI, then no badges are shown. |
| **Priority** | Low |

### **US-016 — Friends List Management**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-016 |
| **Title** | Friends List Management |
| **As a...** | User |
| **I want to...** | Manage a list of friends |
| **So that...** | I can easily track their habits and chat with them |
| **Acceptance Criteria** | 1\. Given a user profile, when I send a friend request, then it appears in their pending requests. 2\. Given a pending request, when they accept it, then we appear on each other's friends list. 3\. Given a friend on my list, when I click remove, then we are no longer friends. |
| **Priority** | Medium |

### **US-017 — Real-Time Chat & Direct Messaging**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-017 |
| **Title** | Real-Time Chat & Direct Messaging |
| **As a...** | User |
| **I want to...** | Chat with friends and group members |
| **So that...** | We can communicate easily within the platform |
| **Acceptance Criteria** | 1\. Given I have a friend or group, when I open the Chats page, then I can see active conversations. 2\. Given an active conversation, when I send a message, then it is visible immediately to the recipients. 3\. Given I receive a group join request, when submitted, then it appears as a direct message from the requester. |
| **Priority** | High |

### **US-018 — Coin & Leaderboard Reset**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-018 |
| **Title** | Coin & Leaderboard Reset |
| **As a...** | Group admin |
| **I want to...** | Reset the group's coins |
| **So that...** | We can start a new competition cycle fresh |
| **Acceptance Criteria** | 1\. Given I am the group admin, when I click reset coins, then all members' coins in that group are zeroed out. 2\. Given a reset occurs, when the leaderboard is viewed, then it reflects a fresh state. |
| **Priority** | Medium |

### **US-019 — Deleting a Group**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-019 |
| **Title** | Deleting a Group |
| **As a...** | Group owner |
| **I want to...** | Delete a group |
| **So that...** | It is removed from the platform entirely |
| **Acceptance Criteria** | 1\. Given I am the owner, when I delete the group, then it is permanently removed. 2\. Given a group is deleted, when members log in, then they no longer see the group or its habits. |
| **Priority** | Low |

### **US-020 — Leaving a Group**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-020 |
| **Title** | Leaving a Group |
| **As a...** | Group member |
| **I want to...** | Leave a group |
| **So that...** | I am no longer part of that competition |
| **Acceptance Criteria** | 1\. Given I am in a group, when I click leave, then my membership is revoked. 2\. Given my membership is revoked, when I view my dashboard, then the group no longer appears. |
| **Priority** | Medium |

### **US-021 — Username-Based Profile Pages**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-021 |
| **Title** | Username-Based Profile Pages |
| **As a...** | User |
| **I want to...** | Have a unique username |
| **So that...** | Others can easily search and share my profile URL |
| **Acceptance Criteria** | 1\. Given I register, when I pick a username, then it must be unique across the platform. 2\. Given I share my profile link (e.g. /profile/johndoe), when someone clicks it, then my public profile loads. |
| **Priority** | High |

### **US-022 — Advanced Search (Jaccard \+ Geo Soft Boost)**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-022 |
| **Title** | Advanced Search (Jaccard \+ Geo Soft Boost) |
| **As a...** | User |
| **I want to...** | Receive highly relevant search results |
| **So that...** | I can discover the best groups and people near me with similar interests |
| **Acceptance Criteria** | 1\. Given I search for a group/user, when I type a query, then Meilisearch performs a fast full-text search. 2\. Given the search results, when retrieved, then they are re-ranked using Jaccard similarity against my personal tags. 3\. Given my location is known, when sorting results, then a geo soft-boost (exponential decay haversine) prioritizes nearby users/groups. |
| **Priority** | High |

### **US-023 — Manage Sent Group Requests**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-023 |
| **Title** | Manage Sent Group Requests |
| **As a...** | User |
| **I want to...** | Track the group join requests I have sent |
| **So that...** | I know if I'm still pending approval |
| **Acceptance Criteria** | 1\. Given I send a join request to a group, when I visit the Sent Requests page, then it appears in the list as pending. 2\. Given a request is pending, when the admin approves it, then it is removed from this list and the group appears in my groups. 3\. Given a request is rejected, when I check the list, then its status updates to rejected. |
| **Priority** | Medium |

### **US-024 — Gamified Visual Feedback (3D Coin Animation)**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-024 |
| **Title** | Gamified Visual Feedback (3D Coin Animation) |
| **As a...** | User |
| **I want to...** | See visual reinforcement when I complete a task |
| **So that...** | I feel rewarded and motivated |
| **Acceptance Criteria** | 1\. Given a habit is unchecked, when I mark it complete, then a 3D spinning coin animation pops up on the screen. 2\. Given the animation plays, when it fades, then my coin balance updates. |
| **Priority** | Low |

### **US-025 — Location Configuration for Geo-Matching**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-025 |
| **Title** | Location Configuration for Geo-Matching |
| **As a...** | User |
| **I want to...** | Set my geographic location |
| **So that...** | I can be matched with users and groups nearby |
| **Acceptance Criteria** | 1\. Given I am setting up my profile, when I open the location selector, then a map is displayed. 2\. Given I click on the map, when a pin drops, then my latitude and longitude are updated. 3\. Given my coordinates are saved, when I search, then the system uses them for distance-based ranking. |
| **Priority** | Medium |

### **US-026 — Search Conversations**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-026 |
| **Title** | Search Conversations |
| **As a...** | User |
| **I want to...** | Search through my active chats |
| **So that...** | I can quickly find a specific friend or group conversation |
| **Acceptance Criteria** | 1\. Given I have multiple chats, when I type in the search bar, then the conversation list filters dynamically. 2\. Given I am on mobile, when viewing the chat list, then the search bar is fully accessible. |
| **Priority** | Medium |

### **US-027 — Clear Direct Message History**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-027 |
| **Title** | Clear Direct Message History |
| **As a...** | User |
| **I want to...** | Clear my chat history with a specific person |
| **So that...** | I can manage my privacy and keep my chat list clean |
| **Acceptance Criteria** | 1\. Given I am in a 1:1 chat, when I click the Clear Chat button, then the messages are permanently deleted for both parties. 2\. Given a group chat, when I view the header, then the Clear Chat button is hidden since group messages are bound to the group's lifecycle. |
| **Priority** | Medium |

### **US-028 — Start Chat from Discovery**

| FIELD | CONTENT |
| ----- | ----- |
| **Story ID** | US-028 |
| **Title** | Start Chat from Discovery |
| **As a...** | User |
| **I want to...** | Start a chat with a stranger directly from the Discover page |
| **So that...** | I can easily reach out to people I find interesting |
| **Acceptance Criteria** | 1\. Given I find a user in Discover, when I click Chat, then I am taken to the chat page. 2\. Given I have no prior messages with this user, when the page loads, then an empty conversation is instantly created so I can send the first message. |
| **Priority** | High |

