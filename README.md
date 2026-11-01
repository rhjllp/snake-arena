# Snake Arena — starter

## Features
- Responsive snake game for mobile and desktop
- Register/login with bcrypt password hashing
- Shared leaderboard
- Admin dashboard: user count, online count, ban/unban players
- Socket.IO live online count

## Important limitations
This is a learning/demo starter, not a production-ready multiplayer game.
- User accounts and scores are stored in RAM and are lost whenever the server restarts or redeploys.
- The snake gameplay currently runs in each player's browser. Players share accounts/leaderboard and online presence, but do NOT see each other's snakes in the same arena yet.
- Score submission is client-originated and can be cheated. Production needs server-authoritative game simulation and rate limits.
- Express's default in-memory session store is not production-ready for a public service.
Before public launch, add a persistent PostgreSQL database, a persistent session store, rate limiting, CSRF/origin protections, server-side score validation, and moderation/audit logs.

## Local run
1. Install Node.js 20+
2. Run `npm install`
3. Set environment variables:
   - `SESSION_SECRET`: a long random secret
   - `ADMIN_USERNAME`: admin login name (3-16 lowercase letters/numbers/underscore)
   - `ADMIN_PASSWORD`: strong password (at least 8 characters)
4. Run `npm start`
5. Open http://localhost:3000

## Render deployment
1. Push this folder to a GitHub repository.
2. Create a Render Web Service connected to the repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Choose the Free instance if available.
6. Add Environment Variables in Render:
   - `SESSION_SECRET` = a long random secret
   - `ADMIN_USERNAME` = your chosen admin username
   - `ADMIN_PASSWORD` = a strong, unique password
7. Deploy. Open the generated `onrender.com` URL.

Do not put admin credentials in HTML/JavaScript or share them publicly.
