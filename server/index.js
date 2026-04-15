import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { spawn } from 'child_process';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { generateSignedUrl, generateSignedUrlsForPrefix, isValidFilePath } from './utils/gcsHelper.js';
import billingRoutes from './routes/billing.js';
import YahooFinance2 from 'yahoo-finance2';

const yf = new YahooFinance2({
    suppressNotices: ['yahooSurvey', 'ripHistorical']
});


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS configuration - explicitly allow production and development domains
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'https://www.distilledchild.space',
        'https://distilledchild.space',
        'https://personal-web-2025-mauve.vercel.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Root route for health check
app.get('/', (req, res) => {
    res.send('Hello from Cloud Run! 🚀 Server v2.1.0 - Contact Info Update');
});

// Register Billing Routes
app.use('/api/billing', billingRoutes);

// Load environment variables
import dotenv from 'dotenv';

// Load .env from parent directory (project root)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Determine Redirect URI based on environment
const isProduction = process.env.NODE_ENV === 'production';
const REDIRECT_URI = isProduction
    ? 'https://distilledchild.space/oauth/google/callback'
    : (process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth/google/callback');

// Database connection
import mongoose from 'mongoose';
import { Storage } from '@google-cloud/storage';

// Initialize Google Cloud Storage
// Supports both file path (local) and JSON string (Railway/Render)
let storageConfig = {};

if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
    // Railway/Render: JSON string in environment variable
    try {
        storageConfig.credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY);
        console.log('Using GCS credentials from GCP_SERVICE_ACCOUNT_KEY');
    } catch (error) {
        console.error('Failed to parse GCP_SERVICE_ACCOUNT_KEY:', error.message);
    }
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Local: file path
    console.log('Using GCS credentials from GOOGLE_APPLICATION_CREDENTIALS file');
    storageConfig.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
} else if (fs.existsSync('/app/gcs-key.json')) {
    // Cloud Run: Secret Manager mounted key
    console.log('Using GCS credentials from Cloud Run Secret Manager (/app/gcs-key.json)');
    storageConfig.keyFilename = '/app/gcs-key.json';
} else if (fs.existsSync(path.resolve(__dirname, '../service-account-key.json'))) {
    // Local: automatic detection of service-account-key.json in root
    console.log('Using GCS credentials from local service-account-key.json');
    storageConfig.keyFilename = path.resolve(__dirname, '../service-account-key.json');
} else {
    // Default: Application Default Credentials (gcloud auth)
    console.log('Using GCS default credentials');
}

if (process.env.GCP_PROJECT_ID) {
    storageConfig.projectId = process.env.GCP_PROJECT_ID;
}

const storage = new Storage(storageConfig);

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept images only
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

mongoose.connect(process.env.MONGODB_URI)
    .then(async (connection) => {
        console.log('Connected to MongoDB');
        try {
            const collections = await connection.connection.db.listCollections().toArray();
            console.log('Available Collections:', collections.map(c => c.name));
        } catch (e) {
            console.error('Failed to list collections:', e);
        }
    })
    .catch(err => console.error('MongoDB connection error:', err));



const stateSchema = new mongoose.Schema({
    code: String,
    name: String,
    status: String,
    fips_code: String,
    color_code: String // column added for filling states with colors 
}, { collection: 'STATE' });

const State = mongoose.model('State', stateSchema);

const citySchema = new mongoose.Schema({
    state_code: String,
    city_name: String,
    city_code: String, // Airport code (e.g., ORD, BOS, JFK)
    latitude: Number,
    longitude: Number,
    status: String
}, { collection: 'CITY' });

const City = mongoose.model('City', citySchema);

const artMuseumSchema = new mongoose.Schema({
    id: Number,
    city: String, // Legacy field
    city_code: String, // City code for lookup in CITY table
    museum_code: String,
    museum_name: String,
    state: String,
    show: String // 'Y' or 'N' to show/hide museum
}, { collection: 'INTERESTS_ART_MUSEUM' });

const ArtMuseum = mongoose.model('ArtMuseum', artMuseumSchema);



// Get Art Museums with City Data
app.get('/api/interests/art-museums', async (req, res) => {
    try {
        // Filter museums where show='Y'
        const museums = await ArtMuseum.find({ show: 'Y' });

        // Google Cloud Storage bucket configuration
        const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'distilledchild';

        // Enrich museums with city data (coordinates and full name) and state data (fips_code)
        const enrichedMuseums = await Promise.all(museums.map(async (museum) => {
            // Find city by code - museum.city_code or museum.city contains the city code
            const cityCode = museum.city_code || museum.city;
            const cityData = await City.findOne({ city_code: cityCode });
            // Find state by code to get fips_code
            const stateData = await State.findOne({ code: museum.state });

            // Log for debugging
            if (!cityData) {
                console.log(`City not found for code: ${cityCode}, museum: ${museum.museum_name}`);
            }

            // Note: Artworks are loaded lazily via /api/interests/art-museums/:code/artworks endpoint
            // This improves initial page load performance significantly

            return {
                ...museum.toObject(),
                city_name: cityData ? cityData.city_name : cityCode,
                // Use city coordinates if available, otherwise null.
                // Format: [longitude, latitude] for d3-geo
                coordinates: (cityData && cityData.longitude && cityData.latitude)
                    ? [cityData.longitude, cityData.latitude]
                    : null,
                fips_code: stateData ? stateData.fips_code : null,
                artworks: [] // Loaded lazily on museum click
            };
        }));

        res.json(enrichedMuseums);
    } catch (err) {
        console.error('Error fetching art museums:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get Market & Commodities Data (Yahoo Finance 2)
app.get('/api/finance/market-data', async (req, res) => {
    try {
        const tickers = {
            'S&P 500': '^GSPC',
            'NASDAQ': '^IXIC',
            'Apple': 'AAPL',
            'Gold': 'GC=F',
            'Silver': 'SI=F',
            'Copper': 'HG=F'
        };

        const results = await Promise.all(
            Object.entries(tickers).map(async ([name, symbol]) => {
                try {
                    const quote = await yf.quote(symbol);
                    // Fetch last 7 days of historical data using chart() since historical() is deprecated in v3
                    const queryOptions = { 
                        period1: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        period2: new Date().toISOString().split('T')[0],
                        interval: '1d'
                    };
                    const chartData = await yf.chart(symbol, queryOptions);
                    
                    const history = (chartData.quotes || []).map(h => ({
                        date: new Date(h.date).toISOString().split('T')[0],
                        close: h.close
                    }));

                    return {
                        name,
                        symbol,
                        price: quote.regularMarketPrice,
                        change: quote.regularMarketChange,
                        changePercent: quote.regularMarketChangePercent,
                        currency: quote.currency || 'USD',
                        history
                    };
                } catch (e) {
                    console.error(`Error fetching data for ${symbol}:`, e);
                    return { name, symbol, error: 'Unavailable' };
                }
            })
        );
        res.json(results);
    } catch (err) {
        console.error('Error fetching finance data:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get Artworks for a specific museum (Lazy Loading)
app.get('/api/interests/art-museums/:code/artworks', async (req, res) => {
    try {
        const { code } = req.params;

        if (!code) {
            return res.status(400).json({ error: 'Museum code is required' });
        }

        const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'distilledchild';

        // Generate signed URLs for all images in museum folder
        const artworks = await generateSignedUrlsForPrefix(
            storage,
            GCS_BUCKET_NAME,
            `interests/art/${code}/`,
            /\.(png|jpg|jpeg|gif|webp)$/i,
            60 // 1 hour expiry
        );

        console.log(`[ART-MUSEUM] Loaded ${artworks.length} artworks for ${code}`);
        res.json({ artworks });
    } catch (err) {
        console.error('[ART-MUSEUM] Error fetching artworks:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get Signed URLs for HiC Browser data files
app.get('/api/research/hic-data', async (req, res) => {
    try {
        const { fileName } = req.query;

        if (!fileName) {
            return res.status(400).json({ error: 'fileName parameter is required' });
        }

        // Validate fileName to prevent path traversal
        if (!isValidFilePath(fileName)) {
            return res.status(400).json({ error: 'Invalid fileName' });
        }

        const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'distilledchild';
        const filePath = `research/hic-browser/${fileName}`;

        // Generate signed URL using helper function
        const signedUrl = await generateSignedUrl(storage, GCS_BUCKET_NAME, filePath, 60);

        res.json({ url: signedUrl });
    } catch (err) {
        console.error('Error generating signed URL for HiC data:', err);

        // Return appropriate error based on error message
        if (err.message && err.message.includes('not found')) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.status(500).json({ error: 'Internal server error' });
    }
});

const techBlogSchema = new mongoose.Schema({
    category: String,
    title: String,
    content: String,
    likes: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    createdAt: Date,
    updatedAt: Date,
    isPublished: { type: Boolean, default: true },
    slug: String,
    tags: [String],
    author: {
        name: String,
        email: String,
        avatar: String
    },
    likedBy: [{ type: String }],  // Array of email strings
    show: { type: String, default: 'Y' },  // 'Y' (visible), 'N' (pending), 'D' (deleted)
    isAutomated: { type: Boolean, default: false },
    references: [{ type: String }]  // Array of reference URLs
}, { collection: 'BLOG' });

const TechBlog = mongoose.model('TechBlog', techBlogSchema);

// Workout Schema for Strava activities
const workoutSchema = new mongoose.Schema({
    activity_id: { type: Number, unique: true, required: true },
    name: String,
    distance: Number,
    moving_time: Number,
    elapsed_time: Number,
    total_elevation_gain: Number,
    type: String,
    sport_type: String,
    start_date: Date,
    start_date_local: Date,
    average_speed: Number,
    max_speed: Number,
    athlete_id: Number,
    insertedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
}, { collection: 'INTERESTS_WORKOUT' });

const Workout = mongoose.model('Workout', workoutSchema);

// TODO List Schema
const todoListSchema = new mongoose.Schema({
    email: { type: String, required: true },
    category: { type: String, enum: ['personal', 'dev', 'note'], default: 'personal' },
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'in_progress' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    priority_no: { type: Number, default: 0 },
    pinned: { type: Boolean, default: false },
    due_date: Date,
    start_time: Date,
    end_time: Date,
    completed: { type: Boolean, default: false },
    show: { type: String, default: 'Y' },
    sort: String, // Project ID for dev todos
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
}, { collection: 'TODO_LIST' });

const TodoList = mongoose.model('TodoList', todoListSchema);

// Contact Schema
const contactSchema = new mongoose.Schema({
    Email: { type: String, required: true },
    GitHub: String,
    LinkedIn: String,
    Location: {
        city: String,
        state: String,
        country: String,
        latitude: Number,
        longitude: Number,
        ip: String,
        timezone: String
    },
    // Support lowercase fallbacks for flexibility
    email: String,
    github: String,
    linkedin: String,
    location: Object
}, { collection: 'CONTACT_INFO' }); // Explicitly set collection name

const Contact = mongoose.model('Contact', contactSchema);

// Guestbook Schema
const guestbookSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    picture: String,
    message: { type: String, required: true },
    likes: { type: Number, default: 0 },
    likedBy: [{ type: String }],  // Array of email strings
    show: { type: String, default: 'Y' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { collection: 'CONTACT_GUESTBOOK' });

const Guestbook = mongoose.model('Guestbook', guestbookSchema);

// --- Guestbook Endpoints ---

// Get all guestbook entries
app.get('/api/guestbook', async (req, res) => {
    try {
        const entries = await Guestbook.find({ show: 'Y' }).sort({ createdAt: -1 });
        res.json(entries);
    } catch (err) {
        console.error('[GUESTBOOK] Error fetching entries:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create guestbook entry
app.post('/api/guestbook', async (req, res) => {
    try {
        const { name, email, picture, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ error: 'Name, email, and message are required' });
        }

        const newEntry = new Guestbook({
            name,
            email,
            picture,
            message,
            likes: 0,
            likedBy: [],
            show: 'Y',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        const savedEntry = await newEntry.save();
        console.log('[GUESTBOOK] Entry created by:', email);
        res.status(201).json(savedEntry);
    } catch (err) {
        console.error('[GUESTBOOK] Error creating entry:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update guestbook entry (only by author)
app.put('/api/guestbook/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { message, userEmail } = req.body;

        if (!userEmail) {
            return res.status(400).json({ error: 'User email is required' });
        }

        const entry = await Guestbook.findById(id);
        if (!entry) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        // Check if user is the author
        if (entry.email !== userEmail) {
            return res.status(403).json({ error: 'Unauthorized: Only author can update' });
        }

        if (message) entry.message = message;
        entry.updatedAt = new Date();

        const updatedEntry = await entry.save();
        console.log('[GUESTBOOK] Entry updated by:', userEmail);
        res.json(updatedEntry);
    } catch (err) {
        console.error('[GUESTBOOK] Error updating entry:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete guestbook entry (soft delete, only by author)
app.delete('/api/guestbook/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userEmail } = req.body;

        if (!userEmail) {
            return res.status(400).json({ error: 'User email is required' });
        }

        const entry = await Guestbook.findById(id);
        if (!entry) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        // Check if user is the author
        if (entry.email !== userEmail) {
            return res.status(403).json({ error: 'Unauthorized: Only author can delete' });
        }

        // Soft delete
        entry.show = 'N';
        entry.updatedAt = new Date();

        await entry.save();
        console.log('[GUESTBOOK] Entry deleted by:', userEmail);
        res.json({ message: 'Entry deleted successfully' });
    } catch (err) {
        console.error('[GUESTBOOK] Error deleting entry:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Like/Unlike guestbook entry
app.post('/api/guestbook/:id/like', async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const entry = await Guestbook.findById(id);
        if (!entry) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        // Initialize likedBy if it doesn't exist
        if (!entry.likedBy) {
            entry.likedBy = [];
        }

        // Check if user already liked (by email)
        const likedIndex = entry.likedBy.indexOf(email);

        if (likedIndex > -1) {
            // Unlike: remove email from likedBy
            entry.likedBy.splice(likedIndex, 1);
        } else {
            // Like: add email to likedBy
            entry.likedBy.push(email);
        }

        // Update likes count based on likedBy array length
        entry.likes = entry.likedBy.length;

        await entry.save();
        res.json({
            likes: entry.likes,
            likedBy: entry.likedBy,
            isLiked: likedIndex === -1
        });
    } catch (err) {
        console.error('[GUESTBOOK] Error liking entry:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Google OAuth Endpoint
app.post('/api/auth/google', async (req, res) => {
    const { code, redirectUri } = req.body;
    if (!code) return res.status(400).json({ error: 'No code provided' });

    try {
        let effectiveRedirectUri = REDIRECT_URI;
        if (typeof redirectUri === 'string' && redirectUri.trim()) {
            try {
                const parsed = new URL(redirectUri);
                const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
                const hasExpectedPath = parsed.pathname === '/oauth/google/callback';

                if (isProduction) {
                    if (redirectUri === REDIRECT_URI) {
                        effectiveRedirectUri = redirectUri;
                    } else {
                        return res.status(400).json({ error: 'Invalid redirect URI for production' });
                    }
                } else if (isLocalHost && hasExpectedPath) {
                    effectiveRedirectUri = redirectUri;
                } else {
                    return res.status(400).json({ error: 'Invalid redirect URI' });
                }
            } catch {
                return res.status(400).json({ error: 'Invalid redirect URI' });
            }
        }

        // 1. Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: effectiveRedirectUri,
                grant_type: 'authorization_code',
            }),
        });

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) {
            console.error('Token exchange failed:', tokenData);
            return res.status(500).json({ error: 'Failed to exchange token', details: tokenData });
        }

        // 2. Get User Profile
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        const userData = await userResponse.json();
        if (!userResponse.ok) {
            return res.status(500).json({ error: 'Failed to get user info' });
        }

        // 3. Check Member Role
        const member = await Member.findOne({ email: userData.email });
        const role = member ? member.role : 'guest';

        res.json({
            name: userData.name,
            email: userData.email,
            picture: userData.picture,
            role: role
        });

    } catch (error) {
        console.error('Error exchanging token:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to authenticate' });
    }
});

// Travel States Endpoint
app.get('/api/travel/states', async (req, res) => {
    try {
        const states = await State.find({}, 'code status fips_code'); //fips_code is the state code added
        // console.log("It's backend::::::::::::::::::::::::::::::::::" + JSON.stringify(states, null, 2));
        res.json(states);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Tech and Bio Endpoint
app.get('/api/tech-blog', async (req, res) => {
    try {
        // Return all posts (including pending ones with show='N')
        // Frontend handles filtering for public vs admin views
        const blogs = await TechBlog.find({})
            .sort({ createdAt: -1 });
        res.json(blogs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create Tech and Bio Post
app.post('/api/tech-blog', async (req, res) => {
    try {
        const { category, title, content, author, isAutomated } = req.body;

        if (!category || !title || !content || !author || !author.email) {
            console.error('[TECH-BLOG] Missing required fields');
            return res.status(400).json({ error: 'Category, title, content, and author are required' });
        }

        // Check if user is authorized (distilledchild or wellclouder)
        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];
        if (!authorizedEmails.includes(author.email)) {
            console.error('[TECH-BLOG] Unauthorized email:', author.email);
            return res.status(403).json({ error: 'Unauthorized: Only authorized users can create posts' });
        }

        const newBlog = new TechBlog({
            category,
            title,
            content,
            author: {
                name: author.name,
                email: author.email,
                avatar: author.avatar
            },
            likes: 0,
            views: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            isPublished: true,
            show: 'Y',
            likedBy: [],
            tags: req.body.tags || [],
            isAutomated: false
        });

        const savedBlog = await newBlog.save();
        console.log('[TECH-BLOG] Post saved successfully:', savedBlog._id);
        console.log('[TECH-BLOG] Saved tags:', savedBlog.tags);
        res.status(201).json(savedBlog);
    } catch (err) {
        console.error('[TECH-BLOG] Error creating post:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- API Key Authentication for Automated Blog Uploads ---
// --- API Key Authentication for Automated Blog Uploads ---
const validateBlogApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const expectedKey = process.env.BLOG_API_KEY;

    if (!expectedKey) {
        console.error('[TECH-BLOG-AUTO] BLOG_API_KEY not configured in environment');
        return res.status(500).json({ error: 'API key not configured on server' });
    }

    if (!apiKey || apiKey !== expectedKey) {
        console.error('[TECH-BLOG-AUTO] Invalid or missing API key');
        return res.status(401).json({ error: 'Invalid or missing API key' });
    }

    next();
};

const shouldSyncToObsidian = (blogDoc) => {
    const isPublished = blogDoc?.isPublished === true || blogDoc?.isPublished === 'true';
    const isShown = String(blogDoc?.show || '').toUpperCase() === 'Y';
    return isPublished && isShown;
};

const triggerPublishedBlogSync = async (post) => {
    const webhookUrl = process.env.N8N_BLOG_PUBLISH_WEBHOOK_URL;
    if (!webhookUrl) {
        console.log('[TECH-BLOG] N8N_BLOG_PUBLISH_WEBHOOK_URL not set, skipping publish sync trigger');
        return;
    }

    const token = process.env.N8N_BLOG_PUBLISH_WEBHOOK_TOKEN || '';
    const headers = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['x-webhook-token'] = token;
    }

    const payload = {
        source: 'distilledchild-blog',
        event: 'blog_published',
        post: {
            id: String(post._id),
            category: post.category || '',
            title: post.title || '',
            content: post.content || '',
            tags: Array.isArray(post.tags) ? post.tags : [],
            slug: post.slug || '',
            isPublished: !!post.isPublished,
            show: post.show || 'N',
            isAutomated: !!post.isAutomated,
            author: post.author || {},
            references: Array.isArray(post.references) ? post.references : [],
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
        },
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const text = await response.text();
            console.error('[TECH-BLOG] Failed to trigger n8n publish webhook:', response.status, text);
            return;
        }

        console.log('[TECH-BLOG] n8n publish webhook triggered successfully for post:', post._id);
    } catch (error) {
        console.error('[TECH-BLOG] Error triggering n8n publish webhook:', error);
    }
};

// Automated Blog Post Creation (for n8n and external services)
app.post('/api/tech-blog/auto', validateBlogApiKey, async (req, res) => {
    try {
        const { category, title, content, author, tags, references } = req.body;

        // Strictly enforce requested defaults for automated (n8n) posts
        const finalIsPublished = false;
        const finalIsAutomated = true;
        const finalShow = 'N';

        console.log(`[TECH-BLOG-AUTO] Enforcing strict flags - isPublished: ${finalIsPublished}, isAutomated: ${finalIsAutomated}, show: ${finalShow}`);

        // Validate required fields
        if (!category || !title || !content) {
            console.error('[TECH-BLOG-AUTO] Missing required fields');
            return res.status(400).json({ error: 'Category, title, and content are required' });
        }

        // Set default author if not provided
        const blogAuthor = author || {
            name: 'Auto Post',
            email: 'distilledchild@gmail.com',
            avatar: ''
        };

        const newBlog = new TechBlog({
            category,
            title,
            content,
            author: {
                name: blogAuthor.name,
                email: blogAuthor.email,
                avatar: blogAuthor.avatar || ''
            },
            likes: 0,
            views: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            isPublished: finalIsPublished,
            show: finalShow,
            likedBy: [],
            tags: (() => {
                // Normalize tags: handle string or array, split by comma, flatten, and hyphenate spaces
                let tagList = [];
                if (typeof tags === 'string') {
                    tagList = tags.split(',');
                } else if (Array.isArray(tags)) {
                    tagList = tags.flatMap(t => String(t).split(','));
                }

                return tagList
                    .map(t => t.trim())
                    .filter(t => t)
                    .map(t => t.replace(/\s+/g, '-')); // Replace spaces with hyphens
            })(),
            isAutomated: finalIsAutomated,
            references: (() => {
                // Normalize references: if string, split by newline or space-separated URLs
                if (typeof references === 'string') {
                    return references.split(/[\n\s]+/).map(r => r.trim()).filter(r => r.startsWith('http'));
                }
                return Array.isArray(references) ? references.map(r => String(r).trim()).filter(r => r) : [];
            })()
        });

        const savedBlog = await newBlog.save();
        console.log('[TECH-BLOG-AUTO] Automated post saved successfully:', savedBlog._id);
        res.status(201).json({
            success: true,
            message: 'Blog post created successfully',
            post: savedBlog
        });
    } catch (err) {
        console.error('[TECH-BLOG-AUTO] Error creating automated post:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ... (skip upload-image, opal-generate, like)

// Update Tech and Bio Post
app.put('/api/tech-blog/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[TECH-BLOG] PUT request for id: ${id}`, req.body);
        console.log('[TECH-BLOG] Tags received:', req.body.tags, 'Type:', typeof req.body.tags);
        const { category, title, content, email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const blog = await TechBlog.findById(id);
        if (!blog) {
            console.error('[TECH-BLOG] Post not found:', id);
            return res.status(404).json({ error: 'Blog post not found' });
        }

        const wasSyncEligible = shouldSyncToObsidian(blog);

        // Check if user is the author OR is in the authorized list
        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];

        const authorEmail = blog.author?.email || '';
        const requestEmail = email || '';

        const isAuthor = authorEmail.toLowerCase() === requestEmail.toLowerCase();
        // Case-insensitive admin check
        const isAdmin = authorizedEmails.map(e => e.toLowerCase()).includes(requestEmail.toLowerCase());

        if (!isAuthor && !isAdmin) {
            console.error(`[TECH-BLOG] Unauthorized update attempt. Stored Author: '${authorEmail}', Requestor: '${requestEmail}'`);
            console.error(`[TECH-BLOG] comparisons - isAuthor: ${isAuthor}, isAdmin: ${isAdmin}`);
            return res.status(403).json({ error: `Unauthorized: Stored author '${authorEmail}' does not match requestor '${requestEmail}'` });
        }

        // Update fields
        if (category) blog.category = category;
        if (title) blog.title = title;
        if (content) blog.content = content;
        if (req.body.tags) blog.tags = req.body.tags;

        // Handle boolean updates for isPublished and isAutomated
        if (req.body.isPublished !== undefined) {
            blog.isPublished = typeof req.body.isPublished === 'string'
                ? req.body.isPublished.toLowerCase() === 'true'
                : !!req.body.isPublished;
        }

        if (req.body.isAutomated !== undefined) {
            blog.isAutomated = typeof req.body.isAutomated === 'string'
                ? req.body.isAutomated.toLowerCase() === 'true'
                : !!req.body.isAutomated;
        }

        if (req.body.show !== undefined) {
            const normalizedShow = String(req.body.show).trim().toUpperCase();
            blog.show = ['Y', 'N', 'D'].includes(normalizedShow) ? normalizedShow : 'N';
        }

        blog.updatedAt = new Date();

        const updatedBlog = await blog.save();
        console.log('[TECH-BLOG] Post updated successfully:', updatedBlog._id);
        console.log('[TECH-BLOG] Updated tags:', updatedBlog.tags);

        const isSyncEligible = shouldSyncToObsidian(updatedBlog);
        if (!wasSyncEligible && isSyncEligible) {
            await triggerPublishedBlogSync(updatedBlog);
        }

        res.json(updatedBlog);
    } catch (err) {
        console.error('[TECH-BLOG] Error updating post:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper to determine GCS storage prefix based on category
const getStoragePrefix = (category) => {
    const lowerCategory = (category || '').toLowerCase();
    if (lowerCategory === 'biology' || lowerCategory === 'bio') {
        return 'blog/bio';
    } else if (lowerCategory === 'tech') {
        return 'blog/tech';
    } else if (lowerCategory === 'cooking' || lowerCategory === 'cook') {
        return 'blog/cook';
    }
    return 'blog/misc';
};

// Upload image to GCS for Tech and Bio (Conditional Auth)
app.post('/api/tech-blog/upload-image', upload.single('image'), (req, res, next) => {
    // If request identifies as n8n, require API key
    const isN8N = req.body.authorName === 'n8n' ||
        (req.body.author && (req.body.author === 'n8n' || req.body.author.name === 'n8n')) ||
        req.body.isAutomated === 'true' || req.body.isAutomated === true;

    if (isN8N) {
        return validateBlogApiKey(req, res, next);
    }
    next();
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        const file = req.file;
        const timestamp = Date.now();
        const fileName = `${timestamp}-${file.originalname.replace(/\s+/g, '-')}`;
        const bucketName = process.env.GCS_BUCKET_NAME || 'distilledchild';
        const bucket = storage.bucket(bucketName);
        console.log('Request body:', req.body);   // 바디 전체 확인
        // 카테고리 분기
        const category = req.body.category; // 클라이언트에서 전달
        console.log('Received category:', category);
        // Use helper for prefix
        const prefix = getStoragePrefix(category);

        const blob = bucket.file(`${prefix}/${fileName}`);

        // Create a write stream
        const blobStream = blob.createWriteStream({
            resumable: false,
            metadata: {
                contentType: file.mimetype,
            },
        });

        blobStream.on('error', (err) => {
            console.error('Upload error:', err);
            res.status(500).json({ error: 'Failed to upload image' });
        });

        blobStream.on('finish', async () => {
            // Make the file public
            await blob.makePublic();

            // Generate public URL
            const publicUrl = `https://storage.googleapis.com/${bucketName}/${prefix}/${fileName}`;

            res.json({
                success: true,
                url: publicUrl,
                fileName: fileName
            });
        });

        // Write the file buffer to GCS
        blobStream.end(file.buffer);
    } catch (err) {
        console.error('Image upload error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Upload base64 image to GCS (Conditional Auth)
app.post('/api/tech-blog/upload-image-base64', (req, res, next) => {
    const isN8N = req.body.authorName === 'n8n' ||
        (req.body.author && (req.body.author === 'n8n' || req.body.author.name === 'n8n')) ||
        req.body.isAutomated === true;

    if (isN8N) {
        return validateBlogApiKey(req, res, next);
    }
    next();
}, async (req, res) => {
    try {
        console.log('[TECH-BLOG-AUTO] Base64 image upload request received');
        const { base64Data, mimeType, category, fileName } = req.body;

        if (!base64Data) {
            return res.status(400).json({ error: 'base64Data is required' });
        }

        // Convert base64 to buffer
        const buffer = Buffer.from(base64Data, 'base64');

        // Generate filename
        const timestamp = Date.now();
        const extension = (mimeType || 'image/png').split('/')[1] || 'png';
        const finalFileName = fileName || `infographic-${timestamp}.${extension}`;

        const bucketName = process.env.GCS_BUCKET_NAME || 'distilledchild';
        const bucket = storage.bucket(bucketName);

        // Use helper for prefix
        const prefix = getStoragePrefix(category);
        const blob = bucket.file(`${prefix}/${finalFileName}`);

        // Create a write stream
        const blobStream = blob.createWriteStream({
            resumable: false,
            metadata: {
                contentType: mimeType || 'image/png',
            },
        });

        blobStream.on('error', (err) => {
            console.error('[TECH-BLOG-AUTO] Upload error:', err);
            res.status(500).json({ error: 'Failed to upload image' });
        });

        blobStream.on('finish', async () => {
            // Make the file public
            await blob.makePublic();

            // Generate public URL
            const publicUrl = `https://storage.googleapis.com/${bucketName}/${prefix}/${finalFileName}`;

            console.log('[TECH-BLOG-AUTO] Image uploaded successfully:', publicUrl);
            res.json({
                success: true,
                url: publicUrl,
                fileName: finalFileName
            });
        });

        // Write the buffer to GCS
        blobStream.end(buffer);
    } catch (err) {
        console.error('[TECH-BLOG-AUTO] Error processing base64 image:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Like/Unlike Tech and Bio Post
app.post('/api/tech-blog/:id/like', async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const blog = await TechBlog.findById(id);
        if (!blog) {
            return res.status(404).json({ error: 'Blog post not found' });
        }

        // Initialize likedBy if it doesn't exist
        if (!blog.likedBy) {
            blog.likedBy = [];
        }

        // Check if user already liked (by email)
        const likedIndex = blog.likedBy.indexOf(email);

        if (likedIndex > -1) {
            // Unlike: remove email from likedBy
            blog.likedBy.splice(likedIndex, 1);
        } else {
            // Like: add email to likedBy
            blog.likedBy.push(email);
        }

        // Update likes count based on likedBy array length
        blog.likes = blog.likedBy.length;

        await blog.save();
        res.json({
            likes: blog.likes,
            likedBy: blog.likedBy,
            isLiked: likedIndex === -1
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// Delete (Soft Delete) Tech and Bio Post
app.delete('/api/tech-blog/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const blog = await TechBlog.findById(id);
        if (!blog) {
            return res.status(404).json({ error: 'Blog post not found' });
        }

        // Check if user is the author OR is in the authorized list
        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];

        const authorEmail = blog.author?.email || '';
        const requestEmail = email || '';

        const isAuthor = authorEmail.toLowerCase() === requestEmail.toLowerCase();
        // Case-insensitive admin check
        const isAdmin = authorizedEmails.map(e => e.toLowerCase()).includes(requestEmail.toLowerCase());

        if (!isAuthor && !isAdmin) {
            console.error(`[TECH-BLOG] Unauthorized delete attempt. Stored Author: '${authorEmail}', Requestor: '${requestEmail}'`);
            return res.status(403).json({ error: `Unauthorized: Stored author '${authorEmail}' does not match requestor '${requestEmail}'` });
        }

        // Soft delete: mark as deleted so it does not collide with pending drafts.
        blog.show = 'D';
        blog.updatedAt = new Date();

        await blog.save();
        res.json({ message: 'Blog post deleted successfully', blog });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- About Page Schemas & Endpoints ---

// ABOUT_ME Schema
const aboutMeSchema = new mongoose.Schema({
    introduction: String,
    research_interests: [String],
    hobbies: [String],
    future_goal: String,
    profile_pic_position: {
        x: { type: Number, default: 50 },
        y: { type: Number, default: 50 }
    },
    show: { type: String, default: 'Y' },
    updated_at: { type: Date, default: Date.now }
}, { collection: 'ABOUT_ME' });

const AboutMe = mongoose.model('AboutMe', aboutMeSchema);

// ABOUT_ACADEMIC Schema
const aboutAcademicSchema = new mongoose.Schema({
    education: [{
        degree: String,
        institution: String,
        location: String,
        period: String,
        description: String,
        gpa: String,
        order: Number
    }],
    experience: [{
        title: String,
        organization: String,
        location: String,
        period: String,
        description: String,
        responsibilities: [String],
        order: Number
    }],
    publications: [{
        title: String,
        authors: String,
        journal: String,
        year: Number,
        volume: String,
        pages: String,
        doi: String,
        pmid: String,
        type: String,
        order: Number
    }],
    skills: {
        programming: [{ name: String, level: String, order: Number }],
        bioinformatics: [{ name: String, level: String, order: Number }],
        tools: [{ name: String, level: String, order: Number }],
        frameworks: [{ name: String, level: String, order: Number }]
    },
    awards: [{
        title: String,
        organization: String,
        year: Number,
        description: String,
        order: Number
    }],
    links: {
        ORCiD: String,
        GoogleScholar: String,
        cv: String
    },
    show: { type: String, default: 'Y' },
    updated_at: { type: Date, default: Date.now }
}, { collection: 'ABOUT_ACADEMIC' });

const AboutAcademic = mongoose.model('AboutAcademic', aboutAcademicSchema);

// Milestone Schema
const milestoneSchema = new mongoose.Schema({
    date: Date,
    title: String,
    description: String,
    createdAt: Date,
    category: String // 'ME' or 'WEB'
}, { collection: 'ABOUT_MILESTONE' });

const Milestone = mongoose.model('Milestone', milestoneSchema);

// Get Milestones
app.get('/api/milestones', async (req, res) => {
    try {
        // Sort by date ascending (chronological) as per "time order" request for history
        const milestones = await Milestone.find({}).sort({ date: 1 });
        res.json(milestones);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create Milestone
app.post('/api/milestones', async (req, res) => {
    try {
        const { date, title, description, category, email } = req.body;

        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];
        if (!authorizedEmails.includes(email)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const newMilestone = new Milestone({
            date: new Date(date),
            title,
            description,
            category,
            createdAt: new Date()
        });

        await newMilestone.save();
        res.status(201).json(newMilestone);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update Milestone
app.put('/api/milestones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { date, title, description, category, email } = req.body;

        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];
        if (!authorizedEmails.includes(email)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const milestone = await Milestone.findById(id);
        if (!milestone) return res.status(404).json({ error: 'Not found' });

        if (date) milestone.date = new Date(date);
        if (title) milestone.title = title;
        if (description) milestone.description = description;
        if (category) milestone.category = category;

        await milestone.save();
        res.json(milestone);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete Milestone
app.delete('/api/milestones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.body;

        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];
        if (!authorizedEmails.includes(email)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        await Milestone.findByIdAndDelete(id);
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- ABOUT_ME Endpoints ---

// Get About Me
app.get('/api/about-me', async (req, res) => {
    try {
        const aboutMe = await AboutMe.findOne({ show: 'Y' });
        res.json(aboutMe || {});
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create About Me
app.post('/api/about-me', async (req, res) => {
    try {
        const { introduction, research_interests, hobbies, future_goal, email } = req.body;

        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];
        if (!authorizedEmails.includes(email)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const newAboutMe = new AboutMe({
            introduction,
            research_interests,
            hobbies,
            future_goal,
            show: 'Y',
            updated_at: new Date()
        });

        await newAboutMe.save();
        res.status(201).json(newAboutMe);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update About Me
app.put('/api/about-me/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { introduction, research_interests, hobbies, future_goal, profile_pic_position, email } = req.body;

        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];
        if (!authorizedEmails.includes(email)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const aboutMe = await AboutMe.findById(id);
        if (!aboutMe) return res.status(404).json({ error: 'Not found' });

        if (introduction !== undefined) aboutMe.introduction = introduction;
        if (research_interests !== undefined) aboutMe.research_interests = research_interests;
        if (hobbies !== undefined) aboutMe.hobbies = hobbies;
        if (future_goal !== undefined) aboutMe.future_goal = future_goal;
        if (profile_pic_position !== undefined) aboutMe.profile_pic_position = profile_pic_position;
        aboutMe.updated_at = new Date();

        await aboutMe.save();
        res.json(aboutMe);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Upload profile picture to GCS
app.post('/api/about-me/upload-profile-pic', upload.single('image'), async (req, res) => {
    try {
        const { email, isCropped } = req.body;
        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];

        if (!email || !authorizedEmails.includes(email)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        const file = req.file;
        const bucketName = process.env.GCS_BUCKET_NAME || 'distilledchild';
        const bucket = storage.bucket(bucketName);
        const prefix = 'misc';

        // If this is a cropped image, only save to main file
        // If this is a new upload (not cropped), save to both original and main
        const mainFileName = 'distilledchild-profile-pic.jpg';
        const originalFileName = 'distilledchild-profile-pic-original.jpg';

        const uploadToGCS = (targetFileName) => {
            return new Promise((resolve, reject) => {
                const blob = bucket.file(`${prefix}/${targetFileName}`);
                const blobStream = blob.createWriteStream({
                    resumable: false,
                    metadata: {
                        contentType: 'image/jpeg',
                    },
                });

                blobStream.on('error', (err) => {
                    console.error(`[ABOUT-ME] Upload error for ${targetFileName}:`, err);
                    reject(err);
                });

                blobStream.on('finish', async () => {
                    await blob.makePublic();
                    const publicUrl = `https://storage.googleapis.com/${bucketName}/${prefix}/${targetFileName}`;
                    console.log(`[ABOUT-ME] Profile picture saved: ${publicUrl}`);
                    resolve(publicUrl);
                });

                blobStream.end(file.buffer);
            });
        };

        if (isCropped === 'true') {
            // Only save the cropped version to main file
            const url = await uploadToGCS(mainFileName);
            res.json({ success: true, url });
        } else {
            // Save to both original and main (new image upload)
            await uploadToGCS(originalFileName);
            const url = await uploadToGCS(mainFileName);
            res.json({ success: true, url });
        }
    } catch (err) {
        console.error('[ABOUT-ME] Image upload error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- ABOUT_ACADEMIC Endpoints ---

// Get About Academic
app.get('/api/about-academic', async (req, res) => {
    try {
        const aboutAcademic = await AboutAcademic.findOne({ show: 'Y' });
        res.json(aboutAcademic || {});
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create About Academic
app.post('/api/about-academic', async (req, res) => {
    try {
        const { education, experience, publications, skills, awards, links, email } = req.body;

        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];
        if (!authorizedEmails.includes(email)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const newAboutAcademic = new AboutAcademic({
            education,
            experience,
            publications,
            skills,
            awards,
            links,
            show: 'Y',
            updated_at: new Date()
        });

        await newAboutAcademic.save();
        res.status(201).json(newAboutAcademic);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update About Academic
app.put('/api/about-academic/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { education, experience, publications, skills, awards, links, email } = req.body;

        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];
        if (!authorizedEmails.includes(email)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const aboutAcademic = await AboutAcademic.findById(id);
        if (!aboutAcademic) return res.status(404).json({ error: 'Not found' });

        if (education !== undefined) aboutAcademic.education = education;
        if (experience !== undefined) aboutAcademic.experience = experience;
        if (publications !== undefined) aboutAcademic.publications = publications;
        if (skills !== undefined) aboutAcademic.skills = skills;
        if (awards !== undefined) aboutAcademic.awards = awards;

        if (links !== undefined) {
            console.log('Updating links:', links);
            aboutAcademic.links = {
                ORCiD: links.ORCiD,
                GoogleScholar: links.GoogleScholar,
                cv: links.cv
            };
        }

        aboutAcademic.updated_at = new Date();

        await aboutAcademic.save();
        console.log('AboutAcademic updated successfully');
        res.json(aboutAcademic);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://www.distilledchild.space",
            "https://distilledchild.space",
            "https://personal-web-2025-mauve.vercel.app"
        ],
        methods: ["GET", "POST"]
    }
});

// State
let waitingQueue = []; // Array of { socketId: string, userInfo: { email?: string, name?: string, avatar?: string } }
let activeChat = null; // { visitorId: string, ownerId: string, userInfo: object } | null
let ownerSocketId = null;
let allChats = new Map(); // socketId -> { messages: [], userInfo: {}, sessionId: string }

// Helper: Generate readable name from session ID
function generateNickname(sessionId) {
    // Extract numbers from session ID (e.g., "1764277055030-abc123" -> "1764277055030")
    const numbers = sessionId.split('-')[0];

    // Mapping: 0-9 to letters
    const map = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

    let nickname = '';
    for (let char of numbers) {
        nickname += map[parseInt(char)];
    }

    return nickname;
}

// Helper: Save chat to file
function saveChatToFile(socketId, chatData) {
    const logsDir = path.join(__dirname, 'chat_logs');

    // Create directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    const userInfo = chatData.userInfo || {};
    const messages = chatData.messages || [];
    const sessionId = chatData.sessionId || socketId;

    // Generate identifier (email or nickname from session ID)
    let identifier;
    if (userInfo.email) {
        identifier = userInfo.email.split('@')[0]; // e.g., "distilledchild"
    } else {
        identifier = generateNickname(sessionId);
    }

    // Get current date in MM_DD format
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${month}_${day}`;

    // Base filename
    let baseFilename = `${datePrefix}_${identifier}`;
    let filename = `${baseFilename}.txt`;
    let filePath = path.join(logsDir, filename);

    // Check if file exists and find the right sequence number
    let sequenceNumber = 1;
    if (fs.existsSync(filePath)) {
        // Read existing file to check if it's from today
        const existingContent = fs.readFileSync(filePath, 'utf-8');
        const firstLine = existingContent.split('\n')[0];

        // Check if last message is from today
        const today = now.toISOString().split('T')[0];
        if (firstLine.includes(today)) {
            // Same day - append to existing file
            // Do nothing, will append below
        } else {
            // Different day - need to find sequence number
            while (fs.existsSync(filePath)) {
                filename = `${baseFilename}_${sequenceNumber}.txt`;
                filePath = path.join(logsDir, filename);
                sequenceNumber++;
            }
        }
    }

    // Format messages
    const timestamp = new Date().toISOString();
    let content = `\n=== Chat Session: ${timestamp} ===\n`;
    content += `User: ${userInfo.name || identifier}\n`;
    content += `Session ID: ${sessionId}\n\n`;

    messages.forEach(msg => {
        const speaker = msg.sender === 'owner' ? 'Distilled Child' : (userInfo.name || identifier);
        content += `[${speaker}]: ${msg.text}\n`;
    });

    content += `\n=== End of Session ===\n`;

    // Append to file
    fs.appendFileSync(filePath, content, 'utf-8');
    console.log(`Chat saved to: ${filename}`);
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // 1. Register Owner
    socket.on('register_owner', () => {
        console.log('Owner registered:', socket.id);
        ownerSocketId = socket.id;

        // Send current queue and all waiting users to owner
        socket.emit('queue_update', {
            count: waitingQueue.length,
            queue: waitingQueue,
            active: activeChat ? {
                socketId: activeChat.visitorId,
                userInfo: activeChat.userInfo
            } : null
        });

        // If there's no active chat but people are waiting, start next chat automatically
        if (!activeChat && waitingQueue.length > 0) {
            startNextChat();
        }
    });

    // 2. Visitor Joins Queue
    socket.on('join_queue', (data) => {
        if (socket.id === ownerSocketId) return; // Owner doesn't join queue

        // data: { userInfo: { email?, name?, avatar? } }
        const userInfo = data?.userInfo || {};

        // Check if owner is online
        if (!ownerSocketId) {
            // Owner is offline - notify visitor
            socket.emit('owner_offline');
            return;
        }

        // Check if already in queue or active
        if (waitingQueue.some(q => q.socketId === socket.id)) return;
        if (activeChat && activeChat.visitorId === socket.id) return;

        console.log('Visitor joined queue:', socket.id, userInfo);
        waitingQueue.push({ socketId: socket.id, userInfo });

        // Generate or retrieve session ID for this socket
        let sessionId = socket.handshake.query.sessionId || `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

        // Initialize chat history with session ID
        allChats.set(socket.id, { messages: [], userInfo, sessionId });

        // Notify visitor of their position
        updateVisitorStatus(socket.id);

        // Notify owner of new queue with user info
        if (ownerSocketId) {
            io.to(ownerSocketId).emit('queue_update', {
                count: waitingQueue.length,
                queue: waitingQueue,
                active: activeChat ? {
                    socketId: activeChat.visitorId,
                    userInfo: activeChat.userInfo
                } : null
            });
        }

        // Try to start chat if owner is free
        if (ownerSocketId && !activeChat) {
            startNextChat();
        }
    });

    // 3. Send Message
    socket.on('send_message', (data) => {
        // data: { text: string, targetSocketId?: string }
        const targetSocketId = data.targetSocketId;

        if (socket.id === ownerSocketId) {
            // Owner sent message -> send to specified visitor or active visitor
            const recipientId = targetSocketId || (activeChat ? activeChat.visitorId : null);
            if (recipientId) {
                io.to(recipientId).emit('receive_message', {
                    text: data.text,
                    sender: 'owner'
                });

                // Store message in chat history
                const chatData = allChats.get(recipientId);
                if (chatData) {
                    chatData.messages.push({ sender: 'owner', text: data.text, timestamp: Date.now() });
                }
            }
        } else {
            // Visitor sent message
            // Store message in chat history regardless of owner being online
            const chatData = allChats.get(socket.id);
            if (chatData) {
                chatData.messages.push({ sender: 'visitor', text: data.text, timestamp: Date.now() });
            }

            // If owner is online, send message to owner
            if (ownerSocketId && activeChat && socket.id === activeChat.visitorId) {
                io.to(ownerSocketId).emit('receive_message', {
                    text: data.text,
                    sender: 'visitor',
                    fromSocketId: socket.id
                });
            }
        }
    });

    // 4. Switch Chat (Owner selects different visitor)
    socket.on('switch_chat', (data) => {
        if (socket.id !== ownerSocketId) return;

        const { targetSocketId } = data;

        // Check if target is in queue or already active
        const inQueue = waitingQueue.find(q => q.socketId === targetSocketId);
        const isActive = activeChat && activeChat.visitorId === targetSocketId;

        if (!inQueue && !isActive) return;

        // If switching to someone in queue, move them to active and put current back in queue
        if (inQueue && !isActive) {
            // Put current active back in queue (at front)
            if (activeChat) {
                waitingQueue.unshift({
                    socketId: activeChat.visitorId,
                    userInfo: activeChat.userInfo
                });

                // Notify previous active visitor they're back in queue
                io.to(activeChat.visitorId).emit('queue_status', { position: 1 });
            }

            // Remove new active from queue
            waitingQueue = waitingQueue.filter(q => q.socketId !== targetSocketId);

            // Set new active chat
            activeChat = {
                visitorId: targetSocketId,
                ownerId: ownerSocketId,
                userInfo: inQueue.userInfo
            };

            // Notify new active visitor
            io.to(targetSocketId).emit('chat_started', { position: 0 });

            // Send chat history to owner
            const chatData = allChats.get(targetSocketId);
            socket.emit('chat_history', {
                socketId: targetSocketId,
                messages: chatData?.messages || [],
                userInfo: chatData?.userInfo || {}
            });

            // Update owner's queue view
            socket.emit('queue_update', {
                count: waitingQueue.length,
                queue: waitingQueue,
                active: {
                    socketId: activeChat.visitorId,
                    userInfo: activeChat.userInfo
                }
            });

            // Update other waiters
            waitingQueue.forEach((q, idx) => {
                io.to(q.socketId).emit('queue_status', { position: idx + 1 });
            });
        } else if (isActive) {
            // Just send the chat history if clicking on already active user
            const chatData = allChats.get(targetSocketId);
            socket.emit('chat_history', {
                socketId: targetSocketId,
                messages: chatData?.messages || [],
                userInfo: chatData?.userInfo || {}
            });
        }
    });

    // 5. Close Chat (Owner closes specific user's chat)
    socket.on('close_chat', (data) => {
        if (socket.id !== ownerSocketId) return;

        const { targetSocketId } = data;

        // Save chat to file
        const chatData = allChats.get(targetSocketId);
        if (chatData && chatData.messages.length > 0) {
            saveChatToFile(targetSocketId, chatData);
        }

        // Remove from queue or active
        const queueIndex = waitingQueue.findIndex(q => q.socketId === targetSocketId);
        if (queueIndex !== -1) {
            waitingQueue.splice(queueIndex, 1);
        }

        if (activeChat && activeChat.visitorId === targetSocketId) {
            // Notify visitor that chat ended
            io.to(targetSocketId).emit('chat_ended', { reason: 'owner_closed' });
            activeChat = null;

            // Start next chat if available
            startNextChat();
        } else {
            // Just notify the visitor in queue
            io.to(targetSocketId).emit('chat_ended', { reason: 'owner_closed' });
        }

        // Update owner's queue
        if (ownerSocketId) {
            io.to(ownerSocketId).emit('queue_update', {
                count: waitingQueue.length,
                queue: waitingQueue,
                active: activeChat ? {
                    socketId: activeChat.visitorId,
                    userInfo: activeChat.userInfo
                } : null
            });
        }

        // Update other waiters
        waitingQueue.forEach((q, idx) => {
            io.to(q.socketId).emit('queue_status', { position: idx + 1 });
        });

        // Don't delete chat data immediately - keep for potential reconnection
    });

    // 6. Visitor closes chat
    socket.on('visitor_close', () => {
        if (socket.id === ownerSocketId) return;

        // Save chat to file
        const chatData = allChats.get(socket.id);
        if (chatData && chatData.messages.length > 0) {
            saveChatToFile(socket.id, chatData);
        }

        // Reset chat history but keep the data structure for potential reconnection
        if (allChats.has(socket.id)) {
            const chatData = allChats.get(socket.id);
            allChats.set(socket.id, {
                messages: [],
                userInfo: chatData.userInfo,
                sessionId: chatData.sessionId
            });
        }

        // Remove from queue or active
        const queueIndex = waitingQueue.findIndex(q => q.socketId === socket.id);
        if (queueIndex !== -1) {
            waitingQueue.splice(queueIndex, 1);
        }

        if (activeChat && activeChat.visitorId === socket.id) {
            activeChat = null;
            // Start next chat
            startNextChat();
        }

        // Update owner
        if (ownerSocketId) {
            io.to(ownerSocketId).emit('queue_update', {
                count: waitingQueue.length,
                queue: waitingQueue,
                active: activeChat ? {
                    socketId: activeChat.visitorId,
                    userInfo: activeChat.userInfo
                } : null
            });
        }

        // Update other waiters
        waitingQueue.forEach((q, idx) => {
            io.to(q.socketId).emit('queue_status', { position: idx + 1 });
        });
    });

    // 7. End Chat (Owner triggered - legacy)
    socket.on('end_chat', () => {
        if (socket.id !== ownerSocketId) return;
        endCurrentChat();
    });

    // 8. Disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        if (socket.id === ownerSocketId) {
            ownerSocketId = null;
            // Optionally notify active visitor that owner left?
        } else {
            // Remove from queue if present
            const queueIndex = waitingQueue.findIndex(q => q.socketId === socket.id);
            if (queueIndex !== -1) {
                waitingQueue.splice(queueIndex, 1);
                // Notify everyone behind them that position changed
                waitingQueue.forEach((q, idx) => {
                    io.to(q.socketId).emit('queue_status', { position: idx + 1 });
                });

                // Notify owner
                if (ownerSocketId) {
                    io.to(ownerSocketId).emit('queue_update', {
                        count: waitingQueue.length,
                        queue: waitingQueue,
                        active: activeChat ? {
                            socketId: activeChat.visitorId,
                            userInfo: activeChat.userInfo
                        } : null
                    });
                }
            }

            // End active chat if it was this visitor
            if (activeChat && activeChat.visitorId === socket.id) {
                io.to(ownerSocketId).emit('chat_ended', { reason: 'visitor_disconnected' });
                activeChat = null;
                // Auto-start next chat?
                startNextChat();
            }

            // Keep chat history for a while (could clean up after timeout)
            // For now, we keep it in memory
        }
    });
});

function startNextChat() {
    if (waitingQueue.length === 0) return;
    if (!ownerSocketId) return;

    const nextVisitor = waitingQueue.shift();
    activeChat = {
        visitorId: nextVisitor.socketId,
        ownerId: ownerSocketId,
        userInfo: nextVisitor.userInfo
    };

    console.log('Starting chat with:', nextVisitor.socketId);

    // Send chat history to owner
    const chatData = allChats.get(nextVisitor.socketId);
    io.to(ownerSocketId).emit('chat_history', {
        socketId: nextVisitor.socketId,
        messages: chatData?.messages || [],
        userInfo: chatData?.userInfo || {}
    });

    // Notify Owner
    io.to(ownerSocketId).emit('chat_started', { visitorId: nextVisitor.socketId });
    io.to(ownerSocketId).emit('queue_update', {
        count: waitingQueue.length,
        queue: waitingQueue,
        active: {
            socketId: activeChat.visitorId,
            userInfo: activeChat.userInfo
        }
    });

    // Notify Visitor
    io.to(nextVisitor.socketId).emit('chat_started', { position: 0 });

    // Update remaining queue
    waitingQueue.forEach((q, idx) => {
        io.to(q.socketId).emit('queue_status', { position: idx + 1 });
    });
}

function endCurrentChat() {
    if (!activeChat) return;

    const { visitorId } = activeChat;

    // Notify Visitor
    io.to(visitorId).emit('chat_ended', { reason: 'owner_ended' });

    activeChat = null;

    // Notify Owner (update UI)
    if (ownerSocketId) {
        io.to(ownerSocketId).emit('queue_update', {
            count: waitingQueue.length,
            queue: waitingQueue,
            active: null
        });
    }

    // Start next
    startNextChat();
}

function updateVisitorStatus(socketId) {
    const index = waitingQueue.findIndex(q => q.socketId === socketId);
    if (index !== -1) {
        // Position 1 means 1 person ahead (index 0 = position 1)
        io.to(socketId).emit('queue_status', { position: index + 1 });
    }
}

// --- Strava API Endpoints ---

// Strava OAuth - Initiate Authorization
app.get('/api/strava/auth', (req, res) => {
    const clientId = process.env.STRAVA_CLIENT_ID;
    // Use environment-based redirect URI (same as Google OAuth pattern)
    const stravaRedirectUri = isProduction
        ? 'https://distilledchild.space/strava/callback'
        : (process.env.STRAVA_REDIRECT_URI || 'http://localhost:3000/strava/callback');
    const redirectUri = encodeURIComponent(stravaRedirectUri);
    const scope = 'read,activity:read_all,profile:read_all,read_all';

    if (!clientId) {
        return res.status(500).json({ error: 'Strava client ID not configured' });
    }

    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=force&scope=${scope}`;

    res.json({ authUrl });
});

// Strava OAuth - Exchange Code for Token
app.post('/api/strava/exchange_token', async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Authorization code is required' });
        }

        const clientId = process.env.STRAVA_CLIENT_ID;
        const clientSecret = process.env.STRAVA_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            return res.status(500).json({ error: 'Strava credentials not configured' });
        }

        const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code: code,
                grant_type: 'authorization_code'
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Token exchange failed:', response.status, errorText);
            return res.status(response.status).json({ error: 'Failed to exchange token', details: errorText });
        }

        const data = await response.json();
        console.log('Successfully exchanged code for token');
        res.json(data);
    } catch (err) {
        console.error('Token exchange error:', err);
        res.status(500).json({ error: 'Failed to exchange token', details: err.message });
    }
});

// Get Strava Activities with provided access token
app.post('/api/strava/activities-with-token', async (req, res) => {
    try {
        const { accessToken } = req.body;

        if (!accessToken) {
            return res.status(400).json({ error: 'Access token is required' });
        }

        const response = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=100', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Strava API Error:', response.status, errorText);
            return res.status(response.status).json({ error: `Strava API error: ${response.status}`, details: errorText });
        }

        const activities = await response.json();
        console.log(`Fetched ${activities.length} activities from Strava`);

        // Sync with database
        try {
            const dbCount = await Workout.countDocuments();
            const apiCount = activities.length;

            console.log(`DB has ${dbCount} activities, API returned ${apiCount} activities`);

            // Always try to sync/insert new activities
            // We'll filter out ones that already exist by ID to avoid duplicate key errors filling up logs,
            // or just rely on the unique index and ordered: false.
            // Since we want to be robust, let's just try to insert all and let Mongo handle duplicates.

            console.log(`Attempting to sync ${apiCount} activities to DB`);

            if (apiCount > 0) {
                console.log('Sample activity structure:', JSON.stringify(activities[0], null, 2));
            }

            // Prepare activities for insertion
            const activitiesToInsert = activities.map(activity => {
                // Ensure required fields are present
                if (!activity.id) {
                    console.warn('Activity missing ID:', activity);
                }
                return {
                    activity_id: activity.id,
                    name: activity.name,
                    distance: activity.distance,
                    moving_time: activity.moving_time,
                    elapsed_time: activity.elapsed_time,
                    total_elevation_gain: activity.total_elevation_gain,
                    type: activity.type,
                    sport_type: activity.sport_type,
                    start_date: new Date(activity.start_date),
                    start_date_local: new Date(activity.start_date_local),
                    average_speed: activity.average_speed,
                    max_speed: activity.max_speed,
                    athlete_id: activity.athlete?.id,
                    insertedAt: new Date()
                };
            });

            console.log(`Prepared ${activitiesToInsert.length} documents for insertion`);

            // Insert new activities (ignore duplicates)
            try {
                const result = await Workout.insertMany(activitiesToInsert, { ordered: false });
                console.log(`Successfully inserted ${result.length} activities.`);
            } catch (err) {
                // Ignore duplicate key errors (code 11000)
                if (err.code === 11000) {
                    console.log(`Sync complete. Some activities already existed.`);
                    if (err.insertedDocs && err.insertedDocs.length > 0) {
                        console.log(`Inserted ${err.insertedDocs.length} new activities (others were duplicates).`);
                    } else {
                        console.log('No new activities inserted (all were duplicates).');
                    }
                } else {
                    console.error('Error inserting activities:', err);
                    // Log validation errors if any
                    if (err.name === 'ValidationError') {
                        console.error('Validation Errors:', err.errors);
                    }
                }
            }

            // Verify final count
            const finalCount = await Workout.countDocuments();
            console.log(`Final DB count: ${finalCount}`);

        } catch (dbErr) {
            console.error('Database sync error:', dbErr);
        }

        res.json(activities);
    } catch (err) {
        console.error('Strava API handler error:', err);
        res.status(500).json({ error: 'Failed to fetch Strava activities', details: err.message });
    }
});

// Function to refresh Strava Access Token
async function refreshStravaToken() {
    try {
        console.log('Refreshing Strava Access Token...');
        const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: process.env.STRAVA_CLIENT_ID,
                client_secret: process.env.STRAVA_CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: process.env.STRAVA_REFRESH_TOKEN
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to refresh token response:', response.status, errorText);
            throw new Error(`Failed to refresh token: ${response.status}`);
        }

        const data = await response.json();
        console.log('Successfully refreshed Strava token');
        return data.access_token;
    } catch (error) {
        console.error('Error refreshing Strava token:', error);
        return null;
    }
}

// Get Strava Activities
app.get('/api/strava/activities', async (req, res) => {
    try {
        let accessToken = process.env.STRAVA_ACCESS_TOKEN;

        if (!accessToken) {
            // Try refreshing if no access token is set initially
            accessToken = await refreshStravaToken();
            if (!accessToken) {
                return res.status(500).json({ error: 'Strava configuration missing' });
            }
            process.env.STRAVA_ACCESS_TOKEN = accessToken;
        }

        // Helper to fetch activities
        const fetchActivities = async (token) => {
            return await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        };

        let response = await fetchActivities(accessToken);

        // If 401 Unauthorized, try refreshing token
        if (response.status === 401) {
            console.log('Strava token expired (401), attempting refresh...');
            const newToken = await refreshStravaToken();

            if (newToken) {
                process.env.STRAVA_ACCESS_TOKEN = newToken; // Update in memory
                response = await fetchActivities(newToken);
            } else {
                return res.status(401).json({ error: 'Failed to refresh Strava token' });
            }
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Strava API Error:', response.status, errorText);
            return res.status(response.status).json({ error: `Strava API error: ${response.status}`, details: errorText });
        }

        const activities = await response.json();
        console.log(`Fetched ${activities.length} activities from Strava`);
        res.json(activities);
    } catch (err) {
        console.error('Strava API handler error:', err);
        res.status(500).json({ error: 'Failed to fetch Strava activities', details: err.message });
    }
});

// Get stored workouts from Database
app.get('/api/workouts', async (req, res) => {
    try {
        const workouts = await Workout.find().sort({ start_date: -1 });
        console.log(`Fetched ${workouts.length} workouts from DB`);
        res.json(workouts);
    } catch (err) {
        console.error('Database fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch workouts from database', details: err.message });
    }
});

// Clean up duplicate workouts (development only)
app.delete('/api/workouts/cleanup-duplicates', async (req, res) => {
    try {
        // Find all duplicates by activity_id
        const duplicates = await Workout.aggregate([
            { $match: { activity_id: { $ne: null } } },
            { $group: { _id: '$activity_id', count: { $sum: 1 }, ids: { $push: '$_id' } } },
            { $match: { count: { $gt: 1 } } }
        ]);

        let deletedCount = 0;
        for (const dup of duplicates) {
            // Keep the first one, delete the rest
            const idsToDelete = dup.ids.slice(1);
            const result = await Workout.deleteMany({ _id: { $in: idsToDelete } });
            deletedCount += result.deletedCount;
        }

        // Delete all workouts with null activity_id
        const nullResult = await Workout.deleteMany({ activity_id: null });
        deletedCount += nullResult.deletedCount;

        const remainingCount = await Workout.countDocuments();

        res.json({
            success: true,
            deletedCount,
            remainingCount,
            message: `Cleaned up ${deletedCount} duplicate/invalid workouts`
        });
    } catch (err) {
        console.error('Cleanup error:', err);
        res.status(500).json({ error: 'Failed to cleanup duplicates', details: err.message });
    }
});

// Sync Strava Activities - Fetch from Strava and insert only new activities
app.post('/api/workouts/sync', async (req, res) => {
    try {
        const { accessToken } = req.body;

        if (!accessToken) {
            return res.status(400).json({ error: 'Access token is required' });
        }

        // Fetch activities from Strava
        const stravaResponse = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=200', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!stravaResponse.ok) {
            const errorText = await stravaResponse.text();
            console.error('Strava API Error:', stravaResponse.status, errorText);
            return res.status(stravaResponse.status).json({ error: `Strava API error: ${stravaResponse.status}`, details: errorText });
        }

        const stravaActivities = await stravaResponse.json();
        console.log(`Fetched ${stravaActivities.length} activities from Strava`);

        // Get current count in DB
        const dbCount = await Workout.countDocuments();
        console.log(`Current DB count: ${dbCount}`);

        // Get existing activity IDs from DB
        const existingActivities = await Workout.find({}, { activity_id: 1 });
        const existingIds = new Set(existingActivities.map(a => a.activity_id));

        // Filter out activities that already exist
        const newActivities = stravaActivities.filter(activity => !existingIds.has(activity.id));
        console.log(`Found ${newActivities.length} new activities to insert`);

        // Insert new activities
        let insertedCount = 0;
        if (newActivities.length > 0) {
            const workoutsToInsert = newActivities.map(activity => ({
                activity_id: activity.id,
                name: activity.name,
                distance: activity.distance,
                moving_time: activity.moving_time,
                elapsed_time: activity.elapsed_time,
                total_elevation_gain: activity.total_elevation_gain,
                type: activity.type,
                sport_type: activity.sport_type,
                start_date: activity.start_date,
                start_date_local: activity.start_date_local,
                average_speed: activity.average_speed,
                max_speed: activity.max_speed,
                athlete_id: activity.athlete?.id
            }));

            const insertResult = await Workout.insertMany(workoutsToInsert, { ordered: false });
            insertedCount = insertResult.length;
            console.log(`Successfully inserted ${insertedCount} new activities`);
        }

        const newDbCount = await Workout.countDocuments();

        res.json({
            success: true,
            stravaCount: stravaActivities.length,
            previousDbCount: dbCount,
            newDbCount: newDbCount,
            inserted: insertedCount,
            message: `Synced ${insertedCount} new activities`
        });
    } catch (err) {
        console.error('Sync error:', err);
        res.status(500).json({ error: 'Failed to sync activities', details: err.message });
    }
});





// Member Schema
const memberSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    role: { type: String, required: true }, // ADMIN, EDITOR, etc.
    name: String,
    createdAt: { type: Date, default: Date.now }
}, { collection: 'MEMBER' });

const Member = mongoose.model('Member', memberSchema);

const securityAuditResultSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    command: { type: String, required: true },
    status: { type: String, enum: ['idle', 'running', 'success', 'failed'], default: 'idle' },
    startedAt: Date,
    finishedAt: Date,
    nextRunAt: Date,
    durationMs: Number,
    exitCode: Number,
    critical: { type: Number, default: 0 },
    warn: { type: Number, default: 0 },
    info: { type: Number, default: 0 },
    output: String,
    sourceMachine: String,
    sourceTimezone: String,
    reportedAt: Date,
    updatedAt: { type: Date, default: Date.now }
}, { collection: 'SECURITY_AUDIT_RESULT' });

const SecurityAuditResult = mongoose.model('SecurityAuditResult', securityAuditResultSchema);
const SECURITY_AUDIT_HISTORY_TTL_SECONDS = 30 * 24 * 60 * 60;

const securityAuditHistorySchema = new mongoose.Schema({
    key: { type: String, required: true, index: true },
    command: { type: String, required: true },
    status: { type: String, enum: ['idle', 'running', 'success', 'failed'], default: 'idle' },
    startedAt: Date,
    finishedAt: Date,
    nextRunAt: Date,
    durationMs: Number,
    exitCode: Number,
    critical: { type: Number, default: 0 },
    warn: { type: Number, default: 0 },
    info: { type: Number, default: 0 },
    output: String,
    sourceMachine: String,
    sourceTimezone: String,
    reportedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
}, { collection: 'SECURITY_AUDIT_HISTORY' });

securityAuditHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: SECURITY_AUDIT_HISTORY_TTL_SECONDS });

const SecurityAuditHistory = mongoose.model('SecurityAuditHistory', securityAuditHistorySchema);

const OPENCLAW_AUDIT_KEY = 'openclaw_security_audit_deep';
const OPENCLAW_AUDIT_COMMAND = 'openclaw security audit --deep';
const OPENCLAW_AUDIT_INTERVAL_MS = 60 * 60 * 1000;
let openclawAuditInProgress = false;
const validAuditStatuses = ['idle', 'running', 'success', 'failed'];
const ANSI_ESCAPE_REGEX = /(?:\u001B|\u009B|\uFFFD)\[[0-?]*[ -/]*[@-~]/g;

const sanitizeAuditOutput = (value) => {
    if (value === null || value === undefined) return '';
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    return raw
        .replace(ANSI_ESCAPE_REGEX, '')
        .replace(/\u0000/g, '')
        .trim();
};

const parseAuditCount = (rawValue, fieldName) => {
    if (rawValue === undefined || rawValue === null || rawValue === '') return null;
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`${fieldName} must be a non-negative integer`);
    }
    return parsed;
};

const extractAuditSeverityCounts = (value) => {
    const output = sanitizeAuditOutput(value);
    if (!output) {
        return { critical: 0, warn: 0, info: 0 };
    }

    const summaryMatch = output.match(/summary:\s*(\d+)\s*critical[^\d]+(\d+)\s*warn[^\d]+(\d+)\s*info/i);
    if (summaryMatch) {
        return {
            critical: Number(summaryMatch[1]) || 0,
            warn: Number(summaryMatch[2]) || 0,
            info: Number(summaryMatch[3]) || 0
        };
    }

    return {
        critical: (output.match(/\bcritical\b/gi) || []).length,
        warn: (output.match(/\bwarn(?:ing)?\b/gi) || []).length,
        info: (output.match(/\binfo\b/gi) || []).length
    };
};

const appendSecurityAuditHistory = async (doc) => {
    try {
        await SecurityAuditHistory.create({
            key: doc.key || OPENCLAW_AUDIT_KEY,
            command: doc.command || OPENCLAW_AUDIT_COMMAND,
            status: doc.status || 'idle',
            startedAt: doc.startedAt || null,
            finishedAt: doc.finishedAt || null,
            nextRunAt: doc.nextRunAt || null,
            durationMs: doc.durationMs ?? null,
            exitCode: doc.exitCode ?? null,
            critical: Number.isInteger(doc.critical) ? doc.critical : 0,
            warn: Number.isInteger(doc.warn) ? doc.warn : 0,
            info: Number.isInteger(doc.info) ? doc.info : 0,
            output: sanitizeAuditOutput(doc.output || '').slice(-15000),
            sourceMachine: doc.sourceMachine || 'unknown',
            sourceTimezone: doc.sourceTimezone || null,
            reportedAt: doc.reportedAt || new Date(),
            createdAt: new Date()
        });
    } catch (error) {
        console.error('[SECURITY-AUDIT] Failed to append history:', error);
    }
};

const parseAuditDate = (rawValue, fieldName) => {
    if (rawValue === undefined || rawValue === null || rawValue === '') return null;
    const parsed = new Date(rawValue);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Invalid ${fieldName}`);
    }
    return parsed;
};

const normalizeAuditStatus = (rawStatus, exitCode) => {
    if (typeof rawStatus === 'string' && rawStatus.trim()) {
        const normalized = rawStatus.trim().toLowerCase();
        if (validAuditStatuses.includes(normalized)) {
            return normalized;
        }
        return null;
    }
    if (exitCode === null || exitCode === undefined) return 'success';
    return exitCode === 0 ? 'success' : 'failed';
};

const isAdminMember = async (email) => {
    if (!email) return false;
    const member = await Member.findOne({ email });
    if (!member) return false;
    return String(member.role || '').toUpperCase() === 'ADMIN';
};

const runOpenclawSecurityAudit = async () => {
    if (openclawAuditInProgress) {
        console.log('[SECURITY-AUDIT] Previous run still in progress, skipping this cycle');
        return;
    }
    openclawAuditInProgress = true;

    const startedAt = new Date();
    const nextRunAt = new Date(startedAt.getTime() + OPENCLAW_AUDIT_INTERVAL_MS);

    try {
        await SecurityAuditResult.findOneAndUpdate(
            { key: OPENCLAW_AUDIT_KEY },
            {
                $set: {
                    key: OPENCLAW_AUDIT_KEY,
                    command: OPENCLAW_AUDIT_COMMAND,
                    status: 'running',
                    critical: 0,
                    warn: 0,
                    info: 0,
                    startedAt,
                    nextRunAt,
                    sourceMachine: 'server',
                    sourceTimezone: 'UTC',
                    reportedAt: new Date(),
                    updatedAt: new Date()
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    } catch (error) {
        openclawAuditInProgress = false;
        throw error;
    }

    return new Promise((resolve) => {
        let child;
        try {
            child = spawn('openclaw', ['security', 'audit', '--deep']);
        } catch (error) {
            openclawAuditInProgress = false;
            console.error('[SECURITY-AUDIT] Failed to spawn openclaw:', error);
            resolve();
            return;
        }
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        child.on('error', async (error) => {
            const finishedAt = new Date();
            const reportedAt = new Date();
            const output = sanitizeAuditOutput([stdout, stderr, error.message].filter(Boolean).join('\n')).slice(-15000);
            const counts = extractAuditSeverityCounts(output);
            await SecurityAuditResult.findOneAndUpdate(
                { key: OPENCLAW_AUDIT_KEY },
                {
                    $set: {
                        status: 'failed',
                        critical: counts.critical,
                        warn: counts.warn,
                        info: counts.info,
                        finishedAt,
                        durationMs: finishedAt.getTime() - startedAt.getTime(),
                        exitCode: null,
                        output,
                        nextRunAt,
                        sourceMachine: 'server',
                        sourceTimezone: 'UTC',
                        reportedAt,
                        updatedAt: new Date()
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            await appendSecurityAuditHistory({
                key: OPENCLAW_AUDIT_KEY,
                command: OPENCLAW_AUDIT_COMMAND,
                status: 'failed',
                startedAt,
                finishedAt,
                nextRunAt,
                durationMs: finishedAt.getTime() - startedAt.getTime(),
                exitCode: null,
                critical: counts.critical,
                warn: counts.warn,
                info: counts.info,
                output,
                sourceMachine: 'server',
                sourceTimezone: 'UTC',
                reportedAt
            });
            console.error('[SECURITY-AUDIT] openclaw execution error:', error.message);
            openclawAuditInProgress = false;
            resolve();
        });

        child.on('close', async (code) => {
            const finishedAt = new Date();
            const status = code === 0 ? 'success' : 'failed';
            const reportedAt = new Date();
            const output = sanitizeAuditOutput([stdout, stderr].filter(Boolean).join('\n')).slice(-15000);
            const counts = extractAuditSeverityCounts(output);
            await SecurityAuditResult.findOneAndUpdate(
                { key: OPENCLAW_AUDIT_KEY },
                {
                    $set: {
                        status,
                        critical: counts.critical,
                        warn: counts.warn,
                        info: counts.info,
                        finishedAt,
                        durationMs: finishedAt.getTime() - startedAt.getTime(),
                        exitCode: code,
                        output,
                        nextRunAt,
                        sourceMachine: 'server',
                        sourceTimezone: 'UTC',
                        reportedAt,
                        updatedAt: new Date()
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            await appendSecurityAuditHistory({
                key: OPENCLAW_AUDIT_KEY,
                command: OPENCLAW_AUDIT_COMMAND,
                status,
                startedAt,
                finishedAt,
                nextRunAt,
                durationMs: finishedAt.getTime() - startedAt.getTime(),
                exitCode: code,
                critical: counts.critical,
                warn: counts.warn,
                info: counts.info,
                output,
                sourceMachine: 'server',
                sourceTimezone: 'UTC',
                reportedAt
            });
            console.log(`[SECURITY-AUDIT] openclaw finished with status=${status}, code=${code}`);
            openclawAuditInProgress = false;
            resolve();
        });
    });
};

const setupOpenclawSecurityAuditScheduler = () => {
    if (process.env.ENABLE_OPENCLAW_AUDIT === 'false') {
        console.log('[SECURITY-AUDIT] Scheduler disabled by ENABLE_OPENCLAW_AUDIT=false');
        return;
    }

    runOpenclawSecurityAudit().catch((error) => {
        console.error('[SECURITY-AUDIT] Initial run failed:', error);
    });

    setInterval(() => {
        runOpenclawSecurityAudit().catch((error) => {
            console.error('[SECURITY-AUDIT] Scheduled run failed:', error);
        });
    }, OPENCLAW_AUDIT_INTERVAL_MS);

    console.log('[SECURITY-AUDIT] Scheduler started (every 1 hour)');
};

const resolveAuditReportTokens = () => {
    const primaryToken = (process.env.OPENCLAW_AUDIT_REPORT_TOKEN || process.env.SECURITY_AUDIT_REPORT_TOKEN || '').trim();
    const allowBlogApiKeyFallback = process.env.OPENCLAW_AUDIT_ALLOW_BLOG_API_KEY === 'true';
    const blogApiKeyToken = allowBlogApiKeyFallback ? (process.env.BLOG_API_KEY || '').trim() : '';
    return { primaryToken, allowBlogApiKeyFallback, blogApiKeyToken };
};

const extractAuditReportTokenFromRequest = (req) => {
    const authHeader = req.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7).trim();
    }
    const apiKeyHeader = req.get('x-api-key') || '';
    if (apiKeyHeader) return apiKeyHeader.trim();
    return '';
};

app.post('/api/security-audit/report', async (req, res) => {
    try {
        const { primaryToken, blogApiKeyToken } = resolveAuditReportTokens();
        const allowedTokens = [primaryToken, blogApiKeyToken].filter(Boolean);
        if (allowedTokens.length === 0) {
            return res.status(503).json({ error: 'Audit report endpoint is not configured' });
        }

        const providedToken = extractAuditReportTokenFromRequest(req);
        if (!providedToken) {
            return res.status(401).json({ error: 'Bearer token or x-api-key is required' });
        }

        if (!allowedTokens.includes(providedToken)) {
            return res.status(403).json({ error: 'Invalid token' });
        }

        const payload = req.body || {};
        const rawExitCode = payload.exitCode;
        let exitCode = null;
        if (rawExitCode !== undefined && rawExitCode !== null && rawExitCode !== '') {
            const parsedExitCode = Number(rawExitCode);
            if (!Number.isInteger(parsedExitCode)) {
                return res.status(400).json({ error: 'exitCode must be an integer' });
            }
            exitCode = parsedExitCode;
        }

        const status = normalizeAuditStatus(payload.status, exitCode);
        if (!status) {
            return res.status(400).json({ error: `status must be one of: ${validAuditStatuses.join(', ')}` });
        }

        const startedAt = parseAuditDate(payload.startedAt, 'startedAt');
        const finishedAtFromPayload = parseAuditDate(payload.finishedAt, 'finishedAt');
        const nextRunAtFromPayload = parseAuditDate(payload.nextRunAt, 'nextRunAt');
        const reportedAtFromPayload = parseAuditDate(payload.reportedAt, 'reportedAt');

        const finishedAt = finishedAtFromPayload || (status === 'running' ? null : new Date());
        const nextRunAt = nextRunAtFromPayload || (finishedAt ? new Date(finishedAt.getTime() + OPENCLAW_AUDIT_INTERVAL_MS) : null);
        const reportedAt = reportedAtFromPayload || new Date();

        const rawDurationMs = payload.durationMs;
        let durationMs = null;
        if (rawDurationMs !== undefined && rawDurationMs !== null && rawDurationMs !== '') {
            const parsedDurationMs = Number(rawDurationMs);
            if (!Number.isFinite(parsedDurationMs) || parsedDurationMs < 0) {
                return res.status(400).json({ error: 'durationMs must be a non-negative number' });
            }
            durationMs = Math.round(parsedDurationMs);
        } else if (startedAt && finishedAt) {
            durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
        }

        const command = typeof payload.command === 'string' && payload.command.trim()
            ? payload.command.trim().slice(0, 256)
            : OPENCLAW_AUDIT_COMMAND;
        const sourceMachine = typeof payload.sourceMachine === 'string' && payload.sourceMachine.trim()
            ? payload.sourceMachine.trim().slice(0, 128)
            : 'external-reporter';
        const sourceTimezone = typeof payload.sourceTimezone === 'string' && payload.sourceTimezone.trim()
            ? payload.sourceTimezone.trim().slice(0, 64)
            : null;
        const output = sanitizeAuditOutput(
            typeof payload.output === 'string'
                ? payload.output
                : payload.output === undefined || payload.output === null
                    ? ''
                    : JSON.stringify(payload.output)
        ).slice(-15000);
        const parsedCritical = parseAuditCount(payload.critical, 'critical');
        const parsedWarn = parseAuditCount(payload.warn, 'warn');
        const parsedInfo = parseAuditCount(payload.info, 'info');
        const derivedCounts = extractAuditSeverityCounts(output);
        const critical = parsedCritical ?? derivedCounts.critical;
        const warn = parsedWarn ?? derivedCounts.warn;
        const info = parsedInfo ?? derivedCounts.info;

        const latest = await SecurityAuditResult.findOneAndUpdate(
            { key: OPENCLAW_AUDIT_KEY },
            {
                $set: {
                    key: OPENCLAW_AUDIT_KEY,
                    command,
                    status,
                    startedAt,
                    finishedAt,
                    nextRunAt,
                    durationMs,
                    exitCode,
                    critical,
                    warn,
                    info,
                    output,
                    sourceMachine,
                    sourceTimezone,
                    reportedAt,
                    updatedAt: new Date()
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        await appendSecurityAuditHistory({
            key: OPENCLAW_AUDIT_KEY,
            command,
            status,
            startedAt,
            finishedAt,
            nextRunAt,
            durationMs,
            exitCode,
            critical,
            warn,
            info,
            output,
            sourceMachine,
            sourceTimezone,
            reportedAt
        });

        res.json({
            success: true,
            key: latest.key,
            status: latest.status,
            sourceMachine: latest.sourceMachine,
            updatedAt: latest.updatedAt
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        if (message.startsWith('Invalid ')) {
            return res.status(400).json({ error: message });
        }
        console.error('[SECURITY-AUDIT] Failed to receive report:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/security-audit/latest', async (req, res) => {
    try {
        const { email } = req.query;

        if (!email || typeof email !== 'string') {
            return res.status(400).json({ error: 'email query parameter is required' });
        }

        const isAdmin = await isAdminMember(email);
        if (!isAdmin) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const latest = await SecurityAuditResult.findOne({ key: OPENCLAW_AUDIT_KEY });
        if (!latest) {
            return res.json({
                key: OPENCLAW_AUDIT_KEY,
                command: OPENCLAW_AUDIT_COMMAND,
                status: 'idle',
                critical: 0,
                warn: 0,
                info: 0,
                sourceMachine: 'unknown',
                output: 'No audit result yet.'
            });
        }

        res.json({
            key: latest.key,
            command: latest.command,
            status: latest.status,
            startedAt: latest.startedAt,
            finishedAt: latest.finishedAt,
            nextRunAt: latest.nextRunAt,
            durationMs: latest.durationMs,
            exitCode: latest.exitCode,
            critical: Number.isInteger(latest.critical) ? latest.critical : 0,
            warn: Number.isInteger(latest.warn) ? latest.warn : 0,
            info: Number.isInteger(latest.info) ? latest.info : 0,
            output: sanitizeAuditOutput(latest.output || ''),
            sourceMachine: latest.sourceMachine || 'unknown',
            sourceTimezone: latest.sourceTimezone || null,
            reportedAt: latest.reportedAt || null,
            updatedAt: latest.updatedAt || null
        });
    } catch (err) {
        console.error('[SECURITY-AUDIT] Failed to fetch latest result:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get Contact Info
// Get Contact Info
app.get('/api/contact', async (req, res) => {
    try {
        // Use lean() to get raw JSON, ensuring we see fields even if they don't match Schema case exactly
        // Also look for ANY document that has an Email field (avoid empty ghost docs)
        let contact = await Contact.findOne({
            $or: [
                { Email: { $exists: true, $ne: "" } },
                { email: { $exists: true, $ne: "" } }
            ]
        }).lean();

        // Fallback: If strict query failed, try generic findOne
        if (!contact) {
            contact = await Contact.findOne().lean();
        }

        console.log('[API] GET /api/contact raw result:', JSON.stringify(contact, null, 2));

        if (contact) {
            // Normalize keys: If strict TitleCase keys are missing, try to fill them from lowercase equivalents
            // This handles cases where data was inserted manually or via scripts using lowercase conventions
            if (!contact.Email && contact.email) contact.Email = contact.email;
            if (!contact.GitHub && contact.github) contact.GitHub = contact.github;
            if (!contact.LinkedIn && contact.linkedin) contact.LinkedIn = contact.linkedin;
            if (!contact.Location && contact.location) contact.Location = contact.location;

            // Ensure Location fields are also accessible if lowercase in DB
            if (contact.Location) {
                const loc = contact.Location;
                if (!loc.city && loc.City) loc.city = loc.City; // Handle reverse case too just in case
            }
        } else {
            console.log('[API] No contact info found in DB collection: CONTACT_INFO');
        }

        res.json(contact);
    } catch (err) {
        console.error('Failed to fetch contact:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create Contact Info
app.post('/api/contact', async (req, res) => {
    try {
        const { Email, GitHub, LinkedIn, Location, userEmail } = req.body;

        // Check authorization
        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];
        if (!authorizedEmails.includes(userEmail)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const newContact = new Contact({
            Email,
            GitHub,
            LinkedIn,
            Location: Location || {}
        });

        // Duplicate Location Logic from PUT for consistency
        // Ideally this should be a shared function
        if (Location) {
            // Check if location fields are empty (use IP geolocation)
            const hasLocationData = Location.city && Location.state && Location.country;

            if (!hasLocationData) {
                // Get user's IP address
                let userIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                    req.headers['x-real-ip'] ||
                    req.connection.remoteAddress ||
                    req.socket.remoteAddress;

                // Clean up IPv6 localhost format
                if (userIp && (userIp === '::1' || userIp.includes('127.0.0.1') || userIp.startsWith('::ffff:'))) {
                    // For localhost/development, use a default IP for testing
                    console.log('Localhost detected, using public IP for geolocation test');
                    userIp = ''; // Leave empty to let ip-api.com use the server's IP
                }

                // Try to get coordinates from IP geolocation API
                try {
                    const ipUrl = userIp ? `http://ip-api.com/json/${userIp}?fields=status,message,city,regionName,country,lat,lon,query,timezone` : 'http://ip-api.com/json/?fields=status,message,city,regionName,country,lat,lon,query,timezone';
                    console.log('Fetching IP geolocation from:', ipUrl);

                    const ipResponse = await fetch(ipUrl);
                    if (ipResponse.ok) {
                        const ipData = await ipResponse.json();
                        console.log('IP Geolocation response:', ipData);

                        if (ipData.status === 'success') {
                            newContact.Location.latitude = ipData.lat;
                            newContact.Location.longitude = ipData.lon;
                            newContact.Location.ip = ipData.query;
                            newContact.Location.city = ipData.city;
                            newContact.Location.state = ipData.regionName;
                            newContact.Location.country = ipData.country;
                            newContact.Location.timezone = ipData.timezone;
                            console.log('IP geolocation successful:', newContact.Location);
                        } else {
                            console.log('IP geolocation failed:', ipData.message);
                        }
                    }
                } catch (ipErr) {
                    console.error('Failed to get IP geolocation:', ipErr);
                }
            } else if (!Location.latitude || !Location.longitude) {
                // Has city/state/country but no coordinates - use geocoding
                try {
                    const address = `${Location.city}, ${Location.state}, ${Location.country}`;
                    const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
                    console.log('Geocoding address:', address);

                    const geocodeResponse = await fetch(geocodeUrl, {
                        headers: { 'User-Agent': 'PersonalWebsite/1.0' }
                    });

                    if (geocodeResponse.ok) {
                        const geocodeData = await geocodeResponse.json();
                        console.log('Geocoding response:', geocodeData);

                        if (geocodeData && geocodeData.length > 0) {
                            newContact.Location.latitude = parseFloat(geocodeData[0].lat);
                            newContact.Location.longitude = parseFloat(geocodeData[0].lon);
                            console.log('Geocoding successful:', { latitude: newContact.Location.latitude, longitude: newContact.Location.longitude });

                            // Fetch timezone
                            try {
                                const tzResponse = await fetch(`https://timeapi.io/api/TimeZone/coordinate?latitude=${newContact.Location.latitude}&longitude=${newContact.Location.longitude}`);
                                if (tzResponse.ok) {
                                    const tzData = await tzResponse.json();
                                    newContact.Location.timezone = tzData.timeZone;
                                }
                            } catch (tzErr) {
                                console.error('Failed to fetch timezone:', tzErr);
                            }
                        }
                    }
                } catch (geocodeErr) {
                    console.error('Failed to geocode address:', geocodeErr);
                }
            }
        }

        await newContact.save();
        res.status(201).json(newContact);
    } catch (err) {
        console.error('Failed to create contact:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Proxy Endpoint for Client Geolocation (Avoids Mixed Content Error)
app.get('/api/utils/geo', async (req, res) => {
    try {
        // Get user's IP address
        let userIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            req.headers['x-real-ip'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress;

        // Clean up IPv6/Localhost
        if (userIp && (userIp === '::1' || userIp.includes('127.0.0.1') || userIp.startsWith('::ffff:'))) {
            userIp = ''; // Will default to server's IP if empty
        }

        // Call IP-API (HTTP is allowed server-side)
        const ipUrl = userIp
            ? `http://ip-api.com/json/${userIp}?fields=status,city,regionName,country,lat,lon`
            : 'http://ip-api.com/json/?fields=status,city,regionName,country,lat,lon';

        const response = await fetch(ipUrl);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('[API] Geo proxy error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update Contact Info
app.put('/api/contact/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { Email, GitHub, LinkedIn, Location, userEmail } = req.body;

        // Check authorization
        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];
        if (!authorizedEmails.includes(userEmail)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const contact = await Contact.findById(id);
        if (!contact) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        if (Email !== undefined) contact.Email = Email;
        if (GitHub !== undefined) contact.GitHub = GitHub;
        if (LinkedIn !== undefined) contact.LinkedIn = LinkedIn;

        if (Location !== undefined) {
            // Check if location fields are empty (use IP geolocation)
            const hasLocationData = Location.city && Location.state && Location.country;

            if (!hasLocationData) {
                // Get user's IP address
                let userIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                    req.headers['x-real-ip'] ||
                    req.connection.remoteAddress ||
                    req.socket.remoteAddress;

                // Clean up IPv6 localhost format
                if (userIp && (userIp === '::1' || userIp.includes('127.0.0.1') || userIp.startsWith('::ffff:'))) {
                    // For localhost/development, use a default IP for testing
                    console.log('Localhost detected, using public IP for geolocation test');
                    userIp = ''; // Leave empty to let ip-api.com use the server's IP
                }

                // Try to get coordinates from IP geolocation API
                try {
                    const ipUrl = userIp ? `http://ip-api.com/json/${userIp}?fields=status,message,city,regionName,country,lat,lon,query,timezone` : 'http://ip-api.com/json/?fields=status,message,city,regionName,country,lat,lon,query,timezone';
                    console.log('Fetching IP geolocation from:', ipUrl);

                    const ipResponse = await fetch(ipUrl);
                    if (ipResponse.ok) {
                        const ipData = await ipResponse.json();
                        console.log('IP Geolocation response:', ipData);

                        if (ipData.status === 'success') {
                            Location.latitude = ipData.lat;
                            Location.longitude = ipData.lon;
                            Location.ip = ipData.query; // Actual IP from response
                            // Use IP data for location
                            Location.city = ipData.city;
                            Location.state = ipData.regionName;
                            Location.country = ipData.country;
                            Location.timezone = ipData.timezone;
                            console.log('IP geolocation successful:', Location);
                        } else {
                            console.log('IP geolocation failed:', ipData.message);
                        }
                    }
                } catch (ipErr) {
                    console.error('Failed to get IP geolocation:', ipErr);
                    // Continue without coordinates if IP lookup fails
                }
            } else if (!Location.latitude || !Location.longitude) {
                // Has city/state/country but no coordinates - use geocoding
                try {
                    const address = `${Location.city}, ${Location.state}, ${Location.country}`;
                    const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
                    console.log('Geocoding address:', address);

                    const geocodeResponse = await fetch(geocodeUrl, {
                        headers: {
                            'User-Agent': 'PersonalWebsite/1.0'
                        }
                    });

                    if (geocodeResponse.ok) {
                        const geocodeData = await geocodeResponse.json();
                        console.log('Geocoding response:', geocodeData);

                        if (geocodeData && geocodeData.length > 0) {
                            Location.latitude = parseFloat(geocodeData[0].lat);
                            Location.longitude = parseFloat(geocodeData[0].lon);
                            console.log('Geocoding successful:', { latitude: Location.latitude, longitude: Location.longitude });

                            // Fetch timezone for coordinates
                            try {
                                const tzResponse = await fetch(`https://timeapi.io/api/TimeZone/coordinate?latitude=${Location.latitude}&longitude=${Location.longitude}`);
                                if (tzResponse.ok) {
                                    const tzData = await tzResponse.json();
                                    Location.timezone = tzData.timeZone;
                                    console.log('Timezone fetch successful:', Location.timezone);
                                }
                            } catch (tzErr) {
                                console.error('Failed to fetch timezone:', tzErr);
                            }
                        } else {
                            console.log('No geocoding results found for address:', address);
                        }
                    }
                } catch (geocodeErr) {
                    console.error('Failed to geocode address:', geocodeErr);
                    // Continue without coordinates if geocoding fails
                }
            }

            contact.Location = Location;
        }

        await contact.save();
        res.json(contact);
    } catch (err) {
        console.error('Failed to update contact:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Check Member Role by Email
app.get('/api/member/role/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const member = await Member.findOne({ email: email });

        if (!member) {
            return res.json({ authorized: false, role: null });
        }

        // Check if role is ADMIN or EDITOR
        const isAuthorized = member.role === 'ADMIN' || member.role === 'EDITOR';
        res.json({
            authorized: isAuthorized,
            role: member.role,
            email: member.email
        });
    } catch (err) {
        console.error('Failed to check member role:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const timeZone = 'America/Chicago'; // US Central Time

// ... (rest of the file)

// --- TODO List Endpoints ---

// Get all TODO items
app.get('/api/todos', async (req, res) => {
    try {
        const { category } = req.query;
        const matchStage = { show: 'Y' };
        if (category) {
            matchStage.category = category;
        }

        const todos = await TodoList.aggregate([
            { $match: matchStage },
            {
                $addFields: {
                    priorityWeight: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$priority", "high"] }, then: 1 },
                                { case: { $eq: ["$priority", "medium"] }, then: 2 },
                                { case: { $eq: ["$priority", "low"] }, then: 3 }
                            ],
                            default: 4
                        }
                    },
                    hasDueDate: {
                        $cond: { if: { $ifNull: ["$due_date", false] }, then: 0, else: 1 }
                    }
                }
            },
            {
                $sort: {
                    pinned: -1, // Pinned items first
                    priorityWeight: 1,
                    hasDueDate: 1,
                    due_date: 1
                }
            }
        ]);
        res.json(todos);
    } catch (err) {
        console.error('Error fetching todos:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new TODO
app.post('/api/todos', async (req, res) => {
    try {
        const { email, category, title, description, priority, due_date, start_time, end_time, sort } = req.body;

        if (!email || !title || !description) {
            return res.status(400).json({ error: 'Email, title, and description are required' });
        }

        // Check authorization
        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];
        if (!authorizedEmails.includes(email)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const newTodo = new TodoList({
            email,
            category: category || 'personal',
            title,
            description,
            title,
            description,
            status: 'in_progress',
            priority: priority || 'medium',
            pinned: false,
            priority_no: 0,
            due_date: due_date ? fromZonedTime(due_date, timeZone) : null,
            start_time: start_time ? fromZonedTime(start_time, timeZone) : null,
            end_time: end_time ? fromZonedTime(end_time, timeZone) : null,
            completed: false,
            show: 'Y',
            sort: sort || null,
            created_at: new Date(),
            updated_at: new Date()
        });

        console.log('[TODO] Creating new todo with sort:', sort);
        await newTodo.save();
        res.status(201).json(newTodo);
    } catch (err) {
        console.error('Error creating todo:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update TODO
app.put('/api/todos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { email, category, title, description, status, priority, due_date, start_time, end_time, completed, sort } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check authorization
        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];
        if (!authorizedEmails.includes(email)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const todo = await TodoList.findById(id);
        if (!todo) {
            return res.status(404).json({ error: 'TODO not found' });
        }

        // Update fields
        if (category !== undefined) todo.category = category;
        if (title !== undefined) todo.title = title;
        if (description !== undefined) todo.description = description;
        if (status !== undefined) todo.status = status;
        if (priority !== undefined) todo.priority = priority;
        if (due_date !== undefined) todo.due_date = due_date ? fromZonedTime(due_date, timeZone) : null;
        if (start_time !== undefined) todo.start_time = start_time ? fromZonedTime(start_time, timeZone) : null;
        if (end_time !== undefined) todo.end_time = end_time ? fromZonedTime(end_time, timeZone) : null;
        if (completed !== undefined) todo.completed = completed;
        if (sort !== undefined) todo.sort = sort || null;
        todo.updated_at = new Date();

        console.log('[TODO] Updating todo with sort:', sort);
        await todo.save();
        res.json(todo);
    } catch (err) {
        console.error('Error updating todo:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reorder TODOs
app.put('/api/todos/reorder', async (req, res) => {
    try {
        const { email, todos } = req.body; // todos: [{ _id, priority_no }]

        if (!email || !todos || !Array.isArray(todos)) {
            return res.status(400).json({ error: 'Email and todos array are required' });
        }

        // Check authorization
        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];
        if (!authorizedEmails.includes(email)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Bulk write for performance
        const bulkOps = todos.map(todo => ({
            updateOne: {
                filter: { _id: todo._id },
                update: { $set: { priority_no: todo.priority_no } }
            }
        }));

        await TodoList.bulkWrite(bulkOps);
        res.json({ message: 'Todos reordered successfully' });
    } catch (err) {
        console.error('Error reordering todos:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Toggle Pin Status
app.put('/api/todos/:id/pin', async (req, res) => {
    try {
        const { id } = req.params;
        const { email, pinned } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check authorization
        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];
        if (!authorizedEmails.includes(email)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const todo = await TodoList.findById(id);
        if (!todo) {
            return res.status(404).json({ error: 'TODO not found' });
        }

        todo.pinned = pinned;
        todo.updated_at = new Date();
        await todo.save();

        res.json(todo);
    } catch (err) {
        console.error('Error pinning todo:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete TODO (Soft Delete)
app.delete('/api/todos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check authorization
        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];
        if (!authorizedEmails.includes(email)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const todo = await TodoList.findById(id);
        if (!todo) {
            return res.status(404).json({ error: 'TODO not found' });
        }

        // Soft delete: set show to 'N'
        todo.show = 'N';
        todo.updated_at = new Date();
        await todo.save();

        res.json({ message: 'TODO deleted successfully' });
    } catch (err) {
        console.error('Error deleting todo:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- PROJECT Endpoints ---

// Project Schema
const projectSchema = new mongoose.Schema({
    project_name: { type: String, required: true },
    github_url: String,
    web_url: String,
    created_at: { type: Date, default: Date.now },
    expected_end_at: Date,
    actual_end_at: Date,
    description: String,
    status: { type: String, enum: ['ongoing', 'completed', 'paused'], default: 'ongoing' },
    team_members: [{
        name: String,
        role: String,
        email: String
    }],
    technologies: [String],
    tags: [String],
    budget: Number,
    progress_percent: { type: Number, default: 0 },
    last_updated: { type: Date, default: Date.now },
    show: { type: String, default: 'Y' }
}, { collection: 'PROJECT' });

const Project = mongoose.model('Project', projectSchema);

// Get all Projects
app.get('/api/projects', async (req, res) => {
    try {
        // Find projects where show is 'Y' or show field doesn't exist
        const projects = await Project.find({
            $or: [
                { show: 'Y' },
                { show: { $exists: false } }
            ]
        }).sort({ created_at: -1 });
        console.log('[API] Fetched projects:', projects.length);
        res.json(projects);
    } catch (err) {
        console.error('Error fetching projects:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single Project by ID
app.get('/api/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.findById(id);
        if (!project || project.show === 'N') {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json(project);
    } catch (err) {
        console.error('Error fetching project:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new Project
app.post('/api/projects', async (req, res) => {
    try {
        const { email, project_name, github_url, web_url, expected_end_at, description, status, team_members, technologies, tags, budget, progress_percent } = req.body;

        if (!email || !project_name) {
            return res.status(400).json({ error: 'Email and project_name are required' });
        }

        // Check authorization
        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];
        if (!authorizedEmails.includes(email)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const newProject = new Project({
            project_name,
            github_url,
            web_url,
            expected_end_at: expected_end_at ? new Date(expected_end_at) : null,
            description,
            status: status || 'ongoing',
            team_members: team_members || [],
            technologies: technologies || [],
            tags: tags || [],
            budget,
            progress_percent: progress_percent || 0,
            show: 'Y',
            created_at: new Date(),
            last_updated: new Date()
        });

        await newProject.save();
        res.status(201).json(newProject);
    } catch (err) {
        console.error('Error creating project:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update Project
app.put('/api/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { email, project_name, github_url, web_url, expected_end_at, actual_end_at, description, status, team_members, technologies, tags, budget, progress_percent } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check authorization
        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];
        if (!authorizedEmails.includes(email)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const project = await Project.findById(id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Update fields
        if (project_name !== undefined) project.project_name = project_name;
        if (github_url !== undefined) project.github_url = github_url;
        if (web_url !== undefined) project.web_url = web_url;
        if (expected_end_at !== undefined) project.expected_end_at = expected_end_at ? new Date(expected_end_at) : null;
        if (actual_end_at !== undefined) project.actual_end_at = actual_end_at ? new Date(actual_end_at) : null;
        if (description !== undefined) project.description = description;
        if (status !== undefined) project.status = status;
        if (team_members !== undefined) project.team_members = team_members;
        if (technologies !== undefined) project.technologies = technologies;
        if (tags !== undefined) project.tags = tags;
        if (budget !== undefined) project.budget = budget;
        if (progress_percent !== undefined) project.progress_percent = progress_percent;
        project.last_updated = new Date();

        await project.save();
        res.json(project);
    } catch (err) {
        console.error('Error updating project:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete Project (Soft Delete)
app.delete('/api/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check authorization
        const authorizedEmails = ['distilledchild@gmail.com', 'wellclouder@gmail.com'];
        if (!authorizedEmails.includes(email)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const project = await Project.findById(id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Soft delete: set show to 'N'
        console.log(`[PROJECT] Soft deleting project ${id} (setting show='N')`);
        project.show = 'N';
        project.last_updated = new Date();
        await project.save();

        res.json({ message: 'Project deleted successfully' });
    } catch (err) {
        console.error('Error deleting project:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

setupOpenclawSecurityAuditScheduler();

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
