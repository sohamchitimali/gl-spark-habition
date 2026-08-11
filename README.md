# Habition

Habition is a gamified, social habit-tracking application designed to help users build consistency through competition and self-accountability. Users can create shared Habit Groups, earn coins, build streaks, and compete against friends on dynamic leaderboards.

## Core Features

- **User Accounts & Profiles**: Unique username-based public profiles with personal standalone streak and heatmap tracking.
- **Habit Groups & Competitions**: Create or join groups via unique invite codes. Admins can set time-bound competitions to automatically declare winners.
- **Advanced Gamification**: Earn coins for logging daily task completions and hitting streak milestones. Watch a satisfying 3D spinning coin animation when checking off habits!
- **Dynamic Leaderboards**: Real-time coin ranking and competition timers within your groups.
- **Social Connectivity**: 
  - Manage a Friends List and send direct messages.
  - Chat in real-time within your Habit Groups or directly with strangers discovered on the platform.
  - Filter your active conversations with a sleek, mobile-responsive search bar.
  - Maintain privacy by instantly clearing 1:1 chat histories.
- **Advanced Discovery & Search**: 
  - Powered by **Meilisearch** for blazing fast full-text search.
  - **Jaccard Similarity Re-ranking**: Search results are intelligently re-ranked based on overlapping interests and tags.
  - **Geo Soft-Boosting**: Uses exponential decay haversine logic to prioritize groups and users geographically closer to your configured location.
- **Interactive Map Configuration**: Set up your location via an interactive map for highly tailored geo-matching.
- **Robust Group Management**: Admin assignments, pending join request queues, outgoing request tracking, deleting, and leaving groups.

## Tech Stack

- **Frontend**: React, TypeScript, TailwindCSS, Vite
- **Backend**: Java, Spring Boot (Microservices Architecture)
- **Database**: PostgreSQL
- **Search Engine**: Meilisearch

## Getting Started

1. **Start Meilisearch**:
   Ensure Meilisearch is running locally on port 7700.
   ```bash
   ./meilisearch.exe --master-key <YOUR_MASTER_KEY>
   ```

2. **Run Backend Services**:
   Navigate to the backend directory and run the initialization script.
   ```bash
   cd backend
   ./start-services.bat
   ```

3. **Run Frontend App**:
   Start the Vite development server.
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Architecture highlights

- **Microservices**: Separation of concerns across AuthService, HabitService, GroupService, CoinService, etc.
- **Hybrid Search**: Combines Postgres relational logic with Meilisearch document searching and custom scoring algorithms for highly personalized results.
- **Dynamic UI**: Extensively optimized, mobile-responsive tiled interfaces featuring unified animated notification systems (glowing badges & toast alerts).
