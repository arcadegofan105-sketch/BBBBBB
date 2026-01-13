// ===== CONFIG =====
const API_URL = '/api'

// ===== TELEGRAM INTEGRATION =====
const tg = window.Telegram?.WebApp

if (tg) {
	tg.ready()
	tg.expand()
	document.body.style.backgroundColor = tg.themeParams.bg_color || '#02051a'
	console.log('✅ Telegram Web App инициализирован')
	console.log('Telegram User:', tg.initDataUnsafe?.user)
}

const telegramUser = tg?.initDataUnsafe?.user
const TELEGRAM_ID = telegramUser ? telegramUser.id.toString() : '123456789' // Fallback только для теста; в проде проверяй наличие tg
console.log('🆔 Telegram ID:', TELEGRAM_ID)
console.log('👤 User Data:', telegramUser)

// ===== UI =====
const wheel = document.getElementById('wheel')
const spinButton = document.getElementById('spin-button')
const balanceValueSpan = document.getElementById('balance-value')
const balanceValueSpan2 = document.getElementById('balance-value-2')
const balanceValueSpan3 = document.getElementById('balance-value-3')
const lastPrizeSpan = document.getElementById('last-prize')

const promoInput = document.getElementById('promo-input')
const promoApplyBtn = document.getElementById('promo-apply')

const navButtons = document.querySelectorAll('.nav-btn')
const screens = {
	wheel: document.getElementById('screen-wheel'),
	crash: document.getElementById('screen-crash'),
	bonus: document.getElementById('screen-bonus'),
	profile: document.getElementById('screen-profile'),
}

const depositBtn = document.getElementById('deposit-btn')
const withdrawBtn = document.getElementById('withdraw-btn')

const prizeModal = document.getElementById('prize-modal')
const modalPrizeEmoji = document.getElementById('modal-prize-emoji')
const modalPrizeName = document.getElementById('modal-prize-name')
const modalPrizePrice = document.getElementById('modal-prize-price')
const modalSellBtn = document.getElementById('modal-sell')
const modalKeepBtn = document.getElementById('modal-keep')
const inventoryList = document.getElementById('inventory-list')

// deposit modal
const depositModal = document.getElementById('deposit-modal')
const depositAmountInput = document.getElementById('deposit-amount')
const depositConfirmBtn = document.getElementById('deposit-confirm-btn')
const depositCancelBtn = document.getElementById('deposit-cancel-btn')
const depositStatus = document.getElementById('deposit-status')

// ===== STATE =====
let currentRotation = 0
let balance = 5
let currentPrize = null
let inventory = []
let isSpinning = false
let userData = null
let sectorBaseAngles = null

const wheelSectors = [
	{ emoji: '🧸', name: 'Мишка', price: 0.1 },
	{ emoji: '🐸', name: 'Пепе', price: 0 },
	{ emoji: '💋', name: 'Губы', price: 0 },
	{ emoji: '📅', name: 'Календарь', price: 1.5 },
	{ emoji: '🍀', name: 'Клевер', price: 0 },
	{ emoji: '🍑', name: 'Слива', price: 0 },
	{ emoji: '🧸', name: 'Мишка', price: 0.1 },
]

const SPIN_PRICE = 1
const FULL_ROUNDS = 5

// ===== API FUNCTIONS =====
async function fetchUserData() {
	try {
		const res = await fetch(`${API_URL}me?telegramId=${TELEGRAM_ID}`)
		if (!res.ok) {
			const data = await res.json()
			throw new Error(data.error || 'Failed to fetch user')
		}
		const data = await res.json()
		userData = data
		balance = data.balance
		inventory = data.inventory || []
		updateBalanceUI()
		renderInventory()
		return data
	} catch (error) {
		console.error('Error fetching user:', error)
		showError('Ошибка загрузки данных пользователя: ' + error.message)
	}
}

async function spinWheel() {
	try {
		const res = await fetch(`${API_URL}spin`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ telegramId: TELEGRAM_ID }),
		})
		if (!res.ok) {
			const data = await res.json()
			throw new Error(data.error || 'Ошибка при прокрутке')
		}
		return await res.json()
	} catch (error) {
		console.error('Error spinning:', error)
		showError('Ошибка подключения к серверу: ' + error.message)
		return null
	}
}

async function keepPrize(prize) {
	try {
		const res = await fetch(`${API_URL}prize/keep`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ telegramId: TELEGRAM_ID, prize }),
		})
		if (!res.ok) {
			const data = await res.json()
			throw new Error(data.error || 'Ошибка')
		}
		await fetchUserData()
	} catch (error) {
		console.error('Error keeping prize:', error)
		showError('Ошибка подключения к серверу: ' + error.message)
	}
}

async function sellPrize(prize) {
	try {
		const res = await fetch(`${API_URL}prize/sell`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ telegramId: TELEGRAM_ID, prize }),
		})
		if (!res.ok) {
			const data = await res.json()
			throw new Error(data.error || 'Ошибка')
		}
		const data = await res.json()
		balance = data.newBalance
		updateBalanceUI()
	} catch (error) {
		console.error('Error selling prize:', error)
		showError('Ошибка подключения к серверу: ' + error.message)
	}
}

// ===== UI HELPERS =====
function updateBalanceUI() {
	const rounded = Number(balance.toFixed(2))
	if (balanceValueSpan) balanceValueSpan.textContent = rounded
	if (balanceValueSpan2) balanceValueSpan2.textContent = rounded
	if (balanceValueSpan3) balanceValueSpan3.textContent = rounded
}

function setLastPrizeText(prize) {
	if (lastPrizeSpan)
		lastPrizeSpan.textContent = prize ? `${prize.emoji} ${prize.name}` : '—'
}

function openModal(prize) {
	if (!prizeModal) return
	if (modalPrizeEmoji) modalPrizeEmoji.textContent = prize.emoji
	if (modalPrizeName) modalPrizeName.textContent = prize.name
	if (modalPrizePrice)
		modalPrizePrice.textContent = Number(prize.price || 0).toFixed(2)
	prizeModal.classList.add('active')
}

function closeModal() {
	if (!prizeModal) return
	prizeModal.classList.remove('active')
}

function renderWheel() {
	if (!wheel) return
	const sectorNodes = wheel.querySelectorAll('.sector')
	sectorNodes.forEach((node, i) => {
		const s = wheelSectors[i]
		node.textContent = s ? s.emoji : '❔'
		node.title = s ? `${s.name} (${s.price} TON)` : ''
	})
}

function renderInventory() {
	if (!inventoryList) return
	if (inventory.length === 0) {
		inventoryList.innerHTML = `
      <div class="inventory-empty">У вас пока нет подарков</div>
    `
		return
	}
	inventoryList.innerHTML = inventory
		.map((item, idx) => {
			const price = Number(item.price || 0).toFixed(2)
			return `
        <div class="inventory-item" data-idx="${idx}">
          <div class="inventory-item-top">
            <div class="inventory-item-emoji">${item.emoji}</div>
            <div class="inventory-item-price">${price} TON</div>
          </div>
          <div class="inventory-item-name">${item.name}</div>
          <div class="inventory-item-actions">
            <button class="inventory-btn inv-sell">Продать</button>
            <button class="inventory-btn inv-withdraw">Вывести</button>
          </div>
        </div>
      `
		})
		.join('')
}

function findSectorIndexForPrize(prize) {
	const matches = []
	for (let i = 0; i < wheelSectors.length; i++) {
		if (wheelSectors[i].name === prize.name) matches.push(i)
	}
	if (matches.length === 0) return 0
	return matches[Math.floor(Math.random() * matches.length)]
}

function computeSectorBaseAngles() {
	if (!wheel) return
	const prevTransition = wheel.style.transition
	const prevTransform = wheel.style.transform
	wheel.style.transition = 'none'
	wheel.style.transform = 'rotate(0deg)'
	wheel.offsetHeight // Force reflow
	const wheelRect = wheel.getBoundingClientRect()
	const cx = wheelRect.left + wheelRect.width / 2
	const cy = wheelRect.top + wheelRect.height / 2
	sectorBaseAngles = []
	const nodes = wheel.querySelectorAll('.sector')
	nodes.forEach((node, i) => {
		const r = node.getBoundingClientRect()
		const x = r.left + r.width / 2
		const y = r.top + r.height / 2
		let deg = Math.atan2(y - cy, x - cx) * (180 / Math.PI)
		deg = (deg + 360) % 360
		sectorBaseAngles[i] = deg
	})
	wheel.style.transform = prevTransform || 'rotate(0deg)'
	wheel.offsetHeight // Force reflow
	wheel.style.transition = prevTransition || ''
}

// ===== TELEGRAM UI UPDATE =====
function updateTelegramUserUI() {
	if (!telegramUser) return
	const userName = telegramUser.first_name || 'User'
	const userNameElements = document.querySelectorAll(
		'.user-name, .profile-name'
	)
	userNameElements.forEach(el => {
		el.textContent = userName
	})
	const userIdElement = document.querySelector('.profile-id')
	if (userIdElement) userIdElement.textContent = `ID: ${TELEGRAM_ID}`
	if (telegramUser.photo_url) {
		const avatars = document.querySelectorAll('.avatar, .profile-avatar')
		avatars.forEach(avatar => {
			avatar.style.backgroundImage = `url(${telegramUser.photo_url})`
			avatar.style.backgroundSize = 'cover'
			avatar.style.backgroundPosition = 'center'
		})
	}
	console.log('✅ UI обновлён с данными Telegram пользователя')
}

// ===== NAV =====
function setScreen(name) {
	Object.keys(screens).forEach(key => {
		if (screens[key]) screens[key].classList.toggle('active', key === name)
	})
	navButtons.forEach(btn => {
		btn.classList.toggle('active', btn.dataset.target === name)
	})
}

navButtons.forEach(btn => {
	btn.addEventListener('click', () => {
		setScreen(btn.dataset.target)
		if (btn.dataset.target === 'crash') {
			setTimeout(() => {
				initCrashCanvas()
				drawCrashGraph()
			}, 50)
		}
	})
})

// ===== SPIN =====
if (spinButton) {
	spinButton.addEventListener('click', async e => {
		e.preventDefault()
		e.stopPropagation()
		if (isSpinning) return
		if (prizeModal && prizeModal.classList.contains('active')) return
		if (balance < SPIN_PRICE) {
			showError('Недостаточно TON для прокрутки (нужно 1 TON).')
			return
		}
		if (!sectorBaseAngles) computeSectorBaseAngles()
		isSpinning = true
		spinButton.disabled = true
		const prizeData = await spinWheel()
		if (!prizeData) {
			isSpinning = false
			spinButton.disabled = false
			return
		}
		currentPrize = prizeData.prize
		balance -= SPIN_PRICE
		updateBalanceUI()
		const sectorIndex = findSectorIndexForPrize(currentPrize)
		const desiredAngle = 270
		const current = ((currentRotation % 360) + 360) % 360
		const base = sectorBaseAngles[sectorIndex]
		const delta = (desiredAngle - (base + current) + 3600) % 360
		currentRotation += FULL_ROUNDS * 360 + delta
		if (wheel)
			wheel.style.transform = `rotate(${currentRotation.toFixed(3)}deg)`
	})
}

// ===== FINISH SPIN =====
if (wheel) {
	wheel.addEventListener('transitionend', e => {
		if (e.propertyName !== 'transform') return
		if (!isSpinning) return
		currentRotation = ((currentRotation % 360) + 360) % 360
		wheel.style.transition = 'none'
		wheel.style.transform = `rotate(${currentRotation.toFixed(3)}deg)`
		wheel.offsetHeight // Force reflow
		wheel.style.transition = ''
		setLastPrizeText(currentPrize)
		openModal(currentPrize)
		isSpinning = false
	})
}

// ===== MODAL ACTIONS =====
if (modalSellBtn) {
	modalSellBtn.addEventListener('click', async () => {
		if (!currentPrize) return
		await sellPrize(currentPrize)
		currentPrize = null
		closeModal()
		if (spinButton) spinButton.disabled = false
	})
}

if (modalKeepBtn) {
	modalKeepBtn.addEventListener('click', async () => {
		if (!currentPrize) return
		await keepPrize(currentPrize)
		currentPrize = null
		closeModal()
		if (spinButton) spinButton.disabled = false
	})
}

// ===== INVENTORY BUTTONS =====
if (inventoryList) {
	inventoryList.addEventListener('click', e => {
		const card = e.target.closest('.inventory-item')
		if (!card) return
		const idx = Number(card.dataset.idx)
		const item = inventory[idx]
		if (!item) return
		if (e.target.classList.contains('inv-sell')) {
			showError('Функция продажи из инвентаря скоро будет добавлена')
		}
		if (e.target.classList.contains('inv-withdraw')) {
			showError('Функция вывода подарка скоро будет добавлена')
		}
	})
}

// ===== PROMO =====
if (promoApplyBtn) {
	promoApplyBtn.addEventListener('click', async () => {
		const code = promoInput?.value.trim()
		if (!code) {
			showError('Введите промокод')
			return
		}
		try {
			const res = await fetch(`${API_URL}promo/apply`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ telegramId: TELEGRAM_ID, code }),
			})
			if (!res.ok) {
				const data = await res.json()
				throw new Error(data.error || 'Ошибка применения промокода')
			}
			const data = await res.json()
			balance = data.newBalance
			updateBalanceUI()
			if (promoInput) promoInput.value = ''
			alert(`✅ Промокод применён! +${data.amount} TON`)
		} catch (error) {
			console.error('Error applying promo:', error)
			showError('Ошибка подключения к серверу: ' + error.message)
		}
	})
}

// ===== CRASH GAME =====
const crashCanvas = document.getElementById('crash-canvas')
const crashCtx = crashCanvas ? crashCanvas.getContext('2d') : null
const crashMultiplierEl = document.getElementById('crash-multiplier')
const crashStatusEl = document.getElementById('crash-status')
const crashBetInput = document.getElementById('crash-bet-input')
const crashPlayBtn = document.getElementById('crash-play-btn')
const crashCashoutBtn = document.getElementById('crash-cashout-btn')
const crashCurrentBetEl = document.getElementById('crash-current-bet')
const crashPotentialWinEl = document.getElementById('crash-potential-win')

let crashState = 'idle'
let crashMultiplier = 1.0
let crashPoint = null
let crashBetAmount = 0
let crashAnimFrame = null
let crashStartTime = null

// ✅ Настройка темпа: 10x достигается примерно за 30 секунд
const CRASH_TARGET_X = 10
const CRASH_TARGET_T = 30 // seconds
const CRASH_K = Math.log(CRASH_TARGET_X) / CRASH_TARGET_T

function initCrashCanvas() {
	if (!crashCanvas || !crashCtx) return
	const dpr = window.devicePixelRatio || 1
	const rect = crashCanvas.getBoundingClientRect()

	crashCanvas.width = Math.floor(rect.width * dpr)
	crashCanvas.height = Math.floor(rect.height * dpr)

	// ✅ не накапливаем scale при повторных вызовах
	crashCtx.setTransform(dpr, 0, 0, dpr, 0, 0)

	crashCanvas.style.width = rect.width + 'px'
	crashCanvas.style.height = rect.height + 'px'
}

function generateCrashPoint() {
	const r = Math.random()
	if (r < 0.8) {
		// 80%: 10x..100x
		return 10 + Math.random() * 90
	}
	// 20%: 101x..1000x
	return 101 + Math.random() * 899
}

function drawCrashGraph() {
	if (!crashCtx || !crashCanvas) return
	const rect = crashCanvas.getBoundingClientRect()
	const w = rect.width
	const h = rect.height

	crashCtx.clearRect(0, 0, w, h)

	const gradient = crashCtx.createLinearGradient(0, 0, w, h)
	gradient.addColorStop(0, 'rgba(56, 189, 248, 0.05)')
	gradient.addColorStop(1, 'rgba(139, 92, 246, 0.05)')
	crashCtx.fillStyle = gradient
	crashCtx.fillRect(0, 0, w, h)

	crashCtx.strokeStyle = 'rgba(148, 163, 184, 0.1)'
	crashCtx.lineWidth = 1
	for (let i = 0; i < 5; i++) {
		const y = (h / 5) * i
		crashCtx.beginPath()
		crashCtx.moveTo(0, y)
		crashCtx.lineTo(w, y)
		crashCtx.stroke()
	}

	if (crashState === 'playing' || crashState === 'crashed') {
		const maxY = Math.max(crashPoint || 10, 2)
		const progress = Math.min((crashMultiplier - 1) / Math.max(maxY - 1, 1), 1)

		crashCtx.strokeStyle = crashState === 'crashed' ? '#ef4444' : '#38bdf8'
		crashCtx.lineWidth = 3
		crashCtx.beginPath()
		crashCtx.moveTo(0, h)

		for (let i = 0; i <= progress * 100; i++) {
			const x = (i / 100) * w
			const t = i / 100
			const mult = 1 + t * (crashMultiplier - 1)
			const y = h - (mult - 1) * (h / maxY)
			if (i === 0) crashCtx.moveTo(x, y)
			else crashCtx.lineTo(x, y)
		}
		crashCtx.stroke()

		if (crashState === 'playing') {
			crashCtx.shadowBlur = 20
			crashCtx.shadowColor = '#38bdf8'
			crashCtx.stroke()
			crashCtx.shadowBlur = 0
		}
	}
}

function updateCrashMultiplier() {
	if (crashMultiplierEl) crashMultiplierEl.textContent = crashMultiplier.toFixed(2) + 'x'
	if (crashBetAmount > 0 && crashPotentialWinEl) {
		crashPotentialWinEl.textContent = (crashBetAmount * crashMultiplier).toFixed(2) + ' TON'
	}
}

function startCrash() {
	if (crashState !== 'idle') return

	crashBetAmount = parseFloat(crashBetInput?.value)
	if (isNaN(crashBetAmount) || crashBetAmount < 0.1) {
		showError('Минимальная ставка: 0.1 TON')
		return
	}
	if (balance < crashBetAmount) {
		showError('Недостаточно TON для ставки.')
		return
	}

	balance -= crashBetAmount
	updateBalanceUI()

	crashPoint = generateCrashPoint()
	crashMultiplier = 1.0
	crashState = 'playing'
	crashStartTime = Date.now()

	if (crashStatusEl) {
		crashStatusEl.textContent = 'Летим! 🚀'
		crashStatusEl.style.color = '#38bdf8'
	}
	if (crashPlayBtn) crashPlayBtn.disabled = true
	if (crashCashoutBtn) crashCashoutBtn.disabled = false
	if (crashMultiplierEl) crashMultiplierEl.classList.remove('crashed')
	if (crashCurrentBetEl) crashCurrentBetEl.textContent = crashBetAmount.toFixed(2) + ' TON'

	updateCrashMultiplier()
	drawCrashGraph()
	animateCrash()
}

function animateCrash() {
	if (crashState !== 'playing') return
	const elapsed = (Date.now() - crashStartTime) / 1000

	// ✅ экспоненциальный рост (ускоряется), 10x примерно за 30 сек
	crashMultiplier = Math.exp(CRASH_K * elapsed)

	if (crashMultiplier >= crashPoint) {
		crashMultiplier = crashPoint
		endCrash(false)
		return
	}

	updateCrashMultiplier()
	drawCrashGraph()
	crashAnimFrame = requestAnimationFrame(animateCrash)
}

function cashoutCrash() {
	if (crashState !== 'playing') return
	const winAmount = crashBetAmount * crashMultiplier
	balance += winAmount
	updateBalanceUI()
	endCrash(true)
}

function endCrash(cashedOut) {
	crashState = 'crashed'
	if (crashAnimFrame) {
		cancelAnimationFrame(crashAnimFrame)
		crashAnimFrame = null
	}

	if (crashPlayBtn) crashPlayBtn.disabled = false
	if (crashCashoutBtn) crashCashoutBtn.disabled = true

	if (crashStatusEl) {
		if (cashedOut) {
			crashStatusEl.textContent = '✅ Выведено!'
			crashStatusEl.style.color = '#10b981'
		} else {
			crashStatusEl.textContent = '💥 Крах!'
			crashStatusEl.style.color = '#ef4444'
		}
	}

	if (!cashedOut && crashMultiplierEl) crashMultiplierEl.classList.add('crashed')

	updateCrashMultiplier()
	drawCrashGraph()

	setTimeout(() => {
		crashState = 'idle'
		crashMultiplier = 1.0
		crashBetAmount = 0
		crashPoint = null

		if (crashStatusEl) {
			crashStatusEl.textContent = 'Ожидание...'
			crashStatusEl.style.color = '#94a3b8'
		}
		if (crashMultiplierEl) {
			crashMultiplierEl.textContent = '1.00x'
			crashMultiplierEl.classList.remove('crashed')
		}
		if (crashCurrentBetEl) crashCurrentBetEl.textContent = '—'
		if (crashPotentialWinEl) crashPotentialWinEl.textContent = '—'
		drawCrashGraph()
	}, 2000)
}

if (crashPlayBtn) crashPlayBtn.addEventListener('click', startCrash)
if (crashCashoutBtn) crashCashoutBtn.addEventListener('click', cashoutCrash)

window.addEventListener('resize', () => {
	initCrashCanvas()
	drawCrashGraph()
})

// при первом показе экрана тоже полезно инициализировать
initCrashCanvas()
drawCrashGraph()


// ===== INIT =====
async function init() {
	updateTelegramUserUI()
	await fetchUserData()
	setLastPrizeText(null)
	renderWheel()
	renderInventory()
	setScreen('wheel')
	computeSectorBaseAngles()
	if (crashCanvas) {
		initCrashCanvas()
		drawCrashGraph()
	}
	console.log('✅ Приложение инициализировано')
}

window.addEventListener('resize', () => computeSectorBaseAngles())
init()

// =======================
// TON CONNECT + DEPOSIT UI (FIXED)
// =======================
let tonConnectUI = null

function toNano(ton) {
	const v = Number(ton)
	if (!Number.isFinite(v) || v <= 0) return null
	return String(Math.round(v * 1e9))
}

function showError(message) {
	alert(message) // Можно заменить на кастомный toast для лучшего UX
}

function setDepositStatus(text, type = '') {
	if (!depositStatus) return
	depositStatus.textContent = text || ''
	depositStatus.classList.remove('ok', 'err')
	if (type) depositStatus.classList.add(type)
}

function openDepositModal() {
	if (!depositModal) return
	depositModal.classList.remove('hidden')
	depositModal.classList.add('active')
	setDepositStatus('')
	setTimeout(() => depositAmountInput?.focus(), 50)
}

function closeDepositModal() {
	if (!depositModal) return
	depositModal.classList.remove('active')
	depositModal.classList.add('hidden')
	setDepositStatus('')
}

async function createDepositBackend() {
	try {
		const res = await fetch(`${API_URL}ton/deposit/create`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId: TELEGRAM_ID }),
		})
		if (!res.ok) {
			const data = await res.json()
			throw new Error(data.error || 'Ошибка создания депозита')
		}
		return await res.json()
	} catch (error) {
		throw error
	}
}

async function checkDepositBackend(depositId) {
	try {
		const res = await fetch(`${API_URL}ton/deposit/check`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ depositId }),
		})
		if (!res.ok) {
			const data = await res.json()
			throw new Error(data.error || 'Ошибка проверки депозита')
		}
		return await res.json()
	} catch (error) {
		throw error
	}
}

async function pollDeposit(depositId, timeoutMs = 90000, intervalMs = 2500) {
	const start = Date.now()
	while (Date.now() - start < timeoutMs) {
		try {
			const r = await checkDepositBackend(depositId)
			if (r?.status === 'completed') return r
		} catch (error) {
			console.error('Poll error:', error)
			throw error // Прерываем при ошибке
		}
		await new Promise(resolve => setTimeout(resolve, intervalMs))
	}
	throw new Error('Долго нет подтверждения. Проверь позже.')
}

async function initTONConnect() {
	if (typeof TON_CONNECT_UI === 'undefined') {
		console.error(
			'TON_CONNECT_UI not loaded. Ensure script is included in HTML.'
		)
		return
	}
	tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
		manifestUrl: `${window.location.origin}/tonconnect-manifest.json`, // Динамический URL для Railway
		buttonRootId: 'tonconnect-button',
	})
	tonConnectUI.uiOptions = { language: 'ru' }
}

async function handleDepositClick(e) {
	e?.preventDefault?.()
	if (!tg) {
		showError('Откройте мини-апп внутри Telegram.')
		return
	}
	if (!tonConnectUI) {
		showError('TonConnect ещё не инициализирован')
		return
	}
	if (!tonConnectUI.connected) {
		try {
			await tonConnectUI.openModal()
		} catch (error) {
			showError('Ошибка подключения кошелька: ' + error.message)
			return
		}
		if (!tonConnectUI.connected) return
	}
	openDepositModal()
}

if (depositCancelBtn) {
	depositCancelBtn.addEventListener('click', e => {
		e.preventDefault()
		closeDepositModal()
	})
}

if (depositModal) {
	depositModal.addEventListener('click', e => {
		if (e.target === depositModal) closeDepositModal()
	})
}

if (depositConfirmBtn) {
	depositConfirmBtn.addEventListener('click', async e => {
		e.preventDefault()
		try {
			const amountTon = depositAmountInput?.value
			const amountNano = toNano(amountTon)
			if (!amountNano) {
				setDepositStatus('Введите корректную сумму TON', 'err')
				return
			}
			if (Number(amountTon) < 0.1) {
				setDepositStatus('Минимальный депозит: 0.1 TON', 'err')
				return
			}
			setDepositStatus('Создаём депозит...', '')
			const dep = await createDepositBackend()
			const address = dep.address
			const depositId = dep.depositId || dep.comment
			const payload = dep.payload
			if (!address || !depositId || !payload) {
				throw new Error('Backend не вернул address/depositId/payload')
			}
			setDepositStatus('Подтвердите транзакцию в кошельке...', '')
			await tonConnectUI.sendTransaction({
				validUntil: Math.floor(Date.now() / 1000) + 300,
				messages: [{ address, amount: amountNano, payload }],
			})
			setDepositStatus('Ждём подтверждение...', '')
			await pollDeposit(depositId)
			setDepositStatus('✅ Зачислено!', 'ok')
			await fetchUserData()
			setTimeout(closeDepositModal, 900)
		} catch (err) {
			setDepositStatus(
				String(err?.message || 'Ошибка депозита').slice(0, 200),
				'err'
			)
		}
	})
}

if (depositBtn) depositBtn.addEventListener('click', handleDepositClick)
if (withdrawBtn)
	withdrawBtn.addEventListener('click', () =>
		alert('Вывод будет добавлен на следующем этапе')
	)

document.addEventListener('DOMContentLoaded', () => {
	initTONConnect()
})

