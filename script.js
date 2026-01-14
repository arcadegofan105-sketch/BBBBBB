// ===== CONFIG =====
const API_URL = '/api'
const SPIN_PRICE = 1
const FULL_ROUNDS = 5
const MIN_WITHDRAW_TON = 5
const MIN_DEPOSIT_TON = 0.1

const wheelSectors = [
  { emoji: '📅', name: 'Календарь', price: 1.5 },
  { emoji: '🐸', name: 'Пепе', price: 0.0 },
  { emoji: '💋', name: 'Губы', price: 0.0 },
  { emoji: '🧸', name: 'Мишка', price: 0.1 },
  { emoji: '🍀', name: 'Клевер', price: 0.0 },
  { emoji: '🍑', name: 'Персик', price: 0.0 },
  { emoji: '🧸', name: 'Мишка', price: 0.1 },
]


// ===== CUSTOM IMAGES =====
// Файлы должны лежать рядом с index.html: /epepepepe.webp и /epersok.webp
const GIFT_IMAGES = {
	Пепе: 'epepepepe.webp',
	Персик: 'epersok.webp',
}

function giftVisual(item) {
	const file = GIFT_IMAGES[item?.name]
	if (file) return `<span class="gift-icon" style="background-image:url('${file}')"></span>`
	return item?.emoji || '🎁'
}

// ===== TELEGRAM =====
const tg = window.Telegram?.WebApp || null
const notTelegram = document.getElementById('not-telegram')
const appRoot = document.getElementById('app-root')

function showNotTelegram() {
	if (notTelegram) notTelegram.style.display = 'block'
	if (appRoot) appRoot.style.display = 'none'
}

function showApp() {
	if (notTelegram) notTelegram.style.display = 'none'
	if (appRoot) appRoot.style.display = 'block'
}

if (!tg) {
	showNotTelegram()
	throw new Error('Telegram WebApp not found')
}

tg.ready()
tg.expand()
document.body.style.backgroundColor = tg.themeParams?.bg_color || '#02051a'
showApp()

const INIT_DATA = tg.initData
const telegramUser = tg.initDataUnsafe?.user || null

// ===== TON CONNECT =====
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
	manifestUrl: `${location.origin}/tonconnect-manifest.json`,
	buttonRootId: 'ton-connect',
})

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

// ✅ Withdraw TON modal
const withdrawModal = document.getElementById('withdraw-modal')
const withdrawAmountInput = document.getElementById('withdraw-amount-input')
const withdrawCancelBtn = document.getElementById('withdraw-cancel')
const withdrawConfirmBtn = document.getElementById('withdraw-confirm')
const withdrawBalanceHint = document.getElementById('withdraw-balance-hint')

// ===== STATE =====
let currentRotation = 0
let balance = 0
let inventory = []
let currentPrize = null
let isSpinning = false

// ===== HELPERS =====
function updateBalanceUI() {
	const rounded = Number((balance || 0).toFixed(2))
	if (balanceValueSpan) balanceValueSpan.textContent = String(rounded)
	if (balanceValueSpan2) balanceValueSpan2.textContent = String(rounded)
	if (balanceValueSpan3) balanceValueSpan3.textContent = String(rounded)
	if (withdrawBalanceHint) withdrawBalanceHint.textContent = String(rounded)
}

function setLastPrizeText(prize) {
	if (!lastPrizeSpan) return
	lastPrizeSpan.textContent = prize ? `${prize.emoji} ${prize.name}` : '—'
}

function openModal(prize) {
	if (!prizeModal) return

	// эмодзи заменяем на картинку, если есть
	if (modalPrizeEmoji) modalPrizeEmoji.innerHTML = giftVisual(prize)

	modalPrizeName.textContent = prize.name
	modalPrizePrice.textContent = Number(prize.price || 0).toFixed(2)
	prizeModal.classList.add('active')
}

function closeModal() {
	if (!prizeModal) return
	prizeModal.classList.remove('active')
}

// ✅ Withdraw modal helpers
function openWithdrawModal(prefillAmount = '') {
	if (!withdrawModal) return
	updateBalanceUI()
	if (withdrawAmountInput) {
		withdrawAmountInput.value =
			prefillAmount !== undefined && prefillAmount !== null ? String(prefillAmount) : ''
		withdrawAmountInput.focus()
	}
	withdrawModal.classList.add('active')
}

function closeWithdrawModal() {
	if (!withdrawModal) return
	withdrawModal.classList.remove('active')
}

function renderWheel() {
	if (!wheel) return
	const sectorNodes = wheel.querySelectorAll('.sector')
	sectorNodes.forEach((node, i) => {
		const s = wheelSectors[i]
		if (!s) {
			node.textContent = '❔'
			node.title = ''
			return
		}
		node.innerHTML = giftVisual(s)
		node.title = `${s.name} (${s.price} TON)`
	})
}

function renderPrizesList() {
	// блоки снизу колеса: .prizes-grid .prize-item
	const items = document.querySelectorAll('.prizes-grid .prize-item')
	items.forEach((card, i) => {
		const s = wheelSectors[i]
		if (!s) return

		const emojiEl = card.querySelector('.prize-emoji')
		const nameEl = card.querySelector('.prize-name')

		if (emojiEl) emojiEl.innerHTML = giftVisual(s)
		if (nameEl) nameEl.textContent = s.name
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

function updateTelegramUserUI() {
	if (!telegramUser) return

	const userName = telegramUser.first_name || telegramUser.username || 'User'
	document
		.querySelectorAll('.user-name, .profile-name')
		.forEach(el => (el.textContent = userName))

	const idEl = document.querySelector('.profile-id')
	if (idEl) idEl.textContent = `ID: ${telegramUser.id}`

	if (telegramUser.photo_url) {
		document.querySelectorAll('.avatar, .profile-avatar').forEach(avatar => {
			avatar.style.backgroundImage = `url(${telegramUser.photo_url})`
			avatar.style.backgroundSize = 'cover'
			avatar.style.backgroundPosition = 'center'
		})
	}
}

// ===== TON CONNECT (deposit lock) =====
function isWalletConnected() {
	return Boolean(tonConnectUI?.account?.address)
}

function updateDepositButtonState() {
	if (!depositBtn) return
	depositBtn.disabled = !isWalletConnected()
	if (depositBtn.disabled) {
		depositBtn.title = 'Сначала подключи TON-кошелёк'
	} else {
		depositBtn.title = ''
	}
}

tonConnectUI.onStatusChange(() => {
	updateDepositButtonState()
})

// ===== API (initData auth) =====
async function apiPost(path, body = {}) {
	const res = await fetch(`${API_URL}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ initData: INIT_DATA, ...body }),
	})

	const data = await res.json().catch(() => ({}))
	if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
	return data
}

async function fetchUserData() {
	const data = await apiPost('/me')
	balance = Number(data.balance || 0)
	inventory = Array.isArray(data.inventory) ? data.inventory : []
	updateBalanceUI()
	renderInventory()
	return data
}

async function spinApi() {
	return apiPost('/spin')
}

async function keepPrizeApi(prize) {
	return apiPost('/prize/keep', { prize })
}

async function sellPrizeApi(prize, idx) {
	const body = { prize }
	if (Number.isInteger(idx)) body.idx = idx
	return apiPost('/prize/sell', body)
}

async function applyPromoApi(code) {
	return apiPost('/promo/apply', { code })
}

// ✅ withdraw APIs
async function withdrawTonApi(amount) {
	return apiPost('/withdraw/ton', { amount })
}

async function withdrawGiftApi(idx) {
	return apiPost('/withdraw/gift', { idx })
}

// ✅ deposit APIs (auto)
async function depositInfoApi() {
	return apiPost('/deposit/info')
}
async function depositCreateApi(amount) {
	return apiPost('/deposit/create', { amount })
}
async function depositCheckApi(depositId) {
	return apiPost('/deposit/check', { depositId })
}

// ===== deposit helpers =====
function toNanoString(tonAmount) {
	return String(Math.round(tonAmount * 1e9))
}

function sleep(ms) {
	return new Promise(r => setTimeout(r, ms))
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
	if (withdrawModal?.classList.contains('active')) return

	if (balance < SPIN_PRICE) {
		alert('Недостаточно средств. Нужно минимум 1 TON.')
		return
	}

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
	balance = Number(prizeData.newBalance ?? balance - SPIN_PRICE)
	updateBalanceUI()

	// ✅ ВСЕГДА крутим на мишку (визуально тоже!)
	const bearIndex = wheelSectors.findIndex(s => s?.name === 'Мишка')
	const sectorIndex = bearIndex >= 0 ? bearIndex : 0

	// Математика без DOM (чтобы не было "попало на губы, а приз мишка")
	const N = wheelSectors.length
	const step = 360 / N
	const base = sectorIndex * step + step / 2 // центр сектора

	const desiredAngle = 270 // направление стрелки сверху
	const current = ((currentRotation % 360) + 360) % 360
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
		const data = await sellPrizeApi(currentPrize)
		balance = Number(data.newBalance ?? balance)
		updateBalanceUI()
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
		await fetchUserData()
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
			const data = await sellPrizeApi(item, idx)
			balance = Number(data.newBalance ?? balance)
			updateBalanceUI()
			await fetchUserData()
		} catch (err) {
			alert(err.message || 'Ошибка продажи')
		}
	}

	if (e.target.classList.contains('inv-withdraw')) {
		try {
			const r = await withdrawGiftApi(idx)
			inventory = Array.isArray(r.inventory) ? r.inventory : inventory
			renderInventory()
			alert('Заявка на вывод подарка отправлена админу.')
		} catch (err) {
			alert(err.message || 'Ошибка вывода подарка')
		}
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
		balance = Number(data.newBalance ?? balance)
		updateBalanceUI()
		promoInput.value = ''
		alert(`Промокод применён: +${Number(data.amount || 0).toFixed(2)} TON`)
	} catch (err) {
		alert(err.message || 'Ошибка промокода')
	}
})

// ✅ DEPOSIT TON (auto)
depositBtn?.addEventListener('click', async () => {
	try {
		if (!isWalletConnected()) {
			alert('Сначала подключи TON-кошелёк (Connect wallet).')
			return
		}

		let minDeposit = MIN_DEPOSIT_TON
		try {
			const info = await depositInfoApi()
			minDeposit = Number(info.minDeposit ?? MIN_DEPOSIT_TON)
		} catch (_) {}

		const raw = prompt(`Введите сумму депозита (минимум ${minDeposit} TON):`, String(minDeposit))
		if (raw === null) return

		const amountTon = Number(String(raw).replace(',', '.').trim())
		if (!Number.isFinite(amountTon) || amountTon <= 0) {
			alert('Введите корректную сумму')
			return
		}
		if (amountTon < minDeposit) {
			alert(`Минимум ${minDeposit} TON`)
			return
		}

		depositBtn.disabled = true

		const dep = await depositCreateApi(amountTon)

		const tx = {
			validUntil: Math.floor(Date.now() / 1000) + 360,
			messages: [
				{
					address: dep.address,
					amount: toNanoString(dep.amount),
					payload: dep.payloadBase64,
				},
			],
		}

		await tonConnectUI.sendTransaction(tx, {
			modals: ['before', 'success', 'error'],
			notifications: ['before', 'success', 'error'],
			skipRedirectToWallet: 'never',
		})

		for (let i = 0; i < 12; i++) {
			await sleep(5000)
			const r = await depositCheckApi(dep.depositId)
			if (r.credited) {
				await fetchUserData()
				alert(`Депозит зачислен: +${Number(dep.amount).toFixed(2)} TON`)
				return
			}
		}

		alert('Транзакция отправлена. Если не зачислилось — подожди 1–2 минуты и попробуй ещё раз.')
	} catch (err) {
		alert(err.message || 'Ошибка депозита')
	} finally {
		updateDepositButtonState()
	}
})

// ✅ open withdraw TON modal
withdrawBtn?.addEventListener('click', () => {
	openWithdrawModal(String(Math.max(MIN_WITHDRAW_TON, 5)))
})

withdrawCancelBtn?.addEventListener('click', () => closeWithdrawModal())

withdrawConfirmBtn?.addEventListener('click', async () => {
	const raw = String(withdrawAmountInput?.value || '').replace(',', '.').trim()
	const amount = Number(raw)

	if (!Number.isFinite(amount)) {
		alert('Введите корректную сумму')
		return
	}
	if (amount < MIN_WITHDRAW_TON) {
		alert(`Минимум ${MIN_WITHDRAW_TON} TON`)
		return
	}
	if (amount > balance) {
		alert('Недостаточно средств')
		return
	}

	try {
		withdrawConfirmBtn.disabled = true

		const r = await withdrawTonApi(amount)
		balance = Number(r.newBalance ?? balance)
		updateBalanceUI()

		closeWithdrawModal()
		alert(`Заявка на вывод ${amount.toFixed(2)} TON отправлена админу.`)
	} catch (err) {
		alert(err.message || 'Ошибка заявки на вывод')
	} finally {
		withdrawConfirmBtn.disabled = false
	}
})

// ===== CRASH (синхронизация с сервером) =====
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
	if (crashMultiplierEl) crashMultiplierEl.textContent = `${crashMultiplier.toFixed(2)}x`
	if (crashBetAmount > 0 && crashPotentialWinEl) {
		crashPotentialWinEl.textContent = `${(crashBetAmount * crashMultiplier).toFixed(2)} TON`
	}
	if (crashCurrentBetEl) {
		crashCurrentBetEl.textContent = crashBetAmount > 0 ? `${crashBetAmount.toFixed(2)} TON` : '—'
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

async function startCrash() {
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

	try {
		const r = await apiPost('/crash/bet', { amount: crashBetAmount })
		balance = Number(r.newBalance ?? balance)
		updateBalanceUI()
	} catch (err) {
		alert(err.message || 'Ошибка ставки')
		return
	}

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

async function cashoutCrash() {
	if (crashState !== 'playing') return

	const winAmount = crashBetAmount * crashMultiplier

	try {
		const r = await apiPost('/crash/cashout', { amount: winAmount })
		balance = Number(r.newBalance ?? balance)
		updateBalanceUI()
		endCrash(true)
	} catch (err) {
		alert(err.message || 'Ошибка вывода')
	}
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
	if (crashCanvas) {
		initCrashCanvas()
		drawCrashGraph()
	}
})

// ===== INIT =====
;(async function init() {
	updateTelegramUserUI()
	renderWheel()
	renderPrizesList()
	setLastPrizeText(null)

	if (crashCanvas) {
		initCrashCanvas()
		drawCrashGraph()
	}

	updateDepositButtonState()

	try {
		await fetchUserData()
	} catch (err) {
		alert('Ошибка авторизации/сервера: ' + (err.message || 'unknown'))
	}
})()

