const express = require('express');
const app = express();
const cors = require('cors');
const { db } = require('./firebase');
const crypto = require('crypto');

app.use(express.json());
app.use(cors({ origin: '*' }));

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
        hashedpassword: hashedpass,
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

app.get('/apikey/:apikey', async (req, res) => {
  try {
    let apikey = req.params.apikey;

    if (!apikey) {
      return res
        .status(400)
        .json({ success: false, message: 'API Key is required' });
    }

    // Fetch the document from Firestore
    const docRef = db.collection('clients').doc(apikey);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res
        .status(404)
        .json({ success: false, message: 'Invalid API Key' });
    }

    res.json({ success: true, data: doc.data() });
  } catch (error) {
    console.error('Error fetching API Key data:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Token verification endpoint
app.get('/checktoken/token=:token/apikey=:apikey', async (req, res) => {
  const { token, apikey } = req.params;

  // Validate input
  if (!apikey) {
    return res
      .status(400)
      .json({ success: false, message: 'API Key is required' });
  }

  if (!token) {
    return res
      .status(400)
      .json({ success: false, message: 'Token is required' });
  }

  try {
    // Verify API Key
    const clientDocRef = db.collection('clients').doc(apikey);
    const clientDoc = await clientDocRef.get();

    if (!clientDoc.exists) {
      return res
        .status(401)
        .json({ success: false, message: 'Invalid API Key' });
    }

    // Verify Token
    const tokenDocRef = db.collection('tokens').doc(token);
    const tokenDoc = await tokenDocRef.get();

    if (!tokenDoc.exists) {
      return res
        .status(404)
        .json({ success: false, message: 'Token not found' });
    }

    // Token found, return its data
    res.json({ success: true, data: tokenDoc.data() });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get(
  '/registeruser/name/:name/email/:email/phone/:phone/password/:password',
  async (req, res) => {
    const { name, email, phone, password } = req.params;

    try {
      // Check if email or phone already exists using a single Firestore query
      const usersRef = db.collection('users');
      const querySnapshot = await usersRef
        .where('email', '==', email)
        .limit(1)
        .get();

      const phoneDoc = await usersRef.doc(phone).get();

      if (!querySnapshot.empty) {
        return res.status(409).json({
          success: false,
          message:
            'The provided email is already registered. Please log in instead.',
        });
      }

      if (phoneDoc.exists) {
        return res.status(409).json({
          success: false,
          message:
            'The provided phone number is already registered. Please log in instead.',
        });
      }

      // User log activities
      const userLog = [
        {
          action: 'User registered',
          timestamp: new Date().toISOString(),
        },
      ];

      // User data to store in Firestore
      const userData = {
        name,
        email,
        phone,
        hashedpassword: password,
        createdAt: new Date().toISOString(),
        userLog,
      };

      // Store user data in Firestore (doc ID as phone number)
      await db.collection('users').doc(phone).set(userData);

      return res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: userData,
      });
    } catch (error) {
      console.error('Error registering user:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message, // Provide error details for debugging
      });
    }
  }
);

// app.get(
//   '/signin/username/:username/password/:password/apikey/:apikey',
//   async (req, res) => {
//     try {
//       const { username, password, apikey } = req.params;

//       // ✅ Step 1: Validate API Key
//       const clientDoc = await db.collection('clients').doc(apikey).get();
//       if (!clientDoc.exists) {
//         return res.status(403).json({
//           success: false,
//           errorCode: 'INVALID_API_KEY',
//           message:
//             'Access denied. The provided API key is invalid or does not exist.',
//         });
//       }
//       const clientData = clientDoc.data();
//       const { platformname, platformid } = clientData;

//       // ✅ Step 2: Determine if username is email or phone
//       let searchField, searchValue;
//       if (isValidEmail(username)) {
//         searchField = 'email';
//         searchValue = username;
//       } else if (isValidPhone(username)) {
//         searchField = 'phone';
//         searchValue = username;
//       } else {
//         return res.status(400).json({
//           success: false,
//           errorCode: 'INVALID_USERNAME_FORMAT',
//           message:
//             'The provided username must be a valid email or phone number.',
//         });
//       }

//       // ✅ Step 3: Fetch user from Firestore
//       const userSnapshot = await db
//         .collection('users')
//         .where(searchField, '==', searchValue)
//         .get();

//       if (userSnapshot.empty) {
//         return res.status(404).json({
//           success: false,
//           errorCode: 'USER_NOT_FOUND',
//           message:
//             'No user found with the provided username. Please check and try again.',
//         });
//       }

//       const userDoc = userSnapshot.docs[0];
//       const userData = userDoc.data();

//       // ✅ Step 4: Validate Password
//       if (password !== userData.hashedpassword) {
//         return res.status(401).json({
//           success: false,
//           errorCode: 'INVALID_CREDENTIALS',
//           message: 'Authentication failed. Incorrect password.',
//         });
//       }

//       // ✅ Step 5: Update `userLog` in `users` Collection
//       const signInLog = {
//         action: 'User signed in',
//         platformname,
//         platformid,
//         apikey,
//         timestamp: new Date().toISOString(),
//       };

//       const updatedUserLog = Array.isArray(userData.userLog)
//         ? [...userData.userLog, signInLog]
//         : [signInLog];

//       await db
//         .collection('users')
//         .doc(userDoc.id)
//         .update({ userLog: updatedUserLog });

//       // ✅ Step 6: Update `Userlog` in `clients` Collection
//       const newClientUserLog = {
//         email: userData.email,
//         name: userData.name,
//         phone: userData.phone,
//         imageurl: userData.imageurl,
//         timestamp: new Date().toISOString(),
//       };

//       const updatedClientUserLog = Array.isArray(clientData.Userlog)
//         ? [...clientData.Userlog, newClientUserLog]
//         : [newClientUserLog];

//       await db
//         .collection('clients')
//         .doc(apikey)
//         .update({ Userlog: updatedClientUserLog });

//       // ✅ Step 7: Generate a Unique Token
//       let token,
//         tokenExists = true;

//       while (tokenExists) {
//         token = generateRandomString(6); // Generate a 6-character alphanumeric token
//         const tokenDoc = await db.collection('tokens').doc(token).get();
//         tokenExists = tokenDoc.exists; // Ensure uniqueness
//       }

//       // ✅ Step 8: Store only necessary user details in Firestore
//       const tokenData = {
//         name: userData.name,
//         email: userData.email,
//         phone: userData.phone,
//         imageurl: userData.imageurl,
//         expiryTimestamp: Date.now() + 10 * 60 * 1000, // Token expires in 10 minutes
//       };

//       await db.collection('tokens').doc(token).set(tokenData);

//       // ✅ Step 9: Return the token as response
//       return res.status(200).json({
//         success: true,
//         message: 'Authentication successful. Token generated successfully.',
//         token: token, // Return only the token code
//       });
//     } catch (error) {
//       console.error('Error during sign-in:', error);
//       return res.status(500).json({
//         success: false,
//         errorCode: 'INTERNAL_SERVER_ERROR',
//         message:
//           'An unexpected error occurred while processing your request. Please try again later.',
//       });
//     }
//   }
// );

app.get(
  '/signin/username/:username/password/:password/apikey/:apikey',
  async (req, res) => {
    const { username, password, apikey } = req.params;
    console.log(`Received request: username=${username}, apikey=${apikey}`);

    try {
      // ✅ Step 1: Validate API Key
      console.log('Step 1: Validating API Key...');
      const clientDoc = await db.collection('clients').doc(apikey).get();
      if (!clientDoc.exists) {
        console.error('Invalid API Key:', apikey);
        return res.status(403).json({
          success: false,
          errorCode: 'INVALID_API_KEY',
          message:
            'Access denied. The provided API key is invalid or does not exist.',
        });
      }
      const clientData = clientDoc.data();
      const { platformname, platformid } = clientData;
      console.log('API Key validated successfully.');

      // ✅ Step 2: Determine if username is email or phone
      console.log('Step 2: Determining username type...');
      let searchField, searchValue;
      if (isValidEmail(username)) {
        searchField = 'email';
        searchValue = username;
        console.log('Username is an email:', searchValue);
      } else if (isValidPhone(username)) {
        searchField = 'phone';
        searchValue = username;
        console.log('Username is a phone number:', searchValue);
      } else {
        console.error('Invalid username format:', username);
        return res.status(400).json({
          success: false,
          errorCode: 'INVALID_USERNAME_FORMAT',
          message:
            'The provided username must be a valid email or phone number.',
        });
      }

      // ✅ Step 3: Fetch user from Firestore
      console.log('Step 3: Fetching user from Firestore...');
      const userSnapshot = await db
        .collection('users')
        .where(searchField, '==', searchValue)
        .get();

      if (userSnapshot.empty) {
        console.error('User not found:', searchValue);
        return res.status(404).json({
          success: false,
          errorCode: 'USER_NOT_FOUND',
          message:
            'No user found with the provided username. Please check and try again.',
        });
      }

      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      console.log('User found:', userData);

      // ✅ Step 4: Validate Password
      console.log('Step 4: Validating password...');
      if (password !== userData.hashedpassword) {
        console.error('Incorrect password for user:', searchValue);
        return res.status(401).json({
          success: false,
          errorCode: 'INVALID_CREDENTIALS',
          message: 'Authentication failed. Incorrect password.',
        });
      }
      console.log('Password validated successfully.');

      // ✅ Step 5: Update `userLog` in `users` Collection
      console.log('Step 5: Updating userLog in users collection...');
      const signInLog = {
        action: 'User signed in',
        platformname,
        platformid,
        apikey,
        timestamp: new Date().toISOString(),
      };

      const updatedUserLog = Array.isArray(userData.userLog)
        ? [...userData.userLog, signInLog]
        : [signInLog];

      await db
        .collection('users')
        .doc(userDoc.id)
        .update({ userLog: updatedUserLog });
      console.log('userLog updated successfully.');

      // ✅ Step 6: Update `Userlog` in `clients` Collection
      console.log('Step 6: Updating Userlog in clients collection...');
      const newClientUserLog = {
        email: userData.email,
        name: userData.name,
        phone: userData.phone,
        imageurl: userData.imageurl,
        timestamp: new Date().toISOString(),
      };

      const updatedClientUserLog = Array.isArray(clientData.Userlog)
        ? [...clientData.Userlog, newClientUserLog]
        : [newClientUserLog];

      await db
        .collection('clients')
        .doc(apikey)
        .update({ Userlog: updatedClientUserLog });
      console.log('Userlog updated successfully.');

      // ✅ Step 7: Generate a Unique Token
      console.log('Step 7: Generating a unique token...');
      let token,
        tokenExists = true,
        attempts = 0;

      while (tokenExists && attempts < 10) {
        token = generateRandomString(6); // Generate a 6-character alphanumeric token
        const tokenDoc = await db.collection('tokens').doc(token).get();
        tokenExists = tokenDoc.exists; // Ensure uniqueness
        attempts++;
        console.log(`Token generation attempt ${attempts}: ${token}`);
      }

      if (tokenExists) {
        console.error('Failed to generate a unique token after 10 attempts.');
        throw new Error(
          'Failed to generate a unique token after multiple attempts.'
        );
      }
      console.log('Token generated successfully:', token);

      // ✅ Step 8: Store only necessary user details in Firestore
      console.log('Step 8: Storing token in Firestore...');
      const tokenData = {
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        imageurl: userData.imageurl,
        expiryTimestamp: Date.now() + 10 * 60 * 1000, // Token expires in 10 minutes
      };

      await db.collection('tokens').doc(token).set(tokenData);
      console.log('Token stored successfully:', token);

      // ✅ Step 9: Return the token as response
      console.log('Step 9: Sending response...');
      return res.status(200).json({
        success: true,
        message: 'Authentication successful. Token generated successfully.',
        token: token, // Return only the token code
      });
    } catch (error) {
      console.error('Error during sign-in:', error);
      return res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_SERVER_ERROR',
        message:
          'An unexpected error occurred while processing your request. Please try again later.',
      });
    }
  }
);

app.listen(6969, () => {
  console.log('Server is running on port 6969');
});
