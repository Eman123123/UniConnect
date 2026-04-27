require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const bcrypt = require("bcrypt");

// Initialize Express app FIRST
const app = express();

// ============ SCHEMAS ============
// User schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  age: { type: Number, required: true },
  phoneNumber: { type: String, required: true },
  resetToken: String,
  tokenExpires: Date
});

// University schema (for scraped data)
const universitySchema = new mongoose.Schema({
  university: String,
  degree: String,
  department: String,
  campuses: [String],
  degreeType: String,
  duration: String
});

// Review Schema
const reviewSchema = new mongoose.Schema({
    university: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, required: true },
    author: { type: String, required: true },
    date: { type: Date, default: Date.now }
});
// Calendar Schema (for stored calendar data) - SIMPLIFIED WORKING VERSION
const calendarSchema = new mongoose.Schema({
  university: { type: String, required: true },
  title: String,
  url: String,
  type: String,
  semesters: [String],
  // Make events a Mixed type that can accept anything
  events: { type: mongoose.Schema.Types.Mixed, default: [] },
  holidays: { type: mongoose.Schema.Types.Mixed, default: [] },
  springSemester: { type: mongoose.Schema.Types.Mixed, default: {} },
  fallSemester: { type: mongoose.Schema.Types.Mixed, default: {} },
  summerSemester: { type: String, default: '' },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  note: String,
  pdfUrl: String,
  pageCount: Number,
  lastUpdated: { type: Date, default: Date.now }
});
// Reminder Schema (for tracking deadlines and user reminders)
const reminderSchema = new mongoose.Schema({
  university: { type: String, required: true },
  event: { type: String, required: true },
  deadlineDate: { type: Date, required: true },
  daysBefore: { type: Number, default: 0 }, // 7, 3, 1
  reminderType: { type: String, enum: ['admission', 'exam', 'registration', 'scholarship'], default: 'admission' },
  isSent: { type: Boolean, default: false },
  sentAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// User Reminder Subscription Schema
const userReminderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userEmail: { type: String, required: true },
  subscribedUniversities: [{ type: String }], // Universities user wants reminders for
  reminderDays: { type: [Number], default: [7, 3, 1] }, // 7 days, 3 days, 1 day
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  lastRemindedAt: { type: Date }
});

const Reminder = mongoose.model('Reminder', reminderSchema);
const UserReminder = mongoose.model('UserReminder', userReminderSchema);

const User = mongoose.model('User', userSchema);
const University = mongoose.model('University', universitySchema);
const Review = mongoose.model('Review', reviewSchema);
const Calendar = mongoose.model('Calendar', calendarSchema);

// ============ IMPORT SCRAPERS ============
const { scrapeAllUniversities, setUniversityModel } = require('./controllers/multiScraper');
setUniversityModel(University);

const { scrapeAllCalendars } = require('./controllers/calendarScraper');

// ============ MIDDLEWARE ============
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..'))); // Serve files from parent folder

// ============ MONGODB CONNECTION ============
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ============ NODEMAILER ============
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Token store for password reset
const tokenStore = {};

// Token generator
function generateResetToken() {
  return crypto.randomBytes(16).toString('hex');
}
// ============ API ENDPOINTS ============

// Scrape all universities endpoint
app.get('/api/scrape-all', async (req, res) => {
    try {
        console.log('🔄 Starting scraper...');
        const result = await scrapeAllUniversities();
        console.log('✅ Scraper completed:', result);
        res.json(result);
    } catch (error) {
        console.error('❌ Scrape error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all programs
app.get('/api/programs', async (req, res) => {
    try {
        const programs = await University.find();
        console.log(`📊 Sending ${programs.length} programs to client`);
        res.json(programs);
    } catch (error) {
        console.error('Error fetching programs:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get programs by university
app.get('/api/programs/university/:name', async (req, res) => {
    try {
        const programs = await University.find({ 
            university: decodeURIComponent(req.params.name) 
        });
        res.json(programs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all universities (for carousel)
app.get('/universities', async (req, res) => {
    try {
        const universities = await University.find().limit(10);
        console.log(`🏛️ Sending ${universities.length} universities to carousel`);
        res.json(universities);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ CALENDAR ENDPOINTS ============

app.get('/api/calendars/scrape-all', async (req, res) => {
    try {
        console.log('📅 Starting calendar scraper...');
        const result = await scrapeAllCalendars();
        
        // Save to database
        for (const [uni, calendars] of Object.entries(result.universities)) {
            if (calendars && calendars.length > 0) {
                // Delete old calendar entries for this university
                await Calendar.deleteMany({ university: uni });
                
                // Insert new calendar entries
                for (const calendar of calendars) {
                    // Process events to ensure they have the correct structure
                    let processedEvents = [];
                    if (calendar.events && calendar.events.length > 0) {
                        processedEvents = calendar.events.map(event => ({
                            date: event.date || '',
                            type: event.type || 'Academic',
                            description: event.description || event.event || '',
                            event: event.event || ''
                        }));
                    }
                    
                    const newCalendar = new Calendar({
                        university: uni,
                        title: calendar.title,
                        url: calendar.url || calendar.pdfUrl,
                        type: calendar.type || 'HTML',
                        semesters: calendar.semesters || [],
                        events: processedEvents,
                        holidays: calendar.holidays || [],
                        springSemester: calendar.springSemester || {},
                        fallSemester: calendar.fallSemester || {},
                        summerSemester: calendar.summerSemester || '',
                        data: calendar.data || {},
                        note: calendar.note || '',
                        pdfUrl: calendar.pdfUrl || '',
                        lastUpdated: new Date()
                    });
                    
                    await newCalendar.save();
                    console.log(`   Saved: ${uni} - ${calendar.title}`);
                    if (calendar.events) {
                        console.log(`      Events: ${calendar.events.length}`);
                    }
                    if (calendar.holidays) {
                        console.log(`      Holidays: ${calendar.holidays.length}`);
                    }
                }
                console.log(`✅ Saved ${calendars.length} calendars for ${uni}`);
            }
        }
        
        res.json({ success: true, message: 'Calendars scraped and saved to database', data: result });
    } catch (error) {
        console.error('❌ Calendar scrape error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get calendars from database (NO scraping)
app.get('/api/calendars', async (req, res) => {
    try {
        const calendars = await Calendar.find();
        
        // Group by university
        const groupedCalendars = {};
        calendars.forEach(calendar => {
            if (!groupedCalendars[calendar.university]) {
                groupedCalendars[calendar.university] = [];
            }
            groupedCalendars[calendar.university].push({
                title: calendar.title,
                url: calendar.url,
                type: calendar.type,
                semesters: calendar.semesters,
                events: calendar.events,
                data: calendar.data,
                lastUpdated: calendar.lastUpdated
            });
        });
        
        res.json({ fetched: new Date().toISOString(), universities: groupedCalendars });
    } catch (error) {
        console.error('❌ Calendar fetch error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get calendar for specific university
app.get('/api/calendars/:university', async (req, res) => {
    try {
        const university = decodeURIComponent(req.params.university);
        const calendars = await Calendar.find({ university: university });
        res.json(calendars);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ REMINDER ENDPOINTS ============

// Subscribe to reminders for a university
app.post('/api/subscribe-reminders', async (req, res) => {
    try {
        const { email, universities, reminderDays } = req.body;
        
        if (!email || !universities || universities.length === 0) {
            return res.status(400).json({ error: 'Email and at least one university required' });
        }
        
        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Update or create user reminder subscription
        let userReminder = await UserReminder.findOne({ userId: user._id });
        
        if (userReminder) {
            userReminder.subscribedUniversities = universities;
            userReminder.reminderDays = reminderDays || [7, 3, 1];
            userReminder.isActive = true;
            await userReminder.save();
        } else {
            userReminder = new UserReminder({
                userId: user._id,
                userEmail: email,
                subscribedUniversities: universities,
                reminderDays: reminderDays || [7, 3, 1],
                isActive: true
            });
            await userReminder.save();
        }
        
        res.json({ success: true, message: 'Subscribed to reminders successfully', subscription: userReminder });
        
    } catch (error) {
        console.error('Subscribe error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user's reminder subscriptions
app.get('/api/get-reminders/:email', async (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email);
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const userReminder = await UserReminder.findOne({ userId: user._id });
        
        if (!userReminder) {
            return res.json({ subscribed: false, message: 'No active subscriptions' });
        }
        
        res.json({ 
            subscribed: true, 
            subscription: userReminder,
            reminderDays: userReminder.reminderDays,
            universities: userReminder.subscribedUniversities
        });
        
    } catch (error) {
        console.error('Get reminders error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Unsubscribe from reminders
app.delete('/api/unsubscribe-reminders/:email', async (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email);
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        await UserReminder.findOneAndDelete({ userId: user._id });
        
        res.json({ success: true, message: 'Unsubscribed from reminders' });
        
    } catch (error) {
        console.error('Unsubscribe error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get upcoming deadlines for user
app.get('/api/upcoming-deadlines/:email', async (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email);
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const userReminder = await UserReminder.findOne({ userId: user._id });
        
        if (!userReminder || !userReminder.isActive) {
            return res.json({ deadlines: [], message: 'No active subscriptions' });
        }
        
        // Get all reminders for subscribed universities
        const reminders = await Reminder.find({
            university: { $in: userReminder.subscribedUniversities },
            isSent: false
        });
        
        const today = new Date();
        const upcomingDeadlines = [];
        
        for (const reminder of reminders) {
            const daysDiff = Math.ceil((reminder.deadlineDate - today) / (1000 * 60 * 60 * 24));
            
            if (daysDiff <= Math.max(...userReminder.reminderDays) && daysDiff >= 0) {
                upcomingDeadlines.push({
                    id: reminder._id,
                    university: reminder.university,
                    event: reminder.event,
                    deadlineDate: reminder.deadlineDate,
                    daysLeft: daysDiff,
                    reminderType: reminder.reminderType
                });
            }
        }
        
        // Sort by closest deadline first
        upcomingDeadlines.sort((a, b) => a.daysLeft - b.daysLeft);
        
        res.json({ deadlines: upcomingDeadlines });
        
    } catch (error) {
        console.error('Upcoming deadlines error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ EMAIL REMINDER SCHEDULER ============

// Function to send reminder email
async function sendReminderEmail(userEmail, userName, deadlines) {
    if (!deadlines || deadlines.length === 0) return;
    
    let htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
            <div style="background: linear-gradient(135deg, #06BBCC 0%, #0598a8 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                <h2 style="color: white; margin: 0;">📅 Campus Explorer</h2>
                <p style="color: white; margin: 5px 0 0;">University Deadline Reminders</p>
            </div>
            <div style="background: white; padding: 20px; border-radius: 0 0 10px 10px;">
                <h3>Hello ${userName || 'Student'}!</h3>
                <p>Here are your upcoming university deadlines:</p>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #06BBCC; color: white;">
                            <th style="padding: 10px; text-align: left;">University</th>
                            <th style="padding: 10px; text-align: left;">Event</th>
                            <th style="padding: 10px; text-align: left;">Days Left</th>
                            <th style="padding: 10px; text-align: left;">Deadline Date</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    for (const deadline of deadlines) {
        const urgencyColor = deadline.daysLeft <= 1 ? '#ff4444' : (deadline.daysLeft <= 3 ? '#ff8800' : '#06BBCC');
        htmlContent += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px;"><strong>${deadline.university}</strong></td>
                <td style="padding: 10px;">${deadline.event}</td>
                <td style="padding: 10px; color: ${urgencyColor}; font-weight: bold;">${deadline.daysLeft} day${deadline.daysLeft !== 1 ? 's' : ''}</td>
                <td style="padding: 10px;">${deadline.deadlineDate.toLocaleDateString()}</td>
            </tr>
        `;
    }
    
    htmlContent += `
                    </tbody>
                </table>
                <div style="margin-top: 30px; padding: 15px; background: #e3f2fd; border-radius: 5px;">
                    <p style="margin: 0; font-size: 14px;">💡 Tip: Visit our website to view complete academic calendars and set more reminders!</p>
                </div>
                <div style="margin-top: 20px; text-align: center; font-size: 12px; color: #666;">
                    <p>You're receiving this because you subscribed to deadline reminders.</p>
                    <p><a href="http://localhost:3000/unsubscribe" style="color: #06BBCC;">Unsubscribe</a> | <a href="http://localhost:3000" style="color: #06BBCC;">Visit Website</a></p>
                </div>
            </div>
        </div>
    `;
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: `📢 University Deadline Reminder - ${deadlines.length} deadline${deadlines.length !== 1 ? 's' : ''} approaching`,
        html: htmlContent
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Reminder email sent to ${userEmail}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send email to ${userEmail}:`, error);
        return false;
    }
}

// Check and send reminders (run this periodically)
async function checkAndSendReminders() {
    console.log('🔍 Checking for upcoming deadlines...');
    
    const today = new Date();
    
    // Get all active user subscriptions
    const subscriptions = await UserReminder.find({ isActive: true });
    
    if (subscriptions.length === 0) {
        console.log('No active subscriptions found');
        return;
    }
    
    // Get all unsent reminders
    const reminders = await Reminder.find({ isSent: false });
    
    if (reminders.length === 0) {
        console.log('No active reminders found');
        return;
    }
    
    for (const subscription of subscriptions) {
        const userDeadlines = [];
        
        // Find deadlines for subscribed universities
        for (const reminder of reminders) {
            if (!subscription.subscribedUniversities.includes(reminder.university)) continue;
            
            const daysDiff = Math.ceil((reminder.deadlineDate - today) / (1000 * 60 * 60 * 24));
            
            // Check if days left matches any reminder day setting
            if (subscription.reminderDays.includes(daysDiff) && daysDiff >= 0) {
                userDeadlines.push({
                    university: reminder.university,
                    event: reminder.event,
                    daysLeft: daysDiff,
                    deadlineDate: reminder.deadlineDate
                });
            }
        }
        
        if (userDeadlines.length > 0) {
            // Get user name (you can add name field to User schema)
            const userName = subscription.userEmail.split('@')[0];
            await sendReminderEmail(subscription.userEmail, userName, userDeadlines);
            
            // Update last reminded time
            subscription.lastRemindedAt = new Date();
            await subscription.save();
        }
    }
    
    // Mark reminders as sent if deadline passed
    for (const reminder of reminders) {
        if (reminder.deadlineDate < today) {
            reminder.isSent = true;
            reminder.sentAt = today;
            await reminder.save();
        }
    }
    
    console.log('✅ Reminder check completed');
}

// Run reminder check every hour
setInterval(() => {
    checkAndSendReminders();
}, 60 * 60 * 1000); // Every hour

// Also run on server start
setTimeout(() => {
    checkAndSendReminders();
}, 5000); // 5 seconds after server starts
// ============ REVIEW ENDPOINTS ============

// Submit Review Endpoint
app.post('/submit-review', async (req, res) => {
    try {
        const { university, rating, review, author } = req.body;
        
        if (!university || !rating || !review || !author) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }
        
        const newReview = new Review({
            university,
            rating: parseInt(rating),
            review,
            author
        });
        
        await newReview.save();
        res.status(201).json({ message: 'Review submitted successfully', review: newReview });
    } catch (error) {
        console.error('Error submitting review:', error);
        res.status(500).json({ error: 'Server error while submitting review' });
    }
});

// Get aggregated university ratings
app.get('/get-university-ratings', async (req, res) => {
    try {
        const ratings = await Review.aggregate([
            {
                $group: {
                    _id: "$university",
                    averageRating: { $avg: "$rating" },
                    reviewCount: { $sum: 1 }
                }
            },
            { $sort: { averageRating: -1 } }
        ]);
        res.json(ratings);
    } catch (error) {
        console.error('Error fetching university ratings:', error);
        res.status(500).json({ error: 'Server error while fetching ratings' });
    }
});

// Get individual reviews
app.get('/get-reviews', async (req, res) => {
    try {
        const { university } = req.query;
        let query = {};
        
        if (university) {
            query.university = university;
        }
        
        const reviews = await Review.find(query).sort({ date: -1 });
        res.json(reviews);
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ error: 'Server error while fetching reviews' });
    }
});

// ============ AUTHENTICATION ENDPOINTS ============

// Signup route with duplicate email check
app.post('/signup', async (req, res) => {
  const { email, password, age, phoneNumber } = req.body;
  
  if (!email || !password || !age || !phoneNumber) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: 'Email already registered. Please use a different email or delete your existing account.'
      });
    }

    const user = new User({ email, password, age, phoneNumber });
    await user.save();
    res.json({ success: true, message: 'User signed up successfully!' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Signup failed.' });
  }
});

// Login route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    res.json({ success: true, message: 'Login successful!', email: user.email });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to login.' });
  }
});

// Send reset email
app.post('/verify-email', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  const resetToken = generateResetToken();
  tokenStore[email] = resetToken;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset Verification',
    html: `<p>Hello,</p><p>Click the link below to reset your password:</p>
           <a href="http://localhost:3000/reset-password?token=${resetToken}">Reset Password</a>
           <p>This link will expire in 1 hour.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Verification email sent.', token: resetToken });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send verification email.' });
  }
});

// Reset password page
app.get('/reset-password', (req, res) => {
  const { token } = req.query;
  const email = Object.keys(tokenStore).find((email) => tokenStore[email] === token);

  if (!token || !email) {
    return res.status(400).send('Token missing, invalid, or expired.');
  }

  res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

// Handle reset password
app.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  const email = Object.keys(tokenStore).find((email) => tokenStore[email] === token);

  if (!email) {
    return res.status(400).json({ error: 'Invalid or expired token.' });
  }

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  try {
    await User.updateOne({ email }, { $set: { password: newPassword } });
    delete tokenStore[email];
    res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// Account deletion route
app.delete('/delete-account', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required for account deletion' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    await User.deleteOne({ email });

    if (tokenStore[email]) {
      delete tokenStore[email];
    }

    res.status(200).json({ success: true, message: 'Account permanently deleted' });
  } catch (err) {
    console.error('Account deletion error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete account' });
  }
});

// Contact form
app.post('/contact', (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  const mailOptions = {
    from: email,
    to: process.env.EMAIL_USER,
    subject: `Contact Form Submission: ${subject}`,
    text: `You received a message from ${name} <${email}>:\n\n${message}`,
  };

  transporter.sendMail(mailOptions, (error) => {
    if (error) {
      console.error('Error sending contact form email:', error);
      return res.status(500).json({ success: false, message: 'Failed to send message.' });
    }
    res.json({ success: true, message: 'Form submitted successfully!' });
  });
});
// Add this temporary diagnostic endpoint
app.get('/api/debug-calendars', async (req, res) => {
    try {
        const calendars = await Calendar.find();
        const lumsCalendars = calendars.filter(c => c.university === 'LUMS');
        res.json({ 
            total: calendars.length,
            lumsCount: lumsCalendars.length,
            lumsCalendars: lumsCalendars.map(c => ({ 
                title: c.title, 
                type: c.type, 
                eventsCount: c.events?.length || 0,
                lastUpdated: c.lastUpdated 
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/fast-data', async (req, res) => {
    try {
        const fastCalendar = await Calendar.findOne({ university: 'FAST National University (NUCES)' });
        res.json({
            exists: !!fastCalendar,
            data: fastCalendar ? {
                title: fastCalendar.title,
                fallSemester: fastCalendar.fallSemester,
                springSemester: fastCalendar.springSemester,
                holidays: fastCalendar.holidays,
                summerSemester: fastCalendar.summerSemester,
                lastUpdated: fastCalendar.lastUpdated
            } : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/clear-calendars', async (req, res) => {
    try {
        const result = await Calendar.deleteMany({});
        res.json({ message: `Deleted ${result.deletedCount} calendar records` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ HTML PAGE ROUTES ============
// Serve UCP Calendar page
app.get('/ucp-calendar', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'ucp.html'));
});

app.get('/fast-calendar', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'fast.html'));
});

app.get('/giki-calendar', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'giki.html'));
});
// Add this route
app.get('/university-comsats', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'university-comsats.html'));
});
app.get('/lums', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'university_LUMS'));
});
// ============ START SERVER ============
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`\n💡 Tip: Visit http://localhost:3000/api/scrape-all first to load department data!\n`);
  console.log(`\n💡 Tip: Visit http://localhost:3000/api/calendars/scrape-all first to load university data!\n`);

});