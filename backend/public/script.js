// ===== CONFIG =====
const API_URL = '/api'
const SPIN_PRICE = 0 // Бесплатно
const FULL_ROUNDS = 5

const wheelSectors = [
	{ emoji: '🧸', name: 'Мишка', price: 0.1 },
	{ emoji: '🐸', name: 'Пепе', price: 1500 },
	{ emoji: '💋', name: 'Губы', price: 0.0 },
	{ emoji: '📅', name: 'Календарь', price: 1.5 },
	{ emoji: '🍀', name: 'Клевер', price: 0.0 },
	{ emoji: '🍑', name: 'Персик', price: 500 },
	{ emoji: '🧸', name: 'Мишка', price: 0.1 },
]

// ===== CUSTOM IMAGES =====
const GIFT_IMAGES = {
	'Пепе': 'epepepepe.webp',
	'Персик': 'epersok.webp',
}

function giftVisual(item) {
	const file = GIFT_IMAGES[item?.name]
	if (file) return `<span class="gift-icon" style="background-image:url('${file}')"></span>`
	return item?.emoji || '🎁'
}

// ===== UI ELEMENTS =====
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

// ===== STATE =====
let currentRotation = 0
let balance = 5
let inventory = []
let currentPrize = null
let isSpinning = false
let sectorBaseAngles = null

// ===== HELPERS =====
function updateBalanceUI() {
	const rounded = Number((balance || 0).toFixed(2))
	if (balanceValueSpan) balanceValueSpan.textContent = String(rounded)
	if (balanceValueSpan2) balanceValueSpan2.textContent = String(rounded)
	if (balanceValueSpan3) balanceValueSpan3.textContent = String(rounded)
}

function setLastPrizeText(prize) {
	if (!lastPrizeSpan) return
	if (!prize) {
		lastPrizeSpan.textContent = '—'
		return
	}
	lastPrizeSpan.innerHTML = `${giftVisual(prize)} ${prize.name}`
}

function openModal(prize) {
	if (!prizeModal) return
	modalPrizeEmoji.innerHTML = giftVisual(prize)
	modalPrizeName.textContent = prize.name
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
		if (!s) {
			node.textContent = '❔'
			return
		}
		// Используем giftVisual для картинок Пепе и Персика
		node.innerHTML = giftVisual(s)
		node.title = `${s.name} (${s.price} TON)`
	})
}

function renderInventory() {
	if (!inventoryList) return

	if (!Array.isArray(inventory) || inventory.length === 0) {
		inventoryList.innerHTML = `<div class="inventory-empty">У вас пока нет подарков</div>`
		return
	}

	inventoryList.innerHTML = inventory
		.map((item, idx) => {
			const price = Number(item.price || 0).toFixed(2)
			return `
        <div class="inventory-item" data-idx="${idx}">
          <div class="inventory-item-top">
            <div class="inventory-item-emoji">${giftVisual(item)}</div>
            <div class="inventory-item-price">${price} TON</div>
          </div>
          <div class="inventory-item-name">${item.name || 'Подарок'}</div>
          <div class="inventory-item-actions">
            <button class="inventory-btn inv-sell" type="button">Продать</button>
            <button class="inventory-btn inv-withdraw" type="button">Вывести</button>
          </div>
        </div>
      `
		})
		.join('')
}

function setScreen(name) {
	Object.keys(screens).forEach(key => {
		screens[key]?.classList.toggle('active', key === name)
	})
	navButtons.forEach(btn => {
		btn.classList.toggle('active', btn.dataset.target === name)
	})
}

function computeSectorBaseAngles() {
	if (!wheel) return

	const prevTransition = wheel.style.transition
	const prevTransform = wheel.style.transform

	wheel.style.transition = 'none'
	wheel.style.transform = 'rotate(0deg)'
	wheel.offsetHeight

	const wheelRect = wheel.getBoundingClientRect()
	const cx = wheelRect.left + wheelRect.width / 2
	const cy = wheelRect.top + wheelRect.height / 2

	sectorBaseAngles = []
	const nodes = wheel.querySelectorAll('.sector')
	nodes.forEach((node, i) => {
		const r = node.getBoundingClientRect()
		const x = r.left + r.width / 2
		const y = r.top + r.height / 2

		let deg = (Math.atan2(y - cy, x - cx) * 180) / Math.PI
		deg = (deg + 360) % 360
		sectorBaseAngles[i] = deg
	})

	wheel.style.transform = prevTransform || 'rotate(0deg)'
	wheel.offsetHeight
	wheel.style.transition = prevTransition
}

function findSectorIndexForPrize(prize) {
	const matches = []
	for (let i = 0; i < wheelSectors.length; i++) {
		if (wheelSectors[i].name === prize?.name) matches.push(i)
	}
	if (matches.length === 0) return 0
	return matches[Math.floor(Math.random() * matches.length)]
}

// ===== API (без авторизации) =====
async function apiPost(path, body = {}) {
	const res = await fetch(`${API_URL}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})

	const data = await res.json().catch(() => ({}))
	if (!res.ok) {
		throw new Error(data?.error || `HTTP ${res.status}`)
	}
	return data
}

async function spinApi() {
	const randomSector = wheelSectors[Math.floor(Math.random() * wheelSectors.length)]
	return { prize: randomSector, newBalance: balance }
}

async function keepPrizeApi(prize) {
	inventory.push(prize)
	renderInventory()
	return { success: true }
}

async function sellPrizeApi(prize) {
	balance += Number(prize.price || 0)
	updateBalanceUI()
	
	const idx = inventory.findIndex(i => i.name === prize.name && i.emoji === prize.emoji)
	if (idx >= 0) inventory.splice(idx, 1)
	renderInventory()
	
	return { newBalance: balance }
}

async function applyPromoApi(code) {
	const amount = 1.0
	balance += amount
	updateBalanceUI()
	return { newBalance: balance, amount }
}

// ===== EVENTS =====
navButtons.forEach(btn => {
	btn.addEventListener('click', () => setScreen(btn.dataset.target))
})

spinButton?.addEventListener('click', async e => {
	e.preventDefault()
	e.stopPropagation()
	if (isSpinning) return
	if (prizeModal?.classList.contains('active')) return

	if (!sectorBaseAngles) computeSectorBaseAngles()

	isSpinning = true
	spinButton.disabled = true

	let prizeData = null
	try {
		prizeData = await spinApi()
	} catch (err) {
		alert(err.message || 'Ошибка при прокрутке')
		isSpinning = false
		spinButton.disabled = false
		return
	}

	currentPrize = prizeData.prize

	const sectorIndex = findSectorIndexForPrize(currentPrize)
	const desiredAngle = 270
	const current = ((currentRotation % 360) + 360) % 360
	const base = sectorBaseAngles?.[sectorIndex] ?? 0
	const delta = (((desiredAngle - base - current) % 360) + 360) % 360

	currentRotation += FULL_ROUNDS * 360 + delta
	wheel.style.transform = `rotate(${currentRotation.toFixed(3)}deg)`
})

wheel?.addEventListener('transitionend', e => {
	if (e.propertyName !== 'transform') return
	if (!isSpinning) return

	currentRotation = ((currentRotation % 360) + 360) % 360
	wheel.style.transition = 'none'
	wheel.style.transform = `rotate(${currentRotation.toFixed(3)}deg)`
	wheel.offsetHeight
	wheel.style.transition = ''

	setLastPrizeText(currentPrize)
	openModal(currentPrize)

	isSpinning = false
})

modalSellBtn?.addEventListener('click', async () => {
	if (!currentPrize) return
	try {
		await sellPrizeApi(currentPrize)
		currentPrize = null
		closeModal()
		spinButton.disabled = false
	} catch (err) {
		alert(err.message || 'Ошибка продажи')
	}
})

modalKeepBtn?.addEventListener('click', async () => {
	if (!currentPrize) return
	try {
		await keepPrizeApi(currentPrize)
		currentPrize = null
		closeModal()
		spinButton.disabled = false
	} catch (err) {
		alert(err.message || 'Ошибка сохранения')
	}
})

inventoryList?.addEventListener('click', async e => {
	const card = e.target.closest('.inventory-item')
	if (!card) return

	const idx = Number(card.dataset.idx)
	const item = inventory?.[idx]
	if (!item) return

	if (e.target.classList.contains('inv-sell')) {
		try {
			await sellPrizeApi(item)
		} catch (err) {
			alert(err.message || 'Ошибка продажи')
		}
	}

	if (e.target.classList.contains('inv-withdraw')) {
		alert('Вывод будет добавлен позже.')
	}
})

promoApplyBtn?.addEventListener('click', async () => {
	const code = (promoInput?.value || '').trim()
	if (!code) {
		alert('Введите промокод')
		return
	}

	try {
		const data = await applyPromoApi(code)
		promoInput.value = ''
		alert(`Промокод применён: +${Number(data.amount || 0).toFixed(2)} TON`)
	} catch (err) {
		alert(err.message || 'Ошибка промокода')
	}
})

depositBtn?.addEventListener('click', () =>
	alert('Депозит будет добавлен позже.')
)
withdrawBtn?.addEventListener('click', () =>
	alert('Вывод будет добавлен позже.')
)

// ===== CRASH =====
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

function initCrashCanvas() {
	if (!crashCanvas || !crashCtx) return
	const dpr = window.devicePixelRatio || 1
	const rect = crashCanvas.getBoundingClientRect()
	crashCanvas.width = rect.width * dpr
	crashCanvas.height = rect.height * dpr
	crashCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function generateCrashPoint() {
	const rand = Math.random() * 100
	if (rand < 99) return 1.01 + Math.random() * 0.4
	if (rand < 99.9) return 1.41 + Math.random() * 1.59
	return 3.0 + Math.random() * 7.0
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
	for (let i = 0; i <= 5; i++) {
		const y = (h / 5) * i
		crashCtx.beginPath()
		crashCtx.moveTo(0, y)
		crashCtx.lineTo(w, y)
		crashCtx.stroke()
	}

	if (crashState === 'playing' || crashState === 'crashed') {
		const maxYMult = Math.max(crashPoint || 2, 2)
		const progress = Math.min((crashMultiplier - 1) / (maxYMult - 1), 1)

		crashCtx.strokeStyle = crashState === 'crashed' ? '#ef4444' : '#38bdf8'
		crashCtx.lineWidth = 3
		crashCtx.beginPath()
		crashCtx.moveTo(0, h)

		for (let i = 0; i <= progress * 100; i++) {
			const x = (i / 100) * w
			const t = i / 100
			const mult = 1 + t * (crashMultiplier - 1)
			const y = h - ((mult - 1) * h) / Math.max(maxYMult - 1, 0.2)
			if (i === 0) crashCtx.moveTo(x, y)
			else crashCtx.lineTo(x, y)
		}
		crashCtx.stroke()
	}
}

function updateCrashMultiplierUI() {
	if (crashMultiplierEl)
		crashMultiplierEl.textContent = `${crashMultiplier.toFixed(2)}x`
	if (crashBetAmount > 0 && crashPotentialWinEl) {
		crashPotentialWinEl.textContent = `${(
			crashBetAmount * crashMultiplier
		).toFixed(2)} TON`
	}
	if (crashCurrentBetEl) {
		crashCurrentBetEl.textContent =
			crashBetAmount > 0 ? `${crashBetAmount.toFixed(2)} TON` : '—'
	}
}

function animateCrash() {
	if (crashState !== 'playing') return
	const elapsed = (Date.now() - crashStartTime) / 1000
	crashMultiplier = 1 + elapsed * 0.2

	if (crashMultiplier >= crashPoint) {
		crashMultiplier = crashPoint
		endCrash(false)
		return
	}

	updateCrashMultiplierUI()
	drawCrashGraph()
	crashAnimFrame = requestAnimationFrame(animateCrash)
}

function startCrash() {
	if (crashState !== 'idle') return

	crashBetAmount = parseFloat(crashBetInput?.value || '0')
	if (isNaN(crashBetAmount) || crashBetAmount < 0.1) {
		alert('Минимум 0.1 TON')
		return
	}
	if (balance < crashBetAmount) {
		alert('Недостаточно средств.')
		return
	}

	balance -= crashBetAmount
	updateBalanceUI()

	crashPoint = generateCrashPoint()
	crashMultiplier = 1.0
	crashState = 'playing'
	crashStartTime = Date.now()

	if (crashStatusEl) {
		crashStatusEl.textContent = 'Летим...'
		crashStatusEl.style.color = '#38bdf8'
	}

	if (crashPlayBtn) crashPlayBtn.disabled = true
	if (crashCashoutBtn) crashCashoutBtn.disabled = false

	updateCrashMultiplierUI()
	drawCrashGraph()
	animateCrash()
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
	if (crashAnimFrame) cancelAnimationFrame(crashAnimFrame)
	crashAnimFrame = null

	if (crashPlayBtn) crashPlayBtn.disabled = false
	if (crashCashoutBtn) crashCashoutBtn.disabled = true

	if (crashStatusEl) {
		crashStatusEl.textContent = cashedOut ? 'Вы забрали!' : 'Бум!'
		crashStatusEl.style.color = cashedOut ? '#10b981' : '#ef4444'
	}

	updateCrashMultiplierUI()
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
		if (crashMultiplierEl) crashMultiplierEl.textContent = '1.00x'
		if (crashCurrentBetEl) crashCurrentBetEl.textContent = '—'
		if (crashPotentialWinEl) crashPotentialWinEl.textContent = '—'
		drawCrashGraph()
	}, 2000)
}

crashPlayBtn?.addEventListener('click', startCrash)
crashCashoutBtn?.addEventListener('click', cashoutCrash)

window.addEventListener('resize', () => {
	computeSectorBaseAngles()
	if (crashCanvas) {
		initCrashCanvas()
		drawCrashGraph()
	}
})

// ===== INIT =====
;(function init() {
	renderWheel()
	setLastPrizeText(null)
	updateBalanceUI()
	renderInventory()

	computeSectorBaseAngles()
	if (crashCanvas) {
		initCrashCanvas()
		drawCrashGraph()
	}
})()

