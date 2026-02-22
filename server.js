const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors())
app.get('/', (req, res) => {
    res.json({ 
        status: '✅ Сервер работает!',
        message: 'Case Bot Server is online',
        endpoints: [
            'POST /api/user',
            'POST /api/user/save', 
            'POST /api/users',
            'POST /api/user/balance',
            'POST /api/stats'
        ]
    });
});
app.use(express.json());

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  ssl: true,
  tls: true,
  tlsAllowInvalidCertificates: true,
  retryWrites: true,
  retryReads: true,
  maxPoolSize: 10,
  minPoolSize: 5,
  maxIdleTimeMS: 30000,
  socketTimeoutMS: 45000,
  keepAlive: true,
  keepAliveInitialDelay: 300000,
  connectTimeoutMS: 30000,
  serverSelectionTimeoutMS: 30000,
  heartbeatFrequencyMS: 10000
}).then(() => {
  console.log('MongoDB подключен и держит связь');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Схема пользователя
const userSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  balance: { type: Number, default: 0 },
  openedCases: { type: Number, default: 0 },
  inventory: [{
    id: String,
    name: String,
    emoji: String,
    image: String,
    price: Number,
    timestamp: Date
  }],
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Схема кейсов
const caseSchema = new mongoose.Schema({
  caseId: { type: String, required: true, unique: true },
  name: String,
  price: Number,
  image: String,
  color: String,
  items: [{
    id: String,
    name: String,
    emoji: String,
    image: String,
    price: Number,
    chance: Number
  }],
  updatedAt: { type: Date, default: Date.now }
});

const Case = mongoose.model('Case', caseSchema);

// Схема предметов
const itemSchema = new mongoose.Schema({
  itemId: { type: String, required: true, unique: true },
  name: String,
  emoji: String,
  image: String,
  price: Number,
  chance: Number
});

const Item = mongoose.model('Item', itemSchema);

// API endpoints

// Получить или создать пользователя
app.post('/api/user', async (req, res) => {
  try {
    const { userId, username, firstName, lastName } = req.body;
    
    let user = await User.findOne({ userId });
    
    if (!user) {
      user = new User({
        userId,
        username,
        firstName,
        lastName,
        balance: 0,
        openedCases: 0,
        inventory: []
      });
    } else {
      user.lastSeen = new Date();
      user.username = username || user.username;
      user.firstName = firstName || user.firstName;
      user.lastName = lastName || user.lastName;
    }
    
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Сохранить данные пользователя
app.post('/api/user/save', async (req, res) => {
  try {
    const { userId, balance, openedCases, inventory } = req.body;
    
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.balance = balance;
    user.openedCases = openedCases;
    user.inventory = inventory;
    user.lastSeen = new Date();
    
    await user.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить всех пользователей (только для админа)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ lastSeen: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновить баланс пользователя (для админа)
app.post('/api/user/balance', async (req, res) => {
  try {
    const { userId, newBalance, adminId } = req.body;
    
    // Проверка, что админ (тут нужно добавить проверку)
    if (adminId !== 123456789) { // ТВОЙ ID
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.balance = newBalance;
    await user.save();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить все кейсы
app.get('/api/cases', async (req, res) => {
  try {
    const cases = await Case.find();
    res.json(cases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Сохранить кейсы (для админа)
app.post('/api/cases/save', async (req, res) => {
  try {
    const { cases, adminId } = req.body;
    
    if (adminId !== 123456789) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    for (const [caseId, caseData] of Object.entries(cases)) {
      await Case.findOneAndUpdate(
        { caseId },
        { ...caseData, caseId, updatedAt: new Date() },
        { upsert: true }
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить все предметы
app.get('/api/items', async (req, res) => {
  try {
    const items = await Item.find();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить статистику
app.get('/api/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalOpenedCases = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$openedCases' } } }
    ]);
    const totalStars = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$balance' } } }
    ]);
    
    const topUsers = await User.find()
      .sort({ openedCases: -1 })
      .limit(10)
      .select('username firstName openedCases balance');
    
    res.json({
      totalUsers,
      totalOpenedCases: totalOpenedCases[0]?.total || 0,
      totalStars: totalStars[0]?.total || 0,
      topUsers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
