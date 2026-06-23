const mongoose = require('mongoose');
require('dotenv').config();
const { dashboardService } = require('./src/modules/dashboard/dashboard.service');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const userId = 'aeb013f3-fff5-4e60-b1aa-9bc54bf4d256';
  const dashboard = await dashboardService.getDashboard(userId);
  
  console.log('Dashboard youOwe length:', dashboard.youOwe.length);
  console.log('Dashboard youOwe:', JSON.stringify(dashboard.youOwe, null, 2));
  
  process.exit(0);
}
run().catch(console.error);
