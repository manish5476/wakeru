const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const Trip = mongoose.connection.collection('trips');
  
  const userId = 'aeb013f3-fff5-4e60-b1aa-9bc54bf4d256';
  
  const token = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  const fetch = require('node-fetch');
  
  const payload = {
    title: "Updated Trip",
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
    status: "planning",
    allowAnyPayer: false,
    allowOthersToArchiveTrip: true,
    coverImage: ""
  };
  
  const response = await fetch(`http://localhost:8000/api/v1/trips/6a4c8e6f8732876e5072711d`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Idempotency-Key': 'random-key-123'
    },
    body: JSON.stringify(payload)
  });
  
  const data = await response.text();
  console.log("Response:", data);
  
  process.exit(0);
}

run().catch(console.error);
