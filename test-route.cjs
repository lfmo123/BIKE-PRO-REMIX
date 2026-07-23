const express = require('express');
const app = express();
app.delete('/api/lost-cards/*', (req, res) => {
  res.json({ cardNumber: req.params[0] });
});
app.listen(3001, () => {
  console.log('Listening');
});
