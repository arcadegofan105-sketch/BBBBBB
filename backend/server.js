const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

// CORS и JSON
app.use(cors());
app.use(express.json());

// Раздаём статику из корня репозитория (где index.html, script.js, style.css)
app.use(express.static(path.join(__dirname, '..')));

// Простейший эндпоинт вращения колеса без авторизации и БД
app.post('/spin', (req, res) => {
  // Здесь задаём шансы выпадения секторов (индексы 0-5)
  const sectors = [0, 1, 2, 3, 4, 5];
  const randomIndex = Math.floor(Math.random() * sectors.length);
  const result = sectors[randomIndex];

  res.json({ success: true, sector: result });
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
