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

## Getting Started (For Beginners)

To run Habition on your local machine, you need to set up Meilisearch (our search engine), the Backend (Java/Spring Boot), and the Frontend (React).

### 1. Setup Environment Variables
First, you need to create an environment file in the backend directory. This file will store your secret keys and database configurations.
1. Navigate to the `backend` folder.
2. Create a new file named `.env`.
3. Add the following required variables to your `.env` file:
   ```env
   # Database connection
   DB_URL=jdbc:postgresql://localhost:5432/habition_users
   DB_USERNAME=postgres
   DB_PASSWORD=your_postgres_password
   
   # JWT Secret (Any secure random string)
   JWT_SECRET=404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970
   
   # Mail Configurations (Needed for OTP emails)
   SPRING_MAIL_USERNAME=your_email@gmail.com
   SPRING_MAIL_PASSWORD=your_app_password
   
   # Meilisearch Setup (Mandatory)
   MEILISEARCH_HOST=http://localhost:7700
   MEILISEARCH_API_KEY=your_meilisearch_master_key
   ```
*(You will get the `MEILISEARCH_API_KEY` in the next step.)*

### 2. Setup Meilisearch
Meilisearch is mandatory for the app's advanced discovery features. We have provided setup scripts that will automatically download the correct executable for your operating system into a `meilisearch/` folder.

**Windows**:
```bash
.\setup-meilisearch.bat
```
**Mac/Linux**:
```bash
chmod +x setup-meilisearch.sh
./setup-meilisearch.sh
```

**Starting Meilisearch:**
After running the script, a new folder named `meilisearch` will be created. You must navigate into it and start the engine:
```bash
cd meilisearch
# For Windows:
.\meilisearch.exe --master-key SBRmZ0tKs_Y1i3gQgH1aIZ6YI0LRojaqjSCI2yjUD-8

# For Mac/Linux:
./meilisearch --master-key SBRmZ0tKs_Y1i3gQgH1aIZ6YI0LRojaqjSCI2yjUD-8
```
> **IMPORTANT:** When you start Meilisearch, it will display a master key (or you can use the one passed in the command above). Make sure you copy this key and set it as `MEILISEARCH_API_KEY` in your `backend/.env` file!

### 3. Run Backend Services
Next, you need to start the Java microservices. Open a **new terminal window** (keep Meilisearch running in the other one) and run:
```bash
cd backend
.\start-services.bat   # For Windows
./start-services.sh    # For Mac/Linux
```

### 4. Run Frontend App
Finally, start the React application. Open another **new terminal window** and run:
```bash
cd frontend
npm install
npm run dev
```

## Architecture highlights

- **Microservices**: Separation of concerns across AuthService, HabitService, GroupService, CoinService, etc.
- **Hybrid Search**: Combines Postgres relational logic with Meilisearch document searching and custom scoring algorithms for highly personalized results.
- **Dynamic UI**: Extensively optimized, mobile-responsive tiled interfaces featuring unified animated notification systems (glowing badges & toast alerts).
