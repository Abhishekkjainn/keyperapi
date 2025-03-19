// const express = require('express');
// const app = express();
// const cors = require('cors');
// const { db } = require('./firebase');
// const crypto = require('crypto');

// app.use(cors());

// // Function to generate a unique 9-letter alphanumeric API key
// const generateApiKey = () => {
//   return crypto.randomBytes(5).toString('hex').slice(0, 9);
// };

// // Function to ensure a unique API key is assigned
// const getUniqueApiKey = async () => {
//   let apiKey;
//   let exists = true;
//   while (exists) {
//     apiKey = generateApiKey();
//     const doc = await db.collection('apikeys').doc(apiKey).get();
//     if (!doc.exists) {
//       exists = false;
//     }
//   }
//   return apiKey;
// };

// // Root endpoint
// app.get('/', async (req, res) => {
//   res.send(
//     'A Public free and Open source third party user Authenticator Platform.'
//   );
// });

// // Onboard endpoint
// app.post(
//   '/onboard/phone=:phone/hashpass=:hashpass/name=:name/platformname=:platformname/platformid=:platformid/email=:email',
//   async (req, res) => {
//     try {
//       const { phone, hashpass, name, platformname, platformid, email } =
//         req.params;

//       // Validate input parameters
//       if (
//         !phone ||
//         !hashpass ||
//         !name ||
//         !platformname ||
//         !platformid ||
//         !email
//       ) {
//         return res.status(400).json({ error: 'Missing required parameters' });
//       }

//       // Validate phone number format (basic check for 10 digits)
//       if (!/^\d{10}$/.test(phone)) {
//         return res.status(400).json({ error: 'Invalid phone number format' });
//       }

//       // Validate email format
//       if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
//         return res.status(400).json({ error: 'Invalid email format' });
//       }

//       // Check if the client already exists
//       const clientDoc = await db.collection('clients').doc(phone).get();
//       if (clientDoc.exists) {
//         return res.status(409).json({ error: 'Client already registered' });
//       }

//       // Generate a unique API key
//       const apiKey = await getUniqueApiKey();

//       // Store the new API key in the apikeys collection
//       await db.collection('apikeys').doc(apiKey).set({
//         assigned: true,
//         phone,
//         email,
//         name,
//         platformname,
//         platformid,
//       });

//       // Store client details in the clients collection
//       await db.collection('clients').doc(phone).set({
//         phone,
//         hashpass,
//         name,
//         platform: platformname,
//         platformid,
//         email,
//         apikey: apiKey,
//       });

//       // Return success response
//       res.status(201).json({
//         phone,
//         name,
//         platformname,
//         platformid,
//         email,
//         apikey: apiKey,
//       });
//     } catch (error) {
//       console.error('Error onboarding client:', error);

//       // Handle Firestore errors
//       if (error.code === 'firestore/unavailable') {
//         return res
//           .status(503)
//           .json({ error: 'Service Unavailable: Database connection failed' });
//       }

//       // Handle unexpected errors
//       res.status(500).json({ error: 'Internal Server Error' });
//     }
//   }
// );

// // Register endpoint with optional imageurl
// app.post(
//   '/register/phone=:phone/hashpass=:hashpass/name=:name/email=:email/imageurl=:imageurl?',
//   async (req, res) => {
//     try {
//       const { phone, hashpass, name, email, imageurl } = req.params;

//       // Validate required input parameters
//       if (!phone || !hashpass || !name || !email) {
//         return res.status(400).json({ error: 'Missing required parameters' });
//       }

//       // Validate phone number format (basic check for 10 digits)
//       if (!/^\d{10}$/.test(phone)) {
//         return res.status(400).json({ error: 'Invalid phone number format' });
//       }

//       // Validate email format
//       if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
//         return res.status(400).json({ error: 'Invalid email format' });
//       }

//       // Check if the user is already registered
//       const userDoc = await db.collection('users').doc(phone).get();
//       if (userDoc.exists) {
//         return res.status(409).json({ error: 'User already registered' });
//       }

//       // Prepare user data
//       const userData = {
//         phone,
//         hashpass,
//         name,
//         email,
//       };

//       // Add imageurl to user data if provided
//       if (imageurl) {
//         userData.imageurl = imageurl;
//       }

//       // Add the new user to the database
//       await db.collection('users').doc(phone).set(userData);

//       // Return success response
//       res.status(201).json({
//         phone,
//         name,
//         email,
//         imageurl: imageurl || null, // Include imageurl in response if provided
//         message: 'User registered successfully',
//       });
//     } catch (error) {
//       console.error('Error registering user:', error);

//       // Handle Firestore errors
//       if (error.code === 'firestore/unavailable') {
//         return res
//           .status(503)
//           .json({ error: 'Service Unavailable: Database connection failed' });
//       }

//       // Handle unexpected errors
//       res.status(500).json({ error: 'Internal Server Error' });
//     }
//   }
// );

// // Start the server
// app.listen(6969, () => {
//   console.log('Server is running on port 6969');
// });
