const express = require('express')
const path = require('path')
const db = require('./db')

const app = express()

const PORT = Number(process.env.PORT) || 3001
const HOST = '0.0.0.0'
const ROOT_DIR = path.resolve(__dirname, '..')

app.use(express.json({ limit: '1mb' }))
app.use(express.static(ROOT_DIR))

// ===== GAME CONFIG (must match front expectations) =====
const SPIN_PRICE = 1.0

// Шансы как в твоем старом коде (в сумме 100):
const WHEEL_PRIZES = [
  { emoji: '🐸', name: 'Пепе', price: 0.0, chance: 50 },
  { emoji: '🍑', name: 'Персик', price: 0.0, chance: 50 },
]


function pickWeightedPrize() {
	const total = WHEEL_PRIZES.reduce((s, p) => s + p.chance, 0)
	let r = Math.random() * total
	for (const p of WHEEL_PRIZES) {
		r -= p.chance
		if (r <= 0) return { emoji: p.emoji, name: p.name, price: Number(p.price) }
	}
	const last = WHEEL_PRIZES[WHEEL_PRIZES.length - 1]
	return { emoji: last.emoji, name: last.name, price: Number(last.price) }
}

// ===== API =====

app.get('/api/health', (req, res) => {
	res.json({
		ok: true,
		service: 'wheelsbot-backend',
		time: new Date().toISOString(),
	})
})

// Получить или создать профиль пользователя + инвентарь
app.get('/api/me', async (req, res) => {
	try {
		const telegramId = String(req.query.telegramId || '').trim()
		if (!telegramId)
			return res.status(400).json({ error: 'telegramId required' })

		const found = await db.query(
			`SELECT id, telegram_id, username, first_name, balance, created_at
       FROM users
       WHERE telegram_id = $1`,
			[telegramId]
		)

		let user = found.rows[0]

		if (!user) {
			const created = await db.query(
				`INSERT INTO users (telegram_id, username, first_name, balance)
         VALUES ($1, $2, $3, $4)
         RETURNING id, telegram_id, username, first_name, balance, created_at`,
				[telegramId, `User_${telegramId}`, null, 5.0]
			)
			user = created.rows[0]
		}

		const inv = await db.query(
			`SELECT id, name, emoji, price, created_at
       FROM inventory_items
       WHERE user_id = $1
       ORDER BY id DESC`,
			[user.id]
		)

		return res.json({
			telegramId: user.telegram_id,
			username: user.username,
			firstName: user.first_name,
			balance: Number(user.balance),
			inventory: inv.rows.map(x => ({
				id: x.id,
				name: x.name,
				emoji: x.emoji,
				price: Number(x.price),
				createdAt: x.created_at,
			})),
		})
	} catch (err) {
		console.error('GET /api/me error:', err)
		return res.status(500).json({ error: 'Internal server error' })
	}
})

// Крутить колесо (списываем 1 TON, выбираем приз, логируем игру + транзакцию)
app.post('/api/spin', async (req, res) => {
	const telegramId = String(req.body?.telegramId || '').trim()
	if (!telegramId) return res.status(400).json({ error: 'telegramId required' })

	const client = await db.pool.connect()
	try {
		await client.query('BEGIN')

		// 1) user lock (чтобы два спина параллельно не ушли в минус)
		const ures = await client.query(
			`SELECT id, balance
       FROM users
       WHERE telegram_id = $1
       FOR UPDATE`,
			[telegramId]
		)

		if (ures.rowCount === 0) {
			await client.query('ROLLBACK')
			return res
				.status(404)
				.json({ error: 'User not found. Call /api/me first.' })
		}

		const userId = ures.rows[0].id
		const balance = Number(ures.rows[0].balance)

		if (balance < SPIN_PRICE) {
			await client.query('ROLLBACK')
			return res.status(400).json({ error: 'Insufficient balance' })
		}

		// 2) choose prize
		const prize = pickWeightedPrize()

		// 3) decrement balance
		const newBalance = Number((balance - SPIN_PRICE).toFixed(2))

		await client.query(
			`UPDATE users
       SET balance = $1, updated_at = now()
       WHERE id = $2`,
			[newBalance, userId]
		)

		// 4) games log
		await client.query(
			`INSERT INTO games (user_id, type, bet, result, prize)
       VALUES ($1, 'wheel', $2, $3, $4)`,
			[userId, SPIN_PRICE, 0.0, JSON.stringify(prize)]
		)

		// 5) transactions log
		await client.query(
			`INSERT INTO transactions (user_id, type, amount, description)
       VALUES ($1, 'spin', $2, $3)`,
			[userId, -SPIN_PRICE, 'Spin wheel']
		)

		await client.query('COMMIT')
		return res.json({ prize, newBalance })
	} catch (err) {
		await client.query('ROLLBACK')
		console.error('POST /api/spin error:', err)
		return res.status(500).json({ error: 'Internal server error' })
	} finally {
		client.release()
	}
})

// Оставить приз (добавить в inventory)
app.post('/api/prize/keep', async (req, res) => {
	try {
		const telegramId = String(req.body?.telegramId || '').trim()
		const prize = req.body?.prize

		if (!telegramId)
			return res.status(400).json({ error: 'telegramId required' })
		if (!prize || !prize.name || !prize.emoji)
			return res.status(400).json({ error: 'prize required' })

		const u = await db.query(`SELECT id FROM users WHERE telegram_id = $1`, [
			telegramId,
		])
		if (u.rowCount === 0)
			return res.status(404).json({ error: 'User not found' })

		const userId = u.rows[0].id

		await db.query(
			`INSERT INTO inventory_items (user_id, name, emoji, price)
       VALUES ($1, $2, $3, $4)`,
			[
				userId,
				String(prize.name),
				String(prize.emoji),
				Number(prize.price || 0),
			]
		)

		return res.json({ success: true })
	} catch (err) {
		console.error('POST /api/prize/keep error:', err)
		return res.status(500).json({ error: 'Internal server error' })
	}
})

// Продать приз (начислить цену приза на баланс + транзакция)
app.post('/api/prize/sell', async (req, res) => {
	const telegramId = String(req.body?.telegramId || '').trim()
	const prize = req.body?.prize

	if (!telegramId) return res.status(400).json({ error: 'telegramId required' })
	if (!prize || !prize.name)
		return res.status(400).json({ error: 'prize required' })

	const amount = Number(prize.price || 0)

	const client = await db.pool.connect()
	try {
		await client.query('BEGIN')

		const ures = await client.query(
			`SELECT id, balance
       FROM users
       WHERE telegram_id = $1
       FOR UPDATE`,
			[telegramId]
		)

		if (ures.rowCount === 0) {
			await client.query('ROLLBACK')
			return res.status(404).json({ error: 'User not found' })
		}

		const userId = ures.rows[0].id
		const balance = Number(ures.rows[0].balance)
		const newBalance = Number((balance + amount).toFixed(2))

		await client.query(
			`UPDATE users
       SET balance = $1, updated_at = now()
       WHERE id = $2`,
			[newBalance, userId]
		)

		await client.query(
			`INSERT INTO transactions (user_id, type, amount, description)
       VALUES ($1, 'prize_sell', $2, $3)`,
			[userId, amount, `Sold ${String(prize.name)}`]
		)

		await client.query('COMMIT')
		return res.json({ success: true, newBalance })
	} catch (err) {
		await client.query('ROLLBACK')
		console.error('POST /api/prize/sell error:', err)
		return res.status(500).json({ error: 'Internal server error' })
	} finally {
		client.release()
	}
})

// Применить промокод (одноразово на пользователя)
app.post('/api/promo/apply', async (req, res) => {
	const telegramId = String(req.body?.telegramId || '').trim()
	const codeRaw = String(req.body?.code || '').trim()

	if (!telegramId) return res.status(400).json({ error: 'telegramId required' })
	if (!codeRaw) return res.status(400).json({ error: 'code required' })

	const code = codeRaw.toUpperCase()

	// Промокоды (позже перенесем в таблицу, пока в коде)
	const PROMOS = {
		FREEEFORADMIN: 100,
		GIFT1: 1,
		GIFT5: 5,
		BONUS: 2,
	}

	const amount = PROMOS[code]
	if (!amount) return res.status(400).json({ error: 'Неверный промокод' })

	const client = await db.pool.connect()
	try {
		await client.query('BEGIN')

		const ures = await client.query(
			`SELECT id, balance
       FROM users
       WHERE telegram_id = $1
       FOR UPDATE`,
			[telegramId]
		)

		if (ures.rowCount === 0) {
			await client.query('ROLLBACK')
			return res.status(404).json({ error: 'User not found' })
		}

		const userId = ures.rows[0].id
		const balance = Number(ures.rows[0].balance)

		// проверка "уже использовал"
		const already = await client.query(
			`SELECT 1 FROM promo_redemptions WHERE user_id = $1 AND code = $2`,
			[userId, code]
		)

		if (already.rowCount > 0) {
			await client.query('ROLLBACK')
			return res.status(400).json({ error: 'Промокод уже использован' })
		}

		const newBalance = Number((balance + amount).toFixed(2))

		await client.query(
			`UPDATE users
       SET balance = $1, updated_at = now()
       WHERE id = $2`,
			[newBalance, userId]
		)

		await client.query(
			`INSERT INTO promo_redemptions (user_id, code, amount)
       VALUES ($1, $2, $3)`,
			[userId, code, amount]
		)

		await client.query(
			`INSERT INTO transactions (user_id, type, amount, description)
       VALUES ($1, 'promo', $2, $3)`,
			[userId, amount, `Promo code: ${code}`]
		)

		await client.query('COMMIT')
		return res.json({ success: true, amount, newBalance })
	} catch (err) {
		await client.query('ROLLBACK')
		console.error('POST /api/promo/apply error:', err)
		return res.status(500).json({ error: 'Internal server error' })
	} finally {
		client.release()
	}
})

// ===== PAGES =====

app.get('/', (req, res) => {
	res.sendFile(path.join(ROOT_DIR, 'index.html'))
})

// fallback (после статики)
app.get('*', (req, res) => {
	res.sendFile(path.join(ROOT_DIR, 'index.html'))
})

app.listen(PORT, HOST, () => {
	console.log(`🚀 Backend running on ${HOST}:${PORT}`)
	console.log(`📦 Static root: ${ROOT_DIR}`)
})

