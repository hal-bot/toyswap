#!/usr/bin/env node
// seed.mjs — creates 10 Bluey-character swappers, each with 6 items (2 toy, 2 book, 2 misc)

const BASE = 'http://localhost:8080/api';

const swappers = [
  { userId: 'bluey_heeler',    username: 'bluey_heeler',    firstName: 'Bluey',    lastName: 'Heeler',    password: 'password123' },
  { userId: 'bingo_heeler',    username: 'bingo_heeler',    firstName: 'Bingo',    lastName: 'Heeler',    password: 'password123' },
  { userId: 'bandit_heeler',   username: 'bandit_heeler',   firstName: 'Bandit',   lastName: 'Heeler',    password: 'password123' },
  { userId: 'chilli_heeler',   username: 'chilli_heeler',   firstName: 'Chilli',   lastName: 'Heeler',    password: 'password123' },
  { userId: 'jack_wheeler',    username: 'jack_wheeler',    firstName: 'Jack',     lastName: 'Wheeler',   password: 'password123' },
  { userId: 'chloe_heeler',    username: 'chloe_heeler',    firstName: 'Chloe',    lastName: 'Heeler',    password: 'password123' },
  { userId: 'judo_malik',      username: 'judo_malik',      firstName: 'Judo',     lastName: 'Malik',     password: 'password123' },
  { userId: 'mackenzie_dog',   username: 'mackenzie_dog',   firstName: 'Mackenzie', lastName: 'Dog',      password: 'password123' },
  { userId: 'coco_parrot',     username: 'coco_parrot',     firstName: 'Coco',     lastName: 'Parrot',    password: 'password123' },
  { userId: 'calypso_teacher', username: 'calypso_teacher', firstName: 'Calypso',  lastName: 'Teacher',   password: 'password123' },
];

// 2 toy, 2 book, 2 misc per swapper — each row: [name, type, condition, ageLevel, requireBatteries]
const itemTemplates = [
  ['Keepy Uppy Ball',         'toy',  'new',         'toddler', false],
  ['Magic Xylophone',         'toy',  'lite wear',   'toddler', false],
  ['The Sleepy Crab Book',    'book', 'new',         'toddler', false],
  ['Dad Baby Story Book',     'book', 'lite wear',   'child',   false],
  ['Grannies Dress-Up Box',   'misc', 'medium wear', 'child',   false],
  ['Explorers Craft Kit',     'misc', 'new',         'kid',     false],
];

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function seed() {
  let swapperOk = 0;
  let itemOk = 0;

  for (const swapper of swappers) {
    try {
      await post('/swappers', swapper);
      console.log(`✓ Created swapper: ${swapper.username}`);
      swapperOk++;
    } catch (err) {
      console.warn(`⚠ Swapper ${swapper.username}: ${err.message}`);
    }

    for (const [name, type, condition, ageLevel, requireBatteries] of itemTemplates) {
      try {
        await post(`/items?ownerId=${swapper.userId}`, {
          name: `${name} (${swapper.firstName}'s)`,
          type,
          condition,
          ageLevel,
          requireBatteries,
        });
        itemOk++;
      } catch (err) {
        console.warn(`  ⚠ Item "${name}" for ${swapper.username}: ${err.message}`);
      }
    }

    console.log(`  ↳ Added 6 items for ${swapper.firstName}`);
  }

  console.log(`\nDone! ${swapperOk}/10 swappers created, ${itemOk}/60 items created.`);
}

seed().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
