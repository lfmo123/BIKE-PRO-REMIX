const express = require('express');
const app = express();
app.delete('/api/lost-cards/:cardNumber(*)', (req, res) => {
  res.json({ cardNumber: req.params.cardNumber });
});
app.listen(3001, () => {
  console.log('Listening');
});
