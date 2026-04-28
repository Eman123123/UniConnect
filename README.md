# UniConnect
# 🎓 UniConnect - University Academic Calendar & Reminder System

UniConnect is a comprehensive web platform that helps students track academic calendars, deadlines, and events across multiple Pakistani universities. The system automatically scrapes academic calendar data from university websites and sends email reminders for important deadlines.


## ✨ Features

### Core Features
- **Academic Calendar Scraping**: Automatically scrapes calendar data and department offer by all universities campuses from 5 major Pakistani universities
- **User Authentication**: Signup, login, and account management with secure password handling
- **Email Reminders**: Automated email notifications for upcoming deadlines (7, 3, and 1 day before)
- **University Reviews**: Rate and review universities (1-5 stars)
- **Responsive Design**: Fully responsive UI that works on desktop, tablet, and mobile

### Calendar Features
- **FAST NUCES**: Fall/Spring semester dates, holidays, and exam schedules
- **LUMS**: Detailed semester events with descriptions (Fall, Spring, Summer sessions)
- **COMSATS**: PDF calendar download links with semester schedules
- **GIKI**: PDF calendar download with embedded viewer
- **UCP**: Structured semester calendars with event weeks

### Reminder System
- Subscribe to specific universities
- Choose reminder intervals (7 days, 3 days, 1 day before deadline)
- Automatic email notifications
- Upcoming deadlines dashboard
- Visual bell icon indicators for subscribed universities

- 
## 🚀 Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- Gmail account (for email notifications)

### Step 1: Clone the Repository
```bash
git clone https://github.com/yourusername/UniConnect.git
cd UniConnect/backend
```
### Step 2: Install Dependencies
```bash
npm install
```
### Step 3: Set Up Environment Variables
Create a .env file in the backend directory:
env
MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/uniconnect
OR for MongoDB Atlas:
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/uniconnect
Email Configuration (for reminders)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
Server Port
PORT=3000

### Step 4: Start MongoDB
```bash
If using local MongoDB
mongod
```
### Step 5: Run the Application
```bash
node app.js
```
The server will start at: http://localhost:3000


