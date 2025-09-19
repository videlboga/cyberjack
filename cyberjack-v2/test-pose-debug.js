// Тест для отладки команд поз
const testPoseCommand = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/chat/cmfn0xxiv006chxmqcyx0bnqf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Встань',
        characterId: 'clx8q8q8q8q8q8q8q8q8q8q8',
        userId: 'clx8q8q8q8q8q8q8q8q8q8q9'
      })
    });

    const data = await response.json();
    console.log('Ответ API:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Ошибка:', error);
  }
};

testPoseCommand();
