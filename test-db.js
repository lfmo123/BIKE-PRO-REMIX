fetch('http://localhost:3000/api/system/db-status')
  .then(res => res.json())
  .then(data => console.log('Resultado do Teste:', data))
  .catch(err => console.error('Erro no Teste:', err));
