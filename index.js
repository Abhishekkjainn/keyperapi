const express = require('express');
const app = express();
const cors = require('cors');
const { db } = require('./firebase');
const crypto = require('crypto');

app.use(express.json());
app.use(
  cors({
    origin: '*', // Allow requests from any origin
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Specify allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Specify allowed headers
    credentials: true, // Allow cookies and credentials
  })
);

// Helper function to generate random strings
function generateRandomString(
  length,
  chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate API Key (9 characters)
function generateApiKey() {
  return generateRandomString(9);
}

// Generate Platform ID (6 characters)
function generatePlatformId() {
  return generateRandomString(6);
}

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

// Validate phone number (Indian format - 10 digits)
function isValidPhone(phone) {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone);
}

// Check if a document with a given ID already exists in the collection
async function isDocumentIdUnique(collection, docId) {
  const docRef = db.collection(collection).doc(docId);
  const doc = await docRef.get();
  return !doc.exists; // Returns true if the document does not exist
}

// Check if a document with a given field value already exists in the collection
async function isFieldValueUnique(collection, field, value) {
  const snapshot = await db
    .collection(collection)
    .where(field, '==', value)
    .get();
  return snapshot.empty; // Returns true if no documents match
}

// Generate a unique API Key (document ID)
async function generateUniqueApiKey() {
  let apiKey;
  let isUnique = false;

  while (!isUnique) {
    apiKey = generateApiKey();
    isUnique = await isDocumentIdUnique('clients', apiKey);
  }

  return apiKey;
}

// Generate a unique Platform ID (field in document)
async function generateUniquePlatformId() {
  let platformId;
  let isUnique = false;

  while (!isUnique) {
    platformId = generatePlatformId();
    isUnique = await isFieldValueUnique('clients', 'platformid', platformId);
  }

  return platformId;
}

const algorithm = 'aes-256-cbc';
const key = Buffer.from(
  '5f4dcc3b5aa765d61d8327deb882cf99b6c2b6f2b4f5e6d7a8c3b4f5e6d7a8c3',
  'hex'
); // 256-bit key
const iv = Buffer.from('1234567890abcdef1234567890abcdef', 'hex'); // 128-bit IV

// Function to encrypt a password
function encryptPassword(password) {
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// Function to decrypt a password
function decryptPassword(encryptedPassword) {
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedPassword, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Root endpoint
app.get('/', (req, res) => {
  res.send(
    'A Public free and Open source third party user Authenticator Platform.'
  );
});

// Registration endpoint
app.post(
  '/register/name=:name/email=:email/phone=:phone/platformname=:platformname/hashedpass=:hashedpass/imageurl=:imageurl',
  async (req, res) => {
    const { name, email, phone, platformname, hashedpass, imageurl } =
      req.params;

    // Validate input
    if (!isValidEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid email format' });
    }

    if (!isValidPhone(phone)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid phone number' });
    }

    try {
      // Check if email or phone is already registered
      const isEmailUnique = await isFieldValueUnique('clients', 'email', email);
      const isPhoneUnique = await isFieldValueUnique('clients', 'phone', phone);

      if (!isEmailUnique) {
        return res.status(400).json({
          status: 400,
          success: false,
          message:
            'The Provided Email is already registered with the Platform, please Login to your Current Account.',
        });
      }

      if (!isPhoneUnique) {
        return res.status(400).json({
          status: 400,
          success: false,
          message:
            'The Provided Phone Number is already registered with the Platform, please Login to your Current Account.',
        });
      }

      // Generate unique API Key (document ID) and Platform ID (field)
      const apikey = await generateUniqueApiKey();
      const platformid = await generateUniquePlatformId();

      // Prepare client data
      const clientData = {
        Userlog: {}, // Initialize an empty map for Userlog
        email,
        hashedpassword: encryptPassword(hashedpass),
        imageurl,
        name,
        phone,
        platformid,
        platformname,
      };

      // Save client data to Firebase (apikey is the document ID)
      await db.collection('clients').doc(apikey).set(clientData);

      // Send success response
      res.json({
        success: true,
        message: 'Client registered successfully',
        data: {
          apikey, // Include the API key in the response
          ...clientData,
        },
      });
    } catch (error) {
      console.error('Error registering client:', error);
      res
        .status(500)
        .json({ success: false, message: 'Internal server error' });
    }
  }
);

app.get('/redirect/:target/:apikey', async (req, res) => {
  let target = decodeURIComponent(req.params.target);
  let apikey = req.params.apikey;

  if (!target) {
    return res.status(400).send('Bad Request: Missing target URL.');
  }

  if (!apikey) {
    return res.status(400).send('Bad Request: Missing API Key.');
  }

  console.log(`Redirecting to ${target} with apikey = ${apikey}`);

  res.redirect(
    `https://authkeyper.vercel.app/target/${encodeURIComponent(
      target
    )}/apikey/${apikey}`
  );
});

app.get('/checktoken/token=:token/apikey=:apikey', async (req, res) => {
  const { token, apikey } = req.params;

  // Mock user data
  const mockUser = {
    id: 1,
    name: 'John Doe',
    email: 'johndoe@example.com',
    role: 'admin',
    token: token,
    apikey: apikey,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // Expires in 1 hour
  };

  res.json({ success: true, user: mockUser });
});

// Start the server
app.listen(6969, () => {
  console.log('Server is running on port 6969');
});
