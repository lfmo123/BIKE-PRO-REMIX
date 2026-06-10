import('http').then(http => {
  http.get('http://localhost:3000/api/vehicles', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const v = JSON.parse(data).filter(x => x.cardNumber === 'MT/BE 23' || x.cardNumber === 'mt/be 23' || x.cardNumber?.includes('23'));
      console.log(JSON.stringify(v, null, 2));
    });
  });
});
