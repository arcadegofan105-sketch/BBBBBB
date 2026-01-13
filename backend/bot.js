const { Telegraf, Markup } = require('telegraf')
const { getSession, setSession } = require('./session-store')

const BOT_TOKEN = process.env.BOT_TOKEN
const WEB_APP_URL = process.env.WEB_APP_URL
const BACKEND_URL = process.env.BACKEND_URL

if (!BOT_TOKEN) throw new Error('BOT_TOKEN is required')
if (!WEB_APP_URL) throw new Error('WEB_APP_URL is required')
if (!BACKEND_URL) throw new Error('BACKEND_URL is required')

const bot = new Telegraf(BOT_TOKEN)

// Простая "память" на пользователя
bot.use(async (ctx, next) => {
	const key = String(ctx.from?.id || ctx.chat?.id || 'unknown')
	ctx.sessionKey = key
	ctx.session = getSession(key)
	await next()
	setSession(key, ctx.session)
})

// Хелпер: получить профиль из backend
async function getProfile(telegramId) {
	const url = new URL('/api/me', BACKEND_URL)
	url.searchParams.set('telegramId', String(telegramId))

	const res = await fetch(url.toString())
	const data = await res.json()

	if (!res.ok) {
		throw new Error(data?.error || `Backend error: ${res.status}`)
	}

	return data
}

bot.start(async ctx => {
	const userId = ctx.from.id
	const firstName = ctx.from.first_name || 'User'

	let profile
	try {
		profile = await getProfile(userId)
	} catch (e) {
		console.error('GET /api/me failed:', e)
		return ctx.reply(
			'❌ Не удалось загрузить профиль. Проверь BACKEND_URL и работу backend.'
		)
	}

	const inventoryCount = Array.isArray(profile.inventory)
		? profile.inventory.length
		: 0

	const text =
		`🎰 Добро пожаловать, ${firstName}!\n\n` +
		`🆔 ID: ${profile.telegramId}\n` +
		`💰 Баланс: ${Number(profile.balance).toFixed(2)} TON\n` +
		`🎁 Подарков: ${inventoryCount}\n\n` +
		`Нажми кнопку ниже, чтобы открыть мини-апп 👇`

	return ctx.reply(
		text,
		Markup.inlineKeyboard([
			[Markup.button.webApp('🎮 Играть', WEB_APP_URL)],
			[
				Markup.button.callback('💎 Мой профиль', 'profile'),
				Markup.button.callback('📊 Статистика', 'stats'),
			],
		])
	)
})

bot.action('profile', async ctx => {
	const userId = ctx.from.id

	try {
		const profile = await getProfile(userId)
		const inventoryCount = Array.isArray(profile.inventory)
			? profile.inventory.length
			: 0

		await ctx.reply(
			`👤 Профиль\n` +
				`🆔 ID: ${profile.telegramId}\n` +
				`💰 Баланс: ${Number(profile.balance).toFixed(2)} TON\n` +
				`🎁 Подарков: ${inventoryCount}`
		)
	} catch (e) {
		console.error('profile action failed:', e)
		await ctx.reply('❌ Ошибка получения профиля.')
	}

	return ctx.answerCbQuery()
})

bot.action('stats', async ctx => {
	// Сделаем позже: эндпоинт /api/stats
	await ctx.reply('📊 Статистика будет добавлена на следующем этапе.')
	return ctx.answerCbQuery()
})

// Получение данных из WebApp (если ты позже начнешь отправлять web_app_data)
bot.on('message', async ctx => {
	const webAppData = ctx.message?.web_app_data?.data
	if (webAppData) {
		// пока просто эхо, потом можно делать команды/покупки
		return ctx.reply(`✅ Получены данные из WebApp: ${webAppData}`)
	}
})

bot.launch().then(() => console.log('✅ Bot started (polling)'))

// Чтобы корректно выключался на Railway
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
