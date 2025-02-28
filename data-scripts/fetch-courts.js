const axios = require('axios');
const { initializeApp } = require('firebase/app');
const { getFirestore, setDoc, doc, serverTimestamp } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBQvN8Yg8GlBZ4iJCRjD3cC9C5vNPXO9rI",
  authDomain: "pickleballcourt-217a6.firebaseapp.com",
  projectId: "pickleballcourt-217a6",
  storageBucket: "pickleballcourt-217a6.firebasestorage.app",
  messagingSenderId: "378407940466",
  appId: "1:378407940466:web:f589bd8b9cca9828202deb",
  measurementId: "G-XXCJGBCZVF"
};

// Update Firebase initialization
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Google Places API Key
const GOOGLE_API_KEY = 'AIzaSyBCRc1wgvO7k2s6lF1-HwqYkEjB1rVYNCM';

// List of major cities in India to search for pickleball courts
const cities = [
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 
  'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Surat',
  'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane',
  'Bhopal', 'Visakhapatnam', 'Pimpri-Chinchwad', 'Patna', 'Vadodara'
];

// Add timestamp to logs
function logWithTimestamp(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function fetchPickleballCourts() {
  logWithTimestamp('Starting court data collection...');
  
  for (const city of cities) {
    logWithTimestamp(`----------------------------------------`);
    logWithTimestamp(`Starting search for ${city}`);
    
    try {
      logWithTimestamp(`Making API request for ${city}...`);
      const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
        params: {
          query: `pickleball courts in ${city}, India`,
          key: GOOGLE_API_KEY
        }
      });
      
      const { results } = response.data;
      logWithTimestamp(`Found ${results.length} potential courts in ${city}`);
      
      // Process and store each result
      for (const place of results) {
        try {
          logWithTimestamp(`Fetching details for: ${place.name}`);
          
          const detailsResponse = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
            params: {
              place_id: place.place_id,
              fields: 'name,formatted_address,geometry,place_id,vicinity,formatted_phone_number,website,opening_hours,photos',
              key: GOOGLE_API_KEY
            }
          });
          
          const details = detailsResponse.data.result;
          logWithTimestamp(`Successfully retrieved details for: ${place.name}`);
          
          // Create a court object with the data we want to store
          const court = {
            name: place.name,
            placeId: place.place_id,
            address: place.formatted_address,
            city: city,
            location: {
              lat: place.geometry.location.lat,
              lng: place.geometry.location.lng
            },
            phone: details.formatted_phone_number || null,
            website: details.website || null,
            vicinity: place.vicinity || null,
            openingHours: details.opening_hours ? {
              periods: details.opening_hours.periods || [],
              weekdayText: details.opening_hours.weekday_text || [],
              isOpenNow: details.opening_hours.open_now || false
            } : null,
            photos: details.photos ? details.photos.map(photo => ({
              reference: photo.photo_reference,
              width: photo.width,
              height: photo.height
            })).slice(0, 5) : [],
            createdAt: serverTimestamp()
          };
          
          // Store in Firebase
          await setDoc(doc(db, 'pickleballCourts', place.place_id), court);
          logWithTimestamp(`✅ Successfully stored: ${place.name}`);
          logWithTimestamp(`   Address: ${place.formatted_address}`);
          if (court.phone) logWithTimestamp(`   Phone: ${court.phone}`);
          if (court.website) logWithTimestamp(`   Website: ${court.website}`);
          
          // Sleep to avoid hitting API rate limits
          logWithTimestamp('Waiting 200ms before next request...');
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (detailError) {
          logWithTimestamp(`❌ Error processing details for ${place.name}: ${detailError.message}`);
          continue; // Skip to next place on error
        }
      }
    } catch (error) {
      logWithTimestamp(`❌ Error fetching data for ${city}: ${error.message}`);
      if (error.response) {
        logWithTimestamp(`API Response Error: ${JSON.stringify(error.response.data)}`);
      }
    }
  }
  
  logWithTimestamp('----------------------------------------');
  logWithTimestamp('Data collection complete!');
  logWithTimestamp('Summary will be added in future version');
}

// Add error handling for the main function
(async () => {
  try {
    logWithTimestamp('Script started');
    await fetchPickleballCourts();
    logWithTimestamp('Script completed successfully');
  } catch (error) {
    logWithTimestamp(`❌ Fatal error: ${error.message}`);
    process.exit(1);
  }
})();

// Add a function to fetch photo URLs
const getPhotoUrl = (photoReference) => {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${GOOGLE_API_KEY}`;
}; 